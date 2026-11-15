import { readProgress, recordAttempt, recordReset } from "../../../../src/core/progress.ts";
import { ensureWorkspace, resetWorkspace, writeWorkspace } from "../../../../src/core/attempt.ts";
import { grade, type GradeResult } from "../../../../src/core/grader.ts";
import { readEditable, collectFiles } from "./files.ts";
import { loadEntry } from "./queries.ts";
import type { FileView } from "./view.ts";

export interface SubmitOutcome {
  kind: "grade" | "run" | "reset";
  result: GradeResult | null;
  files: FileView[];
  solved: boolean;
  message?: string;
}

export async function submit(courseId: string, exerciseId: string, form: FormData): Promise<SubmitOutcome> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  const files = collectFiles(form, entry);
  await writeWorkspace(ctx, entry, files);
  const result = await grade(ctx, course, entry, { files });
  await recordAttempt(ctx, course, entry, { ok: result.ok, durationMs: result.durationMs });
  const { progress } = await readProgress(ctx, course);
  return {
    kind: "grade",
    result,
    files: await readEditable(await ensureWorkspace(ctx, entry), entry),
    solved: progress.exercises[entry.id]?.solved ?? false,
  };
}

export async function run(courseId: string, exerciseId: string, form: FormData): Promise<SubmitOutcome> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  const files = collectFiles(form, entry);
  await writeWorkspace(ctx, entry, files);
  const result = await grade(ctx, course, entry, { files });
  return {
    kind: "run",
    result,
    files: await readEditable(await ensureWorkspace(ctx, entry), entry),
    solved: false,
  };
}

export async function reset(courseId: string, exerciseId: string): Promise<SubmitOutcome> {
  const { ctx, course, entry } = await loadEntry(courseId, exerciseId);
  await resetWorkspace(ctx, entry);
  await recordReset(ctx, course, entry);
  return { kind: "reset", result: null, files: await readEditable(await ensureWorkspace(ctx, entry), entry), solved: false };
}
