import { join } from "node:path";
import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import {
  CourseSchema,
  ExerciseSchema,
  QuizSchema,
  type Course,
  type Exercise,
  type Observe,
  type Quiz,
  type LessonRef,
  type ChapterRef,
  type SectionRef,
} from "../schema/index.ts";
import { pathExists, readJson, readJsonIfExists, readTextIfExists } from "./fsx.ts";
import { DataError, NotFoundError, UserError } from "./errors.ts";
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
  chapterId: string;
  chapterTitle: string;
  /** レッスン内の 1 始まり。 */
  chapterIndex: number;
  sectionId: string;
  sectionTitle: string;
  /** 章内の 1 始まり。 */
  sectionIndex: number;
  /** レッスン内の 1 始まり。 */
  index: number;
}

export interface LoadedSlide {
  /** 1 始まり。 */
  index: number;
  /** ファイル名の番号。 */
  id: string;
  file: string;
  /** セクションディレクトリからの相対パス。 */
  relPath: string;
  /** 最初の # 見出し。無ければ null。 */
  title: string | null;
  body: string;
}

export interface LoadedSection {
  ref: SectionRef;
  /** 章内の 1 始まり。 */
  index: number;
  dir: string;
  slides: LoadedSlide[];
  exercise: ExerciseEntry;
}

export interface LoadedChapter {
  ref: ChapterRef;
  /** レッスン内の 1 始まり。 */
  index: number;
  dir: string;
  sections: LoadedSection[];
  exercises: ExerciseEntry[];
}

export interface LoadedLesson {
  ref: LessonRef;
  index: number;
  dir: string;
  chapters: LoadedChapter[];
  exercises: ExerciseEntry[];
  quiz: Quiz | null;
}

export interface LoadedCourse {
  id: string;
  dir: string;
  spec: Course;
  lessons: LoadedLesson[];
  exercises: ExerciseEntry[];
  byId: Map<string, ExerciseEntry>;
  sectionByExercise: Map<string, LoadedSection>;
}

const COURSE_ID = /^[a-z0-9][a-z0-9_-]*$/;
const ENV_NAME = /^[a-z0-9][a-z0-9_-]*$/;

function fail(courseId: string, message: string): never {
  throw new DataError("course " + courseId + ": " + message);
}

/** macOS の .DS_Store など、教材の一部ではないファイルは無視する。 */
function ignoredEntry(name: string): boolean {
  return name === ".DS_Store" || name === "Thumbs.db" || name.startsWith("._");
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

const SLIDE_FILE = /^(\d{2})(?:[-_].+)?\.md$/;

function slideTitle(body: string): string | null {
  const match = /^#\s+(.+?)\s*$/m.exec(body);
  return match ? match[1].trim() : null;
}

async function entriesOf(courseId: string, dir: string, rel: string) {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((entry) => !ignoredEntry(entry.name));
  } catch {
    fail(courseId, "ディレクトリがありません: " + rel);
  }
}

async function expectOnly(
  courseId: string,
  dir: string,
  rel: string,
  allowed: { dirs?: string[]; files?: string[] },
): Promise<void> {
  const dirs = new Set(allowed.dirs ?? []);
  const files = new Set(allowed.files ?? []);
  for (const entry of await entriesOf(courseId, dir, rel)) {
    if (entry.isDirectory()) {
      if (!dirs.has(entry.name)) fail(courseId, "余分なディレクトリがあります: " + rel + "/" + entry.name);
    } else if (entry.isFile()) {
      if (!files.has(entry.name)) fail(courseId, "余分なファイルがあります: " + rel + "/" + entry.name);
    } else {
      fail(courseId, "扱えないファイルがあります: " + rel + "/" + entry.name);
    }
  }
}

async function expectDirs(
  courseId: string,
  dir: string,
  rel: string,
  expected: string[],
): Promise<void> {
  const entries = await entriesOf(courseId, dir, rel);
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const wanted = [...expected].sort();
  if (dirs.length !== wanted.length || dirs.some((name, index) => name !== wanted[index])) {
    fail(
      courseId,
      rel + " のディレクトリが course.json と一致しません（期待: " + wanted.join(", ") + " / 実際: " + dirs.join(", ") + "）",
    );
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) fail(courseId, "余分なファイルがあります: " + rel + "/" + entry.name);
  }
}

/**
 * セクションのスライドを読む。
 * slides/ の NN.md（NN は 2 桁。NN-名前.md も可）を番号順に並べる。
 */
async function readSlides(courseId: string, sectionDir: string, relDir: string): Promise<LoadedSlide[]> {
  const slidesDir = join(sectionDir, "slides");
  let entries: Dirent[];
  try {
    entries = await readdir(slidesDir, { withFileTypes: true });
  } catch {
    fail(courseId, "スライドがありません: " + relDir + "/slides（NN.md を置いてください）");
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (ignoredEntry(entry.name)) continue;
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      fail(courseId, "スライド以外のファイルがあります: " + relDir + "/slides/" + entry.name);
    }
    names.push(entry.name);
  }
  if (names.length === 0) fail(courseId, "スライドがありません: " + relDir + "/slides（NN.md を置いてください）");
  names.sort();

  const seen = new Map<string, string>();
  const slides: LoadedSlide[] = [];
  for (const name of names) {
    const match = SLIDE_FILE.exec(name);
    if (!match) {
      fail(courseId, "スライドのファイル名が不正です: " + relDir + "/slides/" + name + "（NN.md か NN-名前.md）");
    }
    const number = match[1];
    const previous = seen.get(number);
    if (previous !== undefined) {
      fail(courseId, "スライド番号が重複しています: " + relDir + "/slides/" + previous + " と " + name);
    }
    seen.set(number, name);
    const body = await readTextIfExists(join(slidesDir, name));
    if (body === null) fail(courseId, "スライドが読めません: " + relDir + "/slides/" + name);
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

/** セクション直下の ex/ から、ただ1つの演習ディレクトリ名を返す。 */
async function readExerciseDirName(courseId: string, sectionDir: string, relDir: string): Promise<string> {
  const exDir = join(sectionDir, "ex");
  const entries = await entriesOf(courseId, exDir, relDir + "/ex");
  const dirs = entries.filter((entry) => entry.isDirectory());
  for (const entry of entries) {
    if (!entry.isDirectory()) fail(courseId, "余分なファイルがあります: " + relDir + "/ex/" + entry.name);
  }
  if (dirs.length !== 1) {
    fail(courseId, relDir + "/ex には演習ディレクトリがちょうど1つ必要です（実際: " + dirs.length + "）");
  }
  return dirs[0].name;
}

export async function loadCourse(ctx: Ctx, id: string): Promise<LoadedCourse> {
  if (!COURSE_ID.test(id)) throw new NotFoundError("コースが見つかりません: " + id);
  const dir = join(ctx.coursesDir, id);
  if (!(await pathExists(join(dir, "course.json")))) {
    throw new NotFoundError("コースが見つかりません: " + id);
  }
  const spec = await readJson(join(dir, "course.json"), CourseSchema);
  if (spec.id !== id) fail(id, "course.json の id (" + spec.id + ") がディレクトリ名と違います");
  for (const name of Object.keys(spec.envs)) {
    if (!ENV_NAME.test(name)) fail(id, "envs の名前が不正です: " + name);
  }

  const lessons: LoadedLesson[] = [];
  const exercises: ExerciseEntry[] = [];
  const byId = new Map<string, ExerciseEntry>();
  const sectionByExercise = new Map<string, LoadedSection>();

  for (const [lessonOffset, ref] of spec.lessons.entries()) {
    const lessonIndex = lessonOffset + 1;
    const lessonDir = join(dir, "content", ref.id);
    const lessonRel = "content/" + ref.id;
    if (!(await pathExists(lessonDir))) fail(id, "レッスンのディレクトリがありません: " + lessonRel);
    await expectOnly(id, lessonDir, lessonRel, { dirs: ["chapters"], files: ["quiz.json"] });

    const chaptersDir = join(lessonDir, "chapters");
    await expectDirs(id, chaptersDir, lessonRel + "/chapters", ref.chapters.map((chapter) => chapter.id));
    const quiz = await readJsonIfExists(join(lessonDir, "quiz.json"), QuizSchema);
    if (quiz) validateQuiz(id, ref.id, quiz);
    const chapters: LoadedChapter[] = [];
    const lessonExercises: ExerciseEntry[] = [];

    for (const [chapterOffset, chapterRef] of ref.chapters.entries()) {
      const chapterRel = lessonRel + "/chapters/" + chapterRef.id;
      const chapterDir = join(chaptersDir, chapterRef.id);
      await expectOnly(id, chapterDir, chapterRel, { dirs: ["sections"] });
      const sectionsDir = join(chapterDir, "sections");
      await expectDirs(
        id,
        sectionsDir,
        chapterRel + "/sections",
        chapterRef.sections.map((section) => section.id),
      );

      const sections: LoadedSection[] = [];
      const chapterExercises: ExerciseEntry[] = [];
      for (const [sectionOffset, sectionRef] of chapterRef.sections.entries()) {
        const sectionRel = chapterRel + "/sections/" + sectionRef.id;
        const sectionDir = join(sectionsDir, sectionRef.id);
        await expectOnly(id, sectionDir, sectionRel, { dirs: ["slides", "ex"] });
        const slides = await readSlides(id, sectionDir, sectionRel);
        const exerciseId = await readExerciseDirName(id, sectionDir, sectionRel);
        const exerciseDir = join(sectionDir, "ex", exerciseId);
        const exercisePath = join(exerciseDir, "exercise.json");
        if (!(await pathExists(exercisePath))) fail(id, "演習がありません: " + sectionRel + "/ex/" + exerciseId);
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
          chapterId: chapterRef.id,
          chapterTitle: chapterRef.title,
          chapterIndex: chapterOffset + 1,
          sectionId: sectionRef.id,
          sectionTitle: sectionRef.title,
          sectionIndex: sectionOffset + 1,
          index: lessonExercises.length + 1,
        };
        await validateExercise(spec, entry);
        const section: LoadedSection = {
          ref: sectionRef,
          index: sectionOffset + 1,
          dir: sectionDir,
          slides,
          exercise: entry,
        };
        sections.push(section);
        chapterExercises.push(entry);
        lessonExercises.push(entry);
        exercises.push(entry);
        if (byId.has(exerciseId)) fail(id, "演習 ID が重複しています: " + exerciseId);
        byId.set(exerciseId, entry);
        sectionByExercise.set(exerciseId, section);
      }

      chapters.push({
        ref: chapterRef,
        index: chapterOffset + 1,
        dir: chapterDir,
        sections,
        exercises: chapterExercises,
      });
    }

    lessons.push({
      ref,
      index: lessonIndex,
      dir: lessonDir,
      chapters,
      exercises: lessonExercises,
      quiz,
    });
  }

  return { id, dir, spec, lessons, exercises, byId, sectionByExercise };
}

function validateQuiz(courseId: string, lessonId: string, quiz: Quiz): void {
  const ids = new Set<string>();
  for (const question of quiz.questions) {
    if (ids.has(question.id)) fail(courseId, "レッスン " + lessonId + " の quiz.json で問題 ID が重複しています: " + question.id);
    ids.add(question.id);
    const options = new Set(question.options.map((option) => option.id));
    for (const answer of question.answers) {
      if (!options.has(answer)) {
        fail(courseId, "レッスン " + lessonId + " の quiz.json の答えが選択肢にありません: " + question.id + " -> " + answer);
      }
    }
    if (!question.multiple && question.answers.length > 1) {
      fail(courseId, "レッスン " + lessonId + " の quiz.json が単一選択なのに答えが複数あります: " + question.id);
    }
  }
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
