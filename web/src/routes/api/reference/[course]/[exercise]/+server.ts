import { json } from "@sveltejs/kit";
import { referenceRunFor } from "$lib/server/prograde";

export async function GET({ params, url }) {
  try {
    const reference = await referenceRunFor(params.course, params.exercise, url.searchParams.has("fresh"));
    return json(reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: 500 });
  }
}
