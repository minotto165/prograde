<script lang="ts">
  import Breadcrumb from "$lib/components/Breadcrumb.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";

  let { data, form } = $props();

  function checked(questionId: string, optionId: string): boolean {
    return (
      form?.quizResult?.results?.some(
        (item) => item.id === questionId && item.selected.includes(optionId),
      ) ?? false
    );
  }
  function resultFor(questionId: string) {
    return form?.quizResult?.results?.find((item) => item.id === questionId) ?? null;
  }
  function slideUrl(number: number): string {
    return number <= 1
      ? `/c/${data.courseId}/l/${data.id}`
      : `/c/${data.courseId}/l/${data.id}/${number}`;
  }
</script>

<PageHead title={data.title} description={data.goal || `${data.title} のレッスン。`} />

<Breadcrumb
  items={[
    { label: "コース", href: "/" },
    { label: data.courseLabel, href: `/c/${data.courseId}` },
    { label: data.title },
  ]}
/>

<div class="mt-3 flex flex-wrap items-start justify-between gap-4">
  <div class="min-w-0 max-w-3xl">
    <h1 class="text-3xl font-medium tracking-tight text-ink">{data.title}</h1>
    {#if data.goal}
      <p class="mt-2 text-sm leading-relaxed text-ink-soft">{data.goal}</p>
    {/if}
  </div>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
    {#if data.estimateMin}
      <span class="inline-flex items-center gap-1">
        <Icon name="clock" size={13} />
        約 {data.estimateMin} 分
      </span>
    {/if}
    <span class="tabular-nums">演習 {data.solved} / {data.exercises.length}</span>
  </div>
</div>

{#if data.skills.length > 0}
  <div class="mt-3 flex flex-wrap gap-1.5">
    {#each data.skills as skill (skill)}
      <span class="font-mono text-xs text-muted">#{skill}</span>
    {/each}
  </div>
{/if}

{#if data.slide}
  <div class="mt-6 flex items-center gap-3">
    <ProgressBar
      value={Math.round((data.slide.index / data.slide.total) * 100)}
      size="sm"
    />
    <span class="shrink-0 text-xs font-medium tabular-nums text-muted">
      スライド {data.slide.index} / {data.slide.total}
    </span>
  </div>
{/if}

{#if data.slideHtml}
  <article class="card mt-4 overflow-hidden">
    <div class="px-5 py-7 sm:px-9 sm:py-9">
      <div class="doc mx-auto max-w-[68ch]">
        {@html data.slideHtml}
      </div>
    </div>

    {#if data.slide}
      <nav class="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-3 sm:px-6" aria-label="スライドの移動">
        {#if data.slide.index === 1}
          <a href={`/c/${data.courseId}`} class="btn btn-ghost">
            <Icon name="arrow-left" size={16} />
            レッスン一覧
          </a>
        {:else if data.prevSlide}
          <a href={slideUrl(data.prevSlide)} class="btn btn-ghost">
            <Icon name="arrow-left" size={16} />
            前へ
          </a>
        {:else}
          <span></span>
        {/if}

        {#if data.nextSlide}
          <a href={slideUrl(data.nextSlide)} class="btn btn-primary">
            次へ
            <Icon name="arrow-right" size={16} />
          </a>
        {:else}
          <a href={data.quiz ? "#check" : "#exercises"} class="btn btn-primary">
            クイズと演習へ
            <Icon name="arrow-right" size={16} />
          </a>
        {/if}
      </nav>
    {/if}
  </article>
{/if}

{#if data.slide && !data.isLast}
  <p class="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
    <Icon name="lightbulb" size={16} className="mt-0.5 shrink-0 text-accent" />
    最後のスライドまで進むと、振り返りクイズと演習が表示されます。
  </p>
{/if}

{#if data.isLast}
  {#if data.quiz}
    <section id="check" class="mt-10 scroll-mt-28">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-2xl font-medium tracking-tight text-ink">振り返りクイズ</h2>
          <p class="mt-1 text-sm text-muted">選択して「答え合わせ」を押すと、その場で採点されます。</p>
        </div>
        {#if form?.quizResult}
          <span
            class="inline-flex items-center gap-1 text-xs font-medium {form.quizResult.ok ? 'text-brand-strong' : 'text-danger'}"
            aria-live="polite"
          >
            <Icon name={form.quizResult.ok ? "check" : "x"} size={13} />
            {form.quizResult.ok ? "全問正解" : `${form.quizResult.failed} 問不正解`}
          </span>
        {/if}
      </div>

      <form method="POST" action="?/quiz" class="mt-4 grid gap-4">
        {#each data.quiz.questions as question, index (question.id)}
          {@const result = resultFor(question.id)}
          <fieldset
            class="card p-5 {result ? (result.ok ? 'border-brand/40' : 'border-danger/40') : ''}"
          >
            <legend class="px-1 text-sm font-medium leading-relaxed text-ink">
              Q{index + 1}. {question.prompt}
              {#if question.multiple}
                <span class="ml-1 text-xs font-normal text-muted">（複数選択）</span>
              {/if}
              {#if result}
                <span class="ml-2 inline-flex items-center gap-1 text-xs font-medium {result.ok ? 'text-brand-strong' : 'text-danger'}">
                  <Icon name={result.ok ? "check" : "x"} size={12} />
                  {result.ok ? "正解" : "不正解"}
                </span>
              {/if}
            </legend>

            <div class="mt-3 grid gap-2">
              {#each question.options as option (option.id)}
                <label class="option">
                  <input
                    type={question.multiple ? "checkbox" : "radio"}
                    name={`q:${question.id}`}
                    value={option.id}
                    checked={checked(question.id, option.id)}
                  />
                  <span class="leading-relaxed">{option.text}</span>
                </label>
              {/each}
            </div>

            {#if result}
              <div class="mt-3 rounded-lg bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-soft" aria-live="polite">
                {#if !result.ok}
                  <p class="font-medium text-danger">
                    答え: {result.answers
                      .map((id) => question.options.find((option) => option.id === id)?.text ?? id)
                      .join(" / ")}
                  </p>
                {/if}
                {#if question.explanation}
                  <p class={result.ok ? "" : "mt-1"}>{question.explanation}</p>
                {/if}
              </div>
            {/if}
          </fieldset>
        {/each}

        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn btn-primary">
            <Icon name="check" size={16} />
            答え合わせ
          </button>
          <span class="text-xs text-muted">回答は保存されません。何度でも試せます。</span>
        </div>
      </form>
    </section>
  {/if}

  <section id="exercises" class="mt-10 scroll-mt-28">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-medium tracking-tight text-ink">演習</h2>
        <p class="mt-1 text-sm text-muted">終了コード・出力・生成されたファイルで採点します。</p>
      </div>
      <span class="text-xs text-muted">{data.solved} / {data.exercises.length} クリア</span>
    </div>

    {#if data.exercises.length > 0}
      <ul class="mt-4 grid gap-3">
        {#each data.exercises as exercise, index (exercise.id)}
          <li class="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full border text-xs font-medium {exercise.solved
                ? 'border-brand bg-brand-soft text-brand-strong'
                : 'border-line bg-surface-2 text-muted'}"
            >
              {#if exercise.solved}
                <Icon name="check" size={15} />
              {:else}
                {index + 1}
              {/if}
            </span>

            <div class="min-w-0 flex-1">
              <a
                href={`/c/${data.courseId}/e/${exercise.id}`}
                class="font-medium text-ink transition-colors hover:text-brand-strong"
              >
                {exercise.title}
              </a>
              <p class="mt-0.5 text-xs text-muted">
                {exercise.env}
                {#if exercise.attempts > 0} ・ {exercise.attempts} 回挑戦{/if}
                {#if exercise.hints > 0} ・ ヒント {exercise.hints} 件{/if}
              </p>
            </div>

            <a
              href={`/c/${data.courseId}/e/${exercise.id}`}
              class="btn {exercise.solved ? 'btn-secondary' : 'btn-primary'} shrink-0"
            >
              {exercise.solved ? "もう一度" : "解く"}
              <Icon name="arrow-right" size={15} />
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="mt-4 rounded-xl border border-dashed border-line bg-surface-2 px-5 py-6 text-sm text-muted">
        このレッスンに演習はありません。
      </p>
    {/if}
  </section>

  <nav class="mt-10 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between" aria-label="レッスンの移動">
    {#if data.prevLesson}
      <a href={`/c/${data.courseId}/l/${data.prevLesson.id}`} class="group flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
        <Icon name="arrow-left" size={17} className="shrink-0 text-muted" />
        <span>
          <span class="block text-xs text-muted">前のレッスン</span>
          <span class="block text-sm font-medium text-ink-soft group-hover:text-ink">{data.prevLesson.title}</span>
        </span>
      </a>
    {:else}
      <span></span>
    {/if}

    {#if data.nextLesson}
      <a href={`/c/${data.courseId}/l/${data.nextLesson.id}`} class="group flex items-center justify-end gap-3 rounded-xl px-2 py-2 text-right hover:bg-surface-2">
        <span>
          <span class="block text-xs text-muted">次のレッスン</span>
          <span class="block text-sm font-medium text-ink-soft group-hover:text-ink">{data.nextLesson.title}</span>
        </span>
        <Icon name="arrow-right" size={17} className="shrink-0 text-muted" />
      </a>
    {:else}
      <a href={`/c/${data.courseId}`} class="btn btn-secondary">
        コース一覧へ
        <Icon name="arrow-right" size={15} />
      </a>
    {/if}
  </nav>
{/if}
