import { dashboard } from "$lib/server/prograde";

export async function load() {
  return await dashboard();
}
