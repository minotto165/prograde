<script lang="ts">
  let { data } = $props();
  let firstNext = $derived(data.courses.find((course) => course.next)?.next ?? null);
  let firstCourse = $derived(data.courses.find((course) => course.next) ?? null);
</script>

<section class="rounded-2xl border border-slate-200 bg-white p-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-xs font-medium uppercase tracking-wider text-slate-400">ようこそ</p>
      <h1 class="mt-1 text-2xl font-bold">演習を解いて、実行結果で確かめる。</h1>
      <p class="mt-1 text-sm text-slate-600">採点はビルドと実行の結果だけを見ます。コードの書き方は自由です。</p>
    </div>
    {#if firstNext}
      <a href={`/c/${firstCourse.id}/e/${firstNext.id}`}
         class="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
        続きから: {firstNext.title}
      </a>
    {/if}
  </div>
  <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="rounded-xl bg-slate-50 p-4">
      <dt class="text-xs text-slate-500">レベル</dt>
      <dd class="mt-1 text-2xl font-bold">{data.totals.level}</dd>
    </div>
    <div class="rounded-xl bg-slate-50 p-4">
      <dt class="text-xs text-slate-500">XP</dt>
      <dd class="mt-1 text-2xl font-bold">{data.totals.xp}</dd>
    </div>
    <div class="rounded-xl bg-slate-50 p-4">
      <dt class="text-xs text-slate-500">解いた演習</dt>
      <dd class="mt-1 text-2xl font-bold">{data.totals.solved}<span class="text-sm font-normal text-slate-400"> / {data.totals.total}</span></dd>
    </div>
    <div class="rounded-xl bg-slate-50 p-4">
      <dt class="text-xs text-slate-500">連続日数</dt>
      <dd class="mt-1 text-2xl font-bold">{data.totals.streak}<span class="text-sm font-normal text-slate-400"> 日</span></dd>
    </div>
  </dl>
</section>

<h2 class="mt-8 mb-3 text-lg font-semibold">コース</h2>
<ul class="grid gap-4 sm:grid-cols-2">
  {#each data.courses as course (course.id)}
    <li class="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div class="flex items-baseline justify-between gap-3">
        <a href={`/c/${course.id}`} class="text-lg font-semibold hover:underline">{course.label}</a>
        <span class="text-xs text-slate-500">Lv {course.level}</span>
      </div>
      {#if course.description}<p class="mt-1 text-sm text-slate-600">{course.description}</p>{/if}
      <p class="mt-2 text-xs text-slate-500">{course.lessons} レッスン / {course.exercises} 演習</p>
      <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div class="h-2 rounded-full bg-emerald-500" style={`width:${course.exercises === 0 ? 0 : Math.round((course.solved / course.exercises) * 100)}%`}></div>
      </div>
      <p class="mt-1 text-xs text-slate-500">{course.solved} / {course.exercises} 完了</p>
      <div class="mt-4 flex items-center gap-3">
        <a href={`/c/${course.id}`} class="text-sm font-medium text-slate-700 hover:underline">レッスン一覧</a>
        {#if course.next}
          <a href={`/c/${course.id}/e/${course.next.id}`} class="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
            次の演習へ
          </a>
        {:else}
          <span class="ml-auto text-xs font-medium text-emerald-600">✓ 全問クリア</span>
        {/if}
      </div>
    </li>
  {:else}
    <li class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
      コースがありません。<code class="rounded bg-slate-100 px-1">tracks/</code> にコースを追加してください。
    </li>
  {/each}
</ul>
