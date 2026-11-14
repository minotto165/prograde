<script lang="ts">
  let { data } = $props();
  let percent = $derived(data.totalExercises === 0 ? 0 : Math.round((data.stats.solved / data.totalExercises) * 100));
</script>

<p class="text-sm text-slate-500">
  <a href="/" class="hover:underline">コース</a> / {data.label}
</p>
<h1 class="mt-1 text-2xl font-bold">{data.label}</h1>
{#if data.description}<p class="mt-1 text-sm text-slate-600">{data.description}</p>{/if}

<section class="mt-5 rounded-xl border border-slate-200 bg-white p-5">
  <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
    <span>Lv <strong class="text-slate-900">{data.stats.level}</strong></span>
    <span>XP <strong class="text-slate-900">{data.stats.xp}</strong></span>
    <span>連続 <strong class="text-slate-900">{data.stats.streak}</strong> 日</span>
    <span class="ml-auto text-xs text-slate-500">{data.stats.solved} / {data.totalExercises} 演習</span>
  </div>
  <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div class="h-2 rounded-full bg-emerald-500" style={`width:${percent}%`}></div>
  </div>
  {#if data.next}
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3">
      <div>
        <p class="text-xs text-emerald-700">次に解く演習</p>
        <p class="text-sm font-medium text-slate-900">{data.next.title}</p>
      </div>
      <a href={`/c/${data.id}/e/${data.next.id}`} class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">始める</a>
    </div>
  {:else}
    <p class="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">このコースはすべて解けています。</p>
  {/if}
</section>

<h2 class="mt-8 mb-3 text-lg font-semibold">レッスン</h2>
<ol class="grid gap-3">
  {#each data.lessons as lesson, index (lesson.id)}
    <li class="rounded-xl border border-slate-200 bg-white p-5">
      <div class="flex flex-wrap items-baseline gap-3">
        <span class="text-xs font-medium text-slate-400">{index + 1}</span>
        <a href={`/c/${data.id}/l/${lesson.id}`} class="font-semibold hover:underline">{lesson.title}</a>
        <span class="text-xs text-slate-500">{lesson.solved}/{lesson.total}</span>
        {#if lesson.estimateMin}<span class="text-xs text-slate-400">約 {lesson.estimateMin} 分</span>{/if}
        {#if lesson.total > 0 && lesson.solved === lesson.total}
          <span class="ml-auto text-xs font-medium text-emerald-600">✓ 完了</span>
        {/if}
      </div>
      {#if lesson.goal}<p class="mt-1 text-sm text-slate-600">{lesson.goal}</p>{/if}
      <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div class="h-1.5 rounded-full bg-emerald-500" style={`width:${lesson.total === 0 ? 0 : Math.round((lesson.solved / lesson.total) * 100)}%`}></div>
      </div>
      <ul class="mt-3 flex flex-wrap gap-2">
        {#each lesson.exercises as exercise (exercise.id)}
          <li>
            <a href={`/c/${data.id}/e/${exercise.id}`}
               class="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs {exercise.solved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}">
              {#if exercise.solved}✓{/if}{exercise.title}
            </a>
          </li>
        {/each}
      </ul>
    </li>
  {/each}
</ol>
