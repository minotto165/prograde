import { loadCourse, findLesson } from "../../../../../src/core/course.ts";
import { readProgress } from "../../../../../src/core/progress.ts";
import { webCtx } from "../ctx.ts";
import { lessonHref, lessonStart, sectionHref } from "../view.ts";

export async function lessonPage(courseId: string, lessonId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const lesson = findLesson(course, lessonId);
  const { progress } = await readProgress(ctx, course);
  const index = course.lessons.findIndex((item) => item.ref.id === lessonId);
  const nextLesson = index >= 0 && index < course.lessons.length - 1 ? course.lessons[index + 1] : null;
  const nextEntry = progress.next ? course.byId.get(progress.next.exerciseId) ?? null : null;
  const solved = lesson.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
  return {
    courseId: course.id,
    courseLabel: course.spec.label,
    lessonId: lesson.ref.id,
    title: lesson.ref.title,
    description: lesson.ref.description ?? "",
    estimateMin: lesson.ref.estimateMin ?? null,
    progress: { solved, total: lesson.exercises.length },
    start: lessonStart(courseId, course, lesson, progress),
    chapters: lesson.chapters.map((chapter) => ({
      id: chapter.ref.id,
      title: chapter.ref.title,
      index: chapter.index,
      sections: chapter.sections.map((section) => ({
        id: section.ref.id,
        title: section.ref.title,
        index: section.index,
        slideCount: section.slides.length,
        href: sectionHref(courseId, lesson.ref.id, chapter.ref.id, section.ref.id, 1),
        solved: progress.exercises[section.exercise.id]?.solved ?? false,
        attempts: progress.exercises[section.exercise.id]?.attempts ?? 0,
        exercise: {
          id: section.exercise.id,
          title: section.exercise.spec.title,
          env: section.exercise.spec.env,
          xp: section.exercise.spec.xp,
        },
        isNext: nextEntry?.id === section.exercise.id,
      })),
    })),
    nextLesson: nextLesson
      ? { href: lessonHref(courseId, nextLesson.ref.id), title: nextLesson.ref.title }
      : null,
    prevLesson: index > 0 ? { href: lessonHref(courseId, course.lessons[index - 1].ref.id), title: course.lessons[index - 1].ref.title } : null,
  };
}
