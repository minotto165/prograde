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

<div class="mt-3 flex flex-wrap items-end justify-between gap-4">
  <div class="min-w-0">
    <p class="eyebrow">COURSE</p>
    <h1 class="mt-1 text-3xl font-bold tracking-tight text-ink">{data.label}</h1>
    {#if data.description}
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{data.description}</p>
    {/if}
  </div>
  <div class="flex flex-wrap items-center gap-2">
    <span class="chip">Lv {data.stats.level}</span>
    <span class="chip">{data.lessons.length} レッスン</span>
    <span class="chip">{data.totalExercises} 演習</span>
  </div>
</div>

<section class="card mt-6 overflow-hidden">
  <div class="grid lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="p-5 sm:p-6">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p class="eyebrow">全体の進捗</p>
          <p class="mt-1 text-3xl font-bold tracking-tight text-ink">
            {percent}<span class="text-lg font-semibold text-muted">%</span>
          </p>
        </div>
        <p class="text-sm text-muted">
          <strong class="font-semibold text-ink">{data.stats.solved}</strong> / {data.totalExercises} 演習
          <span class="mx-1.5 text-line">・</span>
          {completedLessons} / {data.lessons.length} レッスン完了
        </p>
      </div>
      <div class="mt-4">
        <ProgressBar value={percent} size="md" />
      </div>

      <dl class="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <div>
          <dt class="text-xs text-muted">レベル</dt>
          <dd class="mt-0.5 text-lg font-bold text-ink">{data.stats.level}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">XP</dt>
          <dd class="mt-0.5 text-lg font-bold text-ink">{data.stats.xp}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">連続日数</dt>
          <dd class="mt-0.5 flex items-center gap-1 text-lg font-bold text-ink">
            <Icon name="flame" size={16} className="text-accent" />
            {data.stats.streak}<span class="text-xs font-medium text-muted">日</span>
          </dd>
        </div>
      </dl>
    </div>

    <div class="border-t border-line bg-surface-2 p-5 sm:p-6 lg:border-l lg:border-t-0">
      {#if data.next}
        <p class="eyebrow">次に解く演習</p>
        <p class="mt-2 text-xs text-muted">{data.next.lessonTitle}</p>
        <p class="mt-0.5 text-lg font-semibold leading-snug text-ink">{data.next.title}</p>
        <div class="mt-4 flex flex-col gap-2">
          <a href={`/c/${data.id}/e/${data.next.id}`} class="btn btn-primary w-full">
            <Icon name="play" size={16} />
            演習をはじめる
          </a>
          <a href={`/c/${data.id}/l/${data.next.lessonId}`} class="btn btn-secondary w-full">
            <Icon name="book" size={16} />
            解説を読む
          </a>
        </div>
      {:else}
        <div class="flex h-full flex-col items-start justify-center">
          <span class="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-strong">
            <Icon name="check" size={22} />
          </span>
          <p class="mt-3 font-semibold text-ink">
            {data.totalExercises === 0 ? "演習はまだありません" : "このコースは完了しています"}
          </p>
          <p class="mt-1 text-sm leading-relaxed text-muted">
            {data.totalExercises === 0
              ? "コースの追加方法はヘルプを参照してください。"
              : "復習したいレッスンを開いて、もう一度確かめてみましょう。"}
          </p>
          <a href="/" class="btn btn-secondary mt-4">コース一覧へ</a>
        </div>
      {/if}
    </div>
  </div>
</section>

<div class="mt-9 flex flex-wrap items-end justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-ink">レッスン</h2>
    <p class="mt-1 text-sm text-muted">上から順に進めるのがおすすめです。</p>
  </div>
  <span class="text-xs text-muted">{completedLessons} / {data.lessons.length} 完了</span>
</div>

<ol class="relative mt-4">
  {#each data.lessons as lesson, index (lesson.id)}
    {@const complete = lesson.total > 0 && lesson.solved === lesson.total}
    {@const started = lesson.solved > 0 && !complete}
    <li class="relative pb-3 pl-12 last:pb-0">
      {#if index < data.lessons.length - 1}
        <span class="absolute bottom-0 left-[17px] top-14 w-px bg-line" aria-hidden="true"></span>
      {/if}
      <span
        class="absolute left-0 top-5 grid size-9 place-items-center rounded-full border text-xs font-bold {complete
          ? 'border-brand bg-brand text-white'
          : started
            ? 'border-accent/30 bg-accent-soft text-accent'
            : 'border-line bg-surface text-muted'}"
      >
        {#if complete}
          <Icon name="check" size={16} />
        {:else}
          {index + 1}
        {/if}
      </span>

      <article class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold leading-snug text-ink">
              <a href={`/c/${data.id}/l/${lesson.id}`} class="transition-colors hover:text-brand-strong">
                {lesson.title}
              </a>
            </h3>
            {#if lesson.goal}
              <p class="mt-1 text-sm leading-relaxed text-muted">{lesson.goal}</p>
            {/if}
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            {#if complete}
              <span class="chip chip-brand"><Icon name="check" size={13} />完了</span>
            {:else if started}
              <span class="chip chip-accent">進行中</span>
            {:else}
              <span class="chip">未着手</span>
            {/if}
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>{lesson.solved} / {lesson.total} 演習</span>
          {#if lesson.estimateMin}
            <span class="inline-flex items-center gap-1">
              <Icon name="clock" size={13} />
              約 {lesson.estimateMin} 分
            </span>
          {/if}
          {#each lesson.skills as skill (skill)}
            <span>#{skill}</span>
          {/each}
        </div>

        {#if lesson.total > 0}
          <div class="mt-3">
            <ProgressBar
              value={Math.round((lesson.solved / lesson.total) * 100)}
              size="sm"
            />
          </div>
        {/if}

        {#if lesson.exercises.length > 0}
          <ul class="mt-4 flex flex-wrap gap-2">
            {#each lesson.exercises as exercise (exercise.id)}
              <li>
                <a
                  href={`/c/${data.id}/e/${exercise.id}`}
                  title={`${exercise.attempts} 回挑戦`}
                  class="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors {exercise.solved
                    ? 'border-brand/25 bg-brand-soft text-brand-strong hover:border-brand/50'
                    : 'border-line bg-surface text-ink-soft hover:border-brand/40 hover:bg-brand-soft/50'}"
                >
                  {#if exercise.solved}<Icon name="check" size={12} />{/if}
                  {exercise.title}
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </article>
    </li>
  {/each}
</ol>
