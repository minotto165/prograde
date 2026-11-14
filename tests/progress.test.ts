import { describe, expect, test } from "bun:test";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { findExercise } from "../src/core/course.ts";
import {
  historyPath,
  readHistory,
  readProgress,
  recordAttempt,
  rebuildProgress,
  replay,
} from "../src/core/progress.ts";
import { basicCourseFiles, scratchCourse } from "./helpers.ts";

async function progressCourse() {
  return await scratchCourse(basicCourseFiles("prog", ["l1-e01", "l1-e02"]), "prog");
}

describe("progress: 追記ログが真実、progress.json は投影", () => {
  test("合格すると XP と solved が増える", async () => {
    const { ctx, course } = await progressCourse();
    const entry = findExercise(course, "l1-e01");
    await recordAttempt(ctx, course, entry, { ok: true, durationMs: 12 });
    const { progress, broken } = await readProgress(ctx, course);
    expect(broken).toBe(0);
    expect(progress.xp).toBe(10);
    expect(progress.level).toBe(1);
    expect(progress.exercises["l1-e01"].solved).toBe(true);
    expect(progress.lessons["l1"].solved).toBe(1);
    expect(progress.next?.exerciseId).toBe("l1-e02");
    expect(progress.events).toBe(1);
  });

  test("同じ演習の再合格で XP は二重加算しない", async () => {
    const { ctx, course } = await progressCourse();
    const entry = findExercise(course, "l1-e01");
    await recordAttempt(ctx, course, entry, { ok: true, durationMs: 10 });
    await recordAttempt(ctx, course, entry, { ok: true, durationMs: 8 });
    const { progress } = await readProgress(ctx, course);
    expect(progress.xp).toBe(10);
    expect(progress.exercises["l1-e01"].attempts).toBe(2);
    expect(progress.exercises["l1-e01"].bestMs).toBe(8);
  });

  test("不合格は solved を変えず failed を数える", async () => {
    const { ctx, course } = await progressCourse();
    const entry = findExercise(course, "l1-e01");
    await recordAttempt(ctx, course, entry, { ok: false, durationMs: 10 });
    const { progress } = await readProgress(ctx, course);
    expect(progress.xp).toBe(0);
    expect(progress.exercises["l1-e01"].failed).toBe(1);
    expect(progress.next?.exerciseId).toBe("l1-e01");
  });

  test("壊れた行は無視して読める", async () => {
    const { ctx, course } = await progressCourse();
    const entry = findExercise(course, "l1-e01");
    await recordAttempt(ctx, course, entry, { ok: true, durationMs: 10 });
    await appendFile(historyPath(ctx), "{broken json\n", "utf8");
    const { broken } = await readHistory(ctx);
    expect(broken).toBe(1);
    const { progress } = await readProgress(ctx, course);
    expect(progress.xp).toBe(10);
  });

  test("progress.json を消しても履歴から復旧する", async () => {
    const { ctx, course } = await progressCourse();
    const entry = findExercise(course, "l1-e01");
    await recordAttempt(ctx, course, entry, { ok: true, durationMs: 10 });
    const projection = JSON.parse(await readFile(ctx.stateDir + "/progress.json", "utf8"));
    expect(projection.courses["prog"].xp).toBe(10);
    const rebuilt = await rebuildProgress(ctx, course);
    expect(rebuilt.xp).toBe(10);
  });

  test("progress.json がずれていれば履歴から再投影する", async () => {
    const { ctx, course } = await progressCourse();
    const entry = findExercise(course, "l1-e01");
    await recordAttempt(ctx, course, entry, { ok: true, durationMs: 10 });
    const path = ctx.stateDir + "/progress.json";
    const data = JSON.parse(await readFile(path, "utf8"));
    data.courses["prog"].xp = 999;
    await writeFile(path, JSON.stringify(data), "utf8");
    const { progress } = await readProgress(ctx, course);
    expect(progress.xp).toBe(10);
  });

  test("replay は他コースのイベントを混ぜない", async () => {
    const { course } = await progressCourse();
    const events = [
      { t: "attempt" as const, at: "2026-01-02T00:00:00.000Z", course: "other", exercise: "x", ok: true, ms: 1, xp: 50 },
      { t: "attempt" as const, at: "2026-01-02T00:00:00.000Z", course: "prog", exercise: "l1-e01", ok: true, ms: 5, xp: 10 },
    ];
    const progress = replay(course, events);
    expect(progress.xp).toBe(10);
    expect(progress.events).toBe(1);
  });
});
