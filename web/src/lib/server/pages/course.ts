import { loadCourse } from "../../../../../src/core/course.ts";
import { readProgress } from "../../../../../src/core/progress.ts";
import { webCtx } from "../ctx.ts";
import { lessonHref, lessonStart, link, stats } from "../view.ts";

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
        href: lessonHref(courseId, lesson.ref.id),
        start: lessonStart(courseId, course, lesson, progress),
        isNext: nextEntry ? lesson.exercises.some((entry) => entry.id === nextEntry.id) : false,
      };
    }),
  };
}
