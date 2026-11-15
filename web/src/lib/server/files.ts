import { join } from "node:path";
import type { ExerciseEntry } from "../../../../src/core/course.ts";
import { editableFiles } from "../../../../src/core/attempt.ts";
import { normalizeNewlines } from "../../../../src/core/text.ts";
import type { FileView } from "./view.ts";

export async function readEditable(workspace: string, entry: ExerciseEntry): Promise<FileView[]> {
  return await Promise.all(
    editableFiles(entry.spec).map(async (file) => {
      const target = join(workspace, file.path);
      const exists = await Bun.file(target).exists();
      const code = exists
        ? await Bun.file(target).text()
        : file.from
          ? await Bun.file(join(entry.dir, file.from)).text()
          : (file.text ?? "");
      return {
        path: file.path,
        code,
        language: file.path.split(".").pop() ?? "text",
      };
    }),
  );
}

export function collectFiles(form: FormData, entry: ExerciseEntry): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of editableFiles(entry.spec)) {
    const value = form.get("file:" + file.path);
    // HTML の textarea は送信時に改行を CRLF にする。シェルスクリプトが壊れるので LF に戻す。
    if (value !== null) files[file.path] = normalizeNewlines(String(value));
  }
  return files;
}
