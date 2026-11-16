<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>PIN | prograde</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto flex min-h-[62vh] w-full max-w-sm flex-col justify-center">
  <p class="text-xs font-medium text-muted">LAN モード</p>
  <h1 class="mt-3 text-3xl font-medium tracking-tight text-ink">PIN を入力</h1>
  <p class="mt-3 text-sm leading-relaxed text-ink-soft">
    起動したターミナルに表示された6桁の PIN を入力してください。
  </p>

  <form method="POST" class="mt-8">
    <input type="hidden" name="next" value={form?.next ?? data.next} />
    <label for="pin" class="meta-label">6桁の PIN</label>
    <input
      id="pin"
      name="pin"
      class="field mt-2 h-12 text-center font-mono text-xl tracking-[0.45em]"
      inputmode="numeric"
      autocomplete="one-time-code"
      pattern={"[0-9]{6}"}
      title="6桁の数字"
      maxlength="6"
      required
    />
    {#if form?.error}
      <p class="mt-3 text-sm text-danger" role="alert">{form.error}</p>
    {/if}
    <button type="submit" class="btn btn-primary mt-5 w-full">開く</button>
  </form>

  <p class="mt-6 text-xs leading-relaxed text-muted">
    PIN は起動のたびに変わります。12時間は再入力なしで使えます。
  </p>
</section>
