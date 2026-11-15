<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let percent = $derived(
    data.totalExercises === 0
      ? 0
      : Math.round((data.stats.solved / data.totalExercises) * 100),
  );
  let completedLessons = $derived(
    data.lessons.filter((lesson) => lesson.total > 0 && lesson.solved === lesson.total).length,
  );
</script>

<PageHead
  title={data.label}
  description={data.description || `${data.label} のレッスンと演習。`}
/>

<Breadcrumb items={[{ label: "コース", href: "/" }, { label: data.label }]} />

<header class="mt-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
  <div class="min-w-0">
    <h1 class="text-2xl font-medium tracking-tight text-ink sm:text-3xl">{data.label}</h1>
    {#if data.description}
      <p class="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{data.description}</p>
    {/if}
  </div>
  <p class="shrink-0 text-xs text-muted">
    {data.lessons.length} レッスン・{data.totalExercises} 演習
  </p>
</header>

<div class="mt-5 flex max-w-xl items-center gap-3">
  <ProgressBar value={percent} size="sm" />
  <p class="shrink-0 text-xs tabular-nums text-muted">
    <strong class="font-medium text-ink">{data.stats.solved}</strong> / {data.totalExercises} 演習
    <span class="mx-1 text-line">・</span>
    {completedLessons} / {data.lessons.length} レッスン完了
  </p>
</div>

<section class="mt-8">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <h2 class="text-xl font-medium tracking-tight text-ink">レッスン</h2>
    <span class="text-xs text-muted">上から順に進めるのがおすすめです。</span>
  </div>

  <ol class="mt-3 grid gap-3">
    {#each data.lessons as lesson, index (lesson.id)}
      {@const complete = lesson.total > 0 && lesson.solved === lesson.total}
      {@const started = lesson.solved > 0 && !complete}
      <li class="card p-4 sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span
                class="grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-medium {complete
                  ? 'border-brand bg-brand text-white'
                  : started
                    ? 'border-accent/30 bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted'}"
              >
                {#if complete}
                  <Icon name="check" size={14} />
                {:else}
                  {index + 1}
                {/if}
              </span>
              <h3 class="font-medium leading-snug text-ink">{lesson.title}</h3>
              {#if complete}
                <span class="chip chip-brand">完了</span>
              {:else if started}
                <span class="chip chip-accent">進行中</span>
              {/if}
            </div>

            {#if lesson.goal}
              <p class="mt-1.5 text-sm leading-relaxed text-muted">{lesson.goal}</p>
            {/if}

            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span class="tabular-nums">{lesson.solved} / {lesson.total} 演習</span>
              {#if lesson.total > 0}
                <span class="h-1 w-24 overflow-hidden rounded-full bg-line">
                  <span
                    class="block h-full rounded-full bg-brand"
                    style={`width: ${Math.round((lesson.solved / lesson.total) * 100)}%`}
                  ></span>
                </span>
              {/if}
            </div>
          </div>

          <a href={lesson.start.href} class="btn btn-primary w-full shrink-0 sm:w-auto">
            {lesson.start.label}
            <Icon name="arrow-right" size={15} />
          </a>
        </div>

        {#if lesson.exercises.length > 0}
          <details class="group mt-3 border-t border-line pt-2">
            <summary class="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted hover:text-ink">
              内容を見る
              <span class="tabular-nums">（{lesson.exercises.length} 演習）</span>
              <Icon
                name="chevron-down"
                size={14}
                className="ml-auto shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul class="mt-2 grid gap-1">
              {#each lesson.exercises as exercise (exercise.id)}
                <li>
                  <a
                    href={`/c/${data.id}/e/${exercise.id}`}
                    class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <span class="min-w-0 truncate">{exercise.title}</span>
                    <span class="flex shrink-0 items-center gap-1 text-xs {exercise.solved ? 'text-brand-strong' : 'text-muted'}">
                      {#if exercise.solved}
                        <Icon name="check" size={12} />
                        合格済み
                      {:else}
                        未完了
                      {/if}
                    </span>
                  </a>
                </li>
              {/each}
            </ul>
          </details>
        {/if}
      </li>
    {/each}
  </ol>
</section>
