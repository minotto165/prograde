<script lang="ts">
  let { data, form } = $props();

  let outcome = $derived(form?.outcome ?? null);
  let files = $derived(outcome?.files ?? data.files);
  let result = $derived(outcome?.result ?? null);
  let solved = $derived(Boolean(outcome?.solved || data.solved));
  let selectedPath = $state<string | null>(null);
  let activeIndex = $derived(selectedPath ? Math.max(0, files.findIndex((file) => file.path === selectedPath)) : 0);
  let lessonUrl = $derived(`/c/${data.courseId}/l/${data.lessonId}`);
  let progressPercent = $derived(
    data.lessonProgress.total > 0 ? Math.round((data.lessonProgress.solved / data.lessonProgress.total) * 100) : 0,
  );
  let status = $derived(
    !result
      ? ""
      : outcome?.kind === "run"
        ? "実行結果"
        : result.ok
          ? "合格"
          : "不合格",
  );

  function line(text: string): string {
    return text.replace(/\r\n/g, "\n");
  }

  function onKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLElement)?.closest("form")?.requestSubmit();
    }
  }

  function confirmReset(event: MouseEvent) {
    if (!confirm("雛形に戻します。いま書いたコードは失われます。")) event.preventDefault();
  }
</script>

<div class="flex flex-col gap-3">
  <nav class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
    <a href="/" class="hover:text-slate-900 hover:underline">コース</a>
    <span class="text-slate-300">/</span>
    <a href={`/c/${data.courseId}`} class="hover:text-slate-900 hover:underline">{data.courseLabel}</a>
    <span class="text-slate-300">/</span>
    <a href={lessonUrl} class="hover:text-slate-900 hover:underline">{data.lessonTitle}</a>
    <span class="ml-auto font-mono text-[11px] text-slate-400">{data.env} ・ {data.xp} XP</span>
  </nav>

  <div class="grid gap-3 lg:grid-cols-[minmax(290px,350px)_minmax(0,1fr)_minmax(320px,390px)] lg:items-start">
    <!-- 左: 手順 -->
    <aside class="overflow-hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-[64px] lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto">
      <div class="border-b border-slate-100 px-5 py-4">
        <p class="text-[11px] font-bold uppercase tracking-widest text-emerald-600">手順</p>
        <h1 class="mt-1 text-lg font-bold leading-snug text-slate-900">{data.title}</h1>
        <p class="mt-1 text-xs text-slate-500">
          演習 {data.lessonProgress.index} / {data.lessonProgress.total}
          {#if solved}<span class="ml-1 font-medium text-emerald-600">・合格済み</span>{/if}
        </p>
        {#if data.objective}
          <p class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
            目標: {data.objective}
          </p>
        {/if}
      </div>

      {#if data.briefHtml}
        <article class="doc px-5 py-4 text-sm text-slate-700">{@html data.briefHtml}</article>
      {/if}

      {#if data.hints.length > 0}
        <div class="border-t border-slate-100 px-5 py-4">
          <details class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <summary class="cursor-pointer font-medium">ヒント（{data.hints.length} 段）</summary>
            <ol class="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
              {#each data.hints as hint, index (index)}<li>{hint}</li>{/each}
            </ol>
          </details>
        </div>
      {/if}

      <div class="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs">
        {#if data.prev}
          <a href={`/c/${data.courseId}/e/${data.prev.id}`} class="truncate text-slate-500 hover:text-slate-900 hover:underline">← {data.prev.title}</a>
        {:else}<span></span>{/if}
        {#if data.next}
          <a href={`/c/${data.courseId}/e/${data.next.id}`} class="truncate text-right text-slate-500 hover:text-slate-900 hover:underline">{data.next.title} →</a>
        {:else}<span></span>{/if}
      </div>
    </aside>

    <!-- 中央: エディタ -->
    <form
      method="POST"
      action="?/grade"
      class="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 lg:sticky lg:top-[64px] lg:h-[calc(100dvh-11rem)]"
    >
      <div class="flex items-center gap-1 overflow-x-auto border-b border-slate-700/60 bg-slate-800 px-2 pt-2">
        {#each files as file, index (file.path)}
          <button
            type="button"
            onclick={() => (selectedPath = file.path)}
            class="shrink-0 rounded-t-md px-3 py-2 font-mono text-[11px] transition-colors {index === activeIndex
              ? 'bg-slate-900 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'}"
          >
            {file.path}
          </button>
        {/each}
        <span class="ml-auto flex shrink-0 items-center gap-2 pb-2 pl-2 pr-1">
          {#if solved}<span class="text-[11px] font-medium text-emerald-400">✓ 合格済み</span>{/if}
          <button
            type="submit"
            formaction="?/reset"
            onclick={confirmReset}
            class="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-700 hover:text-rose-300"
          >
            戻す
          </button>
        </span>
      </div>

      <div class="relative min-h-[280px] flex-1">
        {#each files as file, index (file.path)}
          <textarea
            id={`code-${index}`}
            name={`file:${file.path}`}
            aria-label={file.path}
            spellcheck="false"
            onkeydown={onKeydown}
            class={`${index === activeIndex ? 'absolute inset-0 block' : 'hidden'} h-full w-full resize-none border-0 bg-slate-900 p-4 font-mono text-[13px] leading-6 text-slate-100 caret-emerald-400 focus:outline-none focus:ring-0`}
          >{file.code}</textarea>
        {/each}
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-slate-700/60 bg-slate-800/80 px-3 py-2.5">
        <span class="hidden font-mono text-[11px] text-slate-500 sm:inline">Ctrl/Cmd + Enter</span>
        <button
          type="submit"
          formaction="?/run"
          class="ml-auto rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          実行だけ
        </button>
        <button
          type="submit"
          class="rounded-lg bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-emerald-300"
        >
          採点する
        </button>
      </div>
    </form>

    <!-- 右: コンソールと見本 -->
    <div class="flex flex-col gap-3 lg:sticky lg:top-[64px] lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto">
      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 class="text-sm font-bold text-slate-900">コンソール</h2>
          {#if result}
            <span
              class="rounded-full px-2.5 py-0.5 text-[11px] font-bold {outcome?.kind === 'run'
                ? 'bg-slate-100 text-slate-600'
                : result.ok
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'}"
            >
              {status}
            </span>
          {/if}
        </header>

        <div class="px-4 py-3 text-sm">
          {#if form?.error}
            <div class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <p class="font-semibold">実行できませんでした</p>
              <pre class="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">{form.error}</pre>
              {#if form.remediation}
                <p class="mt-3 font-medium">準備手順:</p>
                <pre class="mt-1 whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px]">{form.remediation}</pre>
              {/if}
            </div>
          {:else if outcome?.kind === "reset"}
            <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">雛形に戻しました。</p>
          {:else if result}
            <div class="flex items-baseline justify-between gap-2 text-[11px] text-slate-400">
              <span>exit {result.exitCode === null ? "-" : result.exitCode}{#if result.timedOut} ・ 時間切れ{/if}</span>
              <span>{result.durationMs}ms</span>
            </div>
            {#if outcome?.kind !== "run"}
              <p class="mt-1 text-xs {result.ok ? 'text-emerald-700' : 'text-rose-700'}">{result.message}</p>
            {/if}

            <ul class="mt-3 grid gap-1.5">
              {#each result.checks as check (check.name)}
                <li class="rounded-lg bg-slate-50 px-2.5 py-2">
                  <div class="flex items-baseline gap-1.5">
                    <span class={check.ok ? "text-emerald-600" : "text-rose-500"}>{check.ok ? "✓" : "×"}</span>
                    <span class="font-mono text-[11px] text-slate-700">{check.name}</span>
                  </div>
                  {#if !check.ok}
                    <div class="mt-1 space-y-0.5 text-[11px] leading-relaxed">
                      <p class="text-slate-500">期待: <code class="break-all rounded bg-white px-1">{check.expected}</code></p>
                      <p class="text-slate-500">実際: <code class="break-all rounded bg-white px-1">{check.actual}</code></p>
                      {#if check.note}<p class="text-amber-700">（{check.note}）</p>{/if}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>

            {#if result.diagnostics.length > 0}
              <div class="mt-3">
                <p class="text-[11px] font-medium text-slate-500">診断</p>
                <ul class="mt-1 grid gap-1">
                  {#each result.diagnostics as diagnostic, index (index)}
                    <li class="rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-slate-700">
                      {#if diagnostic.file ?? diagnostic.line}
                        <span class="text-slate-400">{diagnostic.file ?? ""}{#if diagnostic.line}:{diagnostic.line}{/if} </span>
                      {/if}
                      <span class={diagnostic.severity === "error" ? "text-rose-600" : diagnostic.severity === "warning" ? "text-amber-600" : "text-slate-500"}>{diagnostic.severity}</span>
                      {diagnostic.message}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if result.stdout}
              <div class="mt-3">
                <p class="text-[11px] font-medium text-slate-500">標準出力</p>
                <pre class="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-5 text-slate-100">{line(result.stdout)}</pre>
              </div>
            {/if}
            {#if result.stderr}
              <div class="mt-3">
                <p class="text-[11px] font-medium text-slate-500">標準エラー</p>
                <pre class="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-5 text-rose-200">{line(result.stderr)}</pre>
              </div>
            {/if}
            {#if result.truncated}<p class="mt-2 text-[11px] text-slate-400">出力が長いため途中で切り詰めています。</p>{/if}

            {#if result.ok && outcome?.kind !== "run"}
              {#if data.next}
                <a
                  href={`/c/${data.courseId}/e/${data.next.id}`}
                  class="mt-4 block rounded-lg bg-emerald-500 px-3 py-2 text-center text-xs font-bold text-white hover:bg-emerald-600"
                >
                  次の演習: {data.next.title} →
                </a>
              {:else}
                <a href={`/c/${data.courseId}`} class="mt-4 block rounded-lg bg-emerald-500 px-3 py-2 text-center text-xs font-bold text-white hover:bg-emerald-600">
                  コースへ戻る
                </a>
              {/if}
            {/if}
          {:else}
            <p class="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs leading-relaxed text-slate-400">
              コードを書いて「採点する」を押すと、<br />ここに実行結果が出ます。
            </p>
          {/if}
        </div>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header class="flex items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 class="text-sm font-bold text-slate-900">見本</h2>
          <span class="text-[11px] text-slate-400">この演習の合格条件</span>
        </header>
        <ul class="divide-y divide-slate-100">
          {#each data.expected as item (item.name + item.match)}
            <li class="px-4 py-2.5">
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-mono text-[11px] text-slate-600">{item.name}</span>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{item.match}</span>
              </div>
              <pre class="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-800">{item.expected}</pre>
            </li>
          {/each}
        </ul>
      </section>
    </div>
  </div>

  <!-- 下部: レッスン進捗 -->
  <div class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
    <a href={lessonUrl} class="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">← スライドを見る</a>
    <div class="flex flex-1 items-center gap-3">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full bg-emerald-400 transition-all" style={`width: ${progressPercent}%`}></div>
      </div>
      <span class="shrink-0 text-xs font-medium text-slate-600">{data.lessonProgress.solved} / {data.lessonProgress.total} クリア</span>
    </div>
    <a href="/help" class="text-xs text-slate-500 hover:text-slate-900 hover:underline">よくある質問</a>
  </div>
</div>
