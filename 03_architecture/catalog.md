# 目録

> 生成物（`python3 scripts/ci/build_catalog.py`）。手で直さない。チケットを切るときは、まずここを探す。使えるなら依存として書き、無いときだけ作る（D-128.125・D-128.129）。

API 369（作った 97・後のフェーズの行為だけ 20）・前の道すじ 26・表 148・画面の部品 19・共通の処理 13・エラー 263・部品 56・設定 41

## 共通の処理

| パッケージ | 何をするか |
|---|---|
| `@kaname/actions` | 関門 C1 ネットワーク：外に出る操作は executeAction(actionRef, input, ctx) だけ。生の fetch はこのパッケージの中でしか呼べない（CI G16 が静的に検出）。 |
| `@kaname/auth` | 認証（Better Auth 1.7）。境界 B2：better-auth を import してよいのはこのパッケージだけ（CI G7）。 |
| `@kaname/billing` | 関門 C7 決済・課金：billing.<op>(input, ctx) だけ。stripe SDK はこのパッケージの外では使えない（CI G22）。段階 1 は請求書払い（D-002・D-075.4）。 |
| `@kaname/config` | 起動時のブート設定（例外 X-002：process.env をここだけが読む）。1 回だけ読み、型付きで配る。顧客の資格情報は絶対に扱わない（それは関門 C8）。 |
| `@kaname/contracts` | 契約（OpenAPI）と生成型。信頼源は 08_api/openapi.yaml。types.ts と registry.ts は scripts/ci/contract.mjs gen が生成する（手で直さない）。 |
| `@kaname/db` | 関門 C2（永続化）の置き場。実体（repository・接続プール・RLS の SET LOCAL）は T-F-02／T-F-03。 |
| `@kaname/errors` | エラーは正本（errors.json）から引く。文言と次の一手をコードに書かない。出せないエラーはデッドコード（ci:errors-used が数える）。D-069。 |
| `@kaname/gateways` |  |
| `@kaname/llm` | 関門 C3 モデル呼び出し：LLM を呼ぶ唯一の入口 llm.invoke(request, ctx)。各社 SDK はこのパッケージの外では import できない（CI G18）。 |
| `@kaname/notify` | 関門 C6 通知送出：notify(event, audience, ctx) だけ。メール／チャット／プッシュの SDK はこのパッケージの外では使えない（CI G21）。 |
| `@kaname/runtime` | 関門 C5 プロセス起動：runProcess(spec, ctx) だけ。child_process はこのパッケージの外では使えない（CI G20）。 |
| `@kaname/secrets` | 関門 C8 秘密の読み出し：secrets.resolve(ref, ctx) だけ。Infisical SDK と業務ロジックからの process.env はこのパッケージの外では使えない（CI G23。起動設定は例外 X-002）。 |
| `@kaname/storage` | 関門 C4 ファイル／オブジェクト：objectStore.<op>(ref, ctx) だけ。fs／S3 SDK はこのパッケージの外では使えない（CI G19。Bridge の作業フォルダは例外 X-001）。 |

## 画面の部品

| ファイル | 出すもの | 何をするか |
|---|---|---|
| `apps/web/components/k/button` | Button | ボタン（K-24・正本 components.button-*）。1 画面に主ボタン（primary）は 1 つ。danger は取り消せない操作 |
| `apps/web/components/k/field` | TextField, TextArea, PasswordField | 入力（K-24・正本 components.input）。見出し・説明・理由（422 の項目ごとの理由）を 1 つの組にする（Base UI Field） |
| `apps/web/components/k/select` | Select | 選ぶ（K-24・Base UI Select）。キーボード（↑↓・Enter・文字で飛ぶ）と読み上げは Base UI に任せる |
| `apps/web/components/k/menu` | Menu, MenuTrigger, MenuPopup, MenuItem | メニューの型（K-369・Base UI Menu）。開くボタン 1 つと、開いた箱の中の項目の並び（行の「…」など）。 |
| `apps/web/components/k/table` | Table | 表（K-24）。1 行 36px（D-128.13）。見出しの行は th（scope 付き）、表の名前は caption（読み上げが表の中身を言える） |
| `apps/web/components/k/badge` | Badge | 札（K-24・D-052）。状態は淡い面と濃い文字の対。色だけで意味を伝えない（文字を必ず持つ） |
| `apps/web/components/k/tabs` | Tabs | タブ（K-24・Base UI Tabs）。←→ で移り、選んだタブの中身だけを出す（読み上げは tablist / tab / tabpanel） |
| `apps/web/components/k/notice` | Callout, Toaster, useNotify | 知らせ（K-24）。2 つ： |
| `apps/web/components/k/dialog` | Dialog, Confirm | ダイアログ（K-24・Base UI Dialog）。開くと中に動き、Esc で閉じ、閉じると押した所に戻る（Base UI が持つ） |
| `apps/web/components/k/theme` | ThemeSwitch, applyTheme | 見た目の切り替え（D-128.55）。押すとその場で <html data-theme> を替え、cookie に残す（次に開いたときもサーバーが同じ見た目で出す） |
| `apps/web/components/k/shell` | Shell | 外枠（K-25・キャンバスの左のバー・上の帯・右のパネル・スマホの下のタブ）。新しい画面は全部この中に置く |
| `apps/web/components/k/nav-model` | navFor | 外枠の並べ方（K-25）。中身は全部 flow.json から生成した lib/nav.ts（G27 が最新かを見る）。画面ごとに手で並べない（screen-derivation §6） |
| `apps/web/components/k/states` | Empty, Loading, ErrorState, NoAccess, ErrorPage, OfflineBanner, useOnline | 4 つの状態（空・読み込み中・失敗・権限が無い）とエラーの 1 件（K-26・D-069）。どの画面でも同じ形で出す |
| `apps/web/components/k/error-of` | PAGE_ERROR, errorCodeOf, errorText | どのエラーを出すか（K-26・D-069）。文言は正本（07_qa/test-specs/errors.json → @kaname/errors/catalog）の 1 件だけ。画面で文言を作らない |
| `apps/web/components/k/page` | PageBody, PageHeader, Section, Prose, TextLink, Row | ページの型（K-217・D-143.3）。見た目は page.css（キャンバスの実測）。どれもクラスの名前を出すだけの薄い部品。 |
| `apps/web/components/k/me-sub` | MeSub | 自分の設定の第 2 ナビ（K-220・キャンバス MePC の aside.kn-sub）。自分の設定の画面の本文の中に、本文の箱の左に置く。 |
| `apps/web/components/k/band` | Band, BandCaution, BandLine, NoticeBox | 詳細の帯の箱（K-227・正本 components.band-*・キャンバス TicketDetail の main article [role="status"]）。 |
| `apps/web/components/k/doc-tools` | DocTools, DOC_TOOL_ITEMS | 本文の道具の帯（K-226・正本 components.doc-toolbar・doc-tool・キャンバス TicketDetail・Create）。 |
| `apps/web/components/k/search-field` | SearchField | 探す欄の型（段 9・代表の直し 2026-11-20）。虫眼鏡と入力を 1 つの枠に入れ、焦点が中に入ったら枠全体に輪を出す（:focus-within）。 |

## DB の表（境目と骨格）

| 表 | 区分 | 書く流れ | 読む流れ | 境目 |
|---|---|---|---|---|
| `abilities` | internal |  |  |  |
| `acceptances` | skeleton | F11 |  |  |
| `account_events` | skeleton | F10,F12 |  | ○ |
| `action_runs` | skeleton | F5,F7 |  | ○ |
| `approvals` | skeleton | F5,F9 |  | ○ |
| `artifact_versions` | skeleton |  | F4 |  |
| `artifacts` | skeleton |  | F4 |  |
| `attachments` | skeleton | F11,F12,F4,F9 | F5 | ○ |
| `audit_events` | skeleton |  | F10 |  |
| `bridge_job_events` | skeleton | F5 |  |  |
| `bridge_jobs` | skeleton | F3,F5 |  | ○ |
| `bridge_pairing_codes` | skeleton | F3 |  |  |
| `checks` | skeleton | F5 | F4 | ○ |
| `client_contacts` | skeleton | F11 |  |  |
| `client_groups` | internal |  |  |  |
| `client_requests` | skeleton | F11 |  |  |
| `clients` | skeleton | F11 | F4 | ○ |
| `clones` | skeleton |  | F5 |  |
| `conversations` | skeleton | F4 | F5 | ○ |
| `credentials` | skeleton | F3 |  |  |
| `custom_field_kinds` | skeleton |  |  |  |
| `custom_fields` | skeleton |  | F4 |  |
| `distributions` | skeleton | F12 |  |  |
| `error_events` | internal |  |  |  |
| `export_jobs` | skeleton | F10,F12,F5 |  | ○ |
| `handover_rules` | skeleton |  | F8 |  |
| `imports` | skeleton | F9 |  |  |
| `inquiries` | skeleton | F12 |  |  |
| `invitations` | skeleton | F1,F10,F11,F2 |  | ○ |
| `invoices` | skeleton | F12 |  |  |
| `kaname_auth` | internal |  |  |  |
| `kind_sections` | skeleton | F4,F9 |  | ○ |
| `knowledge_links` | skeleton | F9 |  |  |
| `knowledge_page_versions` | skeleton | F9 |  |  |
| `knowledge_pages` | skeleton | F9 |  |  |
| `layers` | skeleton | F9 |  |  |
| `learning_candidates` | skeleton | F9 |  |  |
| `login_attempts` | internal |  |  |  |
| `member_kinds` | internal |  |  |  |
| `members` | skeleton | F10 | F12,F4 | ○ |
| `memories` | skeleton | F9 |  |  |
| `messages` | skeleton | F11,F12,F4,F5,F9 |  | ○ |
| `notice_deliveries` | skeleton | F12 |  |  |
| `notices` | skeleton | F12 | F11 | ○ |
| `notification_settings` | skeleton | F10 |  |  |
| `notifications` | skeleton | F10,F7 |  | ○ |
| `operations` | skeleton |  | F12 |  |
| `ops_audit_events` | skeleton |  | F12 |  |
| `ops_members` | skeleton | F12 |  |  |
| `ops_plan_proposals` | skeleton | F12 |  |  |
| `payments` | skeleton | F12 |  |  |
| `permissions` | skeleton | F10 |  |  |
| `plans` | skeleton |  | F12 |  |
| `policies` | skeleton | F11,F9 |  | ○ |
| `reference_logs` | skeleton |  | F4,F9 | ○ |
| `saved_views` | skeleton | F7 |  |  |
| `schema_migrations` | internal |  |  |  |
| `scope_memberships` | skeleton | F10 |  |  |
| `scopes` | skeleton | F9 |  |  |
| `security_events` | skeleton | F1,F10,F12 |  | ○ |
| `sessions` | skeleton | F1,F10,F3 |  | ○ |
| `skill_test_runs` | skeleton | F9 |  |  |
| `skill_versions` | skeleton | F12,F9 |  | ○ |
| `skills` | skeleton | F9 | F12,F4 | ○ |
| `status_incidents` | skeleton | F12 | F1 | ○ |
| `subscriptions` | skeleton | F12 |  |  |
| `support_access_grants` | skeleton | F12 |  |  |
| `target_kinds` | internal |  |  |  |
| `tenant_distributions` | skeleton |  | F9 |  |
| `tenant_memberships` | skeleton | F10,F4 |  | ○ |
| `tenants` | skeleton | F10 | F12 | ○ |
| `terms_consents` | skeleton | F1 |  |  |
| `terms_versions` | skeleton |  | F1 |  |
| `test_specs` | skeleton | F4 |  |  |
| `ticket_decisions` | skeleton | F6 |  |  |
| `ticket_drafts` | internal |  |  |  |
| `ticket_drafts_used` | internal |  |  |  |
| `ticket_field_values` | skeleton |  |  |  |
| `ticket_handovers` | skeleton | F8 |  |  |
| `ticket_imports` | skeleton | F4 |  |  |
| `ticket_kinds` | skeleton | F9 | F4 | ○ |
| `ticket_links` | skeleton | F4 |  |  |
| `ticket_messages` | skeleton | F6 | F11 | ○ |
| `ticket_section_versions` | skeleton | F4 |  |  |
| `ticket_sections` | skeleton | F4 |  |  |
| `ticket_stages` | skeleton |  | F4 |  |
| `ticket_thread_seen` | internal |  |  |  |
| `tickets` | skeleton | F11,F3,F4,F5,F6,F7 |  | ○ |

凍結の表（60）：`account_event_items`・`agent_usage_snapshots`・`ai_employees`・`billing_events`・`bridge_job_states`・`bridge_pairings`・`class_axes`・`class_values`・`credential_kinds`・`daily_plans`・`disclosure_versions`・`distribution_versions`・`duties`・`duty_versions`・`erasure_certificates`・`goal_allocations`・`goal_contributions`・`goal_kinds`・`goal_versions`・`goals`・`hypotheses`・`integrations`・`learned_procedures`・`ledger_definitions`・`ledger_fields`・`ledger_records`・`ledger_stages`・`ledger_views`・`llm_capabilities`・`llm_routes`・`measures`・`memory_digests`・`memory_kinds`・`memory_proposals`・`notification_preferences`・`payment_methods`・`permission_rules`・`plan_change_requests`・`plan_versions`・`procedure_steps`・`push_devices`・`retention_holds`・`review_requests`・`revoke_reasons`・`role_bundle_defaults`・`rollup_kinds`・`service_registry`・`service_registry_versions`・`service_requests`・`session_kinds`・`setup_steps`・`skill_attachments`・`subprocessors`・`task_handovers`・`tasks`・`ticket_class_values`・`triggers`・`units`・`usage_meters`・`validations`

## API の口

| 口 | 道 | 何をするか | 流れ | 状態 | 持ち主のチケット |
|---|---|---|---|---|---|
| `acceptInvitation` | POST /api/v1/auth/invitations/:token/accept | 作成・実行（auth）— 招待を受けて参加する（今のアカウントで別のテナントにも）／規約に同意する（どの版に同意したかが残る） | F1,F2 | 作った | K-332 |
| `requestPasswordReset` | POST /api/v1/auth/password/forgot | 作成・実行（auth）— パスワードを再設定する | F1 | 作った | K-313 |
| `resetPassword` | POST /api/v1/auth/password/reset | 作成・実行（auth）— パスワードを再設定する | F1 | 作った | K-314 |
| `requestAdminRecovery` | POST /api/v1/auth/recovery/admin-request | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | F1 | 契約だけ（501） | K-305 |
| `getServiceStatus` | GET /api/v1/auth/service-status | 取得（auth）— ログインする（パスキー／パスワード＋2 段階）／ログインできない・困ったときに、自分で解くか運営に聞く | F1 | 作った | K-307 |
| `signInWithPassword` | POST /api/v1/auth/sign-in | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | F1 | 作った | K-301 |
| `signOut` | POST /api/v1/auth/sign-out | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | F1 | 作った | K-306 |
| `createSignup` | POST /api/v1/auth/sign-up | 作成・実行（auth）— アカウントを作る（会社名が空なら本人の名前で個人のテナン／規約に同意する（どの版に同意したかが残る） | F1 | 作った | K-51 |
| `resendSignupEmail` | POST /api/v1/auth/sign-up/resend | 作成・実行（auth）— アカウントを作る（会社名が空なら本人の名前で個人のテナン | F1 | 作った | K-51 |
| `getSignupStatus` | GET /api/v1/auth/sign-up/status | 取得（auth）— アカウントを作る（会社名が空なら本人の名前で個人のテナン | F1 | 作った | K-51 |
| `verifySignup` | POST /api/v1/auth/sign-up/verify | 作成・実行（auth）— メールを確認して本人だと示す | F1 | 契約だけ（501） | K-52 |
| `stepUp` | POST /api/v1/auth/step-up | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | F1 | 作った | K-19 |
| `consentToTerms` | POST /api/v1/auth/terms/consent | 作成・実行（auth）— 規約に同意する（どの版に同意したかが残る） | F1 | 作った | K-53 |
| `getCurrentTerms` | GET /api/v1/auth/terms/current | 取得（auth）— 規約に同意する（どの版に同意したかが残る） | F1 | 作った | K-53 |
| `verifySignInCode` | POST /api/v1/auth/two-factor/verify | 作成・実行（auth）— ログインする（パスキー／パスワード＋2 段階） | F1 | 作った | K-302 |
| `renamePasskey` | PATCH /api/v1/me/passkeys/:id | 更新（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | F1 | 作った | K-309 |
| `deletePasskey` | DELETE /api/v1/me/passkeys/:id | 削除（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | F1 | 作った | K-309 |
| `setMyPassword` | POST /api/v1/me/password | 作成・実行（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | F1 | 作った | K-312 |
| `changePassword` | PATCH /api/v1/me/password | 更新（me）— パスキーを設定する（パスワードの人は 2 段階認証を設定 | F1 | 作った | K-312 |
| `getMySecurity` | GET /api/v1/me/security | 取得（me）— 2段階認証を設定する／パスキーを設定する（パスワードの人は 2 段階認証を設定 | F1 | 作った | K-308 |
| `listAuditEvents` | GET /api/v1/audit_events | 取得（audit_events）— 何をしたか追う（記録） | F10 | 契約だけ（501） |  |
| `createExport` | POST /api/v1/exports | 作成・実行（exports）— 記録を書き出す（本人確認） | F10 | 契約だけ（501） |  |
| `getExport` | GET /api/v1/exports/:id | 取得（exports）— 記録を書き出す（本人確認） | F10 | 契約だけ（501） |  |
| `createInvitations` | POST /api/v1/invitations | 作成・実行（invitations）— 人を招く（層・権限の束） | F10 | 作った | K-70,K-419 |
| `revokeInvitation` | DELETE /api/v1/invitations/:id | 削除（invitations）— 人を招く（層・権限の束） | F10 | 契約だけ（501） | K-70 |
| `resendInvitation` | POST /api/v1/invitations/:id/resend | 作成・実行（invitations）— 人を招く（層・権限の束） | F10 | 契約だけ（501） | K-70 |
| `createInvitationLink` | POST /api/v1/invitations/link | 作成・実行（invitations）— 人を招く（層・権限の束） | F10 | 作った | K-70,K-421 |
| `getMe` | GET /api/v1/me | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `updateMe` | PATCH /api/v1/me | 更新（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `uploadAvatar` | POST /api/v1/me/avatar | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `requestEmailChange` | POST /api/v1/me/email-change | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `verifyEmailChange` | POST /api/v1/me/email-change/verify | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `getNotificationSettings` | GET /api/v1/me/notification-settings | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `updateNotificationSettings` | PATCH /api/v1/me/notification-settings | 更新（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `copyNotificationSettings` | POST /api/v1/me/notification-settings/copy | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `listMySessions` | GET /api/v1/me/sessions | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `revokeMySession` | DELETE /api/v1/me/sessions/:id | 削除（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `revokeOtherSessions` | POST /api/v1/me/sessions/revoke-others | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `listSetupTasks` | GET /api/v1/me/setup-tasks | 取得（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 作った | K-250 |
| `dismissSetupTasks` | POST /api/v1/me/setup-tasks/dismiss | 作成・実行（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 作った | K-250 |
| `leaveWorkspace` | DELETE /api/v1/me/workspaces/:id | 削除（me）— 自分のアカウント・端末・テナント・使用量を整える | F10 | 契約だけ（501） | K-70 |
| `getMember` | GET /api/v1/members/:id | 取得（members）— メンバーの所属（兼務）・権限を決める | F10 | 契約だけ（501） |  |
| `removeMember` | DELETE /api/v1/members/:id | 削除（members）— 抜ける人の依存を片付ける | F10 | 契約だけ（501） |  |
| `updateMemberGroups` | PATCH /api/v1/members/:id/groups | 更新（members）— メンバーの所属（兼務）・権限を決める | F10 | 契約だけ（501） |  |
| `nudgeMember` | POST /api/v1/members/:id/nudge | 作成・実行（members）— 人を招く（層・権限の束） | F10 | 契約だけ（501） | K-70 |
| `updateMemberPermissions` | PATCH /api/v1/members/:id/permissions | 更新（members）— メンバーの所属（兼務）・権限を決める | F10 | 契約だけ（501） |  |
| `previewMemberRemoval` | GET /api/v1/members/:id/remove-preview | 取得（members）— 抜ける人の依存を片付ける | F10 | 契約だけ（501） |  |
| `resumeMember` | POST /api/v1/members/:id/resume | 作成・実行（members）— 抜ける人の依存を片付ける | F10 | 契約だけ（501） |  |
| `updateMemberRole` | PATCH /api/v1/members/:id/role | 更新（members）— メンバーの所属（兼務）・権限を決める | F10 | 契約だけ（501） | K-70 |
| `suspendMember` | POST /api/v1/members/:id/suspend | 作成・実行（members）— 抜ける人の依存を片付ける | F10 | 契約だけ（501） |  |
| `getWorkspaceSettings` | GET /api/v1/workspace | 取得（workspace）— 会社の設定を決める | F10 | 契約だけ（501） |  |
| `updateWorkspace` | PATCH /api/v1/workspace | 更新（workspace）— 会社の設定を決める | F10 | 契約だけ（501） |  |
| `requestWorkspaceDeletion` | POST /api/v1/workspace/deletion | 作成・実行（workspace）— 会社の設定を決める | F10 | 契約だけ（501） |  |
| `cancelWorkspaceDeletion` | DELETE /api/v1/workspace/deletion | 削除（workspace）— 会社の設定を決める | F10 | 契約だけ（501） |  |
| `uploadWorkspaceLogo` | POST /api/v1/workspace/logo | 作成・実行（workspace）— 会社の設定を決める | F10 | 契約だけ（501） |  |
| `getWorkspaceMembers` | GET /api/v1/workspace/members | 取得（workspace）— 人を招く（層・権限の束） | F10 | 作った | K-70,K-419 |
| `updateWorkspacePermissions` | PATCH /api/v1/workspace/permissions | 更新（workspace）— 会社の設定を決める | F10 | 契約だけ（501） |  |
| `remindAcceptance` | POST /api/v1/acceptances/:id/remind | 作成・実行（acceptances）— 成果物を確認してもらう（検収を頼む） | F11 | 契約だけ（501） |  |
| `updateClientContact` | PATCH /api/v1/client_contacts/:id | 更新（client_contacts）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `removeClientContact` | DELETE /api/v1/client_contacts/:id | 削除（client_contacts）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `inviteClientContact` | POST /api/v1/client_contacts/:id/invitation | 作成・実行（client_contacts）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `listClientRequests` | GET /api/v1/client_requests | 取得（client_requests）— 届いた依頼を受けてチケットにする／断る | F11 | 契約だけ（501） |  |
| `getClientRequest` | GET /api/v1/client_requests/:id | 取得（client_requests）— 届いた依頼を受けてチケットにする／断る | F11 | 契約だけ（501） |  |
| `updateClientRequest` | PATCH /api/v1/client_requests/:id | 更新（client_requests）— 届いた依頼を受けてチケットにする／断る | F11 | 契約だけ（501） |  |
| `acceptClientRequest` | POST /api/v1/client_requests/:id/accept | 作成・実行（client_requests）— 届いた依頼を受けてチケットにする／断る | F11 | 契約だけ（501） |  |
| `declineClientRequest` | POST /api/v1/client_requests/:id/decline | 作成・実行（client_requests）— 届いた依頼を受けてチケットにする／断る | F11 | 契約だけ（501） |  |
| `replyToClientRequest` | POST /api/v1/client_requests/:id/reply | 作成・実行（client_requests）— 届いた依頼を受けてチケットにする／断る | F11 | 契約だけ（501） |  |
| `listClients` | GET /api/v1/clients | 取得（clients）— 振り分ける（責任者・期限・分類・親）。AI と相談しても／取引先を作り、担当者を招待する | F11,F4 | 契約だけ（501） | K-59 |
| `createClient` | POST /api/v1/clients | 作成・実行（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `getClient` | GET /api/v1/clients/:id | 取得（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `updateClient` | PATCH /api/v1/clients/:id | 更新（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `listClientActivity` | GET /api/v1/clients/:id/activity | 取得（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `createClientContact` | POST /api/v1/clients/:id/contacts | 作成・実行（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `getClientPortalPreview` | GET /api/v1/clients/:id/portal-preview | 取得（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `updateClientShare` | PATCH /api/v1/clients/:id/share | 更新（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `listClientLinkCandidates` | GET /api/v1/clients/link-candidates | 取得（clients）— 取引先を作り、担当者を招待する | F11 | 契約だけ（501） |  |
| `getPortalHome` | GET /api/v1/portal | 取得（portal）— 進みと成果物を見る | F11 | 契約だけ（501） |  |
| `getPortalAcceptance` | GET /api/v1/portal/acceptances/:id | 取得（portal）— 検収する（OK・直してほしい） | F11 | 契約だけ（501） |  |
| `answerAcceptance` | POST /api/v1/portal/acceptances/:id/answer | 作成・実行（portal）— 検収する（OK・直してほしい） | F11 | 契約だけ（501） |  |
| `uploadPortalAttachment` | POST /api/v1/portal/attachments | 作成・実行（portal）— 依頼を出す・やり取りする | F11 | 契約だけ（501） |  |
| `listPortalNotices` | GET /api/v1/portal/notices | 取得（portal）— 進みと成果物を見る | F11 | 契約だけ（501） |  |
| `createPortalRequest` | POST /api/v1/portal/requests | 作成・実行（portal）— 依頼を出す・やり取りする | F11 | 契約だけ（501） |  |
| `getPortalRequest` | GET /api/v1/portal/requests/:id | 取得（portal）— 依頼を出す・やり取りする | F11 | 契約だけ（501） |  |
| `postPortalRequestMessage` | POST /api/v1/portal/requests/:id/messages | 作成・実行（portal）— 依頼を出す・やり取りする | F11 | 契約だけ（501） |  |
| `askPortalRequestQuestions` | POST /api/v1/portal/requests/questions | 作成・実行（portal）— 依頼を出す・やり取りする | F11 | 契約だけ（501） |  |
| `getPortalTicket` | GET /api/v1/portal/tickets/:id | 取得（portal）— 進みと成果物を見る | F11 | 契約だけ（501） |  |
| `listRules` | GET /api/v1/rules | 取得（rules）— 取引先を作り、担当者を招待する／ルールを置く（会社・層・個人・取引先） | F11,F9 | 契約だけ（501） | K-71 |
| `createRule` | POST /api/v1/rules | 作成・実行（rules）— 取引先を作り、担当者を招待する／ルールを置く（会社・層・個人・取引先） | F11,F9 | 契約だけ（501） | K-71 |
| `requestAcceptance` | POST /api/v1/tickets/:id/acceptances | 作成・実行（tickets）— 成果物を確認してもらう（検収を頼む） | F11 | 契約だけ（501） | K-71 |
| `updateTicketClientShare` | PATCH /api/v1/tickets/:id/client-share | 更新（tickets）— 成果物を確認してもらう（検収を頼む） | F11 | 契約だけ（501） | K-71 |
| `listMyInquiries` | GET /api/v1/inquiries | 取得（inquiries）— 運営に問い合わせる | F12 | 契約だけ（501） |  |
| `createInquiry` | POST /api/v1/inquiries | 作成・実行（inquiries）— 運営に問い合わせる | F12 | 契約だけ（501） |  |
| `getMyInquiry` | GET /api/v1/inquiries/:id | 取得（inquiries）— 運営に問い合わせる | F12 | 契約だけ（501） |  |
| `postInquiryMessage` | POST /api/v1/inquiries/:id/messages | 作成・実行（inquiries）— 運営に問い合わせる | F12 | 契約だけ（501） |  |
| `resolveMyInquiry` | POST /api/v1/inquiries/:id/resolve | 作成・実行（inquiries）— 運営に問い合わせる | F12 | 契約だけ（501） |  |
| `uploadInquiryAttachment` | POST /api/v1/inquiries/attachments | 作成・実行（inquiries）— 運営に問い合わせる | F12 | 契約だけ（501） |  |
| `downloadInvoicePdf` | GET /api/v1/invoices/:id/pdf | 取得（invoices）— プラン・利用量・請求書を見る | F12 | 契約だけ（501） |  |
| `listNotices` | GET /api/v1/notices | 取得（notices）— お知らせを見る | F12 | 契約だけ（501） |  |
| `markNoticeRead` | POST /api/v1/notices/:id/read | 作成・実行（notices）— お知らせを見る | F12 | 契約だけ（501） |  |
| `listOpsInquiries` | GET /api/v1/ops/inquiries | 取得（ops）— 問い合わせに答える | F12 | 契約だけ（501） |  |
| `getOpsInquiry` | GET /api/v1/ops/inquiries/:id | 取得（ops）— 問い合わせに答える | F12 | 契約だけ（501） |  |
| `updateOpsInquiry` | PATCH /api/v1/ops/inquiries/:id | 更新（ops）— 問い合わせに答える | F12 | 契約だけ（501） |  |
| `addOpsInquiryNote` | POST /api/v1/ops/inquiries/:id/notes | 作成・実行（ops）— 問い合わせに答える | F12 | 契約だけ（501） |  |
| `replyOpsInquiry` | POST /api/v1/ops/inquiries/:id/replies | 作成・実行（ops）— 問い合わせに答える | F12 | 契約だけ（501） |  |
| `listOpsInvoices` | GET /api/v1/ops/invoices | 取得（ops）— 請求書を出し、入金を記録する | F12 | 契約だけ（501） |  |
| `recordPayment` | POST /api/v1/ops/invoices/:id/payments | 作成・実行（ops）— 請求書を出し、入金を記録する | F12 | 契約だけ（501） |  |
| `exportOpsInvoices` | POST /api/v1/ops/invoices/export | 作成・実行（ops）— 請求書を出し、入金を記録する | F12 | 契約だけ（501） |  |
| `issueOpsInvoices` | POST /api/v1/ops/invoices/issue | 作成・実行（ops）— 請求書を出し、入金を記録する | F12 | 契約だけ（501） |  |
| `listOpsMembers` | GET /api/v1/ops/members | 取得（ops）— 運営の人を足し、できることを決める | F12 | 契約だけ（501） |  |
| `addOpsMember` | POST /api/v1/ops/members | 作成・実行（ops）— 運営の人を足し、できることを決める | F12 | 契約だけ（501） |  |
| `updateOpsMemberCaps` | PATCH /api/v1/ops/members/:id | 更新（ops）— 運営の人を足し、できることを決める | F12 | 契約だけ（501） |  |
| `removeOpsMember` | DELETE /api/v1/ops/members/:id | 削除（ops）— 運営の人を足し、できることを決める | F12 | 契約だけ（501） |  |
| `listOpsNotices` | GET /api/v1/ops/notices | 取得（ops）— お知らせを出す | F12 | 契約だけ（501） |  |
| `createOpsNotice` | POST /api/v1/ops/notices | 作成・実行（ops）— お知らせを出す | F12 | 契約だけ（501） |  |
| `getOpsNotice` | GET /api/v1/ops/notices/:id | 取得（ops）— お知らせを出す | F12 | 契約だけ（501） |  |
| `updateOpsNotice` | PATCH /api/v1/ops/notices/:id | 更新（ops）— お知らせを出す | F12 | 契約だけ（501） |  |
| `publishOpsNotice` | POST /api/v1/ops/notices/:id/publish | 作成・実行（ops）— お知らせを出す | F12 | 契約だけ（501） |  |
| `addIncidentUpdate` | POST /api/v1/ops/notices/:id/updates | 作成・実行（ops）— お知らせを出す | F12 | 契約だけ（501） |  |
| `listOperations` | GET /api/v1/ops/operations | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `closePeek` | DELETE /api/v1/ops/peeks/:id | 削除（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `listPlanHistory` | GET /api/v1/ops/plan_history | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `listPlanProposals` | GET /api/v1/ops/plan_proposals | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `createPlanProposal` | POST /api/v1/ops/plan_proposals | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `updatePlanProposal` | PATCH /api/v1/ops/plan_proposals/:id | 更新（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `decidePlanProposal` | POST /api/v1/ops/plan_proposals/:id/decide | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `getPlanProposalImpact` | GET /api/v1/ops/plan_proposals/:id/impact | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `returnPlanProposal` | POST /api/v1/ops/plan_proposals/:id/return | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `submitPlanProposal` | POST /api/v1/ops/plan_proposals/:id/submit | 作成・実行（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `listOpsPlans` | GET /api/v1/ops/plans | 取得（ops）— プランの値段・中身を変える案を作り、別の人が決める | F12 | 契約だけ（501） | K-72 |
| `getOpsShell` | GET /api/v1/ops/shell | 取得（ops）— 各ワークスペースの様子を見る（気にかける） | F12 | 契約だけ（501） |  |
| `listOpsTemplates` | GET /api/v1/ops/templates | 取得（ops）— ひな形（層・マスタ）を作って配る | F12 | 契約だけ（501） | K-72 |
| `getOpsTemplate` | GET /api/v1/ops/templates/:id | 取得（ops）— ひな形（層・マスタ）を作って配る | F12 | 契約だけ（501） | K-72 |
| `releaseOpsTemplate` | POST /api/v1/ops/templates/:id/versions | 作成・実行（ops）— ひな形（層・マスタ）を作って配る | F12 | 契約だけ（501） | K-72 |
| `uploadWorkTypePackage` | POST /api/v1/ops/work_type_uploads | 作成・実行（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `getWorkTypeUpload` | GET /api/v1/ops/work_type_uploads/:id | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `listOpsWorkTypes` | GET /api/v1/ops/work_types | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `getOpsWorkType` | GET /api/v1/ops/work_types/:id | 取得（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `releaseOpsWorkType` | POST /api/v1/ops/work_types/:id/versions | 作成・実行（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `rollbackOpsWorkType` | POST /api/v1/ops/work_types/:id/versions/:v/rollback | 作成・実行（ops）— 操作と業務の型を上げて版を出す（全社向け／会社向け） | F12 | 契約だけ（501） | K-72 |
| `listOpsWorkspaces` | GET /api/v1/ops/workspaces | 取得（ops）— 各ワークスペースの様子を見る（気にかける） | F12 | 契約だけ（501） |  |
| `getOpsWorkspace` | GET /api/v1/ops/workspaces/:id | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `listOpsWorkspaceAudit` | GET /api/v1/ops/workspaces/:id/audit | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `getOpsWorkspaceBilling` | GET /api/v1/ops/workspaces/:id/billing | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `listOpsWorkspaceInquiries` | GET /api/v1/ops/workspaces/:id/inquiries | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `listOpsWorkspaceMembers` | GET /api/v1/ops/workspaces/:id/members | 取得（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `resendOpsVerification` | POST /api/v1/ops/workspaces/:id/members/:mid/resend-verification | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `sendWorkspaceNotice` | POST /api/v1/ops/workspaces/:id/notices | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `openPeek` | POST /api/v1/ops/workspaces/:id/peeks | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `changeOpsWorkspacePlan` | POST /api/v1/ops/workspaces/:id/plan | 作成・実行（ops）— ワークスペースの 1 社を扱う（いまの状態・メンバー・プ | F12 | 契約だけ（501） |  |
| `resumeWorkspace` | POST /api/v1/ops/workspaces/:id/resume | 作成・実行（ops）— ワークスペースを止める・再開する（理由・先に知らせる） | F12 | 契約だけ（501） |  |
| `stopWorkspace` | POST /api/v1/ops/workspaces/:id/stop | 作成・実行（ops）— ワークスペースを止める・再開する（理由・先に知らせる） | F12 | 契約だけ（501） |  |
| `exportOpsWorkspaces` | POST /api/v1/ops/workspaces/export | 作成・実行（ops）— 各ワークスペースの様子を見る（気にかける） | F12 | 契約だけ（501） |  |
| `getServiceStatusForMember` | GET /api/v1/service-status | 取得（service-status）— お知らせを見る | F12 | 契約だけ（501） |  |
| `getBilling` | GET /api/v1/workspace/billing | 取得（workspace）— プラン・利用量・請求書を見る | F12 | 契約だけ（501） |  |
| `updateBillingContact` | PATCH /api/v1/workspace/billing-contact | 更新（workspace）— プラン・利用量・請求書を見る | F12 | 契約だけ（501） |  |
| `changePlan` | POST /api/v1/workspace/plan | 作成・実行（workspace）— プラン・利用量・請求書を見る | F12 | 契約だけ（501） |  |
| `listWorkspacePlans` | GET /api/v1/workspace/plans | 取得（workspace）— プラン・利用量・請求書を見る | F12 | 契約だけ（501） |  |
| `getInvitation` | GET /api/v1/auth/invitations/:token | 取得（auth）— 招待を受けて参加する（今のアカウントで別のテナントにも） | F2 | 作った | K-331 |
| `requestInvitationResend` | POST /api/v1/auth/invitations/:token/resend-request | 作成・実行（auth）— 招待を受けて参加する（今のアカウントで別のテナントにも） | F2 | 作った | K-334 |
| `setBridgeBrowser` | POST /api/v1/bridge/browser | 作成・実行（bridge）— 自分の PC をつなぐ | F3 | 作った | K-366 |
| `claimPairingCode` | POST /api/v1/bridge/claim | 作成・実行（bridge）— 自分の PC をつなぐ | F3 | 作った | K-57 |
| `reportCredentialCheck` | POST /api/v1/bridge/credentials/:id/check-result | 作成・実行（bridge）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-355 |
| `resolveCredential` | POST /api/v1/bridge/credentials/resolve | 作成・実行（bridge）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-56,K-354 |
| `listMyDevices` | GET /api/v1/bridge/devices | 取得（bridge）— 自分の PC をつなぐ | F3 | 作った | K-57 |
| `updateMyDevice` | PATCH /api/v1/bridge/devices/:id | 更新（bridge）— 自分の PC をつなぐ | F3 | 作った | K-364 |
| `revokeMyDevice` | DELETE /api/v1/bridge/devices/:id | 削除（bridge）— 自分の PC をつなぐ | F3 | 作った | K-362 |
| `checkMyDeviceBrowser` | POST /api/v1/bridge/devices/:id/browser-check | 作成・実行（bridge）— 自分の PC をつなぐ | F3 | 作った | K-365 |
| `sendHeartbeat` | POST /api/v1/bridge/heartbeat | 作成・実行（bridge）— 自分の PC をつなぐ | F3 | 作った | K-57 |
| `createPairingCode` | POST /api/v1/bridge/pairing-codes | 作成・実行（bridge）— 自分の PC をつなぐ | F3 | 作った | K-57 |
| `downloadBridgeRelease` | GET /api/v1/bridge/releases/:name/file | 取得（bridge）— 自分の PC をつなぐ | F3 | 作った | K-57 |
| `getLatestBridgeRelease` | GET /api/v1/bridge/releases/latest | 取得（bridge）— 自分の PC をつなぐ | F3 | 作った | K-57 |
| `listCredentials` | GET /api/v1/credentials | 取得（credentials）— 預けたログイン情報を名前の順に見る（自分の個人とワークスペース） | F3 | 作った | K-351 |
| `createCredential` | POST /api/v1/credentials | 作成・実行（credentials）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-352 |
| `updateCredential` | PATCH /api/v1/credentials/:id | 更新（credentials）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-56,K-353 |
| `deleteCredential` | DELETE /api/v1/credentials/:id | 削除（credentials）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-56,K-353 |
| `checkCredentialLogin` | POST /api/v1/credentials/:id/login-check | 作成・実行（credentials）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-355 |
| `answerCredentialLoginCheck` | POST /api/v1/credentials/:id/login-check/answer | 作成・実行（credentials）— 設定（ログイン情報・API キー・決まった値）を整える | F3 | 作った | K-355 |
| `createTicket` | POST /api/v1/tickets | 作成・実行（tickets）— 過去のチケットを複製して作る／見本のチケットを試す | F3,F4 | 作った | K-60 |
| `getArtifactVersion` | GET /api/v1/artifact_versions/:id | 取得（artifact_versions）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `createConversation` | POST /api/v1/conversations | 作成・実行（conversations）— 自分の AI と壁打ちしてチケットの案を作る／自分のAIとの会話を分けて始める・一覧から選んで続きを話 | F4 | 作った | K-59 |
| `sendConversationMessage` | POST /api/v1/conversations/:id/messages | 作成・実行（conversations）— 自分の AI と壁打ちしてチケットの案を作る／自分の AI に指示する・相談する（会話・添付・許可・成 | F4,F5 | 契約だけ（501） | K-59 |
| `listMyTicketDrafts` | GET /api/v1/me/ticket-drafts | 取得（me）— チケットを作る（画面で・下書きから） | F4 | 作った | K-60 |
| `saveMyTicketDraft` | POST /api/v1/me/ticket-drafts | 作成・実行（me）— チケットを作る（画面で・下書きから） | F4 | 作った | K-60 |
| `listMembers` | GET /api/v1/members | 取得（members）— 振り分ける（責任者・期限・分類・親）。AI と相談しても | F4 | 契約だけ（501） | K-60 |
| `updateTestSpec` | PATCH /api/v1/test_specs/:id | 更新（test_specs）— テスト仕様を作る（AI の案・抜けの点検・種類と型を確か | F4 | 作った | K-435 |
| `deleteTestSpec` | DELETE /api/v1/test_specs/:id | 削除（test_specs）— テスト仕様を作る（AI の案・抜けの点検・種類と型を確か | F4 | 作った | K-435 |
| `listTicketFields` | GET /api/v1/ticket-fields | 取得（custom_fields）— その種別で出す会社の項目を並びの順に見る（型・必須・説明・選択肢） | F4 | 作った | K-563 |
| `createTicketImport` | POST /api/v1/ticket_imports | 作成・実行（ticket_imports）— チケットを作る（画面で・下書きから） | F4 | 契約だけ（501） | K-59 |
| `getTicketImport` | GET /api/v1/ticket_imports/:id | 取得（ticket_imports）— チケットを作る（画面で・下書きから） | F4 | 契約だけ（501） | K-59 |
| `commitTicketImport` | POST /api/v1/ticket_imports/:id/commit | 作成・実行（ticket_imports）— チケットを作る（画面で・下書きから） | F4 | 契約だけ（501） | K-59 |
| `listTicketKinds` | GET /api/v1/ticket_kinds | 取得（ticket_kinds）— 振り分ける（責任者・期限・分類・親）。AI と相談しても | F4 | 作った | K-60 |
| `makeKindTemplateFromTicket` | POST /api/v1/ticket_kinds/:id/template-from-ticket | 作成・実行（ticket_kinds）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `deleteTicketLink` | DELETE /api/v1/ticket_links/:id | 削除（ticket_links）— 振り分ける（責任者・期限・分類・親）。AI と相談しても | F4 | 作った | K-59,K-441 |
| `listTicketStages` | GET /api/v1/ticket_stages | 取得（ticket_stages）— 振り分ける（責任者・期限・分類・親）。AI と相談しても | F4 | 契約だけ（501） | K-59 |
| `listTickets` | GET /api/v1/tickets | 取得（tickets）— チケットの一覧を見る（自分に関わるもの・すべて・グループ・題名か番号・担当者・段・種別・取引先・完了・期限と開始の範囲・期限切れ・炎・親・期限なし・AI に任せている・自分が承認で絞る・並べる・見せる欄を足す・期限 | F4,F7 | 作った | K-92 |
| `getTicket` | GET /api/v1/tickets/:id | 取得（tickets）— チケットの中身（区画）を書く・直す | F4 | 作った | K-60 |
| `updateTicket` | PATCH /api/v1/tickets/:id | 更新（tickets）— 振り分ける（責任者・期限・分類・親）。AI と相談しても／期限間近・炎・詰まりを片付ける | F4,F6,F7 | 作った | K-387 |
| `applyTicketAgentProposal` | POST /api/v1/tickets/:id/agent-session/apply | 作成・実行（tickets）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `listTicketArtifacts` | GET /api/v1/tickets/:id/artifacts | 取得（tickets）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `createTicketAttachment` | POST /api/v1/tickets/:id/attachments | 作成・実行（tickets）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `updateTicketBody` | PATCH /api/v1/tickets/:id/body | 更新（tickets）— チケットの中身（区画）を書く・直す | F4 | 作った | K-59,K-432 |
| `listChecks` | GET /api/v1/tickets/:id/checks | 取得（tickets）— テスト仕様を作る（AI の案・抜けの点検・種類と型を確か | F4 | 契約だけ（501） | K-59 |
| `previewTicketKindChange` | GET /api/v1/tickets/:id/kind-change-preview | 取得（tickets）— 振り分ける（責任者・期限・分類・親）。AI と相談しても | F4 | 契約だけ（501） | K-59 |
| `listTicketLinks` | GET /api/v1/tickets/:id/links | 取得（ticket_links）— チケットのつながり（関連・派生元）を見る。片方が見えないときは番号だけ。子チケットは meta.children | F4 | 作った | K-59,K-441 |
| `createTicketLink` | POST /api/v1/tickets/:id/links | 作成・実行（tickets）— 振り分ける（責任者・期限・分類・親）。AI と相談しても | F4 | 作った | K-59,K-441 |
| `listTicketReferences` | GET /api/v1/tickets/:id/references | 取得（tickets）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `listTestSpecs` | GET /api/v1/tickets/:id/test-specs | 取得（test_specs）— チケットの確認項目を作った順に見る（文・チェック・出どころ） | F4 | 作った | K-59,K-434 |
| `createTestSpec` | POST /api/v1/tickets/:id/test-specs | 作成・実行（tickets）— テスト仕様を作る（AI の案・抜けの点検・種類と型を確か | F4 | 作った | K-59,K-434 |
| `lintTestSpecs` | POST /api/v1/tickets/:id/test-specs/lint | 作成・実行（tickets）— テスト仕様を作る（AI の案・抜けの点検・種類と型を確か | F4 | 契約だけ（501） | K-59 |
| `suggestTestSpecs` | POST /api/v1/tickets/:id/test-specs/suggest | 作成・実行（tickets）— テスト仕様を作る（AI の案・抜けの点検・種類と型を確か | F4 | 契約だけ（501） | K-59 |
| `listTicketVersions` | GET /api/v1/tickets/:id/versions | 取得（tickets）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `restoreTicketVersion` | POST /api/v1/tickets/:id/versions/:v/restore | 作成・実行（tickets）— チケットの中身（区画）を書く・直す | F4 | 契約だけ（501） | K-59 |
| `listWorkTypeCandidates` | GET /api/v1/tickets/:id/work-type-candidates | 取得（tickets）— 業務の型を選ぶ（候補が 1 つなら自動・複数なら選ぶ） | F4 | 契約だけ（501） | K-59 |
| `bulkUpdateTickets` | POST /api/v1/tickets/bulk | 作成・実行（tickets）— 振り分ける（責任者・期限・分類・親）。AI と相談しても／期限間近・炎・詰まりを片付ける | F4,F7 | 契約だけ（501） | K-59 |
| `getActionRun` | GET /api/v1/action_runs/:id | 取得（action_runs）— AI に任せる | F5 | 作った | K-62 |
| `stopActionRun` | POST /api/v1/action_runs/:id/stop | 作成・実行（action_runs）— AI を止める・承認を取り下げる | F5 | 契約だけ（501） | K-61 |
| `getApproval` | GET /api/v1/approvals/:id | 取得（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 作った | K-161 |
| `approveApproval` | POST /api/v1/approvals/:id/approve | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 作った | K-162 |
| `editApproval` | POST /api/v1/approvals/:id/edit | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 契約だけ（501） | K-61 |
| `returnApproval` | POST /api/v1/approvals/:id/return | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 作った | K-163 |
| `stopApproval` | POST /api/v1/approvals/:id/stop | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止める／AI を止める・承認を取り下げる | F5 | 契約だけ（501） | K-61 |
| `withdrawApproval` | POST /api/v1/approvals/:id/withdraw | 作成・実行（approvals）— AI を止める・承認を取り下げる | F5 | 契約だけ（501） | K-61 |
| `bulkApprove` | POST /api/v1/approvals/bulk | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 契約だけ（501） | K-61 |
| `previewBulkApproval` | POST /api/v1/approvals/bulk/preview | 作成・実行（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 契約だけ（501） | K-61 |
| `listApprovalHistory` | GET /api/v1/approvals/history | 取得（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 契約だけ（501） | K-61 |
| `listApprovalQueue` | GET /api/v1/approvals/queue | 取得（approvals）— 承認する／自分で直す／差し戻す／止める | F5 | 作った | K-161 |
| `getFileForBridge` | GET /api/v1/bridge/files/:ref | 取得（bridge）— AI に任せる | F5 | 契約だけ（501） | K-61 |
| `reportBrowserState` | POST /api/v1/bridge/jobs/:id/browser | 作成・実行（bridge）— AI に任せる | F5 | 契約だけ（501） | K-61 |
| `getJobControl` | GET /api/v1/bridge/jobs/:id/control | 取得（bridge）— AI に任せる | F5 | 作った | K-62 |
| `mirrorConversationEntries` | POST /api/v1/bridge/jobs/:id/conversation-entries | 作成・実行（bridge）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `finishBridgeJob` | POST /api/v1/bridge/jobs/:id/finish | 作成・実行（bridge）— AI に任せる | F5 | 作った | K-62 |
| `reportJobProgress` | POST /api/v1/bridge/jobs/:id/progress | 作成・実行（bridge）— AI に任せる | F5 | 作った | K-62 |
| `callKanameTool` | POST /api/v1/bridge/jobs/:id/tools/:name | 作成・実行（bridge）— AI に任せる | F5 | 作った | K-62 |
| `takeBridgeJob` | POST /api/v1/bridge/jobs/take | 作成・実行（bridge）— AI に任せる | F5 | 作った | K-62 |
| `listMirrorTargets` | GET /api/v1/bridge/mirror-targets | 取得（bridge）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `markHumanCheck` | POST /api/v1/checks/:id/human | 作成・実行（checks）— 承認する／自分で直す／差し戻す／止める | F5 | 契約だけ（501） | K-61 |
| `getMyClone` | GET /api/v1/clones/me | 取得（clones）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `listCloneActivity` | GET /api/v1/clones/me/activity | 取得（clones）— 分身がやったことを見る → チケットへ戻る | F5 | 契約だけ（501） | K-61 |
| `exportCloneActivity` | POST /api/v1/clones/me/activity/export | 作成・実行（clones）— 分身がやったことを見る → チケットへ戻る | F5 | 契約だけ（501） | K-61 |
| `getCloneGrowth` | GET /api/v1/clones/me/growth | 取得（clones）— 分身がやったことを見る → チケットへ戻る | F5 | 契約だけ（501） | K-61 |
| `getCloneNow` | GET /api/v1/clones/me/now | 取得（clones）— 分身がやったことを見る → チケットへ戻る | F5 | 契約だけ（501） | K-61 |
| `listConversationMessages` | GET /api/v1/conversations/:id/messages | 取得（conversations）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `stopConversation` | POST /api/v1/conversations/:id/stop | 作成・実行（conversations）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `streamConversation` | GET /api/v1/conversations/:id/stream | 取得（conversations）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `getTicketAgentSession` | GET /api/v1/tickets/:id/agent-session | 取得（tickets）— 自分の AI に指示する・相談する（会話・添付・許可・成 | F5 | 契約だけ（501） | K-61 |
| `sendTicketAgentMessage` | POST /api/v1/tickets/:id/agent-session/messages | 作成・実行（tickets）— 自分の AI に指示する・相談する（会話・添付・許可・成／自分のAIの許可に答える・許可のモードを選ぶ | F5 | 契約だけ（501） | K-61 |
| `completeTicket` | POST /api/v1/tickets/:id/complete | 作成・実行（tickets）— 完了にする（ナレッジ更新の候補を確定・作らない理由も残す | F5 | 作った | K-165 |
| `delegateTicket` | POST /api/v1/tickets/:id/delegate | 作成・実行（tickets）— AI に任せる | F5 | 作った | K-62 |
| `dryRunTicket` | POST /api/v1/tickets/:id/dry-run | 作成・実行（tickets）— 試し打ちする（宛先を自分に差し替えて確かめる） | F5 | 契約だけ（501） | K-61 |
| `listTicketRuns` | GET /api/v1/tickets/:id/runs | 取得（tickets）— AI に任せる | F5 | 作った | K-62 |
| `updateTicketDecision` | PATCH /api/v1/ticket_decisions/:id | 更新（ticket_decisions）— 決定を記録する（AI の候補を確定・直接書く） | F6 | 作った | K-391 |
| `updateTicketMessage` | PATCH /api/v1/ticket_messages/:id | 更新（ticket_messages）— チケットのスレッドで話す（@ で知らせる） | F6 | 作った | K-386 |
| `deleteTicketMessage` | DELETE /api/v1/ticket_messages/:id | 削除（ticket_messages）— チケットのスレッドで話す（@ で知らせる） | F6 | 作った | K-386 |
| `starTicketMessage` | POST /api/v1/ticket_messages/:id/star | 作成・実行（ticket_messages）— チケットのスレッドで話す（@ で知らせる） | F6 | 作った | K-386 |
| `listTicketDecisions` | GET /api/v1/tickets/:id/decisions | 取得（ticket_decisions）— チケットの決定を見る（生きている決定・改められた・取り消した） | F6 | 作った | K-390 |
| `createTicketDecision` | POST /api/v1/tickets/:id/decisions | 作成・実行（tickets）— 決定を記録する（AI の候補を確定・直接書く） | F6 | 作った | K-390 |
| `createTicketMessage` | POST /api/v1/tickets/:id/messages | 作成・実行（tickets）— チケットのスレッドで話す（@ で知らせる） | F6 | 作った | K-385 |
| `listTicketTimeline` | GET /api/v1/tickets/:id/timeline | 取得（ticket_messages）— やり取りを新しい方から読む（前を見る・すべて／話だけ／自分あて・新しい数・候補の人） | F6 | 作った | K-383 |
| `markTicketTimelineSeen` | POST /api/v1/tickets/:id/timeline/seen | 作成・実行（tickets）— チケットのスレッドで話す（@ で知らせる） | F6 | 作った | K-384 |
| `takeoverActionRun` | POST /api/v1/action_runs/:id/takeover | 作成・実行（action_runs）— 止まった理由を見て一手を打つ（PC が閉じている・壊れた | F7 | 作った | K-67,K-485 |
| `listNotifications` | GET /api/v1/notifications | 取得（notifications）— 自分宛ての知らせを新しい順に見る（未読だけ・人で絞る・20 件ずつ・読んだものは 30 日分） | F7 | 作った | K-461 |
| `readNotification` | PATCH /api/v1/notifications/:id | 更新（notifications）— 知らせを見てチケットへ行く | F7 | 契約だけ（501） | K-67 |
| `readAllNotifications` | POST /api/v1/notifications/read-all | 作成・実行（notifications）— 知らせを見てチケットへ行く | F7 | 契約だけ（501） | K-67 |
| `listSavedViews` | GET /api/v1/saved_views | 取得（saved_views）— 保存した検索条件を名前の順に開く（自分の物と、見えるグループの全員向けの物） | F7 | 作った | K-67,K-475 |
| `createSavedView` | POST /api/v1/saved_views | 作成・実行（saved_views）— 見え方を切り替える（一覧と詳細・カレンダー・ガント） | F7 | 作った | K-67,K-475 |
| `updateSavedView` | PATCH /api/v1/saved_views/:id | 更新（saved_views）— 見え方を切り替える（一覧と詳細・カレンダー・ガント） | F7 | 契約だけ（501） | K-67 |
| `deleteSavedView` | DELETE /api/v1/saved_views/:id | 削除（saved_views）— 見え方を切り替える（一覧と詳細・カレンダー・ガント） | F7 | 契約だけ（501） | K-67 |
| `getScopeOverview` | GET /api/v1/scopes/:id/overview | 取得（scopes）— 見え方を切り替える（一覧と詳細・カレンダー・ガント） | F7 | 作った | K-67,K-477 |
| `search` | GET /api/v1/search | 取得（search）— 探す（チケット・決定・自分の会話・ナレッジのページ）。種類ごとに上位の分だけ。総数・続きは返さない | F7 | 作った | K-67,K-468 |
| `getShell` | GET /api/v1/shell | 取得（shell）— 見え方を切り替える（一覧と詳細・カレンダー・ガント） | F7 | 契約だけ（501） | K-67 |
| `deleteTicket` | DELETE /api/v1/tickets/:id | 削除（tickets）— チケットを消す・アーカイブする（子孫の扱いを決める） | F7 | 作った | K-67,K-488 |
| `previewTicketDelete` | GET /api/v1/tickets/:id/delete-preview | 取得（tickets）— チケットを消す・アーカイブする（子孫の扱いを決める） | F7 | 作った | K-67,K-487 |
| `restoreTicket` | POST /api/v1/tickets/:id/restore | 作成・実行（tickets）— チケットを消す・アーカイブする（子孫の扱いを決める） | F7 | 契約だけ（501） | K-67 |
| `listHandoverRules` | GET /api/v1/handover_rules | 取得（handover_rules）— 渡されたものを受ける／断る（理由） | F8 | 契約だけ（501） | K-68 |
| `answerTicketHandover` | PATCH /api/v1/ticket_handovers/:id | 更新（ticket_handovers）— 渡されたものを受ける／断る（理由） | F8 | 契約だけ（501） | K-68 |
| `createTicketHandover` | POST /api/v1/tickets/:id/handovers | 作成・実行（tickets）— 上から配る（人・グループへ）／上へ上げる（判断を仰ぐ・上位の承認を求める・詰まりを上げ | F8 | 契約だけ（501） | K-68 |
| `countKnows` | GET /api/v1/clones/me/knows/counts | 取得（clones）— 自分の AI に教える（覚えて） | F9 | 契約だけ（501） | K-69 |
| `askKnowledge` | POST /api/v1/knowledge/ask | 作成・実行（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `sendKnowledgeAnswerFeedback` | POST /api/v1/knowledge/ask/feedback | 作成・実行（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `getKnowledgeHome` | GET /api/v1/knowledge/home | 取得（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `searchKnowledgeLinkTargets` | GET /api/v1/knowledge/link-targets | 取得（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `listKnowledgeProposals` | GET /api/v1/knowledge/proposals | 取得（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `acceptKnowledgeProposal` | POST /api/v1/knowledge/proposals/:id/accept | 作成・実行（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `declineKnowledgeProposal` | POST /api/v1/knowledge/proposals/:id/decline | 作成・実行（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `getKnowledgeTree` | GET /api/v1/knowledge/tree | 取得（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `listKnowledgeVerifications` | GET /api/v1/knowledge/verifications | 取得（knowledge）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `createKnowledgeImport` | POST /api/v1/knowledge_imports | 作成・実行（knowledge_imports）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `getKnowledgeImport` | GET /api/v1/knowledge_imports/:id | 取得（knowledge_imports）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `commitKnowledgeImport` | POST /api/v1/knowledge_imports/:id/commit | 作成・実行（knowledge_imports）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `listKnowledgePages` | GET /api/v1/knowledge_pages | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `createKnowledgePage` | POST /api/v1/knowledge_pages | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `getKnowledgePage` | GET /api/v1/knowledge_pages/:id | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `updateKnowledgePage` | PATCH /api/v1/knowledge_pages/:id | 更新（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `archiveKnowledgePage` | POST /api/v1/knowledge_pages/:id/archive | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `uploadKnowledgeAttachment` | POST /api/v1/knowledge_pages/:id/attachments | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `saveKnowledgeDraft` | PATCH /api/v1/knowledge_pages/:id/draft | 更新（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `discardKnowledgeDraft` | DELETE /api/v1/knowledge_pages/:id/draft | 削除（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `getKnowledgeLinks` | GET /api/v1/knowledge_pages/:id/links | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `linkKnowledgeMention` | POST /api/v1/knowledge_pages/:id/links | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `exportKnowledgeMarkdown` | GET /api/v1/knowledge_pages/:id/markdown | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `listKnowledgeMessages` | GET /api/v1/knowledge_pages/:id/messages | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `postKnowledgeMessage` | POST /api/v1/knowledge_pages/:id/messages | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `publishKnowledgePage` | POST /api/v1/knowledge_pages/:id/publish | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `unarchiveKnowledgePage` | POST /api/v1/knowledge_pages/:id/unarchive | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `getKnowledgeUsage` | GET /api/v1/knowledge_pages/:id/usage | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `verifyKnowledgePage` | POST /api/v1/knowledge_pages/:id/verify | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `listKnowledgeVersions` | GET /api/v1/knowledge_pages/:id/versions | 取得（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `restoreKnowledgeVersion` | POST /api/v1/knowledge_pages/:id/versions/:v/restore | 作成・実行（knowledge_pages）— ナレッジのページを書く・直す | F9 | 契約だけ（501） |  |
| `createLayer` | POST /api/v1/layers | 作成・実行（layers）— グループを作る・直す（メンバーの中） | F9 | 契約だけ（501） |  |
| `updateLayer` | PATCH /api/v1/layers/:id | 更新（layers）— グループを作る・直す（メンバーの中） | F9 | 契約だけ（501） |  |
| `listLearningCandidates` | GET /api/v1/learning_candidates | 取得（learning_candidates）— 自分の AI に教える（覚えて）／上がってきた記憶と食い違いを確かめる | F9 | 契約だけ（501） | K-69 |
| `acceptLearningCandidate` | POST /api/v1/learning_candidates/:id/accept | 作成・実行（learning_candidates）— 自分の AI に教える（覚えて）／上がってきた記憶と食い違いを確かめる | F9 | 契約だけ（501） | K-69 |
| `dismissLearningCandidate` | POST /api/v1/learning_candidates/:id/dismiss | 作成・実行（learning_candidates）— 自分の AI に教える（覚えて）／上がってきた記憶と食い違いを確かめる | F9 | 契約だけ（501） | K-69 |
| `requestRuleException` | POST /api/v1/learning_candidates/:id/exception-request | 作成・実行（learning_candidates）— ルールを置く（会社・層・個人・取引先） | F9 | 契約だけ（501） | K-69 |
| `postponeLearningCandidate` | POST /api/v1/learning_candidates/:id/later | 作成・実行（learning_candidates）— 自分の AI に教える（覚えて） | F9 | 契約だけ（501） | K-69 |
| `listMemories` | GET /api/v1/memories | 取得（memories）— 自分の AI に教える（覚えて） | F9 | 契約だけ（501） | K-69 |
| `createMemory` | POST /api/v1/memories | 作成・実行（memories）— 自分の AI に教える（覚えて） | F9 | 作った | K-69 |
| `updateMemory` | PATCH /api/v1/memories/:id | 更新（memories）— 自分の AI に教える（覚えて） | F9 | 作った | K-69 |
| `deleteMemory` | DELETE /api/v1/memories/:id | 削除（memories）— 自分の AI に教える（覚えて） | F9 | 契約だけ（501） | K-69 |
| `promoteMemoryToRule` | POST /api/v1/memories/:id/promote | 作成・実行（memories）— ルールを置く（会社・層・個人・取引先）／自分の AI に教える（覚えて） | F9 | 契約だけ（501） | K-69 |
| `getRule` | GET /api/v1/rules/:id | 取得（rules）— ルールを置く（会社・層・個人・取引先） | F9 | 契約だけ（501） |  |
| `updateRule` | PATCH /api/v1/rules/:id | 更新（rules）— ルールを置く（会社・層・個人・取引先） | F9 | 契約だけ（501） |  |
| `deleteRule` | DELETE /api/v1/rules/:id | 削除（rules）— ルールを置く（会社・層・個人・取引先） | F9 | 契約だけ（501） |  |
| `checkRule` | POST /api/v1/rules/check | 作成・実行（rules）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ／ルールを置く（会社・層・個人・取引先） | F9 | 契約だけ（501） | K-69 |
| `listScopes` | GET /api/v1/scopes | 取得（scopes）— グループを作る・直す（メンバーの中） | F9 | 作った | K-60 |
| `createScope` | POST /api/v1/scopes | 作成・実行（scopes）— グループを作る・直す（メンバーの中） | F9 | 契約だけ（501） |  |
| `updateScope` | PATCH /api/v1/scopes/:id | 更新（scopes）— グループを作る・直す（メンバーの中） | F9 | 契約だけ（501） |  |
| `listKindTemplateUpdates` | GET /api/v1/ticket_kinds/template-updates | 取得（ticket_kinds）— ひな形の新しい版を取り込む | F9 | 契約だけ（501） |  |
| `applyKindTemplateUpdate` | POST /api/v1/ticket_kinds/template-updates/:id/apply | 作成・実行（ticket_kinds）— ひな形の新しい版を取り込む | F9 | 契約だけ（501） |  |
| `listWorkTypes` | GET /api/v1/work_types | 取得（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `createWorkType` | POST /api/v1/work_types | 作成・実行（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `getWorkType` | GET /api/v1/work_types/:id | 取得（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `copyWorkType` | POST /api/v1/work_types/:id/copy | 作成・実行（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `updateWorkTypeDraft` | PATCH /api/v1/work_types/:id/draft | 更新（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `releaseWorkType` | POST /api/v1/work_types/:id/release | 作成・実行（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `requestWorkTypeSpread` | POST /api/v1/work_types/:id/spread-requests | 作成・実行（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `tryWorkType` | POST /api/v1/work_types/:id/try | 作成・実行（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `listWorkTypeVersions` | GET /api/v1/work_types/:id/versions | 取得（work_types）— 業務の型を作る・広げる | F9 | 契約だけ（501） |  |
| `createEscalationRule` | POST /api/v1/workspace/escalation-rules | 作成・実行（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `updateEscalationRule` | PATCH /api/v1/workspace/escalation-rules/:id | 更新（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `deleteEscalationRule` | DELETE /api/v1/workspace/escalation-rules/:id | 削除（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `previewEscalationRule` | POST /api/v1/workspace/escalation-rules/preview | 作成・実行（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `getWorkspaceRules` | GET /api/v1/workspace/rules | 取得（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `createWorkspaceRule` | POST /api/v1/workspace/rules | 作成・実行（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `updateWorkspaceRule` | PATCH /api/v1/workspace/rules/:id | 更新（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `deleteWorkspaceRule` | DELETE /api/v1/workspace/rules/:id | 削除（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `getTicketShape` | GET /api/v1/workspace/ticket-shape | 取得（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `saveTicketShape` | PATCH /api/v1/workspace/ticket-shape | 更新（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `previewTicketShapeChange` | POST /api/v1/workspace/ticket-shape/preview | 作成・実行（workspace）— 決まりを整える（守ること・承認を回すとき・やり方・チケッ | F9 | 契約だけ（501） |  |
| `restoreArtifactVersion` | POST /api/v1/artifact_versions/:id/restore | 作成・実行（artifact_versions）— 自分のAIの返事を成果物に書き出し、会話の横で開いて直す | （後のフェーズ） | 契約だけ（501） | K-73 |
| `updateArtifact` | PATCH /api/v1/artifacts/:id | 更新（artifacts）— 自分のAIの返事を成果物に書き出し、会話の横で開いて直す | （後のフェーズ） | 契約だけ（501） | K-73 |
| `putArtifactFromBridge` | POST /api/v1/bridge/jobs/:id/artifacts | 作成・実行（bridge）— 自分のAIの返事を成果物に書き出し、会話の横で開いて直す | （後のフェーズ） | 契約だけ（501） | K-73 |
| `askFromBridge` | POST /api/v1/bridge/jobs/:id/questions | 作成・実行（bridge）— 自分のAIの許可に答える・許可のモードを選ぶ | （後のフェーズ） | 契約だけ（501） | K-73 |
| `getBridgeQuestionAnswer` | GET /api/v1/bridge/jobs/:id/questions/:qid | 取得（bridge）— 自分のAIの許可に答える・許可のモードを選ぶ | （後のフェーズ） | 契約だけ（501） | K-73 |
| `reportUsage` | POST /api/v1/bridge/usage | 作成・実行（bridge）— 自分のAIの使用量（サブスクの 5 時間の枠・週の枠とい | （後のフェーズ） | 契約だけ（501） | K-73 |
| `updateMyClone` | PATCH /api/v1/clones/me | 更新（clones）— 自分のAIの許可に答える・許可のモードを選ぶ | （後のフェーズ） | 契約だけ（501） | K-73 |
| `listConversations` | GET /api/v1/conversations | 取得（conversations）— 自分のAIとの会話を分けて始める・一覧から選んで続きを話 | （後のフェーズ） | 契約だけ（501） | K-73 |
| `getConversation` | GET /api/v1/conversations/:id | 取得（conversations）— 自分のAIとの会話を分けて始める・一覧から選んで続きを話 | （後のフェーズ） | 契約だけ（501） | K-73 |
| `updateConversation` | PATCH /api/v1/conversations/:id | 更新（conversations）— 自分のAIとの会話を分けて始める・一覧から選んで続きを話 | （後のフェーズ） | 作った | K-73 |
| `deleteConversation` | DELETE /api/v1/conversations/:id | 削除（conversations）— 自分のAIとの会話を分けて始める・一覧から選んで続きを話 | （後のフェーズ） | 作った | K-73 |
| `createConversationAttachment` | POST /api/v1/conversations/:id/attachments | 作成・実行（conversations）— 資料や画像を付けて自分のAIに渡す | （後のフェーズ） | 契約だけ（501） | K-73 |
| `answerAgentPermission` | POST /api/v1/conversations/:id/permissions/:pid | 作成・実行（conversations）— 自分のAIの許可に答える・許可のモードを選ぶ | （後のフェーズ） | 契約だけ（501） | K-73 |
| `regenerateBackupCodes` | POST /api/v1/me/backup-codes | 作成・実行（me）— 2段階認証を設定する | （後のフェーズ） | 契約だけ（501） | K-73 |
| `disableTwoFactor` | DELETE /api/v1/me/two-factor | 削除（me）— 2段階認証を設定する | （後のフェーズ） | 契約だけ（501） | K-73 |
| `confirmTwoFactor` | POST /api/v1/me/two-factor/confirm | 作成・実行（me）— 2段階認証を設定する | （後のフェーズ） | 作った | K-311 |
| `startTwoFactor` | POST /api/v1/me/two-factor/enable | 作成・実行（me）— 2段階認証を設定する | （後のフェーズ） | 作った | K-311 |
| `getMyUsage` | GET /api/v1/me/usage | 取得（me）— 自分のAIの使用量（サブスクの 5 時間の枠・週の枠とい | （後のフェーズ） | 契約だけ（501） | K-73 |
| `resetMemberTwoFactor` | POST /api/v1/members/:id/two-factor/reset | 作成・実行（members）— 2段階認証を設定する | （後のフェーズ） | 契約だけ（501） | K-73 |
| `createArtifactFromMessage` | POST /api/v1/messages/:id/artifacts | 作成・実行（messages）— 自分のAIの返事を成果物に書き出し、会話の横で開いて直す | （後のフェーズ） | 契約だけ（501） | K-73 |

## 前の道すじ（契約の外・apps/api/src/auth/ext.ts）

- `/agent/answer`
- `/agent/bridge-revoke`
- `/agent/browser`
- `/agent/browser-check`
- `/agent/new`
- `/agent/resume`
- `/agent/say`
- `/agent/state`
- `/bridge/answer`
- `/bridge/ask`
- `/bridge/browser`
- `/bridge/code`
- `/bridge/credentials/check-result`
- `/bridge/credentials/resolve`
- `/bridge/state`
- `/me`
- `/onboard/draft`
- `/onboard/golive`
- `/onboard/golive/pause`
- `/onboard/testrun`
- `/onboard/testrun/cancel`
- `/setup-state`
- `/setup-step`
- `/vault/credentials`
- `/vault/credentials/:id/answer`
- `/vault/credentials/:id/login-check`

## 設定の項目（値は載せない）

| 名前 | 説明 |
|---|---|
| `NODE_ENV` | 正本（G13 ci:env-audit が packages/config の読む名前と突き合わせる）。値は例。秘密は Infisical の環境から入れる（この例の値を本番で使わない） |
| `PORT` | 正本（G13 ci:env-audit が packages/config の読む名前と突き合わせる）。値は例。秘密は Infisical の環境から入れる（この例の値を本番で使わない） |
| `BASE_URL` | 正本（G13 ci:env-audit が packages/config の読む名前と突き合わせる）。値は例。秘密は Infisical の環境から入れる（この例の値を本番で使わない） |
| `WEB_BASE_URL` | 画面の URL（メールのリンクの先）。ローカルは next dev |
| `DATABASE_URL` | DB（関門 C2）。管理者の接続は migration だけに使う。実行時は kaname_app |
| `DATABASE_LISTEN_URL` | Transaction pooler（6543）は不可。空なら画面は今までどおり 1.2 秒ごとに見に行く |
| `DATABASE_ADMIN_URL` | migration だけが使う管理者の接続（staging／本番。ローカルは無くてよい＝DATABASE_URL を使う） |
| `KANAME_APP_DB_PASSWORD` | 実行ロールのパスワード。入っていれば migrate が役割に入れる（migration の直書き値は開発の既定） |
| `KANAME_AUTH_DB_PASSWORD` | 実行ロールのパスワード。入っていれば migrate が役割に入れる（migration の直書き値は開発の既定） |
| `AUTH_DATABASE_URL` | 認証（Better Auth・schema auth・境界 B2） |
| `AUTH_SECRET` | 認証（Better Auth・schema auth・境界 B2） |
| `STORAGE_ENDPOINT` | ストレージ（S3 互換 API だけ。supabase-js の storage クライアントは使わない） |
| `STORAGE_REGION` | ストレージ（S3 互換 API だけ。supabase-js の storage クライアントは使わない） |
| `STORAGE_BUCKET` | ストレージ（S3 互換 API だけ。supabase-js の storage クライアントは使わない） |
| `STORAGE_ACCESS_KEY_ID` | ストレージ（S3 互換 API だけ。supabase-js の storage クライアントは使わない） |
| `STORAGE_SECRET_ACCESS_KEY` | ストレージ（S3 互換 API だけ。supabase-js の storage クライアントは使わない） |
| `STORAGE_FORCE_PATH_STYLE` | ストレージ（S3 互換 API だけ。supabase-js の storage クライアントは使わない） |
| `SECRETS_MASTER_KEY` | 秘密（関門 C8）。base64 で 32 バイト以上 |
| `INFISICAL_SITE_URL` | 値は Infisical の Machine Identity（Universal Auth）。Vercel の環境変数（Sensitive）にだけ入れる。地域が EU なら https://eu.infisical.com |
| `INFISICAL_CLIENT_ID` | 値は Infisical の Machine Identity（Universal Auth）。Vercel の環境変数（Sensitive）にだけ入れる。地域が EU なら https://eu.infisical.com |
| `INFISICAL_CLIENT_SECRET` | 値は Infisical の Machine Identity（Universal Auth）。Vercel の環境変数（Sensitive）にだけ入れる。地域が EU なら https://eu.infisical.com |
| `INFISICAL_PROJECT_ID` | 値は Infisical の Machine Identity（Universal Auth）。Vercel の環境変数（Sensitive）にだけ入れる。地域が EU なら https://eu.infisical.com |
| `INFISICAL_ENVIRONMENT` | 値は Infisical の Machine Identity（Universal Auth）。Vercel の環境変数（Sensitive）にだけ入れる。地域が EU なら https://eu.infisical.com |
| `RESEND_API_KEY` | 通知（関門 C6・Resend）。無ければメールは送らない（inapp だけ） |
| `MAIL_FROM` | メールの差出人（Resend で検証した送信ドメイン）。engine-base.com は 2026-09-20 に検証済み |
| `OPS_EMAIL` | 運営（ENGINE BASE）の連絡先。問い合わせの届け先・運営アカウントのログイン名 |
| `MAIL_REPLY_TO` | 返信したときの宛先（D-096.5）。差出人は noreply、返信は問い合わせの窓口へ |
| `OPERATOR_COMPANY` | 運営者の情報（D-096）。メールの署名・画面・特商法表記が同じ値を読む。電話はメールに載せない・住所はまだ持たない |
| `OPERATOR_REPRESENTATIVE` | 運営者の情報（D-096）。メールの署名・画面・特商法表記が同じ値を読む。電話はメールに載せない・住所はまだ持たない |
| `OPERATOR_PHONE` | 運営者の情報（D-096）。メールの署名・画面・特商法表記が同じ値を読む。電話はメールに載せない・住所はまだ持たない |
| `OPERATOR_ADDRESS` | 運営者の情報（D-096）。メールの署名・画面・特商法表記が同じ値を読む。電話はメールに載せない・住所はまだ持たない |
| `LEGAL_COURT` | 既定は無い（事実と違う名前を出さない）。空のままだと文面のページは「文面を準備しています」を出す。本番の値は K-85・K-86 で決める |
| `LEGAL_HOSTING_PROVIDER` | 既定は無い（事実と違う名前を出さない）。空のままだと文面のページは「文面を準備しています」を出す。本番の値は K-85・K-86 で決める |
| `LEGAL_MAIL_PROVIDER` | 既定は無い（事実と違う名前を出さない）。空のままだと文面のページは「文面を準備しています」を出す。本番の値は K-85・K-86 で決める |
| `LEGAL_SECRETS_PROVIDER` | 既定は無い（事実と違う名前を出さない）。空のままだと文面のページは「文面を準備しています」を出す。本番の値は K-85・K-86 で決める |
| `LEGAL_STORAGE_PROVIDER` | 既定は無い（事実と違う名前を出さない）。空のままだと文面のページは「文面を準備しています」を出す。本番の値は K-85・K-86 で決める |
| `MAIL_SUPPRESS_PREFIX` | staging／本番では空のまま（必ず送る） |
| `BRIDGE_RELEASE_DIR` | 作った Bridge のインストーラを手元のフォルダから配る（開発だけ。staging／本番は空にして BRIDGE_RELEASE_BASE の置き場から配る） |
| `BRIDGE_RELEASE_BASE` | 空＝まだ配布していない（画面は「まだ配布していません」と言い、自動更新も見に行かない） |
| `KANAME_EDGE_SECRET` | 画面と口の両方のプロジェクトに同じ値をサーバーだけの環境変数で入れる（NEXT_PUBLIC にしない）。空なら写した頭を消すだけ。値は K-263 で入れる |
| `KANAME_EDGE_ECHO` | 確かめの口 GET /api/edge/echo を開く（1 で開く）。staging の確かめ（scripts/ci/staging_edge_check.py）の間だけ。本番には入れない |

## 使っている部品

| 部品 | 何に使うか |
|---|---|
| `@base-ui/react` | 画面の部品の土台（動き・読み上げ） |
| `@aws-sdk/client-s3` | ファイルの置き場（S3 互換） |
| `@aws-sdk/s3-request-presigner` | 外の置き場（Bridge の配布物）の期限つき URL を置き場の仕組み（S3 の署名つき URL・SigV4）で作る（関門 C4・D-128.160） |
| `@better-auth/utils` | ログインの部品の中の道具 |
| `@better-auth/passkey` | パスキーで入る（ログインの部品のパスキー。中で @simplewebauthn/server・K-304・D-128.91） |
| `@simplewebauthn/browser` | パスキーを足す・パスキーで本人確認を取り直す画面の端末の手順（startRegistration・startAuthentication。部品 @better-auth/passkey の中と同じ版・チャレンジを頭で受け渡すため部品の addPasskey を使わない・K-318） |
| `@simplewebauthn/server` | パスキーの応答の確かめ（署名の回数が戻ったときに、ほかが正しいかを部品と同じ道具で見る・K-304。部品 @better-auth/passkey の中と同じ版） |
| `@eslint/js` | 書き方の検査（G1） |
| `@fontsource-variable/noto-sans-jp` | 記録にある名前のまま |
| `@hono/node-server` | API を Node で動かす |
| `@hookform/resolvers` | 入力の形を Zod で確かめる |
| `@playwright/mcp` | 記録にある名前のまま |
| `@playwright/test` | 実ブラウザの試験 |
| `@svar-ui/react-gantt` | 記録にある名前のまま |
| `@tailwindcss/postcss` | Tailwind を Next.js に入れる |
| `@tanstack/react-query` | 画面が API から読んだ物の置き場 |
| `@vitest/coverage-v8` | 単体試験の網羅率 |
| `better-auth` | ログイン |
| `class-variance-authority` | 部品の見せ方の組み合わせ（shadcn の土台） |
| `clsx` | クラス名をつなぐ（shadcn の土台） |
| `cmdk` | 記録にある名前のまま |
| `electron` | 記録にある名前のまま |
| `electron-builder` | Bridge の配布物を作る |
| `electron-updater` | Bridge の自動更新 |
| `esbuild` | API を 1 つにまとめる（Vercel に置く） |
| `eslint` | 書き方の検査（G1） |
| `hono` | 記録にある名前のまま |
| `kysely` | ログインの部品が DB を読む（Better Auth の決まり） |
| `lucide-react` | 記録にある名前のまま |
| `mermaid` | 記録にある名前のまま |
| `next` | 記録にある名前のまま |
| `pg` | 記録にある名前のまま |
| `prettier` | 書式をそろえる（G1） |
| `qrcode` | 2 段階の確かめの QR コード |
| `react` | 記録にある名前のまま |
| `react-dom` | 画面の土台（React） |
| `react-hook-form` | 入力の形 |
| `react-markdown` | 記録にある名前のまま |
| `rehype-raw` | 会話の書式（HTML を読む） |
| `rehype-sanitize` | 会話の書式（危ない HTML を消す） |
| `remark-cjk-friendly` | 会話の書式（日本語の強調） |
| `remark-gfm` | 記録にある名前のまま |
| `remark-math` | 会話の書式（数式） |
| `resend` | 記録にある名前のまま |
| `shiki` | 記録にある名前のまま |
| `sonner` | 記録にある名前のまま |
| `squawk-cli` | migration の lint（変えた・足した migration だけ・G58・K-107） |
| `tailwind-merge` | Tailwind のクラスの重なりを解く（shadcn の土台） |
| `tailwindcss` | 見た目（CSS） |
| `temml` | 数式を MathML にする |
| `tsx` | TypeScript をそのまま動かす（CLI・試験） |
| `typescript` | 記録にある名前のまま |
| `typescript-eslint` | 書き方の検査（G1） |
| `ua-parser-js` | 記録にある名前のまま |
| `vitest` | 記録にある名前のまま |
| `zod` | 記録にある名前のまま |
