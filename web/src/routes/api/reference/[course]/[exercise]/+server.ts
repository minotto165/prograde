import { json } from "@sveltejs/kit";
import { referenceRunFor } from "$lib/server/prograde";
import { DataError, NotFoundError } from "../../../../../../../src/core/errors.ts";

export async function GET({
  params,
  url,
}: {
  params: { course: string; exercise: string };
  url: URL;
}) {
  try {
    const reference = await referenceRunFor(params.course, params.exercise, url.searchParams.has("fresh"));
    return json(reference);
  } catch (cause) {
    if (cause instanceof NotFoundError) return json({ error: "見つかりません" }, { status: 404 });
    if (cause instanceof DataError) return json({ error: "お手本を実行できませんでした" }, { status: 500 });
    console.error(cause);
    return json({ error: "お手本を実行できませんでした" }, { status: 500 });
  }
}
