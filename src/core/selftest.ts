import type { Ctx } from "./context.ts";
import type { LoadedCourse } from "./course.ts";
import { grade, type GradeResult } from "./grader.ts";

export interface SelfTestOutcome {
  exerciseId: string;
  ok: boolean;
  durationMs: number;
  message: string;
  result?: GradeResult;
}

export interface SelfTestReport {
  courseId: string;
  passed: number;
  failed: number;
  outcomes: SelfTestOutcome[];
}

/** 全演習の解答（solution/）を採点する。教材の回帰テスト。 */
export async function selftest(
  ctx: Ctx,
  course: LoadedCourse,
  options: { only?: string[] } = {},
): Promise<SelfTestReport> {
  const targets = options.only && options.only.length > 0
    ? course.exercises.filter((entry) => options.only!.includes(entry.id))
    : course.exercises;

  const outcomes: SelfTestOutcome[] = [];
  for (const entry of targets) {
    try {
      const result = await grade(ctx, course, entry, { solution: true });
      outcomes.push({
        exerciseId: entry.id,
        ok: result.ok,
        durationMs: result.durationMs,
        message: result.message,
        result,
      });
    } catch (err) {
      outcomes.push({
        exerciseId: entry.id,
        ok: false,
        durationMs: 0,
        message: (err as Error).message,
      });
    }
  }

  return {
    courseId: course.id,
    passed: outcomes.filter((outcome) => outcome.ok).length,
    failed: outcomes.filter((outcome) => !outcome.ok).length,
    outcomes,
  };
}
