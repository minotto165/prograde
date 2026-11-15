import { join } from "node:path";
import { loadCourse, findExercise, findLesson } from "../../../../../src/core/course.ts";
import { readProgress } from "../../../../../src/core/progress.ts";
import { describeJudge } from "../../../../../src/core/judge.ts";
import { renderMarkdown } from "../../markdown.ts";
import { webCtx } from "../ctx.ts";
import { readEditable } from "../files.ts";
import { lessonHref, lessonSteps, nextStepLink, sectionHref, link } from "../view.ts";

export async function exercisePage(courseId: string, exerciseId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const entry = findExercise(course, exerciseId);
  const { progress } = await readProgress(ctx, course);
  // GET では作業ディレクトリを作らず、お手本も実行しない。表示だけなら雛形を読めば足りる。
  const workspace = join(ctx.workDir, entry.courseId, entry.id);
  const files = await readEditable(workspace, entry);
  const reference = null;
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
  let previousSlide: Extract<ReturnType<typeof lessonSteps>[number], { kind: "slide" }> | null = null;
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
