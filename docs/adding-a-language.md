# 言語を足す

エンジンには触らない。やることは3つ。

1. `tracks/<course>/course.json` の `envs` に、その言語の道具の用意の仕方を書く。
2. `exercise.json` の `recipe` に実行コマンドを書く。
3. `content/<lesson>/ex/<exId>/` に本文・雛形・解答・fixtures を置く。

## 例: Rust

```json
{
  "envs": {
    "rust": {
      "cacheKey": "rust-1.83",
      "provision": [["bash", "-c", "command -v rustc || curl ... | sh -s -- -y --no-modify-path"]],
      "probe": ["rustc", "--version"],
      "path": ["{cache}/cargo/bin"],
      "network": "off",
      "limits": { "timeoutMs": 30000 },
      "remediation": "SETUP.md"
    }
  }
}
```

```json
{
  "recipe": { "build": [["rustc", "{src}", "-o", "main"]] },
  "run": [["{work}/main"]],
  "diagnostics": [{
    "when": "build", "parse": "regex",
    "pattern": "^(?<severity>error|warning)(\\[[^\\]]+\\])?: (?<message>.+)\\n\\s+--> (?<file>[^:]+):(?<line>\\d+):(?<column>\\d+)",
    "flags": "gm"
  }]
}
```

## 言語ごとに残る仕事

| ファミリ | 追加で必要なこと |
| --- | --- |
| スクリプト（Python/JS/Ruby） | ほぼ無し。probe と実行コマンドだけ |
| コンパイル（Rust/Go/C） | 診断のデータ化（regex か jsonl） |
| SQL | 観測点を1つ足す（stdout かファイル） |
| フロント（React など） | ビルド成果物 or 画像/HTML を file 観測 |
| エコシステム依存（.NET など） | provision を厚くする |
| モバイル | CLI 単体では非現実的。Web/実行基盤の拡張が要る |

## 実証

開発時はローカルの `tracks/` に example-echo（シェル）と example-python（Python）を置き、
本体を1行も変えずに2言語目を足せたことを確認した。コースはリポジトリに含めない（`.gitignore`）。
`tests/no-hardcode.test.ts` が本体に言語固有の語が入らないことを検証する。
