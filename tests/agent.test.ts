import { describe, expect, test } from "bun:test";
import {
  agentConfigHint,
  createAgentRuntime,
  isOpenCodeGoBaseUrl,
  readAgentConfig,
} from "../web/src/lib/server/agent/config.ts";
import {
  agentSystemPrompt,
  createAgentTools,
  type AgentExerciseContext,
} from "../web/src/lib/server/agent/tools.ts";

const baseEnv = {
  PROGRADE_AGENT_BASE_URL: "http://127.0.0.1:3000/v1/",
  PROGRADE_AGENT_MODEL: "local-model",
};

describe("agent: 設定", () => {
  test("URL とモデルが揃ったときだけ有効になる", () => {
    expect(readAgentConfig({})).toBeNull();
    expect(readAgentConfig({ PROGRADE_AGENT_BASE_URL: "http://localhost:3000/v1" })).toBeNull();
    expect(readAgentConfig({ PROGRADE_AGENT_MODEL: "m" })).toBeNull();
  });

  test("既定値を埋め、URL 末尾のスラッシュを落とす", () => {
    const config = readAgentConfig(baseEnv);
    expect(config).not.toBeNull();
    expect(config?.baseUrl).toBe("http://127.0.0.1:3000/v1");
    expect(config?.model).toBe("local-model");
    expect(config?.apiKey).toBe("prograde-local");
    expect(config?.contextWindow).toBe(128_000);
    expect(config?.maxTokens).toBe(8_192);
  });

  test("任意の数値とキーを読む", () => {
    const config = readAgentConfig({
      ...baseEnv,
      PROGRADE_AGENT_API_KEY: "secret",
      PROGRADE_AGENT_CONTEXT_WINDOW: "32000",
      PROGRADE_AGENT_MAX_TOKENS: "2048",
    });
    expect(config?.apiKey).toBe("secret");
    expect(config?.contextWindow).toBe(32_000);
    expect(config?.maxTokens).toBe(2_048);
  });

  test("不正な数値は既定値に戻す", () => {
    const config = readAgentConfig({
      ...baseEnv,
      PROGRADE_AGENT_CONTEXT_WINDOW: "0",
      PROGRADE_AGENT_MAX_TOKENS: "nope",
    });
    expect(config?.contextWindow).toBe(128_000);
    expect(config?.maxTokens).toBe(8_192);
  });

  test("未設定の案内に必要な環境変数を出す", () => {
    const hint = agentConfigHint();
    expect(hint).toContain("PROGRADE_AGENT_BASE_URL");
    expect(hint).toContain("PROGRADE_AGENT_MODEL");
  });

  test("OpenCode Go のルート URL を chat completions のベースに補正する", () => {
    const config = readAgentConfig({
      PROGRADE_AGENT_BASE_URL: "https://opencode.ai/inference/go",
      PROGRADE_AGENT_MODEL: "deepseek-v4.1-flash",
      PROGRADE_AGENT_API_KEY: "test-key",
    });
    expect(config?.baseUrl).toBe("https://opencode.ai/inference/go/openai/v1");
    expect(isOpenCodeGoBaseUrl(config!.baseUrl)).toBe(true);
  });

  test("OpenCode Go の /openai も /openai/v1 に補正する", () => {
    const config = readAgentConfig({
      PROGRADE_AGENT_BASE_URL: "https://opencode.ai/inference/go/openai/",
      PROGRADE_AGENT_MODEL: "deepseek-v4.1-flash",
      PROGRADE_AGENT_API_KEY: "test-key",
    });
    expect(config?.baseUrl).toBe("https://opencode.ai/inference/go/openai/v1");
  });

  test("OpenCode Go は API キーが無いと未設定として扱う", () => {
    expect(
      readAgentConfig({
        PROGRADE_AGENT_BASE_URL: "https://opencode.ai/inference/go",
        PROGRADE_AGENT_MODEL: "deepseek-v4.1-flash",
      }),
    ).toBeNull();
  });

  test("OpenAI 互換のモデルを組み立てる", () => {
    const runtime = createAgentRuntime(readAgentConfig(baseEnv)!);
    expect(runtime.model.provider).toBe("prograde-agent");
    expect(runtime.model.baseUrl).toBe("http://127.0.0.1:3000/v1");
    expect(runtime.model.api).toBe("openai-completions");
    expect(runtime.models.getModel("prograde-agent", "local-model")?.id).toBe("local-model");
  });
});

const context: AgentExerciseContext = {
  courseId: "python-basics",
  courseLabel: "Python 入門",
  lessonTitle: "Python 基礎文法編",
  chapterTitle: "出力",
  sectionTitle: "あいさつを表示する",
  exerciseId: "pyb-01-e01",
  exerciseTitle: "あいさつを表示する",
  objective: "print で文字列を1行表示する",
  briefMarkdown: "Hello, Python! とだけ表示してください。",
  hints: ["print(\"Hello, Python!\") と書きます"],
  slides: [{ index: 1, title: "print とは", body: "print は画面に文字を出します。" }],
  env: "python",
  solved: false,
  attempts: 2,
  position: { index: 1, total: 8 },
};

const files = [{ path: "main.py", language: "python", code: 'print("Hello")' }];

describe("agent: 読み取り専用ツール", () => {
  test("4つだけを公開する", () => {
    expect(createAgentTools(context, files).map((tool) => tool.name).sort()).toEqual([
      "get_context",
      "read_brief",
      "read_current_code",
      "read_section_slides",
    ]);
  });

  test("get_context は位置・目標・環境・ヒントを返す", async () => {
    const tool = createAgentTools(context, files).find((item) => item.name === "get_context")!;
    const result = await tool.execute("t1", {});
    const output = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(output).toContain("演習 1 / 8");
    expect(output).toContain("print で文字列を1行表示する");
    expect(output).toContain("python");
    expect(output).toContain("print(\"Hello, Python!\")");
  });

  test("read_section_slides はスライド本文を返す", async () => {
    const tool = createAgentTools(context, files).find((item) => item.name === "read_section_slides")!;
    const result = await tool.execute("t1", {});
    const output = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(output).toContain("## スライド 1: print とは");
    expect(output).toContain("print は画面に文字を出します。");
  });

  test("read_current_code は未保存のコードを返す", async () => {
    const tool = createAgentTools(context, files).find((item) => item.name === "read_current_code")!;
    const result = await tool.execute("t1", {});
    const output = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(output).toContain("main.py");
    expect(output).toContain('print("Hello")');
  });

  test("read_brief は手順書を返す", async () => {
    const tool = createAgentTools(context, files).find((item) => item.name === "read_brief")!;
    const result = await tool.execute("t1", {});
    const output = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(output).toContain("Hello, Python! とだけ表示してください。");
  });

  test("システムプロンプトは丸写しを禁じる", () => {
    const prompt = agentSystemPrompt(context);
    expect(prompt).toContain("丸ごと書き写すのではなく");
    expect(prompt).toContain("あいさつを表示する");
  });
});