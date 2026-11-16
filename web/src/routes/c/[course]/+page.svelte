<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let percent = $derived(
    data.stats.total === 0 ? 0 : Math.round((data.stats.solved / data.stats.total) * 100),
  );
</script>

<PageHead
  title={data.label}
  description={data.description || `${data.label} のレッスンと演習。`}
/>

<Breadcrumb items={[{ label: "コース", href: "/" }, { label: data.label }]} />

<header class="mt-3">
  <h1 class="text-2xl font-medium tracking-tight text-ink sm:text-3xl">{data.label}</h1>
  {#if data.description}
    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{data.description}</p>
  {/if}
</header>

<div class="mt-5 flex max-w-md items-center gap-3">
  <ProgressBar value={percent} size="sm" />
  <p class="shrink-0 text-xs tabular-nums text-muted">
    <strong class="font-medium text-ink">{data.stats.solved}</strong> / {data.stats.total} 演習
  </p>
</div>

<section class="mt-8">
  <div class="flex items-baseline justify-between gap-3">
    <h2 class="text-xl font-medium tracking-tight text-ink">レッスン</h2>
    <span class="text-xs tabular-nums text-muted">{data.lessons.length} レッスン</span>
  </div>

  <ol class="bento mt-4">
    {#each data.lessons as lesson, index (lesson.id)}
      <li class="bento-cell p-5 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                class="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium {lesson.complete
                  ? 'border-brand bg-brand text-white dark:text-canvas'
                  : lesson.solved > 0
                    ? 'border-accent/30 bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted'}"
              >
                {#if lesson.complete}
                  <Icon name="check" size={16} />
                  <span class="sr-only">完了</span>
                {:else}
                  {index + 1}
                {/if}
              </span>
              <h3 class="font-medium leading-snug text-ink">
                <a href={lesson.href} class="hover:underline">{lesson.title}</a>
              </h3>
            </div>

            {#if lesson.description}
              <p class="mt-2 text-sm leading-relaxed text-muted">{lesson.description}</p>
            {/if}

            <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span class="tabular-nums">{lesson.chapters} 章・{lesson.sections} セクション</span>
              {#if lesson.estimateMin}
                <span class="tabular-nums">約 {lesson.estimateMin} 分</span>
              {/if}
              <span class="tabular-nums">{lesson.solved} / {lesson.total} 演習</span>
            </div>

            {#if lesson.total > 0}
              <div class="mt-3 max-w-xs">
                <ProgressBar value={Math.round((lesson.solved / lesson.total) * 100)} ariaLabel={`${lesson.title} の進捗`} size="sm" />
              </div>
            {/if}
          </div>

          <a
            href={lesson.href}
            class="btn {lesson.isNext ? 'btn-primary' : 'btn-secondary'} w-full shrink-0 sm:w-auto"
          >
            レッスンをひらく
            <Icon name="arrow-right" size={16} />
          </a>
        </div>
      </li>
    {/each}
  </ol>
</section>
