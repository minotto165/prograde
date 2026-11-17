<script lang="ts">
  import "../app.css";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  let { children } = $props();

  let scroller = $state<HTMLDivElement | null>(null);
  let path = $derived($page.url.pathname);
  let wide = $derived(path.includes("/e/"));
  let narrow = $derived(!wide && path.includes("/ch/"));
  let coursesActive = $derived(path === "/" || path.startsWith("/c/"));

  type ExerciseHeader = {
    courseId?: string;
    courseLabel?: string;
    lessonTitle?: string;
    lessonHref?: string;
    sectionTitle?: string;
    sectionHref?: string;
    title?: string;
  };

  let exercise = $derived(wide ? ($page.data as ExerciseHeader) : null);

  let exerciseCrumbs = $derived.by(() => {
    if (!exercise) return [];
    const items: { label: string; href?: string }[] = [];
    if (exercise.courseLabel && exercise.courseId) {
      items.push({ label: exercise.courseLabel, href: `/c/${exercise.courseId}` });
    }
    if (exercise.lessonTitle) {
      items.push({ label: exercise.lessonTitle, href: exercise.lessonHref });
    }
    if (exercise.sectionTitle && exercise.sectionTitle !== exercise.title) {
      items.push({ label: exercise.sectionTitle, href: exercise.sectionHref });
    }
    if (exercise.title) items.push({ label: exercise.title });
    return items;
  });

  function navClass(active: boolean): string {
    return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-surface text-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
    }`;
  }

  const THEME_KEY = "prograde-theme";

  function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#171411" : "#F6F4EF");
  }

  function toggleTheme() {
    const dark = !document.documentElement.classList.contains("dark");
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {}
    applyTheme(dark);
  }

  onMount(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const followSystem = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {}
      if (!stored) applyTheme(media.matches);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      if (event.newValue === "dark" || event.newValue === "light") {
        applyTheme(event.newValue === "dark");
      } else {
        applyTheme(media.matches);
      }
    };

    media.addEventListener("change", followSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", followSystem);
      window.removeEventListener("storage", onStorage);
    };
  });

  afterNavigate(() => {
    if (!scroller || window.location.hash) return;
    scroller.scrollTop = 0;
  });
</script>

<a class="skip-link" href="#main">本文へスキップ</a>

{#snippet themeToggle()}
  <button
    type="button"
    onclick={toggleTheme}
    class="grid size-9 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
    aria-label="表示テーマを切り替える"
    title="ライト／ダークを切り替える"
  >
    <Icon name="moon" size={16} className="dark:hidden" />
    <Icon name="sun" size={16} className="hidden dark:block" />
  </button>
{/snippet}

<div class="flex min-h-screen flex-col lg:h-dvh lg:overflow-hidden">
  <header class="sticky top-0 z-20 shrink-0 border-b border-line/80 bg-canvas/85 backdrop-blur">
    <div class={wide
      ? "w-full px-4 sm:px-6 lg:px-8"
      : "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"}>
      <div class="flex min-h-16 w-full flex-wrap items-center gap-x-3 gap-y-2 py-2.5 {narrow ? 'mx-auto max-w-3xl' : ''}">
        <a href="/" class="order-1 rounded-lg text-lg font-semibold tracking-tight text-ink" aria-label="prograde ホーム">
          prograde
        </a>

        {#if exercise && exercise.title && exercise.courseId && exercise.courseLabel}
          <div class="order-3 flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:order-2 md:w-auto md:flex-1">
            <Breadcrumb items={exerciseCrumbs} />
          </div>
        {/if}

        {#if wide}
          <div class="order-2 ml-auto flex items-center gap-1 md:order-3">
            {@render themeToggle()}
          </div>
        {:else}
          <nav class="order-2 ml-auto flex items-center gap-1 md:order-3" aria-label="メイン">
            <a href="/" class={navClass(coursesActive)} aria-current={coursesActive ? "page" : undefined}>コース</a>
            {@render themeToggle()}
          </nav>
        {/if}
      </div>
    </div>
  </header>

  <div bind:this={scroller} class="flex flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
    <main
      id="main"
      tabindex="-1"
      class={wide
        ? "w-full flex-1 xl:h-full xl:min-h-0"
        : "mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"}
    >
      {@render children()}
    </main>
  </div>
</div>
