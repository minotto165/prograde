<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let percent = $derived(
    data.progress.total === 0 ? 0 : Math.round((data.progress.solved / data.progress.total) * 100),
  );
</script>

<PageHead title={data.title} description={data.description || `${data.title} のレッスン。`} />

<Breadcrumb
  items={[
    { label: "コース", href: "/" },
    { label: data.courseLabel, href: `/c/${data.courseId}` },
    { label: data.title },
  ]}
/>

<header class="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
  <div class="min-w-0">
    <h1 class="text-2xl font-medium tracking-tight text-ink sm:text-3xl">{data.title}</h1>
    {#if data.description}
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{data.description}</p>
    {/if}
    <p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
      <span>{data.chapters.length} 章・{data.progress.total} セクション</span>
      {#if data.estimateMin}
        <span>約 {data.estimateMin} 分</span>
      {/if}
    </p>
  </div>
  <a href={data.start.href} class="btn btn-primary w-full shrink-0 sm:w-auto">
    {data.start.label}
    <Icon name="arrow-right" size={16} />
  </a>
</header>

<div class="mt-5 flex max-w-md items-center gap-3">
  <ProgressBar value={percent} ariaLabel="レッスンの進捗" size="sm" />
  <p class="shrink-0 text-xs tabular-nums text-muted">
    <strong class="font-medium text-ink">{data.progress.solved}</strong> / {data.progress.total} 演習
  </p>
</div>

{#each data.chapters as chapter (chapter.id)}
  <section class="mt-8">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="flex items-baseline gap-2.5 text-lg font-medium tracking-tight text-ink">
        <span class="font-mono text-xs font-normal text-muted">{String(chapter.index).padStart(2, "0")}</span>
        {chapter.title}
      </h2>
      <span class="shrink-0 text-xs tabular-nums text-muted">{chapter.sections.length} セクション</span>
    </div>

    <ol class="card mt-3 divide-y divide-line overflow-hidden">
      {#each chapter.sections as section (section.id)}
        <li>
          <a
            href={section.href}
            class="group flex items-start gap-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:px-5 {section.isNext
              ? 'bg-brand-soft/35'
              : ''}"
          >
            <span
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium {section.solved
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-muted'}"
            >
              {#if section.solved}
                <Icon name="check" size={16} />
                <span class="sr-only">合格済み</span>
              {:else}
                {section.index}
              {/if}
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="font-medium leading-snug text-ink">{section.title}</span>
                {#if section.isNext}
                  <span class="text-[11px] font-medium text-brand-strong">次はこちら</span>
                {/if}
              </span>
              <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span>スライド {section.slideCount} 枚</span>
                <span aria-hidden="true">·</span>
                <span class="truncate">演習: {section.exercise.title}</span>
              </span>
            </span>

            <Icon
              name="chevron-right"
              size={16}
              className="mt-1 shrink-0 text-muted transition-colors group-hover:text-ink"
            />
          </a>
        </li>
      {/each}
    </ol>
  </section>
{/each}

<nav class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5" aria-label="レッスンの移動">
  {#if data.prevLesson}
    <a href={data.prevLesson.href} class="btn btn-ghost">
      <Icon name="arrow-left" size={16} />
      前のレッスン
    </a>
  {:else}
    <a href={`/c/${data.courseId}`} class="btn btn-ghost">
      <Icon name="arrow-left" size={16} />
      レッスン一覧
    </a>
  {/if}

  {#if data.nextLesson}
    <a href={data.nextLesson.href} class="btn btn-secondary">
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
