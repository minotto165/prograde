import { describe, expect, test } from "bun:test";
import { UserError } from "../src/core/errors.ts";
import {
  browserCommand,
  detectLanIpv4,
  isLoopbackHost,
  isWildcardHost,
  parsePort,
  resolveWebOrigin,
  type WebInterfaceInfo,
} from "../src/cli/web.ts";

const interfaces: Record<string, WebInterfaceInfo[]> = {
  lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  en0: [
    { address: "fe80::1", family: "IPv6", internal: false },
    { address: "192.168.1.20", family: "IPv4", internal: false },
  ],
  en1: [{ address: "10.0.0.5", family: "IPv4", internal: false }],
  veth0: [{ address: "172.17.0.1", family: "IPv4", internal: false }],
  utun0: [{ address: "100.64.0.1", family: "IPv4", internal: false }],
  en2: [{ address: "169.254.10.2", family: "IPv4", internal: false }],
};

describe("web: LAN の IPv4 を選ぶ", () => {
  test("内部・リンクルローカル・仮想 NIC を除き、en0 を優先する", () => {
    expect(detectLanIpv4(interfaces)).toEqual(["192.168.1.20", "10.0.0.5"]);
  });

  test("同じアドレスは重複させない", () => {
    expect(
      detectLanIpv4({
        en0: [{ address: "192.168.1.20", family: "IPv4", internal: false }],
        en1: [{ address: "192.168.1.20", family: 4, internal: false }],
      }),
    ).toEqual(["192.168.1.20"]);
  });
});

describe("web: ORIGIN の決定", () => {
  test("ループバックはそのホストを使う", () => {
    expect(resolveWebOrigin({ host: "127.0.0.1", port: 4173 }).origin).toBe("http://127.0.0.1:4173");
    expect(resolveWebOrigin({ host: "localhost", port: 4173 }).origin).toBe("http://localhost:4173");
    expect(resolveWebOrigin({ host: "::1", port: 4173 }).origin).toBe("http://[::1]:4173");
  });

  test("0.0.0.0 は mDNS の <hostname>.local を ORIGIN にする", () => {
    const resolved = resolveWebOrigin({
      host: "0.0.0.0",
      port: 4173,
      interfaces,
      hostname: "macbook-pro.local",
      platform: "darwin",
    });
    expect(resolved.origin).toBe("http://macbook-pro.local:4173");
    expect(resolved.lan).toBe(true);
  });

  test(".local が無いホスト名には macOS で .local を付ける", () => {
    const resolved = resolveWebOrigin({
      host: "0.0.0.0",
      port: 4173,
      hostname: "macbook-pro",
      platform: "darwin",
    });
    expect(resolved.origin).toBe("http://macbook-pro.local:4173");
  });

  test("macOS 以外で .local が無ければ LAN の IPv4 に落とす", () => {
    const resolved = resolveWebOrigin({
      host: "0.0.0.0",
      port: 4173,
      interfaces,
      hostname: "linuxbox",
      platform: "linux",
    });
    expect(resolved.origin).toBe("http://192.168.1.20:4173");
  });

  test("特定の非ループバック IP はそのまま使う", () => {
    const resolved = resolveWebOrigin({ host: "10.0.0.5", port: 8080 });
    expect(resolved.origin).toBe("http://10.0.0.5:8080");
    expect(resolved.lan).toBe(true);
  });

  test("--origin は host より優先する（末尾スラッシュは落とす）", () => {
    const resolved = resolveWebOrigin({ host: "0.0.0.0", port: 4173, origin: "https://example.com/" });
    expect(resolved.origin).toBe("https://example.com");
    expect(resolved.lan).toBe(true);
  });

  test("--origin でもループバックなら LAN ではない", () => {
    const resolved = resolveWebOrigin({ host: "127.0.0.1", port: 4173, origin: "https://example.com" });
    expect(resolved.lan).toBe(false);
  });

  test("ネットワークが無くても .local で起動できる", () => {
    const resolved = resolveWebOrigin({
      host: "0.0.0.0",
      port: 4173,
      interfaces: {},
      hostname: "macbook-pro.local",
      platform: "darwin",
    });
    expect(resolved.origin).toBe("http://macbook-pro.local:4173");
  });

  test("ホスト名も LAN も無ければ 127.0.0.1 に落とす", () => {
    const resolved = resolveWebOrigin({
      host: "0.0.0.0",
      port: 4173,
      interfaces: {},
      hostname: "",
      platform: "darwin",
    });
    expect(resolved.origin).toBe("http://127.0.0.1:4173");
  });

  test("origin の scheme・パス・認証情報を検査する", () => {
    expect(() => resolveWebOrigin({ host: "127.0.0.1", port: 4173, origin: "ftp://example.com" })).toThrow(UserError);
    expect(() => resolveWebOrigin({ host: "127.0.0.1", port: 4173, origin: "https://example.com/app" })).toThrow(
      UserError,
    );
    expect(() => resolveWebOrigin({ host: "127.0.0.1", port: 4173, origin: "https://u:p@example.com" })).toThrow(
      UserError,
    );
  });

  test("port は 1-65535 の整数だけ", () => {
    expect(parsePort("4173")).toBe(4173);
    expect(() => parsePort("0")).toThrow(UserError);
    expect(() => parsePort("65536")).toThrow(UserError);
    expect(() => parsePort("abc")).toThrow(UserError);
  });
});

describe("web: 補助関数", () => {
  test("ループバックとワイルドカードの判定", () => {
    expect(isLoopbackHost("127.0.0.2")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("192.168.1.20")).toBe(false);
    expect(isWildcardHost("0.0.0.0")).toBe(true);
    expect(isWildcardHost("[::]")).toBe(true);
    expect(isWildcardHost("127.0.0.1")).toBe(false);
  });

  test("OS ごとのブラウザ起動コマンド", () => {
    expect(browserCommand("darwin", "http://127.0.0.1:4173")).toEqual(["open", "http://127.0.0.1:4173"]);
    expect(browserCommand("linux", "http://127.0.0.1:4173")).toEqual(["xdg-open", "http://127.0.0.1:4173"]);
  });
});
