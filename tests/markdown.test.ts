import { describe, expect, test } from "bun:test";
import { escapeHtml, renderMarkdown } from "../web/src/lib/markdown.ts";

const BT = String.fromCharCode(96);

describe("markdown: 教材向けの最小レンダラ", () => {
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
});
