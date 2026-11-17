import { describe, expect, test } from "bun:test";
import { findExercise, listCourses, observeAliases, resolveCourseId } from "../src/core/course.ts";
import { UserError } from "../src/core/errors.ts";
import { basicCourseFiles, courseJson, exerciseJson, scratchCourse, tempCtx, writeCourse } from "./helpers.ts";

describe("course: データだけでコースを読む", () => {
  test("複数のコースを一覧できる", async () => {
    const ctx = await tempCtx();
    await writeCourse(ctx.root, "alpha", basicCourseFiles("alpha", ["l1-e01", "l1-e02"]));
    await writeCourse(ctx.root, "beta", basicCourseFiles("beta", ["l1-e01"]));
    const courses = await listCourses(ctx);
    expect(courses.map((course) => course.id)).toEqual(["alpha", "beta"]);
    expect(courses.find((course) => course.id === "alpha")?.exercises).toBe(2);
  });

  test("演習は環境と観測点を持つ", async () => {
    const { course } = await scratchCourse(basicCourseFiles("env", ["l1-e01", "l1-e02"]), "env");
    expect(course.exercises.map((entry) => entry.id)).toEqual(["l1-e01", "l1-e02"]);
    const entry = findExercise(course, "l1-e01");
    expect(entry.spec.env).toBe("sh");
    expect(entry.lessonId).toBe("l1");
    expect(entry.spec.judge[0].on).toBe("exit");
  });

  test("観測点の別名は既定則に従う", async () => {
    const files = basicCourseFiles("aliases", ["l1-e01"]);
    files["content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json"] = exerciseJson({
      id: "l1-e01",
      observe: [
        { kind: "exit", as: "exit" },
        { kind: "exists", path: "result.txt", as: "exists" },
        { kind: "file", path: "result.txt", as: "result" },
      ],
      judge: [{ on: "exit", match: "equals", value: 0 }],
    });
    const { course } = await scratchCourse(files, "aliases");
    const entry = findExercise(course, "l1-e01");
    const aliases = observeAliases(entry.spec);
    expect([...aliases.keys()]).toEqual(["exit", "exists", "result"]);
    expect(aliases.get("result")?.kind).toBe("file");
  });

  test("休止中のクイズは読み込みを拒否する", async () => {
    const files = basicCourseFiles("quiz-off", ["l1-e01"]);
    files["content/l1/quiz.json"] = JSON.stringify({
      questions: [
        {
          id: "q1",
          prompt: "どれ？",
          options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
          answers: ["a"],
        },
      ],
    });
    await expect(scratchCourse(files, "quiz-off")).rejects.toThrow(/休止中/);
  });

  test("コースが2つあるときは指定を要求する", async () => {
    const ctx = await tempCtx();
    await writeCourse(ctx.root, "alpha", basicCourseFiles("alpha", ["l1-e01"]));
    await writeCourse(ctx.root, "beta", basicCourseFiles("beta", ["l1-e01"]));
    await expect(resolveCourseId(ctx, undefined)).rejects.toBeInstanceOf(UserError);
    expect(await resolveCourseId(ctx, "alpha")).toBe("alpha");
  });

  test("教材のファイルパスが外へ出る指定は読み込み時に落ちる", async () => {
    const files = basicCourseFiles("escape", ["l1-e01"]);
    files["content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json"] = exerciseJson({
      id: "l1-e01",
      files: [{ path: "../escape.sh", text: "echo bad\n", editable: true }],
    });
    await expect(scratchCourse(files, "escape")).rejects.toThrow(/files\[0\]\.path/);
  });

  test("レッスン・章・セクションをまたいで演習の順序を保つ", async () => {
    const manifest = {
      schema: 3,
      id: "multi",
      label: "multi",
      ext: "sh",
      envs: { sh: {} },
      lessons: [
        {
          id: "l1",
          title: "lesson 1",
          chapters: [
            {
              id: "c1",
              title: "chapter 1",
              sections: [
                { id: "s1", title: "s1" },
                { id: "s2", title: "s2" },
              ],
            },
            {
              id: "c2",
              title: "chapter 2",
              sections: [{ id: "s1", title: "s1" }],
            },
          ],
        },
        {
          id: "l2",
          title: "lesson 2",
          chapters: [{ id: "c1", title: "chapter 1", sections: [{ id: "s1", title: "s1" }] }],
        },
      ],
    };
    const files: Record<string, string> = { "course.json": JSON.stringify(manifest) };
    const placements = [
      ["l1", "c1", "s1", "l1-c1-s1-e01"],
      ["l1", "c1", "s2", "l1-c1-s2-e01"],
      ["l1", "c2", "s1", "l1-c2-s1-e01"],
      ["l2", "c1", "s1", "l2-c1-s1-e01"],
    ] as const;
    for (const [lesson, chapter, section, exercise] of placements) {
      const base = "content/" + lesson + "/chapters/" + chapter + "/sections/" + section;
      files[base + "/slides/01.md"] = "# " + exercise + "\n\n本文です。\n";
      files[base + "/ex/" + exercise + "/exercise.json"] = exerciseJson({ id: exercise });
      files[base + "/ex/" + exercise + "/solution/main.sh"] = "echo ok\n";
    }
    const { course } = await scratchCourse(files, "multi");
    expect(course.exercises.map((entry) => entry.id)).toEqual(placements.map((item) => item[3]));
    expect(course.sectionByExercise.get("l1-c2-s1-e01")?.ref.id).toBe("s1");
  });

  test("存在しない環境を参照した演習は読み込み時に落ちる", async () => {
    const files = {
      "course.json": courseJson({ id: "bad-env", envs: { sh: { cacheKey: "v1" } }, exercises: ["l1-e01"] }),
      "content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json": exerciseJson({ id: "l1-e01", title: "t", env: "nope" }),
      "content/l1/chapters/c1/sections/s1/slides/01.md": "# bad-env\n\n本文です。\n",
      "content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh": "echo ok\n",
    };
    await expect(scratchCourse(files, "bad-env")).rejects.toThrow(/nope/);
  });
});
