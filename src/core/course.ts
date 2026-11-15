/**
 * コース教材の読み込みと参照。
 * 実装は ./course/ 配下に分かれている。ここは公開 API の再エクスポートだけ。
 */
export type {
  ExerciseEntry,
  LoadedSlide,
  LoadedSection,
  LoadedChapter,
  LoadedLesson,
  LoadedCourse,
} from "./course/types.ts";
export { observeAliases, defaultAlias } from "./course/observe.ts";
export { COURSE_ID, type CourseSummary, listCourses, resolveCourseId } from "./course/catalog.ts";
export { loadCourse } from "./course/loader.ts";
export { findExercise, findLesson, findChapter, findSection } from "./course/nav.ts";
