import { createHmac, timingSafeEqual } from "node:crypto";

export const UNLOCK_COOKIE = "prograde_unlock";
export const UNLOCK_MAX_AGE = 60 * 60 * 12;

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 6桁の PIN を定数時間で比べる。 */
export function pinMatches(input: string, expected: string): boolean {
  const pin = input.trim();
  if (pin.length !== 6 || expected.length !== 6) return false;
  return constantTimeEqual(pin, expected);
}

export function createUnlockToken(pin: string, secret: string): string {
  return createHmac("sha256", secret || pin).update("prograde-unlock:" + pin).digest("base64url");
}

export function tokenMatches(token: string, pin: string, secret: string): boolean {
  if (!token || !pin) return false;
  return constantTimeEqual(token, createUnlockToken(pin, secret));
}
