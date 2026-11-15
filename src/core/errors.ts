/**
 * 診断（コンパイラ・リンタ・実行時エラー）を「データ」として読む。
 *
 * 本体が知っているのは regex と jsonl の2形式だけ。
 * どの言語のどのツールかはコース側の設定が決める。
 */

export type Severity = "error" | "warning" | "note";

export interface Diagnostic {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: Severity;
  code?: string;
  message: string;
  phase: "provision" | "build" | "run";
  raw?: string;
}

/** ユーザーにそのまま見せるエラー。exitCode で終了コードを決める。 */
export class UserError extends Error {
  constructor(
    message: string,
    readonly exitCode: number = 2,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** 教材データが壊れている（exit 2。Web では 500）。 */
export class DataError extends UserError {
  constructor(message: string) {
    super(message, 2);
    this.name = "DataError";
  }
}

/** コース・レッスン・演習などが見つからない（exit 2。Web では 404）。 */
export class NotFoundError extends UserError {
  constructor(message: string) {
    super(message, 2);
    this.name = "NotFoundError";
  }
}

/** 環境が用意できなかった（exit 3）。 */
export class EnvError extends UserError {
  constructor(
    message: string,
    readonly remediation?: string,
  ) {
    super(message, 3);
    this.name = "EnvError";
  }
}

export function getPointer(value: unknown, pointer: string): unknown {
  if (pointer === "" || pointer === "/") return pointer === "" ? value : undefined;
  if (!pointer.startsWith("/")) return undefined;
  let current: unknown = value;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else if (current !== null && typeof current === "object") {
      if (!(token in (current as Record<string, unknown>))) return undefined;
      current = (current as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }
  return current;
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function asSeverity(value: unknown): Severity {
  const text = asText(value).toLowerCase();
  if (text === "warning" || text === "warn") return "warning";
  if (text === "note" || text === "info" || text === "help") return "note";
  return "error";
}

export interface RegexSpec {
  when: "provision" | "build" | "run";
  parse: "regex";
  pattern: string;
  flags?: string;
}

export interface JsonlSpec {
  when: "provision" | "build" | "run";
  parse: "jsonl";
  filter?: { pointer: string; equals: unknown };
  map: Record<string, string>;
}

export function parseRegex(spec: RegexSpec, text: string, phase: "provision" | "build" | "run"): Diagnostic[] {
  let re: RegExp;
  try {
    re = new RegExp(spec.pattern, spec.flags ?? "gm");
  } catch (err) {
    throw new UserError("診断パターンが不正です: " + (err as Error).message);
  }

  const out: Diagnostic[] = [];
  for (const match of text.matchAll(re)) {
    const groups = (match.groups ?? {}) as Record<string, string | undefined>;
    const message = groups.message ?? match[0];
    if (!message.trim()) continue;
    out.push({
      file: groups.file,
      line: asNumber(groups.line),
      column: asNumber(groups.column),
      endLine: asNumber(groups.endLine),
      endColumn: asNumber(groups.endColumn),
      severity: asSeverity(groups.severity),
      code: groups.code,
      message: message.trim(),
      phase,
      raw: match[0],
    });
  }
  return out;
}

export function parseJsonl(spec: JsonlSpec, text: string, phase: "provision" | "build" | "run"): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (spec.filter && !deepEqual(getPointer(parsed, spec.filter.pointer), spec.filter.equals)) continue;
    const field = (key: string): unknown => {
      const pointer = spec.map[key];
      return pointer === undefined ? undefined : getPointer(parsed, pointer);
    };
    const message = asText(field("message"));
    if (!message) continue;
    out.push({
      file: asText(field("file")) || undefined,
      line: asNumber(field("line")),
      column: asNumber(field("column")),
      endLine: asNumber(field("endLine")),
      endColumn: asNumber(field("endColumn")),
      severity: asSeverity(field("severity")),
      code: asText(field("code")) || undefined,
      message,
      phase,
      raw: trimmed,
    });
  }
  return out;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length || !ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

export function formatDiagnostics(list: Diagnostic[], limit = 10): string {
  const shown = list.slice(0, limit);
  const lines = shown.map((d) => {
    const where = d.file
      ? d.file + (d.line !== undefined ? ":" + d.line : "") + (d.column !== undefined ? ":" + d.column : "")
      : "";
    const code = d.code ? " [" + d.code + "]" : "";
    return (d.severity === "error" ? "✗ " : d.severity === "warning" ? "! " : "· ") +
      (where ? where + ": " : "") + d.message + code;
  });
  if (list.length > shown.length) lines.push("… 他 " + (list.length - shown.length) + " 件");
  return lines.join("\n");
}
