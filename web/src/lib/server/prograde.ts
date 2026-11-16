/**
 * Web の画面組み立て。
 * 実装は ctx / view / files / queries / reference / pages / actions に分かれている。
 * ここは公開 API の再エクスポートだけ。
 */
export { webCtx } from "./ctx.ts";
export type { FileView, ExerciseLink, CourseStats, StepLink } from "./view.ts";
export { dashboard } from "./pages/dashboard.ts";
export { coursePage } from "./pages/course.ts";
export { lessonPage } from "./pages/lesson.ts";
export { sectionPage } from "./pages/section.ts";
export { exercisePage } from "./pages/exercise.ts";
export { referenceRunFor, type ReferenceRun } from "./reference.ts";
export { submit, run, save, reset, type SaveOutcome, type SubmitOutcome } from "./actions.ts";
export { EnvError } from "../../../../src/core/errors.ts";
export type { LoadedCourse } from "../../../../src/core/course.ts";
