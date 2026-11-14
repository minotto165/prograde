# prograde 計画 v2

> 本体は「プロセスを起動し、ファイルを読み、宣言された判定を適用する」だけ。
> 言語・パッケージマネージャ・DB・ブラウザ・コンテナの知識は、**すべてコース側**にある。

作成: 2026-11-14 / 前提: PROGRADE.md の要旨（Bun + TS 直実行、依存は zod・commander・picocolors、DB なし、教材本文は複製しない）

---

## 0. この計画の一行

**環境も教材もコースのデータ。本体は汎用の実行器と判定器だけ。** 言語を足すのはコースを1つ足すことであり、本体の改修ではない。

---

## 1. 不変条件（破ったら設計ミス）

1. **本体に環境構築の知識を書かない。** 言語名・パッケージマネージャ名・特定バイナリ名・バージョン判定・診断の正規表現を `src/core/` に置かない（テストで機械的に検査する）。
2. **判定は実行結果のみ。** 解答の見た目・文字列一致・自己申告では合格にしない。合格は「観測された事実」と「宣言された判定」の突き合わせだけで決まる。
3. **教材はコードではなくデータ。** 新しい言語・新しい科目＝新しいディレクトリ。本体の分岐で言語を区別しない。
4. **進捗は壊れても手で直せる。** 追記ログ（history）が真実、スナップショット（progress.json）は投影。どちらが欠けても復旧できる。
5. **失敗は次の手まで返す。** 環境不足なら「何を入れればよいか」をコースの文言で返す。黙って落ちない。
6. **本文は複製しない。** Progate 由来の文章・図・例題文は転載しない。メタデータ（ID・順序・難易度・タグ）のみ取り込む。
7. **ID は不変。** 演習 ID・レッスン ID は公開後に変えない（進捗の参照先だから）。

---

## 2. 用語

| 語 | 意味 | 置き場所 |
|---|---|---|
| 本体（engine） | 実行・観測・判定・報告の汎用機構 | `src/core/`, `src/cli/` |
| コース（course） | 1つの学習トラック（Rust, Python, SQL, React…） | `tracks/<id>/` |
| 環境（env） | 実行の土台。用意・確認・キャッシュ・制限 | コース内 `course.json` の `envs` |
| 教材（content） | レッスン本文・クイズ・演習の説明 | `tracks/<id>/content/` |
| 演習（exercise） | 1問。どの env で、何を作り、何を観測し、どう判定するか | `content/<lesson>/ex/<exId>/` |
| 観測（observe） | 採点に使う事実の取り出し（exit/stdout/files/http…） | 演習データ |
| 判定（judge） | 観測値と期待値の比較規則 | 演習データ |
| 試行（attempt） | 1回の採点。使い捨て | `work/<course>/<exId>/.attempt-*/` |
| 進捗（progress） | 永続。快復可能 | `state/` |
| キャッシュ | 環境の用意結果。再取得を避ける | `state/cache/<envKey>/` |

**3状態の境界**: content は静的で手書きでき、attempt は消えてよく、progress は壊れても直せる。この境界だけ守れば、ファイル名・スキーマ番号は自由に変えてよい。

---

## 3. アーキテクチャ

```
コース＝データ（環境も教材もここ）
  course.json        envs / lessons の宣言
  env/*.sh|*.mjs     用意・起動・ドライバ（コース内のスクリプト）
  content/**         レッスン本文・クイズ・演習データ・starter/solution/fixtures
        │
        ▼
本体＝汎用エンジン（言語を知らない）
  plan    → 手順の列を作る（provision / prepare / build / run / observe）
  exec    → プロセス起動（cwd/env/stdin/timeout/limits/network）
  observe → exit・stdout・stderr・ファイルを集める
  judge   → 宣言された判定を適用
  report  → 合否・差分・診断・次の手
```

本体の公開 API（これ以外を作らない）:

```ts
loadCourse(dir): Course
ensureEnv(env): { dir, envVars, path, probe }      // 用意とキャッシュ
plan(course, exercise, ctx): Step[]
exec(step): Observation
judge(rules, observation): Check[]
report(result): Result
```

**どれも言語名を受け取らない。** 受け取った瞬間に設計ミス。

---

## 4. データモデル

### 4.1 course.json

```jsonc
{
  "schema": 2,
  "id": "rust",
  "label": "Rust",
  "ext": "rs",
  "envs": { "rust-stable": { /* 4.2 */ } },
  "lessons": [ /* 4.3 の参照。順序は lessons 配列の順 */ ]
}
```

### 4.2 env（環境）

```jsonc
{
  "provision": ["bash", "env/install.sh"],     // 一度だけ。旧: toolchain
  "cacheKey": "rustc-1.83",                     // provision 結果の同一性
  "probe": ["rustc", "--version"],              // 無ければ exit 3
  "path": ["{cache}/bin"],
  "env": { "CARGO_HOME": "{cache}", "TZ": "UTC" },
  "network": "off",                             // off | on
  "limits": { "timeoutMs": 20000, "memoryMb": 512 },
  "remediation": "env/README.md#install"        // 不足時の案内（コース内の見出し）
}
```

- `provision` は**コマンド**。Docker でも rustup でも npm ci でもよい。本体は中身を知らない。
- `cacheKey` が変われば provision をやり直す。失敗した provision はキャッシュしない。
- 環境は**コース内**に閉じる。共有したくなったら、その時点でコースを分割するか `$include` を設計する（今はやらない）。

### 4.3 演習

```jsonc
{
  "id": "rust-01-e02",
  "title": "…",
  "env": "rust-stable",
  "files": [
    { "path": "src/main.rs", "from": "starter.rs", "editable": true },
    { "path": "Cargo.toml",  "from": "fixture/Cargo.toml", "editable": false }
  ],
  "recipe": {
    "build": [["cargo", "build", "--quiet"]],
    "run":   [["cargo", "run", "--quiet"]]
  },
  "stdio": { "stdinFile": "stdin.txt" },
  "observe": [
    { "kind": "exit" },
    { "kind": "stdout", "as": "out" },
    { "kind": "file", "path": "{work}/target/out.txt", "as": "artifact" }
  ],
  "judge": [
    { "on": "exit", "is": 0 },
    { "on": "out", "match": "exact", "value": "hi\n" }
  ],
  "diagnostics": [
    { "when": "build", "parse": "jsonl", "pointer": "/message/spans/0", "code": "/message/code/code" }
  ],
  "xp": 10,
  "hints": ["…", "…", "…"],
  "starterMayPass": false
}
```

### 4.4 プレースホルダ

`{src}`（編集対象の絶対パス）`{work}`（試行ディレクトリ）`{course}`（コースのルート）`{cache}`（env キャッシュ）`{ext}`（拡張子）

### 4.5 観測点と判定

- 観測点: `exit` / `stdout` / `stderr` / `file`（中身または存在）/ `http`（コース内スクリプト経由を推奨）/ `check`（コース提供の検査コマンドの終了コード）
- マッチャ: `exact` / `contains` / `regex` / `json`（JSON Pointer + 期待値）/ `exists` / `count`
- **新しい観測点は本体の汎用機構として足す**（1回だけ）。言語・フレームワーク固有の観測点は足さない。足りない観測は、コース内スクリプトがファイルに書き出して `file` で読む。

### 4.6 診断（コンパイルエラーの解釈）

本体が持つパーサは2種類だけ:

- `parse: "regex"` … 名前付きグループ `file`/`line`/`col`/`severity`/`code`/`message`
- `parse: "jsonl"` … 1行1JSON。`pointer` で位置、`code` でコードを抜く

どの言語のエラーをどう読むかは**コースのデータ**。ここが最後の言語リークだったので塞ぐ。

---

## 5. 実行パイプライン

```
1. prepare  … 試行ディレクトリ作成、files を展開、editable 以外は読み取り専用扱い
2. ensureEnv… provision（キャッシュ済みならスキップ）→ probe（失敗なら 3）
3. build    … recipe.build（任意）。失敗したら diagnostics を解釈
4. run      … recipe.run（任意）。timeout で SIGKILL
5. observe  … observe の各点を集める
6. judge    … 宣言どおり比較。全チェック合格なら成功
7. settle   … 成功なら試行を削除、失敗なら残す（--keep で常に残す）
```

**決定性**: 時刻・乱数・ポート・パス・ネットワークは env の宣言で固定・遮断する。本体がやるのは「宣言された値を渡す／遮断する」だけ。

---

## 6. 状態と保存

```
state/
  progress.json    投影（壊れても history から再構築できる）
  history.jsonl    追記のみが真実（1行1イベント）
  cache/<envKey>/  環境の用意結果
work/<course>/<exId>/   作業コピー（編集用）
```

イベント例: `attempt_started` / `attempt_finished` / `env_provisioned` / `reset`

- 書き込みは tmp+rename、ロックは `wx` で排他（stale 30s, timeout 5s）。
- progress.json が無い・壊れている → history から黙って再構築し、警告を1行出す。

---

## 7. 失敗と exit code

| code | 意味 | 返すもの |
|---|---|---|
| 0 | 合格 | 結果サマリ |
| 1 | 不合格 | 期待・実際・最初の差分・次の手 |
| 2 | 使い方/データ不正 | どのファイルのどこが不正か |
| 3 | 環境不足 | コースの remediation をそのまま案内 |
| 4 | 内部エラー | 再現手順つきのメッセージ |

timeout は不合格（1）として理由を明示。

---

## 8. 禁止リスト（本体が知ってはいけないこと）

- 言語名（rust, python, go, php, sql, javascript…）
- パッケージマネージャ・ツール名（cargo, rustup, npm, pip, dotnet, psql, docker…）
- バージョン比較のロジック
- 言語別の診断正規表現
- フレームワーク固有の起動方法

**検査**: `tests/no-hardcode.test.ts` が `src/core/**` と `src/cli/**` を走査し、禁止語ゼロを検証する。落ちたら設計違反として扱う。

---

## 9. マイルストーン

各マイルストーンは**動く証拠**を1つ残す（テスト緑だけで完了にしない）。

### M0 — 骨格（完了）
1言語1演習を端から端まで。setup / fsx / runner / 採点 / CLI check / status スタブ。
証拠: `_example-echo` の4演習が CLI で通る、テスト18件。

### M0.5 — 本体の純化（次にやる）
目的: 「本体は環境を知らない」を**コードで**成立させる。
- schema v2: `runtime`→`env`、`mode`→`observe`+`judge`、`files[]`、`diagnostics` をデータ化
- core: `env.ts`（provision/probe/cache）、`plan.ts`、`judge.ts`、診断パーサ2種
- `{course}` / `{cache}` プレースホルダ
- `tests/no-hardcode.test.ts`
- `_example-echo` を v2 へ移植 ＋ **Python コースを追加**（本体差分0行の実証）
受入: 2コースが同じバイナリで動く／禁止語0／`bun test` 緑／`tsc` エラー0

### M1 — 永続化
目的: 解いた事実が残り、次の一歩が案内される。
- `state/history.jsonl` 追記 ＋ `progress.json` 投影 ＋ ロック ＋ 復旧
- attempt の記録（開始/終了/時間/結果）
- `status` を実データに（XP・Lv・streak・次にやる1問）
- 孤児になった attempt の掃除
受入: 合格→status に反映／途中 kill 後の再実行で復旧／progress.json を消しても history から戻る

### M1.5 — 学習ループ
- `open`（作業コピーを作って開く）、`run`（採点せず実行だけ）、`hint`（段階的ヒント）、`reset`
- `selftest`（solution を全問流して教材の正しさを検査）
受入: starter が落ち、solution が通り、selftest が全演習緑

### M2 — 教材のデータ化と品質基準
目的: 本文・クイズ・演習がコースのデータとして揃う。
- レッスン本文の書式（Markdown ＋ 実行可能な例 ＋ チェックポイント）。`slides/NN.md` のページ送りに対応
- quiz の採点（選択式・複数選択）
- Rust curriculum の**メタデータのみ**移植（ID・順序・タグ・想定時間。本文は書かない）
- **1レッスンを完成品として書き切る**（品質基準をここで固定）
受入: レッスン表示・クイズ採点が動く／完成品1レッスンが「読んで→書いて→通る」まで通る

### M3 — Rust の実ツールチェーン
- rust の env（provision/probe/診断 jsonl）をコース側だけに実装
- Cargo プロジェクト型（複数ファイル）の演習
- サンプル15問を selftest で緑に
受入: 本体差分0行で Rust が動く／コンパイルエラーが場所つきで返る

### M4 — 執筆パイプライン
- selftest 全問（162演習）を回す仕組みとレポート
- 教材 lint（brief 必須項目、hint 3段、solution 存在、出力の決定性、時間上限）
- HTML からのメタデータ草案生成（**本文は生成しない**）
受入: 全演習 selftest 緑／lint 0／新しい演習を1問追加する手順が10分で回る

### M5 — Web（読む・進捗）
- `web/` に SvelteKit SSR ＋ Tailwind。**core を共有**し、採点ロジックを二重実装しない
- レッスン閲覧・進捗ダッシュボード（読み取り専用から）
受入: CLI と同じ JSON を表示／本体内の変更0行で Web が載る

### M6 — Web 実行＋拡張の実証
- Web からの採点（サーバ側で core を実行、結果をストリーム）
- 2言語目以降の実証: Go（コンパイル型）と SQL（サービス型）
- ブラウザ観測の実証（React コースをコース内ドライバで）
- コンテナ env の実証（provision に docker を書くだけ）
受入: どの追加も `src/core` の差分0行

---

## 10. テスト戦略

| 層 | 何を守るか |
|---|---|
| 単体 | exec の timeout/切り詰め/stdin、fsx の原子性、judge の各マッチャ、診断パーサ2種 |
| 契約 | no-hardcode（禁止語0）、schema 検証（不正データは日本語で落ちる） |
| 統合 | 各コースの selftest（starter 落ちる／solution 通る） |
| 復旧 | progress 破損・history 欠損・孤児 attempt・provision 失敗 |
| 決定性 | 同じ解答を2回流して同じ結果 |

**規約**: 各マイルストーン終了時に `bun test` と `tsc --noEmit` を実行し、出力を報告に貼る。

---

## 11. 非目標（今はやらない）

- マルチユーザー・アカウント・課金・運用
- モバイル実機・エミュレータの配布
- 教材本文の転載・自動生成（メタデータ草案まで）
- コース間の env 共有（必要になったら設計する）
- クラウド実行基盤

---

## 12. リスクと対策

| リスク | 対策 |
|---|---|
| 本体に言語知識が漏れる | 禁止語テストを CI 相当の位置づけに。落ちたら差し戻し |
| provision が重く採点が遅い | キャッシュ鍵＋スキップ。probe で早期失敗（3） |
| 出力が非決定的で誤判定 | env で TZ/乱数/ポート/パスを固定、ネット遮断。selftest で2回実行比較 |
| 教材品質が最後まで未知数 | M2 で完成品1レッスンを先に作り、基準を固定してから量産 |
| スキーマ変更で教材が壊れる | schema 番号＋移行スクリプト。v1→v2 は M0.5 で1回だけ |
| Web で採点が二重実装になる | core を共有。Web は表示とトランスポートだけ |

---

## 13. 未決事項

1. XP の式（M1 で素朴な加点から開始し、後で差し替え可能にする）
2. 教材本文の書式（Markdown のみか、実行可能ブロックを持つか）— M2 で決定
3. 環境の共有単位（コース内に閉じる方針。分割が必要になった時の `$include` 仕様）
4. `_example-echo` を開発用フィクスチャとして残すか、Python コースに置き換えるか
5. Web からの実行を「同一プロセス」か「ジョブキュー」か（M6 で決定）


## 実装状況（2026-11-14 時点）

| マイルストーン | 状態 | 備考 |
| --- | --- | --- |
| M0 骨格 | 完了 | 実行・採点・CLI |
| M0.5 純化 | 完了 | 本体に言語名なし。env/plan/judge/diagnostics のデータ化。`tests/no-hardcode.test.ts` |
| M1 永続化 | 完了 | history.jsonl 追記 + progress.json 投影 + ロック + 壊れた行の無視 + 復旧 |
| M1.5 学習ループ | 完了 | open / hint / reset / quiz / selftest |
| M2 教材 | 完了（仕組み） | lesson/quiz/brief の読み込みと表示。教材本文は非対象 |
| M3 Rust 実行 | 未着手（意図的） | コースの実装はしない方針。Python で2言語目を実証 |
| M4 執筆パイプライン | 完了 | selftest（全問解答で合格・2回で同一）と lint（静的/動的） |
| M5 Web | 完了 | SvelteKit SSR + Tailwind、core 共有、採点フォーム |
| M6 拡張実証 | 一部 | シェル + Python で本体差分ゼロを確認。Go/SQL/React はコース追加のみ |

コース（`tracks/`）と進捗（`state/`）はリポジトリに含めない。既定のデータルートは `~/.prograde/` で、`--root` > `PROGRADE_ROOT` > ホームの順に解決する。テストは一時ディレクトリに生成したコースだけを使う。
