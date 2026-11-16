import { z } from "zod";
import { mkdir, readFile, rename, unlink, open, stat, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir, hostname } from "node:os";
import { randomBytes } from "node:crypto";
import { isSafeRelativePath } from "../schema/paths.ts";
import { DataError, UserError } from "./errors.ts";

export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

function describeZodIssues(path: string, error: z.ZodError): string {
  return path + ":\n" + z.prettifyError(error);
}

export async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new DataError(path + ": 読み込めません (" + (err as Error).message + ")");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new DataError(path + ": JSON として不正です (" + (err as Error).message + ")");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) throw new DataError(describeZodIssues(path, result.error));
  return result.data;
}

export async function readJsonIfExists<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    await stat(path);
  } catch {
    return null;
  }
  return readJson(path, schema);
}

/** tmp に書いてから rename（同一ディレクトリ内なので原子的）。 */
export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + "." + process.pid + "." + randomBytes(4).toString("hex") + ".tmp";
  await Bun.write(tmp, JSON.stringify(value, null, 2) + "\n");
  await rename(tmp, path);
}

/** base の外に出ない相対パスだけを join する。 */
export function safeJoin(base: string, rel: string, label = "path"): string {
  if (!isSafeRelativePath(rel)) {
    throw new UserError(label + " が不正です（相対パスで、.. を含まない必要があります）: " + rel);
  }
  return join(base, rel);
}

interface LockOwner {
  pid: number;
  host: string;
  at: string;
}

function sameHostProcessAlive(owner: LockOwner): boolean | null {
  if (owner.host !== hostname()) return null;
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readLockOwner(lockPath: string, statMs: number): Promise<LockOwner | null> {
  try {
    const raw = await readFile(lockPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LockOwner>;
    if (
      typeof parsed.pid === "number" &&
      Number.isInteger(parsed.pid) &&
      parsed.pid > 0 &&
      typeof parsed.host === "string" &&
      typeof parsed.at === "string"
    ) {
      return { pid: parsed.pid, host: parsed.host, at: parsed.at };
    }
  } catch {
    // 旧形式（pid だけ）や書き込み途中。mtime で判断する。
  }
  return { pid: 0, host: "", at: new Date(statMs).toISOString() };
}

export interface LockOptions {
  timeoutMs?: number;
  staleMs?: number;
  pollMs?: number;
}

/**
 * ファイルロック。open(path, "wx") が成功したら保持者。
 *
 * 保持者が同じホストの生存プロセスなら、古く見えても奪わない。
 * プロセスが死んでいるか、別ホストのロックが staleMs を超えたときだけ削除する。
 */
export async function withLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
  opts: LockOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const staleMs = opts.staleMs ?? 30000;
  const pollMs = opts.pollMs ?? 25;
  const started = Date.now();

  await mkdir(dirname(lockPath), { recursive: true });

  for (;;) {
    try {
      const handle = await open(lockPath, "wx");
      const owner: LockOwner = { pid: process.pid, host: hostname(), at: new Date().toISOString() };
      await handle.writeFile(JSON.stringify(owner));
      await handle.close();
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;

      try {
        const info = await stat(lockPath);
        const owner = await readLockOwner(lockPath, info.mtimeMs);
        const alive = owner ? sameHostProcessAlive(owner) : null;
        const expired = Date.now() - info.mtimeMs > staleMs;
        if (alive === false || (alive === null && expired)) {
          // stat してから削除するまでの間に別プロセスが取り直している可能性がある。
          // inode が変わっていたら、その新しいロックには触らない。
          const current = await stat(lockPath).catch(() => null);
          if (!current || current.ino !== info.ino || current.mtimeMs !== info.mtimeMs) continue;
          await unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        // lock が消えた: そのまま再試行
        continue;
      }

      if (Date.now() - started > timeoutMs) {
        throw new Error(lockPath + ": ロックを取得できませんでした (" + timeoutMs + "ms タイムアウト)");
      }
      await Bun.sleep(pollMs);
    }
  }

  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => {});
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

