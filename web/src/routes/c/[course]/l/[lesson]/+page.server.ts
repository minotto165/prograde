import { lessonPage } from "$lib/server/prograde";

export async function load({ params }) {
  return await lessonPage(params.course, params.lesson);
}
