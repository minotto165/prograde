const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);
}

/** インライン記法。コードスパンは先に退避してから装飾する。 */
function inline(text: string): string {
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(code);
    return "\u0000" + (codes.length - 1) + "\u0000";
  });
  out = out
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" class="underline decoration-slate-400 underline-offset-2 hover:text-slate-900" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) =>
    '<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">' + codes[Number(index)] + "</code>",
  );
}

const LIST_ITEM = /^\s*[-*]\s+/;
const ORDERED_ITEM = /^\s*\d+\.\s+/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BLOCK_START = /^(\`\`\`|#{1,6}\s|\s*[-*]\s+|\s*\d+\.\s+|\s*(?:>|&gt;)|\s*(---|\*\*\*)\s*$)/;

/** 教材向けの小さな Markdown。見出し・リスト・コード・強調・リンクだけ。 */
export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source.replace(/\r\n?/g, "\n")).split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("\`\`\`")) {
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !lines[i].startsWith("\`\`\`")) body.push(lines[i++]);
      i += 1;
      out.push('<pre class="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-6 text-slate-100"><code>' + body.join("\n") + "</code></pre>");
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const size = level === 1 ? "text-2xl" : level === 2 ? "text-lg" : "text-base";
      out.push('<h' + level + ' class="mt-5 mb-2 font-semibold ' + size + '">' + inline(heading[2]) + "</h" + level + ">");
      i += 1;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) items.push(inline(lines[i++].replace(LIST_ITEM, "")));
      out.push('<ul class="mt-2 list-disc space-y-1 pl-5">' + items.map((item) => "<li>" + item + "</li>").join("") + "</ul>");
      continue;
    }
    if (ORDERED_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED_ITEM.test(lines[i])) items.push(inline(lines[i++].replace(ORDERED_ITEM, "")));
      out.push('<ol class="mt-2 list-decimal space-y-1 pl-5">' + items.map((item) => "<li>" + item + "</li>").join("") + "</ol>");
      continue;
    }
    if (/^\s*(?:>|&gt;)/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*(?:>|&gt;)/.test(lines[i])) body.push(inline(lines[i++].replace(/^\s*(?:>|&gt;)\s?/, "")));
      out.push('<blockquote class="mt-2 border-l-2 border-slate-300 pl-4 text-slate-600">' + body.join("<br>") + "</blockquote>");
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      out.push('<hr class="my-6 border-slate-200">');
      i += 1;
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !BLOCK_START.test(lines[i])) paragraph.push(inline(lines[i++]));
    out.push('<p class="mt-2 leading-7">' + paragraph.join("<br>") + "</p>");
  }
  return out.join("\n");
}
