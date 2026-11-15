import { sectionPage } from "$lib/server/prograde";
import { httpError } from "$lib/server/errors";

export async function load({
  params,
}: {
  params: { course: string; lesson: string; chapter: string; section: string; slide?: string };
}) {
  try {
    return await sectionPage(params.course, params.lesson, params.chapter, params.section, params.slide);
  } catch (cause) {
    httpError(cause, "セクションを読み込めませんでした");
  }
}
