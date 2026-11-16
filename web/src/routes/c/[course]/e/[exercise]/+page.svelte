<script lang="ts">
  import { onMount } from "svelte";
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data, form } = $props();

  let outcome = $derived(form?.outcome ?? null);
  let files = $derived(outcome?.files ?? data.files);
  let result = $derived(outcome?.result ?? null);
  let selectedPath = $state<string | null>(null);
  let resetArmed = $state(false);
  let activeIndex = $derived(
    selectedPath ? Math.max(0, files.findIndex((file) => file.path === selectedPath)) : 0,
  );
  let progressPercent = $derived(
    data.lessonProgress.total > 0
      ? Math.round((data.lessonProgress.solved / data.lessonProgress.total) * 100)
      : 0,
  );
  let passedCount = $derived(result ? result.checks.filter((check) => check.ok).length : 0);
  let referenceOverride = $state<typeof data.reference>(null);
  let reference = $derived(referenceOverride ?? data.reference);
  let referenceBusy = $state(false);
  let resultDismissed = $state(false);
  let resultOpen = $derived(Boolean(result || form?.error) && !resultDismissed);
  let resultPanel: HTMLElement | undefined = $state();
  let saveState = $state<"idle" | "saving" | "saved" | "error">("idle");
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveInFlight = false;
  let saveQueued = false;

  function clearSaveTimer() {
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  function flashSave(state: "saved" | "error") {
    saveState = state;
    clearSaveTimer();
    saveTimer = setTimeout(() => {
      saveState = "idle";
      saveTimer = undefined;
    }, 2000);
  }

  async function saveCode() {
    if (saveInFlight) {
      saveQueued = true;
      return;
    }
    const form = document.getElementById("exercise-form");
    if (!(form instanceof HTMLFormElement)) return;
    saveInFlight = true;
    saveState = "saving";
    clearSaveTimer();
    try {
      const response = await fetch(
        `/api/save/${encodeURIComponent(data.courseId)}/${encodeURIComponent(data.exerciseId)}`,
        { method: "POST", body: new FormData(form), headers: { accept: "application/json" } },
      );
      if (!response.ok) throw new Error(`保存に失敗しました（${response.status}）`);
      flashSave("saved");
    } catch (error) {
      console.error(error);
      flashSave("error");
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        void saveCode();
      }
    }
  }

  async function rerunReference() {
    if (referenceBusy) return;
    referenceBusy = true;
    try {
      const response = await fetch(
        `/api/reference/${encodeURIComponent(data.courseId)}/${encodeURIComponent(data.exerciseId)}?fresh=1`,
      );
      if (!response.ok) return;
      referenceOverride = (await response.json()) as typeof data.reference;
    } finally {
      referenceBusy = false;
    }
  }

  function line(text: string): string {
    return text.replace(/\r\n/g, "\n");
  }

  onMount(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && resultOpen) {
        event.preventDefault();
        resultDismissed = true;
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveCode();
    }

    window.addEventListener("keydown", onKeydown);
    if (resultOpen && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => resultPanel?.scrollIntoView({ block: "end" }));
    }

    return () => {
      window.removeEventListener("keydown", onKeydown);
      clearSaveTimer();
    };
  });

  $effect(() => {
    if (!resultOpen || !resultPanel) return;
    const panel = resultPanel;
    requestAnimationFrame(() => panel.focus({ preventScroll: true }));
  });
</script>

<PageHead
  title={data.title}
  description={`${data.lessonTitle} の演習。${data.objective || "コードを書いて実行結果で確かめます。"}`}
/>

<div class="xl:flex xl:h-full xl:min-h-0 xl:flex-col">
<div
  class="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(320px,360px)] xl:items-stretch"
>
  <aside
    class="card overflow-hidden xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto"
    aria-label="この演習の手順"
  >
    <div class="border-b border-line px-5 py-4">
      <p class="meta-label">手順</p>
      {#if data.objective}
        <div class="mt-3 border-l-2 border-brand pl-3">
          <p class="text-xs font-medium text-brand-strong">目標</p>
          <p class="mt-1 text-sm leading-relaxed text-ink-soft">{data.objective}</p>
        </div>
      {/if}
    </div>

    {#if data.briefHtml}
      <div class="doc px-5 py-5 text-sm">
        {@html data.briefHtml}
      </div>
    {:else}
      <p class="px-5 py-5 text-sm text-muted">この演習の手順はありません。</p>
    {/if}

    {#if data.hints.length > 0}
      <details class="group mx-5 mb-5 rounded-xl border border-accent/20 bg-accent-soft/60 px-4 py-3">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-accent">
          ヒント
          <Icon name="chevron-down" size={16} className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <ol class="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-ink-soft">
          {#each data.hints as hint, index (index)}
            <li>{hint}</li>
          {/each}
        </ol>
      </details>
    {/if}

  </aside>

  <div class="relative flex min-w-0 flex-col gap-4 xl:h-full xl:min-h-0">
    <form
      id="exercise-form"
      method="POST"
      action="?/grade"
      class="flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-code shadow-sm sm:min-h-[520px] xl:min-h-0 xl:flex-1"
    >
      <div class="flex items-stretch border-b border-white/10 bg-white/[0.04]">
        <div class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 pt-2" role="group" aria-label="編集するファイル">
          {#each files as file, index (file.path)}
            <button
              type="button"
              aria-pressed={index === activeIndex}
              onclick={() => (selectedPath = file.path)}
              class="shrink-0 rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors {index ===
              activeIndex
                ? 'bg-code text-white shadow-[inset_0_-2px_0_var(--color-brand)]'
                : 'text-white/60 hover:bg-white/5 hover:text-white/80'}"
            >
              {file.path}
            </button>
          {/each}
        </div>
        <div class="flex shrink-0 items-center gap-2 px-2">
          {#if result && !resultOpen}
            <button
              type="button"
              onclick={() => (resultDismissed = false)}
              class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="判定を開く"
            >
              <Icon name={result.ok ? "check" : "x"} size={16} />
              判定
            </button>
          {/if}
          <span
            class="mr-1 text-[11px] {saveState === 'error' ? 'text-danger-soft' : 'text-white/45'}"
            role="status"
            aria-live="polite"
          >
            {#if saveState === "saving"}保存中…{:else if saveState === "saved"}保存しました{:else if saveState === "error"}保存できませんでした{/if}
          </span>
          <button
            type="button"
            onclick={() => (resetArmed = true)}
            class="rounded-lg px-2 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-danger-soft"
          >
            雛形に戻す
          </button>
        </div>
      </div>

      {#each files as file, index (file.path)}
        {#key file.code}
          <CodeEditor path={file.path} code={file.code} active={index === activeIndex} />
        {/key}
      {/each}

      {#if resetArmed}
        <div class="flex flex-wrap items-center gap-2 border-t border-white/10 bg-danger/10 px-3 py-2.5 text-xs text-white/70">
          <span>いま書いたコードは失われます。</span>
          <button
            type="submit"
            formaction="?/reset"
            class="rounded-md bg-danger px-3 py-1.5 font-medium text-white hover:bg-danger/90 dark:text-canvas"
          >
            雛形に戻す
          </button>
          <button
            type="button"
            onclick={() => (resetArmed = false)}
            class="rounded-md px-3 py-1.5 hover:bg-white/10"
          >
            やめる
          </button>
        </div>
      {/if}

    </form>

    {#if resultOpen}
      <div class="absolute inset-0 z-20 overflow-hidden rounded-2xl">
        <button
          type="button"
          class="result-backdrop absolute inset-0 cursor-default rounded-2xl bg-black/45 backdrop-blur-[2px]"
          aria-label="結果を閉じる"
          onclick={() => (resultDismissed = true)}
        ></button>

        <div
          id="result"
          bind:this={resultPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-title"
          tabindex="-1"
          class="result-drawer absolute inset-x-0 bottom-0 flex max-h-full flex-col overflow-hidden border-t border-line bg-surface shadow-[0_-12px_32px_-16px_rgba(0,0,0,0.5)] focus:outline-none"
        >
        {#if form?.error}
          <header class="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
              <Icon name="x" size={16} />
            </span>
            <h2 id="result-title" class="text-sm font-medium text-ink">実行できませんでした</h2>
            <button
              type="button"
              onclick={() => (resultDismissed = true)}
              class="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="結果を閉じる"
            >
              <Icon name="x" size={16} />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <pre class="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-soft">{form.error}</pre>
            {#if form.remediation}
              <p class="mt-3 font-mono text-[11px] text-muted">準備手順</p>
              <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted">{form.remediation}</pre>
            {/if}
          </div>
        {:else if result}
          <header class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-2.5">
            <span class="grid size-6 shrink-0 place-items-center rounded-full {result.ok ? 'bg-brand-soft text-brand-strong' : 'bg-danger-soft text-danger'}">
              <Icon name={result.ok ? "check" : "x"} size={16} />
            </span>
            <h2 id="result-title" class="text-sm font-medium text-ink">{outcome?.kind === "grade" ? "判定" : "実行結果"}</h2>
            {#if outcome?.kind === "grade"}
              <span class="text-xs font-medium {result.ok ? 'text-brand-strong' : 'text-danger'}">{result.ok ? "合格" : "不合格"}</span>
              <span class="font-mono text-xs text-muted">{passedCount} / {result.checks.length}</span>
            {/if}
            <span class="ml-auto font-mono text-[11px] text-muted">
              exit {result.exitCode ?? "—"} · {result.durationMs}ms{#if result.timedOut} · 時間切れ{/if}
            </span>
            <button
              type="button"
              onclick={() => (resultDismissed = true)}
              class="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="結果を閉じる"
            >
              <Icon name="x" size={16} />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div class="space-y-4">
              <div class="min-w-0">
                {#if outcome?.kind === "grade"}
                  <p class="text-sm leading-relaxed {result.ok ? 'font-medium text-brand-strong' : 'text-danger'}">{result.message}</p>
                {:else if result.ok}
                  <p class="text-sm text-ink-soft">実行しました。</p>
                {:else}
                  <p class="text-sm text-danger">実行に失敗しました。</p>
                {/if}
                {#if result.stderr}
                  <div class="mt-3">
                    <p class="meta-label">エラー出力</p>
                    <pre class="mt-1 whitespace-pre-wrap break-words rounded-xl border border-danger/20 bg-danger-soft/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-danger">{line(result.stderr)}</pre>
                  </div>
                {/if}
                {#if result.truncated}
                  <p class="mt-3 font-mono text-[11px] text-muted">出力が長いため途中で切り詰めています。</p>
                {/if}
              </div>

              <div class="min-w-0">
                {#if outcome?.kind === "grade"}
                  <ul class="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {#each result.checks as check, index (index)}
                      <li class="px-4 py-3 {check.ok ? 'bg-surface' : 'bg-danger-soft/40'}">
                        <div class="flex items-start gap-2">
                          <span
                            class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full {check.ok
                              ? 'bg-brand-soft text-brand-strong'
                              : 'bg-danger-soft text-danger'}"
                          >
                            <Icon name={check.ok ? "check" : "x"} size={16} />
                          </span>
                          <div class="min-w-0 flex-1">
                            <p class="font-mono text-xs font-medium text-ink-soft">{check.name}</p>
                            {#if !check.ok}
                              <dl class="mt-1.5 space-y-1 text-xs leading-relaxed">
                                <div class="flex gap-1.5">
                                  <dt class="shrink-0 text-muted">期待</dt>
                                  <dd class="min-w-0 break-all"><code class="whitespace-pre-wrap rounded bg-surface px-1 py-0.5 font-mono text-[11px]">{check.expected}</code></dd>
                                </div>
                                <div class="flex gap-1.5">
                                  <dt class="shrink-0 text-muted">実際</dt>
                                  <dd class="min-w-0 break-all"><code class="whitespace-pre-wrap rounded bg-surface px-1 py-0.5 font-mono text-[11px]">{check.actual}</code></dd>
                                </div>
                              </dl>
                              {#if check.note}<p class="mt-1 text-xs text-accent">（{check.note}）</p>{/if}
                            {/if}
                          </div>
                        </div>
                      </li>
                    {/each}
                  </ul>
                {/if}

                {#if result.diagnostics.length > 0}
                  <div class="mt-3">
                    <p class="text-xs font-medium text-muted">診断</p>
                    <ul class="mt-1 grid gap-1">
                      {#each result.diagnostics as diagnostic, index (index)}
                        <li class="rounded-lg bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-ink-soft">
                          {#if diagnostic.file ?? diagnostic.line}
                            <span class="text-muted">{diagnostic.file ?? ""}{#if diagnostic.line}:{diagnostic.line}{/if} </span>
                          {/if}
                          <span class={diagnostic.severity === "error" ? "text-danger" : diagnostic.severity === "warning" ? "text-accent" : "text-muted"}>
                            {diagnostic.severity}
                          </span>
                          {diagnostic.message}
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          {#if result.ok && outcome?.kind === "grade"}
            <footer class="border-t border-line px-4 py-3">
              {#if data.nextStep}
                <a href={data.nextStep.href} class="btn btn-primary w-full sm:w-auto">
                  {data.nextStep.label}
                  <Icon name="arrow-right" size={16} />
                </a>
              {:else}
                <a href={'/c/' + data.courseId} class="btn btn-primary w-full sm:w-auto">
                  コースへ戻る
                  <Icon name="arrow-right" size={16} />
                </a>
              {/if}
            </footer>
          {/if}
        {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="flex min-h-0 flex-col gap-4 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 xl:h-full xl:overflow-y-auto">
    <section
      class="flex min-h-[192px] max-h-[256px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-code shadow-sm xl:min-h-0 xl:max-h-none xl:flex-1"
      aria-label="あなたの標準出力"
      aria-live="polite"
    >
      <header class="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
        <h3 class="font-mono text-[11px] text-white/45">あなた</h3>
        <button
          type="submit"
          form="exercise-form"
          formaction="?/run"
          class="grid size-8 shrink-0 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="コードを実行"
          title="コードを実行"
        >
          <Icon name="play" size={16} />
        </button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {#if outcome?.kind === "reset"}
          <p class="font-mono text-xs text-white/45">雛形に戻しました。</p>
        {:else if result}
          {#if result.stdout}
            <pre class="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-white/90">{line(result.stdout)}</pre>
          {:else}
            <p class="font-mono text-[11px] text-white/30">出力はありません。</p>
          {/if}
          {#if result.truncated}
            <p class="mt-3 font-mono text-[11px] text-white/30">出力が長いため途中で切り詰めています。</p>
          {/if}
        {:else}
          <p class="font-mono text-[11px] text-white/30">まだ実行していません。</p>
        {/if}
      </div>
    </section>

    <section
      class="flex min-h-[192px] max-h-[256px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-code shadow-sm xl:min-h-0 xl:max-h-none xl:flex-1"
      aria-label="お手本の標準出力"
    >
      <header class="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
        <h3 class="font-mono text-[11px] text-white/45">お手本</h3>
        <button
          type="button"
          onclick={rerunReference}
          disabled={referenceBusy}
          class="grid size-8 shrink-0 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label="お手本を実行"
          title="お手本を実行"
        >
          <Icon name="play" size={16} />
        </button>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {#if reference}
          {#if reference.stdout}
            <pre class="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-white/90">{line(reference.stdout)}</pre>
          {:else}
            <p class="font-mono text-[11px] text-white/30">出力はありません。</p>
          {/if}
          {#if reference.truncated}
            <p class="mt-3 font-mono text-[11px] text-white/30">出力が長いため途中で切り詰めています。</p>
          {/if}
        {:else}
          <p class="font-mono text-[11px] text-white/30">再生ボタンでお手本を実行します。</p>
        {/if}
      </div>
    </section>
  </div>

</div>

<div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 xl:shrink-0">
  <a href={data.slideHref} class="order-1 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
    <Icon name="arrow-left" size={16} />
    スライドを見る
  </a>
  <div class="order-3 flex w-full items-center gap-3 sm:order-2 sm:ml-auto sm:w-56">
    <ProgressBar value={progressPercent} size="sm" />
    <span class="shrink-0 text-xs font-medium text-muted">
      {data.lessonProgress.solved} / {data.lessonProgress.total} クリア
    </span>
  </div>
  <button
    type="submit"
    form="exercise-form"
    formaction="?/grade"
    class="btn btn-primary order-2 ml-auto shrink-0 sm:order-3 sm:ml-3 sm:min-h-9"
    title="採点する（⌘/Ctrl + Enter）"
  >
    できた！
  </button>
</div>
</div>
<style>
  .result-backdrop {
    animation: result-fade-in 180ms ease-out;
  }

  .result-drawer {
    animation: result-drawer-in 300ms cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: bottom;
  }

  @keyframes result-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes result-drawer-in {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .result-backdrop,
    .result-drawer {
      animation: none;
    }
  }
</style>
