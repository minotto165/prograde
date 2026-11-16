<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import { createProgradeEditor } from "$lib/editor/codemirror";

  let {
    path,
    code,
    active,
  }: { path: string; code: string; active: boolean } = $props();

  let text = $state(untrack(() => code));
  let host = $state<HTMLDivElement | null>(null);
  let hidden = $state<HTMLInputElement | null>(null);
  let line = $state(1);
  let column = $state(1);
  let ready = $state(false);
  let view: EditorView | null = null;

  onMount(() => {
    if (!host) return;
    view = createProgradeEditor(host, path, text, {
      onChange: (value) => {
        text = value;
        if (hidden) hidden.value = value;
      },
      onCursor: (nextLine, nextColumn) => {
        line = nextLine;
        column = nextColumn;
      },
    });
    ready = true;

    return () => {
      view?.destroy();
      view = null;
    };
  });

  $effect(() => {
    if (!ready || !active) return;
    const frame = requestAnimationFrame(() => view?.requestMeasure());
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class={active ? "flex min-h-0 flex-1 flex-col" : "hidden"} role="group" aria-label={`${path} のエディタ`}>
  <div class="relative flex min-h-[340px] flex-1">
    <div bind:this={host} class="min-w-0 flex-1 overflow-hidden"></div>
  </div>

  <input bind:this={hidden} type="hidden" name={`file:${path}`} value={text} />

  <div class="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-1.5 text-xs text-white/60">
    <span class="truncate font-mono">{path}</span>
    <span class="shrink-0 tabular-nums">行 {line}、列 {column}</span>
  </div>
</div>
