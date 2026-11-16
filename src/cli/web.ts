import { networkInterfaces } from "node:os";
import { isIP } from "node:net";
import { join } from "node:path";
import pc from "picocolors";
import { createCtx } from "../core/context.ts";
import { EnvError, UserError } from "../core/errors.ts";
import { pathExists } from "../core/fsx.ts";

export interface WebInterfaceInfo {
  address: string;
  family: string | number;
  internal: boolean;
}

export interface WebOriginInput {
  host: string;
  port: number;
  origin?: string;
  interfaces?: Record<string, readonly WebInterfaceInfo[] | undefined>;
}

export interface WebOrigin {
  origin: string;
  /** LAN のアドレスを ORIGIN に使ったか。 */
  lan: boolean;
  /** 待ち受けるホスト。 */
  host: string;
}

const PREFERRED_INTERFACES = ["en0", "en1", "eth0", "wlan0"];
const SKIP_INTERFACE = /^(lo|utun|tun|tap|veth|br-|vmnet|vboxnet)/i;

function rankInterface(name: string): number {
  const index = PREFERRED_INTERFACES.indexOf(name);
  return index >= 0 ? index : PREFERRED_INTERFACES.length;
}

function isLinkLocal(address: string): boolean {
  return address.startsWith("169.254.") || address.startsWith("fe80:");
}

/**
 * LAN で使える IPv4 アドレスを、優先度の高い順に返す。
 *
 * ループバック・リンクルローカル・仮想 NIC は除く。en0 などを先にし、
 * 同じ優先度ならインターフェース名の順にする。
 */
export function detectLanIpv4(
  interfaces: Record<string, readonly WebInterfaceInfo[] | undefined> = networkInterfaces(),
): string[] {
  const found: { address: string; rank: number; name: string }[] = [];
  for (const name of Object.keys(interfaces).sort()) {
    if (SKIP_INTERFACE.test(name)) continue;
    for (const info of interfaces[name] ?? []) {
      if (info.internal) continue;
      if (info.family !== "IPv4" && info.family !== 4) continue;
      if (info.address === "0.0.0.0" || isLinkLocal(info.address)) continue;
      found.push({ address: info.address, rank: rankInterface(name), name });
    }
  }
  found.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return [...new Set(found.map((item) => item.address))];
}

export function isLoopbackHost(host: string): boolean {
  const value = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return value === "localhost" || value.endsWith(".localhost") || value === "::1" || /^127\./.test(value);
}

export function isWildcardHost(host: string): boolean {
  const value = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return value === "" || value === "0.0.0.0" || value === "::";
}

function urlHost(host: string): string {
  return isIP(host) === 6 ? "[" + host + "]" : host;
}

function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UserError("--origin が URL として不正です: " + value);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserError("--origin は http:// か https:// で始めてください: " + value);
  }
  if (url.username || url.password) throw new UserError("--origin にユーザー情報は指定できません: " + value);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new UserError("--origin には scheme とホストとポートだけを指定してください: " + value);
  }
  return url.origin;
}

export function parsePort(value: string | number): number {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new UserError("--port は 1 から 65535 の整数で指定してください: " + String(value));
  }
  return port;
}

/**
 * SvelteKit の ORIGIN を決める。
 *
 * ループバックならそのホスト、0.0.0.0 / :: なら LAN の IPv4 を選ぶ。
 * --origin が指定されたらそれを優先する。Host ヘッダーからは推測しない
 * （DNS リバインディングで任意のドメインを受け入れてしまうため）。
 */
export function resolveWebOrigin(input: WebOriginInput): WebOrigin {
  const host = input.host.trim();
  const port = parsePort(input.port);
  if (input.origin) return { origin: normalizeOrigin(input.origin), lan: false, host };

  if (!isWildcardHost(host)) {
    const origin = "http://" + urlHost(host) + ":" + port;
    return { origin: normalizeOrigin(origin), lan: !isLoopbackHost(host), host };
  }

  const candidates = detectLanIpv4(input.interfaces);
  if (candidates.length === 0) {
    throw new UserError(
      "LAN の IPv4 アドレスが見つかりません。--origin http://<ホスト>:<ポート> で公開 URL を指定してください",
    );
  }
  const address = candidates[0];
  return { origin: "http://" + address + ":" + port, lan: true, host };
}

/** ブラウザを開くコマンド。テストできるように純粋関数にしている。 */
export function browserCommand(platform: NodeJS.Platform, url: string): string[] {
  if (platform === "darwin") return ["open", url];
  if (platform === "win32") return ["cmd", "/c", "start", "", url];
  return ["xdg-open", url];
}

function openBrowser(url: string): void {
  try {
    const child = Bun.spawn(browserCommand(process.platform, url), {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    void child.exited.catch(() => {});
  } catch (err) {
    console.error(pc.yellow("ブラウザを開けませんでした: " + (err as Error).message));
  }
}

export interface WebOptions {
  host: string;
  port: number;
  origin?: string;
  root?: string;
  open?: boolean;
}

/** web/build/index.js を子プロセスで起動し、終了コードを返す。 */
export async function runWeb(options: WebOptions): Promise<number> {
  const ctx = createCtx({ root: options.root });
  const webDir = join(import.meta.dir, "../../web");
  const entry = join(webDir, "build/index.js");
  if (!(await pathExists(entry))) {
    throw new EnvError(
      "Web がビルドされていません。先に cd web && bun run build を実行してください (" + entry + ")",
    );
  }

  const resolved = resolveWebOrigin({ host: options.host, port: options.port, origin: options.origin });
  const port = String(parsePort(options.port));
  console.log(pc.dim("prograde web"));
  console.log("  " + pc.cyan(resolved.origin));
  console.log("  " + pc.dim("データ: " + ctx.root));
  if (resolved.lan && !options.origin) {
    console.log("  " + pc.yellow("LAN に公開しています。認証はないので、信頼できるネットワークだけで使ってください。"));
    console.log("  " + pc.dim("localhost からはフォームを送信できません（ORIGIN が LAN のアドレスのため）。"));
  }
  console.log("  " + pc.dim("停止: Ctrl+C"));

  let child: Bun.Subprocess<"inherit", "inherit", "inherit">;
  try {
    child = Bun.spawn([process.execPath, entry], {
      cwd: webDir,
      env: {
        ...process.env,
        HOST: resolved.host,
        PORT: port,
        ORIGIN: resolved.origin,
        PROGRADE_ROOT: ctx.root,
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch (err) {
    throw new EnvError("Web を起動できませんでした: " + (err as Error).message);
  }

  if (options.open) openBrowser(resolved.origin);

  let signalExitCode: number | null = null;
  const stop = (signal: NodeJS.Signals) => {
    if (signalExitCode !== null) return;
    signalExitCode = signal === "SIGINT" ? 130 : 143;
    child.kill(signal);
  };
  const onSigint = () => stop("SIGINT");
  const onSigterm = () => stop("SIGTERM");
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  try {
    const code = await child.exited;
    return signalExitCode ?? (code ?? 1);
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }
}
