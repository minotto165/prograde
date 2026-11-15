import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { CourseSchema } from "../../schema/index.ts";
import { pathExists, readJson } from "../fsx.ts";
import { DataError, NotFoundError, UserError } from "../errors.ts";
import type { Ctx } from "../context.ts";

export const COURSE_ID = /^[a-z0-9][a-z0-9_-]*$/;

export interface CourseSummary {
  id: string;
  label: string;
  description?: string;
  lessons: number;
  exercises: number;
}

/** 教材ディレクトリを読まず、course.json だけで一覧を作る。 */
export async function listCourses(ctx: Ctx): Promise<CourseSummary[]> {
  let names: string[];
  try {
    names = await readdir(ctx.coursesDir);
  } catch {
    return [];
  }
  const out: CourseSummary[] = [];
  for (const name of names.sort()) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const dir = join(ctx.coursesDir, name);
    if (!(await pathExists(join(dir, "course.json")))) continue;
    const spec = await readJson(join(dir, "course.json"), CourseSchema);
    if (spec.id !== name) {
      throw new DataError("course " + name + ": course.json の id (" + spec.id + ") がディレクトリ名と違います");
    }
    out.push({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      lessons: spec.lessons.length,
      exercises: spec.lessons.reduce(
        (sum, lesson) =>
          sum + lesson.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.sections.length, 0),
        0,
      ),
    });
  }
  return out;
}

/** --course / PROGRADE_COURSE / 唯一のコース、の順に決める。 */
export async function resolveCourseId(ctx: Ctx, requested?: string): Promise<string> {
  const explicit = requested ?? process.env.PROGRADE_COURSE;
  if (explicit) {
    if (!COURSE_ID.test(explicit) || !(await pathExists(join(ctx.coursesDir, explicit, "course.json")))) {
      throw new NotFoundError("コースが見つかりません: " + explicit + " (" + ctx.coursesDir + ")");
    }
    return explicit;
  }
  const courses = await listCourses(ctx);
  if (courses.length === 1) return courses[0].id;
  if (courses.length === 0) throw new UserError("コースがありません: " + ctx.coursesDir);
  throw new UserError(
    "コースを --course で指定してください（候補: " + courses.map((course) => course.id).join(", ") + "）",
  );
}
