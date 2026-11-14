import { describe, expect, test } from "bun:test";
import { gradeQuiz } from "../src/core/quiz.ts";
import { QuizSchema } from "../src/schema/index.ts";

const quiz = QuizSchema.parse({
  questions: [
    {
      id: "q1",
      prompt: "1つ選ぶ",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      answers: ["a"],
    },
    {
      id: "q2",
      prompt: "2つ選ぶ",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
        { id: "c", text: "C" },
      ],
      answers: ["a", "c"],
      multiple: true,
    },
  ],
});

describe("quiz: 集合として採点する", () => {
  test("全問正解", () => {
    const result = gradeQuiz(quiz, new Map([["q1", ["a"]], ["q2", ["a", "c"]]]));
    expect(result.ok).toBe(true);
    expect(result.failed).toBe(0);
    expect(result.results.map((item) => item.id)).toEqual(["q1", "q2"]);
  });

  test("選択肢の順序には依存しない", () => {
    const result = gradeQuiz(quiz, new Map([["q1", ["a"]], ["q2", ["c", "a"]]]));
    expect(result.ok).toBe(true);
  });

  test("複数選択の部分点は不合格", () => {
    const result = gradeQuiz(quiz, new Map([["q1", ["a"]], ["q2", ["a"]]]));
    expect(result.ok).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.results[1].ok).toBe(false);
    expect(result.results[1].answers).toEqual(["a", "c"]);
  });

  test("未回答は不正解として数える", () => {
    const result = gradeQuiz(quiz, new Map());
    expect(result.ok).toBe(false);
    expect(result.failed).toBe(2);
    expect(result.results[0].selected).toEqual([]);
  });

  test("余分な選択は不正解", () => {
    const result = gradeQuiz(quiz, new Map([["q1", ["a", "b"]], ["q2", ["a", "c"]]]));
    expect(result.ok).toBe(false);
    expect(result.results[0].ok).toBe(false);
  });
});
