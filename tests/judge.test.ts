import { describe, expect, test } from "bun:test";
import { describeJudge, judgeOne, evaluate } from "../src/core/judge.ts";
import type { Exercise, Judge, Observe } from "../src/schema/index.ts";

const out: Observe = { kind: "stdout", as: "out" };

function rule(partial: Partial<Judge>): Judge {
  return { on: "out", match: "exact", value: "hi\n", ...partial } as Judge;
}

describe("judge: 判定は観測値だけを見る", () => {
  test("exact は完全一致", () => {
    expect(judgeOne(rule({}), { observe: out, value: "hi\n" }).ok).toBe(true);
    expect(judgeOne(rule({}), { observe: out, value: "hi" }).ok).toBe(false);
  });

  test("exact の失敗には改行・空白の違いを注記する", () => {
    const trailing = judgeOne(rule({}), { observe: out, value: "hi" });
    expect(trailing.note).toContain("空白");
    const crlf = judgeOne(rule({}), { observe: out, value: "hi\r\n" });
    expect(crlf.note).toContain("改行コード");
  });

  test("contains は部分一致", () => {
    expect(judgeOne(rule({ match: "contains", value: "world" }), { observe: out, value: "Hello, world" }).ok).toBe(true);
    expect(judgeOne(rule({ match: "contains", value: "z" }), { observe: out, value: "Hello" }).ok).toBe(false);
  });

  test("regex は flags を見る", () => {
    const pattern = "^v\\d+\\.\\d+\\.\\d+$";
    expect(judgeOne(rule({ match: "regex", value: pattern, flags: "m" }), { observe: out, value: "v1.2.3\n" }).ok).toBe(true);
    expect(judgeOne(rule({ match: "regex", value: pattern }), { observe: out, value: "v1.2.3\n" }).ok).toBe(false);
    const broken = judgeOne(rule({ match: "regex", value: "(" }), { observe: out, value: "x" });
    expect(broken.ok).toBe(false);
    expect(broken.note).toContain("正規表現");
  });

  test("equals は型込みで比較する", () => {
    expect(judgeOne(rule({ match: "equals", value: 0 }), { observe: { kind: "exit", as: "exit" }, value: 0 }).ok).toBe(true);
    expect(judgeOne(rule({ match: "equals", value: 0 }), { observe: { kind: "exit", as: "exit" }, value: "0" }).ok).toBe(false);
  });

  test("json は pointer で取り出す", () => {
    const observed = { observe: out, value: JSON.stringify({ tests: { passed: 3 } }) };
    expect(judgeOne(rule({ match: "json", pointer: "/tests/passed", value: 3 }), observed).ok).toBe(true);
    expect(judgeOne(rule({ match: "json", pointer: "/tests/missing", value: 3 }), observed).ok).toBe(false);
    const notJson = judgeOne(rule({ match: "json", pointer: "/a", value: 1 }), { observe: out, value: "x" });
    expect(notJson.actual).toContain("読めません");
  });

  test("count は空行を除いた行数", () => {
    expect(judgeOne(rule({ match: "count", value: 2 }), { observe: out, value: "a\nb\n\n" }).ok).toBe(true);
    expect(judgeOne(rule({ match: "count", value: 3 }), { observe: out, value: "a\nb\n" }).ok).toBe(false);
  });

  test("観測点が無いときはコース定義の不備として落とす", () => {
    const check = judgeOne(rule({}), undefined);
    expect(check.ok).toBe(false);
    expect(check.note).toContain("定義");
  });

  test("evaluate は judge を順に適用する", () => {
    const exercise = {
      judge: [
        { on: "out", match: "contains", value: "a" },
        { on: "exit", match: "equals", value: 0 },
      ],
    } as unknown as Exercise;
    const observations = new Map([
      ["out", { observe: out, value: "abc" }],
      ["exit", { observe: { kind: "exit", as: "exit" }, value: 1 }],
    ]);
    const checks = evaluate(exercise, observations as unknown as import("../src/core/judge.ts").Observations);
    expect(checks.map((check) => check.ok)).toEqual([true, false]);
  });
});

describe("describeJudge: 見本の表示", () => {
  test("名前・観測点・期待値を返す", () => {
    expect(describeJudge(rule({ match: "count", value: 3, label: "行数" }))).toEqual({
      name: "行数",
      on: "out",
      match: "count",
      expected: "行数 = 3",
    });
    expect(describeJudge(rule({ match: "regex", value: "^a", flags: "m" })).expected).toBe("/^a/m");
    expect(describeJudge(rule({ match: "json", pointer: "/a/b", value: 1 })).expected).toBe("JSON /a/b = 1");
    expect(describeJudge(rule({})).expected).toBe("hi⏎ ");
  });
});
