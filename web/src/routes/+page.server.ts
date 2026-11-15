import { dashboard } from "$lib/server/prograde";
import { httpError } from "$lib/server/errors";

export async function load() {
  try {
    return await dashboard();
  } catch (cause) {
    httpError(cause, "コース一覧を読み込めませんでした");
  }
}
