import { env } from "$env/dynamic/private";
import type { Cookies } from "@sveltejs/kit";
import { UNLOCK_COOKIE, tokenMatches } from "./pin";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 10;

interface Attempt {
  failures: number;
  resetAt: number;
}

const attempts = new Map<string, Attempt>();

export function configuredPin(): string {
  return env.PROGRADE_PIN?.trim() ?? "";
}

function configuredSecret(pin: string): string {
  return env.PROGRADE_SESSION_SECRET || pin;
}

/** PIN が未設定ならロックしない。 */
export function isUnlocked(cookies: Cookies): boolean {
  const pin = configuredPin();
  if (!pin) return true;
  return tokenMatches(cookies.get(UNLOCK_COOKIE) ?? "", pin, configuredSecret(pin));
}

export interface RateLimit {
  blocked: boolean;
  retryAfter: number;
}

export function checkRateLimit(ip: string): RateLimit {
  const now = Date.now();
  const attempt = attempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    if (attempt) attempts.delete(ip);
    return { blocked: false, retryAfter: 0 };
  }
  return {
    blocked: attempt.failures >= MAX_FAILURES,
    retryAfter: Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)),
  };
}

export function recordFailure(ip: string): void {
  const now = Date.now();
  if (attempts.size > 1024) {
    for (const [key, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(key);
    }
  }
  const attempt = attempts.get(ip);
  if (!attempt || attempt.resetAt <= now) {
    attempts.set(ip, { failures: 1, resetAt: now + WINDOW_MS });
    return;
  }
  attempt.failures += 1;
}

export function clearFailures(ip: string): void {
  attempts.delete(ip);
}
