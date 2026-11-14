import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCtx, defaultDataRoot } from "../src/core/context.ts";

describe("context: データルートの決定", () => {
  test("明示 root が最優先", () => {
    const ctx = createCtx({ root: "/tmp/prograde-root-explicit" });
    expect(ctx.root).toBe("/tmp/prograde-root-explicit");
    expect(ctx.coursesDir).toBe("/tmp/prograde-root-explicit/tracks");
  });

  test("PROGRADE_ROOT が既定より優先", () => {
    const prev = process.env.PROGRADE_ROOT;
    process.env.PROGRADE_ROOT = "/tmp/prograde-root-env";
    try {
      expect(createCtx().root).toBe("/tmp/prograde-root-env");
      expect(defaultDataRoot()).toBe("/tmp/prograde-root-env");
    } finally {
      if (prev === undefined) delete process.env.PROGRADE_ROOT;
      else process.env.PROGRADE_ROOT = prev;
    }
  });

  test("未指定ならホームの .prograde", () => {
    const prev = process.env.PROGRADE_ROOT;
    delete process.env.PROGRADE_ROOT;
    try {
      expect(createCtx().root).toBe(join(homedir(), ".prograde"));
    } finally {
      if (prev !== undefined) process.env.PROGRADE_ROOT = prev;
    }
  });
});
