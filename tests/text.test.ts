import { describe, expect, test } from "bun:test";
import { normalizeNewlines } from "../src/core/text.ts";

describe("normalizeNewlines", () => {
  test("CRLF を LF にそろえる", () => {
    expect(normalizeNewlines("read -r name\r\necho \"Hello, $name\"\r\n")).toBe(
      "read -r name\necho \"Hello, $name\"\n",
    );
  });

  test("単独の CR も LF にする", () => {
    expect(normalizeNewlines("a\rb\r\nc")).toBe("a\nb\nc");
  });

  test("LF はそのまま", () => {
    expect(normalizeNewlines("a\nb\n")).toBe("a\nb\n");
  });
});
