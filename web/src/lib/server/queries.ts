import { loadCourse, findExercise } from "../../../../src/core/course.ts";
import { webCtx } from "./ctx.ts";

export async function loadEntry(courseId: string, exerciseId: string) {
  const ctx = webCtx();
  const course = await loadCourse(ctx, courseId);
  const entry = findExercise(course, exerciseId);
  return { ctx, course, entry };
}
