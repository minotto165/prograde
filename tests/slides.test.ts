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

const section = "content/l1/chapters/c1/sections/s1";
const defaultSlide = section + "/slides/01.md";

describe("slides: セクションのページ送り教材", () => {
  test("NN.md を番号順に読み、最初の見出しをタイトルにする", async () => {
    const files = withSlides(basicCourseFiles("slides", ["l1-e01"]), "l1", [
      "# 一枚目\n\n一枚目の本文\n",
    ]);
    files[section + "/slides/02-b.md"] = "# 二枚目\n\n二枚目の本文\n";
    files[section + "/slides/01-a.md"] = "# 一枚目\n\n一枚目の本文\n";
    delete files[defaultSlide];
    const { course } = await scratchCourse(files, "slides");
    const slides = course.lessons[0].chapters[0].sections[0].slides;
    expect(slides.map((slide) => slide.id)).toEqual(["01", "02"]);
    expect(slides.map((slide) => slide.title)).toEqual(["一枚目", "二枚目"]);
    expect(slides.map((slide) => slide.relPath)).toEqual(["slides/01-a.md", "slides/02-b.md"]);
    expect(slides.map((slide) => slide.index)).toEqual([1, 2]);
  });

  test("セクション直下に余分なファイルがあれば拒否する", async () => {
    const files = basicCourseFiles("extra", ["l1-e01"]);
    files[section + "/lesson.md"] = "# old\n";
    await expect(scratchCourse(files, "extra")).rejects.toThrow(/余分なファイル/);
  });

  test("slides/ に .md 以外があれば拒否する", async () => {
    const files = basicCourseFiles("empty-dir", ["l1-e01"]);
    delete files[defaultSlide];
    files[section + "/slides/README.txt"] = "not a slide";
    await expect(scratchCourse(files, "empty-dir")).rejects.toThrow(/スライド以外/);
  });

  test("ファイル名が NN.md / NN-名前.md でなければ拒否する", async () => {
    const files = basicCourseFiles("bad-name", ["l1-e01"]);
    files[section + "/slides/1.md"] = "# a";
    await expect(scratchCourse(files, "bad-name")).rejects.toThrow(/ファイル名が不正/);
  });

  test("スライド番号の重複を拒否する", async () => {
    const files = basicCourseFiles("dup", ["l1-e01"]);
    files[section + "/slides/01-a.md"] = "# a";
    files[section + "/slides/01-b.md"] = "# b";
    await expect(scratchCourse(files, "dup")).rejects.toThrow(/番号が重複/);
  });

  test("本文が空のスライドを lint が報告する", async () => {
    const emptySlide = await scratchCourse(
      withSlides(basicCourseFiles("empty-slide", ["l1-e01"]), "l1", ["", "# 二枚目\n\n本文"]),
      "empty-slide",
    );
    const report = await lint(emptySlide.ctx, emptySlide.course, { dynamic: false });
    expect(report.errors.some((error) => error.includes("スライドが空です"))).toBe(true);
  });

  test("コース読み込みは UserError を投げる", async () => {
    const root = await tempRoot();
    const files = basicCourseFiles("bad", ["l1-e01"]);
    files[section + "/slides/1.md"] = "# a";
    await writeCourse(root, "bad", files);
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
    for (const name of ["02.md", "03.md"]) {
      if (name === "02.md") {
        files[section + "/slides/02.md"] = "# 二枚目\n\n二枚目の本文";
      } else {
        files[section + "/slides/03.md"] = "# 三枚目\n\n三枚目の本文";
      }
    }
    delete files[defaultSlide];
    files[section + "/slides/01.md"] = "# 一枚目\n\n一枚目の本文";
    await writeCourse(root, "cli", files);
    return { root };
  }

  test("--slide で 1 枚だけ表示する", async () => {
    const { root } = await slideCourse();
    const result = runCli(root, ["lesson", "l1", "--slide", "2"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# 二枚目");
    expect(result.stdout).not.toContain("# 一枚目");
  });

  test("--json は章・セクション・スライドを構造で返す", async () => {
    const { root } = await slideCourse();
    const result = runCli(root, ["--json", "lesson", "l1"]);
    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.lessonId).toBe("l1");
    const slides = data.chapters[0].sections[0].slides;
    expect(slides).toHaveLength(3);
    expect(slides[1].index).toBe(2);
    expect(slides[1].title).toBe("二枚目");
    expect(data.chapters[0].sections[0].exercise.id).toBe("l1-e01");
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
    const files = basicCourseFiles("no-slides", ["l1-e01"]);
    delete files[defaultSlide];
    await writeCourse(root, "no-slides", files);
    const result = runCli(root, ["lesson", "l1", "--slide", "1"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("スライド");
  });
});
