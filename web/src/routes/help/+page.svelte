<h1 class="text-2xl font-bold">使い方</h1>
<p class="mt-2 text-sm text-slate-600">この画面だけで学習が完結します。CLI は不要です。</p>

<section class="mt-6 grid gap-4 sm:grid-cols-2">
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="font-semibold">1. レッスンを読む</h2>
    <p class="mt-1 text-sm text-slate-600">コースからレッスンを開くと、解説・振り返りクイズ・演習の一覧が出ます。クイズは選んで「答え合わせ」を押すと、その場で採点されます。</p>
  </div>
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="font-semibold">2. 演習を解く</h2>
    <p class="mt-1 text-sm text-slate-600">エディタにコードを書いて「採点する」。ビルド→実行→結果の比較まで自動で走ります。途中経過は「実行だけ」で確認できます。</p>
  </div>
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="font-semibold">3. 結果を読む</h2>
    <p class="mt-1 text-sm text-slate-600">合否・判定項目・コンパイラの診断・標準出力が並びます。失敗した理由がそのまま次の一手になります。</p>
  </div>
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="font-semibold">4. 進捗は自動で残る</h2>
    <p class="mt-1 text-sm text-slate-600">合格すると XP とレベルが増え、次に解く演習が示されます。書いたコードは保存され、閉じても続きから編集できます。「雛形に戻す」で初期状態に戻せます。</p>
  </div>
</section>

<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
  <h2 class="font-semibold">採点の仕組み</h2>
  <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
    <li>判定は「終了コード・標準出力・標準エラー・生成されたファイル」だけを見ます。コードの書き方は採点しません。</li>
    <li>演習ごとに環境（言語の道具）が決まっていて、初回だけ用意されます。失敗したときは準備手順が表示されます。</li>
    <li>時間切れは不合格です。</li>
    <li>進捗はこのマシンの <code class="rounded bg-slate-100 px-1">state/</code> に保存されます。</li>
  </ul>
</section>

<a href="/" class="mt-8 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">コースへ戻る</a>
