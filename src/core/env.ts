import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { z } from "zod";
import type { Ctx } from "./context.ts";
import type { Env, Limits } from "../schema/index.ts";
import { exec, type ExecResult } from "./runner.ts";
import { expand, type PlanVars } from "./plan.ts";
import { pathExists, readJsonIfExists, readTextIfExists, withLock, writeJsonAtomic } from "./fsx.ts";
import { EnvError } from "./errors.ts";

const MarkerSchema = z.object({
  schema: z.literal(1),
  cacheKey: z.string(),
  at: z.string(),
  ok: z.literal(true),
});

export interface ResolvedEnv {
  name: string;
  dir: string;
  cacheKey: string;
  limits: Limits;
  vars: Record<string, string>;
  path: string[];
  network: "on" | "off";
  remediation?: string;
  /** 実際に provision を走らせたか（キャッシュヒットなら false）。 */
  provisioned: boolean;
  provisionError?: ExecResult;
}

const DEFAULT_RUN_TIMEOUT = 15_000;
const DEFAULT_PROVISION_TIMEOUT = 300_000;

function baseVars(ctx: Ctx, courseId: string, courseDir: string, envDir: string, envName: string): PlanVars {
  return {
    root: ctx.root,
    course: courseId,
    courseDir,
    work: ctx.workDir,
    cache: envDir,
    src: "",
    ext: "",
  };
}

/** 環境を用意する（一度だけ provision し、state/cache/<course>/<env>/ に残す）。 */
export async function ensureEnv(
  ctx: Ctx,
  courseId: string,
  courseDir: string,
  envName: string,
  env: Env,
): Promise<ResolvedEnv> {
  const envDir = join(ctx.cacheDir, courseId, envName);
  const markerPath = join(envDir, ".prograde-env.json");
  const vars = baseVars(ctx, courseId, courseDir, envDir, envName);
  const extraVars: Record<string, string> = {
    PROGRADE: "1",
    PROGRADE_COURSE: courseId,
    PROGRADE_ENV: envName,
    PROGRADE_NETWORK: env.network,
    PROGRADE_CACHE: envDir,
    PROGRADE_COURSE_DIR: courseDir,
  };
  for (const [key, value] of Object.entries(env.env)) extraVars[key] = expand(value, vars);
  if (env.limits.memoryMb !== undefined) {
    extraVars.PROGRADE_MEMORY_MB = String(env.limits.memoryMb);
  }

  const path = env.path.map((entry) => expand(entry, vars));
  const resolved: ResolvedEnv = {
    name: envName,
    dir: envDir,
    cacheKey: env.cacheKey,
    limits: env.limits,
    vars: extraVars,
    path,
    network: env.network,
    remediation: env.remediation,
    provisioned: false,
  };

  const timeoutMs = env.limits.timeoutMs ?? DEFAULT_RUN_TIMEOUT;

  const cached = await readJsonIfExists(markerPath, MarkerSchema);
  if (cached && cached.cacheKey === env.cacheKey) {
    if (env.probe) {
      const probe = await exec(env.probe, {
        cwd: envDir,
        env: extraVars,
        pathPrepend: path,
        timeoutMs,
      });
      if (probe.exitCode !== 0 || probe.timedOut) {
        throw await envFailure(ctx, courseId, envName, env, courseDir, probe, "probe に失敗しました");
      }
    }
    return resolved;
  }

  if (!(await pathExists(courseDir))) {
    throw new EnvError("コースのディレクトリがありません: " + courseDir);
  }
  await mkdir(envDir, { recursive: true });

  await withLock(join(ctx.lockDir, "env-" + courseId + "-" + envName + ".lock"), async () => {
    const again = await readJsonIfExists(markerPath, MarkerSchema);
    if (again && again.cacheKey === env.cacheKey) return;

    if (env.provision && env.provision.length > 0) {
      for (const argv of env.provision) {
        const result = await exec(argv, {
          cwd: courseDir,
          env: extraVars,
          pathPrepend: path,
          timeoutMs: Math.max(timeoutMs, DEFAULT_PROVISION_TIMEOUT),
        });
        if (result.exitCode !== 0 || result.timedOut) {
          throw await envFailure(ctx, courseId, envName, env, courseDir, result, "provision に失敗しました");
        }
      }
      resolved.provisioned = true;
    }

    if (env.probe) {
      const probe = await exec(env.probe, {
        cwd: envDir,
        env: extraVars,
        pathPrepend: path,
        timeoutMs: Math.max(timeoutMs, 30_000),
      });
      if (probe.exitCode !== 0 || probe.timedOut) {
        throw await envFailure(ctx, courseId, envName, env, courseDir, probe, "probe に失敗しました");
      }
    }

    await writeJsonAtomic(markerPath, {
      schema: 1,
      cacheKey: env.cacheKey,
      at: new Date().toISOString(),
      ok: true,
    });
  });

  return resolved;
}

async function envFailure(
  ctx: Ctx,
  courseId: string,
  envName: string,
  env: Env,
  courseDir: string,
  result: ExecResult,
  what: string,
): Promise<EnvError> {
  const head = (result.stdout + result.stderr).trim().split(/\r?\n/).slice(-20).join("\n");
  let remediation: string | undefined;
  if (env.remediation) {
    const path = join(courseDir, env.remediation);
    if (await pathExists(path)) remediation = (await readTextIfExists(path)) ?? undefined;
  }
  const lines = [
    "環境を用意できませんでした: " + courseId + "/" + envName + "（" + what + "）",
    env.provision && env.provision.length > 0
      ? "実行したコマンド: " + JSON.stringify(env.provision[env.provision.length - 1])
      : null,
    head ? "--- 出力（末尾）---\n" + head : null,
    remediation ? "--- 手当て（" + env.remediation + "）---\n" + remediation.trim() : null,
    "ヒント: 環境はコース側の設定（course.json の envs）が持っています。",
  ].filter((line): line is string => line !== null);
  return new EnvError(lines.join("\n"), env.remediation);
}
