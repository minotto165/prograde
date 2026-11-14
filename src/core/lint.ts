import { join } from "node:path";
import type { Ctx } from "./context.ts";
import type { LoadedCourse, ExerciseEntry } from "./course.ts";
import { grade } from "./grader.ts";
import { pathExists, readTextIfExists } from "./fsx.ts";

export interface LintReport {
  courseId: string;
  errors: string[];
  warnings: string[];
  checked: number;
}

/**
 * 教材の静的 + 動的検査。
 * - レッスン本文・演習の説明・解答が揃っているか
 * - 雛形は不合格、解答は合格するか
 * - 解答が決定的か（2回同じ結果になるか）
 */
export async function lint(
  ctx: Ctx,
  course: LoadedCourse,
  options: { dynamic?: boolean } = {},
): Promise<LintReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dynamic = options.dynamic ?? true;

  for (const lesson of course.lessons) {
    const doc = lesson.doc?.trim() ?? "";
    if (doc.length === 0) {
      errors.push("レッスン本文が空です: " + lesson.ref.id + "（content/" + lesson.ref.id + "/lesson.md）");
    } else if (doc.length < 80) {
      warnings.push("レッスン本文が短すぎます: " + lesson.ref.id + "（" + doc.length + " 文字）");
    }
    if (lesson.exercises.length === 0) errors.push("演習がありません: " + lesson.ref.id);
  }

  for (const entry of course.exercises) {
    const prefix = entry.id + ": ";
    const brief = (await readTextIfExists(join(entry.dir, "brief.md")))?.trim() ?? "";
    if (brief.length === 0) {
      errors.push(prefix + "brief.md がありません（演習の説明）");
    }
    if (entry.spec.hints.length === 0) {
      warnings.push(prefix + "ヒントがありません");
    }
    if (entry.spec.judge.length === 0) {
      errors.push(prefix + "judge が空です");
    }
    if (!dynamic) continue;

    const starter = await grade(ctx, course, entry, { fresh: true });
    if (starter.ok && !entry.spec.starterMayPass) {
      errors.push(prefix + "雛形がそのまま合格してしまいます（starterMayPass: true で許可）");
    }
    const solution = await grade(ctx, course, entry, { solution: true, fresh: true });
    if (!solution.ok) {
      errors.push(prefix + "解答が不合格です: " + solution.message);
    } else {
      const again = await grade(ctx, course, entry, { solution: true, fresh: true });
      if (!again.ok || again.exitCode !== solution.exitCode || again.stdout !== solution.stdout) {
        errors.push(prefix + "解答の結果が実行ごとに変わります（決定性なし）");
      }
    }
  }

  return {
    courseId: course.id,
    errors,
    warnings,
    checked: course.exercises.length,
  };
}

export async function checkLessonDoc(entry: ExerciseEntry): Promise<boolean> {
  return (await pathExists(join(entry.dir, "brief.md")));
}
