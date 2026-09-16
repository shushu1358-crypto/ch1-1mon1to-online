# 中1 1問1答 Online v2 (Google Drive + GAS)

RenderのNode/ExpressサーバーとGoogle Apps Scriptをつなぎ、問題・カテゴリ・ランキングをGoogle DriveのJSONで共有する版です。

## 仕様
- 959問のローカル問題を初期搭載
- 起動後はGASのGoogle Drive側問題をオンライン問題集として優先
- ユーザー投稿は確認なしで即採用
- ランキングはGoogle Driveへ保存
- カテゴリ取得・追加・名前変更・削除API対応
- OpenAI APIなし
- Render Postgresなし

## Render設定
Root Directory:
`ch1_1mon1to_online_v1`

Build Command:
`npm install`

Start Command:
`npm start`

Environment Variables:
- `GAS_URL` = Google Apps ScriptのWebアプリURL
- `ADMIN_TOKEN` = Render側の管理API用秘密文字列
- `GAS_ADMIN_TOKEN` = GAS Code.gsのADMIN_TOKENと同じ文字列

RenderのFree Web Serviceは15分間インバウンド通信がないとスピンダウンし、次のHTTPリクエストで再起動します。再起動には時間がかかることがあります。アプリ側では接続確認中に「Renderを無理やり起こしてます…」と表示します。


## v12 追加仕様
- カテゴリ一覧は categories.json だけでなく questions.json の subject/unit も自動統合
- 新規問題投稿時、questions.json に保存すると同時に新しい subject/unit を categories.json に自動追加
- 問題に tags 配列を保存可能
- タグを複数選択して出題問題を絞り込み可能
- 問題Wikiの検索対象にもタグを追加

### GAS
`ch1_1mon1to_GAS.gs` をApps Scriptに貼り付け、FOLDER_IDを対象DriveフォルダIDに設定してください。ADMIN_TOKENは任意の強い文字列に変更してください。
