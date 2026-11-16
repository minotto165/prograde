import { json } from "@sveltejs/kit";
import { agentConfigHint, createAgentRuntime, readAgentConfig } from "$lib/server/agent/config";
import { createAgentStream } from "$lib/server/agent/chat";
import { collectAgentContext, type AgentFile } from "$lib/server/agent/tools";
import { DataError, NotFoundError } from "../../../../../src/core/errors.ts";

const MAX_MESSAGE = 4_000;
const MAX_FILES = 8;
const MAX_TOTAL_CODE = 120_000;

function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

function readText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > limit) return null;
  return trimmed;
}

function readFiles(value: unknown): AgentFile[] | null {
  if (!Array.isArray(value) || value.length > MAX_FILES) return null;
  const files: AgentFile[] = [];
  let total = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const path = readText(record.path, 200);
    const code = typeof record.code === "string" ? record.code : null;
    if (!path || code === null) return null;
    total += code.length;
    if (total > MAX_TOTAL_CODE) return null;
    const language = typeof record.language === "string" ? record.language.slice(0, 24) : "text";
    files.push({ path, language, code });
  }
  return files;
}

export async function GET() {
  const config = readAgentConfig();
  return json({
    configured: Boolean(config),
    model: config?.model ?? null,
    hint: config ? null : agentConfigHint(),
  });
}

export async function POST({ request }: { request: Request }) {
  const config = readAgentConfig();
  if (!config) {
    return json({ error: "not_configured", hint: agentConfigHint() }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("リクエストを読み取れませんでした。");
  }
  if (!body || typeof body !== "object") return badRequest("リクエストを読み取れませんでした。");
  const record = body as Record<string, unknown>;
  const sessionId = readText(record.sessionId, 64);
  const courseId = readText(record.courseId, 100);
  const exerciseId = readText(record.exerciseId, 100);
  const message = readText(record.message, MAX_MESSAGE);
  const files = readFiles(record.files);
  if (!sessionId || !/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) return badRequest("セッションが不正です。");
  if (!courseId || !exerciseId) return badRequest("演習が指定されていません。");
  if (!message) return badRequest("メッセージを入力してください。");
  if (!files) return badRequest("コードを読み取れませんでした。");

  let context: Awaited<ReturnType<typeof collectAgentContext>>;
  try {
    context = await collectAgentContext(courseId, exerciseId);
  } catch (cause) {
    if (cause instanceof NotFoundError) return json({ error: "演習が見つかりません。" }, { status: 404 });
    if (cause instanceof DataError) {
      console.error(cause);
      return json({ error: "教材データを読み込めませんでした。" }, { status: 500 });
    }
    console.error(cause);
    return json({ error: "演習を読み込めませんでした。" }, { status: 500 });
  }

  const runtime = createAgentRuntime(config);
  const stream = createAgentStream({
    sessionId,
    message,
    files,
    context,
    runtime,
    signal: request.signal,
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
