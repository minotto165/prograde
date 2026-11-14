import { mkdir, open, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expandHome } from "./fsx.ts";

export interface ExecOptions {
  cwd: string;
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs?: number;
  pathPrepend?: string[];
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  ms: number;
}

const MAX_CAPTURE = 64 * 1024;

/**
 * コマンドを実行する。stdout/stderr は cwd 配下のログファイルへ fd で流し、
 * 終了後に先頭 64KB だけ読む（無限出力で固まらないため）。
 * timeout は自前タイマーで SIGKILL（本機に GNU timeout が無い）。
 */
export async function exec(cmd: string[], opts: ExecOptions): Promise<ExecResult> {
  if (cmd.length === 0) throw new Error("exec: コマンドが空です");

  const started = performance.now();
  await mkdir(opts.cwd, { recursive: true });

  const outPath = join(opts.cwd, ".prograde-out.log");
  const errPath = join(opts.cwd, ".prograde-err.log");
  const outHandle = await open(outPath, "w");
  const errHandle = await open(errPath, "w");

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  Object.assign(env, opts.env ?? {});
  if (opts.pathPrepend && opts.pathPrepend.length > 0) {
    const prefix = opts.pathPrepend.map((p) => expandHome(p)).join(":");
    env.PATH = env.PATH ? prefix + ":" + env.PATH : prefix;
  }

  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    env,
    stdin: opts.stdin === undefined ? "ignore" : new TextEncoder().encode(opts.stdin),
    stdout: outHandle.fd,
    stderr: errHandle.fd,
  });

  let timedOut = false;
  const timer =
    opts.timeoutMs && opts.timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          try {
            proc.kill("SIGKILL");
          } catch {
            // すでに終了している
          }
        }, opts.timeoutMs)
      : null;

  let exitCode: number | null = null;
  try {
    exitCode = await proc.exited;
  } finally {
    if (timer) clearTimeout(timer);
    await outHandle.close().catch(() => {});
    await errHandle.close().catch(() => {});
  }

  const [outInfo, errInfo] = await Promise.all([stat(outPath), stat(errPath)]);
  const truncated = outInfo.size > MAX_CAPTURE || errInfo.size > MAX_CAPTURE;
  const [stdout, stderr] = await Promise.all([
    readHead(outPath, MAX_CAPTURE),
    readHead(errPath, MAX_CAPTURE),
  ]);

  return {
    exitCode,
    stdout,
    stderr,
    timedOut,
    truncated,
    ms: Math.round(performance.now() - started),
  };
}

async function readHead(path: string, limit: number): Promise<string> {
  const buf = await readFile(path);
  return buf.subarray(0, limit).toString("utf8");
}

export function stripAnsi(s: string): string {
  // CSI シーケンス + OSC シーケンス
  return s
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*\u0007/g, "");
}
