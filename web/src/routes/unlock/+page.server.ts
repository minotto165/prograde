import { fail, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import {
  UNLOCK_COOKIE,
  UNLOCK_MAX_AGE,
  createUnlockToken,
  pinMatches,
} from "$lib/server/pin";
import {
  checkRateLimit,
  clearFailures,
  configuredPin,
  isUnlocked,
  recordFailure,
} from "$lib/server/unlock";
import type { Actions, PageServerLoad } from "./$types";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || value.startsWith("/unlock")) return "/";
  return value;
}

export const load: PageServerLoad = ({ url, cookies }) => {
  const pin = configuredPin();
  if (!pin) throw redirect(303, "/");

  const next = safeNext(url.searchParams.get("next"));
  if (isUnlocked(cookies)) throw redirect(303, next);
  return { next };
};

export const actions: Actions = {
  default: async ({ request, cookies, url, getClientAddress }) => {
    const pin = configuredPin();
    if (!pin) throw redirect(303, "/");

    const data = await request.formData();
    const next = safeNext(String(data.get("next") ?? ""));
    const ip = getClientAddress();

    const rate = checkRateLimit(ip);
    if (rate.blocked) {
      return fail(429, {
        error: "試行が多すぎます。" + Math.ceil(rate.retryAfter / 60) + " 分後にもう一度お試しください。",
        next,
      });
    }

    const input = String(data.get("pin") ?? "").trim();
    if (!pinMatches(input, pin)) {
      recordFailure(ip);
      return fail(400, { error: "PIN が違います。", next });
    }

    clearFailures(ip);
    const secret = env.PROGRADE_SESSION_SECRET || pin;
    cookies.set(UNLOCK_COOKIE, createUnlockToken(pin, secret), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: UNLOCK_MAX_AGE,
    });
    throw redirect(303, next);
  },
};
