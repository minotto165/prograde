import { describe, expect, test } from "bun:test";
import { createUnlockToken, pinMatches, tokenMatches } from "../web/src/lib/server/pin.ts";
import { generatePin } from "../src/cli/web.ts";

describe("PIN: 生成", () => {
  test("6桁の数字で、先頭の 0 を落とさない", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });
});

describe("PIN: 照合", () => {
  test("完全一致だけ通す", () => {
    expect(pinMatches("123456", "123456")).toBe(true);
    expect(pinMatches(" 123456 ", "123456")).toBe(true);
    expect(pinMatches("123457", "123456")).toBe(false);
    expect(pinMatches("12345", "123456")).toBe(false);
    expect(pinMatches("1234567", "123456")).toBe(false);
    expect(pinMatches("", "123456")).toBe(false);
  });
});

describe("PIN: 解錠トークン", () => {
  test("PIN と secret が同じなら同じトークンになる", () => {
    const a = createUnlockToken("123456", "secret");
    const b = createUnlockToken("123456", "secret");
    expect(a).toBe(b);
    expect(a).not.toContain("123456");
  });

  test("PIN か secret が違えば一致しない", () => {
    const token = createUnlockToken("123456", "secret");
    expect(tokenMatches(token, "123456", "secret")).toBe(true);
    expect(tokenMatches(token, "123456", "other")).toBe(false);
    expect(tokenMatches(token, "654321", "secret")).toBe(false);
    expect(tokenMatches("", "123456", "secret")).toBe(false);
  });
});
