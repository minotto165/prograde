import { join } from "node:path";
import { createCtx, type Ctx } from "../../../../src/core/context.ts";
import {
  listCourses,
  loadCourse,
  findExercise,
  findLesson,
  type ExerciseEntry,
  type LoadedCourse,
} from "../../../../src/core/course.ts";
import { grade, type GradeResult } from "../../../../src/core/grader.ts";
import { describeJudge } from "../../../../src/core/judge.ts";
import { readProgress, recordAttempt, recordReset, XP_PER_LEVEL, type CourseProgress } from "../../../../src/core/progress.ts";
import { editableFiles, ensureWorkspace, resetWorkspace, writeWorkspace } from "../../../../src/core/attempt.ts";
import { renderMarkdown } from "../markdown.ts";

/** Web も CLI と同じ core を使う。ここだけがファイルシステムに触る。 */
export function webCtx(): Ctx {
  return createCtx();
}

export interface FileView {
  path: string;
  code: string;
  language: string;
}

export interface ExerciseLink {
  id: string;
  title: string;
  lessonId: string;
  lessonTitle: string;
}

export interface CourseStats {
  solved: number;
  total: number;
  xp: number;
  level: number;
  streak: number;
}

function stats(course: LoadedCourse, progress: CourseProgress): CourseStats {
  const total = course.exercises.length;
  const solved = course.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
  return { solved, total, xp: progress.xp, level: progress.level, streak: progress.streak.days };
}

function link(entry: ExerciseEntry): ExerciseLink {
  return { id: entry.id, title: entry.spec.title, lessonId: entry.lessonId, lessonTitle: entry.lessonTitle };
}

async function readEditable(workspace: string, entry: ExerciseEntry): Promise<FileView[]> {
  return await Promise.all(
    editableFiles(entry.spec).map(async (file) => ({
      path: file.path,
      code: await Bun.file(join(workspace, file.path)).text(),
      language: file.path.split(".").pop() ?? "text",
    })),
  );
}

export async function dashboard() {
  const ctx = webCtx();
  const summaries = await listCourses(ctx);
  const cards: {
    id: string;
    label: string;
    description: string;
    lessons: number;
    exercises: number;
    solved: number;
    xp: number;
    level: number;
    streak: number;
    next: ExerciseLink | null;
  }[] = [];
  let xp = 0;
  let solved = 0;
  let total = 0;
  let streak = 0;
  for (const summary of summaries) {
    const course = await loadCourse(ctx, summary.id);
    const { progress } = await readProgress(ctx, course);
    const value = stats(course, progress);
    xp += value.xp;
    solved += value.solved;
    total += value.total;
    streak = Math.max(streak, value.streak);
    cards.push({
      id: course.id,
      label: course.spec.label,
      description: course.spec.description ?? "",
      lessons: course.lessons.length,
      exercises: value.total,
      solved: value.solved,
      xp: value.xp,
      level: value.level,
      streak: value.streak,
      next: progress.next ? link(course.byId.get(progress.next.exerciseId)!) : null,
    });
  }
  return {
    courses: cards,
    totals: { xp, level: Math.floor(xp / XP_PER_LEVEL) + 1, solved, total, streak },
  };
}

export async function coursePage(courseId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const { progress } = await readProgress(ctx, course);
  const nextEntry = progress.next ? course.byId.get(progress.next.exerciseId) ?? null : null;
  const next = nextEntry ? link(nextEntry) : null;
  return {
    course,
    progress,
    stats: stats(course, progress),
    next,
    lessons: course.lessons.map((lesson, index) => ({
      id: lesson.ref.id,
      title: lesson.ref.title,
      goal: lesson.ref.goal ?? "",
      skills: lesson.ref.skills ?? [],
      estimateMin: lesson.ref.estimateMin ?? null,
      solved: progress.lessons[lesson.ref.id]?.solved ?? 0,
      total: lesson.exercises.length,
      exercises: lesson.exercises.map((entry) => ({
        id: entry.id,
        title: entry.spec.title,
        xp: entry.spec.xp,
        solved: progress.exercises[entry.id]?.solved ?? false,
        attempts: progress.exercises[entry.id]?.attempts ?? 0,
      })),
    })),
  };
}

export async function lessonPage(courseId: string, lessonId: string) {
  const { course, progress } = await coursePage(courseId);
  const lesson = findLesson(course, lessonId);
  const index = course.lessons.findIndex((item) => item.ref.id === lessonId);
  return {
    course,
    lesson,
    progress,
    docHtml: lesson.doc ? renderMarkdown(lesson.doc) : "",
    quiz: lesson.quiz,
    exercises: lesson.exercises.map((entry) => ({
      id: entry.id,
      title: entry.spec.title,
      env: entry.spec.env,
      xp: entry.spec.xp,
      hints: entry.spec.hints.length,
      solved: progress.exercises[entry.id]?.solved ?? false,
      attempts: progress.exercises[entry.id]?.attempts ?? 0,
    })),
    prevLesson: index > 0 ? course.lessons[index - 1].ref : null,
    nextLesson: index >= 0 && index < course.lessons.length - 1 ? course.lessons[index + 1].ref : null,
  };
}

export async function exercisePage(courseId: string, exerciseId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const entry = findExercise(course, exerciseId);
  const { progress } = await readProgress(ctx, course);
  const workspace = await ensureWorkspace(ctx, entry);
  const files = await readEditable(workspace, entry);
  const brief = (await Bun.file(join(entry.dir, "brief.md")).text().catch(() => "")) || "";
  const index = course.exercises.findIndex((item) => item.id === exerciseId);
  const previous = index > 0 ? course.exercises[index - 1] : null;
  const following = index >= 0 && index < course.exercises.length - 1 ? course.exercises[index + 1] : null;
  const current = progress.exercises[entry.id];
  const lesson = findLesson(course, entry.lessonId);
  const lessonIds = lesson.exercises.map((item) => item.id);
  return {
    course,
    entry,
    files,
    briefHtml: renderMarkdown(brief),
    objective: entry.spec.objective ?? "",
    hints: entry.spec.hints,
    solved: current?.solved ?? false,
    attempts: current?.attempts ?? 0,
    lesson: entry.lessonTitle,
    prev: previous ? link(previous) : null,
    next: following ? link(following) : null,
    position: { index: index + 1, total: course.exercises.length },
    lessonProgress: {
      index: lessonIds.indexOf(entry.id) + 1,
      total: lessonIds.length,
      solved: lessonIds.filter((id) => progress.exercises[id]?.solved).length,
    },
    /** 見本。判定ルールをそのまま表示用にしたもの（本体は言語を知らない）。 */
    expected: entry.spec.judge.map(describeJudge),
  };
}

function collectFiles(form: FormData, entry: ExerciseEntry): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of editableFiles(entry.spec)) {
    const value = form.get("file:" + file.path);
    if (value !== null) files[file.path] = String(value);
  }
  return files;
}

async function loadEntry(courseId: string, exerciseId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const entry = findExercise(course, exerciseId);
  return { ctx, course, entry };
}

export interface SubmitOutcome {
  kind: "grade" | "run" | "reset";
  result: GradeResult | null;
  files: FileView[];
  solved: boolean;
  message?: string;
}

export async function submit(courseId: string, exerciseId: string, form: FormData): Promise<SubmitOutcome> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  const files = collectFiles(form, entry);
  await writeWorkspace(ctx, entry, files);
  const result = await grade(ctx, course, entry, { files });
  await recordAttempt(ctx, course, entry, { ok: result.ok, durationMs: result.durationMs });
  const { progress } = await readProgress(ctx, course);
  return {
    kind: "grade",
    result,
    files: await readEditable(await ensureWorkspace(ctx, entry), entry),
    solved: progress.exercises[entry.id]?.solved ?? false,
  };
}

export async function run(courseId: string, exerciseId: string, form: FormData): Promise<SubmitOutcome> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  const files = collectFiles(form, entry);
  await writeWorkspace(ctx, entry, files);
  const result = await grade(ctx, course, entry, { files });
  return {
    kind: "run",
    result,
    files: await readEditable(await ensureWorkspace(ctx, entry), entry),
    solved: false,
  };
}

export async function reset(courseId: string, exerciseId: string): Promise<SubmitOutcome> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  await resetWorkspace(ctx, entry);
  await recordReset(ctx, course, entry);
  return { kind: "reset", result: null, files: await readEditable(await ensureWorkspace(ctx, entry), entry), solved: false };
}

export { gradeQuiz, type QuizResult } from "../../../../src/core/quiz.ts";
export { EnvError } from "../../../../src/core/errors.ts";

export type { LoadedCourse };
