import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createCtx, type Ctx } from "../src/core/context.ts";
import { loadCourse, type LoadedCourse } from "../src/core/course.ts";

export const repoRoot = join(import.meta.dir, "..");

export async function tempRoot(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "prograde-test-"));
}

export async function tempCtx(): Promise<Ctx> {
  const root = await tempRoot();
  await mkdir(join(root, "tracks"), { recursive: true });
  return createCtx({ root });
}

/** 一時ルートの tracks/<id> にファイルを書き、コースのディレクトリを返す。 */
export async function writeCourse(root: string, id: string, files: Record<string, string>): Promise<string> {
  const courseDir = join(root, "tracks", id);
  for (const [path, content] of Object.entries(files)) {
    const full = join(courseDir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return courseDir;
}

/** 一時ルートにコースを書き、その Ctx と LoadedCourse を返す。 */
export async function scratchCourse(
  files: Record<string, string>,
  id: string,
): Promise<{ ctx: Ctx; root: string; courseDir: string; course: LoadedCourse }> {
  const root = await tempRoot();
  const courseDir = await writeCourse(root, id, files);
  const ctx = createCtx({ root });
  const course = await loadCourse(ctx, id);
  return { ctx, root, courseDir, course };
}

export function courseJson(input: {
  id: string;
  envs: Record<string, unknown>;
  exercises: string[];
  lessonId?: string;
  ext?: string;
  steps?: { type: "slide" | "exercise"; id: string }[];
}): string {
  return JSON.stringify(
    {
      schema: 2,
      id: input.id,
      label: input.id,
      ext: input.ext ?? "sh",
      envs: input.envs,
      lessons: [
        {
          id: input.lessonId ?? "l1",
          title: "lesson",
          exercises: input.exercises,
          ...(input.steps ? { steps: input.steps } : {}),
        },
      ],
    },
    null,
    2,
  );
}

export function exerciseJson(input: Record<string, unknown>): string {
  return JSON.stringify(
    {
      title: "t",
      env: "sh",
      files: [{ path: "main.sh", text: "echo ok\n", editable: true }],
      recipe: { run: [["bash", "{src}"]] },
      observe: [{ kind: "exit", as: "exit" }],
      judge: [{ on: "exit", match: "equals", value: 0 }],
      xp: 10,
      ...input,
    },
    null,
    2,
  );
}

/** レッスンに slides/NN.md を追加する（配列の順に 01, 02, ...）。 */
export function withSlides(
  files: Record<string, string>,
  lessonId: string,
  slides: string[],
): Record<string, string> {
  const out = { ...files };
  for (const [offset, body] of slides.entries()) {
    out["content/" + lessonId + "/slides/" + String(offset + 1).padStart(2, "0") + ".md"] = body;
  }
  return out;
}

/** 最小構成のコース（1レッスン、指定した演習、シェル環境）。 */
export function basicCourseFiles(id: string, exerciseIds: string[]): Record<string, string> {
  const files: Record<string, string> = {
    "course.json": courseJson({ id, envs: { sh: {} }, exercises: exerciseIds }),
  };
  for (const exerciseId of exerciseIds) {
    files["content/l1/ex/" + exerciseId + "/exercise.json"] = exerciseJson({ id: exerciseId });
    files["content/l1/ex/" + exerciseId + "/solution/main.sh"] = "echo ok\n";
  }
  return files;
}
