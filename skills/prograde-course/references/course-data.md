# コースデータの形

このファイルは Prograde の schema 3 の正確な形をまとめたもの。実装の正本は `src/schema/index.ts` と `src/core/course/loader.ts`。食い違ったらリポジトリを正とする。

## 置き場所

データのルートは `--root`、無ければ `PROGRADE_ROOT`、無ければ `~/.prograde`。コースは `<root>/tracks/<courseId>/` に置く。

```
tracks/<courseId>/
  course.json
  content/<lessonId>/
    chapters/<chapterId>/
      sections/<sectionId>/
        slides/01.md
        slides/02.md
        ex/<exerciseId>/
          exercise.json
          brief.md
          starter.py
          solution/main.py
          fixtures/...
```

- コース ID・レッスン ID・章 ID・セクション ID・演習 ID は `^[a-z0-9][a-z0-9_-]*$`。
- コース ID は `tracks/` 直下のディレクトリ名と一致する。
- 演習 ID は `ex/` 直下のディレクトリ名と一致する。
- 演習 ID はコース内で一意。既存演習の ID は進捗のキーなので変えない。

## course.json

```json
{
  "schema": 3,
  "id": "my-course",
  "label": "表示名",
  "ext": "py",
  "description": "任意の説明",
  "source": "任意の出典",
  "envs": {
    "python": {
      "cacheKey": "python3-v1",
      "probe": ["python3", "--version"],
      "network": "off"
    }
  },
  "lessons": [
    {
      "id": "basics",
      "title": "基礎",
      "description": "任意",
      "estimateMin": 120,
      "chapters": [
        {
          "id": "ch-01",
          "title": "出力",
          "sections": [
            { "id": "greeting", "title": "あいさつを表示する" }
          ]
        }
      ]
    }
  ]
}
```

- `schema` は `3` 固定。schema 2 は読まない。
- `ext` は演習の既定拡張子。ファイル名の補助で、必須の拡張子を強制するものではない。
- `envs` は 1 つ以上。演習の `env` はこのキーを指す。
- `lessons` は 1 つ以上。`chapters` は 1 つ以上。`sections` は 1 つ以上。
- `description` と `estimateMin` は任意。`estimateMin` は正の整数。
- `course.json` が唯一の索引。ここに書いた ID とディレクトリが過不足なく一致する必要がある。

## ディレクトリの厳格さ

ローダーは次を検査する。

- レッスン直下は `chapters/` だけ。他のファイルやディレクトリはエラー。
- 章直下は `sections/` だけ。
- セクション直下は `slides/` と `ex/` だけ。
- `ex/` 直下は演習ディレクトリがちょうど 1 つ。ファイルは置けない。
- `slides/` には `.md` だけ。ファイル名は `NN.md` または `NN-名前.md`（NN は 2 桁）。番号の重複はエラー。番号順に並ぶ。
- `course.json` の `sections` と実ディレクトリの過不足はエラー。
- `.DS_Store`、`Thumbs.db`、`._*` は無視される。
- 演習ディレクトリ内の余分なファイルはローダーでは拒否しない。ただし教材の一部でない作業ファイルを置かない。

`brief.md` はローダーでは必須ではないが、`lint` が必須として検査する。

## exercise.json

```json
{
  "id": "my-course-ch01-e01",
  "title": "あいさつを表示する",
  "env": "python",
  "objective": "print で 1 行表示する",
  "files": [
    { "path": "main.py", "from": "starter.py", "editable": true }
  ],
  "recipe": {
    "run": [["python3", "{src}"]]
  },
  "stdin": "Taro\n",
  "observe": [
    { "kind": "exit", "as": "exit" },
    { "kind": "stdout", "as": "out" }
  ],
  "judge": [
    { "on": "exit", "match": "equals", "value": 0 },
    { "on": "out", "match": "exact", "value": "こんにちは、Taroさん\n" }
  ],
  "diagnostics": [],
  "xp": 10,
  "hints": ["print の引数に文字列を渡します"],
  "tags": ["print"],
  "starterMayPass": false
}
```

- `id` はディレクトリ名と一致。
- `title` は必須。
- `env` は `course.json` の `envs` に存在するキー。
- `files` は 1 つ以上。editable なファイルが 1 つ以上必要。
- `recipe` は `build` か `run` のどちらかが必要。
- `stdin` と `stdinFile` は同時に指定できない。`stdinFile` は演習ディレクトリ相対で、存在が必要。
- `observe` は 1 つ以上。`judge` は 1 つ以上。
- `xp` は 0 以上の整数、既定 10。
- `hints` 既定 `[]`。空だと lint の警告。
- `tags` 既定 `[]`。表示用。
- `starterMayPass` 既定 `false`。true のときだけ、雛形が合格しても lint が通る。

### files

各要素は `{ path, from?, text?, editable? }`。

- `path` は作業ディレクトリ内の安全な相対パス。絶対パス、`..`、空セグメントは不可。
- `from` は演習ディレクトリからの相対パスで、雛形のコピー元。
- `text` はインラインの雛形。`from` か `text` のどちらかが必要。
- `editable` は既定 `false`。学習者が編集するファイル。
- editable な `path` には `solution/<同じ path>` が必須。

## envs

```json
{
  "python": {
    "provision": [["python3", "-m", "venv", "{work}/.venv"]],
    "cacheKey": "python3-v1",
    "probe": ["python3", "--version"],
    "path": ["{cache}/bin"],
    "env": { "PYTHONPATH": "{courseDir}" },
    "network": "off",
    "limits": { "timeoutMs": 15000, "memoryMb": 512 },
    "remediation": "env/README.md"
  }
}
```

- `provision` は一度だけ実行する用意。`string[][]`（コマンドの配列）。
- `cacheKey` は provision 結果の同一性。変えれば用意し直す。
- `probe` は用意できたかの確認。単一の argv `string[]`。失敗すると exit 3。
- `path` は PATH の先頭に足す。`{cache}` などのプレースホルダ可。
- `env` は追加の環境変数。
- `network` は `"on"` か `"off"`、既定 `"off"`。off は `PROGRADE_NETWORK=off` を渡す宣言で、OS レベルの遮断ではない。
- `limits.timeoutMs` は 100 以上。`memoryMb` は正の整数。
- `remediation` は環境が足りないときに案内するコース内のファイル。

## recipe

```json
{
  "build": [["python3", "-m", "py_compile", "{src}"]],
  "run": [["python3", "{src}"]]
}
```

- コマンドは順に実行し、非 0 終了でその列の後続を止める。
- `build` が失敗したら `run` は実行しない。
- 採点で観測するのは、ビルドと実行を通した「最後のコマンド」の結果。
- `stdin` / `stdinFile` は `run` にだけ渡る。

### プレースホルダ

recipe の argv と env の `path` / `env` の値で展開される。

- `{src}`: 編集ファイルが 1 つのとき、その絶対パス。2 つ以上あると使えない。
- `{work}`: 試行ディレクトリ。
- `{course}`: コース ID。
- `{cache}`: コース・環境のキャッシュ。
- `{ext}`: `course.json` の `ext`。
- `{root}`、`{courseDir}`。

`observe.path` は展開されない。literal な相対パスとして扱う。`planExercise` は observe 内の `{src}` も検出して 1 編集ファイル制約をかけるので、observe にプレースホルダを書かない。

## observe

観測点。`as` を省略したときの別名は固定。

| kind | 値 | 既定の別名 |
| --- | --- | --- |
| `exit` | 終了コード（数値、または `null`） | `exit` |
| `stdout` | 標準出力（文字列） | `stdout` |
| `stderr` | 標準エラー（文字列） | `stderr` |
| `file` | ファイル内容（文字列）。`path` 必須 | `file:<path>` |
| `exists` | ファイルの有無（真偽値）。`path` 必須 | `exists:<path>` |

- `as` は観測点の別名。重複はロードエラー。
- `maxBytes` は `stdout` / `stderr` / `file` で使える。
- `judge.on` は observe の別名を指す。存在しなければロードエラー。

## judge

| match | 意味 |
| --- | --- |
| `exact` | 文字列の完全一致。末尾改行も含む。 |
| `contains` | 部分文字列を含む。 |
| `regex` | 正規表現 `.test()`。アンカーは自分で書く。`flags` 任意。 |
| `equals` | 値の深い比較。`exit` は数値なので `0` と書く。 |
| `json` | stdout を JSON parse し、`pointer` の値を比較。pointer 既定は `""`（root）。 |
| `count` | 配列なら要素数、文字列なら空行を除く行数。 |

`label` を付けると、判定一覧の表示名になる。`exact` の失敗時は、改行コードだけ・末尾空白だけ・空白の数だけ、のヒントが付く。

### 代表パターン

終了コードだけ見る:

```json
{ "on": "exit", "match": "equals", "value": 0 }
```

出力の完全一致:

```json
{ "on": "stdout", "match": "exact", "value": "Hello\n" }
```

一部だけ確認:

```json
{ "on": "stdout", "match": "contains", "value": "合計: 15" }
```

JSON の一部を確認:

```json
{ "on": "stdout", "match": "json", "pointer": "/ok", "value": true }
```

ファイルが作られたか:

```json
{ "kind": "exists", "path": "out.txt", "as": "outfile" },
{ "on": "outfile", "match": "equals", "value": true }
```

## diagnostics（任意）

ビルドや実行のエラーを、学習者向けの行・列に変換する。既定は `[]`。

```json
{
  "when": "build",
  "parse": "regex",
  "pattern": "^(.*?):(\\d+):(\\d+): (error|warning): (.+)$",
  "flags": "gm"
}
```

- `when` は `"provision"` / `"build"` / `"run"`。既定 `"build"`。現在の採点で診断に使われるのは `build` と `run`。
- `parse: "regex"` は `pattern` 必須。名前付きグループ `file`、`line`、`column`、`endLine`、`endColumn`、`severity`、`code`、`message` を使える。
- `parse: "jsonl"` は 1 行 1 JSON。`map` は「フィールド → JSON Pointer」。`filter` で対象行を絞れる。

## クイズ（休止中）

クイズは現在休止中。レッスン直下に `quiz.json` を置かない。置くとロードエラーになる。復活させるまで、クイズの生成・採点は行わない。

## エラーの読み方

ロード時の失敗は `UserError` / `DataError` として、どのコース・どの演習かを含むメッセージになる。

- `ディレクトリが course.json と一致しません`: 索引とディレクトリの過不足。索引を正し、必要なディレクトリだけ作る。
- `余分なファイルがあります`: レッスン・章・セクション・`ex/` に置けないものを置いている。
- `演習 ID が重複しています`: コース内で同じ演習 ID を使っている。
- `judge.on が observe にありません`: 別名の綴り違い、または `as` の付け忘れ。
- `解答がありません: solution/<path>`: editable なファイルに対応する解答がない。
- `limits.timeoutMs が小さすぎます`: 100 未満。