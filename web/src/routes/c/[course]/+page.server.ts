import { coursePage } from "$lib/server/prograde";
import { httpError } from "$lib/server/errors";

export async function load({ params }: { params: { course: string } }) {
  try {
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
  } catch (cause) {
    httpError(cause, "コースを読み込めませんでした");
  }
}
