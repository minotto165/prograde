# アーキテクチャ

## 3つの状態

| 状態 | 寿命 | 場所 | 真実か |
| --- | --- | --- | --- |
| content | 静的。手で書ける | `~/.prograde/tracks/<course>/` | はい（教材の唯一の出所） |
| attempt | 使い捨て | `~/.prograde/work/<course>/<exId>/.attempts/<rand>/` | いいえ（採点後に消える） |
| progress | 永続。復旧可能 | `~/.prograde/state/history.jsonl` + `state/progress.json` | 追記ログが真実、投影は従 |

## 本体 API

```
loadCourse(ctx, id)        コースを読む（検証込み）
ensureEnv(ctx, ...)        環境を用意する（provision + probe、キャッシュ）
planExercise(spec, vars)   コマンド列を組み立てる
grade(ctx, course, entry)  build -> run -> observe -> judge
readProgress/recordAttempt 履歴に追記して投影を返す
```

本体は言語名・ツール名を受け取らない。すべてコースのデータ（`course.json` の `envs`、`exercise.json` の `recipe`）から決まる。

## 採点パイプライン

1. `ensureEnv`: `state/cache` に記録があれば probe だけ。無ければ provision を実行。
2. `prepareAttempt`: 演習ディレクトリを一時領域に展開する（`files[].from`/`text`、`solution/`、`--code`）。
3. build: 失敗したら run は走らない。
4. run: 失敗（非0/timeout）したらそこで止まる。
5. observe: 最後の実行結果と生成ファイルから観測値を取り出す。
6. judge: 観測値だけを判定する。
7. 失敗した段の出力だけを `diagnostics` で解析する。
8. `--keep` 以外は試行ディレクトリを消す。

## 不変条件

- 判定は実行結果だけを見る（コードを読まない）。
- 言語を足す = `~/.prograde/tracks/` にディレクトリを足す。エンジンに if 文を足さない（`tests/no-hardcode.test.ts` が強制）。
- ID は不変。教材本文は複製しない（メタデータのみ）。
- 進捗は壊れても手で直せる（`history.jsonl` を消せば最初から、壊れた行は無視）。
- 失敗は次の手まで返す（`remediation`、ヒント、診断、exit code）。

## exit code

| code | 意味 |
| --- | --- |
| 0 | 合格 |
| 1 | 不合格（timeout を含む） |
| 2 | データ・使い方の誤り |
| 3 | 環境が用意できない |
| 4 | 内部エラー |
