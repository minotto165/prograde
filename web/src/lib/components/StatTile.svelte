<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    label,
    value,
    sub = "",
    icon = "spark",
    tone = "muted",
  }: {
    label: string;
    value: string | number;
    sub?: string;
    icon?: "spark" | "flame" | "check" | "clock" | "book" | "terminal";
    tone?: "muted" | "brand" | "accent";
  } = $props();

  const toneClass = $derived(
    tone === "brand"
      ? "bg-brand-soft text-brand-strong"
      : tone === "accent"
        ? "bg-accent-soft text-accent"
        : "bg-canvas text-muted",
  );
</script>

<div class="rounded-xl border border-line bg-surface-2 p-4">
  <div class="flex items-start gap-3">
    <span class="grid size-9 shrink-0 place-items-center rounded-lg {toneClass}">
      <Icon name={icon} size={17} />
    </span>
    <div class="min-w-0">
      <p class="text-xs font-medium text-muted">{label}</p>
      <p class="mt-0.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
      {#if sub}<p class="mt-0.5 truncate text-xs text-muted">{sub}</p>{/if}
    </div>
  </div>
</div>
