import { json } from "@sveltejs/kit";
import { save } from "$lib/server/prograde";
import { DataError, NotFoundError } from "../../../../../../../src/core/errors.ts";

export async function POST({
  params,
  request,
}: {
  params: { course: string; exercise: string };
  request: Request;
}) {
  try {
    const outcome = await save(params.course, params.exercise, await request.formData());
    return json(outcome);
  } catch (cause) {
    if (cause instanceof NotFoundError) return json({ error: "見つかりません" }, { status: 404 });
    if (cause instanceof DataError) {
      console.error(cause);
      return json({ error: "教材データを読み込めませんでした" }, { status: 500 });
    }
    console.error(cause);
    return json({ error: "保存できませんでした" }, { status: 500 });
  }
}
