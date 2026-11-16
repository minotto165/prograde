<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/components/Icon.svelte";

  type ChatFile = { path: string; language: string; code: string };
  type ChatMessage = { role: "user" | "assistant"; text: string };

  let {
    open = false,
    onclose,
    courseId,
    exerciseId,
    readFiles,
  }: {
    open: boolean;
    onclose: () => void;
    courseId: string;
    exerciseId: string;
    readFiles: () => ChatFile[];
  } = $props();

  let messages = $state<ChatMessage[]>([]);
  let draft = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let toolLabel = $state("");
  let configured = $state<boolean | null>(null);
  let configHint = $state<string | null>(null);
  let sessionId = $state("");
  let listEl: HTMLDivElement | undefined = $state();
  let textarea: HTMLTextAreaElement | undefined = $state();
  let controller: AbortController | null = null;

  function scrollToBottom() {
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  function focusComposer() {
    if (open) requestAnimationFrame(() => textarea?.focus());
  }

  function sessionKey(): string {
    return `prograde-agent:${courseId}:${exerciseId}`;
  }

  function newSessionId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replaceAll("-", "").slice(0, 32);
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function ensureSession(): string {
    if (sessionId) return sessionId;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(sessionKey());
    } catch {}
    if (!stored) {
      stored = newSessionId();
      try {
        sessionStorage.setItem(sessionKey(), stored);
      } catch {}
    }
    sessionId = stored;
    return stored;
  }

  async function loadStatus() {
    try {
      const response = await fetch("/api/agent", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const data = (await response.json()) as { configured?: boolean; hint?: string | null };
      configured = Boolean(data.configured);
      configHint = data.hint ?? null;
    } catch {
      configured = false;
    }
  }

  async function send(text = draft) {
    const message = text.trim();
    if (!message || busy) return;
    error = null;
    draft = "";
    messages.push({ role: "user", text: message });
    messages.push({ role: "assistant", text: "" });
    const answer = messages[messages.length - 1];
    busy = true;
    controller = new AbortController();
    requestAnimationFrame(scrollToBottom);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({
          sessionId: ensureSession(),
          courseId,
          exerciseId,
          message,
          files: readFiles(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          hint?: string;
        };
        if (response.status === 503) {
          configured = false;
          configHint = data.hint ?? null;
        }
        throw new Error(data.hint || data.error || `応答を得られませんでした（${response.status}）`);
      }
      if (!response.body) throw new Error("応答を読み取れませんでした。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let payload: Record<string, unknown>;
            try {
              payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (payload.type === "text" && typeof payload.delta === "string") {
              answer.text += payload.delta;
              requestAnimationFrame(scrollToBottom);
            } else if (payload.type === "tool") {
              if (payload.phase === "start") toolLabel = String(payload.label ?? "教材を読んでいます");
              else if (payload.phase === "end") toolLabel = "";
            } else if (payload.type === "error") {
              error = String(payload.message ?? "応答を得られませんでした。");
              toolLabel = "";
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (!answer.text && !error) {
        messages.pop();
        error = "応答がありませんでした。";
      }
    } catch (cause) {
      toolLabel = "";
      if (controller.signal.aborted) {
        if (!answer.text) messages.pop();
      } else {
        error = cause instanceof Error ? cause.message : String(cause);
        if (!answer.text) messages.pop();
        if (configured === false) configHint = error;
      }
    } finally {
      busy = false;
      controller = null;
      requestAnimationFrame(scrollToBottom);
    }
  }

  function stop() {
    controller?.abort();
    busy = false;
    toolLabel = "";
  }

  function onComposerKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void send();
  }

  function close() {
    onclose();
  }

  onMount(() => {
    void loadStatus();
  });

  $effect(() => {
    if (open) {
      focusComposer();
      requestAnimationFrame(scrollToBottom);
    }
  });
</script>

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-30 cursor-default bg-black/30 md:hidden"
    aria-label="アシスタントを閉じる"
    onclick={close}
  ></button>
{/if}

<aside
  id="agent-panel"
  class="fixed inset-y-0 right-0 z-40 flex w-full max-w-[min(92vw,380px)] flex-col border-l border-line bg-surface shadow-2xl transition-transform duration-300 ease-out md:top-16 {open
    ? 'translate-x-0'
    : 'pointer-events-none translate-x-full'}"
  aria-label="学習アシスタント"
  aria-hidden={!open}
  inert={!open}
>
  <header class="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
    <span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-strong">
      <Icon name="sparkles" size={16} />
    </span>
    <div class="min-w-0 flex-1">
      <h2 class="text-sm font-medium text-ink">学習アシスタント</h2>
      <p class="truncate text-[11px] text-muted">この演習のスライド・手順・コードを読みます</p>
    </div>
    <button
      type="button"
      onclick={close}
      class="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label="アシスタントを閉じる"
    >
      <Icon name="x" size={16} />
    </button>
  </header>

  <div bind:this={listEl} class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
    {#if configured === false}
      <div class="rounded-xl border border-accent/25 bg-accent-soft/60 px-3 py-3">
        <p class="text-sm font-medium text-accent">エージェントが未設定です</p>
        <p class="mt-1 text-xs leading-relaxed text-ink-soft">
          モデルと API キーを環境変数で指定して、サーバーを起動し直してください。
        </p>
        {#if configHint}
          <pre class="mt-2 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-muted">{configHint}</pre>
        {/if}
      </div>
    {:else if messages.length === 0}
      <div class="rounded-xl border border-line bg-surface-2 px-3 py-3">
        <p class="text-sm text-ink-soft">この演習で詰まったところを聞けます。</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button type="button" class="chip hover:border-brand/40" onclick={() => void send("この演習で何をすればいい？")}>
            何をすればいい？
          </button>
          <button type="button" class="chip hover:border-brand/40" onclick={() => void send("コードのどこが違うか見て")}>
            コードを見て
          </button>
          <button type="button" class="chip hover:border-brand/40" onclick={() => void send("ヒントをください")}>
            ヒント
          </button>
        </div>
      </div>
    {/if}

    <div class="mt-3 space-y-3">
      {#each messages as message, index (index)}
        {#if message.role === "user"}
          <div class="ml-8 rounded-2xl rounded-br-md bg-brand-soft px-3 py-2 text-sm leading-relaxed text-ink">
            <p class="whitespace-pre-wrap break-words">{message.text}</p>
          </div>
        {:else if message.text}
          <div class="mr-2 rounded-2xl rounded-bl-md border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink-soft">
            <p class="whitespace-pre-wrap break-words">{message.text}</p>
          </div>
        {/if}
      {/each}
    </div>

    {#if toolLabel}
      <p class="mt-3 flex items-center gap-2 text-xs text-muted">
        <span class="size-1.5 animate-pulse rounded-full bg-brand"></span>
        {toolLabel}
      </p>
    {/if}

    {#if error}
      <div class="mt-3 rounded-xl border border-danger/25 bg-danger-soft/50 px-3 py-2">
        <p class="whitespace-pre-wrap break-words text-xs leading-relaxed text-danger">{error}</p>
      </div>
    {/if}
  </div>

  <form
    class="shrink-0 border-t border-line px-3 py-3"
    onsubmit={(event) => {
      event.preventDefault();
      void send();
    }}
  >
    <label class="sr-only" for="agent-message">アシスタントへのメッセージ</label>
    <textarea
      id="agent-message"
      bind:this={textarea}
      bind:value={draft}
      onkeydown={onComposerKeydown}
      rows="2"
      placeholder="詰まっているところを聞く"
      class="field min-h-16 resize-none text-sm"
      disabled={busy}
    ></textarea>
    <div class="mt-2 flex items-center justify-between gap-2">
      <p class="text-[11px] text-muted">Enter で送信 · Shift + Enter で改行</p>
      {#if busy}
        <button type="button" class="btn btn-secondary btn-sm" onclick={stop}>
          <Icon name="stop" size={16} />
          止める
        </button>
      {:else}
        <button type="submit" class="btn btn-primary btn-sm" disabled={!draft.trim()}>
          <Icon name="send" size={16} />
          送信
        </button>
      {/if}
    </div>
  </form>
</aside>