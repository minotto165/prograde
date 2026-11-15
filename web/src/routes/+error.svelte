<script lang="ts">
  import { page } from "$app/stores";
  import Icon from "$lib/components/Icon.svelte";

  let status = $derived($page.status);
  let isNotFound = $derived(status === 404);
  let title = $derived(isNotFound ? "ページが見つかりません" : "うまく表示できませんでした");
  let message = $derived(
    isNotFound
      ? "リンクが変わったか、コースやレッスンが削除された可能性があります。"
      : ($page.error?.message ?? "時間をおいてもう一度試してください。"),
  );
</script>

<svelte:head>
  <title>{status} | prograde</title>
</svelte:head>

<section class="mx-auto flex min-h-[62vh] max-w-xl flex-col items-center justify-center text-center">
  <span class="chip chip-brand font-mono">{status}</span>
  <h1 class="mt-5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
  <p class="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{message}</p>
  <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
    <a href="/" class="btn btn-primary">
      <Icon name="home" size={16} />
      コースへ戻る
    </a>
    <button type="button" class="btn btn-secondary" onclick={() => history.back()}>
      <Icon name="arrow-left" size={16} />
      前のページへ
    </button>
  </div>
</section>
