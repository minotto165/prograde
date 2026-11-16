import { describe, expect, test } from "bun:test";
import { escapeHtml, renderMarkdown } from "../web/src/lib/markdown.ts";

const BT = String.fromCharCode(96);

describe("markdown: 教材向けの Markdown レンダラ", () => {
  test("HTML をエスケープする", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  test("段落と見出しとリスト", () => {
    const html = renderMarkdown("# 見出し\n\n本文です。\n\n- 一つ目\n- 二つ目\n\n1. 手順\n2. 手順");
    expect(html).toContain("<h1");
    expect(html).toContain("本文です。");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>一つ目</li>");
    expect(html).toContain("<ol");
  });

  test("コードブロックは中身をそのまま出す", () => {
    const fence = BT + BT + BT;
    const html = renderMarkdown(fence + "\nconst x = 1 < 2;\n" + fence);
    expect(html).toContain("const x = 1 &lt; 2;");
    expect(html).not.toContain("<strong>");
  });

  test("インラインのコードは装飾より先に退避される", () => {
    const src = "これは " + BT + "a*b*c" + BT + " と **強調** です";
    const html = renderMarkdown(src);
    expect(html).toContain("<code");
    expect(html).toContain("a*b*c");
    expect(html).toContain("<strong>強調</strong>");
  });

  test("リンクと blockquote と hr", () => {
    const html = renderMarkdown("> 引用\n\n[例](https://example.com)\n\n---");
    expect(html).toContain("<blockquote");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<hr");
  });

  test("生の HTML はタグとして解釈されない", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("表とネストしたリストを扱える", () => {
    const html = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n\n- 親\n  - 子");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>2</td>");
    expect(html).toContain("<ul>\n<li>親<ul>");
  });

  test("相対リンクは同じタブ、外部リンクは新しいタブで開く", () => {
    const html = renderMarkdown("[内部](/help) [外部](https://example.com)");
    expect(html).toContain('<a href="/help">内部</a>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noreferrer">外部</a>');
  });

  test("危険なスキームのリンクは文字だけ残す", () => {
    const html = renderMarkdown("[危険](javascript:alert(1)) [データ](data:text/html,x)");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
    expect(html).toContain("危険");
    expect(html).toContain("データ");
  });

  test("画像は安全な URL だけ表示する", () => {
    const html = renderMarkdown("![図](https://example.com/a.png) ![危険](javascript:alert(1))");
    expect(html).toContain('<img src="https://example.com/a.png" alt="図" loading="lazy">');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("危険");
  });
});
