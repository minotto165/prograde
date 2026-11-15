<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data } = $props();

  let firstCourse = $derived(data.courses.find((course) => course.next) ?? null);
  let firstNext = $derived(firstCourse?.next ?? null);
  let overall = $derived(
    data.totals.total === 0 ? 0 : Math.round((data.totals.solved / data.totals.total) * 100),
  );
</script>

<PageHead
  title="コース"
  description="解説を読み、コードを書き、実行結果で確かめる。ローカルで完結するプログラミング練習プラットフォーム prograde。"
/>

<section class="card overflow-hidden">
  <div class="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
    <div>
      <h1 class="text-3xl font-medium leading-[1.25] tracking-tight text-ink sm:text-4xl">
        演習を解いて、<br class="hidden sm:block" />実行結果で確かめる。
      </h1>
      <p class="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
        採点はビルドと実行の結果だけを見ます。コードの書き方は自由です。まずは続きから、または気になるコースを選んでください。
      </p>

      <div class="mt-7 max-w-md">
        <div class="mb-1.5 flex items-baseline justify-between gap-3">
          <span class="text-xs font-medium text-muted">全体の進捗</span>
          <span class="text-xs tabular-nums text-muted">
            <strong class="font-medium text-ink tabular-nums">{data.totals.solved}</strong> / {data.totals.total} 演習
          </span>
        </div>
        <ProgressBar value={overall} size="sm" />
      </div>
    </div>

    <div class="rounded-2xl bg-ink p-5 text-white shadow-sm sm:p-6">
      {#if firstNext && firstCourse}
        <p class="text-xs font-medium text-brand-soft">続きから</p>
        <p class="mt-2 text-xs text-white/60">{firstCourse.label} ・ {firstNext.lessonTitle}</p>
        <p class="mt-1 text-lg font-medium leading-snug">{firstNext.title}</p>
        <div class="mt-5 flex flex-wrap gap-2">
          <a href={`/c/${firstCourse.id}/e/${firstNext.id}`} class="btn btn-primary">
            <Icon name="play" size={16} />
            演習をはじめる
          </a>
          <a
            href={`/c/${firstCourse.id}/l/${firstNext.lessonId}`}
            class="btn border border-white/20 text-white hover:bg-white/10"
          >
            <Icon name="book" size={16} />
            解説を読む
          </a>
        </div>
      {:else}
        <span class="grid size-11 place-items-center rounded-xl bg-white/10 text-brand-soft">
          <Icon name="check" size={22} />
        </span>
        <p class="mt-3 text-lg font-medium leading-snug">
          {data.courses.length === 0 ? "コースがまだありません" : "すべての演習を解きました"}
        </p>
        <p class="mt-1.5 text-sm leading-relaxed text-white/60">
          {data.courses.length === 0
            ? "データルートの tracks/ にコースを追加すると、ここに表示されます。"
            : "おつかれさまでした。復習したい演習を開いて、もう一度確かめてみるのもおすすめです。"}
        </p>
        <a href="/help" class="btn mt-4 border border-white/20 text-white hover:bg-white/10">
          <Icon name="help" size={16} />
          使い方を見る
        </a>
      {/if}
    </div>
  </div>
</section>

<dl class="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
  <div class="bg-surface px-4 py-3">
    <dt class="text-xs text-muted">レベル</dt>
    <dd class="mt-0.5 text-lg font-medium tabular-nums text-ink">{data.totals.level}</dd>
  </div>
  <div class="bg-surface px-4 py-3">
    <dt class="text-xs text-muted">XP</dt>
    <dd class="mt-0.5 text-lg font-medium tabular-nums text-ink">{data.totals.xp}</dd>
  </div>
  <div class="bg-surface px-4 py-3">
    <dt class="text-xs text-muted">解いた演習</dt>
    <dd class="mt-0.5 text-lg font-medium tabular-nums text-ink">{data.totals.solved} <span class="text-sm text-muted">/ {data.totals.total}</span></dd>
  </div>
  <div class="bg-surface px-4 py-3">
    <dt class="text-xs text-muted">連続日数</dt>
    <dd class="mt-0.5 text-lg font-medium tabular-nums text-ink">{data.totals.streak}日</dd>
  </div>
</dl>

<div class="mt-10 flex flex-wrap items-end justify-between gap-3">
  <div>
    <h2 class="text-xl font-medium tracking-tight text-ink">コース</h2>
    <p class="mt-1 text-sm text-muted">レッスンで解説を読み、演習で手を動かします。</p>
  </div>
  <a href="/help" class="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline">
    はじめての方はこちら
    <Icon name="arrow-right" size={15} />
  </a>
</div>

<ul class="mt-4 grid gap-4 md:grid-cols-2">
  {#each data.courses as course (course.id)}
    {@const percent = course.exercises === 0 ? 0 : Math.round((course.solved / course.exercises) * 100)}
    <li class="card flex flex-col p-5 sm:p-6">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-lg font-medium tracking-tight text-ink">
            <a href={`/c/${course.id}`} class="transition-colors hover:text-brand-strong">{course.label}</a>
          </h3>
          {#if course.description}
            <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{course.description}</p>
          {/if}
        </div>
        <span class="shrink-0 text-xs tabular-nums text-muted">Lv {course.level}</span>
      </div>

      <div class="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span><strong class="font-medium text-ink-soft">{course.lessons}</strong> レッスン</span>
        <span><strong class="font-medium text-ink-soft">{course.exercises}</strong> 演習</span>
        <span><strong class="font-medium text-ink-soft">{course.xp}</strong> XP</span>
      </div>

      <div class="mt-4">
        <ProgressBar value={percent} label="演習の進捗" size="sm" />
      </div>

      <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <a href={`/c/${course.id}`} class="btn btn-secondary">
          レッスン一覧
        </a>
        {#if course.next}
          <a href={`/c/${course.id}/e/${course.next.id}`} class="btn btn-primary ml-auto">
            <Icon name="play" size={15} />
            次の演習
          </a>
        {:else if course.exercises > 0}
          <span class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-strong">
            <Icon name="check" size={13} />
            全問クリア
          </span>
        {:else}
          <span class="ml-auto text-xs text-muted">演習はまだありません</span>
        {/if}
      </div>
    </li>
  {:else}
    <li class="rounded-2xl border border-dashed border-line bg-surface-2 p-8 text-center md:col-span-2">
      <span class="mx-auto grid size-11 place-items-center rounded-xl bg-surface text-muted">
        <Icon name="book" size={22} />
      </span>
      <p class="mt-3 font-medium text-ink">コースがありません</p>
      <p class="mt-1 text-sm text-muted">
        データルートの <code class="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">tracks/</code> にコースを追加してください。
      </p>
      <a href="/help" class="btn btn-secondary mt-4">コースの追加方法を見る</a>
    </li>
  {/each}
</ul>
