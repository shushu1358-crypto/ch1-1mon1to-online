# 中1 1問1答 Online

Render等に置いて、複数人で同じ問題集を使えるようにした版です。

## できること
- オンライン共有問題
- ユーザーによる問題投稿
- AIによる問題チェック（OPENAI_API_KEY設定時）
- AIが曖昧問題を修正案に回す
- 問題の承認・却下（ADMIN_TOKEN）
- オンラインランキング
- 既存の959問＋承認済みコミュニティ問題

## Render
Build Command:
`npm install`

Start Command:
`npm start`

Environment Variables:
- `DATABASE_URL`（PostgreSQL推奨）
- `OPENAI_API_KEY`（AI審査を使う場合）
- `OPENAI_MODEL=gpt-5.6-luna`
- `ADMIN_TOKEN`（管理用）

DATABASE_URLがない場合はdata/store.jsonに保存する簡易モードになります。ただしRenderの通常ディスクは永続保存用途には向かないので、本番ではPostgreSQLを使ってください。

## 管理API
`GET /api/admin/problems` + `x-admin-token`
`POST /api/admin/problems/:id/status` body: `{ "status": "approved" | "rejected" | "pending" }`
