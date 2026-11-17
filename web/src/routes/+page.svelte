<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let overall = $derived(
    data.totals.total === 0 ? 0 : Math.round((data.totals.solved / data.totals.total) * 100),
  );
</script>

<PageHead title="コース" />

<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
  <h1 class="text-2xl font-medium tracking-tight text-ink sm:text-3xl">コース</h1>
  <div class="w-full sm:w-80">
    <div class="mb-1.5 flex items-baseline justify-between gap-3">
      <span class="text-xs font-medium text-muted">全体の進捗</span>
      <span class="text-xs tabular-nums text-muted">
        <strong class="font-medium text-ink">{data.totals.solved}</strong> / {data.totals.total} 演習
      </span>
    </div>
    <ProgressBar value={overall} size="sm" />
  </div>
</div>

<ul class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
  {#each data.courses as course (course.id)}
    {@const percent = course.exercises === 0 ? 0 : Math.round((course.solved / course.exercises) * 100)}
    <li class="card flex h-full flex-col p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 class="text-lg font-medium tracking-tight text-ink">
          <a href={`/c/${course.id}`} class="transition-colors hover:text-brand-strong">{course.label}</a>
        </h3>
        <span class="shrink-0 text-xs tabular-nums text-muted">
          {course.lessons} レッスン・{course.exercises} 演習
        </span>
      </div>

      {#if course.description}
        <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{course.description}</p>
      {/if}

      <div class="mt-5">
        <ProgressBar value={percent} ariaLabel="演習の進捗" size="sm" />
      </div>

      <div class="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <span class="text-xs tabular-nums text-muted">
          <strong class="font-medium text-ink">{course.solved}</strong> / {course.exercises} クリア
        </span>
        <a
          href={`/c/${course.id}`}
          class="inline-flex items-center gap-1 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          レッスン一覧
          <Icon name="arrow-right" size={16} />
        </a>
      </div>
    </li>
  {:else}
    <li class="rounded-2xl border border-dashed border-line bg-surface-2 p-10 text-center md:col-span-2 xl:col-span-3">
      <span class="mx-auto grid size-11 place-items-center rounded-xl bg-surface text-muted">
        <Icon name="book" size={20} />
      </span>
      <p class="mt-3 font-medium text-ink">コースがありません</p>
      <p class="mt-1 text-sm text-muted">
        データルートの <code class="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">tracks/</code> にコースを追加してください。
      </p>
      <a href="/help" class="btn btn-secondary mt-4">コースの追加方法を見る</a>
    </li>
  {/each}
</ul>
