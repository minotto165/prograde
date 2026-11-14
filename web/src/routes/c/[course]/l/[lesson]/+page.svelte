<script lang="ts">
  let { data, form } = $props();

  function checked(questionId: string, optionId: string): boolean {
    return form?.quizResult?.results?.some((item) => item.id === questionId && item.selected.includes(optionId)) ?? false;
  }
  function resultFor(questionId: string) {
    return form?.quizResult?.results?.find((item) => item.id === questionId) ?? null;
  }
</script>

<p class="text-sm text-slate-500">
  <a href="/" class="hover:underline">コース</a> /
  <a href={`/c/${data.courseId}`} class="hover:underline">{data.courseLabel}</a>
</p>
<div class="mt-1 flex flex-wrap items-baseline justify-between gap-3">
  <h1 class="text-2xl font-bold">{data.title}</h1>
  <span class="text-xs text-slate-500">{data.solved}/{data.exercises.length} 演習クリア</span>
</div>
{#if data.goal}<p class="mt-1 text-sm text-slate-600">目標: {data.goal}</p>{/if}
{#if data.skills.length > 0 || data.estimateMin}
  <p class="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
    {#if data.estimateMin}<span>約 {data.estimateMin} 分</span>{/if}
    {#each data.skills as skill (skill)}<span class="rounded-full bg-slate-100 px-2 py-0.5">{skill}</span>{/each}
  </p>
{/if}

{#if data.docHtml}
  <article class="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-800">
    {@html data.docHtml}
  </article>
{/if}

{#if data.quiz}
  <section class="mt-6 rounded-xl border border-slate-200 bg-white p-6">
    <div class="flex items-baseline justify-between">
      <h2 class="font-semibold">振り返りクイズ</h2>
      {#if form?.quizResult}
        <span class="text-xs {form.quizResult.ok ? 'text-emerald-600' : 'text-rose-600'}">
          {form.quizResult.ok ? "全問正解" : form.quizResult.failed + " 問不正解"}
        </span>
      {/if}
    </div>
    <form method="POST" action="?/quiz" class="mt-3 grid gap-5">
      {#each data.quiz.questions as question, index (question.id)}
        {@const result = resultFor(question.id)}
        <fieldset class="rounded-lg border border-slate-200 p-4">
          <legend class="px-1 text-sm font-medium">
            Q{index + 1}. {question.prompt}
            {#if question.multiple}<span class="ml-1 text-xs font-normal text-slate-500">（複数選択）</span>{/if}
            {#if result}<span class="ml-2 text-xs {result.ok ? 'text-emerald-600' : 'text-rose-600'}">{result.ok ? "正解" : "不正解"}</span>{/if}
          </legend>
          <div class="mt-1 grid gap-2">
            {#each question.options as option (option.id)}
              <label class="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-slate-50">
                <input
                  type={question.multiple ? "checkbox" : "radio"}
                  name={`q:${question.id}`}
                  value={option.id}
                  checked={checked(question.id, option.id)}
                  class="mt-1 accent-emerald-600"
                />
                <span>{option.text}</span>
              </label>
            {/each}
          </div>
          {#if result && !result.ok}
            <p class="mt-2 text-xs text-slate-600">答え: {result.answers.join(", ")}</p>
            {#if question.explanation}<p class="mt-1 text-xs text-slate-500">{question.explanation}</p>{/if}
          {:else if result && result.ok && question.explanation}
            <p class="mt-2 text-xs text-slate-500">{question.explanation}</p>
          {/if}
        </fieldset>
      {/each}
      <div class="flex items-center gap-3">
        <button type="submit" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">答え合わせ</button>
        <span class="text-xs text-slate-500">回答は保存されません。何度でも試せます。</span>
      </div>
    </form>
  </section>
{/if}

<div class="mt-8 mb-3 flex items-baseline justify-between">
  <h2 class="text-lg font-semibold">演習</h2>
  <span class="text-xs text-slate-500">終了コード・出力・ファイルで採点</span>
</div>
<ul class="grid gap-2">
  {#each data.exercises as exercise, index (exercise.id)}
    <li class="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-medium text-slate-400">{index + 1}</span>
        <a href={`/c/${data.courseId}/e/${exercise.id}`} class="font-medium hover:underline">
          {#if exercise.solved}<span class="text-emerald-600">✓</span>{/if}
          {exercise.title}
        </a>
        <span class="ml-auto text-xs text-slate-500">{exercise.env} ・ {exercise.xp} XP{#if exercise.attempts > 0} ・ {exercise.attempts} 回挑戦{/if}</span>
        <a href={`/c/${data.courseId}/e/${exercise.id}`}
           class="rounded-md {exercise.solved ? 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-700'} px-3 py-1.5 text-xs font-medium">
          {exercise.solved ? "もう一度" : "解く"}
        </a>
      </div>
    </li>
  {/each}
</ul>

<nav class="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 text-sm">
  {#if data.prevLesson}
    <a href={`/c/${data.courseId}/l/${data.prevLesson.id}`} class="text-slate-600 hover:underline">← {data.prevLesson.title}</a>
  {:else}<span></span>{/if}
  {#if data.nextLesson}
    <a href={`/c/${data.courseId}/l/${data.nextLesson.id}`} class="text-slate-600 hover:underline">{data.nextLesson.title} →</a>
  {:else}
    <a href={`/c/${data.courseId}`} class="text-slate-600 hover:underline">コース一覧 →</a>
  {/if}
</nav>
