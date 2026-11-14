import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadCourse } from "../src/core/course.ts";
import { lint } from "../src/core/lint.ts";
import { createCtx } from "../src/core/context.ts";
import { UserError } from "../src/core/errors.ts";
import {
  basicCourseFiles,
  repoRoot,
  scratchCourse,
  tempRoot,
  withSlides,
  writeCourse,
} from "./helpers.ts";

describe("slides: ページ送り教材の受け入れ", () => {
  test("NN.md を番号順に読み、最初の見出しをタイトルにする", async () => {
    const files = basicCourseFiles("slides", ["l1-e01"]);
    files["content/l1/slides/02-b.md"] = "# 二枚目\n\n二枚目の本文\n";
    files["content/l1/slides/01-a.md"] = "# 一枚目\n\n一枚目の本文\n";
    const { course } = await scratchCourse(files, "slides");
    const lesson = course.lessons[0];
    expect(lesson.slides.map((slide) => slide.id)).toEqual(["01", "02"]);
    expect(lesson.slides.map((slide) => slide.title)).toEqual(["一枚目", "二枚目"]);
    expect(lesson.slides.map((slide) => slide.relPath)).toEqual(["slides/01-a.md", "slides/02-b.md"]);
    expect(lesson.slides.map((slide) => slide.index)).toEqual([1, 2]);
  });

  test("lesson.md は 1 枚のスライドとして読む", async () => {
    const files = basicCourseFiles("legacy", ["l1-e01"]);
    files["content/l1/lesson.md"] = "# 旧形式\n\n本文です\n";
    const { course } = await scratchCourse(files, "legacy");
    expect(course.lessons[0].slides).toHaveLength(1);
    expect(course.lessons[0].slides[0].relPath).toBe("lesson.md");
    expect(course.lessons[0].slides[0].title).toBe("旧形式");
  });

  test("lesson.md と slides/ の併用は拒否する", async () => {
    const files = withSlides(basicCourseFiles("both", ["l1-e01"]), "l1", ["# a"]);
    files["content/l1/lesson.md"] = "# old\n";
    await expect(scratchCourse(files, "both")).rejects.toThrow(/同時に使えません/);
  });

  test("slides/ に .md が無ければ拒否する", async () => {
    const files = basicCourseFiles("empty-dir", ["l1-e01"]);
    files["content/l1/slides/README.txt"] = "not a slide";
    await expect(scratchCourse(files, "empty-dir")).rejects.toThrow(/スライドがありません/);
  });

  test("ファイル名が NN.md / NN-名前.md でなければ拒否する", async () => {
    const files = basicCourseFiles("bad-name", ["l1-e01"]);
    files["content/l1/slides/1.md"] = "# a";
    await expect(scratchCourse(files, "bad-name")).rejects.toThrow(/ファイル名が不正/);
  });

  test("スライド番号の重複を拒否する", async () => {
    const files = basicCourseFiles("dup", ["l1-e01"]);
    files["content/l1/slides/01-a.md"] = "# a";
    files["content/l1/slides/01-b.md"] = "# b";
    await expect(scratchCourse(files, "dup")).rejects.toThrow(/番号が重複/);
  });

  test("本文が空のレッスン・スライドを lint が報告する", async () => {
    const noDoc = await scratchCourse(basicCourseFiles("no-doc", ["l1-e01"]), "no-doc");
    const noDocReport = await lint(noDoc.ctx, noDoc.course, { dynamic: false });
    expect(noDocReport.errors.some((error) => error.includes("レッスン本文が空です: l1"))).toBe(true);

    const emptySlide = await scratchCourse(
      withSlides(basicCourseFiles("empty-slide", ["l1-e01"]), "l1", ["", "# 二枚目\n\n本文"]),
      "empty-slide",
    );
    const emptySlideReport = await lint(emptySlide.ctx, emptySlide.course, { dynamic: false });
    expect(emptySlideReport.errors.some((error) => error.includes("スライドが空です: l1"))).toBe(true);
  });

  test("コース読み込みは UserError を投げる", async () => {
    const root = await tempRoot();
    await writeCourse(root, "bad", {
      ...basicCourseFiles("bad", ["l1-e01"]),
      "content/l1/slides/1.md": "# a",
    });
    const ctx = createCtx({ root });
    await expect(loadCourse(ctx, "bad")).rejects.toBeInstanceOf(UserError);
  });
});

type CliResult = { exitCode: number | null; stdout: string; stderr: string };

function runCli(root: string, args: string[]): CliResult {
  const result = Bun.spawnSync({
    cmd: [process.execPath, join(repoRoot, "bin/prograde.ts"), "--root", root, ...args],
    cwd: repoRoot,
    env: { ...process.env, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

describe("slides: CLI", () => {
  async function slideCourse(): Promise<{ root: string }> {
    const root = await tempRoot();
    const files = withSlides(basicCourseFiles("cli", ["l1-e01"]), "l1", [
      "# 一枚目\n\n一枚目の本文",
      "# 二枚目\n\n二枚目の本文",
      "# 三枚目\n\n三枚目の本文",
    ]);
    await writeCourse(root, "cli", files);
    return { root };
  }

  test("--slide で 1 枚だけ表示する", async () => {
    const { root } = await slideCourse();
    const result = runCli(root, ["lesson", "l1", "--slide", "2"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# 二枚目");
    expect(result.stdout).not.toContain("# 一枚目");
    expect(result.stdout).not.toContain("スライド 2/3");
  });

  test("--json は全スライドを構造で返す", async () => {
    const { root } = await slideCourse();
    const result = runCli(root, ["--json", "lesson", "l1"]);
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.lessonId).toBe("l1");
    expect(data.slides).toHaveLength(3);
    expect(data.slides[1].index).toBe(2);
    expect(data.slides[1].title).toBe("二枚目");
    expect(data.exercises.map((entry: { id: string }) => entry.id)).toEqual(["l1-e01"]);
  });

  test("範囲外の --slide は終了コード 2", async () => {
    const { root } = await slideCourse();
    const result = runCli(root, ["lesson", "l1", "--slide", "9"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("1〜3 の整数");
  });

  test("--slide と --json は併用できない", async () => {
    const { root } = await slideCourse();
    const result = runCli(root, ["--json", "lesson", "l1", "--slide", "1"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("同時に指定できません");
  });

  test("スライド無しで --slide は終了コード 2", async () => {
    const root = await tempRoot();
    await writeCourse(root, "no-slides", basicCourseFiles("no-slides", ["l1-e01"]));
    const result = runCli(root, ["lesson", "l1", "--slide", "1"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("スライドがありません");
  });
});
