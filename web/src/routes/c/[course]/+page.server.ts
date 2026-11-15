import { coursePage } from "$lib/server/prograde";

export async function load({ params }) {
  const { course, progress, stats, next, lessons } = await coursePage(params.course);
  return {
    id: course.id,
    label: course.spec.label,
    description: course.spec.description ?? "",
    stats,
    next,
    nextLesson: progress.next?.lessonId ?? lessons[0]?.id ?? null,
    lessons,
  };
}
