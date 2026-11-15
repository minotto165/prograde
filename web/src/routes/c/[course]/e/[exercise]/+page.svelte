<script lang="ts">
  import { onMount } from "svelte";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data, form } = $props();

  let outcome = $derived(form?.outcome ?? null);
  let files = $derived(outcome?.files ?? data.files);
  let result = $derived(outcome?.result ?? null);
  let solved = $derived(Boolean(outcome?.solved || data.solved));
  let selectedPath = $state<string | null>(null);
  let resetArmed = $state(false);
  let activeIndex = $derived(
    selectedPath ? Math.max(0, files.findIndex((file) => file.path === selectedPath)) : 0,
  );
  let lessonUrl = $derived(`/c/${data.courseId}/l/${data.lessonId}`);
  let progressPercent = $derived(
    data.lessonProgress.total > 0
      ? Math.round((data.lessonProgress.solved / data.lessonProgress.total) * 100)
      : 0,
  );
  let passedCount = $derived(result ? result.checks.filter((check) => check.ok).length : 0);
  let referenceOverride = $state<typeof data.reference>(null);
  let reference = $derived(referenceOverride ?? data.reference);
  let referenceBusy = $state(false);

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
    if (!form?.outcome && !form?.error) return;
    if (window.matchMedia("(max-width: 1279px)").matches) {
      document.getElementById("result")?.scrollIntoView({ block: "start" });
    }
  });
</script>

<PageHead
  title={data.title}
  description={`${data.lessonTitle} の演習。${data.objective || "コードを書いて実行結果で確かめます。"}`}
/>

<div class="xl:flex xl:h-full xl:min-h-0 xl:flex-col">
<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
  <Breadcrumb
    items={[
      { label: data.courseLabel, href: `/c/${data.courseId}` },
      { label: data.lessonTitle, href: lessonUrl },
    ]}
  />
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:ml-auto">
    <span class="font-mono">演習 {data.position.index} / {data.position.total}</span>
    <span class="font-mono">{data.env}</span>
    {#if solved}
      <span class="inline-flex items-center gap-1 font-medium text-brand-strong">
        <Icon name="check" size={13} />
        合格済み
      </span>
    {/if}
  </div>
</div>

<h1 class="mt-2 text-xl font-medium leading-tight tracking-tight text-ink sm:text-2xl">
  {data.title}
</h1>

<div
  class="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(270px,310px)_minmax(0,1fr)_minmax(320px,370px)] xl:items-stretch"
>
  <aside
    class="card overflow-hidden xl:h-full xl:overflow-y-auto"
    aria-label="この演習の手順"
  >
    <div class="border-b border-line px-5 py-4">
      <div class="flex items-center justify-between gap-2">
        <p class="meta-label">手順</p>
        <span class="text-xs tabular-nums text-muted">
          {data.lessonProgress.index} / {data.lessonProgress.total}
        </span>
      </div>
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
          ヒント（{data.hints.length} 段）
          <Icon name="chevron-down" size={14} className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <ol class="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-ink-soft">
          {#each data.hints as hint, index (index)}
            <li>{hint}</li>
          {/each}
        </ol>
      </details>
    {/if}

  </aside>

  <div class="flex min-w-0 flex-col gap-4 xl:contents">
    <form
      id="exercise-form"
      method="POST"
      action="?/grade"
      class="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-code shadow-sm xl:h-full xl:min-h-0"
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
            class="rounded-md bg-danger px-3 py-1.5 font-medium text-white hover:bg-danger/90"
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

  <div id="result" class="flex min-h-0 scroll-mt-28 flex-col gap-4 xl:h-full xl:overflow-y-auto">
    <section
      class="card flex min-h-0 flex-col overflow-hidden xl:flex-1"
      aria-label="あなたの実行結果"
      aria-live="polite"
    >
      <header class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 class="text-xs font-medium text-ink-soft">あなたの実行結果</h3>
        <div class="flex items-center gap-2">
          {#if result}
            <span class="font-mono text-[11px] text-muted">
              exit {result.exitCode === null ? "-" : result.exitCode}
              {#if result.timedOut} · 時間切れ{/if}
              · {result.durationMs}ms
            </span>
          {/if}
          <button
            type="submit"
            form="exercise-form"
            formaction="?/run"
            class="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="コードを実行"
            title="コードを実行"
          >
            <Icon name="play" size={15} />
          </button>
        </div>
      </header>
      <div class="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {#if form?.error}
          <div class="rounded-xl border border-danger/20 bg-danger-soft p-4 text-xs text-danger">
            <p class="font-medium">実行できませんでした</p>
            <pre class="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{form.error}</pre>
            {#if form.remediation}
              <p class="mt-3 font-medium">準備手順</p>
              <pre class="mt-1 whitespace-pre-wrap break-words rounded-lg bg-white/70 p-2.5 font-mono text-[11px] leading-relaxed">{form.remediation}</pre>
            {/if}
          </div>
        {:else if outcome?.kind === "reset"}
          <p class="text-sm leading-relaxed text-ink-soft">
            雛形に戻しました。もう一度コードを書いて採点してください。
          </p>
        {:else if result}
          {#if result.stdout}
            <p class="text-xs font-medium text-muted">標準出力</p>
            <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-[11px] leading-5 text-white/90">{line(result.stdout)}</pre>
          {/if}
          {#if result.stderr}
            <div class="mt-3">
              <p class="text-xs font-medium text-muted">標準エラー</p>
              <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-[11px] leading-5 text-danger-soft">{line(result.stderr)}</pre>
            </div>
          {/if}
          {#if !result.stdout && !result.stderr}
            <p class="text-xs text-muted">出力はありません。</p>
          {/if}
          {#if result.truncated}
            <p class="mt-2 text-xs text-muted">出力が長いため途中で切り詰めています。</p>
          {/if}
        {:else}
          <p class="text-xs leading-relaxed text-muted">まだ実行していません。</p>
        {/if}
      </div>
    </section>

    <section
      class="card flex min-h-0 flex-col overflow-hidden xl:flex-1"
      aria-label="お手本の実行結果"
    >
      <header class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 class="text-xs font-medium text-ink-soft">お手本の実行結果</h3>
        <div class="flex items-center gap-2">
          {#if reference}
            <span class="font-mono text-[11px] text-muted">
              exit {reference.exitCode === null ? "-" : reference.exitCode}
              {#if reference.timedOut} · 時間切れ{/if}
              · {reference.durationMs}ms
            </span>
          {/if}
          <button
            type="button"
            onclick={rerunReference}
            disabled={referenceBusy}
            class="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            aria-label="お手本を実行"
            title="お手本を実行"
          >
            <Icon name="play" size={15} />
          </button>
        </div>
      </header>
      <div class="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        {#if reference}
          {#if reference.stdout}
            <p class="text-xs font-medium text-muted">標準出力</p>
            <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-[11px] leading-5 text-white/90">{line(reference.stdout)}</pre>
          {/if}
          {#if reference.stderr}
            <div class="mt-3">
              <p class="text-xs font-medium text-muted">標準エラー</p>
              <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-[11px] leading-5 text-danger-soft">{line(reference.stderr)}</pre>
            </div>
          {/if}
          {#if !reference.stdout && !reference.stderr}
            <p class="text-xs text-muted">出力はありません。</p>
          {/if}
          {#if reference.truncated}
            <p class="mt-2 text-xs text-muted">出力が長いため途中で切り詰めています。</p>
          {/if}
        {:else}
          <p class="text-xs leading-relaxed text-muted">お手本の出力を取得できませんでした。</p>
        {/if}
      </div>
    </section>

    {#if result && outcome?.kind !== "run"}
      <details class="group shrink-0">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 border-t border-line px-1 py-2.5 text-xs">
          <span class="font-medium text-ink">判定</span>
          <span class="flex items-center gap-1 font-medium {result.ok ? 'text-brand-strong' : 'text-danger'}">
            <Icon name={result.ok ? "check" : "x"} size={13} />
            {result.ok ? "合格" : "不合格"} · {passedCount} / {result.checks.length}
            <Icon name="chevron-down" size={14} className="ml-1 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div class="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface px-4 py-3">
          <p class="text-sm leading-relaxed {result.ok ? 'font-medium text-brand-strong' : 'text-danger'}">{result.message}</p>
          <ul class="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {#each result.checks as check, index (index)}
              <li class="px-4 py-3 {check.ok ? 'bg-surface' : 'bg-danger-soft/40'}">
                <div class="flex items-start gap-2">
                  <span
                    class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full {check.ok
                      ? 'bg-brand-soft text-brand-strong'
                      : 'bg-danger-soft text-danger'}"
                  >
                    <Icon name={check.ok ? "check" : "x"} size={12} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-mono text-xs font-medium text-ink-soft">{check.name}</p>
                    {#if !check.ok}
                      <dl class="mt-1.5 space-y-1 text-xs leading-relaxed">
                        <div class="flex gap-1.5">
                          <dt class="shrink-0 text-muted">期待</dt>
                          <dd class="min-w-0 break-all"><code class="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">{check.expected}</code></dd>
                        </div>
                        <div class="flex gap-1.5">
                          <dt class="shrink-0 text-muted">実際</dt>
                          <dd class="min-w-0 break-all"><code class="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">{check.actual}</code></dd>
                        </div>
                      </dl>
                      {#if check.note}<p class="mt-1 text-xs text-accent">（{check.note}）</p>{/if}
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ul>
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
      </details>
    {/if}

    {#if result?.ok && outcome?.kind === "grade"}
      {#if data.nextStep}
        <a href={data.nextStep.href} class="btn btn-primary w-full shrink-0">
          {data.nextStep.kind === "slide"
            ? "次のスライドへ"
            : data.nextStep.kind === "exercise"
              ? "次の演習へ"
              : "次のレッスンへ"}
          <Icon name="arrow-right" size={15} />
        </a>
      {:else}
        <a href={'/c/' + data.courseId} class="btn btn-primary w-full shrink-0">
          コースへ戻る
          <Icon name="arrow-right" size={15} />
        </a>
      {/if}
    {/if}
  </div>
  </div>
</div>

<div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 xl:shrink-0">
  <a href={data.slideHref} class="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
    <Icon name="arrow-left" size={14} />
    スライドを見る
  </a>
  <a href="/help" class="ml-auto inline-flex min-h-9 items-center text-xs text-muted hover:text-ink sm:order-3 sm:ml-0">ヘルプ</a>
  <div class="flex w-full items-center gap-3 sm:order-2 sm:w-auto sm:flex-1">
    <ProgressBar value={progressPercent} size="sm" />
    <span class="shrink-0 text-xs font-medium text-muted">
      {data.lessonProgress.solved} / {data.lessonProgress.total} クリア
    </span>
  </div>
  <button
    type="submit"
    form="exercise-form"
    formaction="?/grade"
    class="btn btn-primary ml-auto min-h-9 shrink-0 sm:order-4 sm:ml-0"
    title="採点する（⌘/Ctrl + Enter）"
  >
    できた！
  </button>
</div>
</div>
