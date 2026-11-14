import { Command, CommanderError } from "commander";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import pc from "picocolors";
import { createCtx, type Ctx } from "../core/context.ts";
import { EnvError, UserError, formatDiagnostics } from "../core/errors.ts";
import {
  findExercise,
  findLesson,
  listCourses,
  loadCourse,
  resolveCourseId,
  type ExerciseEntry,
  type LoadedCourse,
} from "../core/course.ts";
import { grade, type GradeResult } from "../core/grader.ts";
import { ensureWorkspace, editableFiles, resetWorkspace } from "../core/attempt.ts";
import { readProgress, recordAttempt, recordReset } from "../core/progress.ts";
import { selftest } from "../core/selftest.ts";
import { lint } from "../core/lint.ts";
import { gradeQuiz } from "../core/quiz.ts";
import { pathExists } from "../core/fsx.ts";

interface GlobalOptions {
  root?: string;
  course?: string;
  json?: boolean;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value));
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function ctxOf(command: Command): Ctx {
  const options = command.optsWithGlobals() as GlobalOptions;
  return createCtx({ root: options.root });
}

async function courseOf(command: Command): Promise<{ ctx: Ctx; course: LoadedCourse }> {
  const options = command.optsWithGlobals() as GlobalOptions;
  const ctx = createCtx({ root: options.root });
  const courseId = await resolveCourseId(ctx, options.course);
  const course = await loadCourse(ctx, courseId);
  return { ctx, course };
}

async function readSource(
  command: Command,
  options: { code?: string; file?: string },
): Promise<string | undefined> {
  if (options.code !== undefined) {
    return options.code === "-" ? await Bun.stdin.text() : options.code;
  }
  if (options.file) {
    const file = Bun.file(options.file);
    if (!(await file.exists())) throw new UserError(options.file + ": ファイルがありません");
    return file.text();
  }
  return undefined;
}

function printResult(result: GradeResult, options: { verbose?: boolean } = {}): void {
  const mark = result.ok ? pc.green("✓") : pc.red("✗");
  console.log(
    mark +
      " " +
      result.exerciseId +
      " " +
      result.title +
      pc.dim("  (" + result.durationMs + "ms, env " + result.env + ")"),
  );

  for (const check of result.checks) {
    if (check.ok) continue;
    console.log("  " + pc.red("×") + " " + check.name);
    console.log("      " + pc.dim("期待: ") + check.expected);
    console.log("      " + pc.dim("実際: ") + check.actual);
    if (check.note) console.log("      " + pc.yellow(check.note));
  }
  if (result.timedOut) console.log("  " + pc.yellow("時間切れで打ち切りました"));

  if (result.diagnostics.length > 0) {
    console.log(pc.dim("  診断:"));
    console.log(
      formatDiagnostics(result.diagnostics)
        .split("\n")
        .map((line) => "    " + line)
        .join("\n"),
    );
  }

  if (!result.ok && result.diagnostics.length === 0 && (result.stderr.trim() || result.stdout.trim())) {
    const text = (result.stderr.trim() || result.stdout.trim()).split("\n").slice(0, 12).join("\n");
    console.log(pc.dim("  出力:"));
    console.log(text.split("\n").map((line) => "    " + line).join("\n"));
  }

  if (options.verbose && result.attemptDir) console.log(pc.dim("  試行: " + result.attemptDir));
  if (result.ok) console.log("  " + pc.green("合格"));
}

export async function main(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("prograde")
    .description("ローカル完結のプログラミング練習プラットフォーム")
    .version("0.2.0", "-v, --version", "バージョンを表示")
    .option("--root <dir>", "データルート（既定: $PROGRADE_ROOT か ~/.prograde）")
    .option("-c, --course <id>", "コース ID（省略時は唯一のコース）")
    .option("--json", "1行の JSON で出力")
    .exitOverride();

  program
    .command("courses")
    .description("コース一覧")
    .action(async (_options, command: Command) => {
      const options = command.optsWithGlobals() as GlobalOptions;
      const ctx = createCtx({ root: options.root });
      const courses = await listCourses(ctx);
      if (options.json) return printJson({ courses });
      if (courses.length === 0) {
        console.log(pc.dim("コースがありません: " + ctx.coursesDir));
        return;
      }
      for (const course of courses) {
        console.log(
          pc.bold(course.id) + "  " + course.label + "  " + pc.dim(course.lessons + " レッスン / " + course.exercises + " 演習"),
        );
        if (course.description) console.log("  " + pc.dim(course.description));
      }
    });

  program
    .command("status")
    .description("XP / レベル / 連続日数 / 次の演習")
    .action(async (_options, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const options = command.optsWithGlobals() as GlobalOptions;
      const { progress, broken } = await readProgress(ctx, course);
      const solved = Object.values(progress.exercises).filter((item) => item.solved).length;
      const total = course.exercises.length;

      if (options.json) {
        return printJson({
          course: course.id,
          label: course.spec.label,
          xp: progress.xp,
          level: progress.level,
          xpIntoLevel: progress.xpIntoLevel,
          xpForNext: progress.xpForNext,
          streak: progress.streak,
          solved,
          total,
          lessons: course.lessons.map((lesson) => ({
            id: lesson.ref.id,
            title: lesson.ref.title,
            solved: progress.lessons[lesson.ref.id]?.solved ?? 0,
            total: lesson.exercises.length,
          })),
          next: progress.next,
          brokenLines: broken,
          updatedAt: progress.updatedAt,
        });
      }

      const ratio = total === 0 ? 0 : Math.round((solved / total) * 100);
      console.log(pc.bold(course.spec.label) + pc.dim("  (" + course.id + ")"));
      console.log(
        "Lv " + progress.level + "   XP " + progress.xp + "   " +
          pc.dim("次まで " + (progress.xpForNext - progress.xpIntoLevel)) +
          "   streak " + progress.streak.days + "日",
      );
      console.log("進捗 " + solved + "/" + total + " (" + ratio + "%)");
      for (const lesson of course.lessons) {
        const done = progress.lessons[lesson.ref.id]?.solved ?? 0;
        const mark = done === lesson.exercises.length ? pc.green("✓") : pc.dim("·");
        console.log("  " + mark + " " + lesson.ref.id + "  " + lesson.ref.title + pc.dim("  " + done + "/" + lesson.exercises.length));
      }
      if (progress.next) {
        const entry = findExercise(course, progress.next.exerciseId);
        console.log(pc.cyan("次: ") + entry.id + "  " + entry.spec.title);
      } else if (total > 0) {
        console.log(pc.green("すべて完了しました"));
      }
      if (broken > 0) console.log(pc.yellow("履歴に壊れた行が " + broken + " 行あります（無視して投影しました）"));
    });

  program
    .command("list")
    .description("レッスンと演習の一覧")
    .option("--lesson <id>", "レッスンで絞り込む")
    .action(async (options: { lesson?: string }, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const globals = command.optsWithGlobals() as GlobalOptions;
      const { progress } = await readProgress(ctx, course);
      const lessons = options.lesson ? [findLesson(course, options.lesson)] : course.lessons;

      if (globals.json) {
        return printJson({
          course: course.id,
          lessons: lessons.map((lesson) => ({
            id: lesson.ref.id,
            title: lesson.ref.title,
            goal: lesson.ref.goal,
            exercises: lesson.exercises.map((entry) => ({
              id: entry.id,
              title: entry.spec.title,
              env: entry.spec.env,
              xp: entry.spec.xp,
              solved: progress.exercises[entry.id]?.solved ?? false,
            })),
          })),
        });
      }

      for (const lesson of lessons) {
        console.log(pc.bold(lesson.ref.id + "  " + lesson.ref.title));
        if (lesson.ref.goal) console.log("  " + pc.dim(lesson.ref.goal));
        for (const entry of lesson.exercises) {
          const solved = progress.exercises[entry.id]?.solved;
          console.log(
            "  " + (solved ? pc.green("✓") : pc.dim("·")) + " " + entry.id + "  " + entry.spec.title +
              pc.dim("  (" + entry.spec.env + ", " + entry.spec.xp + "xp)"),
          );
        }
      }
    });

  program
    .command("lesson")
    .argument("<lessonId>", "レッスン ID")
    .description("レッスン本文（スライド）と演習一覧を表示")
    .option("--slide <n>", "スライド番号（1 始まり）")
    .action(async (lessonId: string, options: { slide?: string }, command: Command) => {
      const { course } = await courseOf(command);
      const globals = command.optsWithGlobals() as GlobalOptions;
      const lesson = findLesson(course, lessonId);

      if (options.slide !== undefined && globals.json) {
        throw new UserError("--slide と --json は同時に指定できません");
      }

      if (globals.json) {
        return printJson({
          courseId: course.id,
          lessonId: lesson.ref.id,
          title: lesson.ref.title,
          goal: lesson.ref.goal ?? "",
          slides: lesson.slides.map((slide) => ({
            index: slide.index,
            id: slide.id,
            title: slide.title,
            body: slide.body,
          })),
          exercises: lesson.exercises.map((entry) => ({ id: entry.id, title: entry.spec.title })),
        });
      }

      console.log(pc.bold(lesson.ref.title) + pc.dim("  (" + lessonId + ")"));
      if (lesson.ref.goal) console.log(pc.dim("目標: " + lesson.ref.goal));
      console.log("");

      if (options.slide !== undefined) {
        if (lesson.slides.length === 0) throw new UserError("スライドがありません: " + lessonId);
        if (!/^\d+$/.test(options.slide)) {
          throw new UserError(
            "--slide は 1〜" + lesson.slides.length + " の整数で指定してください: " + options.slide,
          );
        }
        const number = Number(options.slide);
        const slide = lesson.slides[number - 1];
        if (!slide) {
          throw new UserError(
            "--slide は 1〜" + lesson.slides.length + " の整数で指定してください: " + options.slide,
          );
        }
        console.log(slide.body.trim());
      } else if (lesson.slides.length === 0) {
        console.log(pc.yellow("（本文がありません）"));
      } else {
        for (const slide of lesson.slides) {
          if (lesson.slides.length > 1) {
            console.log(pc.dim("スライド " + slide.index + "/" + lesson.slides.length));
          }
          console.log(slide.body.trim());
          console.log("");
        }
      }

      console.log("");
      for (const entry of lesson.exercises) {
        console.log("  " + entry.id + "  " + entry.spec.title);
      }
    });

  program
    .command("quiz")
    .argument("<lessonId>", "レッスン ID")
    .description("振り返りクイズを表示・採点する")
    .option("--answer <spec>", "回答（例: q1=a または q1=a,c。複数回指定可）", collect, [] as string[])
    .option("--all", "すべての問題と答えを表示")
    .action(async (lessonId: string, options: { answer: string[]; all?: boolean }, command: Command) => {
      const { course } = await courseOf(command);
      const globalOptions = command.optsWithGlobals() as GlobalOptions;
      const lesson = findLesson(course, lessonId);
      const quiz = lesson.quiz;
      if (!quiz) throw new UserError(lessonId + ": クイズがありません");

      const chosen = new Map<string, string[]>();
      for (const spec of options.answer) {
        const at = spec.indexOf("=");
        if (at <= 0) throw new UserError("--answer の形式が不正です: " + spec);
        const questionId = spec.slice(0, at).trim();
        const ids = spec.slice(at + 1).split(",").map((value) => value.trim()).filter(Boolean);
        chosen.set(questionId, ids);
      }

      if (chosen.size === 0) {
        if (globalOptions.json) return printJson({ lesson: lessonId, quiz });
        for (const [index, question] of quiz.questions.entries()) {
          console.log(
            pc.bold("Q" + (index + 1) + ". " + question.prompt) +
              (question.multiple ? pc.dim("  （複数選択）") : ""),
          );
          for (const option of question.options) console.log("  " + option.id + ") " + option.text);
          if (options.all) {
            console.log("  " + pc.green("答え: " + question.answers.join(",")));
            if (question.explanation) console.log("  " + pc.dim(question.explanation));
          }
          console.log("");
        }
        console.log(pc.dim("回答: prograde quiz " + lessonId + " --answer q1=a"));
        return;
      }

      const graded = gradeQuiz(quiz, chosen);
      if (globalOptions.json) return printJson({ lesson: lessonId, failed: graded.failed, results: graded.results });
      for (const question of quiz.questions) {
        const result = graded.results.find((item) => item.id === question.id)!;
        console.log((result.ok ? pc.green("✓ ") : pc.red("× ")) + question.id + "  " + question.prompt);
        if (!result.ok) {
          console.log("  " + pc.dim("答え: " + question.answers.join(",")));
          if (question.explanation) console.log("  " + pc.dim(question.explanation));
        }
      }
      console.log(graded.ok ? pc.green("全問正解") : pc.yellow(graded.failed + " 問不正解"));
      if (!graded.ok) process.exitCode = 1;
    });

  program
    .command("open")
    .argument("<exId>", "演習 ID")
    .description("作業コピーを用意して編集ファイルのパスを表示")
    .option("--force", "既存の作業コピーを雛形に戻す")
    .action(async (exId: string, options: { force?: boolean }, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const entry = findExercise(course, exId);
      if (options.force) await resetWorkspace(ctx, entry);
      const workspace = await ensureWorkspace(ctx, entry);
      const files = editableFiles(entry.spec).map((file) => join(workspace, file.path));
      for (const file of files) console.log(file);
    });

  program
    .command("hint")
    .argument("<exId>", "演習 ID")
    .description("ヒントを表示")
    .option("--level <n>", "表示する段数（既定 1）", "1")
    .option("--all", "すべて表示")
    .action(async (exId: string, options: { level?: string; all?: boolean }, command: Command) => {
      const { course } = await courseOf(command);
      const entry = findExercise(course, exId);
      const hints = entry.spec.hints;
      if (hints.length === 0) {
        console.log(pc.dim("この演習にヒントはありません"));
        return;
      }
      const count = options.all ? hints.length : Math.max(1, Number(options.level ?? "1"));
      for (let index = 0; index < Math.min(count, hints.length); index += 1) {
        console.log(pc.cyan("ヒント " + (index + 1) + ": ") + hints[index]);
      }
      if (count < hints.length) console.log(pc.dim("続き: --level " + (count + 1) + " または --all"));
    });

  program
    .command("reset")
    .argument("<exId>", "演習 ID")
    .description("作業コピーを雛形に戻す")
    .action(async (exId: string, _options, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const entry = findExercise(course, exId);
      const workspace = await resetWorkspace(ctx, entry);
      await recordReset(ctx, course, entry);
      console.log("戻しました: " + workspace);
    });

  program
    .command("check")
    .argument("<exId>", "演習 ID")
    .description("採点する（未指定なら作業コピーを採点）")
    .option("--file <path>", "採点するファイル")
    .option("--code <text>", "ソースを直接指定（- で標準入力）")
    .option("--keep", "試行ディレクトリを残す")
    .option("--no-record", "履歴に記録しない")
    .action(
      async (
        exId: string,
        options: { file?: string; code?: string; keep?: boolean; record: boolean },
        command: Command,
      ) => {
        const { ctx, course } = await courseOf(command);
        const globals = command.optsWithGlobals() as GlobalOptions;
        const entry = findExercise(course, exId);
        const code = await readSource(command, options);
        const result = await grade(ctx, course, entry, { code, keep: options.keep });
        if (options.record) await recordAttempt(ctx, course, entry, result);

        if (globals.json) {
          printJson(result);
        } else {
          printResult(result, { verbose: options.keep });
        }
        if (!result.ok) process.exitCode = 1;
      },
    );

  program
    .command("run")
    .argument("<exId>", "演習 ID")
    .description("採点せずに実行して出力を見る")
    .option("--file <path>", "実行するファイル")
    .option("--code <text>", "ソースを直接指定（- で標準入力）")
    .action(async (exId: string, options: { file?: string; code?: string }, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const entry = findExercise(course, exId);
      const code = await readSource(command, options);
      const result = await grade(ctx, course, entry, { code, keep: false });
      const ok = result.exitCode === 0 && !result.timedOut;
      console.log(pc.dim("exit " + (result.exitCode === null ? "null" : String(result.exitCode)) + "  " + result.durationMs + "ms" + (result.timedOut ? "  timeout" : "")));
      if (result.stdout) console.log(result.stdout.replace(/\n$/, ""));
      if (result.stderr) console.error(pc.dim(result.stderr.replace(/\n$/, "")));
      if (!ok) process.exitCode = 1;
    });

  program
    .command("selftest")
    .description("全演習の解答を採点する（教材の回帰テスト）")
    .option("--only <ids>", "カンマ区切りの演習 ID")
    .action(async (options: { only?: string }, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const globals = command.optsWithGlobals() as GlobalOptions;
      const only = options.only ? options.only.split(",").map((id) => id.trim()).filter(Boolean) : undefined;
      const report = await selftest(ctx, course, { only });
      if (globals.json) {
        printJson({
          course: report.courseId,
          passed: report.passed,
          failed: report.failed,
          outcomes: report.outcomes.map((outcome) => ({
            exerciseId: outcome.exerciseId,
            ok: outcome.ok,
            durationMs: outcome.durationMs,
            message: outcome.message,
          })),
        });
      } else {
        for (const outcome of report.outcomes) {
          console.log(
            (outcome.ok ? pc.green("✓") : pc.red("✗")) + " " + outcome.exerciseId + "  " +
              pc.dim(outcome.durationMs + "ms") + (outcome.ok ? "" : "  " + outcome.message),
          );
        }
        console.log(
          (report.failed === 0 ? pc.green("すべて合格") : pc.red(report.failed + " 件失敗")) +
            pc.dim("  (" + report.passed + "/" + (report.passed + report.failed) + ")"),
        );
      }
      if (report.failed > 0) process.exitCode = 1;
    });

  program
    .command("lint")
    .description("教材データを検査する（雛形が落ちるか・解答が通るか・決定的か）")
    .option("--static", "実行を伴う検査をしない")
    .action(async (options: { static?: boolean }, command: Command) => {
      const { ctx, course } = await courseOf(command);
      const globals = command.optsWithGlobals() as GlobalOptions;
      const report = await lint(ctx, course, { dynamic: !options.static });
      if (globals.json) {
        printJson(report);
      } else {
        for (const warning of report.warnings) console.log(pc.yellow("! " + warning));
        for (const error of report.errors) console.log(pc.red("✗ " + error));
        console.log(
          (report.errors.length === 0 ? pc.green("OK") : pc.red("NG")) +
            pc.dim("  " + report.checked + " 演習 / エラー " + report.errors.length + " / 警告 " + report.warnings.length),
        );
      }
      if (report.errors.length > 0) process.exitCode = 1;
    });

  program
    .command("where")
    .description("パスの確認（コース・状態・作業・キャッシュ）")
    .action(async (_options, command: Command) => {
      const options = command.optsWithGlobals() as GlobalOptions;
      const ctx = createCtx({ root: options.root });
      printJson({ root: ctx.root, courses: ctx.coursesDir, state: ctx.stateDir, work: ctx.workDir, cache: ctx.cacheDir });
    });

  try {
    await program.parseAsync(["bun", "prograde", ...argv]);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (["commander.helpDisplayed", "commander.version", "commander.help"].includes(err.code)) {
        process.exitCode = err.exitCode ?? 0;
        return;
      }
      process.exitCode = 2;
      return;
    }
    if (err instanceof EnvError) {
      console.error(pc.red(err.message));
      process.exitCode = 3;
      return;
    }
    if (err instanceof UserError) {
      console.error(pc.red(err.message));
      process.exitCode = err.exitCode;
      return;
    }
    console.error(pc.red((err as Error).message));
    if (process.env.PROGRADE_DEBUG) console.error((err as Error).stack);
    process.exitCode = 4;
  }
}

// 未使用の型を参照しないためのダミー（tree-shake で消える）
export type { ExerciseEntry };
