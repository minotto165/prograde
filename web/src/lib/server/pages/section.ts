import { error } from "@sveltejs/kit";
import { loadCourse, findLesson, findChapter, findSection } from "../../../../../src/core/course.ts";
import { readProgress } from "../../../../../src/core/progress.ts";
import { renderMarkdown } from "../../markdown.ts";
import { webCtx } from "../ctx.ts";
import { lessonHref, lessonSteps, nextStepLink, prevStepLink, sectionHref } from "../view.ts";

export async function sectionPage(
  courseId: string,
  lessonId: string,
  chapterId: string,
  sectionId: string,
  slideParam?: string,
) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const lesson = findLesson(course, lessonId);
  const chapter = findChapter(lesson, chapterId);
  const section = findSection(chapter, sectionId);
  const { progress } = await readProgress(ctx, course);
  const total = section.slides.length;
  let slideIndex = 0;
  if (slideParam !== undefined) {
    if (!/^\d+$/.test(slideParam)) throw error(404, "スライドが見つかりません");
    const number = Number(slideParam);
    if (number < 1 || number > total) throw error(404, "スライドが見つかりません");
    slideIndex = number - 1;
  }
  const current = section.slides[slideIndex];
  if (!current) throw error(404, "スライドが見つかりません");
  const index = course.lessons.findIndex((item) => item.ref.id === lessonId);
  const nextLesson = index >= 0 && index < course.lessons.length - 1 ? course.lessons[index + 1] : null;
  const steps = lessonSteps(courseId, lesson);
  const currentIndex = steps.findIndex(
    (step) => step.kind === "slide" && step.section.ref.id === section.ref.id && step.slide.id === current.id,
  );
  const currentStep = steps[currentIndex];
  const prev = currentIndex > 0 ? prevStepLink(currentStep, steps[currentIndex - 1]) : null;
  const next = nextStepLink(courseId, lesson, steps, currentIndex, nextLesson);
  const lessonSolved = lesson.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
  return {
    courseId: course.id,
    courseLabel: course.spec.label,
    lessonId: lesson.ref.id,
    lessonTitle: lesson.ref.title,
    lessonDescription: lesson.ref.description ?? "",
    chapterId: chapter.ref.id,
    chapterTitle: chapter.ref.title,
    chapterIndex: chapter.index,
    sectionId: section.ref.id,
    sectionTitle: section.ref.title,
    sectionIndex: section.index,
    slide: {
      index: current.index,
      total,
      id: current.id,
      title: current.title ?? section.ref.title,
    },
    slideHtml: renderMarkdown(current.body),
    sectionSolved: progress.exercises[section.exercise.id]?.solved ?? false,
    exerciseHref: "/c/" + courseId + "/e/" + section.exercise.id,
    lessonHref: lessonHref(courseId, lesson.ref.id),
    prev,
    next,
    nextLesson: nextLesson
      ? { href: lessonHref(courseId, nextLesson.ref.id), title: nextLesson.ref.title }
      : null,
    prevLesson: index > 0 ? { href: lessonHref(courseId, course.lessons[index - 1].ref.id), title: course.lessons[index - 1].ref.title } : null,
    lessonProgress: { solved: lessonSolved, total: lesson.exercises.length },
  };
}
