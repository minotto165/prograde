import { describe, expect, test } from "bun:test";
import { findExercise } from "../src/core/course.ts";
import { grade } from "../src/core/grader.ts";
import { ensureWorkspace, resetWorkspace, writeWorkspace } from "../src/core/attempt.ts";
import { basicCourseFiles, courseJson, exerciseJson, scratchCourse } from "./helpers.ts";

async function workspaceCourse(id: string) {
  return await scratchCourse(basicCourseFiles(id, ["l1-e01"]), id);
}

const multiCourse = (): Record<string, string> => ({
  "course.json": courseJson({ id: "multi", envs: { shell: {} }, exercises: ["m-01-e01"], ext: "sh" }),
  "content/l1/ex/m-01-e01/exercise.json": exerciseJson({
    id: "m-01-e01",
    env: "shell",
    files: [
      { path: "main.sh", text: "source ./lib.sh\n", editable: true },
      { path: "lib.sh", text: "echo starter\n", editable: true },
    ],
    recipe: { run: [["bash", "{work}/main.sh"]] },
    observe: [
      { kind: "exit", as: "exit" },
      { kind: "stdout", as: "out" },
    ],
    judge: [
      { on: "exit", match: "equals", value: 0 },
      { on: "out", match: "exact", value: "hi\n" },
    ],
  }),
  "content/l1/ex/m-01-e01/solution/main.sh": "source ./lib.sh\n",
  "content/l1/ex/m-01-e01/solution/lib.sh": "echo hi\n",
});

describe("workspace: 作業コピーに保存して続きから", () => {
  test("writeWorkspace は編集ファイルを保存し、ensureWorkspace は壊さない", async () => {
    const { ctx, course } = await workspaceCourse("ws-save");
    const entry = findExercise(course, "l1-e01");
    const workspace = await writeWorkspace(ctx, entry, { "main.sh": "echo saved\n" });
    expect(await Bun.file(workspace + "/main.sh").text()).toBe("echo saved\n");
    await ensureWorkspace(ctx, entry);
    expect(await Bun.file(workspace + "/main.sh").text()).toBe("echo saved\n");
  });

  test("resetWorkspace は雛形に戻す", async () => {
    const { ctx, course } = await workspaceCourse("ws-reset");
    const entry = findExercise(course, "l1-e01");
    await writeWorkspace(ctx, entry, { "main.sh": "echo broken\n" });
    const workspace = await resetWorkspace(ctx, entry);
    expect(await Bun.file(workspace + "/main.sh").text()).not.toContain("broken");
  });

  test("編集できないファイルは保存できない", async () => {
    const { ctx, course } = await workspaceCourse("ws-readonly");
    const entry = findExercise(course, "l1-e01");
    await expect(writeWorkspace(ctx, entry, { "other.sh": "x" })).rejects.toThrow("編集できないファイルです");
  });
});

describe("grader: 複数ファイルの提出", () => {
  test("files で渡した内容が採点に使われる", async () => {
    const { ctx, course } = await scratchCourse(multiCourse(), "multi");
    const entry = findExercise(course, "m-01-e01");
    const result = await grade(ctx, course, entry, {
      files: { "main.sh": "source ./lib.sh\n", "lib.sh": "echo hi\n" },
    });
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe("hi\n");
  });

  test("files 指定時は作業コピーを重ねない", async () => {
    const { ctx, course } = await scratchCourse(multiCourse(), "multi");
    const entry = findExercise(course, "m-01-e01");
    await writeWorkspace(ctx, entry, { "main.sh": "echo stale\n", "lib.sh": "echo stale\n" });
    const result = await grade(ctx, course, entry, {
      files: { "main.sh": "source ./lib.sh\n", "lib.sh": "echo fresh\n" },
    });
    expect(result.ok).toBe(false);
    expect(result.stdout).toBe("fresh\n");
    expect(result.checks.find((check) => check.name === "out")?.actual).toContain("fresh");
  });

  test("編集できないファイルを混ぜると失敗する", async () => {
    const { ctx, course } = await scratchCourse(multiCourse(), "multi");
    const entry = findExercise(course, "m-01-e01");
    await expect(grade(ctx, course, entry, { files: { "notes.txt": "x" } })).rejects.toThrow("編集できないファイルです");
  });
});
