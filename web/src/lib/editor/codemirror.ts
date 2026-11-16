import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { rust } from "@codemirror/lang-rust";
import { python } from "@codemirror/lang-python";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

export type EditorLanguage = "python" | "rust" | null;

const keywordSection = { name: "キーワード", rank: 1 };
const builtinSection = { name: "組み込み", rank: 2 };
const localSection = { name: "このファイル", rank: 3 };

const PYTHON_KEYWORDS = `
  and as assert async await break class continue def del elif else except
  finally for from global if import in is lambda nonlocal not or pass raise
  return try while with yield None True False
`.trim().split(/\s+/);

const PYTHON_BUILTINS = `
  abs all any bool callable chr dict enumerate filter float format getattr
  hasattr hash help hex input int isinstance iter len list map max min next
  object oct open ord print range repr reversed round set setattr slice
  sorted str sum super tuple type zip
`.trim().split(/\s+/);

const PYTHON_ERRORS = `
  Exception ValueError TypeError KeyError IndexError RuntimeError
  ZeroDivisionError
`.trim().split(/\s+/);

const RUST_KEYWORDS = `
  as async await break const continue crate dyn else enum extern false fn
  for if impl in let loop match mod move mut pub ref return self Self static
  struct super trait true type unsafe use where while
`.trim().split(/\s+/);

const RUST_MACROS = `
  assert! assert_eq! assert_ne! dbg! eprintln! format! matches! panic!
  print! println! todo! unimplemented! vec! write! writeln!
`.trim().split(/\s+/);

const RUST_TYPES = `
  bool char f32 f64 i8 i16 i32 i64 i128 isize str String u8 u16 u32 u64
  u128 usize Vec Option Some None Result Ok Err Box Rc Arc RefCell Cell
  HashMap HashSet BTreeMap BTreeSet
`.trim().split(/\s+/);

function languageForPath(path: string): EditorLanguage {
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".rs")) return "rust";
  return null;
}

function keywordOptions(words: readonly string[]): Completion[] {
  return words.map((label) => ({
    label,
    detail: "キーワード",
    type: "keyword",
    section: keywordSection,
  }));
}

function builtinOptions(words: readonly string[], type: "function" | "type"): Completion[] {
  return words.map((label) => ({
    label,
    detail: "組み込み",
    type,
    section: builtinSection,
  }));
}

function staticOptions(language: EditorLanguage): Completion[] {
  if (language === "python") {
    return [
      ...keywordOptions(PYTHON_KEYWORDS),
      ...builtinOptions(PYTHON_BUILTINS, "function"),
      ...builtinOptions(PYTHON_ERRORS, "type"),
    ];
  }
  if (language === "rust") {
    return [
      ...keywordOptions(RUST_KEYWORDS),
      ...builtinOptions(RUST_MACROS, "function"),
      ...builtinOptions(RUST_TYPES, "type"),
    ];
  }
  return [];
}

function localIdentifiers(state: EditorState, language: EditorLanguage, current: string): Completion[] {
  const reserved = new Set(staticOptions(language).map((option) => option.label));
  const seen = new Set<string>();
  const options: Completion[] = [];
  const text = state.doc.toString();

  for (const match of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    const label = match[0];
    if (label.length < 2 || label === current || seen.has(label) || reserved.has(label)) continue;
    seen.add(label);
    options.push({
      label,
      detail: "このファイル",
      type: "variable",
      section: localSection,
      boost: -10,
    });
    if (options.length >= 80) break;
  }

  return options;
}

function completionSourceFor(language: EditorLanguage): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
    if (!word && !context.explicit) return null;
    if (word && word.from === context.pos && !context.explicit) return null;

    const current = word ? context.state.sliceDoc(word.from, context.pos) : "";
    const options = [...staticOptions(language), ...localIdentifiers(context.state, language, current)];
    if (options.length === 0) return null;

    return {
      from: word ? word.from : context.pos,
      options,
      validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
    };
  };
}

const progradeHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#fbbf24" },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName], color: "#f5f5f4" },
  { tag: [tags.function(tags.variableName), tags.labelName, tags.macroName], color: "#6ee7b7" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "#67e8f9" },
  { tag: [tags.definition(tags.name), tags.separator], color: "#f5f5f4" },
  {
    tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace],
    color: "#93c5fd",
  },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link], color: "#67e8f9" },
  { tag: [tags.meta, tags.comment], color: "#a8a29e", fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#6ee7b7", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#f5f5f4" },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: "#93c5fd" },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: "#bef264" },
  { tag: tags.invalid, color: "#fb7185" },
]);

const progradeTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "#f5f5f4",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      lineHeight: "1.5rem",
      overflow: "auto",
    },
    ".cm-content": {
      padding: "16px 0 24px",
      caretColor: "#34d399",
    },
    ".cm-line": { padding: "0 16px 0 10px" },
    ".cm-gutters": {
      backgroundColor: "rgba(0, 0, 0, 0.2)",
      color: "rgba(255, 255, 255, 0.25)",
      border: "none",
      borderRight: "1px solid rgba(255, 255, 255, 0.1)",
      paddingTop: "16px",
      paddingBottom: "24px",
      fontSize: "11px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 0",
      minWidth: "2.75rem",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.035)" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "rgba(255, 255, 255, 0.6)",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#34d399" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(52, 211, 153, 0.22)",
    },
    ".cm-selectionMatch": { backgroundColor: "rgba(255, 255, 255, 0.10)" },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(52, 211, 153, 0.18)",
      outline: "1px solid rgba(52, 211, 153, 0.45)",
    },
    ".cm-nonmatchingBracket": { color: "#fb7185" },
    ".cm-searchMatch": {
      backgroundColor: "rgba(251, 191, 36, 0.25)",
      outline: "1px solid rgba(251, 191, 36, 0.45)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(251, 191, 36, 0.45)",
    },
    ".cm-tooltip": {
      backgroundColor: "#292524",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: "8px",
      color: "#f5f5f4",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete ul": {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
    },
    ".cm-tooltip-autocomplete ul li": { padding: "4px 8px" },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "rgba(52, 211, 153, 0.2)",
      color: "#ffffff",
    },
    ".cm-completionDetail": {
      color: "rgba(255, 255, 255, 0.4)",
      fontStyle: "normal",
      marginLeft: "10px",
    },
    ".cm-completionMatchedText": { color: "#6ee7b7", textDecoration: "none" },
    ".cm-panels": { backgroundColor: "#292524", color: "#f5f5f4" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid rgba(255, 255, 255, 0.1)" },
    ".cm-panel.cm-search": { padding: "8px 10px" },
    ".cm-textfield": {
      backgroundColor: "#1c1917",
      color: "#f5f5f4",
      border: "1px solid rgba(255, 255, 255, 0.15)",
      borderRadius: "4px",
    },
    ".cm-button": {
      backgroundImage: "none",
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      color: "#f5f5f4",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: "4px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      border: "none",
      color: "rgba(255, 255, 255, 0.5)",
    },
    ".cm-foldGutter .cm-gutterElement": { color: "rgba(255, 255, 255, 0.3)" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": { maxHeight: "16rem" },
  },
  { dark: true },
);

const submitKeymap = Prec.highest(
  keymap.of([
    {
      key: "Mod-Enter",
      run: (view) => {
        const form = view.dom.closest("form");
        if (!form) return false;
        form.requestSubmit();
        return true;
      },
    },
  ]),
);

export function createProgradeEditor(
  parent: HTMLElement,
  path: string,
  doc: string,
  callbacks: {
    onChange: (value: string) => void;
    onCursor: (line: number, column: number) => void;
  },
): EditorView {
  const language = languageForPath(path);
  const languageExtension: Extension = language === "python" ? python() : language === "rust" ? rust() : [];

  const reportCursor = (state: EditorState) => {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    callbacks.onCursor(line.number, head - line.from + 1);
  };

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        indentOnInput(),
        syntaxHighlighting(progradeHighlight),
        bracketMatching(),
        closeBrackets(),
        autocompletion({
          override: [completionSourceFor(language)],
          activateOnTyping: true,
          icons: false,
          maxRenderedOptions: 40,
        }),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
        ]),
        submitKeymap,
        languageExtension,
        progradeTheme,
        EditorView.contentAttributes.of({
          "aria-label": path,
          "aria-autocomplete": "list",
          spellcheck: "false",
          autocapitalize: "off",
          autocorrect: "off",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.onChange(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) reportCursor(update.state);
        }),
      ],
    }),
  });

  reportCursor(view.state);
  return view;
}
