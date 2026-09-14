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
