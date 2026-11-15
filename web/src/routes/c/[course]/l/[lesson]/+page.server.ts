import { lessonPage } from "$lib/server/prograde";
import { httpError } from "$lib/server/errors";

export async function load({ params }: { params: { course: string; lesson: string } }) {
  try {
    return await lessonPage(params.course, params.lesson);
  } catch (cause) {
    httpError(cause, "レッスンを読み込めませんでした");
  }
}
