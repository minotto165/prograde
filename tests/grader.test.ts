import { describe, expect, test } from "bun:test";
import { findExercise } from "../src/core/course.ts";
import { grade } from "../src/core/grader.ts";
import { basicCourseFiles, courseJson, exerciseJson, scratchCourse } from "./helpers.ts";

const stdoutCourse = (id: string): Record<string, string> => {
  const files = basicCourseFiles(id, ["l1-e01"]);
  files["content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json"] = exerciseJson({
    id: "l1-e01",
    observe: [
      { kind: "exit", as: "exit" },
      { kind: "stdout", as: "out" },
    ],
    judge: [
      { on: "exit", match: "equals", value: 0 },
      { on: "out", match: "exact", value: "hi\n" },
    ],
  });
  files["content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh"] = "echo hi\n";
  return files;
};

const stdinCourse = (): Record<string, string> => {
  const files = basicCourseFiles("stdin", ["l1-e01"]);
  files["content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json"] = exerciseJson({
    id: "l1-e01",
    stdin: "world\n",
    observe: [
      { kind: "exit", as: "exit" },
      { kind: "stdout", as: "out" },
    ],
    judge: [
      { on: "exit", match: "equals", value: 0 },
      { on: "out", match: "contains", value: "Hello, world" },
    ],
  });
  files["content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh"] = "read -r name\necho \"Hello, $name\"\n";
  return files;
};

const buildFailCourse = (): Record<string, string> => {
  const files = basicCourseFiles("buildfail", ["l1-e01"]);
  files["content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json"] = exerciseJson({
    id: "l1-e01",
    files: [
      { path: "main.sh", text: "echo hi\n", editable: true },
      { path: "fixtures/fakecc.sh", text: "echo 'main.sh:1: error: boom' >&2\nexit 1\n" },
    ],
    recipe: { build: [["bash", "fixtures/fakecc.sh"]] },
    observe: [
      { kind: "exit", as: "exit" },
      { kind: "stderr", as: "err" },
    ],
    judge: [
      { on: "exit", match: "equals", value: 1 },
      { on: "err", match: "contains", value: "boom" },
    ],
    diagnostics: [
      {
        when: "build",
        parse: "regex",
        pattern: "^(?<file>[^:]+):(?<line>\\d+): (?<severity>error|warning): (?<message>.+)$",
        flags: "gm",
      },
    ],
  });
  files["content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh"] = "echo hi\n";
  return files;
};

const pythonArtifactCourse = (): Record<string, string> => ({
  "course.json": courseJson({
    id: "pyartifact",
    ext: "py",
    envs: { python: { cacheKey: "py-v1", probe: ["python3", "--version"], network: "off" } },
    exercises: ["l1-e01"],
  }),
  "content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json": exerciseJson({
    id: "l1-e01",
    env: "python",
    files: [{ path: "main.py", text: "print('todo')\n", editable: true }],
    recipe: { run: [["python3", "{src}"]] },
    observe: [
      { kind: "exit", as: "exit" },
      { kind: "exists", path: "result.txt", as: "exists" },
      { kind: "file", path: "result.txt", as: "result" },
    ],
    judge: [
      { on: "exit", match: "equals", value: 0 },
      { on: "exists", match: "equals", value: true },
      { on: "result", match: "contains", value: "sum=12" },
    ],
  }),
  "content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.py": "open('result.txt', 'w').write('sum=12\\n')\n",
  "content/l1/chapters/c1/sections/s1/slides/01.md": "# pyartifact\n\n本文です。\n",
});

const hasPython = Bun.spawnSync(["python3", "--version"]).exitCode === 0;

describe("grader: build -> run -> observe -> judge", () => {
  test("合格するコードは合格", async () => {
    const { ctx, course } = await scratchCourse(stdoutCourse("exact"), "exact");
    const entry = findExercise(course, "l1-e01");
    const result = await grade(ctx, course, entry, { code: "echo hi\n" });
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.checks.every((check) => check.ok)).toBe(true);
    expect(result.attemptDir).toBeUndefined();
  });

  test("不合格の理由を判定ごとに返す", async () => {
    const { ctx, course } = await scratchCourse(stdoutCourse("mismatch"), "mismatch");
    const entry = findExercise(course, "l1-e01");
    const result = await grade(ctx, course, entry, { code: "echo hello\n" });
    expect(result.ok).toBe(false);
    expect(result.checks.filter((check) => !check.ok).map((check) => check.name)).toEqual(["out"]);
  });

  test("標準入力が run に渡る", async () => {
    const { ctx, course } = await scratchCourse(stdinCourse(), "stdin");
    const entry = findExercise(course, "l1-e01");
    const result = await grade(ctx, course, entry, { code: "read -r name\necho \"Hello, $name\"\n" });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("Hello, world");
  });

  test("build が失敗したら run は走らない", async () => {
    const { ctx, course } = await scratchCourse(buildFailCourse(), "buildfail");
    const entry = findExercise(course, "l1-e01");
    const result = await grade(ctx, course, entry, { solution: true });
    expect(result.ok).toBe(true);
    expect(result.phases.build?.exitCode).toBe(1);
    expect(result.phases.run).toBeUndefined();
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0].severity).toBe("error");
    expect(result.diagnostics[0].file).toBe("main.sh");
    expect(result.diagnostics[0].line).toBe(1);
  });

  test.skipIf(!hasPython)("成果物ファイルを観測して採点できる（Python）", async () => {
    const { ctx, course } = await scratchCourse(pythonArtifactCourse(), "pyartifact");
    const entry = findExercise(course, "l1-e01");
    const result = await grade(ctx, course, entry, { solution: true });
    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual(["exit", "exists", "result"]);
  });

  test("keep 指定で試行ディレクトリが残る", async () => {
    const { ctx, course } = await scratchCourse(stdoutCourse("keep"), "keep");
    const entry = findExercise(course, "l1-e01");
    const result = await grade(ctx, course, entry, { code: "echo hi\n", keep: true });
    expect(result.attemptDir).toBeString();
    expect(await Bun.file(result.attemptDir + "/main.sh").text()).toContain("echo hi");
  });
});
