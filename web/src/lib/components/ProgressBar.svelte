<script lang="ts">
  let {
    value,
    label = "",
    tone = "brand",
    size = "md",
  }: {
    value: number;
    label?: string;
    tone?: "brand" | "ink" | "accent";
    size?: "sm" | "md";
  } = $props();

  const clamped = $derived(Math.max(0, Math.min(100, Math.round(value))));
  const track = $derived(size === "sm" ? "h-1.5" : "h-2");
  const fill = $derived(
    tone === "ink" ? "bg-ink" : tone === "accent" ? "bg-accent" : "bg-brand",
  );
</script>

<div class="w-full">
  {#if label}
    <div class="mb-1.5 flex items-baseline justify-between gap-3">
      <span class="text-xs font-medium text-ink-soft">{label}</span>
      <span class="text-xs tabular-nums text-muted">{clamped}%</span>
    </div>
  {/if}
  <div
    class="{track} w-full overflow-hidden rounded-full bg-line/60"
    role="progressbar"
    aria-label={label || "進捗"}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={clamped}
  >
    <div class="{fill} {track} rounded-full transition-[width] duration-300" style={`width: ${clamped}%`}></div>
  </div>
</div>
