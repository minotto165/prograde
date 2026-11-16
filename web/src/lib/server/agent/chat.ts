import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { isOpenCodeGoBaseUrl, type AgentRuntime } from "./config.ts";
import {
  AGENT_TOOL_LABELS,
  AGENT_TOOL_TITLES,
  agentSystemPrompt,
  createAgentTools,
  type AgentExerciseContext,
  type AgentFile,
} from "./tools.ts";

const MAX_SESSIONS = 40;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HISTORY = 60;

interface Session {
  messages: AgentMessage[];
  updatedAt: number;
}

const sessions = new Map<string, Session>();

function pruneSessions(now = Date.now()): void {
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
  while (sessions.size > MAX_SESSIONS) {
    const oldest = sessions.keys().next().value as string | undefined;
    if (!oldest) break;
    sessions.delete(oldest);
  }
}

function readSession(id: string): AgentMessage[] {
  const session = sessions.get(id);
  if (!session) return [];
  session.updatedAt = Date.now();
  return session.messages;
}

function writeSession(id: string, messages: AgentMessage[]): void {
  let trimmed = messages.filter((message) => message.role !== "system");
  if (trimmed.length > MAX_HISTORY) trimmed = trimmed.slice(trimmed.length - MAX_HISTORY);
  while (trimmed.length > 0 && trimmed[0]?.role !== "user") trimmed = trimmed.slice(1);
  sessions.delete(id);
  sessions.set(id, { messages: trimmed, updatedAt: Date.now() });
  pruneSessions();
}

export interface AgentStreamInput {
  sessionId: string;
  message: string;
  files: AgentFile[];
  context: AgentExerciseContext;
  runtime: AgentRuntime;
  signal?: AbortSignal;
}

/** OpenCode Go は会話ごとの安定したセッション ID と独自 UA を要求する。 */
function streamOptions(input: AgentStreamInput, options: Parameters<AgentRuntime["models"]["streamSimple"]>[2]) {
  if (!isOpenCodeGoBaseUrl(input.runtime.config.baseUrl)) return options;
  return {
    ...options,
    headers: {
      "user-agent": "prograde/0.1",
      "x-opencode-session": input.sessionId,
      ...options?.headers,
    },
  };
}

/** SSE で1ターン分の出来事を流す。テキストは差分、ツールは開始/終了だけを送る。 */
export function createAgentStream(input: AgentStreamInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(payload) + "\n\n"));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // 既に閉じている。
        }
      };

      const history = readSession(input.sessionId);
      const agent = new Agent({
        initialState: {
          systemPrompt: agentSystemPrompt(input.context),
          model: input.runtime.model,
          tools: createAgentTools(input.context, input.files),
          // 失敗したターンで保存済みの履歴を壊さないよう、配列は複製して渡す。
          messages: [...history],
        },
        streamFn: (model, context, options) =>
          input.runtime.models.streamSimple(model, context, streamOptions(input, options)),
        sessionId: input.sessionId,
      });

      let aborted = false;
      let failed = false;
      const onAbort = () => {
        aborted = true;
        agent.abort();
      };
      if (input.signal?.aborted) onAbort();
      else input.signal?.addEventListener("abort", onAbort, { once: true });

      const unsubscribe = agent.subscribe((event) => {
        if (event.type === "agent_start") {
          send({ type: "start" });
          return;
        }
        if (event.type === "message_update") {
          const update = event.assistantMessageEvent;
          if (update.type === "text_delta" && update.delta) send({ type: "text", delta: update.delta });
          return;
        }
        if (event.type === "message_end") {
          const message = event.message;
          if (message.role === "assistant" && message.stopReason === "error" && !aborted) {
            failed = true;
            send({
              type: "error",
              message: message.errorMessage || "モデルから応答を得られませんでした。",
            });
          }
          return;
        }
        if (event.type === "tool_execution_start") {
          send({
            type: "tool",
            phase: "start",
            id: event.toolCallId,
            name: event.toolName,
            label: AGENT_TOOL_LABELS[event.toolName] ?? event.toolName,
            title: AGENT_TOOL_TITLES[event.toolName] ?? event.toolName,
          });
          return;
        }
        if (event.type === "tool_execution_end") {
          send({
            type: "tool",
            phase: "end",
            id: event.toolCallId,
            name: event.toolName,
            label: AGENT_TOOL_LABELS[event.toolName] ?? event.toolName,
            title: AGENT_TOOL_TITLES[event.toolName] ?? event.toolName,
            isError: event.isError,
          });
        }
      });

      void (async () => {
        try {
          await agent.prompt(input.message);
          if (aborted) {
            send({ type: "aborted" });
          } else {
            if (!failed) writeSession(input.sessionId, agent.state.messages);
            send({ type: "done" });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          send({ type: aborted ? "aborted" : "error", message });
        } finally {
          input.signal?.removeEventListener("abort", onAbort);
          unsubscribe();
          finish();
        }
      })();
    },
    cancel() {
      // クライアントが購読をやめた。Agent 側は request.signal で止める。
    },
  });
}
