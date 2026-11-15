<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    items,
  }: {
    items: { label: string; href?: string }[];
  } = $props();
</script>

<nav aria-label="パンくず" class="min-w-0">
  <ol class="flex flex-wrap items-center gap-1.5 text-xs text-muted">
    {#each items as item, index (item.label + index)}
      <li class="flex min-w-0 items-center gap-1.5">
        {#if index > 0}<Icon name="chevron-right" size={16} className="shrink-0 text-line" />{/if}
        {#if item.href}
          <a href={item.href} class="truncate transition-colors hover:text-ink hover:underline">{item.label}</a>
        {:else}
          <span aria-current="page" class="truncate font-medium text-ink">{item.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
