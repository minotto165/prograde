import type { Exercise } from "../schema/index.ts";
import { UserError } from "./errors.ts";

export interface PlanVars {
  root: string;
  course: string;
  courseDir: string;
  work: string;
  cache: string;
  src: string;
  ext: string;
}

/** 文字列中の {name} を置換する。未知の名前はそのまま残す（コース側の誤りに気づけるように）。 */
export function expand(value: string, vars: PlanVars): string {
  return value.replace(/\{([a-z]+)\}/gi, (whole, name: string) => {
    const key = name as keyof PlanVars;
    return vars[key] !== undefined ? vars[key] : whole;
  });
}

export function expandAll(values: string[], vars: PlanVars): string[] {
  return values.map((value) => expand(value, vars));
}

export interface PlannedStep {
  phase: "build" | "run";
  argv: string[];
}

export interface Plan {
  vars: PlanVars;
  build: PlannedStep[];
  run: PlannedStep[];
  editablePaths: string[];
}

export function planExercise(
  exercise: Exercise,
  vars: PlanVars,
  editablePaths: string[],
): Plan {
  const usesSrc =
    JSON.stringify(exercise.recipe).includes("{src}") ||
    JSON.stringify(exercise.observe).includes("{src}");

  if (usesSrc && editablePaths.length !== 1) {
    throw new UserError(
      exercise.id +
        ": {src} は編集ファイルが1つのときだけ使えます（今は " +
        editablePaths.length +
        " 個）",
    );
  }

  const build = (exercise.recipe.build ?? []).map((argv) => ({
    phase: "build" as const,
    argv: expandAll(argv, vars),
  }));
  const run = (exercise.recipe.run ?? []).map((argv) => ({
    phase: "run" as const,
    argv: expandAll(argv, vars),
  }));

  return { vars, build, run, editablePaths };
}
