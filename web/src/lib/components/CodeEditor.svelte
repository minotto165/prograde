<script lang="ts">
  import { untrack } from "svelte";

  let {
    path,
    code,
    active,
  }: { path: string; code: string; active: boolean } = $props();

  let text = $state(untrack(() => code));
  let textarea = $state<HTMLTextAreaElement | null>(null);
  let gutter = $state<HTMLDivElement | null>(null);
  let line = $state(1);
  let column = $state(1);

  let lineCount = $derived(Math.max(1, text.split("\n").length));

  function syncScroll() {
    if (gutter && textarea) gutter.scrollTop = textarea.scrollTop;
  }

  function updateCursor() {
    if (!textarea) return;
    const position = textarea.selectionStart;
    const before = textarea.value.slice(0, position);
    line = before.split("\n").length;
    column = position - before.lastIndexOf("\n");
  }

  function onKeydown(event: KeyboardEvent) {
    if (!textarea) return;

    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      text = text.slice(0, start) + "  " + text.slice(end);
      requestAnimationFrame(() => {
        if (!textarea) return;
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursor();
      });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      textarea.closest("form")?.requestSubmit();
    }
  }
</script>

<div class={active ? "flex min-h-0 flex-1 flex-col" : "hidden"} role="group" aria-label={`${path} のエディタ`}>
  <div class="relative flex min-h-[340px] flex-1">
    <div
      class="w-11 shrink-0 select-none overflow-hidden border-r border-white/10 bg-black/20 py-4 text-right font-mono text-[11px] leading-6 text-white/25"
      bind:this={gutter}
      aria-hidden="true"
    >
      {#each Array(lineCount) as _, index (index)}
        <div class="pr-2">{index + 1}</div>
      {/each}
    </div>

    <textarea
      bind:this={textarea}
      bind:value={text}
      name={`file:${path}`}
      aria-label={path}
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      wrap="off"
      class="h-full w-full min-w-0 resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-6 text-white/90 caret-brand-soft focus:outline-none focus:ring-0"
      oninput={updateCursor}
      onkeyup={updateCursor}
      onclick={updateCursor}
      onkeydown={onKeydown}
      onscroll={syncScroll}
    ></textarea>
  </div>

  <div class="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-1.5 text-xs text-white/60">
    <span class="truncate font-mono">{path}</span>
    <span class="shrink-0 tabular-nums">行 {line}、列 {column}</span>
  </div>
</div>
