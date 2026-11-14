import { join } from "node:path";
import { readdir } from "node:fs/promises";
import {
  CourseSchema,
  ExerciseSchema,
  QuizSchema,
  type Course,
  type Exercise,
  type Observe,
  type Quiz,
  type LessonRef,
} from "../schema/index.ts";
import { pathExists, readJson, readJsonIfExists, readTextIfExists } from "./fsx.ts";
import { UserError } from "./errors.ts";
import type { Ctx } from "./context.ts";

export interface ExerciseEntry {
  id: string;
  courseId: string;
  dir: string;
  spec: Exercise;
  lessonId: string;
  lessonTitle: string;
  /** 1 始まり。 */
  lessonIndex: number;
  /** レッスン内の 1 始まり。 */
  index: number;
}

export interface LoadedSlide {
  /** 1 始まり。 */
  index: number;
  /** ファイル名の番号（lesson.md は "lesson"）。 */
  id: string;
  file: string;
  /** レッスンディレクトリからの相対パス。 */
  relPath: string;
  /** 最初の # 見出し。無ければ null。 */
  title: string | null;
  body: string;
}

export interface LoadedLesson {
  ref: LessonRef;
  index: number;
  dir: string;
  slides: LoadedSlide[];
  quiz: Quiz | null;
  exercises: ExerciseEntry[];
}

export interface LoadedCourse {
  id: string;
  dir: string;
  spec: Course;
  lessons: LoadedLesson[];
  exercises: ExerciseEntry[];
  byId: Map<string, ExerciseEntry>;
}

function fail(courseId: string, message: string): never {
  throw new UserError("course " + courseId + ": " + message);
}

/** 観測点の別名。judge.on はこの名前を指す。 */
export function observeAliases(spec: Exercise): Map<string, Observe> {
  const aliases = new Map<string, Observe>();
  for (const observe of spec.observe) {
    const name = observe.as ?? defaultAlias(observe);
    if (aliases.has(name)) {
      throw new UserError(spec.id + ": observe の名前が重複しています: " + name);
    }
    aliases.set(name, observe);
  }
  return aliases;
}

export function defaultAlias(observe: Observe): string {
  switch (observe.kind) {
    case "exit":
      return "exit";
    case "stdout":
      return "stdout";
    case "stderr":
      return "stderr";
    case "file":
      return "file:" + observe.path;
    case "exists":
      return "exists:" + observe.path;
  }
}

export interface CourseSummary {
  id: string;
  label: string;
  description?: string;
  lessons: number;
  exercises: number;
}

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
    out.push({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      lessons: spec.lessons.length,
      exercises: spec.lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0),
    });
  }
  return out;
}

/** --course / PROGRADE_COURSE / 唯一のコース、の順に決める。 */
export async function resolveCourseId(ctx: Ctx, requested?: string): Promise<string> {
  const explicit = requested ?? process.env.PROGRADE_COURSE;
  if (explicit) {
    if (!(await pathExists(join(ctx.coursesDir, explicit, "course.json")))) {
      throw new UserError("コースが見つかりません: " + explicit + " (" + ctx.coursesDir + ")");
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

const SLIDE_FILE = /^(\d{2})(?:[-_].+)?\.md$/;

function slideTitle(body: string): string | null {
  const match = /^#\s+(.+?)\s*$/m.exec(body);
  return match ? match[1].trim() : null;
}

/**
 * レッスン本文を読む。
 * - content/<lessonId>/slides/NN.md（NN は 2 桁。NN-名前.md も可）を番号順に並べる。
 * - 旧形式の lesson.md は 1 枚のスライドとして読む。slides/ との併用はエラー。
 */
async function readSlides(courseId: string, lessonId: string, lessonDir: string): Promise<LoadedSlide[]> {
  const slidesDir = join(lessonDir, "slides");
  const relDir = "content/" + lessonId + "/slides";
  let names: string[] = [];
  if (await pathExists(slidesDir)) {
    names = (await readdir(slidesDir)).filter((name) => name.endsWith(".md")).sort();
    if (names.length === 0) {
      fail(courseId, "スライドがありません: " + relDir + "（NN.md を置くか、slides/ を削除してください）");
    }
  }

  const legacy = await readTextIfExists(join(lessonDir, "lesson.md"));
  if (names.length > 0 && legacy !== null) {
    fail(courseId, "lesson.md と slides/ は同時に使えません: content/" + lessonId);
  }
  if (names.length === 0) {
    if (legacy === null) return [];
    return [
      {
        index: 1,
        id: "lesson",
        file: "lesson.md",
        relPath: "lesson.md",
        title: slideTitle(legacy),
        body: legacy,
      },
    ];
  }

  const seen = new Map<string, string>();
  const slides: LoadedSlide[] = [];
  for (const name of names) {
    const match = SLIDE_FILE.exec(name);
    if (!match) {
      fail(courseId, "スライドのファイル名が不正です: " + relDir + "/" + name + "（NN.md か NN-名前.md）");
    }
    const number = match[1];
    const previous = seen.get(number);
    if (previous !== undefined) {
      fail(courseId, "スライド番号が重複しています: " + relDir + "/" + previous + " と " + name);
    }
    seen.set(number, name);
    const body = await readTextIfExists(join(slidesDir, name));
    if (body === null) fail(courseId, "スライドが読めません: " + relDir + "/" + name);
    slides.push({
      index: 0,
      id: number,
      file: name,
      relPath: "slides/" + name,
      title: slideTitle(body),
      body,
    });
  }

  slides.sort((a, b) => Number(a.id) - Number(b.id));
  for (const [offset, slide] of slides.entries()) slide.index = offset + 1;
  return slides;
}

export async function loadCourse(ctx: Ctx, id: string): Promise<LoadedCourse> {
  const dir = join(ctx.coursesDir, id);
  const spec = await readJson(join(dir, "course.json"), CourseSchema);
  if (spec.id !== id) fail(id, "course.json の id (" + spec.id + ") がディレクトリ名と違います");

  const lessons: LoadedLesson[] = [];
  const exercises: ExerciseEntry[] = [];
  const byId = new Map<string, ExerciseEntry>();

  for (const [lessonOffset, ref] of spec.lessons.entries()) {
    const lessonIndex = lessonOffset + 1;
    const lessonDir = join(dir, "content", ref.id);
    if (!(await pathExists(lessonDir))) fail(id, "レッスンのディレクトリがありません: content/" + ref.id);
    const slides = await readSlides(id, ref.id, lessonDir);
    const quiz = await readJsonIfExists(join(lessonDir, "quiz.json"), QuizSchema);
    const lessonExercises: ExerciseEntry[] = [];

    for (const [offset, exerciseId] of ref.exercises.entries()) {
      const exerciseDir = join(lessonDir, "ex", exerciseId);
      const exercisePath = join(exerciseDir, "exercise.json");
      if (!(await pathExists(exercisePath))) fail(id, "演習がありません: content/" + ref.id + "/ex/" + exerciseId);
      const exercise = await readJson(exercisePath, ExerciseSchema);
      if (exercise.id !== exerciseId) {
        fail(id, "exercise.json の id (" + exercise.id + ") がディレクトリ名と違います: " + exerciseId);
      }
      const entry: ExerciseEntry = {
        id: exerciseId,
        courseId: id,
        dir: exerciseDir,
        spec: exercise,
        lessonId: ref.id,
        lessonTitle: ref.title,
        lessonIndex,
        index: offset + 1,
      };
      await validateExercise(spec, entry);
      lessonExercises.push(entry);
      exercises.push(entry);
      if (byId.has(exerciseId)) fail(id, "演習 ID が重複しています: " + exerciseId);
      byId.set(exerciseId, entry);
    }

    lessons.push({ ref, index: lessonIndex, dir: lessonDir, slides, quiz, exercises: lessonExercises });
  }

  return { id, dir, spec, lessons, exercises, byId };
}

async function validateExercise(course: Course, entry: ExerciseEntry): Promise<void> {
  const spec = entry.spec;
  const prefix = entry.id + ": ";

  if (!course.envs[spec.env]) {
    fail(course.id, prefix + "未定義の環境です: " + spec.env + "（envs: " + Object.keys(course.envs).join(", ") + "）");
  }
  if (!spec.recipe.build && !spec.recipe.run) {
    fail(course.id, prefix + "recipe に build か run が必要です");
  }
  if (spec.stdin !== undefined && spec.stdinFile !== undefined) {
    fail(course.id, prefix + "stdin と stdinFile は同時に指定できません");
  }
  if (spec.stdinFile && !(await pathExists(join(entry.dir, spec.stdinFile)))) {
    fail(course.id, prefix + "stdinFile がありません: " + spec.stdinFile);
  }

  const editable = spec.files.filter((file) => file.editable);
  if (editable.length === 0) fail(course.id, prefix + "editable なファイルがありません");
  const paths = new Set<string>();
  for (const file of spec.files) {
    if (paths.has(file.path)) fail(course.id, prefix + "files の path が重複しています: " + file.path);
    paths.add(file.path);
    if (file.from) {
      if (!(await pathExists(join(entry.dir, file.from)))) {
        fail(course.id, prefix + "雛形がありません: " + file.from);
      }
    } else if (file.text === undefined) {
      fail(course.id, prefix + "files[] には from か text が必要です: " + file.path);
    }
    if (file.editable && !(await pathExists(join(entry.dir, "solution", file.path)))) {
      fail(course.id, prefix + "解答がありません: solution/" + file.path);
    }
  }

  const aliases = observeAliases(spec);
  for (const rule of spec.judge) {
    if (!aliases.has(rule.on)) {
      fail(course.id, prefix + "judge.on が observe にありません: " + rule.on);
    }
    if (rule.match === "regex") {
      try {
        new RegExp(rule.value, rule.flags ?? "");
      } catch (err) {
        fail(course.id, prefix + "judge の正規表現が不正です: " + (err as Error).message);
      }
    }
  }

  for (const diagnostic of spec.diagnostics) {
    if (diagnostic.parse === "regex") {
      try {
        new RegExp(diagnostic.pattern, diagnostic.flags ?? "gm");
      } catch (err) {
        fail(course.id, prefix + "diagnostics の正規表現が不正です: " + (err as Error).message);
      }
    }
  }

  const limits = course.envs[spec.env].limits;
  if (limits.timeoutMs !== undefined && limits.timeoutMs < 100) {
    fail(course.id, prefix + "limits.timeoutMs が小さすぎます");
  }
}

export function findExercise(course: LoadedCourse, id: string): ExerciseEntry {
  const entry = course.byId.get(id);
  if (!entry) {
    throw new UserError(
      "演習が見つかりません: " + id + "（" + course.id + " の演習数: " + course.exercises.length + "）",
    );
  }
  return entry;
}

export function findLesson(course: LoadedCourse, id: string): LoadedLesson {
  const lesson = course.lessons.find((candidate) => candidate.ref.id === id);
  if (!lesson) throw new UserError("レッスンが見つかりません: " + id);
  return lesson;
}
