import { join } from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import { z } from "zod";
import { readTextIfExists, withLock, writeJsonAtomic, readJsonIfExists } from "./fsx.ts";
import type { Ctx } from "./context.ts";
import type { LoadedCourse, ExerciseEntry } from "./course.ts";

/** 追記ログの1行。真実はこちらで、progress.json はその投影。 */
export type HistoryEvent =
  | {
      t: "attempt";
      at: string;
      course: string;
      exercise: string;
      ok: boolean;
      ms: number;
      xp: number;
    }
  | { t: "reset"; at: string; course: string; exercise: string };

export interface ExerciseProgress {
  solved: boolean;
  attempts: number;
  failed: number;
  xp: number;
  bestMs?: number;
  lastAt?: string;
}

export interface CourseProgress {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  streak: { days: number; lastDay: string | null };
  exercises: Record<string, ExerciseProgress>;
  lessons: Record<string, { solved: number; total: number }>;
  next: { lessonId: string; exerciseId: string } | null;
  updatedAt: string;
  events: number;
}

interface ProgressFile {
  schema: 1;
  courses: Record<string, CourseProgress>;
}

const HISTORY_FILE = "history.jsonl";
const PROGRESS_FILE = "progress.json";
export const XP_PER_LEVEL = 100;

function localDay(date = new Date()): string {
  return date.toLocaleDateString("sv-SE");
}

export function historyPath(ctx: Ctx): string {
  return join(ctx.stateDir, HISTORY_FILE);
}
export function progressPath(ctx: Ctx): string {
  return join(ctx.stateDir, PROGRESS_FILE);
}

export async function readHistory(ctx: Ctx): Promise<{ events: HistoryEvent[]; broken: number }> {
  const raw = await readTextIfExists(historyPath(ctx));
  if (!raw) return { events: [], broken: 0 };
  const events: HistoryEvent[] = [];
  let broken = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as HistoryEvent;
      if (parsed && typeof parsed === "object" && typeof (parsed as { t?: unknown }).t === "string") {
        events.push(parsed);
      } else {
        broken += 1;
      }
    } catch {
      broken += 1;
    }
  }
  return { events, broken };
}

const ProgressFileSchema = z.object({
  schema: z.literal(1),
  courses: z.record(z.string(), z.unknown()),
});

async function readProgressFile(ctx: Ctx): Promise<ProgressFile> {
  const parsed = await readJsonIfExists(progressPath(ctx), ProgressFileSchema);
  if (!parsed) return { schema: 1, courses: {} };
  return parsed as ProgressFile;
}

export async function recordAttempt(
  ctx: Ctx,
  course: LoadedCourse,
  entry: ExerciseEntry,
  result: { ok: boolean; durationMs: number },
): Promise<CourseProgress> {
  const event: HistoryEvent = {
    t: "attempt",
    at: new Date().toISOString(),
    course: course.id,
    exercise: entry.id,
    ok: result.ok,
    ms: result.durationMs,
    xp: entry.spec.xp,
  };
  return appendEvent(ctx, course, event);
}

export async function recordReset(ctx: Ctx, course: LoadedCourse, entry: ExerciseEntry): Promise<CourseProgress> {
  return appendEvent(ctx, course, {
    t: "reset",
    at: new Date().toISOString(),
    course: course.id,
    exercise: entry.id,
  });
}

async function appendEvent(ctx: Ctx, course: LoadedCourse, event: HistoryEvent): Promise<CourseProgress> {
  await mkdir(ctx.stateDir, { recursive: true });
  return withLock(join(ctx.lockDir, "state.lock"), async () => {
    await appendFile(historyPath(ctx), JSON.stringify(event) + "\n", "utf8");
    return recomputeAndWrite(ctx, course);
  });
}

/** history.jsonl から progress を作り直して書く。壊れた行は無視する。 */
export async function rebuildProgress(ctx: Ctx, course: LoadedCourse): Promise<CourseProgress> {
  return withLock(join(ctx.lockDir, "state.lock"), async () => recomputeAndWrite(ctx, course));
}

async function recomputeAndWrite(ctx: Ctx, course: LoadedCourse): Promise<CourseProgress> {
  const { events } = await readHistory(ctx);
  const projection = replay(course, events);
  const file = await readProgressFile(ctx);
  file.schema = 1;
  file.courses[course.id] = projection;
  await writeJsonAtomic(progressPath(ctx), file);
  return projection;
}

export async function readProgress(ctx: Ctx, course: LoadedCourse): Promise<{ progress: CourseProgress; broken: number }> {
  // 投影はいつでも履歴から作り直せるので、読むたびに作り直して照合する。
  // これで progress.json が手で壊されても、古くても、常に正しい値が返る。
  const { events, broken } = await readHistory(ctx);
  const progress = replay(course, events);
  const file = await readProgressFile(ctx);
  file.schema = 1;
  file.courses[course.id] = progress;
  await writeJsonAtomic(progressPath(ctx), file);
  return { progress, broken };
}

export function replay(course: LoadedCourse, events: HistoryEvent[]): CourseProgress {
  const exercises: Record<string, ExerciseProgress> = {};
  const lessons: Record<string, { solved: number; total: number }> = {};
  for (const lesson of course.lessons) {
    lessons[lesson.ref.id] = { solved: 0, total: lesson.exercises.length };
  }

  let xp = 0;
  let used = 0;
  const days = new Set<string>();

  for (const event of events) {
    if (event.course !== course.id) continue;
    used += 1;
    const entry = course.byId.get(event.exercise);
    if (!entry) continue;

    if (event.t === "attempt") {
      const current =
        exercises[entry.id] ??
        (exercises[entry.id] = { solved: false, attempts: 0, failed: 0, xp: 0 });
      current.attempts += 1;
      current.lastAt = event.at;
      if (event.ok) {
        if (!current.solved) {
          current.solved = true;
          current.xp += entry.spec.xp;
          xp += entry.spec.xp;
        }
        if (current.bestMs === undefined || event.ms < current.bestMs) current.bestMs = event.ms;
      } else {
        current.failed += 1;
      }
      days.add(event.at.slice(0, 10));
    } else if (event.t === "reset") {
      // reset は作業コピーの話で、達成状態は消さない（履歴には残す）。
    }
  }

  for (const lesson of course.lessons) {
    const solved = lesson.exercises.filter((entry) => exercises[entry.id]?.solved).length;
    lessons[lesson.ref.id] = { solved, total: lesson.exercises.length };
  }

  const nextEntry = course.exercises.find((entry) => !exercises[entry.id]?.solved) ?? null;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;

  return {
    xp,
    level,
    xpIntoLevel,
    xpForNext: XP_PER_LEVEL,
    streak: computeStreak(days),
    exercises,
    lessons,
    next: nextEntry ? { lessonId: nextEntry.lessonId, exerciseId: nextEntry.id } : null,
    updatedAt: new Date().toISOString(),
    events: used,
  };
}

function computeStreak(days: Set<string>): { days: number; lastDay: string | null } {
  if (days.size === 0) return { days: 0, lastDay: null };
  const sorted = [...days].sort();
  const lastDay = sorted[sorted.length - 1];
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  if (lastDay !== today && lastDay !== yesterday) return { days: 0, lastDay };

  const set = new Set(sorted);
  let cursor = new Date(lastDay + "T12:00:00");
  let count = 0;
  for (;;) {
    const day = localDay(cursor);
    if (!set.has(day)) break;
    count += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return { days: count, lastDay };
}

