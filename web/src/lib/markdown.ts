import { Marked } from "marked";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);
}

/** 教材から外部へ飛ばしてよい URL だけを通す。相対リンクとアンカーはそのまま許可する。 */
function safeHref(href: string): string | null {
  const value = href.trim();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const url = new URL(value);
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? value : null;
    } catch {
      return null;
    }
  }
  return value;
}

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // 生の HTML は教材の一部として表示する。タグとしては解釈しない。
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const url = safeHref(href);
      if (!url) return label;
      const external = /^https?:/i.test(url);
      const attrs = [
        `href="${escapeHtml(url)}"`,
        title ? `title="${escapeHtml(title)}"` : "",
        external ? 'target="_blank"' : "",
        external ? 'rel="noreferrer"' : "",
      ].filter(Boolean).join(" ");
      return `<a ${attrs}>${label}</a>`;
    },
    image({ href, title, text }) {
      const alt = escapeHtml(text);
      const url = safeHref(href);
      if (!url) return alt;
      const attrs = [
        `src="${escapeHtml(url)}"`,
        `alt="${alt}"`,
        title ? `title="${escapeHtml(title)}"` : "",
        'loading="lazy"',
      ].filter(Boolean).join(" ");
      return `<img ${attrs}>`;
    },
  },
});

/** 教材向けの Markdown。見た目は app.css の .doc がタグ単位で整える。 */
export function renderMarkdown(source: string): string {
  return markdown.parse(source.replace(/\r\n?/g, "\n"), { async: false });
}
