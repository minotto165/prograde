<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import Icon from "$lib/components/Icon.svelte";

  let { data, children } = $props();

  let path = $derived($page.url.pathname);
  let wide = $derived(path.includes("/e/"));
  let coursesActive = $derived(path === "/" || path.startsWith("/c/"));
  let helpActive = $derived(path.startsWith("/help"));

  function navClass(active: boolean): string {
    return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
    }`;
  }
</script>

<a class="skip-link" href="#main">本文へスキップ</a>

<div class="flex min-h-screen flex-col">
  <header class="sticky top-0 z-20 border-b border-line/80 bg-canvas/85 backdrop-blur">
    <div class="mx-auto flex min-h-16 {wide ? 'max-w-[1600px]' : 'max-w-6xl'} flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
      <a href="/" class="flex items-center gap-2.5 rounded-lg" aria-label="prograde ホーム">
        <span class="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-white shadow-sm">P</span>
        <span class="text-lg font-semibold tracking-tight text-ink">prograde</span>
      </a>
      <span class="hidden text-xs text-muted md:inline">ローカル完結の練習プラットフォーム</span>

      <nav class="ml-auto flex items-center gap-1" aria-label="メイン">
        <a href="/" class={navClass(coursesActive)} aria-current={coursesActive ? "page" : undefined}>コース</a>
        <a href="/help" class={navClass(helpActive)} aria-current={helpActive ? "page" : undefined}>使い方</a>
      </nav>

      <div class="flex items-center gap-2.5 text-xs text-muted" aria-label="学習状況">
        <span class="tabular-nums">Lv {data.totals.level}</span>
        <span class="hidden tabular-nums sm:inline">{data.totals.xp} XP</span>
        {#if data.totals.streak > 0}
          <span class="inline-flex items-center gap-1 tabular-nums text-accent" title="連続学習日数">
            <Icon name="flame" size={13} />
            {data.totals.streak}日
          </span>
        {/if}
      </div>
    </div>
  </header>

  <main
    id="main"
    tabindex="-1"
    class={wide
      ? "mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-4 lg:px-6"
      : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"}
  >
    {@render children()}
  </main>

  {#if !wide}
    <footer class="mt-auto border-t border-line/70">
      <div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>採点はこのマシンの中だけで完結します。</p>
        <p>
          データの保存先は <a href="/help#data" class="font-medium text-ink-soft underline underline-offset-2 hover:text-ink">ヘルプ</a> を参照してください。
        </p>
      </div>
    </footer>
  {/if}
</div>
