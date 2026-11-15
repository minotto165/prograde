import type {
  ExerciseEntry,
  LoadedCourse,
  LoadedLesson,
  LoadedSection,
  LoadedSlide,
} from "../../../../src/core/course.ts";
import type { CourseProgress } from "../../../../src/core/progress.ts";

export interface FileView {
  path: string;
  code: string;
  language: string;
}

export interface ExerciseLink {
  id: string;
  title: string;
  lessonId: string;
  lessonTitle: string;
}

export interface CourseStats {
  solved: number;
  total: number;
  xp: number;
  level: number;
  streak: number;
}

export function stats(course: LoadedCourse, progress: CourseProgress): CourseStats {
  const total = course.exercises.length;
  const solved = course.exercises.filter((entry) => progress.exercises[entry.id]?.solved).length;
  return { solved, total, xp: progress.xp, level: progress.level, streak: progress.streak.days };
}

export function link(entry: ExerciseEntry): ExerciseLink {
  return { id: entry.id, title: entry.spec.title, lessonId: entry.lessonId, lessonTitle: entry.lessonTitle };
}

export interface StepLink {
  kind: "slide" | "exercise" | "lesson";
  href: string;
  label: string;
}

export function sectionHref(
  courseId: string,
  lessonId: string,
  chapterId: string,
  sectionId: string,
  slideIndex = 1,
): string {
  const base = "/c/" + courseId + "/l/" + lessonId + "/ch/" + chapterId + "/s/" + sectionId;
  return slideIndex <= 1 ? base : base + "/" + slideIndex;
}

export function lessonHref(courseId: string, lessonId: string): string {
  return "/c/" + courseId + "/l/" + lessonId;
}

export type LessonStep =
  | { kind: "slide"; href: string; section: LoadedSection; slide: LoadedSlide }
  | { kind: "exercise"; href: string; section: LoadedSection; entry: ExerciseEntry };

/** セクションのスライドを順に並べ、最後にその演習を置いたレッスン全体の並び。 */
export function lessonSteps(courseId: string, lesson: LoadedLesson): LessonStep[] {
  const out: LessonStep[] = [];
  for (const chapter of lesson.chapters) {
    for (const section of chapter.sections) {
      for (const slide of section.slides) {
        out.push({
          kind: "slide",
          href: sectionHref(courseId, lesson.ref.id, chapter.ref.id, section.ref.id, slide.index),
          section,
          slide,
        });
      }
      out.push({
        kind: "exercise",
        href: "/c/" + courseId + "/e/" + section.exercise.id,
        section,
        entry: section.exercise,
      });
    }
  }
  return out;
}

export function nextStepLink(
  courseId: string,
  lesson: LoadedLesson,
  steps: LessonStep[],
  index: number,
  nextLesson: LoadedLesson | null,
): StepLink | null {
  const current = steps[index];
  const next = steps[index + 1];
  if (next) {
    if (next.kind === "exercise") {
      return { kind: "exercise", href: next.href, label: "演習へ進む" };
    }
    const differentSection = current.section.ref.id !== next.section.ref.id;
    return { kind: "slide", href: next.href, label: differentSection ? "次のセクションへ" : "次のスライド" };
  }
  if (nextLesson) {
    return {
      kind: "lesson",
      href: lessonHref(courseId, nextLesson.ref.id),
      label: "次のレッスン: " + nextLesson.ref.title,
    };
  }
  return null;
}

export function prevStepLink(current: LessonStep, prev: LessonStep): StepLink {
  if (prev.kind === "exercise") {
    return { kind: "exercise", href: prev.href, label: "前の演習へ" };
  }
  const differentSection = current.section.ref.id !== prev.section.ref.id;
  return { kind: "slide", href: prev.href, label: differentSection ? "前のセクション" : "前のスライド" };
}

export function lessonStart(
  courseId: string,
  course: LoadedCourse,
  lesson: LoadedLesson,
  progress: CourseProgress,
): { href: string; label: string } {
  const firstOpen = lesson.exercises.find((entry) => !progress.exercises[entry.id]?.solved);
  const target = firstOpen ?? lesson.exercises[0];
  const section = course.sectionByExercise.get(target.id);
  if (!section) {
    return { href: lessonHref(courseId, lesson.ref.id), label: "レッスンをひらく" };
  }
  return {
    href: sectionHref(courseId, lesson.ref.id, target.chapterId, target.sectionId, 1),
    label: firstOpen ? "レッスンをはじめる" : "復習する",
  };
}
