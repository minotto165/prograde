import { describe, expect, test } from "bun:test";
import {
  basicCourseFiles,
  courseJson,
  exerciseJson,
  scratchCourse,
  withSlides,
} from "./helpers.ts";

describe("steps: スライドと演習を交互に進める", () => {
  test("steps が無ければ全スライド→全演習の順になる", async () => {
    const files = withSlides(basicCourseFiles("fallback", ["l1-e01", "l1-e02"]), "l1", [
      "# 一枚目\n\n本文",
      "# 二枚目\n\n本文",
    ]);
    const { course } = await scratchCourse(files, "fallback");
    expect(course.lessons[0].steps.map((step) => step.type)).toEqual([
      "slide",
      "slide",
      "exercise",
      "exercise",
    ]);
    expect(course.lessons[0].steps.map((step) => step.index)).toEqual([1, 2, 3, 4]);
  });

  test("steps の順にスライドと演習を解決する", async () => {
    const files = withSlides(basicCourseFiles("ordered", ["l1-e01"]), "l1", [
      "# 一枚目\n\n本文",
      "# 二枚目\n\n本文",
    ]);
    files["course.json"] = courseJson({
      id: "ordered",
      envs: { sh: {} },
      exercises: ["l1-e01"],
      steps: [
        { type: "slide", id: "02" },
        { type: "exercise", id: "l1-e01" },
        { type: "slide", id: "01" },
      ],
    });
    const { course } = await scratchCourse(files, "ordered");
    const steps = course.lessons[0].steps;
    expect(steps.map((step) => step.type)).toEqual(["slide", "exercise", "slide"]);
    expect(steps[0].type === "slide" ? steps[0].slide.title : "").toBe("二枚目");
    expect(steps[1].type === "exercise" ? steps[1].exercise.id : "").toBe("l1-e01");
    expect(steps[2].type === "slide" ? steps[2].slide.title : "").toBe("一枚目");
  });

  test("steps に無いスライド・演習は拒否する", async () => {
    const files = withSlides(basicCourseFiles("unknown", ["l1-e01"]), "l1", ["# 一枚目\n\n本文"]);
    files["course.json"] = courseJson({
      id: "unknown",
      envs: { sh: {} },
      exercises: ["l1-e01"],
      steps: [
        { type: "slide", id: "99" },
        { type: "exercise", id: "l1-e01" },
      ],
    });
    await expect(scratchCourse(files, "unknown")).rejects.toThrow(/無いスライド/);
  });

  test("steps の重複と未収録を拒否する", async () => {
    const files = withSlides(basicCourseFiles("missing", ["l1-e01"]), "l1", ["# 一枚目\n\n本文"]);
    files["course.json"] = courseJson({
      id: "missing",
      envs: { sh: {} },
      exercises: ["l1-e01"],
      steps: [{ type: "slide", id: "01" }],
    });
    await expect(scratchCourse(files, "missing")).rejects.toThrow(/演習が含まれていません/);

    const duplicate = withSlides(basicCourseFiles("duplicate", ["l1-e01"]), "l1", [
      "# 一枚目\n\n本文",
    ]);
    duplicate["course.json"] = courseJson({
      id: "duplicate",
      envs: { sh: {} },
      exercises: ["l1-e01"],
      steps: [
        { type: "slide", id: "01" },
        { type: "exercise", id: "l1-e01" },
        { type: "slide", id: "01" },
      ],
    });
    await expect(scratchCourse(duplicate, "duplicate")).rejects.toThrow(/スライドが重複/);
  });

  test("steps を使っても演習の環境検証は効く", async () => {
    const files = withSlides(basicCourseFiles("bad-env-steps", ["l1-e01"]), "l1", [
      "# 一枚目\n\n本文",
    ]);
    files["content/l1/ex/l1-e01/exercise.json"] = exerciseJson({ id: "l1-e01", env: "nope" });
    files["course.json"] = courseJson({
      id: "bad-env-steps",
      envs: { sh: {} },
      exercises: ["l1-e01"],
      steps: [
        { type: "slide", id: "01" },
        { type: "exercise", id: "l1-e01" },
      ],
    });
    await expect(scratchCourse(files, "bad-env-steps")).rejects.toThrow(/nope/);
  });
});
