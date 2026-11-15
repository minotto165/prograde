import { describe, expect, test } from "bun:test";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureEnv } from "../src/core/env.ts";
import { EnvError } from "../src/core/errors.ts";
import { courseJson, exerciseJson, scratchCourse } from "./helpers.ts";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("env: 環境の用意はコースの設定だけで決まる", () => {
  test("provision は一度だけ走り、2回目はキャッシュを使う", async () => {
    const { ctx, courseDir, course } = await scratchCourse(
      {
        "course.json": courseJson({
          id: "env-once",
          envs: {
            sh: { cacheKey: "v1", provision: [["bash", "-c", "echo ran >> provision.log"]] },
          },
          exercises: ["l1-e01"],
        }),
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json": exerciseJson({ id: "l1-e01" }),
        "content/l1/chapters/c1/sections/s1/slides/01.md": "# env\n\n本文です。\n",
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh": "echo ok\n",
      },
      "env-once",
    );

    const first = await ensureEnv(ctx, course.id, courseDir, "sh", course.spec.envs.sh!);
    expect(first.provisioned).toBe(true);
    const second = await ensureEnv(ctx, course.id, courseDir, "sh", course.spec.envs.sh!);
    expect(second.provisioned).toBe(false);

    const log = (await readFile(join(courseDir, "provision.log"), "utf8")).trim().split("\n");
    expect(log).toEqual(["ran"]);
    expect(await exists(join(ctx.cacheDir, "env-once", "sh", ".prograde-env.json"))).toBe(true);
  });

  test("cacheKey が変われば作り直す", async () => {
    const { ctx, courseDir, course } = await scratchCourse(
      {
        "course.json": courseJson({
          id: "env-key",
          envs: {
            sh: { cacheKey: "v1", provision: [["bash", "-c", "echo ran >> provision.log"]] },
          },
          exercises: ["l1-e01"],
        }),
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json": exerciseJson({ id: "l1-e01" }),
        "content/l1/chapters/c1/sections/s1/slides/01.md": "# env\n\n本文です。\n",
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh": "echo ok\n",
      },
      "env-key",
    );
    await ensureEnv(ctx, course.id, courseDir, "sh", course.spec.envs.sh!);
    const bumped = { ...course.spec.envs.sh!, cacheKey: "v2" };
    const again = await ensureEnv(ctx, course.id, courseDir, "sh", bumped);
    expect(again.provisioned).toBe(true);
    const log = (await readFile(join(courseDir, "provision.log"), "utf8")).trim().split("\n");
    expect(log.length).toBe(2);
  });

  test("provision の失敗は EnvError(3) で、キャッシュしない", async () => {
    const { ctx, courseDir, course } = await scratchCourse(
      {
        "course.json": courseJson({
          id: "env-fail",
          envs: {
            sh: {
              cacheKey: "v1",
              provision: [["bash", "-c", "echo missing-dep >&2; exit 1"]],
              remediation: "SETUP.md",
            },
          },
          exercises: ["l1-e01"],
        }),
        "SETUP.md": "依存を入れてください\n",
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json": exerciseJson({ id: "l1-e01" }),
        "content/l1/chapters/c1/sections/s1/slides/01.md": "# env\n\n本文です。\n",
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh": "echo ok\n",
      },
      "env-fail",
    );

    let caught: unknown;
    try {
      await ensureEnv(ctx, course.id, courseDir, "sh", course.spec.envs.sh!);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EnvError);
    expect((caught as EnvError).exitCode).toBe(3);
    expect((caught as EnvError).message).toContain("missing-dep");
    expect((caught as EnvError).message).toContain("依存を入れてください");
    expect(await exists(join(ctx.cacheDir, "env-fail", "sh", ".prograde-env.json"))).toBe(false);
  });

  test("probe が失敗すれば既存キャッシュも疑う", async () => {
    const { ctx, courseDir, course } = await scratchCourse(
      {
        "course.json": courseJson({
          id: "env-probe",
          envs: { sh: { cacheKey: "v1", probe: ["bash", "-c", "test -f \"$PROGRADE_COURSE_DIR/allow\""] } },
          exercises: ["l1-e01"],
        }),
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/exercise.json": exerciseJson({ id: "l1-e01" }),
        "content/l1/chapters/c1/sections/s1/slides/01.md": "# env\n\n本文です。\n",
        "content/l1/chapters/c1/sections/s1/ex/l1-e01/solution/main.sh": "echo ok\n",
      },
      "env-probe",
    );
    const allow = join(courseDir, "allow");
    await writeFile(allow, "", "utf8");
    const env = course.spec.envs.sh!;
    const first = await ensureEnv(ctx, course.id, courseDir, "sh", env);
    expect(first.provisioned).toBe(false);

    await rm(allow);
    let caught: unknown;
    try {
      await ensureEnv(ctx, course.id, courseDir, "sh", env);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EnvError);
    expect((caught as EnvError).message).toContain("probe");
  });

});
