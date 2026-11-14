import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { courseJson, exerciseJson, repoRoot, scratchCourse } from "./helpers.ts";

/** 本体が言語・ツールチェーンを知ってしまったら落ちるテスト。
 *  コース側（tracks/）は自由。本体（src/core, src/cli）は禁止語ゼロ。 */
const BANNED = [
  "rustc", "cargo", "rustup", "go build", "gofmt", "javac", "dotnet", "mvn", "gradle",
  "npm", "pnpm", "yarn", "pip", "poetry", "bundle install", "composer",
  "psql", "sqlite3", "mysql", "docker", "podman", "playwright", "puppeteer",
  "python", "ruby", "node_modules",
];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("no-hardcode: エンジンは言語を知らない", () => {
  test("src/core と src/cli に環境固有の語が無い", async () => {
    const files = [...(await walk(join(repoRoot, "src", "core"))), ...(await walk(join(repoRoot, "src", "cli")))];
    const violations: string[] = [];
    for (const file of files) {
      const text = (await readFile(file, "utf8")).toLowerCase();
      for (const word of BANNED) {
        const at = text.indexOf(word.toLowerCase());
        if (at >= 0) {
          const line = text.slice(0, at).split("\n").length;
          violations.push(file.replace(repoRoot + "/", "") + ":" + line + " -> " + word);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test("コース定義は環境をデータとして持ち、置き場は任意", async () => {
    const { ctx, course } = await scratchCourse(
      {
        "course.json": courseJson({
          id: "env-data",
          envs: { shell: { cacheKey: "v1", probe: ["bash", "-c", "exit 0"], remediation: "SETUP.md" } },
          exercises: ["l1-e01"],
        }),
        "content/l1/ex/l1-e01/exercise.json": exerciseJson({ id: "l1-e01", env: "shell" }),
        "content/l1/ex/l1-e01/solution/main.sh": "echo ok\n",
      },
      "env-data",
    );
    expect(course.spec.envs.shell.probe).toBeArray();
    expect(course.spec.envs.shell.cacheKey).toBeString();
    expect(ctx.coursesDir).toBe(join(ctx.root, "tracks"));
  });
});
