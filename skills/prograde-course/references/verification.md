# 検証と進捗の衛生

教材は、書いただけでは完成しない。`check`、`lint`、`selftest` の順で、実行結果まで確かめる。

## 前提

リポジトリのルートで実行する。

```bash
cd /Users/minotto/dev/prograde
bun --version
```

依存が入っていない場合だけ `bun install` を実行する。Prograde の CLI は `bun bin/prograde.ts` で動く。データのルートは `--root` > `PROGRADE_ROOT` > `~/.prograde`。

```bash
bun bin/prograde.ts --root ~/.prograde -c <courseId> where
```

## 1 演習ごとの確認

新しい演習を書いたら、全体の lint を待たずにその演習だけ確認する。

```bash
# 雛形のまま採点する（不合格になるはず）
bun bin/prograde.ts -c <courseId> check <exId> --no-record

# 模範解答を採点する（合格するはず）
bun bin/prograde.ts -c <courseId> check <exId> --no-record --file <courseDir>/content/<lesson>/chapters/<chapter>/sections/<section>/ex/<exId>/solution/<path>
```

- `check` は既定で履歴に記録する。教材作成中は必ず `--no-record` を付ける。
- 雛形が不合格なら exit 1。これは正常。メッセージが期待どおりの不合格理由かを見る。
- 解答が合格すれば exit 0。
- 出力と stderr を見たいときは `run <exId>`。`run` は採点も記録もしない。
- 演習 ID を間違えると「演習が見つかりません」で exit 2。

`--file` は 1 ファイルの解答を直接渡す。複数の編集ファイルがある演習は `--files` を使う。渡すパスは作業ディレクトリからの実ファイルで、演習 ID との対応は basename で判定される。上の `<courseDir>` は `~/.prograde/tracks/<courseId>` を指す。

### 確認すること

- 雛形が不合格で、理由が「まだ実装していない」になっている。
- 解答が合格する。
- 解答を 2 回実行して、同じ終了コードと同じ標準出力になる。
- 入力がある演習は、`stdin` の内容で期待どおり動く。
- エラーになる演習は、stderr が学習者に読める内容になっている。

## 全体の lint

```bash
bun bin/prograde.ts -c <courseId> lint --static
bun bin/prograde.ts -c <courseId> lint
```

`--static` は実行を伴わない検査。まずこれで構造を固める。`lint` は全演習の雛形と解答を実際に実行する。

### lint が見るもの

- セクションにスライドがあるか。
- スライドが空でないか。
- レッスン本文が短すぎないか（80 文字未満は警告）。
- `brief.md` があるか。
- `hints` が空でないか（警告）。
- `judge` が空でないか。
- 雛形がそのまま合格しないか（`starterMayPass: true` で免除）。
- 解答が合格するか。
- 解答が 2 回とも同じ終了コード・標準出力になるか。

### 出力の読み方

```text
! my-course-ch01-e01: ヒントがありません
✗ my-course-ch01-e01: 雛形がそのまま合格してしまいます（starterMayPass: true で許可）
OK  3 演習 / エラー 0 / 警告 2
```

- `!` は警告。直すのが望ましいが、exit code は 0 のことがある。
- `✗` はエラー。exit 1。
- 最後の行の `OK` / `NG` と件数で全体を判断する。

### よくある失敗

**雛形がそのまま合格する**

雛形が完成コードになっている。TODO を残す、出力を変える、条件を増やす。どうしても必要な場合だけ `starterMayPass: true` を使い、理由を報告する。

**解答が不合格**

`check --file solution/<path>` でその演習だけ実行し、`run` で stdout と stderr を見る。判定の期待値、末尾改行、入力、ファイルパスを確認する。判定を緩める前に、要件と表示のどちらが間違っているかを決める。

**解答の結果が実行ごとに変わります**

乱数、現在時刻、ファイル一覧の順序、並列処理、ネットワークなどが原因。固定値にするか、演習から外す。

**brief.md がありません**

演習ディレクトリに `brief.md` を追加する。ローダーは通すが lint が落とす。

**余分なファイルがあります**

レッスン・章・セクション・`ex/` に置けないものを置いている。作業ファイルやエディタのバックアップを退避する。`.DS_Store` は無視される。

**ディレクトリが course.json と一致しません**

索引と実ディレクトリの過不足。`course.json` を正し、必要なディレクトリだけを作る。空の章やセクションを残さない。

**judge.on が observe にありません**

`as` の付け忘れか綴り違い。`observe` の別名と `judge.on` を一致させる。

**解答がありません: solution/<path>**

editable な `path` に対応する解答ファイルがない。`solution/<同じ path>` を置く。

## selftest

```bash
bun bin/prograde.ts -c <courseId> selftest
```

全演習の解答だけを採点する回帰テスト。`lint` より速く、解答の破壊を検出する。失敗すると exit 1。

```bash
# 一部だけ
bun bin/prograde.ts -c <courseId> selftest --only my-course-ch01-e01,my-course-ch01-e02
```

`lint` と `selftest` は進捗を記録しない。安心して何度でも実行できる。

## スモークテスト

新しいコースを追加したら、最後に次を通す。

```bash
bun bin/prograde.ts -c <courseId> lint --static
bun bin/prograde.ts -c <courseId> lint
bun bin/prograde.ts -c <courseId> selftest
```

すべて exit 0。警告が残る場合は、残す理由を報告に書く。

### 新しいコースの最小確認

1 セクションだけ作って、次を確認すると早い。

```bash
bun bin/prograde.ts -c <courseId> list
bun bin/prograde.ts -c <courseId> check <exId> --no-record
bun bin/prograde.ts -c <courseId> lint --static
bun bin/prograde.ts -c <courseId> lint
bun bin/prograde.ts -c <courseId> selftest --only <exId>
```

問題がなければセクションを増やす。増やすたびに `lint --static` を実行すると、構造エラーを早く見つけられる。

## 進捗を汚さない

- 教材作成中の `check` には必ず `--no-record`。
- `lint` と `selftest` は記録しない。
- `state/` を直接編集しない。進捗の形式は実装の内部。
- 誤って記録した場合は、その演習の作業コピーと履歴が残る。消すのはユーザーの了承を得てから。`reset` は作業コピーを戻すが、合格履歴は消さない。
- 動作確認で演習を解いた場合、ユーザーの進捗を変えたことを報告する。

## 完了条件

- `lint --static` が exit 0。
- `lint` が exit 0。
- `selftest` が exit 0。
- 全演習の雛形が不合格で、解答が 2 回とも合格する。
- 進捗を汚していない。
- 変更したのは `tracks/<courseId>/` 配下だけ。

## 報告テンプレート

```text
できた: <コース名>（<レッスン数> レッスン / <章数> 章 / <セクション数> セクション / <演習数> 演習）
検証: lint --static OK、lint OK（エラー 0 / 警告 n）、selftest n/n 合格
触った: <root>/tracks/<courseId>/
次: <追加候補、未解決点>
```