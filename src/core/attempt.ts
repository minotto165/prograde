import { join, dirname } from "node:path";
import { mkdir, cp, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { Exercise, FileSpec } from "../schema/index.ts";
import { UserError } from "./errors.ts";
import { pathExists, removeDir, safeJoin } from "./fsx.ts";
import type { Ctx } from "./context.ts";
import type { ExerciseEntry } from "./course.ts";

export function editableFiles(spec: Exercise): FileSpec[] {
  return spec.files.filter((file) => file.editable);
}

async function materializeFile(entry: ExerciseEntry, dir: string, file: FileSpec): Promise<void> {
  const target = safeJoin(dir, file.path, entry.id + ": files.path");
  await mkdir(dirname(target), { recursive: true });
  if (file.from) {
    const source = safeJoin(entry.dir, file.from, entry.id + ": files.from");
    if (!(await pathExists(source))) {
      throw new UserError(entry.id + ": 雛形が見つかりません: " + file.from);
    }
    await cp(source, target, { force: true });
  } else if (file.text !== undefined) {
    await writeFile(target, file.text, "utf8");
  } else {
    throw new UserError(entry.id + ": files[] に from か text が必要です: " + file.path);
  }
}

/** 演習の雛形（と任意で差し替え）を作業ディレクトリに展開する。 */
export async function materialize(
  entry: ExerciseEntry,
  dir: string,
  options: { code?: string; solution?: boolean; files?: Record<string, string> } = {},
): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const editablePaths: string[] = [];

  for (const file of entry.spec.files) {
    await materializeFile(entry, dir, file);
    if (file.editable) editablePaths.push(file.path);
  }

  if (options.files && Object.keys(options.files).length > 0) {
    for (const [path, text] of Object.entries(options.files)) {
      if (!editablePaths.includes(path)) {
        throw new UserError(entry.id + ": 編集できないファイルです: " + path);
      }
      const target = safeJoin(dir, path, entry.id + ": files");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, text, "utf8");
    }
  }

  if (options.solution) {
    for (const path of editablePaths) {
      const source = safeJoin(join(entry.dir, "solution"), path, entry.id + ": solution");
      if (!(await pathExists(source))) {
        throw new UserError(entry.id + ": 解答が見つかりません: solution/" + path);
      }
      const target = safeJoin(dir, path, entry.id + ": files");
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target, { force: true });
    }
  } else if (options.code !== undefined) {
    if (editablePaths.length !== 1) {
      throw new UserError(
        entry.id + ": 編集ファイルが " + editablePaths.length + " 個あるため --code を使えません。--files で提出してください。",
      );
    }
    await writeFile(safeJoin(dir, editablePaths[0], entry.id + ": files"), options.code, "utf8");
  }

  return editablePaths;
}

export interface AttemptInfo {
  dir: string;
  editablePaths: string[];
}

/**
 * 採点用の使い捨てディレクトリを作る。
 * 雛形を敷いた上に、作業コピーの編集ファイルを重ねる（code / solution 指定時はそちらが優先）。
 */
export async function prepareAttempt(
  ctx: Ctx,
  entry: ExerciseEntry,
  options: { code?: string; solution?: boolean; keep?: boolean; fresh?: boolean; files?: Record<string, string> } = {},
): Promise<AttemptInfo> {
  const workspace = join(ctx.workDir, entry.courseId, entry.id);
  await ensureWorkspace(ctx, entry);

  const dir = join(workspace, ".attempts", Date.now().toString(36) + "-" + randomBytes(3).toString("hex"));
  await removeDir(dir);
  const editablePaths = await materialize(entry, dir, {
    code: options.code,
    solution: options.solution,
    files: options.files,
  });

  if (options.code === undefined && options.files === undefined && !options.solution && !options.fresh) {
    for (const path of editablePaths) {
      const from = join(workspace, path);
      if (await pathExists(from)) {
        const to = join(dir, path);
        await mkdir(dirname(to), { recursive: true });
        await cp(from, to, { force: true });
      }
    }
  }

  return { dir, editablePaths };
}

/**
 * 作業コピーを用意する。既存の編集は壊さず、欠けているファイルだけ雛形から補う。
 * 以前はマーカーが無いと workspace ごと削除していたため、GET で編集が消えることがあった。
 */
export async function ensureWorkspace(ctx: Ctx, entry: ExerciseEntry): Promise<string> {
  const workspace = join(ctx.workDir, entry.courseId, entry.id);
  await mkdir(workspace, { recursive: true });
  for (const file of entry.spec.files) {
    const target = safeJoin(workspace, file.path, entry.id + ": files.path");
    if (!(await pathExists(target))) await materializeFile(entry, workspace, file);
  }
  const starter = join(workspace, ".prograde-workspace");
  if (!(await pathExists(starter))) {
    await writeFile(starter, entry.spec.env + "\n", "utf8");
  }
  return workspace;
}

/** 編集ファイルを作業コピーに保存する（次に開いたときの続きから）。 */
export async function writeWorkspace(
  ctx: Ctx,
  entry: ExerciseEntry,
  files: Record<string, string>,
): Promise<string> {
  const workspace = await ensureWorkspace(ctx, entry);
  const editable = editableFiles(entry.spec).map((file) => file.path);
  for (const [path, text] of Object.entries(files)) {
    if (!editable.includes(path)) {
      throw new UserError(entry.id + ": 編集できないファイルです: " + path);
    }
    const target = safeJoin(workspace, path, entry.id + ": files");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text, "utf8");
  }
  return workspace;
}

/** 作業コピーを雛形に戻す。 */
export async function resetWorkspace(ctx: Ctx, entry: ExerciseEntry): Promise<string> {
  const workspace = join(ctx.workDir, entry.courseId, entry.id);
  await removeDir(workspace);
  await materialize(entry, workspace);
  await writeFile(join(workspace, ".prograde-workspace"), entry.spec.env + "\n", "utf8");
  return workspace;
}
