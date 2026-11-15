import { NotFoundError } from "../errors.ts";
import type { ExerciseEntry, LoadedChapter, LoadedCourse, LoadedLesson, LoadedSection } from "./types.ts";

export function findExercise(course: LoadedCourse, id: string): ExerciseEntry {
  const entry = course.byId.get(id);
  if (!entry) {
    throw new NotFoundError(
      "演習が見つかりません: " + id + "（" + course.id + " の演習数: " + course.exercises.length + "）",
    );
  }
  return entry;
}

export function findLesson(course: LoadedCourse, id: string): LoadedLesson {
  const lesson = course.lessons.find((candidate) => candidate.ref.id === id);
  if (!lesson) throw new NotFoundError("レッスンが見つかりません: " + id);
  return lesson;
}

export function findChapter(lesson: LoadedLesson, id: string): LoadedChapter {
  const chapter = lesson.chapters.find((candidate) => candidate.ref.id === id);
  if (!chapter) throw new NotFoundError("章が見つかりません: " + id + "（レッスン " + lesson.ref.id + "）");
  return chapter;
}

export function findSection(chapter: LoadedChapter, id: string): LoadedSection {
  const section = chapter.sections.find((candidate) => candidate.ref.id === id);
  if (!section) throw new NotFoundError("セクションが見つかりません: " + id + "（章 " + chapter.ref.id + "）");
  return section;
}
