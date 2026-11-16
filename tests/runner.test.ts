import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exec } from "../src/core/runner.ts";

async function tempCwd(): Promise<string> {
  return mkdtemp(join(tmpdir(), "prograde-runner-"));
}

describe("exec", () => {
  it("stdout を返す", async () => {
    const cwd = await tempCwd();
    const result = await exec(["sh", "-c", "echo hi"], { cwd });
    expect(result.stdout).toBe("hi\n");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it("非0の exit code を返す", async () => {
    const cwd = await tempCwd();
    const result = await exec(["sh", "-c", "exit 3"], { cwd });
    expect(result.exitCode).toBe(3);
  });

  it("stdin を渡せる", async () => {
    const cwd = await tempCwd();
    const result = await exec(["sh", "-c", "cat"], { cwd, stdin: "abc" });
    expect(result.stdout).toBe("abc");
  });

  it("timeout で SIGKILL する", async () => {
    const cwd = await tempCwd();
    const result = await exec(["sh", "-c", "sleep 5"], { cwd, timeoutMs: 200 });
    expect(result.timedOut).toBe(true);
    expect(result.ms).toBeLessThan(3000);
  });

  it("巨大出力を 64KB で truncate する", async () => {
    const cwd = await tempCwd();
    const result = await exec(["sh", "-c", "yes a | head -c 200000"], { cwd });
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBe(64 * 1024);
  });

  it("pathPrepend が PATH の先頭に来る", async () => {
    const cwd = await tempCwd();
    const result = await exec(["sh", "-c", "echo $PATH"], { cwd, pathPrepend: ["/tmp/fakebin"] });
    expect(result.stdout.startsWith("/tmp/fakebin:")).toBe(true);
  });
});

