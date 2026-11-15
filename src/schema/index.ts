import { z } from "zod";

/**
 * v2 スキーマ。
 *
 * 方針: 本体は言語・環境を知らない。ここに現れるのは
 * 「コマンド列」「観測点」「判定」「診断の読み方」という汎用の語彙だけ。
 */

// ---------------------------------------------------------------------------
// コマンド
// ---------------------------------------------------------------------------

/** argv（要素は1つ以上の文字列）。 */
export const CommandSchema = z.array(z.string().min(1)).min(1);

/** 順に実行するコマンド列。 */
export const CommandsSchema = z.array(CommandSchema);

// ---------------------------------------------------------------------------
// 環境（コース側が持つ）
// ---------------------------------------------------------------------------

export const LimitsSchema = z.object({
  timeoutMs: z.number().int().positive().optional(),
  memoryMb: z.number().int().positive().optional(),
});

export const EnvSchema = z.object({
  /** 一度だけ実行する用意（rustup / npm ci / docker build など中身は問わない）。 */
  provision: CommandsSchema.optional(),
  /** provision 結果の同一性。変われば用意し直す。 */
  cacheKey: z.string().default("default"),
  /** 用意できたかの確認。失敗したら exit 3。 */
  probe: CommandSchema.optional(),
  /** PATH の先頭に足す（{cache} などのプレースホルダ可）。 */
  path: z.array(z.string()).default([]),
  /** 追加の環境変数。 */
  env: z.record(z.string(), z.string()).default({}),
  /** "off" のとき PROGRADE_NETWORK=off を渡す（強制ではなく宣言）。 */
  network: z.enum(["on", "off"]).default("off"),
  limits: LimitsSchema.default({}),
  /** 不足時に案内するコース内のファイル（例 "env/README.md"）。 */
  remediation: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 演習
// ---------------------------------------------------------------------------

export const FileSpecSchema = z.object({
  /** 作業ディレクトリ内の相対パス。 */
  path: z.string().min(1),
  /** 雛形のコピー元（演習ディレクトリ相対）。省略時は text を使う。 */
  from: z.string().optional(),
  /** インラインの雛形。 */
  text: z.string().optional(),
  /** 学習者が編集するファイルか。 */
  editable: z.boolean().default(false),
});

export const RecipeSchema = z.object({
  build: CommandsSchema.optional(),
  run: CommandsSchema.optional(),
});

export const ObserveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exit"), as: z.string().optional() }),
  z.object({
    kind: z.literal("stdout"),
    as: z.string().optional(),
    maxBytes: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("stderr"),
    as: z.string().optional(),
    maxBytes: z.number().int().positive().optional(),
  }),
  z.object({
    kind: z.literal("file"),
    path: z.string().min(1),
    as: z.string().optional(),
    maxBytes: z.number().int().positive().optional(),
  }),
  z.object({ kind: z.literal("exists"), path: z.string().min(1), as: z.string().optional() }),
]);

export const JudgeSchema = z.discriminatedUnion("match", [
  z.object({
    on: z.string().min(1),
    match: z.literal("exact"),
    value: z.string(),
    label: z.string().optional(),
  }),
  z.object({
    on: z.string().min(1),
    match: z.literal("contains"),
    value: z.string(),
    label: z.string().optional(),
  }),
  z.object({
    on: z.string().min(1),
    match: z.literal("regex"),
    value: z.string(),
    flags: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({
    on: z.string().min(1),
    match: z.literal("equals"),
    value: z.unknown(),
    label: z.string().optional(),
  }),
  z.object({
    on: z.string().min(1),
    match: z.literal("json"),
    pointer: z.string().default(""),
    value: z.unknown(),
    label: z.string().optional(),
  }),
  z.object({
    on: z.string().min(1),
    match: z.literal("count"),
    value: z.number().int(),
    label: z.string().optional(),
  }),
]);

/** regex: 名前付きグループ file/line/column/endLine/endColumn/severity/code/message */
export const DiagRegexSchema = z.object({
  when: z.enum(["provision", "build", "run"]).default("build"),
  parse: z.literal("regex"),
  pattern: z.string().min(1),
  flags: z.string().optional(),
});

/** jsonl: 1行1JSON。map は フィールド → JSON Pointer。 */
export const DiagJsonlSchema = z.object({
  when: z.enum(["provision", "build", "run"]).default("build"),
  parse: z.literal("jsonl"),
  /** 対象行の絞り込み（例 { pointer: "/reason", equals: "compiler-message" }）。 */
  filter: z
    .object({ pointer: z.string(), equals: z.unknown() })
    .optional(),
  map: z.record(z.string(), z.string()).default({}),
});

export const DiagnosticSpecSchema = z.discriminatedUnion("parse", [
  DiagRegexSchema,
  DiagJsonlSchema,
]);

export const ExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().min(1),
  env: z.string().min(1),
  objective: z.string().optional(),
  files: z.array(FileSpecSchema).min(1),
  recipe: RecipeSchema,
  stdin: z.string().optional(),
  stdinFile: z.string().optional(),
  observe: z.array(ObserveSchema).min(1),
  judge: z.array(JudgeSchema).min(1),
  diagnostics: z.array(DiagnosticSpecSchema).default([]),
  xp: z.number().int().nonnegative().default(10),
  hints: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  starterMayPass: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// コース
// ---------------------------------------------------------------------------

/** 章の中のセクション。1枚以上のスライドと、ちょうど1つの演習を持つ。 */
export const SectionRefSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().min(1),
});

/** 章。複数のセクションをまとめる。 */
export const ChapterRefSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().min(1),
  sections: z.array(SectionRefSchema).min(1),
});

export const LessonRefSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  title: z.string().min(1),
  description: z.string().optional(),
  estimateMin: z.number().int().positive().optional(),
  chapters: z.array(ChapterRefSchema).min(1),
});

export const CourseSchema = z
  .object({
    schema: z.literal(3),
    id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
    label: z.string().min(1),
    ext: z.string().min(1),
    description: z.string().optional(),
    source: z.string().optional(),
    envs: z.record(z.string(), EnvSchema),
    lessons: z.array(LessonRefSchema).min(1),
  })
  .refine((course) => Object.keys(course.envs).length > 0, {
    message: "envs が空です（少なくとも1つの環境が必要）",
  });

export const QuizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const QuizQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(QuizOptionSchema).min(2),
  answers: z.array(z.string().min(1)).min(1),
  multiple: z.boolean().default(false),
  explanation: z.string().optional(),
});

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1),
});

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type Command = z.infer<typeof CommandSchema>;
export type Env = z.infer<typeof EnvSchema>;
export type Limits = z.infer<typeof LimitsSchema>;
export type FileSpec = z.infer<typeof FileSpecSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type Observe = z.infer<typeof ObserveSchema>;
export type Judge = z.infer<typeof JudgeSchema>;
export type DiagnosticSpec = z.infer<typeof DiagnosticSpecSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type SectionRef = z.infer<typeof SectionRefSchema>;
export type ChapterRef = z.infer<typeof ChapterRefSchema>;
export type LessonRef = z.infer<typeof LessonRefSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
