import type { Quiz } from "../schema/index.ts";

export interface QuizQuestionResult {
  id: string;
  ok: boolean;
  selected: string[];
  answers: string[];
}

export interface QuizResult {
  ok: boolean;
  failed: number;
  results: QuizQuestionResult[];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** クイズの採点。選択肢の順序には依存せず、集合として比べる。 */
export function gradeQuiz(quiz: Quiz, selected: Map<string, string[]>): QuizResult {
  const results: QuizQuestionResult[] = [];
  let failed = 0;
  for (const question of quiz.questions) {
    const chosen = selected.get(question.id) ?? [];
    const ok = sameSet(chosen, question.answers);
    if (!ok) failed += 1;
    results.push({ id: question.id, ok, selected: chosen, answers: question.answers });
  }
  return { ok: failed === 0, failed, results };
}
