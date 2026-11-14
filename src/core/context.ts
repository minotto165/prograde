import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** 実行に必要なディレクトリの束。既定は ~/.prograde 配下。 */
export interface Ctx {
  root: string;
  /** コース置き場（既定 tracks/）。 */
  coursesDir: string;
  /** 永続状態（既定 state/）。 */
  stateDir: string;
  /** 作業コピー（既定 work/）。 */
  workDir: string;
  /** 環境キャッシュ（既定 state/cache/）。 */
  cacheDir: string;
  /** ロック（既定 state/locks/）。 */
  lockDir: string;
}

export interface CtxOptions {
  root?: string;
  coursesDir?: string;
  stateDir?: string;
  workDir?: string;
  cacheDir?: string;
}

/** データの既定ルート。PROGRADE_ROOT があればそれ、無ければ ~/.prograde。 */
export function defaultDataRoot(): string {
  return process.env.PROGRADE_ROOT ?? join(homedir(), ".prograde");
}

export function createCtx(options: CtxOptions = {}): Ctx {
  const root = resolve(options.root ?? defaultDataRoot());
  const stateDir = resolve(root, options.stateDir ?? "state");
  return {
    root,
    coursesDir: resolve(root, options.coursesDir ?? "tracks"),
    stateDir,
    workDir: resolve(root, options.workDir ?? "work"),
    cacheDir: resolve(root, options.cacheDir ?? join(stateDir, "cache")),
    lockDir: join(stateDir, "locks"),
  };
}
