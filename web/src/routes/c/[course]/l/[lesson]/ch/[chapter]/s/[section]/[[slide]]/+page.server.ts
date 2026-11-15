import { sectionPage } from "$lib/server/prograde";

export async function load({ params }) {
  return await sectionPage(params.course, params.lesson, params.chapter, params.section, params.slide);
}
