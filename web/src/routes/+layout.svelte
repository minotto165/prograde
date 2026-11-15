<script lang="ts">
  import "../app.css";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";

  let { children } = $props();

  let scroller = $state<HTMLDivElement | null>(null);
  let path = $derived($page.url.pathname);
  let wide = $derived(path.includes("/e/") || path.includes("/l/"));
  let coursesActive = $derived(path === "/" || path.startsWith("/c/"));
  let helpActive = $derived(path.startsWith("/help"));

  function navClass(active: boolean): string {
    return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
    }`;
  }

  afterNavigate(() => {
    if (!scroller || window.location.hash) return;
    scroller.scrollTop = 0;
  });
</script>

<a class="skip-link" href="#main">本文へスキップ</a>

<div class="flex min-h-screen flex-col lg:h-dvh lg:overflow-hidden">
  <header class="sticky top-0 z-20 shrink-0 border-b border-line/80 bg-canvas/85 backdrop-blur">
    <div class="mx-auto flex min-h-16 {wide ? 'max-w-[1600px]' : 'max-w-6xl'} flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
      <a href="/" class="flex items-center gap-2.5 rounded-lg" aria-label="prograde ホーム">
        <span class="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-white shadow-sm">P</span>
        <span class="text-lg font-semibold tracking-tight text-ink">prograde</span>
      </a>

      <nav class="ml-auto flex items-center gap-1" aria-label="メイン">
        <a href="/" class={navClass(coursesActive)} aria-current={coursesActive ? "page" : undefined}>コース</a>
        <a href="/help" class={navClass(helpActive)} aria-current={helpActive ? "page" : undefined}>使い方</a>
      </nav>
    </div>
  </header>

  <div bind:this={scroller} class="flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
    <main
      id="main"
      tabindex="-1"
      class={wide
        ? "mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-4 lg:px-6 xl:h-full xl:min-h-0"
        : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"}
    >
      {@render children()}
    </main>
  </div>
</div>
