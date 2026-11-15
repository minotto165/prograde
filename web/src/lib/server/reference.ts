import type { Ctx } from "../../../../src/core/context.ts";
import type { ExerciseEntry, LoadedCourse } from "../../../../src/core/course.ts";
import { grade } from "../../../../src/core/grader.ts";
import { loadEntry } from "./queries.ts";

export interface ReferenceRun {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

/** 解答例を実行した結果。ページを開くたびに走らせないよう、成功したものだけ覚えておく。 */
const referenceCache = new Map<string, ReferenceRun>();

async function referenceRun(ctx: Ctx, course: LoadedCourse, entry: ExerciseEntry, force = false): Promise<ReferenceRun> {
  const key = course.id + "/" + entry.id;
  if (!force) {
    const cached = referenceCache.get(key);
    if (cached) return cached;
  }
  const result = await grade(ctx, course, entry, { solution: true, fresh: true });
  const reference: ReferenceRun = {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    stdout: result.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
  };
  // 失敗した実行を覚えると、直したあとも古い失敗を出し続ける。成功だけキャッシュする。
  if (reference.exitCode === 0 && !reference.timedOut) referenceCache.set(key, reference);
  return reference;
}

/** お手本をもう一度実行する（Web の再実行アイコン用）。 */
export async function referenceRunFor(courseId: string, exerciseId: string, force = false): Promise<ReferenceRun> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  return await referenceRun(ctx, course, entry, force);
}
