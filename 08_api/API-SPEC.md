# Kaname API 設計書 v1.0（2026-11-23 凍結）

> 信頼源は `08_api/endpoints.json` と `openapi.yaml`（05_flow/build_api.py が機械生成）。

## 1. 設計方針

- REST・独立 API 層（Hono・TypeScript）・契約は OpenAPI 3.0.3・URL 版（/api/v1）。Web・Bridge・将来のアプリが同じ契約を叩く（D-043・D-051）
- 認証はトークンベース。失効は `sessions` 表（退会・停止・権限変更・パスワード変更で即失効）。API 層は冒頭で `SET LOCAL app.tenant_id / app.user_id / app.role`
- 副作用の順序：認可 → ポリシー → 承認 → 副作用 → 記録。書き込み系 endpoint は関門（C1〜C8）を必ず通る
- 運営（ops）は既定で顧客の行を読めない。`support_access_grants` があるときだけ

## 2. エンドポイント一覧

| ID | メソッド | パス | 説明 | 行為 | 画面 | 役割 | 関門 | 4xx |
|---|---|---|---|---|---|---|---|---|
| EP-001 | POST | `/api/v1/acceptances/:id/remind` | 作成・実行（acceptances）— 成果物を確認してもらう（検収を頼 | A123 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-002 | GET | `/api/v1/action_runs/:id` | 取得（action_runs）— AI に任せる | A104 | 1 | member |  | 401 403 404 422 429 502 403 403 503 |
| EP-003 | POST | `/api/v1/action_runs/:id/stop` | 作成・実行（action_runs）— AI を止める・承認を取り下げる | A89 | 1 | member | C2 C5 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-004 | POST | `/api/v1/action_runs/:id/takeover` | 作成・実行（action_runs）— 止まった理由を見て一手を打つ（P | A57 | 1 | member | C2 | 401 403 404 409 422 409 409 503 413 429 403 403 503 |
| EP-005 | GET | `/api/v1/approvals/:id` | 取得（approvals）— 承認する／自分で直す／差し戻す／止める | A15 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-006 | POST | `/api/v1/approvals/:id/approve` | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止め | A15 | 1 | member | C2 | 401 403 404 409 422 422 503 413 429 403 403 503 |
| EP-007 | POST | `/api/v1/approvals/:id/edit` | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止め | A15 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-008 | POST | `/api/v1/approvals/:id/return` | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止め | A15 | 1 | member | C2 | 401 403 404 409 422 503 413 429 403 403 503 |
| EP-009 | POST | `/api/v1/approvals/:id/stop` | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止め | A15 A89 | 1 | member | C2 C5 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-010 | POST | `/api/v1/approvals/:id/withdraw` | 作成・実行（approvals）— AI を止める・承認を取り下げる | A89 | 1 | member | C2 C5 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-011 | POST | `/api/v1/approvals/bulk` | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止め | A15 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-012 | POST | `/api/v1/approvals/bulk/preview` | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止め | A15 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-013 | GET | `/api/v1/approvals/history` | 取得（approvals）— 承認する／自分で直す／差し戻す／止める | A15 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-014 | GET | `/api/v1/approvals/queue` | 取得（approvals）— 承認する／自分で直す／差し戻す／止める | A15 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-015 | GET | `/api/v1/artifact_versions/:id` | 取得（artifact_versions）— チケットの中身（区画）を書 | A101 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-016 | POST | `/api/v1/artifact_versions/:id/restore` | 作成・実行（artifact_versions）— 自分のAIの返事を成 | A95 | 1 | member | C2 C4 | 401 403 404 409 422 413 429 403 403 503 |
| EP-017 | PATCH | `/api/v1/artifacts/:id` | 更新（artifacts）— 自分のAIの返事を成果物に書き出し、会話の | A95 | 1 | member | C2 C4 | 401 403 404 422 413 429 403 403 503 |
| EP-018 | GET | `/api/v1/audit_events` | 取得（audit_events）— 何をしたか追う（記録） | A33 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-019 | GET | `/api/v1/auth/invitations/:token` | 取得（auth）— 招待を受けて参加する（今のアカウントで別のテナントに | A03 | 1 | public |  | 422 404 503 429 503 |
| EP-020 | POST | `/api/v1/auth/invitations/:token/accept` | 作成・実行（auth）— 招待を受けて参加する（今のアカウントで別のテナ | A03 A96 | 1 | public | C2 | 422 401 403 403 404 409 409 410 503 413 429 503 |
| EP-021 | POST | `/api/v1/auth/invitations/:token/resend-request` | 作成・実行（auth）— 招待を受けて参加する（今のアカウントで別のテナ | A03 | 1 | public | C2 C6 | 409 422 404 410 503 413 429 503 |
| EP-022 | POST | `/api/v1/auth/password/forgot` | 作成・実行（auth）— パスワードを再設定する | A31 | 1 | public | C2 C6 | 422 413 429 503 |
| EP-023 | POST | `/api/v1/auth/password/reset` | 作成・実行（auth）— パスワードを再設定する | A31 | 1 | public | C2 C6 | 422 410 409 500 413 429 503 |
| EP-024 | POST | `/api/v1/auth/recovery/admin-request` | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | A13 | 1 | public | C2 C6 | 409 422 401 500 413 429 503 |
| EP-025 | GET | `/api/v1/auth/service-status` | 取得（auth）— ログインする（パスキー／パスワード＋2 段階）／ログ | A13 A135 | 2 | public |  | 422 500 429 503 |
| EP-026 | POST | `/api/v1/auth/sign-in` | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | A13 | 1 | public | C2 | 409 422 401 403 403 422 422 429 500 503 413 429 503 |
| EP-027 | POST | `/api/v1/auth/sign-out` | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | A13 | 1 | member | C2 | 401 403 409 422 413 429 503 |
| EP-028 | POST | `/api/v1/auth/sign-up` | 作成・実行（auth）— アカウントを作る（会社名が空なら本人の名前で個 | A01 A96 | 1 | public | C2 | 409 422 500 413 429 503 |
| EP-029 | POST | `/api/v1/auth/sign-up/resend` | 作成・実行（auth）— アカウントを作る（会社名が空なら本人の名前で個 | A01 | 1 | public | C2 | 409 422 413 429 503 |
| EP-030 | GET | `/api/v1/auth/sign-up/status` | 取得（auth）— アカウントを作る（会社名が空なら本人の名前で個人のテ | A01 | 1 | public |  | 422 429 503 |
| EP-031 | POST | `/api/v1/auth/sign-up/verify` | 作成・実行（auth）— メールを確認して本人だと示す | A02 | 1 | public | C2 C6 | 409 422 410 500 413 429 503 |
| EP-032 | POST | `/api/v1/auth/step-up` | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | A13 | 1 | member | C2 | 401 403 409 422 413 429 403 503 |
| EP-033 | POST | `/api/v1/auth/terms/consent` | 作成・実行（auth）— 規約に同意する（どの版に同意したかが残る） | A96 | 1 | member | C2 | 401 403 409 422 500 413 429 503 |
| EP-034 | GET | `/api/v1/auth/terms/current` | 取得（auth）— 規約に同意する（どの版に同意したかが残る） | A96 | 1 | public |  | 422 500 429 503 |
| EP-035 | POST | `/api/v1/auth/two-factor/verify` | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | A13 | 1 | public | C2 | 409 422 401 401 403 422 429 500 403 503 413 429 503 |
| EP-036 | POST | `/api/v1/bridge/browser` | 作成・実行（bridge）— 自分の PC をつなぐ | A09 | 1 | device | C1 C2 C4 | 401 403 409 422 413 429 502 503 |
| EP-037 | POST | `/api/v1/bridge/claim` | 作成・実行（bridge）— 自分の PC をつなぐ | A09 | 1 | public | C1 C2 C4 | 409 422 404 413 429 502 503 |
| EP-038 | POST | `/api/v1/bridge/credentials/:id/check-result` | 作成・実行（bridge）— 設定（ログイン情報・API キー・決まった | A10 | 1 | device | C2 C8 | 401 403 404 409 422 503 413 429 503 |
| EP-039 | POST | `/api/v1/bridge/credentials/resolve` | 作成・実行（bridge）— 設定（ログイン情報・API キー・決まった | A10 | 1 | device | C2 C8 | 401 403 409 422 403 403 404 502 503 503 413 429 503 |
| EP-040 | GET | `/api/v1/bridge/devices` | 取得（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C4 | 401 403 422 429 502 403 403 503 |
| EP-041 | PATCH | `/api/v1/bridge/devices/:id` | 更新（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C1 C2 C4 | 401 403 404 422 413 429 502 403 403 503 |
| EP-042 | DELETE | `/api/v1/bridge/devices/:id` | 削除（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C1 C2 C4 | 401 403 404 422 429 502 403 403 503 |
| EP-043 | POST | `/api/v1/bridge/devices/:id/browser-check` | 作成・実行（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C1 C2 C4 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-044 | GET | `/api/v1/bridge/files/:ref` | 取得（bridge）— AI に任せる | A104 | 1 | device |  | 401 403 422 404 502 503 429 502 503 |
| EP-045 | POST | `/api/v1/bridge/heartbeat` | 作成・実行（bridge）— 自分の PC をつなぐ | A09 | 1 | device | C1 C2 C4 | 401 403 409 422 413 429 502 503 |
| EP-046 | POST | `/api/v1/bridge/jobs/:id/artifacts` | 作成・実行（bridge）— 自分のAIの返事を成果物に書き出し、会話の | A95 | 1 | device | C2 C4 | 401 403 404 409 422 413 429 503 |
| EP-047 | POST | `/api/v1/bridge/jobs/:id/browser` | 作成・実行（bridge）— AI に任せる | A104 | 1 | device | C2 C3 C5 | 401 403 404 409 422 503 413 429 502 503 |
| EP-048 | GET | `/api/v1/bridge/jobs/:id/control` | 取得（bridge）— AI に任せる | A104 | 1 | device |  | 401 403 404 422 429 502 503 |
| EP-049 | POST | `/api/v1/bridge/jobs/:id/conversation-entries` | 作成・実行（bridge）— 自分の AI に指示する・相談する（会話・ | A20 | 1 | device | C2 C3 C4 | 401 403 404 409 422 413 429 502 503 |
| EP-050 | POST | `/api/v1/bridge/jobs/:id/finish` | 作成・実行（bridge）— AI に任せる | A104 | 1 | device | C2 C3 C5 | 401 403 404 409 422 413 429 502 503 |
| EP-051 | POST | `/api/v1/bridge/jobs/:id/progress` | 作成・実行（bridge）— AI に任せる | A104 | 1 | device | C2 C3 C5 | 401 403 404 409 422 413 429 502 503 |
| EP-052 | POST | `/api/v1/bridge/jobs/:id/questions` | 作成・実行（bridge）— 自分のAIの許可に答える・許可のモードを選 | A91 | 1 | device | C2 C5 | 401 403 404 409 422 413 429 502 503 |
| EP-053 | GET | `/api/v1/bridge/jobs/:id/questions/:qid` | 取得（bridge）— 自分のAIの許可に答える・許可のモードを選ぶ | A91 | 1 | device |  | 401 403 404 422 429 502 503 |
| EP-054 | POST | `/api/v1/bridge/jobs/:id/tools/:name` | 作成・実行（bridge）— AI に任せる | A104 | 1 | device | C2 C3 C5 | 401 403 404 409 422 413 429 502 503 |
| EP-055 | POST | `/api/v1/bridge/jobs/take` | 作成・実行（bridge）— AI に任せる | A104 | 1 | device | C2 C3 C5 | 401 403 409 422 413 429 502 503 |
| EP-056 | GET | `/api/v1/bridge/mirror-targets` | 取得（bridge）— 自分の AI に指示する・相談する（会話・添付・ | A20 | 1 | device | C4 | 401 403 422 429 502 503 |
| EP-057 | POST | `/api/v1/bridge/pairing-codes` | 作成・実行（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C1 C2 C4 | 401 403 409 422 413 429 502 403 403 503 |
| EP-058 | GET | `/api/v1/bridge/releases/:name/file` | 取得（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C4 | 401 403 422 404 404 503 429 502 403 403 503 |
| EP-059 | GET | `/api/v1/bridge/releases/latest` | 取得（bridge）— 自分の PC をつなぐ | A09 | 1 | member | C4 | 401 403 422 503 429 502 403 403 503 |
| EP-060 | POST | `/api/v1/bridge/usage` | 作成・実行（bridge）— 自分のAIの使用量（サブスクの 5 時間の | A94 | 1 | device | C2 | 401 403 409 422 413 429 503 |
| EP-061 | PATCH | `/api/v1/client_contacts/:id` | 更新（client_contacts）— 取引先を作り、担当者を招待する | A121 | 1 | member | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-062 | DELETE | `/api/v1/client_contacts/:id` | 削除（client_contacts）— 取引先を作り、担当者を招待する | A121 | 1 | member | C2 C6 | 401 403 404 422 429 403 403 503 |
| EP-063 | POST | `/api/v1/client_contacts/:id/invitation` | 作成・実行（client_contacts）— 取引先を作り、担当者を招 | A121 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-064 | GET | `/api/v1/client_requests` | 取得（client_requests）— 届いた依頼を受けてチケットにす | A122 | 1 | member |  | 401 403 422 429 502 403 403 503 |
| EP-065 | GET | `/api/v1/client_requests/:id` | 取得（client_requests）— 届いた依頼を受けてチケットにす | A122 | 1 | member |  | 401 403 404 422 429 502 403 403 503 |
| EP-066 | PATCH | `/api/v1/client_requests/:id` | 更新（client_requests）— 届いた依頼を受けてチケットにす | A122 | 1 | member | C2 C3 | 401 403 404 422 413 429 502 403 403 503 |
| EP-067 | POST | `/api/v1/client_requests/:id/accept` | 作成・実行（client_requests）— 届いた依頼を受けてチケッ | A122 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-068 | POST | `/api/v1/client_requests/:id/decline` | 作成・実行（client_requests）— 届いた依頼を受けてチケッ | A122 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-069 | POST | `/api/v1/client_requests/:id/reply` | 作成・実行（client_requests）— 届いた依頼を受けてチケッ | A122 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-070 | GET | `/api/v1/clients` | 取得（clients）— 振り分ける（責任者・期限・分類・親）。AI と | A103 A121 | 2 | member |  | 401 403 422 429 403 403 503 |
| EP-071 | POST | `/api/v1/clients` | 作成・実行（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-072 | GET | `/api/v1/clients/:id` | 取得（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-073 | PATCH | `/api/v1/clients/:id` | 更新（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-074 | GET | `/api/v1/clients/:id/activity` | 取得（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-075 | POST | `/api/v1/clients/:id/contacts` | 作成・実行（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-076 | GET | `/api/v1/clients/:id/portal-preview` | 取得（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-077 | PATCH | `/api/v1/clients/:id/share` | 更新（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-078 | GET | `/api/v1/clients/link-candidates` | 取得（clients）— 取引先を作り、担当者を招待する | A121 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-079 | GET | `/api/v1/clones/me` | 取得（clones）— 自分の AI に指示する・相談する（会話・添付・ | A20 | 1 | member | C4 | 401 403 422 429 502 403 403 503 |
| EP-080 | PATCH | `/api/v1/clones/me` | 更新（clones）— 自分のAIの許可に答える・許可のモードを選ぶ | A91 | 1 | member | C2 C5 | 401 403 422 413 429 502 403 403 503 |
| EP-081 | GET | `/api/v1/clones/me/activity` | 取得（clones）— 分身がやったことを見る → チケットへ戻る | A53 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-082 | GET | `/api/v1/clones/me/growth` | 取得（clones）— 分身がやったことを見る → チケットへ戻る | A53 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-083 | GET | `/api/v1/clones/me/knows/counts` | 取得（clones）— 自分の AI に教える（覚えて） | A30 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-084 | GET | `/api/v1/clones/me/now` | 取得（clones）— 分身がやったことを見る → チケットへ戻る | A53 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-085 | GET | `/api/v1/conversations` | 取得（conversations）— 自分のAIとの会話を分けて始める・ | A88 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-086 | POST | `/api/v1/conversations` | 作成・実行（conversations）— 自分の AI と壁打ちしてチ | A100 A88 | 1 | member | C2 C3 | 401 403 409 422 413 429 502 403 403 503 |
| EP-087 | GET | `/api/v1/conversations/:id` | 取得（conversations）— 自分のAIとの会話を分けて始める・ | A88 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-088 | PATCH | `/api/v1/conversations/:id` | 更新（conversations）— 自分のAIとの会話を分けて始める・ | A88 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-089 | DELETE | `/api/v1/conversations/:id` | 削除（conversations）— 自分のAIとの会話を分けて始める・ | A88 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-090 | POST | `/api/v1/conversations/:id/attachments` | 作成・実行（conversations）— 資料や画像を付けて自分のAI | A90 | 1 | member | C2 C4 C5 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-091 | GET | `/api/v1/conversations/:id/messages` | 取得（conversations）— 自分の AI に指示する・相談する | A20 | 1 | member | C4 | 401 403 404 422 429 502 403 403 503 |
| EP-092 | POST | `/api/v1/conversations/:id/messages` | 作成・実行（conversations）— 自分の AI と壁打ちしてチ | A100 A20 | 1 | member | C2 C3 C4 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-093 | POST | `/api/v1/conversations/:id/permissions/:pid` | 作成・実行（conversations）— 自分のAIの許可に答える・許 | A91 | 1 | member | C2 C5 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-094 | POST | `/api/v1/conversations/:id/stop` | 作成・実行（conversations）— 自分の AI に指示する・相 | A20 | 1 | member | C2 C3 C4 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-095 | GET | `/api/v1/conversations/:id/stream` | 取得（conversations）— 自分の AI に指示する・相談する | A20 | 1 | member | C4 | 401 403 404 422 429 502 403 403 503 |
| EP-096 | GET | `/api/v1/credentials` | 取得（credentials）— 預けたログイン情報を名前の順に見る（自 | A10 | 1 | member | C8 | 401 403 422 429 403 403 503 |
| EP-097 | POST | `/api/v1/credentials` | 作成・実行（credentials）— 設定（ログイン情報・API キー | A10 | 1 | member | C2 C8 | 401 403 409 422 403 409 502 503 413 429 403 403 503 |
| EP-098 | PATCH | `/api/v1/credentials/:id` | 更新（credentials）— 設定（ログイン情報・API キー・決ま | A10 | 1 | member | C2 C8 | 401 403 404 422 403 409 409 409 502 503 413 429 403 403 503 |
| EP-099 | DELETE | `/api/v1/credentials/:id` | 削除（credentials）— 設定（ログイン情報・API キー・決ま | A10 | 1 | member | C2 C8 | 401 403 404 422 503 429 403 403 503 |
| EP-100 | POST | `/api/v1/credentials/:id/login-check` | 作成・実行（credentials）— 設定（ログイン情報・API キー | A10 | 1 | member | C2 C8 | 401 403 404 409 422 409 409 503 413 429 403 403 503 |
| EP-101 | POST | `/api/v1/credentials/:id/login-check/answer` | 作成・実行（credentials）— 設定（ログイン情報・API キー | A10 | 1 | member | C2 C8 | 401 403 404 409 422 404 503 413 429 403 403 503 |
| EP-102 | POST | `/api/v1/exports` | 作成・実行（exports）— 記録を書き出す（本人確認） | A40 | 2 | member | C2 C4 | 401 403 409 422 413 429 403 403 503 |
| EP-103 | GET | `/api/v1/exports/:id` | 取得（exports）— 記録を書き出す（本人確認） | A40 | 1 | member | C4 | 401 403 404 422 429 403 403 503 |
| EP-104 | GET | `/api/v1/handover_rules` | 取得（handover_rules）— 渡されたものを受ける／断る（理由 | A110 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-105 | GET | `/api/v1/inquiries` | 取得（inquiries）— 運営に問い合わせる | A67 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-106 | POST | `/api/v1/inquiries` | 作成・実行（inquiries）— 運営に問い合わせる | A67 | 1 | member | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-107 | GET | `/api/v1/inquiries/:id` | 取得（inquiries）— 運営に問い合わせる | A67 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-108 | POST | `/api/v1/inquiries/:id/messages` | 作成・実行（inquiries）— 運営に問い合わせる | A67 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-109 | POST | `/api/v1/inquiries/:id/resolve` | 作成・実行（inquiries）— 運営に問い合わせる | A67 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-110 | POST | `/api/v1/inquiries/attachments` | 作成・実行（inquiries）— 運営に問い合わせる | A67 | 1 | member | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-111 | POST | `/api/v1/invitations` | 作成・実行（invitations）— 人を招く（層・権限の束） | A36 | 1 | member | C2 C6 | 401 403 409 422 404 413 429 403 403 503 |
| EP-112 | DELETE | `/api/v1/invitations/:id` | 削除（invitations）— 人を招く（層・権限の束） | A36 | 1 | member | C2 C6 | 401 403 404 422 429 403 403 503 |
| EP-113 | POST | `/api/v1/invitations/:id/resend` | 作成・実行（invitations）— 人を招く（層・権限の束） | A36 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-114 | POST | `/api/v1/invitations/link` | 作成・実行（invitations）— 人を招く（層・権限の束） | A36 | 1 | member | C2 C6 | 401 403 422 404 503 413 429 403 403 503 |
| EP-115 | GET | `/api/v1/invoices/:id/pdf` | 取得（invoices）— プラン・利用量・請求書を見る | A69 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-116 | POST | `/api/v1/knowledge/ask` | 作成・実行（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-117 | POST | `/api/v1/knowledge/ask/feedback` | 作成・実行（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-118 | GET | `/api/v1/knowledge/home` | 取得（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-119 | GET | `/api/v1/knowledge/link-targets` | 取得（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-120 | GET | `/api/v1/knowledge/proposals` | 取得（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-121 | POST | `/api/v1/knowledge/proposals/:id/accept` | 作成・実行（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-122 | POST | `/api/v1/knowledge/proposals/:id/decline` | 作成・実行（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-123 | GET | `/api/v1/knowledge/tree` | 取得（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-124 | GET | `/api/v1/knowledge/verifications` | 取得（knowledge）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-125 | POST | `/api/v1/knowledge_imports` | 作成・実行（knowledge_imports）— ナレッジのページを書 | A114 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-126 | GET | `/api/v1/knowledge_imports/:id` | 取得（knowledge_imports）— ナレッジのページを書く・直 | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-127 | POST | `/api/v1/knowledge_imports/:id/commit` | 作成・実行（knowledge_imports）— ナレッジのページを書 | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-128 | GET | `/api/v1/knowledge_pages` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-129 | POST | `/api/v1/knowledge_pages` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-130 | GET | `/api/v1/knowledge_pages/:id` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-131 | PATCH | `/api/v1/knowledge_pages/:id` | 更新（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-132 | POST | `/api/v1/knowledge_pages/:id/archive` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-133 | POST | `/api/v1/knowledge_pages/:id/attachments` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-134 | PATCH | `/api/v1/knowledge_pages/:id/draft` | 更新（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-135 | DELETE | `/api/v1/knowledge_pages/:id/draft` | 削除（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-136 | GET | `/api/v1/knowledge_pages/:id/links` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-137 | POST | `/api/v1/knowledge_pages/:id/links` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-138 | GET | `/api/v1/knowledge_pages/:id/markdown` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-139 | GET | `/api/v1/knowledge_pages/:id/messages` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-140 | POST | `/api/v1/knowledge_pages/:id/messages` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-141 | POST | `/api/v1/knowledge_pages/:id/publish` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-142 | POST | `/api/v1/knowledge_pages/:id/unarchive` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-143 | GET | `/api/v1/knowledge_pages/:id/usage` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-144 | POST | `/api/v1/knowledge_pages/:id/verify` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-145 | GET | `/api/v1/knowledge_pages/:id/versions` | 取得（knowledge_pages）— ナレッジのページを書く・直す | A114 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-146 | POST | `/api/v1/knowledge_pages/:id/versions/:v/restore` | 作成・実行（knowledge_pages）— ナレッジのページを書く・ | A114 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-147 | POST | `/api/v1/layers` | 作成・実行（layers）— グループを作る・直す（メンバーの中） | A117 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-148 | PATCH | `/api/v1/layers/:id` | 更新（layers）— グループを作る・直す（メンバーの中） | A117 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-149 | GET | `/api/v1/learning_candidates` | 取得（learning_candidates）— 自分の AI に教える | A30 A93 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-150 | POST | `/api/v1/learning_candidates/:id/accept` | 作成・実行（learning_candidates）— 自分の AI に | A30 A93 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-151 | POST | `/api/v1/learning_candidates/:id/dismiss` | 作成・実行（learning_candidates）— 自分の AI に | A30 A93 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-152 | POST | `/api/v1/learning_candidates/:id/exception-request` | 作成・実行（learning_candidates）— ルールを置く（会 | A131 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-153 | POST | `/api/v1/learning_candidates/:id/later` | 作成・実行（learning_candidates）— 自分の AI に | A30 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-154 | GET | `/api/v1/me` | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 2 | member |  | 401 403 422 429 503 |
| EP-155 | PATCH | `/api/v1/me` | 更新（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 422 413 429 403 403 503 |
| EP-156 | POST | `/api/v1/me/avatar` | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-157 | POST | `/api/v1/me/backup-codes` | 作成・実行（me）— 2段階認証を設定する | A04 | 1 | member | C2 C8 | 401 403 409 422 413 429 403 403 503 |
| EP-158 | POST | `/api/v1/me/email-change` | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-159 | POST | `/api/v1/me/email-change/verify` | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-160 | GET | `/api/v1/me/notification-settings` | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-161 | PATCH | `/api/v1/me/notification-settings` | 更新（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 422 413 429 403 403 503 |
| EP-162 | POST | `/api/v1/me/notification-settings/copy` | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-163 | PATCH | `/api/v1/me/passkeys/:id` | 更新（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | A97 | 1 | member | C2 C8 | 401 403 404 422 413 429 403 403 503 |
| EP-164 | DELETE | `/api/v1/me/passkeys/:id` | 削除（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | A97 | 1 | member | C2 C8 | 401 403 404 422 409 429 403 403 503 |
| EP-165 | POST | `/api/v1/me/password` | 作成・実行（me）— パスキーを設定する（パスワードの人は 2 段階認証 | A97 | 1 | member | C2 C8 | 401 403 409 422 413 429 403 403 503 |
| EP-166 | PATCH | `/api/v1/me/password` | 更新（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | A97 | 1 | member | C2 C8 | 401 403 422 503 413 429 403 403 503 |
| EP-167 | GET | `/api/v1/me/security` | 取得（me）— 2段階認証を設定する／パスキーを設定する（パスワードの人 | A04 A97 | 1 | member | C8 | 401 403 422 429 403 503 |
| EP-168 | GET | `/api/v1/me/sessions` | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-169 | DELETE | `/api/v1/me/sessions/:id` | 削除（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-170 | POST | `/api/v1/me/sessions/revoke-others` | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-171 | GET | `/api/v1/me/setup-tasks` | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-172 | POST | `/api/v1/me/setup-tasks/dismiss` | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-173 | GET | `/api/v1/me/ticket-drafts` | 取得（me）— チケットを作る（画面で・下書きから） | A99 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-174 | POST | `/api/v1/me/ticket-drafts` | 作成・実行（me）— チケットを作る（画面で・下書きから） | A99 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-175 | DELETE | `/api/v1/me/two-factor` | 削除（me）— 2段階認証を設定する | A04 | 1 | member | C2 C8 | 401 403 429 403 403 503 |
| EP-176 | POST | `/api/v1/me/two-factor/confirm` | 作成・実行（me）— 2段階認証を設定する | A04 | 1 | member | C2 C8 | 401 403 409 422 413 429 403 503 |
| EP-177 | POST | `/api/v1/me/two-factor/enable` | 作成・実行（me）— 2段階認証を設定する | A04 | 1 | member | C2 C8 | 401 403 409 422 413 429 403 503 |
| EP-178 | GET | `/api/v1/me/usage` | 取得（me）— 自分のAIの使用量（サブスクの 5 時間の枠・週の枠とい | A94 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-179 | DELETE | `/api/v1/me/workspaces/:id` | 削除（me）— 自分のアカウント・端末・テナント・使用量を整える | A74 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-180 | GET | `/api/v1/members` | 取得（members）— 振り分ける（責任者・期限・分類・親）。AI と | A103 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-181 | GET | `/api/v1/members/:id` | 取得（members）— メンバーの所属（兼務）・権限を決める | A61 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-182 | DELETE | `/api/v1/members/:id` | 削除（members）— 抜ける人の依存を片付ける | A62 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-183 | PATCH | `/api/v1/members/:id/groups` | 更新（members）— メンバーの所属（兼務）・権限を決める | A61 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-184 | POST | `/api/v1/members/:id/nudge` | 作成・実行（members）— 人を招く（層・権限の束） | A36 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-185 | PATCH | `/api/v1/members/:id/permissions` | 更新（members）— メンバーの所属（兼務）・権限を決める | A61 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-186 | GET | `/api/v1/members/:id/remove-preview` | 取得（members）— 抜ける人の依存を片付ける | A62 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-187 | POST | `/api/v1/members/:id/resume` | 作成・実行（members）— 抜ける人の依存を片付ける | A62 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-188 | PATCH | `/api/v1/members/:id/role` | 更新（members）— メンバーの所属（兼務）・権限を決める | A61 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-189 | POST | `/api/v1/members/:id/suspend` | 作成・実行（members）— 抜ける人の依存を片付ける | A62 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-190 | POST | `/api/v1/members/:id/two-factor/reset` | 作成・実行（members）— 2段階認証を設定する | A04 | 2 | member | C2 C8 | 401 403 404 409 422 413 429 403 403 503 |
| EP-191 | GET | `/api/v1/memories` | 取得（memories）— 自分の AI に教える（覚えて） | A30 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-192 | POST | `/api/v1/memories` | 作成・実行（memories）— 自分の AI に教える（覚えて） | A30 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-193 | PATCH | `/api/v1/memories/:id` | 更新（memories）— 自分の AI に教える（覚えて） | A30 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-194 | DELETE | `/api/v1/memories/:id` | 削除（memories）— 自分の AI に教える（覚えて） | A30 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-195 | POST | `/api/v1/memories/:id/promote` | 作成・実行（memories）— ルールを置く（会社・層・個人・取引先） | A131 A30 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-196 | POST | `/api/v1/messages/:id/artifacts` | 作成・実行（messages）— 自分のAIの返事を成果物に書き出し、会 | A95 | 1 | member | C2 C4 | 401 403 404 409 422 413 429 403 403 503 |
| EP-197 | GET | `/api/v1/notices` | 取得（notices）— お知らせを見る | A68 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-198 | POST | `/api/v1/notices/:id/read` | 作成・実行（notices）— お知らせを見る | A68 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-199 | GET | `/api/v1/notifications` | 取得（notifications）— 自分宛ての知らせを新しい順に見る（ | A109 | 1 | member |  | 401 403 422 409 429 403 403 503 |
| EP-200 | PATCH | `/api/v1/notifications/:id` | 更新（notifications）— 知らせを見てチケットへ行く | A109 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-201 | POST | `/api/v1/notifications/read-all` | 作成・実行（notifications）— 知らせを見てチケットへ行く | A109 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-202 | GET | `/api/v1/ops/inquiries` | 取得（ops）— 問い合わせに答える | A70 | 1 | ops |  | 401 403 422 429 403 403 503 |
| EP-203 | GET | `/api/v1/ops/inquiries/:id` | 取得（ops）— 問い合わせに答える | A70 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-204 | PATCH | `/api/v1/ops/inquiries/:id` | 更新（ops）— 問い合わせに答える | A70 | 1 | ops | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-205 | POST | `/api/v1/ops/inquiries/:id/notes` | 作成・実行（ops）— 問い合わせに答える | A70 | 1 | ops | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-206 | POST | `/api/v1/ops/inquiries/:id/replies` | 作成・実行（ops）— 問い合わせに答える | A70 | 1 | ops | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-207 | GET | `/api/v1/ops/invoices` | 取得（ops）— 請求書を出し、入金を記録する | A72 | 1 | ops |  | 401 403 422 429 403 403 503 |
| EP-208 | POST | `/api/v1/ops/invoices/:id/payments` | 作成・実行（ops）— 請求書を出し、入金を記録する | A72 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-209 | POST | `/api/v1/ops/invoices/export` | 作成・実行（ops）— 請求書を出し、入金を記録する | A72 | 1 | ops | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-210 | POST | `/api/v1/ops/invoices/issue` | 作成・実行（ops）— 請求書を出し、入金を記録する | A72 | 1 | ops | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-211 | GET | `/api/v1/ops/members` | 取得（ops）— 運営の人を足し、できることを決める | A134 | 1 | ops | C4 | 401 403 422 429 403 403 503 |
| EP-212 | POST | `/api/v1/ops/members` | 作成・実行（ops）— 運営の人を足し、できることを決める | A134 | 1 | ops | C2 C4 | 401 403 409 422 413 429 403 403 503 |
| EP-213 | PATCH | `/api/v1/ops/members/:id` | 更新（ops）— 運営の人を足し、できることを決める | A134 | 1 | ops | C2 C4 | 401 403 404 422 413 429 403 403 503 |
| EP-214 | DELETE | `/api/v1/ops/members/:id` | 削除（ops）— 運営の人を足し、できることを決める | A134 | 1 | ops | C2 C4 | 401 403 404 422 429 403 403 503 |
| EP-215 | GET | `/api/v1/ops/notices` | 取得（ops）— お知らせを出す | A71 | 1 | ops |  | 401 403 422 429 403 403 503 |
| EP-216 | POST | `/api/v1/ops/notices` | 作成・実行（ops）— お知らせを出す | A71 | 1 | ops | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-217 | GET | `/api/v1/ops/notices/:id` | 取得（ops）— お知らせを出す | A71 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-218 | PATCH | `/api/v1/ops/notices/:id` | 更新（ops）— お知らせを出す | A71 | 1 | ops | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-219 | POST | `/api/v1/ops/notices/:id/publish` | 作成・実行（ops）— お知らせを出す | A71 | 1 | ops | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-220 | POST | `/api/v1/ops/notices/:id/updates` | 作成・実行（ops）— お知らせを出す | A71 | 1 | ops | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-221 | GET | `/api/v1/ops/operations` | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | A80 | 1 | ops | C4 | 401 403 422 429 403 403 503 |
| EP-222 | DELETE | `/api/v1/ops/peeks/:id` | 削除（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・ | A64 | 1 | ops | C2 | 401 403 404 422 429 403 403 503 |
| EP-223 | GET | `/api/v1/ops/plan_history` | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | A133 | 1 | ops | C4 | 401 403 422 429 403 403 503 |
| EP-224 | GET | `/api/v1/ops/plan_proposals` | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | A133 | 1 | ops | C4 | 401 403 422 429 403 403 503 |
| EP-225 | POST | `/api/v1/ops/plan_proposals` | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決め | A133 | 1 | ops | C2 C4 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-226 | PATCH | `/api/v1/ops/plan_proposals/:id` | 更新（ops）— プランの値段・中身を変える案を作り、別の人が決める | A133 | 1 | ops | C2 C4 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-227 | POST | `/api/v1/ops/plan_proposals/:id/decide` | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決め | A133 | 1 | ops | C2 C4 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-228 | GET | `/api/v1/ops/plan_proposals/:id/impact` | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | A133 | 1 | ops | C4 | 401 403 404 422 429 403 403 503 |
| EP-229 | POST | `/api/v1/ops/plan_proposals/:id/return` | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決め | A133 | 1 | ops | C2 C4 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-230 | POST | `/api/v1/ops/plan_proposals/:id/submit` | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決め | A133 | 1 | ops | C2 C4 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-231 | GET | `/api/v1/ops/plans` | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | A133 | 1 | ops | C4 | 401 403 422 429 403 403 503 |
| EP-232 | GET | `/api/v1/ops/shell` | 取得（ops）— 各ワークスペースの様子を見る（気にかける） | A60 | 1 | ops |  | 401 403 422 429 403 403 503 |
| EP-233 | GET | `/api/v1/ops/templates` | 取得（ops）— ひな形（層・マスタ）を作って配る | A128 | 1 | ops |  | 401 403 422 429 403 403 503 |
| EP-234 | GET | `/api/v1/ops/templates/:id` | 取得（ops）— ひな形（層・マスタ）を作って配る | A128 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-235 | POST | `/api/v1/ops/templates/:id/versions` | 作成・実行（ops）— ひな形（層・マスタ）を作って配る | A128 | 1 | ops | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-236 | POST | `/api/v1/ops/work_type_uploads` | 作成・実行（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向 | A80 | 1 | ops | C2 C4 | 401 403 409 422 413 429 403 403 503 |
| EP-237 | GET | `/api/v1/ops/work_type_uploads/:id` | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | A80 | 1 | ops | C4 | 401 403 404 422 429 403 403 503 |
| EP-238 | GET | `/api/v1/ops/work_types` | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | A80 | 1 | ops | C4 | 401 403 422 429 403 403 503 |
| EP-239 | GET | `/api/v1/ops/work_types/:id` | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | A80 | 1 | ops | C4 | 401 403 404 422 429 403 403 503 |
| EP-240 | POST | `/api/v1/ops/work_types/:id/versions` | 作成・実行（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向 | A80 | 1 | ops | C2 C4 | 401 403 404 409 422 413 429 403 403 503 |
| EP-241 | POST | `/api/v1/ops/work_types/:id/versions/:v/rollback` | 作成・実行（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向 | A80 | 1 | ops | C2 C4 | 401 403 404 409 422 413 429 403 403 503 |
| EP-242 | GET | `/api/v1/ops/workspaces` | 取得（ops）— 各ワークスペースの様子を見る（気にかける） | A60 | 1 | ops |  | 401 403 422 429 403 403 503 |
| EP-243 | GET | `/api/v1/ops/workspaces/:id` | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・ | A64 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-244 | GET | `/api/v1/ops/workspaces/:id/audit` | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・ | A64 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-245 | GET | `/api/v1/ops/workspaces/:id/billing` | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・ | A64 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-246 | GET | `/api/v1/ops/workspaces/:id/inquiries` | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・ | A64 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-247 | GET | `/api/v1/ops/workspaces/:id/members` | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・ | A64 | 1 | ops |  | 401 403 404 422 429 403 403 503 |
| EP-248 | POST | `/api/v1/ops/workspaces/:id/members/:mid/resend-verification` | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メン | A64 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-249 | POST | `/api/v1/ops/workspaces/:id/notices` | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メン | A64 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-250 | POST | `/api/v1/ops/workspaces/:id/peeks` | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メン | A64 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-251 | POST | `/api/v1/ops/workspaces/:id/plan` | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メン | A64 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-252 | POST | `/api/v1/ops/workspaces/:id/resume` | 作成・実行（ops）— ワークスペースを止める・再開する（理由・先に知ら | A127 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-253 | POST | `/api/v1/ops/workspaces/:id/stop` | 作成・実行（ops）— ワークスペースを止める・再開する（理由・先に知ら | A127 | 1 | ops | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-254 | POST | `/api/v1/ops/workspaces/export` | 作成・実行（ops）— 各ワークスペースの様子を見る（気にかける） | A60 | 1 | ops | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-255 | GET | `/api/v1/portal` | 取得（portal）— 進みと成果物を見る | A125 | 1 | client |  | 401 403 422 429 403 403 503 |
| EP-256 | GET | `/api/v1/portal/acceptances/:id` | 取得（portal）— 検収する（OK・直してほしい） | A126 | 1 | client |  | 401 403 404 422 429 403 403 503 |
| EP-257 | POST | `/api/v1/portal/acceptances/:id/answer` | 作成・実行（portal）— 検収する（OK・直してほしい） | A126 | 1 | client | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-258 | POST | `/api/v1/portal/attachments` | 作成・実行（portal）— 依頼を出す・やり取りする | A124 | 1 | client | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-259 | GET | `/api/v1/portal/notices` | 取得（portal）— 進みと成果物を見る | A125 | 1 | client |  | 401 403 422 429 403 403 503 |
| EP-260 | POST | `/api/v1/portal/requests` | 作成・実行（portal）— 依頼を出す・やり取りする | A124 | 1 | client | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-261 | GET | `/api/v1/portal/requests/:id` | 取得（portal）— 依頼を出す・やり取りする | A124 | 1 | client |  | 401 403 404 422 429 403 403 503 |
| EP-262 | POST | `/api/v1/portal/requests/:id/messages` | 作成・実行（portal）— 依頼を出す・やり取りする | A124 | 1 | client | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-263 | POST | `/api/v1/portal/requests/questions` | 作成・実行（portal）— 依頼を出す・やり取りする | A124 | 1 | client | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-264 | GET | `/api/v1/portal/tickets/:id` | 取得（portal）— 進みと成果物を見る | A125 | 1 | client |  | 401 403 404 422 429 403 403 503 |
| EP-265 | GET | `/api/v1/rules` | 取得（rules）— 取引先を作り、担当者を招待する／ルールを置く（会社 | A121 A131 | 2 | member |  | 401 403 422 429 403 403 503 |
| EP-266 | POST | `/api/v1/rules` | 作成・実行（rules）— 取引先を作り、担当者を招待する／ルールを置く | A121 A131 | 2 | member | C2 C6 | 401 403 409 422 413 429 403 403 503 |
| EP-267 | GET | `/api/v1/rules/:id` | 取得（rules）— ルールを置く（会社・層・個人・取引先） | A131 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-268 | PATCH | `/api/v1/rules/:id` | 更新（rules）— ルールを置く（会社・層・個人・取引先） | A131 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-269 | DELETE | `/api/v1/rules/:id` | 削除（rules）— ルールを置く（会社・層・個人・取引先） | A131 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-270 | POST | `/api/v1/rules/check` | 作成・実行（rules）— 決まりを整える（守ること・承認を回すとき・や | A118 A131 | 2 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-271 | GET | `/api/v1/saved_views` | 取得（saved_views）— 保存した検索条件を名前の順に開く（自分 | A58 | 1 | member |  | 401 403 422 503 429 403 403 503 |
| EP-272 | POST | `/api/v1/saved_views` | 作成・実行（saved_views）— 見え方を切り替える（一覧と詳細・ | A58 | 1 | member | C2 | 401 403 409 422 404 409 422 503 413 429 403 403 503 |
| EP-273 | PATCH | `/api/v1/saved_views/:id` | 更新（saved_views）— 見え方を切り替える（一覧と詳細・カレン | A58 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-274 | DELETE | `/api/v1/saved_views/:id` | 削除（saved_views）— 見え方を切り替える（一覧と詳細・カレン | A58 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-275 | GET | `/api/v1/scopes` | 取得（scopes）— グループを作る・直す（メンバーの中） | A117 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-276 | POST | `/api/v1/scopes` | 作成・実行（scopes）— グループを作る・直す（メンバーの中） | A117 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-277 | PATCH | `/api/v1/scopes/:id` | 更新（scopes）— グループを作る・直す（メンバーの中） | A117 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-278 | GET | `/api/v1/scopes/:id/overview` | 取得（scopes）— 見え方を切り替える（一覧と詳細・カレンダー・ガン | A58 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-279 | GET | `/api/v1/search` | 取得（search）— 探す（チケット・決定・自分の会話・ナレッジのペー | A21 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-280 | GET | `/api/v1/service-status` | 取得（service-status）— お知らせを見る | A68 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-281 | GET | `/api/v1/shell` | 取得（shell）— 見え方を切り替える（一覧と詳細・カレンダー・ガント | A58 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-282 | PATCH | `/api/v1/test_specs/:id` | 更新（test_specs）— テスト仕様を作る（AI の案・抜けの点検 | A102 | 1 | member | C2 C3 | 401 403 404 422 409 409 409 409 503 413 429 502 403 403 503 |
| EP-283 | DELETE | `/api/v1/test_specs/:id` | 削除（test_specs）— テスト仕様を作る（AI の案・抜けの点検 | A102 | 1 | member | C2 C3 | 401 403 404 422 409 409 503 429 502 403 403 503 |
| EP-284 | GET | `/api/v1/ticket-fields` | 取得（custom_fields）— その種別で出す会社の項目を並びの順 | A103 | 1 | member |  | 401 403 422 404 429 403 403 503 |
| EP-285 | PATCH | `/api/v1/ticket_decisions/:id` | 更新（ticket_decisions）— 決定を記録する（AI の候補 | A108 | 1 | member | C2 | 401 403 404 422 409 503 413 429 403 403 503 |
| EP-286 | PATCH | `/api/v1/ticket_handovers/:id` | 更新（ticket_handovers）— 渡されたものを受ける／断る（ | A110 | 2 | member | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-287 | POST | `/api/v1/ticket_imports` | 作成・実行（ticket_imports）— チケットを作る（画面で・下 | A99 | 1 | member | C2 C4 | 401 403 409 422 413 429 403 403 503 |
| EP-288 | GET | `/api/v1/ticket_imports/:id` | 取得（ticket_imports）— チケットを作る（画面で・下書きか | A99 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-289 | POST | `/api/v1/ticket_imports/:id/commit` | 作成・実行（ticket_imports）— チケットを作る（画面で・下 | A99 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-290 | GET | `/api/v1/ticket_kinds` | 取得（ticket_kinds）— 振り分ける（責任者・期限・分類・親） | A103 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-291 | POST | `/api/v1/ticket_kinds/:id/template-from-ticket` | 作成・実行（ticket_kinds）— チケットの中身（区画）を書く・ | A101 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-292 | GET | `/api/v1/ticket_kinds/template-updates` | 取得（ticket_kinds）— ひな形の新しい版を取り込む | A120 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-293 | POST | `/api/v1/ticket_kinds/template-updates/:id/apply` | 作成・実行（ticket_kinds）— ひな形の新しい版を取り込む | A120 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-294 | DELETE | `/api/v1/ticket_links/:id` | 削除（ticket_links）— 振り分ける（責任者・期限・分類・親） | A103 | 1 | member | C2 | 401 403 404 422 503 429 403 403 503 |
| EP-295 | PATCH | `/api/v1/ticket_messages/:id` | 更新（ticket_messages）— チケットのスレッドで話す（@  | A107 | 1 | member | C2 C6 | 401 403 404 422 404 503 503 413 429 403 403 503 |
| EP-296 | DELETE | `/api/v1/ticket_messages/:id` | 削除（ticket_messages）— チケットのスレッドで話す（@  | A107 | 1 | member | C2 C6 | 401 403 404 422 503 503 429 403 403 503 |
| EP-297 | POST | `/api/v1/ticket_messages/:id/star` | 作成・実行（ticket_messages）— チケットのスレッドで話す | A107 | 1 | member | C2 C6 | 401 403 404 409 422 503 503 413 429 403 403 503 |
| EP-298 | GET | `/api/v1/ticket_stages` | 取得（ticket_stages）— 振り分ける（責任者・期限・分類・親 | A103 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-299 | GET | `/api/v1/tickets` | 取得（tickets）— チケットの一覧を見る（自分に関わるもの・すべて | A113 A58 A99 | 1 | member |  | 401 403 422 409 429 403 403 503 |
| EP-300 | POST | `/api/v1/tickets` | 作成・実行（tickets）— 過去のチケットを複製して作る／見本のチケ | A129 A98 A99 | 1 | member | C2 | 401 403 409 422 404 413 429 403 403 503 |
| EP-301 | GET | `/api/v1/tickets/:id` | 取得（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-302 | PATCH | `/api/v1/tickets/:id` | 更新（tickets）— 振り分ける（責任者・期限・分類・親）。AI と | A103 A113 A115 A17 | 1 | member | C2 | 401 403 404 422 409 409 409 409 409 422 500 503 413 429 403 403 503 |
| EP-303 | DELETE | `/api/v1/tickets/:id` | 削除（tickets）— チケットを消す・アーカイブする（子孫の扱いを決 | A116 | 1 | member | C2 | 401 403 404 422 409 503 429 403 403 503 |
| EP-304 | POST | `/api/v1/tickets/:id/acceptances` | 作成・実行（tickets）— 成果物を確認してもらう（検収を頼む） | A123 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-305 | GET | `/api/v1/tickets/:id/agent-session` | 取得（tickets）— 自分の AI に指示する・相談する（会話・添付 | A20 | 1 | member | C4 | 401 403 404 422 429 502 403 403 503 |
| EP-306 | POST | `/api/v1/tickets/:id/agent-session/apply` | 作成・実行（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-307 | POST | `/api/v1/tickets/:id/agent-session/messages` | 作成・実行（tickets）— 自分の AI に指示する・相談する（会話 | A20 A91 | 1 | member | C2 C3 C4 C5 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-308 | GET | `/api/v1/tickets/:id/artifacts` | 取得（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-309 | POST | `/api/v1/tickets/:id/attachments` | 作成・実行（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member | C2 C4 | 401 403 404 409 422 413 429 403 403 503 |
| EP-310 | PATCH | `/api/v1/tickets/:id/body` | 更新（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member | C2 | 401 403 404 422 409 409 503 413 429 403 403 503 |
| EP-311 | PATCH | `/api/v1/tickets/:id/client-share` | 更新（tickets）— 成果物を確認してもらう（検収を頼む） | A123 | 1 | member | C2 C6 | 401 403 404 422 413 429 403 403 503 |
| EP-312 | POST | `/api/v1/tickets/:id/complete` | 作成・実行（tickets）— 完了にする（ナレッジ更新の候補を確定・作 | A106 | 1 | member | C2 C6 | 401 403 404 409 422 422 503 413 429 403 403 503 |
| EP-313 | GET | `/api/v1/tickets/:id/decisions` | 取得（ticket_decisions）— チケットの決定を見る（生きて | A108 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-314 | POST | `/api/v1/tickets/:id/decisions` | 作成・実行（tickets）— 決定を記録する（AI の候補を確定・直接 | A108 | 1 | member | C2 | 401 403 404 409 422 503 413 429 403 403 503 |
| EP-315 | POST | `/api/v1/tickets/:id/delegate` | 作成・実行（tickets）— AI に任せる | A104 | 1 | member | C2 C3 C5 | 401 403 404 409 422 409 413 429 502 403 403 503 |
| EP-316 | GET | `/api/v1/tickets/:id/delete-preview` | 取得（tickets）— チケットを消す・アーカイブする（子孫の扱いを決 | A116 | 1 | member |  | 401 403 404 422 503 429 403 403 503 |
| EP-317 | POST | `/api/v1/tickets/:id/dry-run` | 作成・実行（tickets）— 試し打ちする（宛先を自分に差し替えて確か | A105 | 1 | member | C1 C2 C6 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-318 | POST | `/api/v1/tickets/:id/handovers` | 作成・実行（tickets）— 上から配る（人・グループへ）／上へ上げる | A111 A112 A48 A51 | 1 | member | C2 C6 | 401 403 404 409 422 413 429 403 403 503 |
| EP-319 | GET | `/api/v1/tickets/:id/kind-change-preview` | 取得（tickets）— 振り分ける（責任者・期限・分類・親）。AI と | A103 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-320 | GET | `/api/v1/tickets/:id/links` | 取得（ticket_links）— チケットのつながり（関連・派生元）を | A103 | 1 | member |  | 401 403 404 422 404 503 429 403 403 503 |
| EP-321 | POST | `/api/v1/tickets/:id/links` | 作成・実行（tickets）— 振り分ける（責任者・期限・分類・親）。A | A103 | 1 | member | C2 | 401 403 404 409 422 404 503 413 429 403 403 503 |
| EP-322 | POST | `/api/v1/tickets/:id/messages` | 作成・実行（tickets）— チケットのスレッドで話す（@ で知らせる | A107 | 1 | member | C2 C6 | 401 403 404 409 422 404 409 409 409 409 422 404 503 503 413 429 403 403 503 |
| EP-323 | GET | `/api/v1/tickets/:id/references` | 取得（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-324 | POST | `/api/v1/tickets/:id/restore` | 作成・実行（tickets）— チケットを消す・アーカイブする（子孫の扱 | A116 | 2 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-325 | GET | `/api/v1/tickets/:id/runs` | 取得（tickets）— AI に任せる | A104 | 1 | member |  | 401 403 404 422 429 502 403 403 503 |
| EP-326 | GET | `/api/v1/tickets/:id/test-specs` | 取得（test_specs）— チケットの確認項目を作った順に見る（文・ | A102 | 1 | member |  | 401 403 404 422 429 502 403 403 503 |
| EP-327 | POST | `/api/v1/tickets/:id/test-specs` | 作成・実行（tickets）— テスト仕様を作る（AI の案・抜けの点検 | A102 | 1 | member | C2 C3 | 401 403 404 409 422 503 413 429 502 403 403 503 |
| EP-328 | POST | `/api/v1/tickets/:id/test-specs/lint` | 作成・実行（tickets）— テスト仕様を作る（AI の案・抜けの点検 | A102 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-329 | POST | `/api/v1/tickets/:id/test-specs/suggest` | 作成・実行（tickets）— テスト仕様を作る（AI の案・抜けの点検 | A102 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-330 | GET | `/api/v1/tickets/:id/timeline` | 取得（ticket_messages）— やり取りを新しい方から読む（前 | A107 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-331 | POST | `/api/v1/tickets/:id/timeline/seen` | 作成・実行（tickets）— チケットのスレッドで話す（@ で知らせる | A107 | 1 | member | C2 C6 | 401 403 404 409 422 503 413 429 403 403 503 |
| EP-332 | GET | `/api/v1/tickets/:id/versions` | 取得（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-333 | POST | `/api/v1/tickets/:id/versions/:v/restore` | 作成・実行（tickets）— チケットの中身（区画）を書く・直す | A101 | 1 | member | C2 | 401 403 404 409 422 413 429 403 403 503 |
| EP-334 | GET | `/api/v1/tickets/:id/work-type-candidates` | 取得（tickets）— 業務の型を選ぶ（候補が 1 つなら自動・複数な | A130 | 1 | member |  | 401 403 404 422 429 403 403 503 |
| EP-335 | POST | `/api/v1/tickets/bulk` | 作成・実行（tickets）— 振り分ける（責任者・期限・分類・親）。A | A103 A113 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-336 | GET | `/api/v1/work_types` | 取得（work_types）— 業務の型を作る・広げる | A119 | 1 | member |  | 401 403 422 429 502 403 403 503 |
| EP-337 | POST | `/api/v1/work_types` | 作成・実行（work_types）— 業務の型を作る・広げる | A119 | 1 | member | C2 C3 | 401 403 409 422 413 429 502 403 403 503 |
| EP-338 | GET | `/api/v1/work_types/:id` | 取得（work_types）— 業務の型を作る・広げる | A119 | 1 | member |  | 401 403 404 422 429 502 403 403 503 |
| EP-339 | POST | `/api/v1/work_types/:id/copy` | 作成・実行（work_types）— 業務の型を作る・広げる | A119 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-340 | PATCH | `/api/v1/work_types/:id/draft` | 更新（work_types）— 業務の型を作る・広げる | A119 | 1 | member | C2 C3 | 401 403 404 422 413 429 502 403 403 503 |
| EP-341 | POST | `/api/v1/work_types/:id/release` | 作成・実行（work_types）— 業務の型を作る・広げる | A119 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-342 | POST | `/api/v1/work_types/:id/spread-requests` | 作成・実行（work_types）— 業務の型を作る・広げる | A119 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-343 | POST | `/api/v1/work_types/:id/try` | 作成・実行（work_types）— 業務の型を作る・広げる | A119 | 1 | member | C2 C3 | 401 403 404 409 422 413 429 502 403 403 503 |
| EP-344 | GET | `/api/v1/work_types/:id/versions` | 取得（work_types）— 業務の型を作る・広げる | A119 | 1 | member |  | 401 403 404 422 429 502 403 403 503 |
| EP-345 | GET | `/api/v1/workspace` | 取得（workspace）— 会社の設定を決める | A75 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-346 | PATCH | `/api/v1/workspace` | 更新（workspace）— 会社の設定を決める | A75 | 1 | member | C2 | 401 403 422 413 429 403 403 503 |
| EP-347 | GET | `/api/v1/workspace/billing` | 取得（workspace）— プラン・利用量・請求書を見る | A69 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-348 | PATCH | `/api/v1/workspace/billing-contact` | 更新（workspace）— プラン・利用量・請求書を見る | A69 | 1 | member | C2 | 401 403 422 413 429 403 403 503 |
| EP-349 | POST | `/api/v1/workspace/deletion` | 作成・実行（workspace）— 会社の設定を決める | A75 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-350 | DELETE | `/api/v1/workspace/deletion` | 削除（workspace）— 会社の設定を決める | A75 | 1 | member | C2 | 401 403 429 403 403 503 |
| EP-351 | POST | `/api/v1/workspace/escalation-rules` | 作成・実行（workspace）— 決まりを整える（守ること・承認を回す | A118 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-352 | PATCH | `/api/v1/workspace/escalation-rules/:id` | 更新（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-353 | DELETE | `/api/v1/workspace/escalation-rules/:id` | 削除（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-354 | POST | `/api/v1/workspace/escalation-rules/preview` | 作成・実行（workspace）— 決まりを整える（守ること・承認を回す | A118 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-355 | POST | `/api/v1/workspace/logo` | 作成・実行（workspace）— 会社の設定を決める | A75 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-356 | GET | `/api/v1/workspace/members` | 取得（workspace）— 人を招く（層・権限の束） | A36 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-357 | PATCH | `/api/v1/workspace/permissions` | 更新（workspace）— 会社の設定を決める | A75 | 1 | member | C2 | 401 403 422 413 429 403 403 503 |
| EP-358 | POST | `/api/v1/workspace/plan` | 作成・実行（workspace）— プラン・利用量・請求書を見る | A69 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-359 | GET | `/api/v1/workspace/plans` | 取得（workspace）— プラン・利用量・請求書を見る | A69 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-360 | GET | `/api/v1/workspace/rules` | 取得（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-361 | POST | `/api/v1/workspace/rules` | 作成・実行（workspace）— 決まりを整える（守ること・承認を回す | A118 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |
| EP-362 | PATCH | `/api/v1/workspace/rules/:id` | 更新（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member | C2 | 401 403 404 422 413 429 403 403 503 |
| EP-363 | DELETE | `/api/v1/workspace/rules/:id` | 削除（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member | C2 | 401 403 404 422 429 403 403 503 |
| EP-364 | GET | `/api/v1/workspace/ticket-shape` | 取得（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member |  | 401 403 422 429 403 403 503 |
| EP-365 | PATCH | `/api/v1/workspace/ticket-shape` | 更新（workspace）— 決まりを整える（守ること・承認を回すとき・ | A118 | 1 | member | C2 | 401 403 422 413 429 403 403 503 |
| EP-366 | POST | `/api/v1/workspace/ticket-shape/preview` | 作成・実行（workspace）— 決まりを整える（守ること・承認を回す | A118 | 1 | member | C2 | 401 403 409 422 413 429 403 403 503 |

## 3. 画面 ↔ API カバレッジ

- 画面 37 ／ OK 36 ／ 未カバー ['legal']
- endpoint の無い行為（v1）[]

## 4. 逆カバレッジ（フィールド → 画面）

- 検査したフィールド 1065 ／ 内部専用 277 ／ どの画面にも出ない 0

## 5. 共通仕様

- 正常：`{ data, meta? }`。エラー：`{ error, code, message, details?, retry_after_sec? }`
- 401 未認証／403 権限なし／404 無い（存在を漏らさない）／409 二重／422 入力（表記ゆらぎはサーバーで正規化）／429 レート／502 外部の失敗（信号なし終了を成功にしない）
- ヘッダー：Authorization: Bearer / Content-Type: application/json / X-Request-ID / Idempotency-Key（POST）

## 6. 変更履歴

- v1.0 2026-11-23 凍結（endpoints 366）
