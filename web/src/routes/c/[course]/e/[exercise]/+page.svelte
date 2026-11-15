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
  let status = $derived(
    form?.error
      ? "エラー"
      : outcome?.kind === "reset"
        ? "リセット"
        : outcome?.kind === "run"
          ? "実行結果"
          : result
            ? result.ok
              ? "合格"
              : "不合格"
            : "未採点",
  );
  let statusTone = $derived(
    form?.error
      ? "chip-danger"
      : outcome?.kind === "run"
        ? ""
        : result?.ok
          ? "chip-brand"
          : result
            ? "chip-danger"
            : "",
  );
  let passedCount = $derived(result ? result.checks.filter((check) => check.ok).length : 0);

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

<Breadcrumb
  items={[
    { label: "コース", href: "/" },
    { label: data.courseLabel, href: `/c/${data.courseId}` },
    { label: data.lessonTitle, href: lessonUrl },
    { label: data.title },
  ]}
/>

<div class="mt-3 flex flex-wrap items-start justify-between gap-3">
  <div class="min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <p class="eyebrow">EXERCISE {data.position.index} / {data.position.total}</p>
      {#if solved}
        <span class="chip chip-brand">
          <Icon name="check" size={13} />
          合格済み
        </span>
      {/if}
    </div>
    <h1 class="mt-1 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
      {data.title}
    </h1>
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <span class="chip font-mono">{data.env}</span>
    <span class="chip">{data.xp} XP</span>
    {#if data.attempts > 0}
      <span class="chip">{data.attempts} 回挑戦</span>
    {/if}
  </div>
</div>

<div
  class="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(270px,310px)_minmax(0,1fr)_minmax(320px,370px)]"
>
  <aside
    class="card overflow-hidden xl:sticky xl:top-[80px] xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto"
    aria-label="この演習の手順"
  >
    <div class="border-b border-line px-5 py-4">
      <div class="flex items-center justify-between gap-2">
        <p class="eyebrow">手順</p>
        <span class="text-xs tabular-nums text-muted">
          {data.lessonProgress.index} / {data.lessonProgress.total}
        </span>
      </div>
      {#if data.objective}
        <div class="mt-3 rounded-xl bg-brand-soft px-3.5 py-3">
          <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-strong">目標</p>
          <p class="mt-1 text-sm leading-relaxed text-ink-soft">{data.objective}</p>
        </div>
      {/if}
      {#if solved}
        <span class="chip chip-brand mt-3">
          <Icon name="check" size={13} />
          合格済み
        </span>
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
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-accent">
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

    {#if data.lessonExercises.length > 1}
      <div class="border-t border-line px-5 py-4">
        <p class="text-xs font-semibold text-ink">このレッスンの演習</p>
        <ol class="mt-2 grid gap-1">
          {#each data.lessonExercises as item, index (item.id)}
            <li>
              <a
                href={`/c/${data.courseId}/e/${item.id}`}
                aria-current={item.id === data.exerciseId ? "page" : undefined}
                class="flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors {item.id ===
                data.exerciseId
                  ? 'bg-brand-soft font-medium text-brand-strong'
                  : 'text-ink-soft hover:bg-surface-2'}"
              >
                <span
                  class="grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold {item.solved
                    ? 'border-brand/30 bg-brand-soft text-brand-strong'
                    : 'border-line bg-surface text-muted'}"
                >
                  {#if item.solved}
                    <Icon name="check" size={11} />
                  {:else}
                    {index + 1}
                  {/if}
                </span>
                <span class="min-w-0 truncate">{item.title}</span>
              </a>
            </li>
          {/each}
        </ol>
      </div>
    {/if}

    <div class="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs">
      {#if data.prev}
        <a href={`/c/${data.courseId}/e/${data.prev.id}`} class="flex min-w-0 items-center gap-1 text-muted hover:text-ink">
          <Icon name="arrow-left" size={13} className="shrink-0" />
          <span class="truncate">{data.prev.title}</span>
        </a>
      {:else}
        <span></span>
      {/if}
      {#if data.next}
        <a href={`/c/${data.courseId}/e/${data.next.id}`} class="flex min-w-0 items-center gap-1 text-right text-muted hover:text-ink">
          <span class="truncate">{data.next.title}</span>
          <Icon name="arrow-right" size={13} className="shrink-0" />
        </a>
      {:else}
        <span></span>
      {/if}
    </div>
  </aside>

  <div class="flex min-w-0 flex-col gap-4 xl:contents">
    <form
      method="POST"
      action="?/grade"
      class="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-code shadow-sm xl:sticky xl:top-[80px] xl:h-[calc(100dvh-6.5rem)]"
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
                : 'text-white/45 hover:bg-white/5 hover:text-white/80'}"
            >
              {file.path}
            </button>
          {/each}
        </div>
        <div class="flex shrink-0 items-center gap-2 px-2">
          {#if solved}
            <span class="hidden text-[11px] font-medium text-brand-soft sm:inline">合格済み</span>
          {/if}
          <button
            type="button"
            onclick={() => (resetArmed = true)}
            class="rounded-lg px-2 py-1.5 text-[11px] text-white/45 transition-colors hover:bg-white/10 hover:text-danger-soft"
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
            class="rounded-md bg-danger px-3 py-1.5 font-semibold text-white hover:bg-danger/90"
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

      <div class="flex flex-wrap items-center gap-2 border-t border-white/10 bg-white/[0.04] px-3 py-2.5">
        <span class="hidden items-center gap-1 text-[11px] text-white/40 sm:flex">
          <span class="rounded border border-white/15 px-1.5 py-0.5 font-mono">⌘/Ctrl</span>
          <span>+</span>
          <span class="rounded border border-white/15 px-1.5 py-0.5 font-mono">Enter</span>
          <span>で採点</span>
        </span>
        <div class="ml-auto flex items-center gap-2">
          <button
            type="submit"
            formaction="?/run"
            class="btn border border-white/20 text-white/80 hover:bg-white/10"
          >
            実行だけ
          </button>
          <button type="submit" class="btn bg-brand font-bold text-white hover:bg-brand-strong">
            採点する
          </button>
        </div>
      </div>
    </form>

    <section
      id="result"
      aria-live="polite"
      class="card scroll-mt-28 overflow-hidden xl:sticky xl:top-[80px] xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto"
    >
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 class="text-sm font-bold text-ink">結果</h2>
        <span class="chip {statusTone}">
          {#if status === "合格"}
            <Icon name="check" size={13} />
          {:else if status === "不合格" || status === "エラー"}
            <Icon name="x" size={13} />
          {/if}
          {status}
        </span>
      </header>

      <div class="p-4">
        {#if form?.error}
          <div class="rounded-xl border border-danger/20 bg-danger-soft p-3.5 text-xs text-danger">
            <p class="font-semibold">実行できませんでした</p>
            <pre class="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{form.error}</pre>
            {#if form.remediation}
              <p class="mt-3 font-semibold">準備手順</p>
              <pre class="mt-1 whitespace-pre-wrap break-words rounded-lg bg-white/70 p-2.5 font-mono text-[11px] leading-relaxed">{form.remediation}</pre>
            {/if}
          </div>
        {:else if outcome?.kind === "reset"}
          <div class="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-ink-soft">
            雛形に戻しました。もう一度コードを書いて採点してください。
          </div>
        {:else if result}
          <div class="flex items-baseline justify-between gap-2 text-[11px] text-muted">
            <span>
              exit {result.exitCode === null ? "-" : result.exitCode}
              {#if result.timedOut} ・ 時間切れ{/if}
            </span>
            <span class="tabular-nums">{result.durationMs}ms</span>
          </div>

          {#if outcome?.kind !== "run"}
            <p class="mt-1 text-sm {result.ok ? 'font-medium text-brand-strong' : 'text-danger'}">
              {result.message}
            </p>
          {/if}

          <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span class="chip">判定 {passedCount} / {result.checks.length}</span>
            {#if result.timedOut}<span class="chip chip-danger">時間切れ</span>{/if}
            {#if result.truncated}<span class="chip">出力を切り詰め</span>{/if}
          </div>

          <ul class="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {#each result.checks as check, index (index)}
              <li class="px-3.5 py-3 {check.ok ? 'bg-surface' : 'bg-danger-soft/40'}">
                <div class="flex items-start gap-2">
                  <span
                    class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full {check.ok
                      ? 'bg-brand-soft text-brand-strong'
                      : 'bg-danger-soft text-danger'}"
                  >
                    <Icon name={check.ok ? "check" : "x"} size={12} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-mono text-[11px] font-medium text-ink-soft">{check.name}</p>
                    {#if !check.ok}
                      <dl class="mt-1.5 space-y-1 text-[11px] leading-relaxed">
                        <div class="flex gap-1.5">
                          <dt class="shrink-0 text-muted">期待</dt>
                          <dd class="min-w-0 break-all"><code class="rounded bg-surface px-1 py-0.5 font-mono">{check.expected}</code></dd>
                        </div>
                        <div class="flex gap-1.5">
                          <dt class="shrink-0 text-muted">実際</dt>
                          <dd class="min-w-0 break-all"><code class="rounded bg-surface px-1 py-0.5 font-mono">{check.actual}</code></dd>
                        </div>
                      </dl>
                      {#if check.note}<p class="mt-1 text-[11px] text-accent">（{check.note}）</p>{/if}
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ul>

          {#if result.diagnostics.length > 0}
            <div class="mt-3">
              <p class="text-[11px] font-semibold text-muted">診断</p>
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

          {#if result.stdout}
            <div class="mt-3">
              <p class="text-[11px] font-semibold text-muted">標準出力</p>
              <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-[11px] leading-5 text-white/90">{line(result.stdout)}</pre>
            </div>
          {/if}
          {#if result.stderr}
            <div class="mt-3">
              <p class="text-[11px] font-semibold text-muted">標準エラー</p>
              <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-code p-3 font-mono text-[11px] leading-5 text-danger-soft">{line(result.stderr)}</pre>
            </div>
          {/if}
          {#if result.truncated}
            <p class="mt-2 text-[11px] text-muted">出力が長いため途中で切り詰めています。</p>
          {/if}

          {#if result.ok && outcome?.kind === "grade"}
            <div class="mt-4 rounded-xl border border-brand/20 bg-brand-soft p-3.5">
              <p class="text-xs font-semibold text-brand-strong">合格しました</p>
              <p class="mt-0.5 text-xs leading-relaxed text-ink-soft">
                {#if data.next}次の演習に進みましょう。{:else}このコースの演習はすべて完了です。{/if}
              </p>
              {#if data.next}
                <a href={`/c/${data.courseId}/e/${data.next.id}`} class="btn btn-primary mt-3 w-full">
                  次の演習: {data.next.title}
                  <Icon name="arrow-right" size={15} />
                </a>
              {:else}
                <a href={`/c/${data.courseId}`} class="btn btn-primary mt-3 w-full">
                  コースへ戻る
                  <Icon name="arrow-right" size={15} />
                </a>
              {/if}
            </div>
          {/if}
        {:else}
          <div class="flex flex-col items-center px-2 py-6 text-center">
            <span class="grid size-11 place-items-center rounded-xl bg-surface-2 text-muted">
              <Icon name="terminal" size={22} />
            </span>
            <p class="mt-3 text-sm font-semibold text-ink">まだ採点していません</p>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              コードを書いて「採点する」を押すと、<br class="hidden sm:block" />ここに実行結果と判定が出ます。
            </p>
          </div>

          {#if data.expected.length > 0}
            <details class="group rounded-xl border border-line bg-surface-2">
              <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-xs font-semibold text-ink-soft">
                合格条件（{data.expected.length} 件）
                <Icon name="chevron-down" size={14} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ul class="border-t border-line px-3.5 py-3">
                {#each data.expected as item, index (index)}
                  <li class="py-1.5">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="font-mono text-[11px] text-ink-soft">{item.name}</span>
                      <span class="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">{item.match}</span>
                    </div>
                    <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-ink">{item.expected}</pre>
                  </li>
                {/each}
              </ul>
            </details>
          {/if}
        {/if}
      </div>
    </section>
  </div>
</div>

<div class="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
  <a href={lessonUrl} class="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
    <Icon name="arrow-left" size={14} />
    スライドを見る
  </a>
  <div class="flex flex-1 items-center gap-3">
    <ProgressBar value={progressPercent} size="sm" />
    <span class="shrink-0 text-xs font-medium text-muted">
      {data.lessonProgress.solved} / {data.lessonProgress.total} クリア
    </span>
  </div>
  <a href="/help" class="inline-flex min-h-9 items-center text-xs text-muted hover:text-ink">ヘルプ</a>
</div>
