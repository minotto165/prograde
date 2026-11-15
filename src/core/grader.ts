import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { Ctx } from "./context.ts";
import type { LoadedCourse, ExerciseEntry } from "./course.ts";
import { observeAliases } from "./course/observe.ts";
import { ensureEnv } from "./env.ts";
import { prepareAttempt } from "./attempt.ts";
import { planExercise } from "./plan.ts";
import { evaluate, type Check, type Observations } from "./judge.ts";
import { exec, type ExecResult } from "./runner.ts";
import { parseJsonl, parseRegex, type Diagnostic } from "./errors.ts";
import { removeDir } from "./fsx.ts";

export interface PhaseSummary {
  commands: number;
  exitCode: number | null;
  timedOut: boolean;
  ms: number;
}

export interface GradeResult {
  ok: boolean;
  courseId: string;
  exerciseId: string;
  title: string;
  env: string;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  truncated: boolean;
  checks: Check[];
  diagnostics: Diagnostic[];
  phases: { build: PhaseSummary | null; run?: PhaseSummary | null };
  attemptDir?: string;
  message: string;
}

export interface GradeOptions {
  /** 提出コード（編集ファイルが1つのとき）。 */
  code?: string;
  /** 編集ファイルの内容（複数ファイル対応）。 */
  files?: Record<string, string>;
  /** solution/ を敷いて採点する（selftest 用）。 */
  solution?: boolean;
  /** 使い捨てディレクトリを残す。 */
  keep?: boolean;
  /** 作業コピーを重ねず、雛形のまま採点する（lint 用）。 */
  fresh?: boolean;
}

function summarize(results: ExecResult[]): PhaseSummary | null {
  if (results.length === 0) return null;
  const last = results[results.length - 1];
  return {
    commands: results.length,
    exitCode: last.exitCode,
    timedOut: last.timedOut,
    ms: results.reduce((sum, result) => sum + result.ms, 0),
  };
}

async function readMaybe(path: string, maxBytes?: number): Promise<string | null> {
  try {
    const buffer = await readFile(path);
    const slice = maxBytes !== undefined ? buffer.subarray(0, maxBytes) : buffer;
    return slice.toString("utf8");
  } catch {
    return null;
  }
}

function dedupe(list: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const item of list) {
    const key = [item.file ?? "", item.line ?? "", item.column ?? "", item.message].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function grade(
  ctx: Ctx,
  course: LoadedCourse,
  entry: ExerciseEntry,
  options: GradeOptions = {},
): Promise<GradeResult> {
  const started = performance.now();
  const spec = entry.spec;
  const envSpec = course.spec.envs[spec.env];
  const env = await ensureEnv(ctx, course.id, course.dir, spec.env, envSpec);

  const attempt = await prepareAttempt(ctx, entry, {
    code: options.code,
    files: options.files,
    solution: options.solution,
    keep: options.keep,
    fresh: options.fresh,
  });

  const src = attempt.editablePaths.length > 0 ? join(attempt.dir, attempt.editablePaths[0]) : attempt.dir;
  const plan = planExercise(spec, {
    root: ctx.root,
    course: course.id,
    courseDir: course.dir,
    work: attempt.dir,
    cache: env.dir,
    src,
    ext: course.spec.ext,
  }, attempt.editablePaths);

  let stdin = spec.stdin ?? "";
  if (spec.stdinFile) {
    stdin = (await readMaybe(join(entry.dir, spec.stdinFile))) ?? "";
  }

  const buildResults: ExecResult[] = [];
  const runResults: ExecResult[] = [];
  const timeoutMs = env.limits.timeoutMs ?? 15_000;

  for (const step of plan.build) {
    const result = await exec(step.argv, {
      cwd: attempt.dir,
      env: env.vars,
      pathPrepend: env.path,
      timeoutMs,
    });
    buildResults.push(result);
    if (result.exitCode !== 0 || result.timedOut) break;
  }

  const buildFailed = buildResults.some((result) => result.exitCode !== 0 || result.timedOut);
  if (!buildFailed) {
    for (const step of plan.run) {
      const result = await exec(step.argv, {
        cwd: attempt.dir,
        env: env.vars,
        pathPrepend: env.path,
        stdin: stdin.length > 0 ? stdin : undefined,
        timeoutMs,
      });
      runResults.push(result);
      if (result.exitCode !== 0 || result.timedOut) break;
    }
  }

  const all = [...buildResults, ...runResults];
  const final = all.length > 0 ? all[all.length - 1] : null;

  const observations: Observations = new Map();
  for (const [alias, observe] of observeAliases(spec)) {
    switch (observe.kind) {
      case "exit":
        observations.set(alias, { observe, value: final ? final.exitCode : null });
        break;
      case "stdout": {
        const value = final ? final.stdout : "";
        observations.set(alias, {
          observe,
          value: observe.maxBytes ? value.slice(0, observe.maxBytes) : value,
        });
        break;
      }
      case "stderr": {
        const value = final ? final.stderr : "";
        observations.set(alias, {
          observe,
          value: observe.maxBytes ? value.slice(0, observe.maxBytes) : value,
        });
        break;
      }
      case "file": {
        const value = await readMaybe(join(attempt.dir, observe.path), observe.maxBytes);
        observations.set(alias, { observe, value });
        break;
      }
      case "exists":
        observations.set(alias, {
          observe,
          value: (await readMaybe(join(attempt.dir, observe.path))) !== null,
        });
        break;
    }
  }

  const checks = evaluate(spec, observations);

  const diagnostics: Diagnostic[] = [];
  for (const diagnostic of spec.diagnostics) {
    const phaseResults =
      diagnostic.when === "build" ? buildResults : diagnostic.when === "run" ? runResults : [];
    if (phaseResults.length === 0) continue;
    const last = phaseResults[phaseResults.length - 1];
    if (last.exitCode === 0 && !last.timedOut) continue;
    const text = last.stdout + last.stderr;
    diagnostics.push(
      ...(diagnostic.parse === "regex"
        ? parseRegex(diagnostic, text, diagnostic.when)
        : parseJsonl(diagnostic, text, diagnostic.when)),
    );
  }

  const ok = checks.every((check) => check.ok);
  const durationMs = Math.round(performance.now() - started);

  if (!options.keep) {
    await removeDir(attempt.dir).catch(() => {});
  }

  const message = ok
    ? "✓ " + entry.id + " " + spec.title
    : timedOutMessage(final) ??
      "✗ " + entry.id + " " + spec.title + "（" + checks.filter((check) => !check.ok).length + " 件の不一致）";

  return {
    ok,
    courseId: course.id,
    exerciseId: entry.id,
    title: spec.title,
    env: spec.env,
    durationMs,
    exitCode: final ? final.exitCode : null,
    timedOut: final?.timedOut ?? false,
    stdout: final?.stdout ?? "",
    stderr: final?.stderr ?? "",
    truncated: final?.truncated ?? false,
    checks,
    diagnostics: dedupe(diagnostics),
    phases: { build: summarize(buildResults), run: runResults.length > 0 ? summarize(runResults) : undefined },
    attemptDir: options.keep ? attempt.dir : undefined,
    message,
  };
}

function timedOutMessage(final: ExecResult | null): string | null {
  return final?.timedOut ? "✗ 時間切れ（timeout）" : null;
}
