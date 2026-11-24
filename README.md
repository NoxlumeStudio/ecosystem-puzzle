# 宇宙生態研究所 ～ワシが地球を作り直すんじゃ！～

全5章・15ステージの自由配置型生態系パズル。シナリオVer.3.1（51イベント）、イベントスチル9枚を含みます。
公開版v98の元コミット `6b13b3635f60d599c5b1317e275d4ca3ae441552` に対応するGitHub移設用ソースです。ゲーム内容は変更していません。

## フォルダー構成

- `dist/`: そのまま公開する静的ファイル。入口は `index.html`、ゲーム本体は `game.html`。
- `ecosystem-puzzle.html`: 編集用のゲーム本体。UI、通常会話、オートセーブの統合コードを含み、`dist/game.html` と同一です。
- `index.html`, `viewport.js`, `ui-paper.css`: 外枠・全体スケーリング・スタイルの編集元。
- `renewal/`: エンジン、全15ステージ、目標、ガイド、履歴と関連UI。`engine.js` の `solveStage` と `load.cjs` に自動解法探索機能があります。`examples.js` は探索の初期候補として実装から利用されるため残しています。
- `story/`: 現行のシナリオ正本 `renewal.json`、進行・既読管理 `controller.js`、スチル対応 `stills.js`。
- `assets/`: 制作元PNGと公開用WebP、フォントとライセンス。`dist/assets/` は実際の配信素材です。
- `tools/`, `image-delivery.json`: 元画像を保持した画像変換・公開用画像同期の処理と対応表。

過去版、tests、検証レポート、検証用ページ、旧シナリオ、旧UI部品、既存ホスティングサービス固有の設定は含めていません。元の完全バックアップは別納品のZIPに保持しています。

## 起動と必要環境

プレイにはJavaScriptとWebPに対応する一般的なブラウザーが必要です。サーバー側処理、APIキー、環境変数、npm依存はありません。Python 3でローカル確認できます。

```sh
python3 -m http.server 8000 --directory dist
```

`http://localhost:8000/` を開いてください。`file://` 起動は避けてください。

## 編集と公開

そのまま移設する場合はビルド不要です。`dist/` の内容を静的ホスティングの公開ルートへ配置します。GitHubへソースを登録しただけではゲームは公開されません。GitHub Pages等を利用する場合は、配信する成果物を `dist/` に設定してください。リポジトリー直下をそのまま公開ルートにしないでください。

エンジン・ステージ・現行シナリオ等を編集した場合は、Python 3で `python3 renewal/integrate.py` を実行すると編集元HTMLと `dist/game.html` に反映されます。UIは `ecosystem-puzzle.html` を編集し、同じ内容を `dist/game.html` に保存します。外枠・CSS・viewport.jsの変更も `dist/` の同名ファイルへ反映してください。

画像の再変換時だけPillow（libwebp対応）が必要です。`tools/optimize_images.py` で変換し、`tools/sync_delivery_images.py` で公開用へ同期します。既存の画像は変換済みで同梱されています。

## オートセーブ

進行・実験前配置・クリア・解放・エンディング到達・ガイド表示状態はブラウザーのlocalStorageへ保存されます。主な保存キーは `ecosystem.progress.v1`（schema 2）と `ecosystem.story.v2.2.read`（既読等、互換性のため旧名称を保持）です。実験途中の再読み込みは実験前配置から再開します。

プレイヤー個人の保存データは同梱していません。外部送信機能も追加していません。ドメインやlocalhostのポートが変わると保存領域は別になるため、旧公開先の進行データは新公開先へ自動移行されません。

## 素材の利用条件

フォントはSIL Open Font License 1.1です。`assets/fonts/OFL-ZenMaruGothic.txt` と公開側のライセンスを維持してください。
イラスト・UI・生物・スチルの第三者再配布を許諾する権利証明は元プロジェクト内に見当たりません。GitHubで一般公開する前に素材の権利・利用条件をご確認ください。ソース全体のライセンスも新たに付与していません。
