import { fail } from "@sveltejs/kit";
import { EnvError, exercisePage, reset, run, submit, type SubmitOutcome } from "$lib/server/prograde";
import { httpError } from "$lib/server/errors";
import { DataError, NotFoundError } from "../../../../../../../src/core/errors.ts";

export async function load({ params }: { params: { course: string; exercise: string } }) {
  let page: Awaited<ReturnType<typeof exercisePage>>;
  try {
    page = await exercisePage(params.course, params.exercise);
  } catch (cause) {
    httpError(cause, "演習を読み込めませんでした");
  }
  return {
    courseId: page.course.id,
    courseLabel: page.course.spec.label,
    exerciseId: page.entry.id,
    lessonId: page.entry.lessonId,
    lessonTitle: page.lesson,
    lessonHref: page.lessonHref,
    chapterTitle: page.chapterTitle,
    sectionTitle: page.sectionTitle,
    sectionHref: page.sectionHref,
    title: page.entry.spec.title,
    objective: page.objective,
    briefHtml: page.briefHtml,
    files: page.files,
    reference: page.reference,
    hints: page.hints,
    solved: page.solved,
    attempts: page.attempts,
    prev: page.prev,
    next: page.next,
    nextStep: page.nextStep,
    slideHref: page.slideHref,
    position: page.position,
    lessonProgress: page.lessonProgress,
    lessonExercises: page.lessonExercises,
    expected: page.expected,
    env: page.entry.spec.env,
    xp: page.entry.spec.xp,
  };
}

async function handle(work: () => Promise<SubmitOutcome>) {
  try {
    return { outcome: await work() };
  } catch (cause) {
    if (cause instanceof NotFoundError) {
      return fail(404, { outcome: null, error: "見つかりません", remediation: null });
    }
    if (cause instanceof DataError) {
      console.error(cause);
      return fail(500, { outcome: null, error: "教材データを読み込めませんでした", remediation: null });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    const remediation = cause instanceof EnvError ? cause.remediation ?? null : null;
    return fail(400, { outcome: null, error: message, remediation });
  }
}

type ActionEvent = { request: Request; params: { course: string; exercise: string } };

export const actions = {
  grade: async ({ request, params }: ActionEvent) =>
    handle(async () => submit(params.course, params.exercise, await request.formData())),
  run: async ({ request, params }: ActionEvent) =>
    handle(async () => run(params.course, params.exercise, await request.formData())),
  reset: async ({ params }: ActionEvent) => handle(async () => reset(params.course, params.exercise)),
};
