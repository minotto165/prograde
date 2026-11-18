<script lang="ts">
  import { onMount } from "svelte";
  import AgentPanel from "$lib/components/AgentPanel.svelte";
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
  type Reference = NonNullable<typeof data.reference>;
  let referenceOverride = $state<{ outcome: typeof outcome; value: Reference } | null>(null);
  let reference = $derived(
    referenceOverride && referenceOverride.outcome === outcome
      ? referenceOverride.value
      : (outcome?.reference ?? data.reference),
  );
  let referenceBusy = $state(false);
  let resultDismissed = $state(false);
  let resultOpen = $derived(Boolean(result || form?.error) && !resultDismissed);
  let resultPanel: HTMLElement | undefined = $state();
  let agentOpen = $state(false);
  let saveState = $state<"idle" | "saving" | "saved" | "error">("idle");
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveInFlight = false;
  let saveQueued = false;

  const LAYOUT_KEY = "prograde:exercise-layout";
  const GUIDE_MIN = 200;
  const GUIDE_MAX = 480;
  const RESULTS_MIN = 240;
  const RESULTS_MAX = 520;
  const CODE_MIN = 420;
  const SPLIT_MIN = 0.25;
  const SPLIT_MAX = 0.75;

  let bento: HTMLElement | undefined = $state();
  let footer: HTMLElement | undefined = $state();
  let guideWidth = $state(280);
  let resultsWidth = $state(300);
  let resultSplit = $state(0.5);
  let footerHeight = $state(0);
  let layoutReady = $state(false);
  let dragging = $state<"guide" | "results" | "split" | null>(null);

  type DragKind = "guide" | "results" | "split";
  interface DragState {
    kind: DragKind;
    startX: number;
    startY: number;
    guide: number;
    results: number;
    split: number;
    total: number;
  }
  let drag: DragState | null = null;

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function wideLayout(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(min-width: 80rem)").matches;
  }

  function maxGuideWidth(): number {
    const width = bento?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1440);
    const results = wideLayout() ? resultsWidth : 0;
    return Math.max(GUIDE_MIN, Math.min(GUIDE_MAX, width - results - CODE_MIN));
  }

  function maxResultsWidth(): number {
    const width = bento?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1440);
    return Math.max(RESULTS_MIN, Math.min(RESULTS_MAX, width - guideWidth - CODE_MIN));
  }

  function clampLayout() {
    guideWidth = Math.round(clamp(guideWidth, GUIDE_MIN, maxGuideWidth()));
    resultsWidth = Math.round(clamp(resultsWidth, RESULTS_MIN, maxResultsWidth()));
    resultSplit = Math.round(clamp(resultSplit, SPLIT_MIN, SPLIT_MAX) * 1000) / 1000;
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { guide?: unknown; results?: unknown; split?: unknown };
        if (typeof saved.guide === "number") guideWidth = saved.guide;
        if (typeof saved.results === "number") resultsWidth = saved.results;
        if (typeof saved.split === "number") resultSplit = saved.split;
      }
    } catch {
      // 保存値が壊れていたら初期値のまま。
    }
    clampLayout();
  }

  function saveLayout() {
    try {
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify({ guide: guideWidth, results: resultsWidth, split: resultSplit }),
      );
    } catch {
      // 保存できなくても操作は続けられる。
    }
  }

  function resetLayout() {
    guideWidth = 280;
    resultsWidth = 300;
    resultSplit = 0.5;
    clampLayout();
    saveLayout();
  }

  function beginDrag(kind: DragKind, event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // 合成イベントなど、ポインタが有効でない場合は捕捉しない。
    }
    drag = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      guide: guideWidth,
      results: resultsWidth,
      split: resultSplit,
      total: Math.max(1, (bento?.clientHeight ?? 0) - footerHeight),
    };
    dragging = kind;
    document.body.classList.add(kind === "split" ? "bento-resizing-row" : "bento-resizing-col");
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag) return;
    if (drag.kind === "guide") {
      guideWidth = Math.round(clamp(drag.guide + event.clientX - drag.startX, GUIDE_MIN, maxGuideWidth()));
      return;
    }
    if (drag.kind === "results") {
      resultsWidth = Math.round(
        clamp(drag.results - (event.clientX - drag.startX), RESULTS_MIN, maxResultsWidth()),
      );
      return;
    }
    const next = drag.split + (event.clientY - drag.startY) / drag.total;
    resultSplit = Math.round(clamp(next, SPLIT_MIN, SPLIT_MAX) * 1000) / 1000;
  }

  function endDrag() {
    if (!drag) return;
    drag = null;
    dragging = null;
    document.body.classList.remove("bento-resizing-row", "bento-resizing-col");
    saveLayout();
  }

  function nudge(kind: DragKind, event: KeyboardEvent) {
    const step = event.shiftKey ? 32 : 8;
    if (kind === "guide") {
      let next: number;
      if (event.key === "ArrowLeft") next = clamp(guideWidth - step, GUIDE_MIN, maxGuideWidth());
      else if (event.key === "ArrowRight") next = clamp(guideWidth + step, GUIDE_MIN, maxGuideWidth());
      else if (event.key === "Home") next = GUIDE_MIN;
      else if (event.key === "End") next = maxGuideWidth();
      else return;
      event.preventDefault();
      guideWidth = Math.round(next);
    } else if (kind === "results") {
      let next: number;
      if (event.key === "ArrowLeft") next = clamp(resultsWidth + step, RESULTS_MIN, maxResultsWidth());
      else if (event.key === "ArrowRight") next = clamp(resultsWidth - step, RESULTS_MIN, maxResultsWidth());
      else if (event.key === "Home") next = RESULTS_MIN;
      else if (event.key === "End") next = maxResultsWidth();
      else return;
      event.preventDefault();
      resultsWidth = Math.round(next);
    } else {
      const splitStep = event.shiftKey ? 0.1 : 0.025;
      let next: number;
      if (event.key === "ArrowUp") next = resultSplit - splitStep;
      else if (event.key === "ArrowDown") next = resultSplit + splitStep;
      else if (event.key === "Home") next = SPLIT_MIN;
      else if (event.key === "End") next = SPLIT_MAX;
      else return;
      event.preventDefault();
      resultSplit = Math.round(clamp(next, SPLIT_MIN, SPLIT_MAX) * 1000) / 1000;
    }
    saveLayout();
  }

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
      referenceOverride = { outcome, value: (await response.json()) as Reference };
    } finally {
      referenceBusy = false;
    }
  }

  function line(text: string): string {
    return text.replace(/\r\n/g, "\n");
  }

  /** 未保存の内容も含めて、いまエディタが持っているコードを返す。 */
  function currentFiles() {
    const form = document.getElementById("exercise-form");
    return files.map((file) => {
      let code = file.code;
      if (form instanceof HTMLFormElement) {
        const field = form.elements.namedItem(`file:${file.path}`);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) code = field.value;
      }
      return { path: file.path, language: file.language, code };
    });
  }

  onMount(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && agentOpen) {
        event.preventDefault();
        agentOpen = false;
        return;
      }
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

    loadLayout();
    footerHeight = footer?.offsetHeight ?? 0;
    layoutReady = true;

    const observer = new ResizeObserver(() => {
      footerHeight = footer?.offsetHeight ?? 0;
      clampLayout();
    });
    if (bento) observer.observe(bento);
    if (footer) observer.observe(footer);

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    if (resultOpen && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => resultPanel?.scrollIntoView({ block: "end" }));
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
      document.body.classList.remove("bento-resizing-row", "bento-resizing-col");
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

<h1 class="sr-only">{data.title}</h1>

<div
  bind:this={bento}
  class="bento bento-dark bento-exercise xl:h-full xl:min-h-0"
  style={`--bento-guide-w: ${guideWidth}px; --bento-ref-w: ${resultsWidth}px; --bento-your-fr: ${resultSplit}fr; --bento-ref-fr: ${1 - resultSplit}fr; --bento-split-ratio: ${resultSplit}; --bento-footer-h: ${footerHeight}px;`}
>
  <aside
    class="bento-cell bento-area-guide xl:min-h-0 xl:overflow-y-auto"
    aria-label="この演習の手順"
  >
    <div class="border-b border-line px-4 py-4">
      <p class="meta-label">手順</p>
      {#if data.objective}
        <div class="mt-3 border-l-2 border-brand pl-3">
          <p class="text-xs font-medium text-brand-strong">目標</p>
          <p class="mt-1 text-sm leading-relaxed text-ink-soft">{data.objective}</p>
        </div>
      {/if}
    </div>

    {#if data.briefHtml}
      <div class="doc px-4 py-4 text-sm">
        {@html data.briefHtml}
      </div>
    {:else}
      <p class="px-4 py-4 text-sm text-muted">この演習の手順はありません。</p>
    {/if}

    {#if data.hints.length > 0}
      <details class="group mx-4 mb-4 rounded-xl border border-accent/20 bg-accent-soft/60 px-3 py-3">
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

  <div class="bento-cell-code bento-area-code relative flex min-w-0 flex-col overflow-hidden xl:min-h-0">
    <form
      id="exercise-form"
      method="POST"
      action="?/grade"
      class="flex min-h-[440px] flex-col overflow-hidden bg-code sm:min-h-[520px] xl:min-h-0 xl:flex-1"
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
      <div class="absolute inset-0 z-20 overflow-hidden">
        <button
          type="button"
          class="result-backdrop absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
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

    <section
      class="bento-cell-code bento-area-your flex min-h-[192px] max-h-[256px] flex-col overflow-hidden xl:min-h-0 xl:max-h-none"
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
      class="bento-cell-code bento-area-ref flex min-h-[192px] max-h-[256px] flex-col overflow-hidden xl:min-h-0 xl:max-h-none"
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

  <div
    bind:this={footer}
    class="bento-cell bento-area-footer grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex sm:flex-wrap xl:px-8"
  >
  <a href={data.slideHref} class="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
    <Icon name="arrow-left" size={16} />
    スライドを見る
  </a>
  <button
    type="button"
    onclick={() => (agentOpen = true)}
    class="inline-flex min-h-9 shrink-0 items-center justify-self-end gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink sm:order-3"
    aria-expanded={agentOpen}
    aria-controls="agent-panel"
  >
    <Icon name="sparkles" size={16} />
    AI に聞く
  </button>
  <div class="flex min-w-0 items-center gap-3 sm:order-2 sm:ml-auto sm:w-56">
    <ProgressBar value={progressPercent} size="sm" />
    <span class="shrink-0 text-xs font-medium text-muted">
      {data.lessonProgress.solved} / {data.lessonProgress.total} クリア
    </span>
  </div>
  <button
    type="submit"
    form="exercise-form"
    formaction="?/grade"
    class="btn btn-primary shrink-0 justify-self-end sm:order-4 sm:ml-3 sm:min-h-9"
    title="採点する（⌘/Ctrl + Enter）"
  >
    できた！
  </button>
</div>

  {#if layoutReady}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="bento-resizer bento-resizer-guide"
      role="separator"
      aria-label="手順の幅を調整"
      aria-orientation="vertical"
      aria-valuemin={GUIDE_MIN}
      aria-valuemax={Math.round(maxGuideWidth())}
      aria-valuenow={Math.round(guideWidth)}
      tabindex="0"
      data-dragging={dragging === "guide"}
      title="ドラッグで幅を調整（ダブルクリックで初期値）"
      onpointerdown={(event) => beginDrag("guide", event)}
      onkeydown={(event) => nudge("guide", event)}
      ondblclick={resetLayout}
    ></div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="bento-resizer bento-resizer-results"
      role="separator"
      aria-label="実行結果の幅を調整"
      aria-orientation="vertical"
      aria-valuemin={RESULTS_MIN}
      aria-valuemax={Math.round(maxResultsWidth())}
      aria-valuenow={Math.round(resultsWidth)}
      tabindex="0"
      data-dragging={dragging === "results"}
      title="ドラッグで幅を調整（ダブルクリックで初期値）"
      onpointerdown={(event) => beginDrag("results", event)}
      onkeydown={(event) => nudge("results", event)}
      ondblclick={resetLayout}
    ></div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="bento-resizer bento-resizer-split"
      role="separator"
      aria-label="実行結果とお手本の高さを調整"
      aria-orientation="horizontal"
      aria-valuemin={Math.round(SPLIT_MIN * 100)}
      aria-valuemax={Math.round(SPLIT_MAX * 100)}
      aria-valuenow={Math.round(resultSplit * 100)}
      tabindex="0"
      data-dragging={dragging === "split"}
      title="ドラッグで高さを調整（ダブルクリックで初期値）"
      onpointerdown={(event) => beginDrag("split", event)}
      onkeydown={(event) => nudge("split", event)}
      ondblclick={resetLayout}
    ></div>
  {/if}
</div>

{#key data.exerciseId}
  <AgentPanel
    open={agentOpen}
    onclose={() => (agentOpen = false)}
    courseId={data.courseId}
    exerciseId={data.exerciseId}
    readFiles={currentFiles}
  />
{/key}
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
