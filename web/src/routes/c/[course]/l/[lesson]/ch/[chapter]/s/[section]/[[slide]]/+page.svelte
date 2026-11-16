<script lang="ts">
  import { goto } from "$app/navigation";
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let percent = $derived(
    data.slide.total === 0 ? 0 : Math.round((data.slide.index / data.slide.total) * 100),
  );

  let prevHref = $derived(data.prev?.href ?? data.lessonHref);
  let nextHref = $derived(data.next?.href ?? data.nextLesson?.href ?? null);

  function isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    );
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditable(event.target)) return;

    const href =
      event.key === "ArrowLeft" ? prevHref : event.key === "ArrowRight" ? nextHref : null;
    if (!href) return;

    event.preventDefault();
    void goto(href);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<PageHead title={data.sectionTitle} description={data.lessonDescription || `${data.lessonTitle} のスライド。`} />

<div class="mx-auto w-full max-w-3xl">
<Breadcrumb
  items={[
    { label: "コース", href: "/" },
    { label: data.courseLabel, href: `/c/${data.courseId}` },
    { label: data.lessonTitle, href: data.lessonHref },
    { label: data.sectionTitle },
  ]}
/>

<header class="mt-3">
  <p class="text-xs font-medium text-muted">第{data.chapterIndex}章 · {data.chapterTitle}</p>
  <h1 class="mt-1 text-2xl font-medium tracking-tight text-ink sm:text-3xl">{data.sectionTitle}</h1>
</header>

<div class="mt-5 flex items-center gap-3">
  <ProgressBar value={percent} ariaLabel="セクションのスライド" size="sm" />
  <span class="shrink-0 text-xs font-medium tabular-nums text-muted">
    スライド {data.slide.index} / {data.slide.total}
  </span>
  {#if data.sectionSolved}
    <span class="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-strong">
      <Icon name="check" size={16} />
      合格済み
    </span>
  {/if}
</div>

<article class="bento mt-4 overflow-hidden">
  <div class="bento-cell px-5 py-7 sm:px-10 sm:py-10">
    <div class="doc">
      {@html data.slideHtml}
    </div>
  </div>

  <nav
    class="bento-cell flex flex-wrap items-center justify-between gap-3 bg-surface-2 px-4 py-3 sm:px-8"
    aria-label="セクションの移動"
  >
    {#if data.prev}
      <a href={data.prev.href} class="btn btn-ghost">
        <Icon name="arrow-left" size={16} />
        {data.prev.label}
      </a>
    {:else}
      <a href={data.lessonHref} class="btn btn-ghost">
        <Icon name="arrow-left" size={16} />
        レッスン一覧
      </a>
    {/if}

    {#if data.next}
      <a href={data.next.href} class="btn btn-primary">
        {data.next.label}
        <Icon name="arrow-right" size={16} />
      </a>
    {:else if data.nextLesson}
      <a href={data.nextLesson.href} class="btn btn-primary">
        次のレッスン
        <Icon name="arrow-right" size={16} />
      </a>
    {:else}
      <a href={`/c/${data.courseId}`} class="btn btn-secondary">
        コース一覧へ
        <Icon name="arrow-right" size={16} />
      </a>
    {/if}
  </nav>
</article>
</div>
