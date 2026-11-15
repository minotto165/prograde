import { createCtx, type Ctx } from "../../../../src/core/context.ts";

/** Web も CLI と同じ core を使う。ここだけがファイルシステムに触る。 */
export function webCtx(): Ctx {
  return createCtx();
}
