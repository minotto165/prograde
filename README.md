# prograde

ローカル完結のプログラミング練習プラットフォーム。教材はデータ、採点は実行結果だけを見る。

- `check` はビルドと実行を行い、終了コード・標準出力・ファイルだけで合否を返す。
- 教材・環境・判定は `tracks/<courseId>/` に書く。エンジンは言語を知らない。
- スライドと課題文は Markdown。数式は KaTeX で描画する。
- 進捗は `~/.prograde/state/history.jsonl` への追記が真実。
- CLI でも Web でも学べる。

## 使う

```bash
bun bin/prograde.ts courses
bun bin/prograde.ts -c <course> list
bun bin/prograde.ts -c <course> open <exId>
bun bin/prograde.ts -c <course> check <exId>
bun bin/prograde.ts -c <course> status
```

| コマンド | 用途 |
| --- | --- |
| `list` | レッスン・章・セクション・演習の一覧 |
| `lesson` | スライドと演習の表示 |
| `open` | 作業コピーを用意する |
| `check` | 採点する |
| `run` | 採点せずに実行する |
| `hint` | ヒントを表示する |
| `reset` | 作業コピーを雛形に戻す |
| `selftest` | 全演習の模範解答を採点する |
| `lint` | 教材データを検査する |
| `status` | 進捗を表示する |
| `web` | Web UI を起動する |

データの場所は `--root` > `PROGRADE_ROOT` > `~/.prograde` の順で決まる。

終了コードは 0 合格 / 1 不合格 / 2 データ・使い方の誤り / 3 環境が用意できない / 4 内部エラー。timeout は不合格。

## Web

```bash
cd web && bun run build
bun bin/prograde.ts web
```

既定では `http://<hostname>.local:4173` で待ち受け、同じ LAN の他端末からも開ける。ローカル専用なら `--host 127.0.0.1`、入口に PIN を付けるなら `--pin`。

演習画面の「AI に聞く」を使うときは、リポジトリ直下の `.env` に OpenAI 互換 API を設定する。

```bash
PROGRADE_AGENT_BASE_URL=http://127.0.0.1:3000/v1
PROGRADE_AGENT_MODEL=<model>
# 必要なら
# PROGRADE_AGENT_API_KEY=<key>
```

## コースを作る

1コース = 1ディレクトリ。

```
tracks/<courseId>/
  course.json
  content/<lessonId>/
    chapters/<chapterId>/sections/<sectionId>/
      slides/NN.md
      ex/<exId>/
        exercise.json
        brief.md
        starter.<ext>
        solution/<path>
        fixtures/
```

- `course.json` が唯一の索引。ディレクトリの過不足は読み込み時にエラーになる。
- コース > レッスン > 章 > セクション > スライド / 演習 の5階層。
- 1セクション = 1枚以上のスライド + 1つの演習。
- `exercise.json` に環境・ファイル・実行手順・観測点・判定を書く。

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
  ]
}
```

詳しい形式は `skills/prograde-course/references/course-data.md` を参照。

## 開発

```bash
bun test
bun run typecheck
cd web && bun run build
```

テストは一時ディレクトリにコースを生成するので、`~/.prograde/tracks/` が無くても通る。
