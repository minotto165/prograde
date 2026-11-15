import { lessonPage } from "$lib/server/prograde";

export async function load({ params }) {
  const { course, lesson, progress, slide, slideHtml, prevStep, nextStep, nextLesson, prevLesson } =
    await lessonPage(params.course, params.lesson, params.slide);
  return {
    courseId: course.id,
    courseLabel: course.spec.label,
    id: lesson.ref.id,
    title: lesson.ref.title,
    goal: lesson.ref.goal ?? "",
    slide,
    slideHtml,
    prevStep,
    nextStep,
    nextLesson,
    prevLesson,
    solved: progress.lessons[lesson.ref.id]?.solved ?? 0,
    totalExercises: lesson.exercises.length,
  };
}
