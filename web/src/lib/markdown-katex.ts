import katex from "katex";
import type { MarkedExtension, TokenizerAndRendererExtension, Tokens } from "marked";

type MathToken = Tokens.Generic & { text: string; displayMode: boolean };

/**
 * インライン数式。開始の `$` は行頭・空白・開き括弧の直後だけを認め、
 * 終了の `$` は空白の直前を認めない。終了直後は日本語の助詞や句読点も許す。
 * 通貨の `$5 and $10` のような並びは数式にしない。
 */
const inlineRule =
  /^(\${1,2})(?![\s$])((?:\\.|[^\\\n$])*?)(?<![\s\\])\1(?=$|[\s?!.,:？！。，：、；）」』】》〉]|[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uff00-\uffef])/u;

/** 別行の数式。開始と終了の `$$` はそれぞれ単独の行に置く。 */
const blockRule = /^(\${1,2})[ \t]*\n((?:\\[^]|[^\\])+?)\n[ \t]*\1(?:\n|$)/;

function render(token: MathToken): string {
  return katex.renderToString(token.text, {
    throwOnError: false,
    strict: "ignore",
    trust: false,
    displayMode: token.displayMode,
  });
}

function inlineKatex(): TokenizerAndRendererExtension {
  return {
    name: "inlineKatex",
    level: "inline",
    start(src) {
      let index = src.indexOf("$");
      while (index !== -1) {
        const before = index === 0 ? "" : src[index - 1];
        if (index === 0 || /\s|[([{（「『【〈《]/.test(before)) {
          if (inlineRule.test(src.slice(index))) return index;
        }
        index = src.indexOf("$", index + 1);
      }
    },
    tokenizer(src) {
      const match = inlineRule.exec(src);
      if (!match) return;
      return {
        type: "inlineKatex",
        raw: match[0],
        text: match[2].trim(),
        displayMode: match[1].length === 2,
      };
    },
    renderer(token) {
      return render(token as MathToken);
    },
  };
}

function blockKatex(): TokenizerAndRendererExtension {
  return {
    name: "blockKatex",
    level: "block",
    tokenizer(src) {
      const match = blockRule.exec(src);
      if (!match) return;
      return {
        type: "blockKatex",
        raw: match[0],
        text: match[2].trim(),
        displayMode: match[1].length === 2,
      };
    },
    renderer(token) {
      return render(token as MathToken) + "\n";
    },
  };
}

/** 教材の Markdown に KaTeX の数式を足す。 */
export function katexExtension(): MarkedExtension {
  return { extensions: [inlineKatex(), blockKatex()] };
}
