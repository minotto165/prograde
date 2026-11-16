import {
  createModels,
  createProvider,
  type Model,
  type Models,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

const PROVIDER_ID = "prograde-agent";
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;

/** OpenAI 互換のエンドポイントだけを設定できる。キーはローカルサーバーなら不要。 */
export interface AgentConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow: number;
  maxTokens: number;
}

export interface AgentRuntime {
  config: AgentConfig;
  models: Models;
  model: Model<"openai-completions">;
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const OPENCODE_GO_ROOT = "https://opencode.ai/inference/go";

/** OpenCode Go のルート URL は chat completions のベースではない。 */
export function isOpenCodeGoBaseUrl(baseUrl: string): boolean {
  return baseUrl === OPENCODE_GO_ROOT || baseUrl.startsWith(OPENCODE_GO_ROOT + "/");
}

function cleanBaseUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, "");
  // OpenCode Go の API は /openai/v1 配下にしか生えていない。
  // 案内されるルート URL をそのまま貼られても動くように補正する。
  if (url === OPENCODE_GO_ROOT) return OPENCODE_GO_ROOT + "/openai/v1";
  if (url === OPENCODE_GO_ROOT + "/openai") return OPENCODE_GO_ROOT + "/openai/v1";
  return url;
}

/** 設定が無ければ null。モデル名や URL の妥当性はここでは見ない。 */
export function readAgentConfig(env: Record<string, string | undefined> = process.env): AgentConfig | null {
  const baseUrl = env.PROGRADE_AGENT_BASE_URL?.trim();
  const model = env.PROGRADE_AGENT_MODEL?.trim();
  if (!baseUrl || !model) return null;
  const apiKey = env.PROGRADE_AGENT_API_KEY?.trim();
  return {
    baseUrl: cleanBaseUrl(baseUrl),
    model,
    // OpenAI 互換サーバーはキーを要求しないことが多いが、SDK 側は空を許さない。
    // 未指定ならダミーを渡し、実際の認証はサーバーに任せる。
    apiKey: apiKey || "prograde-local",
    contextWindow: positiveInt(env.PROGRADE_AGENT_CONTEXT_WINDOW, DEFAULT_CONTEXT_WINDOW),
    maxTokens: positiveInt(env.PROGRADE_AGENT_MAX_TOKENS, DEFAULT_MAX_TOKENS),
  };
}

export function createAgentRuntime(config: AgentConfig): AgentRuntime {
  const model: Model<"openai-completions"> = {
    id: config.model,
    name: config.model,
    api: "openai-completions",
    provider: PROVIDER_ID,
    baseUrl: config.baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };

  const provider = createProvider({
    id: PROVIDER_ID,
    name: "prograde agent",
    baseUrl: config.baseUrl,
    auth: {
      apiKey: {
        name: "prograde agent",
        resolve: async () => ({ auth: { apiKey: config.apiKey ?? "prograde-local" } }),
      },
    },
    models: [model],
    api: openAICompletionsApi(),
  });

  const models = createModels();
  models.setProvider(provider);
  return { config, models, model };
}

export function agentConfigHint(): string {
  return [
    "エージェントのモデルが未設定です。",
    "OpenAI 互換のエンドポイントを環境変数で指定してから起動してください。",
    "PROGRADE_AGENT_BASE_URL=http://127.0.0.1:3000/v1",
    "PROGRADE_AGENT_MODEL=<モデル名>",
    "必要なら PROGRADE_AGENT_API_KEY=<キー>",
  ].join("\n");
}
