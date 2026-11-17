---
name: prograde-course
description: Prograde のコース、レッスン、章、セクション、スライド、演習を作成・拡張する。実行結果で採点する exercise.json を書き、lint と selftest で教材を検証する。Prograde に新しい言語コースを追加する、既存コースに教材を足す、演習の採点を直す、教材の lint 不合格を直すときに使う。
---

# Prograde コース作成

Prograde は、学習者が書いたコードを実際にビルド・実行し、終了コード・標準出力・ファイルだけで合否を返す練習プラットフォーム。コースはエンジンのコードではなく、`tracks/<courseId>/` のデータとして書く。

このスキルは、そのデータを schema 3 で組み立て、最後に `lint` と `selftest` を通すための実務手順。コースの新規作成と、既存コースへの追加の両方を扱う。

## 最初に読むもの

Prograde のチェックアウトは通常 `/Users/minotto/dev/prograde`。別の場所なら `pwd` と `git rev-parse --show-toplevel` で確認する。以下はリポジトリからの相対パス。

- `README.md` の「コースの書き方」
- `src/schema/index.ts`（データ構造の正本）
- `src/core/course/loader.ts`（ディレクトリの厳格さ）
- 既存の実例: `~/.prograde/tracks/python-basics/content/basics/chapters/pyb-01/sections/greeting/`
- `references/course-data.md`、`references/authoring.md`、`references/verification.md`

**スキルとリポジトリが食い違ったら、リポジトリを正とする。** スキーマやローダーが変わっていたら、実装前にこのスキルの記述を読み直して更新する。

データの場所は `--root` > `PROGRADE_ROOT` > `~/.prograde` の順。コース置き場は `<root>/tracks`、進捗は `<root>/state`。ユーザーが別のルートを指定していなければ `~/.prograde` を使う。コースをリポジトリ内に作らない。

## 進め方

### 1. 依頼を整理する

次を決める。分からないものだけを、一度にまとめて聞く。ファイルの場所は聞かず、自分で `courses` と `where` を確認する。

- 新規コースか、既存コースへの追加か
- 言語・実行環境（Python、Rust、JavaScript、SQL など）
- 対象者と前提知識
- 規模（レッスン数、章数、セクション数）

既存コースを拡張する場合は、先に `bun bin/prograde.ts -c <course> list` と `bun bin/prograde.ts -c <course> lesson <lessonId>` で現在の ID と並びを確認する。**既存のコース ID・演習 ID は進捗のキーなので変えない。**

### 2. 環境を確認する

対象言語の実行系を 1 コマンドで確認し、`course.json` の `envs` に `probe` を書く。たとえば Python なら `["python3", "--version"]`。

動かない場合は、偽のコンパイラや実行していないのに成功する fixture でごまかさず、必要な導入を報告して止める。`probe` の失敗は exit 3（環境が用意できない）になる。

### 3. 設計表を作る

いきなりファイルを書かない。先に、コース > レッスン > 章 > セクションの表を作る。各セクションに次を書く。

| レッスン | 章 | セクション | 演習 ID | 学ぶこと | 学習者が書くこと | 合格条件 |
| --- | --- | --- | --- | --- | --- | --- |

- 1 セクション = 1 つの概念 + 1 つの演習。
- スライドは 2〜4 枚を目安にする。最初の 1 枚で結論、次の 1〜2 枚で例、最後に注意点。
- 演習 ID はコース内で一意。既存コースの接頭辞に合わせる（例: `pyb-01-e01`、`rust-01-e01`）。
- 全体コースの新規作成では、この表をユーザーに見せて、規模と範囲の承認を得てから量産する。ユーザーが「全部やって」と言っている場合や、既存コースへの小さな追加は、そのまま進めてよい。
- 1 つの演習で新概念を 2 つ以上入れない。前のセクションのコードを少し変えるところから始め、最後に白紙から書かせる。

### 4. 索引を先に書く

`<root>/tracks/<courseId>/course.json` を最初に書く。`schema: 3`、`id`、`label`、`ext`、`envs`、`lessons[].chapters[].sections[]` を埋める。

- コース ID・レッスン ID・章 ID・セクション ID は `^[a-z0-9][a-z0-9_-]*$`。
- コース ID はディレクトリ名と一致させる。
- `course.json` が唯一の索引。ディレクトリを先に作ってから索引を合わせるのではなく、索引を確定してから必要なディレクトリだけを作る。

### 5. セクションを 1 つずつ書く

各セクションで、次の順に作る。

1. `slides/01.md`、`02.md` …（2 桁の番号。`01-intro.md` のような名前も可）
2. `ex/<exId>/brief.md`（課題文）
3. `ex/<exId>/starter.<ext>`（雛形）
4. `ex/<exId>/solution/<path>`（模範解答）
5. `ex/<exId>/exercise.json`（環境・ファイル・実行・観測・判定）

スライドの先頭には `# 見出し` を置く。本文は Markdown。生 HTML はエスケープされるので、HTML タグでレイアウトしない。

`exercise.json` の骨格:

```json
{
  "id": "pyb-01-e01",
  "title": "あいさつを表示する",
  "env": "python",
  "objective": "print で文字列を 1 行表示する",
  "files": [
    { "path": "main.py", "from": "starter.py", "editable": true }
  ],
  "recipe": {
    "run": [["python3", "{src}"]]
  },
  "observe": [
    { "kind": "exit", "as": "exit" },
    { "kind": "stdout", "as": "out" }
  ],
  "judge": [
    { "on": "exit", "match": "equals", "value": 0 },
    { "on": "out", "match": "exact", "value": "Hello, Python!\n" }
  ],
  "xp": 10,
  "hints": ["print(\"Hello, Python!\") と書きます"]
}
```

判定は、学習者が書いたコードを実際に実行した結果だけを見る。ソースコードを grep したり、実行していないのに成功する fixture を使ったりしない。

### 6. 1 演習ごとに確かめる

新しい演習を書いたら、その場で次を実行する。

```bash
cd /Users/minotto/dev/prograde
bun bin/prograde.ts -c <courseId> check <exId> --no-record
```

- 雛形のまま不合格になること
- 模範解答が合格すること
- `run <exId>` で実際の出力と stderr を確認できること

`check` は既定で進捗に記録する。教材作成中は必ず `--no-record` を付ける。`state/` を直接編集しない。

### 7. 全体を検証する

```bash
bun bin/prograde.ts -c <courseId> lint --static
bun bin/prograde.ts -c <courseId> lint
bun bin/prograde.ts -c <courseId> selftest
```

- `lint --static` は構造・必須ファイル・スライド名などを検査する。まずこれで構造エラーを潰す。
- `lint` は全演習の雛形と解答を実行する。雛形が合格しないか、解答が合格するか、解答が 2 回とも同じ結果かを検査する。
- `selftest` は全解答だけを採点する回帰テスト。

失敗したら、次のセクションへ進まず直す。全部通ってから報告する。

### 8. 報告する

ユーザーの言語で、次を短く報告する。

- できたこと（コース名、レッスン数、章数、セクション数、演習数）
- 検証コマンドと結果（`lint --static` / `lint` / `selftest` の pass 数）
- 触ったファイル（`tracks/<courseId>/` 配下）
- 次の候補（追加するとよいレッスン、未実装の言語など）
- 判断待ち・未解決点

## 守るルール

- **1 セクション = 1 枚以上のスライド + ちょうど 1 つの演習。** `ex/` に演習ディレクトリを 2 つ置かない。
- **editable なファイルは 1 つ以上。** editable な `path` には必ず `solution/<同じ path>` を置く。
- **雛形は不合格にする。** 意図的に合格させる場合だけ `starterMayPass: true` を使い、理由を報告する。
- **正解を `brief.md` やヒントに書かない。** ヒントは 2〜3 段で、完成コードではなく着眼点を書く。
- **出力の完全一致は末尾改行まで含める。** `exact` で改行や空白が違うと落ちる。落ちたら判定を緩めるのではなく、要件と表示を直す。
- **ネットワークは既定で off。** 必要な演習だけ `network: "on"` にし、probe で確認する。
- **Progate などの本文を複製しない。** 説明はオリジナルで書く。既存コースは構造と書き方の参考にとどめる。
- **教材作成中は `check --no-record`。** `state/` を直接触らない。
- **製品リポジトリを変更しない。** このスキルの仕事は `tracks/` のデータ作成と CLI での検証だけ。エンジンに不足があれば、勝手に直さず報告する。
- **作業ファイルを教材内に置かない。** 一時ファイルは `/tmp` に置く。教材のディレクトリはローダーが過不足を検査する。

## 完了条件

- `lint --static` が exit 0。
- 全 `lint` が exit 0。
- `selftest` が exit 0。
- 各演習の雛形が不合格で、解答が 2 回とも合格する。
- 進捗を汚していない（`check --no-record` を使った）。
- コースの全セクションに、スライドと演習が 1 つずつある。

## 参照資料

- `references/course-data.md`: ディレクトリ、`course.json`、`exercise.json`、環境、観測、判定の正確な形。
- `references/authoring.md`: カリキュラム、スライド、課題文、ヒント、採点パターン、アンチパターン。
- `references/verification.md`: 検証コマンド、失敗の読み方、スモークテスト、進捗衛生。