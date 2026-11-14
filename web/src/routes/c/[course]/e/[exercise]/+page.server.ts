import { fail } from "@sveltejs/kit";
import { EnvError, exercisePage, reset, run, submit, type SubmitOutcome } from "$lib/server/prograde";

export async function load({ params }) {
  const page = await exercisePage(params.course, params.exercise);
  return {
    courseId: page.course.id,
    courseLabel: page.course.spec.label,
    exerciseId: page.entry.id,
    lessonId: page.entry.lessonId,
    lessonTitle: page.lesson,
    title: page.entry.spec.title,
    objective: page.objective,
    briefHtml: page.briefHtml,
    files: page.files,
    hints: page.hints,
    solved: page.solved,
    attempts: page.attempts,
    prev: page.prev,
    next: page.next,
    position: page.position,
    lessonProgress: page.lessonProgress,
    expected: page.expected,
    env: page.entry.spec.env,
    xp: page.entry.spec.xp,
  };
}

async function handle(work: () => Promise<SubmitOutcome>) {
  try {
    return { outcome: await work() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const remediation = error instanceof EnvError ? error.remediation ?? null : null;
    return fail(400, { outcome: null, error: message, remediation });
  }
}

export const actions = {
  grade: async ({ request, params }) =>
    handle(async () => submit(params.course, params.exercise, await request.formData())),
  run: async ({ request, params }) =>
    handle(async () => run(params.course, params.exercise, await request.formData())),
  reset: async ({ params }) => handle(async () => reset(params.course, params.exercise)),
};
