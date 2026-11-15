<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let percent = $derived(
    data.slide ? Math.round((data.slide.index / data.slide.total) * 100) : 0,
  );
</script>

<PageHead title={data.title} description={data.goal || `${data.title} のレッスン。`} />

<Breadcrumb
  items={[
    { label: "コース", href: "/" },
    { label: data.courseLabel, href: `/c/${data.courseId}` },
    { label: data.title },
  ]}
/>

<header class="mt-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
  <div class="min-w-0">
    <h1 class="text-2xl font-medium tracking-tight text-ink sm:text-3xl">{data.title}</h1>
    {#if data.goal}
      <p class="mt-1 text-sm leading-relaxed text-ink-soft">{data.goal}</p>
    {/if}
  </div>
  <p class="shrink-0 text-xs tabular-nums text-muted">演習 {data.solved} / {data.totalExercises}</p>
</header>

{#if data.slide}
  <div class="mt-5 flex items-center gap-3">
    <ProgressBar value={percent} size="sm" />
    <span class="shrink-0 text-xs font-medium tabular-nums text-muted">
      スライド {data.slide.index} / {data.slide.total}
    </span>
  </div>

  <article class="card mt-3 overflow-hidden">
    <div class="px-5 py-7 sm:px-9 sm:py-9">
      <div class="doc mx-auto max-w-[68ch]">
        {@html data.slideHtml}
      </div>
    </div>

    <nav
      class="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-3 sm:px-6"
      aria-label="レッスンの移動"
    >
      {#if data.prevStep}
        <a href={data.prevStep.href} class="btn btn-ghost">
          <Icon name="arrow-left" size={16} />
          {data.prevStep.kind === "exercise" ? "前の演習へ" : "前へ"}
        </a>
      {:else}
        <a href={`/c/${data.courseId}`} class="btn btn-ghost">
          <Icon name="arrow-left" size={16} />
          レッスン一覧
        </a>
      {/if}

      {#if data.nextStep}
        <a href={data.nextStep.href} class="btn btn-primary">
          {data.nextStep.kind === "exercise" ? "演習へ進む" : "次へ"}
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
{:else}
  <p class="mt-6 rounded-xl border border-dashed border-line bg-surface-2 px-5 py-6 text-sm text-muted">
    このレッスンにはスライドがありません。
  </p>
{/if}
