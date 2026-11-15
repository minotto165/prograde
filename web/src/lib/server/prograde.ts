import { join } from "node:path";
import { error } from "@sveltejs/kit";
import { createCtx, type Ctx } from "../../../../src/core/context.ts";
import {
  listCourses,
  loadCourse,
  findExercise,
  findLesson,
  findChapter,
  findSection,
  type ExerciseEntry,
  type LoadedCourse,
  type LoadedLesson,
  type LoadedSection,
  type LoadedSlide,
} from "../../../../src/core/course.ts";
import { grade, type GradeResult } from "../../../../src/core/grader.ts";
import { describeJudge } from "../../../../src/core/judge.ts";
import { readProgress, recordAttempt, recordReset, XP_PER_LEVEL, type CourseProgress } from "../../../../src/core/progress.ts";
import { editableFiles, ensureWorkspace, resetWorkspace, writeWorkspace } from "../../../../src/core/attempt.ts";
import { normalizeNewlines } from "../../../../src/core/text.ts";
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

export interface StepLink {
  kind: "slide" | "exercise" | "lesson";
  href: string;
  label: string;
}

function sectionHref(
  courseId: string,
  lessonId: string,
  chapterId: string,
  sectionId: string,
  slideIndex = 1,
): string {
  const base = `/c/${courseId}/l/${lessonId}/ch/${chapterId}/s/${sectionId}`;
  return slideIndex <= 1 ? base : `${base}/${slideIndex}`;
}

function lessonHref(courseId: string, lessonId: string): string {
  return `/c/${courseId}/l/${lessonId}`;
}

type LessonStep =
  | { kind: "slide"; href: string; section: LoadedSection; slide: LoadedSlide }
  | { kind: "exercise"; href: string; section: LoadedSection; entry: ExerciseEntry };

/** セクションのスライドを順に並べ、最後にその演習を置いたレッスン全体の並び。 */
function lessonSteps(courseId: string, lesson: LoadedLesson): LessonStep[] {
  const out: LessonStep[] = [];
  for (const chapter of lesson.chapters) {
    for (const section of chapter.sections) {
      for (const slide of section.slides) {
        out.push({
          kind: "slide",
          href: sectionHref(courseId, lesson.ref.id, chapter.ref.id, section.ref.id, slide.index),
          section,
          slide,
        });
      }
      out.push({
        kind: "exercise",
        href: `/c/${courseId}/e/${section.exercise.id}`,
        section,
        entry: section.exercise,
      });
    }
  }
  return out;
}

function nextStepLink(
  courseId: string,
  lesson: LoadedLesson,
  steps: LessonStep[],
  index: number,
  nextLesson: LoadedLesson | null,
): StepLink | null {
  const current = steps[index];
  const next = steps[index + 1];
  if (next) {
    if (next.kind === "exercise") {
      return { kind: "exercise", href: next.href, label: "演習へ進む" };
    }
    const differentSection = current.section.ref.id !== next.section.ref.id;
    return { kind: "slide", href: next.href, label: differentSection ? "次のセクションへ" : "次のスライド" };
  }
  if (nextLesson) {
    return {
      kind: "lesson",
      href: lessonHref(courseId, nextLesson.ref.id),
      label: "次のレッスン: " + nextLesson.ref.title,
    };
  }
  return null;
}

function prevStepLink(current: LessonStep, prev: LessonStep): StepLink {
  if (prev.kind === "exercise") {
    return { kind: "exercise", href: prev.href, label: "前の演習へ" };
  }
  const differentSection = current.section.ref.id !== prev.section.ref.id;
  return { kind: "slide", href: prev.href, label: differentSection ? "前のセクション" : "前のスライド" };
}

function lessonStart(
  courseId: string,
  course: LoadedCourse,
  lesson: LoadedLesson,
  progress: CourseProgress,
): { href: string; label: string } {
  const firstOpen = lesson.exercises.find((entry) => !progress.exercises[entry.id]?.solved);
  const target = firstOpen ?? lesson.exercises[0];
  const section = course.sectionByExercise.get(target.id);
  if (!section) {
    return { href: lessonHref(courseId, lesson.ref.id), label: "レッスンをひらく" };
  }
  return {
    href: sectionHref(courseId, lesson.ref.id, target.chapterId, target.sectionId, 1),
    label: firstOpen ? "レッスンをはじめる" : "復習する",
  };
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

export interface ReferenceRun {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

/** 解答例を実行した結果。ページを開くたびに走らせないよう、成功したものだけ覚えておく。 */
const referenceCache = new Map<string, ReferenceRun>();

async function referenceRun(ctx: Ctx, course: LoadedCourse, entry: ExerciseEntry, force = false): Promise<ReferenceRun> {
  const key = `${course.id}/${entry.id}`;
  if (!force) {
    const cached = referenceCache.get(key);
    if (cached) return cached;
  }
  const result = await grade(ctx, course, entry, { solution: true, fresh: true });
  const reference: ReferenceRun = {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    stdout: result.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
  };
  referenceCache.set(key, reference);
  return reference;
}

/** お手本をもう一度実行する（Web の再実行アイコン用）。 */
export async function referenceRunFor(courseId: string, exerciseId: string, force = false): Promise<ReferenceRun> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  return await referenceRun(ctx, course, entry, force);
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
    lessons: course.lessons.map((lesson) => {
      const solved = lesson.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
      return {
        id: lesson.ref.id,
        title: lesson.ref.title,
        description: lesson.ref.description ?? "",
        estimateMin: lesson.ref.estimateMin ?? null,
        chapters: lesson.chapters.length,
        sections: lesson.exercises.length,
        solved,
        total: lesson.exercises.length,
        complete: lesson.exercises.length > 0 && solved === lesson.exercises.length,
        start: lessonStart(courseId, course, lesson, progress),
        isNext: nextEntry ? lesson.exercises.some((entry) => entry.id === nextEntry.id) : false,
      };
    }),
  };
}

export async function lessonPage(courseId: string, lessonId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const lesson = findLesson(course, lessonId);
  const { progress } = await readProgress(ctx, course);
  const index = course.lessons.findIndex((item) => item.ref.id === lessonId);
  const nextLesson = index >= 0 && index < course.lessons.length - 1 ? course.lessons[index + 1] : null;
  const nextEntry = progress.next ? course.byId.get(progress.next.exerciseId) ?? null : null;
  const solved = lesson.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
  return {
    courseId: course.id,
    courseLabel: course.spec.label,
    lessonId: lesson.ref.id,
    title: lesson.ref.title,
    description: lesson.ref.description ?? "",
    estimateMin: lesson.ref.estimateMin ?? null,
    progress: { solved, total: lesson.exercises.length },
    start: lessonStart(courseId, course, lesson, progress),
    chapters: lesson.chapters.map((chapter) => ({
      id: chapter.ref.id,
      title: chapter.ref.title,
      index: chapter.index,
      sections: chapter.sections.map((section) => ({
        id: section.ref.id,
        title: section.ref.title,
        index: section.index,
        slideCount: section.slides.length,
        href: sectionHref(courseId, lesson.ref.id, chapter.ref.id, section.ref.id, 1),
        solved: progress.exercises[section.exercise.id]?.solved ?? false,
        attempts: progress.exercises[section.exercise.id]?.attempts ?? 0,
        exercise: {
          id: section.exercise.id,
          title: section.exercise.spec.title,
          env: section.exercise.spec.env,
          xp: section.exercise.spec.xp,
        },
        isNext: nextEntry?.id === section.exercise.id,
      })),
    })),
    nextLesson: nextLesson
      ? { href: lessonHref(courseId, nextLesson.ref.id), title: nextLesson.ref.title }
      : null,
    prevLesson: index > 0 ? { href: lessonHref(courseId, course.lessons[index - 1].ref.id), title: course.lessons[index - 1].ref.title } : null,
  };
}

export async function sectionPage(
  courseId: string,
  lessonId: string,
  chapterId: string,
  sectionId: string,
  slideParam?: string,
) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const lesson = findLesson(course, lessonId);
  const chapter = findChapter(lesson, chapterId);
  const section = findSection(chapter, sectionId);
  const { progress } = await readProgress(ctx, course);
  const total = section.slides.length;
  let slideIndex = 0;
  if (slideParam !== undefined) {
    if (!/^\d+$/.test(slideParam)) throw error(404, "スライドが見つかりません");
    const number = Number(slideParam);
    if (number < 1 || number > total) throw error(404, "スライドが見つかりません");
    slideIndex = number - 1;
  }
  const current = section.slides[slideIndex];
  if (!current) throw error(404, "スライドが見つかりません");
  const index = course.lessons.findIndex((item) => item.ref.id === lessonId);
  const nextLesson = index >= 0 && index < course.lessons.length - 1 ? course.lessons[index + 1] : null;
  const steps = lessonSteps(courseId, lesson);
  const currentIndex = steps.findIndex(
    (step) => step.kind === "slide" && step.section.ref.id === section.ref.id && step.slide.id === current.id,
  );
  const currentStep = steps[currentIndex];
  const prev = currentIndex > 0 ? prevStepLink(currentStep, steps[currentIndex - 1]) : null;
  const next = nextStepLink(courseId, lesson, steps, currentIndex, nextLesson);
  const lessonSolved = lesson.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
  return {
    courseId: course.id,
    courseLabel: course.spec.label,
    lessonId: lesson.ref.id,
    lessonTitle: lesson.ref.title,
    lessonDescription: lesson.ref.description ?? "",
    chapterId: chapter.ref.id,
    chapterTitle: chapter.ref.title,
    chapterIndex: chapter.index,
    sectionId: section.ref.id,
    sectionTitle: section.ref.title,
    sectionIndex: section.index,
    slide: {
      index: current.index,
      total,
      id: current.id,
      title: current.title ?? section.ref.title,
    },
    slideHtml: renderMarkdown(current.body),
    sectionSolved: progress.exercises[section.exercise.id]?.solved ?? false,
    exerciseHref: `/c/${courseId}/e/${section.exercise.id}`,
    lessonHref: lessonHref(courseId, lesson.ref.id),
    prev,
    next,
    nextLesson: nextLesson
      ? { href: lessonHref(courseId, nextLesson.ref.id), title: nextLesson.ref.title }
      : null,
    prevLesson: index > 0 ? { href: lessonHref(courseId, course.lessons[index - 1].ref.id), title: course.lessons[index - 1].ref.title } : null,
    lessonProgress: { solved: lessonSolved, total: lesson.exercises.length },
  };
}

export async function exercisePage(courseId: string, exerciseId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const entry = findExercise(course, exerciseId);
  const { progress } = await readProgress(ctx, course);
  const workspace = await ensureWorkspace(ctx, entry);
  const files = await readEditable(workspace, entry);
  const reference = await referenceRun(ctx, course, entry).catch(() => null);
  const brief = (await Bun.file(join(entry.dir, "brief.md")).text().catch(() => "")) || "";
  const index = course.exercises.findIndex((item) => item.id === exerciseId);
  const previous = index > 0 ? course.exercises[index - 1] : null;
  const following = index >= 0 && index < course.exercises.length - 1 ? course.exercises[index + 1] : null;
  const current = progress.exercises[entry.id];
  const lesson = findLesson(course, entry.lessonId);
  const lessonIds = lesson.exercises.map((item) => item.id);
  const lessonIndex = course.lessons.findIndex((item) => item.ref.id === lesson.ref.id);
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < course.lessons.length - 1
      ? course.lessons[lessonIndex + 1]
      : null;
  const steps = lessonSteps(courseId, lesson);
  const stepIndex = steps.findIndex(
    (step) => step.kind === "exercise" && step.entry.id === entry.id,
  );
  const nextStep = stepIndex >= 0 ? nextStepLink(courseId, lesson, steps, stepIndex, nextLesson) : null;
  let previousSlide: Extract<LessonStep, { kind: "slide" }> | null = null;
  for (let i = stepIndex - 1; i >= 0; i -= 1) {
    const candidate = steps[i];
    if (candidate.kind === "slide") {
      previousSlide = candidate;
      break;
    }
  }
  const section = course.sectionByExercise.get(entry.id)!;
  return {
    course,
    entry,
    files,
    reference,
    briefHtml: renderMarkdown(brief),
    objective: entry.spec.objective ?? "",
    hints: entry.spec.hints,
    solved: current?.solved ?? false,
    attempts: current?.attempts ?? 0,
    lesson: entry.lessonTitle,
    lessonHref: lessonHref(courseId, lesson.ref.id),
    chapterTitle: entry.chapterTitle,
    sectionTitle: entry.sectionTitle,
    sectionHref: sectionHref(courseId, lesson.ref.id, entry.chapterId, entry.sectionId, 1),
    prev: previous ? link(previous) : null,
    next: following ? link(following) : null,
    nextStep,
    slideHref: previousSlide
      ? previousSlide.href
      : sectionHref(courseId, lesson.ref.id, entry.chapterId, entry.sectionId, 1),
    position: { index: index + 1, total: course.exercises.length },
    lessonProgress: {
      index: lessonIds.indexOf(entry.id) + 1,
      total: lessonIds.length,
      solved: lessonIds.filter((id) => progress.exercises[id]?.solved).length,
    },
    lessonExercises: lesson.exercises.map((item) => ({
      id: item.id,
      title: item.spec.title,
      solved: progress.exercises[item.id]?.solved ?? false,
      attempts: progress.exercises[item.id]?.attempts ?? 0,
    })),
    /** 見本。判定ルールをそのまま表示用にしたもの（本体は言語を知らない）。 */
    expected: entry.spec.judge.map(describeJudge),
  };
}

function collectFiles(form: FormData, entry: ExerciseEntry): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of editableFiles(entry.spec)) {
    const value = form.get("file:" + file.path);
    // HTML の textarea は送信時に改行を CRLF にする。シェルスクリプトが壊れるので LF に戻す。
    if (value !== null) files[file.path] = normalizeNewlines(String(value));
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

export { EnvError } from "../../../../src/core/errors.ts";

export type { LoadedCourse };
