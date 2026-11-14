import { z } from "zod";
import { mkdir, readFile, rename, unlink, open, stat, cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

function describeZodIssues(path: string, error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return where + ": " + issue.message;
  });
  return path + ": " + issues.join(" / ");
}

export async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new Error(path + ": 読み込めません (" + (err as Error).message + ")");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(path + ": JSON として不正です (" + (err as Error).message + ")");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error(describeZodIssues(path, result.error));
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

export interface LockOptions {
  timeoutMs?: number;
  staleMs?: number;
  pollMs?: number;
}

/**
 * ファイルロック。open(path, "wx") が成功したら保持者。
 * staleMs を超えたロックは「死んでいる」とみなして削除して再試行する。
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
      await handle.writeFile(String(process.pid));
      await handle.close();
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;

      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > staleMs) {
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

/** src の中身を dest に上書きコピーする（dest/src-name ではなく中身を展開する）。 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  for await (const entry of new Bun.Glob("**/*").scan({ cwd: src, onlyFiles: true })) {
    const from = join(src, entry);
    const to = join(dest, entry);
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to, { force: true });
  }
}
