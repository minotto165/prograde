import { dashboard } from "$lib/server/prograde";

export async function load() {
  const { totals } = await dashboard();
  return { totals };
}
