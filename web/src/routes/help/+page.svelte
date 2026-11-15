<script lang="ts">
  import Icon from "$lib/components/Icon.svelte";
  import PageHead from "$lib/components/PageHead.svelte";
</script>

<PageHead
  title="使い方"
  description="prograde の進め方、採点の仕組み、データの保存先、キーボード操作をまとめています。"
/>

<div class="max-w-3xl">
  <h1 class="text-3xl font-medium tracking-tight text-ink sm:text-4xl">使い方</h1>
  <p class="mt-3 text-sm leading-relaxed text-ink-soft">
    この画面だけで学習が完結します。CLI は不要です。解説を読み、コードを書き、実行結果で確かめる。その繰り返しで進みます。
  </p>
</div>

<section class="mt-7 grid gap-4 sm:grid-cols-2">
  <article class="card p-5">
    <p class="font-mono text-xs text-muted">01</p>
    <h2 class="mt-2 font-medium text-ink">解説と演習を交互に進める</h2>
    <p class="mt-1 text-sm leading-relaxed text-muted">
      コースからレッスンを開くと、ページ送りの解説が始まります。何枚か読むと演習が挟まり、解き終えるとまた次の解説へ進みます。
    </p>
  </article>

  <article class="card p-5">
    <p class="font-mono text-xs text-muted">02</p>
    <h2 class="mt-2 font-medium text-ink">演習を解く</h2>
    <p class="mt-1 text-sm leading-relaxed text-muted">
      エディタにコードを書いて「できた！」を押します。ビルド・実行・結果の比較まで自動で走ります。途中経過は右上の実行ボタンで確認できます。書いたコードは自動で保存されます。
    </p>
  </article>

  <article class="card p-5">
    <p class="font-mono text-xs text-muted">03</p>
    <h2 class="mt-2 font-medium text-ink">結果を読む</h2>
    <p class="mt-1 text-sm leading-relaxed text-muted">
      合否・判定項目・コンパイラの診断・標準出力が並びます。失敗した理由がそのまま次の一手になります。判定はコードの書き方ではなく、実行結果だけを見ます。
    </p>
  </article>

  <article class="card p-5">
    <p class="font-mono text-xs text-muted">04</p>
    <h2 class="mt-2 font-medium text-ink">進捗は自動で残る</h2>
    <p class="mt-1 text-sm leading-relaxed text-muted">
      合格すると進捗が残り、次に解く演習が示されます。閉じても続きから編集できます。「雛形に戻す」で初期状態に戻せます。
    </p>
  </article>
</section>

<section id="data" class="card mt-8 overflow-hidden scroll-mt-28">
  <div class="grid md:grid-cols-[minmax(0,1fr)_320px]">
    <div class="p-6">
      <p class="meta-label">採点の仕組み</p>
      <h2 class="mt-2 text-xl font-medium tracking-tight text-ink">答えではなく、結果を見ます</h2>
      <ul class="mt-5 space-y-3">
        <li class="flex gap-3">
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>
          <p class="text-sm leading-relaxed text-ink-soft">
            判定は「終了コード・標準出力・標準エラー・生成されたファイル」だけを見ます。書き方は採点しません。
          </p>
        </li>
        <li class="flex gap-3">
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>
          <p class="text-sm leading-relaxed text-ink-soft">
            演習ごとに環境（言語の道具）が決まっていて、初回だけ用意されます。失敗したときは準備手順が表示されます。
          </p>
        </li>
        <li class="flex gap-3">
          <span class="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>
          <p class="text-sm leading-relaxed text-ink-soft">
            制限時間を超えた実行は不合格です。無限ループしてしまったときは、時間切れを待つか「雛形に戻す」で立て直してください。
          </p>
        </li>
      </ul>
    </div>

    <div class="border-t border-line bg-surface-2 p-6 md:border-l md:border-t-0">
      <h3 class="text-sm font-medium text-ink">保存されるもの</h3>
      <dl class="mt-3 space-y-3 text-sm">
        <div>
          <dt class="text-xs text-muted">進捗</dt>
          <dd class="mt-0.5 font-medium text-ink-soft">state/ の JSON</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">書いたコード</dt>
          <dd class="mt-0.5 font-medium text-ink-soft">work/ の作業ディレクトリ</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">採点の履歴</dt>
          <dd class="mt-0.5 font-medium text-ink-soft">history.jsonl に 1 行ずつ</dd>
        </div>
      </dl>
      <p class="mt-4 text-xs leading-relaxed text-muted">
        データは既定で <code class="rounded bg-surface px-1.5 py-0.5 font-mono">~/.prograde</code> にあります。保存先は
        <code class="rounded bg-surface px-1.5 py-0.5 font-mono">prograde where</code> で確認できます。
      </p>
    </div>
  </div>
</section>

<section class="mt-8">
  <h2 class="text-xl font-medium tracking-tight text-ink">キーボード</h2>
  <p class="mt-1 text-sm text-muted">演習画面では、手をキーボードから離さずに操作できます。</p>
  <div class="mt-3 grid gap-2 sm:grid-cols-2">
    <div class="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <span class="text-ink-soft">採点する（できた！）</span>
      <span class="flex shrink-0 items-center gap-1">
        <span class="kbd">⌘</span><span class="text-xs text-muted">/</span><span class="kbd">Ctrl</span>
        <span class="text-xs text-muted">+</span><span class="kbd">Enter</span>
      </span>
    </div>
    <div class="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <span class="text-ink-soft">インデントを入れる</span>
      <span class="flex shrink-0 items-center gap-1"><span class="kbd">Tab</span></span>
    </div>
  </div>
</section>

<section class="mt-8">
  <h2 class="text-xl font-medium tracking-tight text-ink">よくある質問</h2>
  <div class="mt-3 space-y-2">
    <details class="group card overflow-hidden">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
        コードはどこに保存されますか？
        <Icon name="chevron-down" size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <p class="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
        演習ごとの作業ディレクトリに保存されます。「できた！」「実行」を押した時点で書き込まれます。ブラウザを閉じても、次に開いたときは続きから編集できます。
      </p>
    </details>

    <details class="group card overflow-hidden">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
        環境の準備に失敗します
        <Icon name="chevron-down" size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <p class="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
        言語の道具（コンパイラや実行環境）が見つからない場合、演習画面に準備手順が表示されます。表示された手順に沿って用意するか、別のコースを選んでください。
      </p>
    </details>

    <details class="group card overflow-hidden">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
        コースを追加できますか？
        <Icon name="chevron-down" size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <p class="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
        追加できます。データルートの <code class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">tracks/</code> にコースを置くと、一覧に反映されます。形式はリポジトリのドキュメントを参照してください。
      </p>
    </details>

    <details class="group card overflow-hidden">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
        進捗をリセットしたい
        <Icon name="chevron-down" size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <p class="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
        演習ごとのコードは「雛形に戻す」で初期状態に戻せます。コース全体の進捗を消す操作は画面にはありません。必要ならデータルートの状態ファイルを直接扱ってください。
      </p>
    </details>
  </div>
</section>

<div class="mt-9 flex flex-wrap gap-3">
  <a href="/" class="btn btn-primary">
    <Icon name="home" size={16} />
    コースへ戻る
  </a>
</div>
