# prograde

ローカル完結のプログラミング練習プラットフォーム。コースはデータ、採点は実行結果だけを見る。

## 何をするものか

- 演習を解いて `prograde check` すると、ビルドして実行して、結果（終了コード・標準出力・ファイル）だけで合否を返す。
- 教材・環境・判定はすべてコースのデータ（`tracks/<id>/`）に書く。エンジンは言語を知らない。
- 進捗は `state/history.jsonl` への追記が真実。`state/progress.json` はいつでも作り直せる投影。
- コース（`tracks/`）と進捗（`state/`）はホームの `~/.prograde/` に置く。リポジトリには含めない。
- データの場所は `--root` > `PROGRADE_ROOT` > `~/.prograde` の順で決まる。

## 使い方

```bash
bun bin/prograde.ts courses
bun bin/prograde.ts -c example-echo list
bun bin/prograde.ts -c example-echo lesson echo-01
bun bin/prograde.ts -c example-echo lesson echo-01 --slide 1
bun bin/prograde.ts -c example-echo lesson echo-01 --json
bun bin/prograde.ts -c example-echo quiz echo-01 --answer q1=a
bun bin/prograde.ts -c example-echo open echo-01-e01
bun bin/prograde.ts -c example-echo check echo-01-e01
bun bin/prograde.ts -c example-echo hint echo-01-e01 --all
bun bin/prograde.ts -c example-echo status
bun bin/prograde.ts -c example-echo selftest
bun bin/prograde.ts -c example-echo lint
```

上の例は、`~/.prograde/tracks/example-echo` を置いている場合（`--root` で別の場所も指定できる）。

終了コード: 0 合格 / 1 不合格 / 2 データ・使い方の誤り / 3 環境が用意できない / 4 内部エラー。
timeout は不合格扱い。

## コースの書き方

1コース = 1ディレクトリ。

```
tracks/<courseId>/
  course.json                 # id, label, ext, envs, lessons
  content/<lessonId>/
    slides/NN.md              # ページ送り教材（1枚=1ファイル）
    lesson.md                 # 旧形式の1枚教材（slides/ とは併用不可）
    quiz.json                 # 振り返りクイズ（任意）
    ex/<exId>/
      exercise.json           # 環境・ファイル・実行・観測・判定
      brief.md                # 課題文
      starter.<ext>           # 雛形（files[].from）
      solution/<path>         # 模範解答（selftest が使う）
      fixtures/               # 擬似ツールなど（任意）
```

`exercise.json` の骨格:

```json
{
  "id": "py-01-e01",
  "title": "42 と出力する",
  "env": "python",
  "files": [{ "path": "main.py", "from": "starter.py", "editable": true }],
  "recipe": { "run": [["python3", "{src}"]] },
  "observe": [{ "kind": "exit", "as": "exit" }, { "kind": "stdout", "as": "out" }],
  "judge": [
    { "on": "exit", "match": "equals", "value": 0 },
    { "on": "out", "match": "exact", "value": "42\n" }
  ],
  "xp": 10,
  "hints": ["print(42)"]
}
```

- 実行は `build` → `run` の2段。失敗した段で止まる。
- 観測は `exit` / `stdout` / `stderr` / `file` / `exists`。
- 判定は `exact` / `contains` / `regex` / `equals` / `json` / `count`。
- プレースホルダ: `{src}`（編集ファイル。1つのときだけ）`{work}` `{course}` `{cache}` `{ext}`。

### 環境（env）

`course.json` の `envs` に、その言語の道具をどう用意するかを書く。エンジンは中身を解釈しない。

```json
{
  "rust": {
    "cacheKey": "rust-1.83",
    "provision": [["rustup", "toolchain", "install", "1.83.0"]],
    "probe": ["rustc", "--version"],
    "path": ["{cache}/bin"],
    "network": "off",
    "limits": { "timeoutMs": 20000 },
    "remediation": "SETUP.md"
  }
}
```

- `provision` は一度だけ走り、成功したら `state/cache/<course>/<env>/` に記録される（`cacheKey` が変われば作り直し）。失敗はキャッシュしない。
- 失敗時は `remediation` のファイル本文を添えて exit 3 で止まる。
- 環境変数: `PROGRADE` `PROGRADE_COURSE` `PROGRADE_ENV` `PROGRADE_CACHE` `PROGRADE_COURSE_DIR` `PROGRADE_NETWORK`。

### 診断（コンパイラのエラー）

`exercise.json` の `diagnostics` に、どの出力をどう読むかだけを書く。

```json
{ "when": "build", "parse": "regex",
  "pattern": "^(?<file>[^:]+):(?<line>\\d+): (?<severity>error|warning): (?<message>.+)$",
  "flags": "gm" }
```

`parse: "jsonl"` なら `map` でフィールドを JSON Pointer に写す。

## Web

Web だけで学習を完結できる（CLI は不要）。

```bash
cd web && bun run build
ORIGIN=http://127.0.0.1:4173 PORT=4173 bun build/index.js
```

- `ORIGIN` は必須。無いとフォームの POST が 403 になる。
- データは既定で `~/.prograde/`。`PROGRADE_ROOT` で別の場所を指せる。

画面と操作:

| パス | 内容 |
| --- | --- |
| `/` | 学習状況（Lv / XP / 解いた数 / 連続日数）とコース一覧、続きから解く導線 |
| `/help` | 使い方と採点の仕組み |
| `/c/<course>` | レッスン一覧と進捗 |
| `/c/<course>/l/<lesson>` | 章とセクションの一覧、レッスン全体の進捗 |
| `/c/<course>/l/<lesson>/ch/<chapter>/s/<section>` | セクションのスライド。`/<n>` でページ送り |
| `/c/<course>/e/<exercise>` | 3ペイン（手順 / エディタ / コンソールと見本）、採点 / 実行だけ / 雛形に戻す、レッスン進捗バー |

- 演習画面は左に手順（課題・判定・ヒント）、中央にファイルタブ付きエディタ、右にコンソールと見本を並べる。下部はレッスンの進捗バー。
- 「見本」はコースの `judge` をそのまま表示したもの。本体に言語固有の知識は入れない。
- 採点結果は合格・不合格、判定ごとの期待値と実際値、診断、標準出力・標準エラーで返す。
- 「実行だけ」は判定を表示せず、終了コードと出力だけを見せる（履歴には記録しない）。
- 提出したコードは作業コピーに保存されるので、次に開くと続きから書ける。「雛形に戻す」で初期状態に戻る。
- コース > レッスン > 章 > セクション > スライド / 演習 の5階層。セクションは1枚以上の `slides/NN.md` と1つの演習を持ち、スライドを番号順に1ページずつ表示して最後に演習へ進む。
- クイズの回答は保存しない（何度でも試せる）。
- SSR のみで、クライアント JS が無くてもフォームが動く。CLI と同じ `src/core` を共有する。

## 開発

```bash
bun test          # エンジン（一時ディレクトリに生成したコースで検証）
bun run typecheck # tsc --noEmit
```

`tests/no-hardcode.test.ts` が `src/core` と `src/cli` に言語固有の語（rustc, npm, docker など）が入っていないことを検証する。
テストは一時ディレクトリにコースを生成するので、`tracks/` が無くても通る。
新しい言語を足すときは `~/.prograde/tracks/` にコースを足すだけで、エンジンには触らない。コースはリポジトリにコミットしない。
データを非公開 Git で管理したい場合は、`~/.prograde` で `git init` し、`state/` と `work/` を `.gitignore` する。
