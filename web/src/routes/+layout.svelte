<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  let { data, children } = $props();
  // 演習画面だけは画面幅いっぱいの3ペインを使う。
  let wide = $derived($page.url.pathname.includes("/e/"));
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
  <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <a href="/" class="text-lg font-bold tracking-tight">prograde</a>
      <span class="hidden text-xs text-slate-500 sm:inline">ローカル完結の練習プラットフォーム</span>
      <nav class="ml-auto flex items-center gap-3 text-sm">
        <a href="/" class="text-slate-600 hover:text-slate-900">コース</a>
        <a href="/help" class="text-slate-600 hover:text-slate-900">使い方</a>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Lv {data.totals.level}
        </span>
        <span class="hidden text-xs text-slate-500 sm:inline">{data.totals.xp} XP</span>
        {#if data.totals.streak > 0}
          <span class="hidden text-xs text-amber-600 sm:inline">🔥 {data.totals.streak}日</span>
        {/if}
      </nav>
    </div>
  </header>
  {#if wide}
    <main class="px-4 py-4 lg:px-6">
      {@render children()}
    </main>
  {:else}
    <main class="mx-auto max-w-5xl px-4 py-8">
      {@render children()}
    </main>
    <footer class="mx-auto max-w-5xl px-4 pb-10 pt-4 text-xs text-slate-400">
      採点はこのマシンの中だけで完結します。
    </footer>
  {/if}
</div>
