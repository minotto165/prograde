import { error } from "@sveltejs/kit";
import { DataError, NotFoundError } from "../../../../src/core/errors.ts";

/** core の例外を HTTP に写す。教材の不備は 500、未知のリソースは 404。 */
export function httpError(cause: unknown, fallback = "読み込みに失敗しました"): never {
  if (cause instanceof NotFoundError) throw error(404, cause.message);
  if (cause instanceof DataError) {
    console.error(cause);
    throw error(500, "教材データを読み込めませんでした");
  }
  console.error(cause);
  throw error(500, fallback);
}
