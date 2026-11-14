import type { Exercise, Judge, Observe } from "../schema/index.ts";
import { deepEqual, getPointer } from "./errors.ts";

export interface Check {
  name: string;
  ok: boolean;
  expected: string;
  actual: string;
  note?: string;
}

export interface ObservedValue {
  observe: Observe;
  value: string | number | boolean | null;
}

export type Observations = Map<string, ObservedValue>;

function text(value: unknown, limit = 300): string {
  let out: string;
  if (typeof value === "string") out = value;
  else out = JSON.stringify(value) ?? String(value);
  out = out.replace(/\r/g, "\\r").replace(/\n/g, "⏎ ");
  return out.length > limit ? out.slice(0, limit) + "…" : out;
}

function lineCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return String(value)
    .split(/\r?\n/)
    .filter((line) => line.length > 0).length;
}

/** 判定ルールの表示用の説明。見本・チェック一覧はこれを使う。 */
export interface JudgeDescription {
  /** 表示名（label か観測点の別名）。 */
  name: string;
  /** 観測点の別名。 */
  on: string;
  match: Judge["match"];
  /** 期待値の人が読める表現。 */
  expected: string;
}

export function describeJudge(rule: Judge): JudgeDescription {
  const expected =
    rule.match === "json"
      ? "JSON " + (rule.pointer || "(root)") + " = " + text(rule.value)
      : rule.match === "regex"
        ? "/" + rule.value + "/" + (rule.flags ?? "")
        : rule.match === "count"
          ? "行数 = " + rule.value
          : text(rule.value);
  return { name: rule.label ?? rule.on, on: rule.on, match: rule.match, expected };
}

export function judgeOne(rule: Judge, observed: ObservedValue | undefined): Check {
  const { name, expected: expectedText } = describeJudge(rule);

  if (!observed) {
    return { name, ok: false, expected: expectedText, actual: "(観測点なし)", note: "コース定義の不備" };
  }

  const raw = observed.value;
  const asString = typeof raw === "string" ? raw : raw === null ? "" : String(raw);

  switch (rule.match) {
    case "exact": {
      const ok = asString === rule.value;
      const note = !ok
        ? asString.replace(/\r\n/g, "\n") === rule.value.replace(/\r\n/g, "\n")
          ? "改行コードだけが違います"
          : asString.trim() === rule.value.trim()
            ? "末尾の空白・改行だけが違います"
            : undefined
        : undefined;
      return { name, ok, expected: text(rule.value), actual: text(asString), note };
    }
    case "contains": {
      const ok = asString.includes(rule.value);
      return { name, ok, expected: "contains " + text(rule.value), actual: text(asString) };
    }
    case "regex": {
      let ok = false;
      let note: string | undefined;
      try {
        ok = new RegExp(rule.value, rule.flags ?? "").test(asString);
      } catch (err) {
        note = "正規表現が不正です: " + (err as Error).message;
      }
      return { name, ok, expected: expectedText, actual: text(asString), note };
    }
    case "equals": {
      const ok = deepEqual(raw, rule.value);
      return { name, ok, expected: text(rule.value), actual: text(raw) };
    }
    case "json": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(asString);
      } catch {
        return { name, ok: false, expected: expectedText, actual: "JSON として読めません: " + text(asString) };
      }
      const actual = getPointer(parsed, rule.pointer);
      const ok = deepEqual(actual, rule.value);
      return { name, ok, expected: expectedText, actual: text(actual) };
    }
    case "count": {
      const actual = lineCount(raw);
      return { name, ok: actual === rule.value, expected: "行数 = " + rule.value, actual: String(actual) };
    }
  }
}

export function evaluate(exercise: Exercise, observations: Observations): Check[] {
  return exercise.judge.map((rule) => judgeOne(rule, observations.get(rule.on)));
}
