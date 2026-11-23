"""第1フェーズの画面 → API（D-128.78）。キャンバスの画面 1 枚ずつ「何を読み・何を押すか」から逆に出したもの。
人が読む表は 08_api/phase1/*.md。ここはその機械用の写し（build_functional.py が読み、build_api.py が API にする）。
ここに無い画面は、今までどおり行為の言葉からの推測（build_functional.py の api_for_act）で出る。

1 行 = (method, path, 行為（複数は | で区切る）, 答えの表, operationId, 一緒に読み書きする表)
  path は /api の下。変数は :id（その表の行）・:key・:v など。番号（EG-128）でも引ける所は :id のまま（説明に書く）
"""

T = "tickets"
SCREEN_API = {
    # ---------------------------------------------------------------- チケット（08_api/phase1/01_チケット.md）
    "tickets": [
        # 一覧・数・探す
        ("GET", "/tickets", "A58|A113|A99", T, "listTickets", ["ticket_kinds", "ticket_stages", "members", "clients"]),
        ("GET", "/scopes/:id/overview", "A58", T, "getScopeOverview", ["scopes", "ticket_stages"]),
        # 外枠の役と今いる会社の名前（K-253・D-144.2）。今は手で書いた道すじ GET /api/auth-ext/me が答え、移す先がこの getMe（D-128.88・持ち主 K-70）
        ("GET", "/me", "A74", "members", "getMe", ["tenant_memberships", "tenants"]),
        ("GET", "/search", "A21", T, "search", ["knowledge_pages", "ticket_decisions", "conversations"]),
        # 1 件を開く・作る・直す・消す
        ("GET", "/tickets/:id", "A101", T, "getTicket", ["ticket_sections", "test_specs", "ticket_links", "clients"]),
        ("POST", "/tickets", "A99|A98|A129", T, "createTicket", ["ticket_sections", "test_specs", "conversations"]),
        ("PATCH", "/tickets/:id", "A103|A17|A115|A113", T, "updateTicket", ["ticket_class_values", "ticket_messages"]),
        ("GET", "/tickets/:id/kind-change-preview", "A103", T, "previewTicketKindChange", ["kind_sections", "ticket_sections"]),
        ("GET", "/tickets/:id/work-type-candidates", "A130", "skills", "listWorkTypeCandidates", ["skill_versions"]),
        ("GET", "/tickets/:id/delete-preview", "A116", T, "previewTicketDelete", ["attachments", "artifacts"]),
        ("DELETE", "/tickets/:id", "A116", T, "deleteTicket", ["audit_events"]),
        ("POST", "/tickets/:id/restore", "A116", T, "restoreTicket", ["audit_events"]),
        ("POST", "/tickets/:id/complete", "A106", T, "completeTicket", ["knowledge_pages", "ticket_decisions"]),
        ("POST", "/tickets/bulk", "A103|A113", T, "bulkUpdateTickets", ["ticket_messages"]),
        # 書きかけの下書き（D-128.138：サーバーに残し、どの端末でも続きが書ける。作った本人のワークスペースごと）
        ("GET", "/me/ticket-drafts", "A99", "tenant_memberships", "listMyTicketDrafts", []),
        ("POST", "/me/ticket-drafts", "A99", "tenant_memberships", "saveMyTicketDraft", []),
        ("POST", "/ticket_imports", "A99", "ticket_imports", "createTicketImport", []),
        ("GET", "/ticket_imports/:id", "A99", "ticket_imports", "getTicketImport", []),
        ("POST", "/ticket_imports/:id/commit", "A99", "ticket_imports", "commitTicketImport", [T]),
        # 本文（1 枚の文書）と版
        ("PATCH", "/tickets/:id/body", "A101", "ticket_sections", "updateTicketBody", ["ticket_section_versions"]),
        ("GET", "/tickets/:id/versions", "A101", "ticket_section_versions", "listTicketVersions", []),
        ("POST", "/tickets/:id/versions/:v/restore", "A101", "ticket_section_versions", "restoreTicketVersion", ["ticket_sections"]),
        ("POST", "/ticket_kinds/:id/template-from-ticket", "A101", "kind_sections", "makeKindTemplateFromTicket", [T]),
        # テスト仕様と確認
        ("GET", "/tickets/:id/test-specs", "A102", "test_specs", "listTestSpecs", []),
        ("POST", "/tickets/:id/test-specs", "A102", "test_specs", "createTestSpec", []),
        ("PATCH", "/test_specs/:id", "A102", "test_specs", "updateTestSpec", []),
        ("DELETE", "/test_specs/:id", "A102", "test_specs", "deleteTestSpec", []),
        ("POST", "/tickets/:id/test-specs/suggest", "A102", "test_specs", "suggestTestSpecs", ["action_runs"]),
        ("POST", "/tickets/:id/test-specs/lint", "A102", "test_specs", "lintTestSpecs", []),
        ("GET", "/tickets/:id/checks", "A102", "checks", "listChecks", ["test_specs", "artifact_versions"]),
        ("POST", "/checks/:id/human", "A15", "checks", "markHumanCheck", []),
        # 分身に任せる・実行
        ("POST", "/tickets/:id/delegate", "A104", "action_runs", "delegateTicket", ["approvals"]),
        ("POST", "/tickets/:id/dry-run", "A105", "action_runs", "dryRunTicket", []),
        ("GET", "/tickets/:id/runs", "A104", "action_runs", "listTicketRuns", []),
        ("GET", "/action_runs/:id", "A104", "action_runs", "getActionRun", ["reference_logs"]),
        ("POST", "/action_runs/:id/stop", "A89", "action_runs", "stopActionRun", []),
        ("GET", "/tickets/:id/references", "A101", "reference_logs", "listTicketReferences", []),
        ("GET", "/tickets/:id/agent-session", "A20", "conversations", "getTicketAgentSession", ["messages"]),
        ("POST", "/tickets/:id/agent-session/messages", "A20|A91", "messages", "sendTicketAgentMessage", ["conversations", "action_runs"]),
        ("POST", "/tickets/:id/agent-session/apply", "A101", "ticket_sections", "applyTicketAgentProposal", ["ticket_section_versions", "checks"]),
        # やり取り・決定・渡す
        ("GET", "/tickets/:id/timeline", "A107", "ticket_messages", "listTicketTimeline", ["action_runs"]),
        ("POST", "/tickets/:id/messages", "A107", "ticket_messages", "createTicketMessage", [T, "notifications"]),
        ("PATCH", "/ticket_messages/:id", "A107", "ticket_messages", "updateTicketMessage", []),
        ("DELETE", "/ticket_messages/:id", "A107", "ticket_messages", "deleteTicketMessage", []),
        ("POST", "/ticket_messages/:id/star", "A107", "ticket_messages", "starTicketMessage", []),
        ("GET", "/tickets/:id/decisions", "A108", "ticket_decisions", "listTicketDecisions", []),
        ("POST", "/tickets/:id/decisions", "A108", "ticket_decisions", "createTicketDecision", []),
        ("PATCH", "/ticket_decisions/:id", "A108", "ticket_decisions", "updateTicketDecision", ["policies"]),
        ("POST", "/tickets/:id/handovers", "A51|A48|A111|A112", "ticket_handovers", "createTicketHandover", ["notifications"]),
        ("PATCH", "/ticket_handovers/:id", "A110", "ticket_handovers", "answerTicketHandover", [T]),
        # つながり・成果物・検収
        ("GET", "/tickets/:id/links", "A103", "ticket_links", "listTicketLinks", []),
        ("POST", "/tickets/:id/links", "A103", "ticket_links", "createTicketLink", []),
        ("DELETE", "/ticket_links/:id", "A103", "ticket_links", "deleteTicketLink", []),
        ("GET", "/tickets/:id/artifacts", "A101", "artifacts", "listTicketArtifacts", ["artifact_versions"]),
        ("GET", "/artifact_versions/:id", "A101", "artifact_versions", "getArtifactVersion", []),
        ("POST", "/tickets/:id/attachments", "A101", "attachments", "createTicketAttachment", []),
        ("POST", "/tickets/:id/acceptances", "A123", "acceptances", "requestAcceptance", ["client_contacts", "notifications"]),
        ("PATCH", "/tickets/:id/client-share", "A123", T, "updateTicketClientShare", ["clients"]),
        # 一覧の設定・知らせ・選ぶもの
        ("GET", "/saved_views", "A58", "saved_views", "listSavedViews", []),
        ("POST", "/saved_views", "A58", "saved_views", "createSavedView", []),
        ("PATCH", "/saved_views/:id", "A58", "saved_views", "updateSavedView", []),
        ("DELETE", "/saved_views/:id", "A58", "saved_views", "deleteSavedView", []),
        ("GET", "/notifications", "A109", "notifications", "listNotifications", []),
        ("GET", "/shell", "A58", "notifications", "getShell", ["approvals", "ticket_handovers", "scopes", "sessions", "notices"]),
        ("PATCH", "/notifications/:id", "A109", "notifications", "readNotification", []),
        ("POST", "/notifications/read-all", "A109", "notifications", "readAllNotifications", []),
        ("GET", "/ticket_kinds", "A103", "ticket_kinds", "listTicketKinds", ["kind_sections"]),
        ("GET", "/ticket_stages", "A103", "ticket_stages", "listTicketStages", []),
        ("GET", "/ticket-fields", "A103", "custom_fields", "listTicketFields", ["custom_field_kinds", "ticket_field_values"]),
        ("GET", "/handover_rules", "A110", "handover_rules", "listHandoverRules", []),
        ("GET", "/members", "A103", "members", "listMembers", []),
        ("GET", "/clients", "A103", "clients", "listClients", []),
    ],
    # ---------------------------------------------------------------- 承認待ち（08_api/phase1/02_承認待ち.md）
    "approvals": [
        ("GET", "/approvals/queue", "A15", "approvals", "listApprovalQueue", ["tickets", "ticket_handovers", "checks"]),
        ("GET", "/approvals/:id", "A15", "approvals", "getApproval", ["tickets", "action_runs", "artifact_versions", "checks", "ticket_messages", "policies"]),
        ("POST", "/approvals/:id/approve", "A15", "approvals", "approveApproval", ["action_runs", "audit_events"]),
        ("POST", "/approvals/:id/edit", "A15", "approvals", "editApproval", ["tickets"]),
        ("POST", "/approvals/:id/return", "A15", "approvals", "returnApproval", ["ticket_messages", "memory_proposals"]),
        ("POST", "/approvals/:id/stop", "A15|A89", "approvals", "stopApproval", ["action_runs"]),
        ("POST", "/approvals/:id/withdraw", "A89", "approvals", "withdrawApproval", ["action_runs"]),
        ("POST", "/approvals/bulk/preview", "A15", "approvals", "previewBulkApproval", ["checks"]),
        ("POST", "/approvals/bulk", "A15", "approvals", "bulkApprove", ["action_runs", "audit_events"]),
        ("GET", "/approvals/history", "A15", "approvals", "listApprovalHistory", ["tickets"]),
        ("PATCH", "/ticket_handovers/:id", "A110", "ticket_handovers", "answerTicketHandover", ["tickets"]),
    ],
    # ---------------------------------------------------------------- 分身の部屋（08_api/phase1/03_分身の部屋.md）
    "clone-chat": [
        ("GET", "/clones/me", "A20", "clones", "getMyClone", ["members", "sessions"]),
        ("PATCH", "/clones/me", "A91", "clones", "updateMyClone", ["members"]),
        ("GET", "/conversations", "A88", "conversations", "listConversations", []),
        ("POST", "/conversations", "A88|A100", "conversations", "createConversation", []),
        ("GET", "/conversations/:id", "A88", "conversations", "getConversation", []),
        ("PATCH", "/conversations/:id", "A88", "conversations", "updateConversation", ["learning_candidates"]),
        ("DELETE", "/conversations/:id", "A88", "conversations", "deleteConversation", []),
        ("GET", "/conversations/:id/messages", "A20", "messages", "listConversationMessages", []),
        ("GET", "/conversations/:id/stream", "A20", "messages", "streamConversation", []),   # 書きながらの返事の流れ（D-104.8・D-128.122）
        ("POST", "/conversations/:id/messages", "A20|A100", "messages", "sendConversationMessage", ["action_runs", "reference_logs"]),
        ("POST", "/conversations/:id/stop", "A20", "messages", "stopConversation", ["action_runs"]),
        ("POST", "/conversations/:id/attachments", "A90", "attachments", "createConversationAttachment", []),
        ("POST", "/conversations/:id/permissions/:pid", "A91", "messages", "answerAgentPermission", []),
        ("POST", "/messages/:id/artifacts", "A95", "artifacts", "createArtifactFromMessage", ["artifact_versions"]),
        ("PATCH", "/artifacts/:id", "A95", "artifacts", "updateArtifact", ["artifact_versions"]),
        ("POST", "/artifact_versions/:id/restore", "A95", "artifact_versions", "restoreArtifactVersion", ["artifacts"]),
        ("GET", "/clones/me/knows/counts", "A30", "memories", "countKnows", ["policies", "skills", "learning_candidates"]),
        ("GET", "/memories", "A30", "memories", "listMemories", []),
        ("POST", "/memories", "A30", "memories", "createMemory", ["learning_candidates"]),
        ("PATCH", "/memories/:id", "A30", "memories", "updateMemory", []),
        ("DELETE", "/memories/:id", "A30", "memories", "deleteMemory", []),
        ("POST", "/memories/:id/promote", "A30|A131", "policies", "promoteMemoryToRule", ["memories"]),
        ("GET", "/learning_candidates", "A30|A93", "learning_candidates", "listLearningCandidates", []),
        ("POST", "/learning_candidates/:id/accept", "A30|A93", "learning_candidates", "acceptLearningCandidate", ["memories", "policies", "skills"]),
        ("POST", "/learning_candidates/:id/dismiss", "A30|A93", "learning_candidates", "dismissLearningCandidate", []),
        ("POST", "/learning_candidates/:id/later", "A30", "learning_candidates", "postponeLearningCandidate", []),
        ("POST", "/learning_candidates/:id/exception-request", "A131", "approvals", "requestRuleException", ["learning_candidates", "policies", "notifications"]),
    ],
    "rules": [
        ("GET", "/rules", "A131", "policies", "listRules", ["clients", "scopes"]),
        ("GET", "/rules/:id", "A131", "policies", "getRule", ["action_runs"]),
        ("POST", "/rules/check", "A131", "policies", "checkRule", ["memories"]),
        ("POST", "/rules", "A131", "policies", "createRule", ["approvals"]),
        ("PATCH", "/rules/:id", "A131", "policies", "updateRule", []),
        ("DELETE", "/rules/:id", "A131", "policies", "deleteRule", []),
    ],
    "work-types": [
        ("GET", "/work_types", "A119", "skills", "listWorkTypes", ["skill_versions"]),
        ("GET", "/work_types/:id", "A119", "skills", "getWorkType", ["skill_versions", "policies"]),
        ("POST", "/work_types", "A119", "skills", "createWorkType", ["skill_versions"]),
        ("POST", "/work_types/:id/copy", "A119", "skills", "copyWorkType", ["skill_versions"]),
        ("PATCH", "/work_types/:id/draft", "A119", "skill_versions", "updateWorkTypeDraft", []),
        ("GET", "/work_types/:id/versions", "A119", "skill_versions", "listWorkTypeVersions", []),
        ("POST", "/work_types/:id/try", "A119", "skill_test_runs", "tryWorkType", ["tickets", "checks"]),
        ("POST", "/work_types/:id/release", "A119", "skill_versions", "releaseWorkType", ["skills"]),
        ("POST", "/work_types/:id/spread-requests", "A119", "approvals", "requestWorkTypeSpread", ["notifications"]),
    ],
    "ai-activity": [
        ("GET", "/clones/me/now", "A53", "action_runs", "getCloneNow", ["tickets", "approvals"]),
        ("GET", "/clones/me/growth", "A53", "action_runs", "getCloneGrowth", ["approvals", "ticket_section_versions"]),
        ("GET", "/clones/me/activity", "A53", "action_runs", "listCloneActivity", ["memories", "learning_candidates"]),
        ("POST", "/clones/me/activity/export", "A53", "export_jobs", "exportCloneActivity", []),
        ("POST", "/action_runs/:id/takeover", "A57", "action_runs", "takeoverActionRun", ["tickets"]),
    ],
    # ---------------------------------------------------------------- ログイン・登録・2 段階・パスキー（08_api/phase1/04_ログイン.md）
    # 暗号の中身（パスワードの照合・パスキーの署名・TOTP の計算・セッションの発行）は Better Auth（/api/auth/*）に任せ、
    # ここはその前後（登録の保留・ロック・規約・招待・本人確認の取り直し・自分の安全の設定）を受け持つ
    "signup": [
        ("POST", "/auth/sign-up", "A01|A96", "pending_signup", "createSignup", ["terms_versions"]),
        ("GET", "/auth/sign-up/status", "A01", "pending_signup", "getSignupStatus", []),
        ("POST", "/auth/sign-up/resend", "A01", "pending_signup", "resendSignupEmail", []),
        ("GET", "/auth/terms/current", "A96", "terms_versions", "getCurrentTerms", []),
    ],
    "verify-email": [
        ("POST", "/auth/sign-up/verify", "A02", "pending_signup", "verifySignup", ["tenants", "members", "tenant_memberships", "terms_consents", "sessions"]),
    ],
    "login": [
        ("POST", "/auth/sign-in", "A13", "sessions", "signInWithPassword", ["security_events"]),
        ("POST", "/auth/two-factor/verify", "A13", "sessions", "verifySignInCode", ["security_events"]),
        ("POST", "/auth/recovery/admin-request", "A13", "security_events", "requestAdminRecovery", ["notifications"]),
        ("POST", "/auth/terms/consent", "A96", "terms_consents", "consentToTerms", []),
        ("POST", "/auth/step-up", "A13", "sessions", "stepUp", ["security_events"]),
        ("POST", "/auth/sign-out", "A13", "sessions", "signOut", []),
        ("GET", "/auth/service-status", "A13", "status_incidents", "getServiceStatus", ["notices"]),
    ],
    "help": [("GET", "/auth/service-status", "A135", "status_incidents", "getServiceStatus", ["notices"])],   # K-315
    "password-reset": [
        ("POST", "/auth/password/forgot", "A31", "security_events", "requestPasswordReset", []),
        ("POST", "/auth/password/reset", "A31", "sessions", "resetPassword", ["security_events"]),
    ],
    "invite-accept": [
        ("GET", "/auth/invitations/:token", "A03", "invitations", "getInvitation", ["tenants", "scopes"]),
        ("POST", "/auth/invitations/:token/accept", "A03|A96", "invitations", "acceptInvitation", ["members", "tenant_memberships", "terms_consents"]),
    ],
    "mfa-setup": [
        ("GET", "/me/security", "A97|A04", "passkeys", "getMySecurity", ["sessions", "security_events"]),
        ("PATCH", "/me/passkeys/:id", "A97", "passkeys", "renamePasskey", []),
        ("DELETE", "/me/passkeys/:id", "A97", "passkeys", "deletePasskey", ["security_events"]),
        ("POST", "/me/two-factor/enable", "A04", "security_events", "startTwoFactor", []),
        ("POST", "/me/two-factor/confirm", "A04", "security_events", "confirmTwoFactor", []),
        ("DELETE", "/me/two-factor", "A04", "security_events", "disableTwoFactor", []),
        ("POST", "/me/backup-codes", "A04", "security_events", "regenerateBackupCodes", []),
        ("PATCH", "/me/password", "A97", "security_events", "changePassword", ["sessions"]),
        ("POST", "/me/password", "A97", "security_events", "setMyPassword", ["sessions"]),   # K-312：パスワードの無い人（パスキーだけ）が決める（代表の答え ②）
        ("GET", "/me/sessions", "A74", "sessions", "listMySessions", []),
        ("DELETE", "/me/sessions/:id", "A74", "sessions", "revokeMySession", ["security_events"]),
        ("POST", "/me/sessions/revoke-others", "A74", "sessions", "revokeOtherSessions", ["security_events"]),
        ("POST", "/members/:id/two-factor/reset", "A04", "security_events", "resetMemberTwoFactor", ["members", "audit_events", "notifications"]),
    ],
    # ---------------------------------------------------------------- 自分の設定（08_api/phase1/05_自分の設定とPC.md）
    "account": [
        ("GET", "/me", "A74", "members", "getMe", ["tenant_memberships", "tenants"]),
        ("PATCH", "/me", "A74", "members", "updateMe", []),
        ("POST", "/me/avatar", "A74", "members", "uploadAvatar", ["attachments"]),
        ("POST", "/me/email-change", "A74", "security_events", "requestEmailChange", []),
        ("POST", "/me/email-change/verify", "A74", "security_events", "verifyEmailChange", ["members"]),
        ("DELETE", "/me/workspaces/:id", "A74", "tenant_memberships", "leaveWorkspace", ["tickets", "approvals", "memories"]),
        ("GET", "/me/usage", "A94", "agent_usage_snapshots", "getMyUsage", ["action_runs"]),
        ("GET", "/me/setup-tasks", "A74", "members", "listSetupTasks", ["passkeys", "sessions", "credentials"]),
        ("POST", "/me/setup-tasks/dismiss", "A74", "members", "dismissSetupTasks", []),
        ("GET", "/me/notification-settings", "A74", "notification_settings", "getNotificationSettings", ["notification_preferences"]),
        ("PATCH", "/me/notification-settings", "A74", "notification_settings", "updateNotificationSettings", ["notification_preferences"]),
        ("POST", "/me/notification-settings/copy", "A74", "notification_settings", "copyNotificationSettings", ["notification_preferences"]),
    ],
    "credentials": [
        ("GET", "/credentials", "A10", "credentials", "listCredentials", ["skills", "action_runs"]),
        ("POST", "/credentials", "A10", "credentials", "createCredential", ["audit_events"]),
        ("PATCH", "/credentials/:id", "A10", "credentials", "updateCredential", ["audit_events"]),
        ("DELETE", "/credentials/:id", "A10", "credentials", "deleteCredential", ["audit_events"]),
        ("POST", "/credentials/:id/login-check", "A10", "credentials", "checkCredentialLogin", ["bridge_jobs"]),
        ("POST", "/credentials/:id/login-check/answer", "A10", "credentials", "answerCredentialLoginCheck", ["bridge_jobs"]),
    ],
    "bridge-setup": [
        # 人が呼ぶ（自分の PC）
        ("POST", "/bridge/pairing-codes", "A09", "bridge_pairing_codes", "createPairingCode", []),
        ("GET", "/bridge/devices", "A09", "sessions", "listMyDevices", ["agent_usage_snapshots"]),
        ("PATCH", "/bridge/devices/:id", "A09", "sessions", "updateMyDevice", []),
        ("DELETE", "/bridge/devices/:id", "A09", "sessions", "revokeMyDevice", ["security_events", "bridge_jobs"]),
        ("GET", "/bridge/releases/latest", "A09", "sessions", "getLatestBridgeRelease", []),
        ("GET", "/bridge/releases/:name/file", "A09", "sessions", "downloadBridgeRelease", []),
        # PC（Bridge）が呼ぶ（device）
        ("POST", "/bridge/claim", "A09", "sessions", "claimPairingCode", ["bridge_pairing_codes", "security_events"]),
        ("POST", "/bridge/heartbeat", "A09", "sessions", "sendHeartbeat", []),
        ("POST", "/bridge/usage", "A94", "agent_usage_snapshots", "reportUsage", []),
        ("POST", "/bridge/jobs/take", "A104", "bridge_jobs", "takeBridgeJob", ["action_runs"]),
        ("POST", "/bridge/jobs/:id/progress", "A104", "bridge_job_events", "reportJobProgress", ["action_runs", "messages"]),
        ("POST", "/bridge/jobs/:id/finish", "A104", "bridge_jobs", "finishBridgeJob", ["action_runs", "messages", "checks"]),
        ("POST", "/bridge/jobs/:id/questions", "A91", "messages", "askFromBridge", ["notifications"]),
        ("GET", "/bridge/jobs/:id/questions/:qid", "A91", "messages", "getBridgeQuestionAnswer", []),
        ("GET", "/bridge/jobs/:id/control", "A104", "bridge_jobs", "getJobControl", []),
        ("POST", "/bridge/jobs/:id/browser", "A104", "bridge_job_events", "reportBrowserState", ["attachments"]),
        ("POST", "/bridge/jobs/:id/conversation-entries", "A20", "messages", "mirrorConversationEntries", ["conversations"]),
        ("GET", "/bridge/mirror-targets", "A20", "conversations", "listMirrorTargets", ["messages"]),   # 写しを取り戻す先（D-112・D-128.122）
        ("POST", "/bridge/jobs/:id/artifacts", "A95", "artifacts", "putArtifactFromBridge", ["artifact_versions"]),
        ("POST", "/bridge/jobs/:id/tools/:name", "A104", "action_runs", "callKanameTool", ["tickets", "reference_logs"]),
        ("POST", "/bridge/credentials/resolve", "A10", "credentials", "resolveCredential", ["audit_events"]),
        ("POST", "/bridge/credentials/:id/check-result", "A10", "credentials", "reportCredentialCheck", []),
        ("GET", "/bridge/files/:ref", "A104", "attachments", "getFileForBridge", []),
    ],
    # ---------------------------------------------------------------- 運営：配るもの（08_api/phase1/06_運営の配るもの.md）
    "ops-skills": [
        # 業務の型と操作（全社向け・節目①）
        ("GET", "/ops/work_types", "A80", "skills", "listOpsWorkTypes", ["skill_versions", "tenant_distributions"]),
        ("GET", "/ops/work_types/:id", "A80", "skills", "getOpsWorkType", ["skill_versions", "skill_test_runs", "tenant_distributions"]),
        ("POST", "/ops/work_type_uploads", "A80", "skill_versions", "uploadWorkTypePackage", ["skill_test_runs"]),
        ("GET", "/ops/work_type_uploads/:id", "A80", "skill_versions", "getWorkTypeUpload", ["skill_test_runs"]),
        ("POST", "/ops/work_types/:id/versions", "A80", "skill_versions", "releaseOpsWorkType", ["tenant_distributions", "notifications", "ops_audit_events"]),
        ("POST", "/ops/work_types/:id/versions/:v/rollback", "A80", "skill_versions", "rollbackOpsWorkType", ["tenant_distributions", "ops_audit_events"]),
        ("GET", "/ops/operations", "A80", "operations", "listOperations", []),
        # ひな形（D-125.72）
        ("GET", "/ops/templates", "A128", "distributions", "listOpsTemplates", ["tenant_distributions"]),
        ("GET", "/ops/templates/:id", "A128", "distributions", "getOpsTemplate", ["tenant_distributions"]),
        ("POST", "/ops/templates/:id/versions", "A128", "distributions", "releaseOpsTemplate", ["tenant_distributions", "notifications", "ops_audit_events"]),
        # プランの値段と中身（D-128.72）
        ("GET", "/ops/plans", "A133", "plans", "listOpsPlans", ["plan_versions", "subscriptions"]),
        ("GET", "/ops/plan_proposals", "A133", "ops_plan_proposals", "listPlanProposals", []),
        ("POST", "/ops/plan_proposals", "A133", "ops_plan_proposals", "createPlanProposal", ["plans"]),
        ("PATCH", "/ops/plan_proposals/:id", "A133", "ops_plan_proposals", "updatePlanProposal", []),
        ("GET", "/ops/plan_proposals/:id/impact", "A133", "ops_plan_proposals", "getPlanProposalImpact", ["subscriptions", "tenants"]),
        ("POST", "/ops/plan_proposals/:id/submit", "A133", "ops_plan_proposals", "submitPlanProposal", ["notifications"]),
        ("POST", "/ops/plan_proposals/:id/decide", "A133", "ops_plan_proposals", "decidePlanProposal", ["plan_versions", "notices", "ops_audit_events"]),
        ("POST", "/ops/plan_proposals/:id/return", "A133", "ops_plan_proposals", "returnPlanProposal", ["notifications"]),
        ("GET", "/ops/plan_history", "A133", "ops_audit_events", "listPlanHistory", ["ops_plan_proposals"]),
    ],
    # ---------------------------------------------------------------- ワークスペースの管理（08_api/phase1/07_ワークスペースの管理.md）
    "members": [
        ("GET", "/workspace/members", "A36", "members", "getWorkspaceMembers", ["tenant_memberships", "scope_memberships", "scopes", "invitations", "sessions"]),
        ("POST", "/invitations", "A36", "invitations", "createInvitations", ["notifications", "audit_events"]),
        ("POST", "/invitations/link", "A36", "invitations", "createInvitationLink", ["audit_events"]),
        ("POST", "/invitations/:id/resend", "A36", "invitations", "resendInvitation", ["notifications"]),
        ("DELETE", "/invitations/:id", "A36", "invitations", "revokeInvitation", ["audit_events"]),
        ("PATCH", "/members/:id/role", "A61", "members", "updateMemberRole", ["tenant_memberships", "scope_memberships", "audit_events"]),
        ("POST", "/members/:id/nudge", "A36", "notifications", "nudgeMember", ["sessions"]),
    ],
    "member-detail": [
        ("GET", "/members/:id", "A61", "members", "getMember", ["scope_memberships", "permissions", "tickets", "clients", "sessions", "passkeys", "agent_usage_snapshots", "audit_events"]),
        ("PATCH", "/members/:id/groups", "A61", "scope_memberships", "updateMemberGroups", ["audit_events"]),
        ("PATCH", "/members/:id/permissions", "A61", "permissions", "updateMemberPermissions", ["abilities", "audit_events"]),
        ("POST", "/members/:id/suspend", "A62", "members", "suspendMember", ["tenant_memberships", "sessions", "bridge_jobs", "audit_events"]),
        ("POST", "/members/:id/resume", "A62", "members", "resumeMember", ["tenant_memberships", "audit_events"]),
        ("GET", "/members/:id/remove-preview", "A62", "members", "previewMemberRemoval", ["tickets", "ticket_handovers", "approvals", "credentials", "memories"]),
        ("DELETE", "/members/:id", "A62", "members", "removeMember", ["tickets", "ticket_handovers", "approvals", "memories", "conversations", "credentials", "sessions", "invitations", "account_events", "audit_events"]),
        ("POST", "/members/:id/two-factor/reset", "A04", "security_events", "resetMemberTwoFactor", ["members", "audit_events", "notifications"]),
    ],
    "layers": [
        ("GET", "/scopes", "A117", "scopes", "listScopes", ["layers", "scope_memberships"]),
        ("POST", "/scopes", "A117", "scopes", "createScope", ["layers", "scope_memberships", "audit_events"]),
        ("PATCH", "/scopes/:id", "A117", "scopes", "updateScope", ["scope_memberships", "audit_events"]),
        ("POST", "/layers", "A117", "layers", "createLayer", ["audit_events"]),
        ("PATCH", "/layers/:id", "A117", "layers", "updateLayer", ["audit_events"]),
    ],
    "masters": [
        # 守ること・承認を上に回すとき・やり方（ワークスペース全体と層）
        ("GET", "/workspace/rules", "A118", "policies", "getWorkspaceRules", ["scopes", "skills", "action_runs"]),
        ("POST", "/rules/check", "A118", "policies", "checkRule", ["memories"]),
        ("POST", "/workspace/rules", "A118", "policies", "createWorkspaceRule", ["audit_events"]),
        ("PATCH", "/workspace/rules/:id", "A118", "policies", "updateWorkspaceRule", ["audit_events"]),
        ("DELETE", "/workspace/rules/:id", "A118", "policies", "deleteWorkspaceRule", ["audit_events"]),
        ("POST", "/workspace/escalation-rules/preview", "A118", "policies", "previewEscalationRule", ["approvals", "tickets"]),
        ("POST", "/workspace/escalation-rules", "A118", "policies", "createEscalationRule", ["audit_events"]),
        ("PATCH", "/workspace/escalation-rules/:id", "A118", "policies", "updateEscalationRule", ["audit_events"]),
        ("DELETE", "/workspace/escalation-rules/:id", "A118", "policies", "deleteEscalationRule", ["audit_events"]),
        # チケットの形（種別と区画・作業の段・分類の軸・担当を渡すとき・D-128.95）
        ("GET", "/workspace/ticket-shape", "A118", "ticket_kinds", "getTicketShape", ["kind_sections", "ticket_stages", "class_axes", "class_values", "handover_rules"]),
        ("POST", "/workspace/ticket-shape/preview", "A118", "ticket_kinds", "previewTicketShapeChange", ["tickets", "ticket_class_values"]),
        ("PATCH", "/workspace/ticket-shape", "A118", "ticket_kinds", "saveTicketShape", ["kind_sections", "ticket_stages", "class_axes", "class_values", "handover_rules", "tickets", "ticket_class_values", "ticket_messages", "distributions", "audit_events"]),
        ("GET", "/ticket_kinds/template-updates", "A120", "tenant_distributions", "listKindTemplateUpdates", ["distributions"]),
        ("POST", "/ticket_kinds/template-updates/:id/apply", "A120", "kind_sections", "applyKindTemplateUpdate", ["tenant_distributions", "ticket_kinds"]),
    ],
    "audit": [
        ("GET", "/audit_events", "A33", "audit_events", "listAuditEvents", ["members", "tickets"]),
        ("POST", "/tickets/:id/restore", "A116", T, "restoreTicket", ["audit_events"]),
        ("POST", "/exports", "A40", "export_jobs", "createExport", ["audit_events"]),
        ("GET", "/exports/:id", "A40", "export_jobs", "getExport", []),
    ],
    "company-settings": [
        ("GET", "/workspace", "A75", "tenants", "getWorkspaceSettings", ["subscriptions", "plans", "notices", "permissions", "account_events"]),
        ("PATCH", "/workspace", "A75", "tenants", "updateWorkspace", ["audit_events"]),
        ("POST", "/workspace/logo", "A75", "tenants", "uploadWorkspaceLogo", ["attachments"]),
        ("PATCH", "/workspace/permissions", "A75", "permissions", "updateWorkspacePermissions", ["abilities", "audit_events"]),
        ("GET", "/workspace/plans", "A69", "plans", "listWorkspacePlans", ["subscriptions", "usage_meters"]),
        ("POST", "/workspace/plan", "A69", "subscriptions", "changePlan", ["plan_change_requests", "invoices", "audit_events"]),
        ("POST", "/workspace/deletion", "A75", "account_events", "requestWorkspaceDeletion", ["export_jobs", "notifications", "audit_events"]),
        ("DELETE", "/workspace/deletion", "A75", "account_events", "cancelWorkspaceDeletion", ["audit_events"]),
        ("POST", "/exports", "A40", "export_jobs", "createExport", ["audit_events"]),
    ],
    "billing": [
        ("GET", "/workspace/billing", "A69", "invoices", "getBilling", ["subscriptions", "payments"]),
        ("GET", "/invoices/:id/pdf", "A69", "invoices", "downloadInvoicePdf", []),
        ("PATCH", "/workspace/billing-contact", "A69", "subscriptions", "updateBillingContact", ["audit_events"]),
    ],
    # ---------------------------------------------------------------- 取引先とクライアントの場所（08_api/phase1/08_取引先とクライアントの場所.md）
    "clients": [
        ("GET", "/clients", "A121", "clients", "listClients", ["client_groups", "client_contacts", "client_requests", "acceptances", "tickets"]),
        ("GET", "/clients/link-candidates", "A121", T, "listClientLinkCandidates", ["clients"]),
        ("POST", "/clients", "A121", "clients", "createClient", ["client_groups", T, "audit_events"]),
        ("GET", "/clients/:id", "A121", "clients", "getClient", ["client_groups", "client_contacts", "client_requests", "acceptances", T, "policies", "knowledge_pages"]),
        ("PATCH", "/clients/:id", "A121", "clients", "updateClient", ["client_groups", "audit_events"]),
        ("GET", "/clients/:id/activity", "A121", "ticket_messages", "listClientActivity", ["client_requests", "acceptances", "action_runs"]),
        ("PATCH", "/clients/:id/share", "A121", "clients", "updateClientShare", ["ticket_kinds", "audit_events"]),
        ("GET", "/clients/:id/portal-preview", "A121", "clients", "getClientPortalPreview", [T, "acceptances", "client_requests"]),
        ("POST", "/clients/:id/contacts", "A121", "client_contacts", "createClientContact", ["invitations", "notifications", "audit_events"]),
        ("PATCH", "/client_contacts/:id", "A121", "client_contacts", "updateClientContact", ["audit_events"]),
        ("DELETE", "/client_contacts/:id", "A121", "client_contacts", "removeClientContact", ["tenant_memberships", "sessions", "invitations", "audit_events"]),
        ("POST", "/client_contacts/:id/invitation", "A121", "invitations", "inviteClientContact", ["notifications", "audit_events"]),
        ("POST", "/acceptances/:id/remind", "A123", "acceptances", "remindAcceptance", ["notifications"]),
        ("GET", "/rules", "A121", "policies", "listRules", ["clients", "scopes"]),
        ("POST", "/rules", "A121", "policies", "createRule", ["approvals"]),
    ],
    "requests": [
        ("GET", "/client_requests", "A122", "client_requests", "listClientRequests", ["clients", "client_contacts"]),
        ("GET", "/client_requests/:id", "A122", "client_requests", "getClientRequest", ["messages", "conversations", "client_contacts", "skills"]),
        ("PATCH", "/client_requests/:id", "A122", "client_requests", "updateClientRequest", ["scopes"]),
        ("POST", "/client_requests/:id/reply", "A122", "messages", "replyToClientRequest", ["client_requests", "notifications"]),
        ("POST", "/client_requests/:id/accept", "A122", "client_requests", "acceptClientRequest", [T, "ticket_sections", "messages", "notifications"]),
        ("POST", "/client_requests/:id/decline", "A122", "client_requests", "declineClientRequest", ["messages", "notifications"]),
    ],
    "portal": [
        ("GET", "/portal", "A125", "client_requests", "getPortalHome", ["acceptances", T, "clients"]),
        ("POST", "/portal/requests/questions", "A124", "client_requests", "askPortalRequestQuestions", ["bridge_jobs"]),
        ("POST", "/portal/requests", "A124", "client_requests", "createPortalRequest", ["conversations", "attachments", "notifications", "bridge_jobs"]),
        ("GET", "/portal/requests/:id", "A124", "client_requests", "getPortalRequest", ["messages"]),
        ("POST", "/portal/requests/:id/messages", "A124", "messages", "postPortalRequestMessage", ["client_requests", "notifications"]),
        ("POST", "/portal/attachments", "A124", "attachments", "uploadPortalAttachment", []),
        ("GET", "/portal/tickets/:id", "A125", T, "getPortalTicket", ["artifacts", "ticket_messages"]),
        ("GET", "/portal/acceptances/:id", "A126", "acceptances", "getPortalAcceptance", ["artifact_versions"]),
        ("POST", "/portal/acceptances/:id/answer", "A126", "acceptances", "answerAcceptance", [T, "ticket_messages", "notifications"]),
        ("GET", "/portal/notices", "A125", "notices", "listPortalNotices", ["status_incidents"]),
    ],
    # ---------------------------------------------------------------- ナレッジ（08_api/phase1/09_ナレッジ.md）
    "knowledge": [
        # ホーム・置き場・探す
        ("GET", "/knowledge/home", "A114", "knowledge_pages", "getKnowledgeHome", ["knowledge_page_versions", "reference_logs"]),
        ("GET", "/knowledge/tree", "A114", "knowledge_pages", "getKnowledgeTree", ["knowledge_folders", "scopes"]),
        ("GET", "/knowledge_pages", "A114", "knowledge_pages", "listKnowledgePages", ["reference_logs", "members"]),
        ("POST", "/knowledge/ask", "A114", "knowledge_pages", "askKnowledge", ["bridge_jobs", "policies", "clients"]),
        ("POST", "/knowledge/ask/feedback", "A114", "knowledge_page_versions", "sendKnowledgeAnswerFeedback", []),
        # 1 ページ・書く・下書き・公開
        ("GET", "/knowledge_pages/:id", "A114", "knowledge_pages", "getKnowledgePage", ["knowledge_page_versions", "knowledge_folders", "reference_logs"]),
        ("POST", "/knowledge_pages", "A114", "knowledge_pages", "createKnowledgePage", ["knowledge_page_versions", "knowledge_folders"]),
        ("PATCH", "/knowledge_pages/:id", "A114", "knowledge_pages", "updateKnowledgePage", []),
        ("PATCH", "/knowledge_pages/:id/draft", "A114", "knowledge_page_versions", "saveKnowledgeDraft", ["knowledge_page_versions"]),
        ("DELETE", "/knowledge_pages/:id/draft", "A114", "knowledge_page_versions", "discardKnowledgeDraft", ["knowledge_page_versions"]),
        ("POST", "/knowledge_pages/:id/publish", "A114", "knowledge_page_versions", "publishKnowledgePage", ["knowledge_pages", "knowledge_page_versions"]),
        ("POST", "/knowledge_pages/:id/attachments", "A114", "attachments", "uploadKnowledgeAttachment", []),
        ("GET", "/knowledge_pages/:id/versions", "A114", "knowledge_page_versions", "listKnowledgeVersions", []),
        ("POST", "/knowledge_pages/:id/versions/:v/restore", "A114", "knowledge_page_versions", "restoreKnowledgeVersion", ["knowledge_pages"]),
        ("GET", "/knowledge_pages/:id/markdown", "A114", "knowledge_pages", "exportKnowledgeMarkdown", []),
        # 使われ方・つながり・やり取り
        ("GET", "/knowledge_pages/:id/usage", "A114", "reference_logs", "getKnowledgeUsage", ["tickets", "action_runs"]),
        ("GET", "/knowledge_pages/:id/links", "A114", "knowledge_links", "getKnowledgeLinks", ["policies", "clients", "tickets"]),
        ("POST", "/knowledge_pages/:id/links", "A114", "knowledge_links", "linkKnowledgeMention", ["knowledge_page_versions"]),
        ("GET", "/knowledge/link-targets", "A114", "knowledge_pages", "searchKnowledgeLinkTargets", ["clients", "policies"]),
        ("GET", "/knowledge_pages/:id/messages", "A114", "messages", "listKnowledgeMessages", []),
        ("POST", "/knowledge_pages/:id/messages", "A114", "messages", "postKnowledgeMessage", ["notifications"]),
        # 確かめる・しまう
        ("GET", "/knowledge/verifications", "A114", "knowledge_pages", "listKnowledgeVerifications", ["reference_logs", "bridge_jobs"]),
        ("POST", "/knowledge_pages/:id/verify", "A114", "knowledge_pages", "verifyKnowledgePage", []),
        ("POST", "/knowledge_pages/:id/archive", "A114", "knowledge_pages", "archiveKnowledgePage", ["knowledge_links"]),
        ("POST", "/knowledge_pages/:id/unarchive", "A114", "knowledge_pages", "unarchiveKnowledgePage", []),
        # 直す案（チケットの完了から）
        ("GET", "/knowledge/proposals", "A114", "knowledge_page_versions", "listKnowledgeProposals", ["tickets"]),
        ("POST", "/knowledge/proposals/:id/accept", "A114", "knowledge_page_versions", "acceptKnowledgeProposal", ["knowledge_pages", "notifications"]),
        ("POST", "/knowledge/proposals/:id/decline", "A114", "knowledge_page_versions", "declineKnowledgeProposal", []),
        # 取り込む
        ("POST", "/knowledge_imports", "A114", "imports", "createKnowledgeImport", ["attachments"]),
        ("GET", "/knowledge_imports/:id", "A114", "imports", "getKnowledgeImport", []),
        ("POST", "/knowledge_imports/:id/commit", "A114", "imports", "commitKnowledgeImport", ["knowledge_pages", "knowledge_page_versions", "knowledge_links"]),
    ],
    # ---------------------------------------------------------------- 運営の残り（08_api/phase1/10_運営と困ったとき.md）
    "ops-home": [
        ("GET", "/ops/shell", "A60", "inquiries", "getOpsShell", ["invoices"]),
        ("GET", "/ops/workspaces", "A60", "tenants", "listOpsWorkspaces", ["subscriptions", "usage_meters", "invoices", "sessions", "action_runs"]),
        ("POST", "/ops/workspaces/export", "A60", "export_jobs", "exportOpsWorkspaces", ["ops_audit_events"]),
    ],
    "ops-tenant": [
        ("GET", "/ops/workspaces/:id", "A64", "tenants", "getOpsWorkspace", ["subscriptions", "usage_meters", "action_runs", "credentials", "ops_audit_events"]),
        ("GET", "/ops/workspaces/:id/members", "A64", "members", "listOpsWorkspaceMembers", ["tenant_memberships", "sessions", "passkeys"]),
        ("POST", "/ops/workspaces/:id/members/:mid/resend-verification", "A64", "security_events", "resendOpsVerification", ["notifications", "ops_audit_events", "audit_events"]),
        ("GET", "/ops/workspaces/:id/billing", "A64", "invoices", "getOpsWorkspaceBilling", ["subscriptions", "plan_versions", "payments"]),
        ("POST", "/ops/workspaces/:id/plan", "A64", "subscriptions", "changeOpsWorkspacePlan", ["plan_change_requests", "ops_audit_events", "audit_events"]),
        ("GET", "/ops/workspaces/:id/inquiries", "A64", "inquiries", "listOpsWorkspaceInquiries", []),
        ("GET", "/ops/workspaces/:id/audit", "A64", "ops_audit_events", "listOpsWorkspaceAudit", []),
        ("POST", "/ops/workspaces/:id/peeks", "A64", "support_access_grants", "openPeek", ["inquiries", "ops_audit_events", "audit_events"]),
        ("DELETE", "/ops/peeks/:id", "A64", "support_access_grants", "closePeek", ["ops_audit_events", "audit_events"]),
        ("POST", "/ops/workspaces/:id/stop", "A127", "account_events", "stopWorkspace", ["subscriptions", "sessions", "notifications", "ops_audit_events", "audit_events"]),
        ("POST", "/ops/workspaces/:id/resume", "A127", "account_events", "resumeWorkspace", ["subscriptions", "notifications", "ops_audit_events", "audit_events"]),
        ("POST", "/ops/workspaces/:id/notices", "A64", "notices", "sendWorkspaceNotice", ["notice_deliveries", "ops_audit_events"]),
    ],
    "ops-support": [
        ("GET", "/ops/inquiries", "A70", "inquiries", "listOpsInquiries", ["tenants", "members"]),
        ("GET", "/ops/inquiries/:id", "A70", "inquiries", "getOpsInquiry", ["messages", "attachments", "tenants", "action_runs", "invoices"]),
        ("PATCH", "/ops/inquiries/:id", "A70", "inquiries", "updateOpsInquiry", ["ops_audit_events"]),
        ("POST", "/ops/inquiries/:id/replies", "A70", "messages", "replyOpsInquiry", ["inquiries", "notifications", "ops_audit_events"]),
        ("POST", "/ops/inquiries/:id/notes", "A70", "messages", "addOpsInquiryNote", ["inquiries"]),
    ],
    "ops-notices": [
        ("GET", "/ops/notices", "A71", "notices", "listOpsNotices", ["status_incidents"]),
        ("POST", "/ops/notices", "A71", "notices", "createOpsNotice", ["status_incidents"]),
        ("GET", "/ops/notices/:id", "A71", "notices", "getOpsNotice", ["status_incidents", "notice_deliveries"]),
        ("PATCH", "/ops/notices/:id", "A71", "notices", "updateOpsNotice", []),
        ("POST", "/ops/notices/:id/publish", "A71", "notices", "publishOpsNotice", ["notice_deliveries", "notifications", "ops_audit_events"]),
        ("POST", "/ops/notices/:id/updates", "A71", "status_incidents", "addIncidentUpdate", ["notices", "ops_audit_events"]),
    ],
    "ops-billing": [
        ("GET", "/ops/invoices", "A72", "invoices", "listOpsInvoices", ["tenants", "subscriptions", "payments"]),
        ("POST", "/ops/invoices/issue", "A72", "invoices", "issueOpsInvoices", ["subscriptions", "plan_versions", "notifications", "ops_audit_events", "audit_events"]),
        ("POST", "/ops/invoices/:id/payments", "A72", "payments", "recordPayment", ["invoices", "ops_audit_events", "audit_events"]),
        ("POST", "/ops/invoices/export", "A72", "export_jobs", "exportOpsInvoices", ["ops_audit_events"]),
    ],
    "ops-team": [
        ("GET", "/ops/members", "A134", "ops_members", "listOpsMembers", ["passkeys"]),
        ("POST", "/ops/members", "A134", "ops_members", "addOpsMember", ["invitations", "ops_audit_events"]),
        ("PATCH", "/ops/members/:id", "A134", "ops_members", "updateOpsMemberCaps", ["ops_audit_events"]),
        ("DELETE", "/ops/members/:id", "A134", "ops_members", "removeOpsMember", ["sessions", "ops_audit_events"]),
    ],
    # ---------------------------------------------------------------- 困ったとき・お知らせ（顧客の側）
    "inquiry": [
        ("GET", "/inquiries", "A67", "inquiries", "listMyInquiries", []),
        ("POST", "/inquiries", "A67", "inquiries", "createInquiry", ["messages", "attachments", "notifications"]),
        ("GET", "/inquiries/:id", "A67", "inquiries", "getMyInquiry", ["messages"]),
        ("POST", "/inquiries/:id/messages", "A67", "messages", "postInquiryMessage", ["inquiries", "notifications"]),
        ("POST", "/inquiries/:id/resolve", "A67", "inquiries", "resolveMyInquiry", []),
        ("POST", "/inquiries/attachments", "A67", "attachments", "uploadInquiryAttachment", []),
    ],
    "notices": [
        ("GET", "/notices", "A68", "notices", "listNotices", ["notice_deliveries", "status_incidents"]),
        ("POST", "/notices/:id/read", "A68", "notice_deliveries", "markNoticeRead", []),
        ("GET", "/service-status", "A68", "status_incidents", "getServiceStatusForMember", ["notices"]),
    ],
}


# 表の行ではない答えの形（operationId → 名前と項目）。項目の型は string／integer／number／boolean／object／array／uuid／uuid[]／string[]（後ろの ? は null 可）
# 表の行ではない入力の形（K-19）。無い口は「表の名前＋Input」
INPUTS = {
    # 取り直し（K-19・K-309）：パスワード（2 段階の人はコードも）か、パスキーの応答（object・頭 x-passkey-challenge）のどちらか 1 つ
    "stepUp": ("StepUpInput", {"password": "string", "code": "string", "passkey": "object"}),
    # パスキーの名前を変える（K-309）：名前だけ（strict・ほかの欄は 422）。前後の空白を除き NFKC・1〜40 文字・制御文字なしは口が確かめる
    "renamePasskey": ("PasskeyRenameInput", {"name": "string"}),
    # 登録（K-51）：保留の申し込みに預ける 4 つだけ。会社名は空でよい（D-125.135）。表の列（pw_iv など）は入力に出さない
    "createSignup": ("SignupInput", {"email": "string", "name": "string", "company_name": "string", "password": "string"}),
    # 送り直しは申し込みの印（頭 x-signup-token）だけで引く。本文にメールを載せない（D-128.142）
    "resendSignupEmail": ("SignupResendInput", {}),
    # 確認のリンクで確定する（K-52）：届いたメールのリンクの手がかりだけ。表の列（pw_iv など）は入力に出さない
    "verifySignup": ("SignupVerifyInput", {"token": "string"}),
    # 再設定のメールを頼む（K-313）：メールだけ。登録の有無に関わらず同じ答え（D-042）
    "requestPasswordReset": ("PasswordForgotInput", {"email": "string"}),
    # パスワードで入る（K-301）：メールとパスワードだけ（strict・ほかの欄は 422）。パスワードは入口の正規化の前の値を口が使う
    "signInWithPassword": ("SignInInput", {"email": "string", "password": "string"}),
    # 確認のコードで入る（K-302）：待ちの印と、6 けたかバックアップコードのどちらか 1 つ（strict・trust_device を含むほかの欄は 422）
    "verifySignInCode": ("SignInCodeInput", {"pending": "string", "code": "string?", "backup_code": "string?"}),
    # ログアウト（K-306）：空の体だけ（strict・all・session_id などほかの欄は 422）。閉じるのは要求の印のセッションだけ
    "signOut": ("SignOutInput", {}),
    # 管理者に頼む（K-305）：待ちの印だけ（strict・ほかの欄は 422。欄の名前は K-302 の verifySignInCode と同じ）
    "requestAdminRecovery": ("AdminRecoveryInput", {"pending": "string"}),
    # 2 段階を始める（K-311）：パスワードだけ（strict）。無い・空でも入口では断らない（パスワードの無い人の 409・E-AUTH-020 を先に返すため。空の 422 は口が持つ）
    "startTwoFactor": ("TwoFactorStartInput", {"password": "string?"}),
    # 2 段階を確かめる（K-311）：認証アプリの 6 けただけ（strict）。全角・間の空白は口が直す
    "confirmTwoFactor": ("TwoFactorConfirmInput", {"code": "string"}),
    # パスワードを変える（K-312）：今と新しいパスワードだけ（strict）。値は入口が表記ゆらぎを直す前の体を口が読む（打ったとおり）
    "changePassword": ("PasswordChangeInput", {"current_password": "string", "new_password": "string"}),
    # パスワードを決める（K-312）：新しいパスワードだけ（strict）。パスワードの無い人だけ（ある人は 409）
    "setMyPassword": ("PasswordSetInput", {"new_password": "string"}),
    # 新しいパスワードを決める（K-314）：リンクの手がかりと新しいパスワードだけ。本人は手がかりから引く（体に入れさせない）
    "resetPassword": ("PasswordResetInput", {"token": "string", "new_password": "string"}),
    # 規約に同意する（K-53）：同意の印と、同意する今の版（利用規約・プライバシーポリシー）の ID だけ。テナントと人はセッションから決める（体に入れても無視する）
    "consentToTerms": ("TermsConsentInput", {"agree": "boolean", "terms_version_id": "uuid", "privacy_version_id": "uuid"}),
    # K-57：PC をつなぐ。コードを出すのは空の入力（持ち主・ハッシュは外から入れさせない）。型が any の欄は形を問わず受け、口が扱う
    "createPairingCode": ("PairingCodeInput", {}),
    "claimPairingCode": ("BridgeClaimInput", {"code": "string", "device_label": "string", "machine_id": "uuid?"}),   # machine_id：この PC の印（UUID・D-128.174）。古い Bridge は送らない（null も受ける）
    "sendHeartbeat": ("BridgeHeartbeatInput", {"health": "any", "protocol": "any", "version": "string"}),
    # K-60：チケットを作る。番号・消した人・取り込みの下書きは入れさせない。区画は鍵 → 本文。知らせる人は最初から選べる（D-128.138）
    "createTicket": ("TicketCreateInput", {"scope_id": "uuid", "kind_id": "uuid", "title": "string", "assignee_member_id": "uuid",
                                           "due_on": "string", "start_on": "string", "priority": "string", "priority_reason": "string",
                                           "parent_ticket_id": "uuid", "estimate_minutes": "any", "sections": "object",
                                           "notify_member_ids": "uuid[]", "draft_id": "uuid", "source_draft_id": "uuid"}),   # source_draft_id：続きとして出した元の下書き（作ったら消す・K-60)
    "saveMyTicketDraft": ("TicketDraftInput", {"draft_id": "uuid", "body": "object", "discard": "boolean"}),
    # K-250：key が無ければ箱を閉じる。在れば任意の項目（credentials）を「あとで」で飛ばす（ほかの値は 422・欄 key）
    "dismissSetupTasks": ("DismissSetupTasksInput", {"key": "string"}),
    # K-62：AI に任せる。任せる体は空（担当者・人・プロンプトは入れさせない・押した人の AI が動く・D-128.138）。PC の口は仕事の id を道すじで受ける（体に入れない）
    "delegateTicket": ("TicketDelegateInput", {"no_spec_reason": "string"}),   # K-565：確認項目が 0 件のときに送る使わない理由（1〜500 字・無くてよい）
    "takeBridgeJob": ("BridgeTakeInput", {"wait_sec": "integer", "protocol": "integer", "idle": "boolean"}),
    "reportJobProgress": ("BridgeProgressInput", {"seq": "integer", "kind": "string", "text": "string", "agent_session_id": "uuid", "model": "string",
                                                  "tool": "any", "usage": "any", "todos": "any", "windows": "any", "blocked": "any"}),
    # 返事・結果・途中の様子の文は自由に書く欄で、契約の形に上限を置かない（D-130.1・守りは入口の送る量 1MB）。result だけは口が 200000 字で断る（VALUE_RANGES）。途中の様子の文は口が 200000 字（返事）・400 字（1 行）に切る（人が書く欄でない Bridge の知らせ）。止まった理由（reason）は上限を置かない（D-130.4）。agent_session_id は Claude Code のセッションの id（uuid・D-129.42）
    "finishBridgeJob": ("BridgeFinishInput", {"state": "string", "result": "string", "reason": "string", "agent_session_id": "uuid"}),
    "callKanameTool": ("BridgeToolInput", {"input": "any"}),
    # K-162：承認する。体は空（承認する人はセッションから・今の担当者だけ。本人確認は取り直さない・D-128.177）
    "approveApproval": ("ApprovalApproveInput", {}),
    "returnApproval": ("ApprovalReturnInput", {"note": "string"}),
    # K-332：招待で参加する。ログインしていない人は名前とパスワード（ログイン中の人は空・K-333）。宛てのメールは招待のもの（体の email は口の前処理が落とす）
    "acceptInvitation": ("InvitationAcceptInput", {"name": "string?", "password": "string?"}),
    # K-165：完了にする。todo_checked は済ませた実施事項の番号（0 から）の並び・todo_version は画面が読んだ todo の区画の版（無ければ 0）・conditions_confirmed は完了の条件を確かめた印
    "completeTicket": ("TicketCompleteInput", {"todo_checked": "array?", "todo_version": "integer?", "conditions_confirmed": "boolean"}),
}
# get で始まるが並びを返す口（K-53）。一覧の問い合わせ（scope_id・cursor・limit・sort）は形だけ確かめて無視する
LIST_OPS = {"getCurrentTerms"}
# 同意し直しの間も止めない口（K-53・D-125.162）：規約の 2 つ・ログアウト・自分の取得。ここが正本で、契約（registry の termsOpen）に生成し、
#   口の入口（apps/api/src/contract/op.ts）と 403・E-AUTH-010 の EARS の規則（05_flow/build_api.py の four()）がそれを読む
TERMS_OPEN_OPS = {"consentToTerms", "getCurrentTerms", "signOut", "getMe"}
# 付けるまで進めないの間も止めない口（K-321・D-128.141・代表の答え ⑮ answer=6bdcb125e8f7）：安全の設定を読む・2 段階を付ける 2 つ・取り直し・
#   ログアウト・自分の取得・規約の 2 つ。名前を変える・外す・パスワードを変える・決める は入れない。ここが正本で、契約（registry の mfaOpen）に生成し、
#   口の入口（apps/api/src/contract/op.ts）と 403・MFA_REQUIRED の EARS の規則（05_flow/build_api.py の four()）がそれを読む
MFA_OPEN_OPS = {"getMySecurity", "startTwoFactor", "confirmTwoFactor", "stepUp", "signOut", "getMe", "getCurrentTerms", "consentToTerms"}

# API を呼ばない画面の台帳（K-53・テスターのレビュー HIGH）。偽の API の対応を書かずに、理由つきでここに載せる。
#   api_gate.py の A3・fb_gate.py の FB3・FB8 は、ここにあって scripts/ci/static_screens.py の S1〜S4 を満たす画面を被覆済みと数える
#   （理由が空・SCREEN_API と両方に載る・code から辿れるコードが API を呼ぶ のどれかなら赤）。
#   1 項目 = 画面 ID: {"reason": なぜ API を呼ばないか, "source": 根拠の決定, "code": 画面のコードの入口（apps/web の道・辿って調べる）}
STATIC_SCREENS = {
    "legal": {
        "reason": "規約・プライバシーポリシーの文面は、ひな形（apps/web/content/legal/<kind>-v<版>.md）と設定（legalValues）だけで埋め、DB も API も読まない。画面だけを立ち上げる CI の段でも開け、?v= で古い版も出せるようにするため。今の版の名前と url は、リンクを出す登録の画面と同意し直しの画面が getCurrentTerms で取る",
        "source": ["D-128.137", "D-128.146"],
        "code": ["apps/web/app/(outside)/legal"],
    },
}
# 口ごとの 4xx（operationId → 答えの並び）。ここにある口は、汎用の 409（冪等キー）・422 の代わりにこの並びを使う（429・502 は汎用のまま足す）。
#   EARS の文には状態の番号を入れる（05_flow/build_testplan.py の classify() が番号で試験の名前を決める）
ERRORS_4XX = {
    # パスワードで入る（K-301・D-042・D-128.141）。違う（401・残り回数）・会社の人が無い（403）・空と形（422）・5 回でロック（429）・写す所の失敗（500）
    "signInWithPassword": [
        {"status": 401, "code": "E-AUTH-001", "body": {"error": "auth", "code": "E-AUTH-001", "remaining": 4}, "errors": ["E-AUTH-001"],
         "trigger": "メールアドレスかパスワードが違う・登録していないメール（同じ答え・同じくらいの時間）",
         "ears_form": "UNWANTED: IF メールアドレスかパスワードが違うなら、Kaname は 401 と残り回数を返し、登録の有無を漏らさない"},
        {"status": 403, "code": "E-AUTH-007", "body": {"error": "auth", "code": "E-AUTH-007"}, "errors": ["E-AUTH-007"],
         "trigger": "メールアドレスとパスワードは合っているが、会社の人が無い・抜けた",
         "ears_form": "UNWANTED: IF パスワードは合っているが会社の人が無いなら、Kaname は 403 と E-AUTH-007 を返し、生きたセッションを残さない"},
        {"status": 403, "code": "E-AUTH-011", "body": {"error": "auth", "code": "E-AUTH-011"}, "errors": ["E-AUTH-011", "E-AUTH-012"],
         "trigger": "メールアドレスとパスワードは合っているが、人（members.suspended_at・所属の status = suspended）かワークスペース（subscriptions.suspended_at）が止められている（K-303・止めはセッションを作る前の 1 か所）",
         "ears_form": "UNWANTED: IF 人かワークスペースが止められているなら、Kaname は 403 と止めの理由の文を返し、セッションを作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "本文に知らない欄（remember_me・trust_device など・strict）",
         "ears_form": "UNWANTED: IF 本文に知らない欄があるなら、Kaname は 422 と項目ごとの理由を返し、DB を引かず失敗の数に入れない"},
        {"status": 422, "code": "E-VAL-008", "body": {"error": "validation", "code": "E-VAL-008"}, "errors": ["E-VAL-008"],
         "trigger": "メールアドレスかパスワードが空・無い",
         "ears_form": "UNWANTED: IF メールアドレスかパスワードが空なら、Kaname は 422 と E-VAL-008 を返し、DB を引かず失敗の数に入れない"},
        {"status": 422, "code": "E-VAL-004", "body": {"error": "validation", "code": "E-VAL-004"}, "errors": ["E-VAL-004"],
         "trigger": "メールアドレスの形が違う（@ が無い・ドメインが無い。全角・空白・大文字は直して通す）",
         "ears_form": "UNWANTED: IF メールアドレスの形が違うなら、Kaname は 422 と E-VAL-004 を返し、失敗の数に入れない"},
        {"status": 429, "code": "E-AUTH-002", "body": {"error": "auth", "code": "E-AUTH-002", "retry_after_sec": 900, "remaining": 0}, "errors": ["E-AUTH-002"],
         "trigger": "5 回続けて違えた・ロック中（15 分）",
         "ears_form": "UNWANTED: IF 5 回続けて違えたなら、Kaname は 429 と待つ秒数を返し、15 分は正しいパスワードでも入れない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "ロックを見る・数える DB が落ちた・セッションを写す所で失敗した",
         "ears_form": "UNWANTED: IF ロックを見る DB かセッションを写す所が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、半分だけ入った状態を残さず失敗の数に入れない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "止めの確かめ（app.login_gate）が落ちた・読めない（K-303・止める側に倒す）",
         "ears_form": "UNWANTED: IF 止めの確かめができなかったなら、Kaname は 503 を返し、セッションを作らない"},
    ],
    # 確認のコードで入る（K-302・D-128.141）。コードが違う・待ちの印が切れた（401）・会社の人が無い（403）・入力（422）・6 けたの止め（429）・写す所の失敗（500）
    "verifySignInCode": [
        {"status": 401, "code": "E-AUTH-004", "body": {"error": "auth", "code": "E-AUTH-004"}, "errors": ["E-AUTH-004"],
         "trigger": "6 けたかバックアップコードが違う・使ったバックアップコード・同じ 30 秒に通ったコードをもう一度",
         "ears_form": "UNWANTED: IF コードが違うなら、Kaname は 401 と E-AUTH-004 を返し、セッションを作らず失敗の数に入れる"},
        {"status": 401, "code": "E-AUTH-013", "body": {"error": "auth", "code": "E-AUTH-013"}, "errors": ["E-AUTH-013"],
         "trigger": "待ちの印が切れた（5 分）・使い終わった・でたらめ",
         "ears_form": "UNWANTED: IF 待ちの印が切れているかコードが違うなら、Kaname は 401 を返し、セッションを作らない"},
        {"status": 403, "code": "E-AUTH-007", "body": {"error": "auth", "code": "E-AUTH-007"}, "errors": ["E-AUTH-007"],
         "trigger": "コードは合っているが、会社の人が無い・抜けた（パスワードを通った後に抜けた）",
         "ears_form": "UNWANTED: IF コードは合っているが会社の人が無いなら、Kaname は 403 と E-AUTH-007 を返し、生きたセッションを残さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "本文に知らない欄（trust_device など・strict）・code と backup_code の両方・どちらも無い・待ちの印が無い",
         "ears_form": "UNWANTED: IF 本文に知らない欄があるか、コードが 1 つでないなら、Kaname は 422 を返し、失敗の数に入れない"},
        {"status": 422, "code": "E-VAL-009", "body": {"error": "validation", "code": "E-VAL-009"}, "errors": ["E-VAL-009"],
         "trigger": "コードが空・64 文字を超える",
         "ears_form": "UNWANTED: IF コードが空か 64 文字を超えるなら、Kaname は 422 と E-VAL-009 を返し、部品を呼ばず失敗の数に入れない"},
        {"status": 429, "code": "E-AUTH-014", "body": {"error": "auth", "code": "E-AUTH-014", "retry_after_sec": 900}, "errors": ["E-AUTH-014"],
         "trigger": "6 けたかバックアップコードを 5 回続けて違えた・止めの 15 分の間",
         "ears_form": "UNWANTED: IF 6 けたを 5 回続けて違えたなら、Kaname は 429 と待つ秒数を返し、15 分は正しいコードでも入れない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "セッションを写す所で失敗した・部品の確かめの途中で DB が落ちた",
         "ears_form": "UNWANTED: IF セッションを写す所が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、認証側のセッションも残さない"},
        # 止めの 1 か所（K-303）に断られた・止めの確かめが落ちた（振り分けは K-302・確かめは K-305。前は同じ鍵が 2 つあり、こちらが消えていた）
        {"status": 403, "code": "E-AUTH-011", "body": {"error": "auth", "code": "E-AUTH-011"}, "errors": ["E-AUTH-011", "E-AUTH-012"],
         "trigger": "6 けた（かバックアップコード）は合っているが、人（members.suspended_at・所属の status = suspended）かワークスペース（subscriptions.suspended_at）が止められている（K-303・止めはセッションを作る前の 1 か所）",
         "ears_form": "UNWANTED: IF 人かワークスペースが止められているなら、Kaname は 403 と止めの理由の文を返し、セッションを作らない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "止めの確かめ（app.login_gate）が落ちた・読めない（K-303・止める側に倒す）",
         "ears_form": "UNWANTED: IF 止めの確かめができなかったなら、Kaname は 503 を返し、セッションを作らない"},
    ],
    # パスキーを外す（K-309・D-128.61）。最後の入り方（409・E-AUTH-015／パスワードだけで 2 段階が無くなる E-AUTH-016）は外さない
    "deletePasskey": [
        {"status": 409, "code": "E-AUTH-015", "body": {"error": "conflict", "code": "E-AUTH-015"}, "errors": ["E-AUTH-015", "E-AUTH-016"],
         "trigger": "外すとパスキーが 0 本で、パスワードも 2 段階も無くなる（E-AUTH-015）・パスワードはあるが 2 段階が無い（E-AUTH-016）",
         "ears_form": "UNWANTED: IF 外すと入り方が無くなるか、パスワードだけで 2 段階が無い状態になるなら、Kaname は 409 と E-AUTH-015・E-AUTH-016 を返し、パスキーを外さない"},
    ],
    # 端末をなくした：管理者に頼む（K-305・D-128.141）。待ちの印が切れた（401）・入力（422）・頼みを書く DB が落ちた（500）。冪等キーの 409 は使わない（1 時間の内の 2 回目は 201・already）
    "requestAdminRecovery": [
        {"status": 401, "code": "E-AUTH-013", "body": {"error": "auth", "code": "E-AUTH-013"}, "errors": ["E-AUTH-013"],
         "trigger": "待ちの印が切れた（5 分）・でたらめ",
         "ears_form": "UNWANTED: IF 待ちの印が切れているかでたらめなら、Kaname は 401 を返し、管理者に何も送らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "待ちの印の欄が無い・文字でない・本文に知らない欄（strict）",
         "ears_form": "UNWANTED: IF 待ちの印が無いか本文に知らない欄があるなら、Kaname は 422 と項目ごとの理由を返し、何も書かない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "頼みを書く DB（app.request_admin_recovery）が落ちた・使えない",
         "ears_form": "UNWANTED: IF 頼みを書く DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、何も送らない"},
    ],
    # 承認する（K-162）。決まった・取り下げた承認（409・E-CONF-003）・入力の 422（体に知らない欄・id が uuid でない）・守りの判定で例外（503・E-PAGE-003）
    "approveApproval": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-CONF-003"}, "errors": ["E-CONF-003"],
         "trigger": "もう決まった（承認・差し戻し）か取り下げた承認をもう一度承認する",
         "ears_form": "UNWANTED: IF もう処理された承認がもう一度来たら、Kaname は 409 と E-CONF-003 を返し、実行の仕事を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "本文に知らない欄（承認の体は空のオブジェクト・strict）",
         "ears_form": "UNWANTED: IF 本文に知らない欄があるなら、Kaname は 422 と項目ごとの理由を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "承認の id が uuid でない",
         "ears_form": "UNWANTED: IF 承認の id が uuid でないなら、Kaname は 422 と欄 id を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（今のメンバーか・承認する人か・書けるか・任せた人の状態）の所で例外になった",
         "ears_form": "UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）"},
    ],
    "returnApproval": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-CONF-003"}, "errors": ["E-CONF-003"],
         "trigger": "もう決まった（承認・差し戻し）か取り下げた承認を差し戻す",
         "ears_form": "UNWANTED: IF もう処理された承認を差し戻したら、Kaname は 409 と E-CONF-003 を返し、作り直しの仕事を積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-020"],
         "trigger": "差し戻す理由が空・空白だけ（全角の空白も）・制御文字だけ（E-VAL-020・欄 note）・本文に知らない欄。理由に文字数の上限は置かない（D-131.1）",
         "ears_form": "UNWANTED: IF 差し戻す理由が空なら、Kaname は 422 と欄 note の理由（E-VAL-020）を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（今のメンバーか・承認する人か・書けるか・任せた人の状態）の所で例外になった",
         "ears_form": "UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）"},
    ],
    # 完了にする（K-165・D-125.55・D-128.49・D-128.138）。冪等キーは汎用のまま（同じキーなら最初の結果）
    "completeTicket": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-CONF-016"}, "errors": ["E-CONF-016", "E-CONF-018", "E-CONF-019"],
         "trigger": "承認待ち・実行中・確認中か、走っている実行・決まっていない承認待ちがある（E-CONF-016）・もう完了している（E-CONF-018）・作業中でない（未着手・保留・E-CONF-019）",
         "ears_form": "UNWANTED: IF 完了にできない状態（承認待ち・実行中・確認中・もう完了・作業中でない）なら、Kaname は 409 とその理由（E-CONF-016・018・019）を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-024"],
         "trigger": "終わっていない子がある（E-VAL-024・欄 children に子ごと。チェックの箱・確認項目の未チェックでは止めない・K-566）",
         "ears_form": "UNWANTED: IF 終わっていない子があるなら、Kaname は 422 と子ごとの理由（E-VAL-024）を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-023"],
         "trigger": "完了の条件を確かめていない（conditions_confirmed が true でない・無い。E-VAL-023・欄 conditions_confirmed）・実施事項の番号や版が整数でない・本文に知らない欄",
         "ears_form": "UNWANTED: IF 完了の条件を確かめた印が無いか、入力の形が違うなら、Kaname は 422 と欄ごとの理由（E-VAL-023）を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（書けるか）の所で例外になった・DB の関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）"},
    ],
    # AI に任せる（K-62・D-128.138）。PC をつないでいない（積まない）・走っている実行がある（今の run_id）・承認待ち／完了。冪等キーは汎用のまま
    "delegateTicket": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-CONF-013", "run_id": ""}, "errors": ["E-CONN-001", "E-CONF-013", "E-CONF-014"],
         "trigger": "PC を一度もつないでいない・外した（E-CONN-001）／同じチケットに走っている実行がある（E-CONF-013・今の run_id）／承認待ち・完了（E-CONF-014）",
         "ears_form": "UNWANTED: IF PC がつながっていないか、走っている実行があるか、承認待ち・完了なら、Kaname は 409 と理由（E-CONN-001・E-CONF-013 と今の run_id・E-CONF-014）を返し、仕事も実行の記録も積まない"},
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-CONF-020"}, "errors": ["E-CONF-020"],
         "trigger": "確認項目が 1 つも無く、使わない理由（no_spec_reason）も送られていない（本文の行が在るチケットだけ・K-565）",
         "ears_form": "UNWANTED: IF 確認項目が 1 つも無く使わない理由も無いなら、Kaname は 409 と E-CONF-020 を返し、仕事も実行の記録も理由も積まない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "チケットの id が uuid でない・本文に知らない欄（担当者・人・プロンプト）・使わない理由が空・空白だけ・501 字以上・文字でない",
         "ears_form": "UNWANTED: IF チケットの id が uuid でないか本文に知らない欄があるか使わない理由の形が違うなら、Kaname は 422 と項目ごとの理由を返し、何も積まない"},
    ],
    # 規約に同意する（K-53・D-128.146）。版が古い（409・今の版の並び current）・同意の印が無い（422）。冪等キーは使わない（同じ版の 2 回目は 1 回目の行のまま）
    "consentToTerms": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "E-CONF-012", "current": []}, "errors": ["E-CONF-012"],
         "trigger": "同意する版が、押した時点の今の版でない（さらに新しい版が出た・出ていた版を取り下げた）",
         "ears_form": "UNWANTED: IF 同意する版が今の版でないなら、Kaname は 409 と今の版の並び current を返し、同意の行を書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-019"],
         "trigger": "同意の印（agree=true）が無い・版の ID が空か形が違うか無い版・利用規約とプライバシーポリシーの片方だけ",
         "ears_form": "UNWANTED: IF 同意の印が無いか版の ID が受け付けられないなら、Kaname は 422 と項目ごとの理由（同意の印が無いときは E-VAL-019）を返し、同意の行を書かない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "同意を書く DB（今の版を読む・同意の行を書く）が落ちた",
         "ears_form": "UNWANTED: IF 同意を書く DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、同意の行もセッションの印も変えない"},
    ],
    # 今の版を読む（K-53）。DB が落ちたら中身を返さない
    "getCurrentTerms": [
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "今の版を読む DB が落ちた",
         "ears_form": "UNWANTED: IF 今の版を読む DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、版も url も返さない"},
    ],
    # いまの様子を読む（K-307）。DB が落ちたら「ふつう」（空）を返さず中身も返さない
    # 招待の下見（K-331・D-128.62・D-128.63）。使えない招待（期限切れ・取り消し・使われた）は 200 の state で返し、行が無いときだけ 404
    "getInvitation": [
        {"status": 404, "code": "E-INV-001", "body": {"error": "not_found", "code": "E-INV-001"}, "errors": ["E-INV-001"],
         "trigger": "招待のリンクの印が見つからない（でたらめ・古い・空白入り・512 文字を超える）",
         "ears_form": "UNWANTED: IF 招待のリンクの印が見つからないなら、Kaname は 404 と E-INV-001 を返し、招待の中身を返さない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "招待の下見を読む DB（app.invitation_preview2）かセッションを読む所が落ちた",
         "ears_form": "UNWANTED: IF 招待の下見を読む DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない"},
    ],
    # 招待で参加する（K-332 ログインしていない人・K-333 ログイン中は今のアカウントで参加し、その画面だけ招かれた所へ切り替える・別のメール宛ては 403・もう入っていれば 409・answer=becc3d3aa526）。冪等キーは使わない（答えにログインの印が入る・汎用の 409 は NO_GENERIC_409 で外す）
    "acceptInvitation": [
        {"status": 401, "code": "UNAUTHENTICATED", "body": {"error": "unauthenticated", "code": "UNAUTHENTICATED"},
         "trigger": "ログインしていない人が、宛てのメールを持たない招待（リンクの招待・K-421）で参加しようとした（確認のメールの道 K-422 が入るまでの間・ログインしてから参加）",
         "ears_form": "UNWANTED: IF ログインしていない人が宛てのメールを持たない招待で参加しようとしたなら、Kaname は 401 と UNAUTHENTICATED を返し、利用者も所属も作らず招待も使わない"},
        {"status": 403, "code": "E-AUTH-012", "body": {"error": "auth", "code": "E-AUTH-012"}, "errors": ["E-AUTH-012"],
         "trigger": "招いたワークスペースが止められている（subscriptions.suspended_at）",
         "ears_form": "UNWANTED: IF 招いたワークスペースが止められているなら、Kaname は 403 と E-AUTH-012 を返し、利用者を作らず招待も使わない"},
        {"status": 403, "code": "E-INV-005", "body": {"error": "permission", "code": "E-INV-005"}, "errors": ["E-INV-005"],
         "trigger": "ログイン中の人が今のアカウントで参加しようとしたが、招待は別のメールアドレス宛て（大文字と小文字は同じに見る・K-333）",
         "ears_form": "UNWANTED: IF ログイン中の人のメールが招待の宛てと違うなら、Kaname は 403 と E-INV-005 を返し、所属を作らず招待も使わず、その画面も切り替えない"},
        {"status": 404, "code": "E-INV-001", "body": {"error": "not_found", "code": "E-INV-001"}, "errors": ["E-INV-001"],
         "trigger": "招待のリンクの印が見つからない（でたらめ・古い・512 文字を超える）",
         "ears_form": "UNWANTED: IF 招待のリンクの印が見つからないなら、Kaname は 404 と E-INV-001 を返し、何も作らない"},
        {"status": 409, "code": "E-INV-006", "body": {"error": "conflict", "code": "E-INV-006"}, "errors": ["E-INV-006"],
         "trigger": "ログインしていない人が新しく作って参加しようとしたが、宛てのメールにもうアカウントがある（同時に 2 回押した負けの方も）",
         "ears_form": "UNWANTED: IF 宛てのメールにもうアカウントがあるなら、Kaname は 409 と E-INV-006 を返し、利用者を作らず招待も使わない"},
        {"status": 409, "code": "E-INV-007", "body": {"error": "conflict", "code": "E-INV-007"}, "errors": ["E-INV-007"],
         "trigger": "ログイン中の人が、もう入っているワークスペースの招待で参加しようとした（K-333）",
         "ears_form": "UNWANTED: IF ログイン中の人がもうそのワークスペースに入っているなら、Kaname は 409 と E-INV-007 を返し、役割を変えず招待も使わない"},
        {"status": 410, "code": "E-INV-002", "body": {"error": "not_found", "code": "E-INV-002"}, "errors": ["E-INV-002", "E-INV-003", "E-INV-004"],
         "trigger": "招待が取り消された（E-INV-002）・期限切れ（E-INV-003）・もう使われた（E-INV-004）",
         "ears_form": "UNWANTED: IF 招待が取り消し・期限切れ・使われたなら、Kaname は 410 とその理由の番号を返し、利用者を作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation", "code": "E-VAL-007"}, "errors": ["E-VAL-007", "E-VAL-005", "E-VAL-026", "E-VAL-011"],
         "trigger": "名前が空・100 文字を超える（E-VAL-007）・パスワードが 12 文字より短い（E-VAL-005）・128 文字を超える（E-VAL-026）・漏れたもの（E-VAL-011）・本文に知らない欄",
         "ears_form": "UNWANTED: IF 名前かパスワードが受け付けられないなら、Kaname は 422 と欄ごとの理由を返し、利用者を作らず招待も使わない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "招待を読む DB・利用者を作る所・受諾の関数・セッションを作る所が落ちた",
         "ears_form": "UNWANTED: IF 利用者を作る所か受諾が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、作った利用者を消して招待を使わない"},
    ],
    "getServiceStatus": [
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "稼働状況を読む DB（障害とお知らせ）が落ちた",
         "ears_form": "UNWANTED: IF 稼働状況を読む DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、題も時刻も返さない"},
    ],
    # 確認のリンクで確定する（K-52・D-088.9・D-128.146）。冪等キーは使わない：2 回目にログインの印を渡すと、リンクを持つ人なら誰でも入れてしまう
    "verifySignup": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict"}, "errors": ["E-CONF-011", "E-CONF-001", "E-AUTH-009"],
         "trigger": "確定済みのリンクをもう一度・前のリンクで新しいリンクが確定済み・別の道で登録済み・確定済みのリンクを別のアカウントでログイン中に開いた",
         "ears_form": "UNWANTED: IF 確定済みのリンクがもう一度来たら、Kaname は 409 を返し、ログインの印を渡さず本人を二重に作らない"},
        {"status": 410, "code": "GONE", "body": {"error": "gone"}, "errors": ["E-AUTH-003", "E-AUTH-008", "E-PAGE-006"],
         "trigger": "リンクが期限切れ（30 分）・送り直す前の前のリンク・無い（掃除された・でたらめ）",
         "ears_form": "UNWANTED: IF リンクが期限切れ・前のリンク・無いなら、Kaname は 410 と次の一手を返し、本人を作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-PAGE-006"],
         "trigger": "手がかりが無い・空（前後の空白を除いて空）",
         "ears_form": "UNWANTED: IF 手がかりが無いか空なら、Kaname は 422 を返し、申し込みには触らない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "確定の途中で DB か認証の仕組みが落ちた",
         "ears_form": "UNWANTED: IF 確定の途中で DB か認証が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、ログインの印を渡さない"},
    ],
    # 再設定のメールを頼む（K-313・D-042）。形の違うメールだけ 422。冪等キーは使わない（汎用の 409 は NO_GENERIC_409 で外す）。
    #   登録の有無・送れたか・60 秒の内か・背景で DB が落ちたか では答えを変えない
    "requestPasswordReset": [
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-004"],
         "trigger": "メールアドレスが無い・空・形が違う（全角・大文字・前後と途中の空白は直してから見る）",
         "ears_form": "UNWANTED: IF メールアドレスが空か形が違うなら、Kaname は 422 と欄 email の理由を返し、何も送らない"},
    ],
    # パスワードを変える（K-312・D-125.137・D-128.141）。新しいパスワードの決まり・今のパスワードが違う（422）・切る所か変える所で落ちた（503）
    "changePassword": [
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-005", "E-VAL-026", "E-VAL-011"],
         "trigger": "新しいパスワードが 12 文字より短い・128 文字を超える・漏れたもの（欄 new_password）・今のパスワードが違う（欄 current_password・401 にしない）",
         "ears_form": "UNWANTED: IF 新しいパスワードが決まりに合わないか今のパスワードが違うなら、Kaname は 422 と欄の理由を返し、端末を切らずパスワードを変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "ほかの端末を切る所（DB の関数）か、パスワードを変える所で落ちた",
         "ears_form": "UNWANTED: IF ほかの端末を切る所で落ちたなら、Kaname は 503 と E-PAGE-003 を返し、パスワードを変えない"},
    ],
    # パスワードを決める（K-312・代表の答え ②）。もうある（409）・決まり（422）
    "setMyPassword": [
        {"status": 409, "code": "CONFLICT", "body": {"error": "conflict", "code": "CONFLICT"},
         "trigger": "もうパスワードがある人が決めようとした（変えるのは changePassword）",
         "ears_form": "UNWANTED: IF もうパスワードがあるなら、Kaname は 409 を返し、パスワードを変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-005", "E-VAL-026", "E-VAL-011"],
         "trigger": "新しいパスワードが 12 文字より短い・128 文字を超える・漏れたもの（欄 new_password）",
         "ears_form": "UNWANTED: IF 新しいパスワードが決まりに合わないなら、Kaname は 422 と欄 new_password の理由を返し、パスワードを決めない"},
    ],
    # 新しいパスワードを決める（K-314・D-125.137・D-125.140・D-128.62）。冪等キーは使わない（汎用の 409 は NO_GENERIC_409 で外す）
    "resetPassword": [
        {"status": 410, "code": "GONE", "body": {"error": "gone"}, "errors": ["E-AUTH-006"],
         "trigger": "リンクが期限切れ（30 分）・使い終わった・新しく頼んだ後の前のリンク（E-AUTH-006）",
         "ears_form": "UNWANTED: IF リンクが期限切れ・使用済み・前のリンクなら、Kaname は 410 と次の一手を返し、パスワードを変えない"},
        {"status": 409, "code": "E-PAGE-006", "body": {"error": "not_found", "code": "E-PAGE-006"}, "errors": ["E-PAGE-006"],
         "trigger": "リンクが無い（でたらめ・空・空白だけ）。形どおりの入力が DB の中身で断られる所なので 422・410 にしない（K-638）",
         "ears_form": "UNWANTED: IF リンクが無い（でたらめ・空）なら、Kaname は 409 と E-PAGE-006 を返し、パスワードを変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-005", "E-VAL-026", "E-VAL-011"],
         "trigger": "新しいパスワードが 12 文字より短い・128 文字を超える・漏れたもの（手がかり・新しいパスワードの欄が無いときも 422）",
         "ears_form": "UNWANTED: IF 新しいパスワードが 12 文字より短いか 128 文字を超えるか漏れたものなら、Kaname は 422 と欄 new_password の理由を返し、端末を切らずパスワードを変えない"},
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "端末を切る所かパスワードを変える所で DB が落ちた",
         "ears_form": "UNWANTED: IF 端末を切る所かパスワードを変える所で落ちたなら、Kaname は 500 と E-PAGE-003 を返し、リンクを使えるまま残す"},
    ],
    # 登録の申し込み（K-51・K-144）。規約の版を読む DB が落ちたら申し込みを作らない（汎用の 409・422 はそのまま）
    "createSignup": [
        {"status": 500, "code": "E-PAGE-003", "body": {"error": "internal", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "規約の版を読む DB か申し込みを書く DB が落ちた",
         "ears_form": "UNWANTED: IF 規約の版を読む DB か申し込みを書く DB が落ちたなら、Kaname は 500 と E-PAGE-003 を返し、申し込みを作らずメールも送らない"},
    ],
    # 配布物を受け取る（K-57・K-144）。目録に無い名前・その OS の配布物が無い・知らない名前・置き場に届かない
    "downloadBridgeRelease": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "目録に無い名前・置き場の外を指す名前",
         "ears_form": "UNWANTED: IF 名前が目録に無いか置き場の外を指すなら、Kaname は 404 と NOT_FOUND を返し、ファイルを渡さない"},
        {"status": 404, "code": "E-CONN-014", "body": {"error": "not_found", "code": "E-CONN-014"}, "errors": ["E-CONN-014"],
         "trigger": "その OS（mac・win）の配布物が無い",
         "ears_form": "UNWANTED: IF その OS の配布物が無いなら、Kaname は 404 と E-CONN-014 を返す"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []},
         "trigger": "小文字だけの知らない名前（mac・win のどちらでもない）",
         "ears_form": "UNWANTED: IF 名前が小文字だけで mac・win のどちらでもないなら、Kaname は 422 と欄 name を返す"},
        {"status": 503, "code": "E-PAGE-007", "body": {"error": "unavailable", "code": "E-PAGE-007"}, "errors": ["E-PAGE-007"],
         "trigger": "配布物の置き場に届かない",
         "ears_form": "UNWANTED: IF 配布物の置き場に届かないなら、Kaname は 503 と E-PAGE-007 を返し、空を成功にしない"},
    ],
    # 新しい版を見る（K-57・K-144）。置き場に届かなければ 503（空を「配っていない」にしない）
    "getLatestBridgeRelease": [
        {"status": 503, "code": "E-PAGE-007", "body": {"error": "unavailable", "code": "E-PAGE-007"}, "errors": ["E-PAGE-007"],
         "trigger": "配布物の置き場に届かない",
         "ears_form": "UNWANTED: IF 配布物の置き場に届かないなら、Kaname は 503 と E-PAGE-007 を返し、「配っていない」と答えない"},
    ],
    # チケットを作る（K-60・K-144）。親が無い・見えない
    "createTicket": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "親のチケットが無い・消えた・見えない",
         "ears_form": "UNWANTED: IF 親のチケットが無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、チケットを作らない"},
    ],
}
# 2xx の EARS を口ごとに上書きする（operationId → 文）。無い口は行為の裏側の文（flow.json の blueprint）になる。
#   行為の裏側の文が別の口の振る舞いを書いているとき（A31 の「全部のセッションを失効」は決める口 resetPassword の振る舞い）に使う
EARS_OK = {
    "requestPasswordReset": "登録の有無に関わらず同じ答え（accepted）を返し、登録されていれば答えの後に再設定のリンクを 1 通送る",   # K-313・D-042
}
# 成功の状態の番号の差し替え（operationId → 番号・K-705）。無い口は POST が 201・ほかは 200。新しい物を作らない POST（並べ直す）は 200
SUCCESS_STATUS: dict = {}
# 一覧の口（GET の list・search）でないのに答えの data が並びの口（operationId の集まり・K-705）。並べ直した全部の並びを返す POST など
LIST_RESULT_OPS: dict = {}   # operationId → 訳
# 汎用の 409（冪等キー）を外す口。冪等キーを使わない口（答えに冪等の器へ残すものが無い）
NO_GENERIC_409 = {"requestPasswordReset", "resetPassword", "acceptInvitation", "createInvitationLink"}   # K-313：答えはいつも同じ。登録の有無を器に残さない／K-314：リンクは 1 回だけ（器に残すと 2 回目に 201 を返す）／K-332：答えにログインの印が入る（器に残さない・2 回目は 410）／K-421：答えにリンクのトークンが入る（器に残さない・二度押しで 2 本のリンクができ、どちらも使える）
# JSON でなくファイルそのものを返す口（operationId → 200 の application/octet-stream の中身の形・K-144）。JSON の答えと並べて契約に書く
RAW_200 = {
    "downloadBridgeRelease": {"type": "string", "format": "binary"},   # 手元のフォルダの配布物はファイルそのもの。外の置き場なら JSON の期限つき URL
}
# 答えの欄が、その口の表の null を許す列と同じ名前でも null を返さないもの（"op.欄" → 理由）。ここに無い欄は表のとおり null 可にする（K-144）
NOT_NULL_ANSWERS = {
    "listMyDevices.health": "口が coalesce で空の並び [] を返し、null にはしない（sessions.health は null 可）",
    "claimPairingCode.device_label": "口が cleanLabel で空なら「この PC」にそろえて返し、null にはしない（sessions.device_label は null 可）",
    "stepUp.step_up_at": "口が本人確認を取り直したその時刻を返し、null にはしない（sessions.step_up_at は null 可）",
    # K-62：実行の 1 件は、任せる関数（phase make）と K-63 の承認の関数（phase execute）が ticket_id・phase を必ず入れた行だけを返す（action_runs の列は会話の実行のために null 可）
    "getActionRun.ticket_id": "チケットの実行だけを読む口。任せる関数と承認の関数が ticket_id を必ず入れる（action_runs.ticket_id は会話の実行のために null 可）",
    "getActionRun.phase": "チケットの実行だけを読む口。任せる関数が make・承認の関数が execute を必ず入れる（action_runs.phase は会話の実行のために null 可）",
    "listTicketRuns.ticket_id": "チケットの実行の一覧。どの行も ticket_id を持つ（action_runs.ticket_id は会話の実行のために null 可）",
    "listTicketRuns.phase": "チケットの実行の一覧。どの行も make か execute を持つ（action_runs.phase は会話の実行のために null 可）",
}
# 類 E（K-144 ⑯・回 9）：口が「無い」ことで 422 にする入力の欄（必須の欄）。契約の入力の形の required と x-required-by: hooks になる
#   入口の zod はその欄を .optional() のままにし、無いときの答え（エラー ID と文言）は口の振る舞いが持つ（scripts/ci/contract.mjs）。
#   条件つきで要る欄（stepUp の code・種別ごとの必須の区画・優先度「高」の理由）は載せない
REQUIRED_INPUTS = {
    "completeTicket": ["conditions_confirmed"],   # apps/api/src/features/F5/approve-complete/complete.ts（conditions_confirmed だけ必須・無ければ 422。todo_checked・todo_version は任意で中身は見ない・K-566）
    "returnApproval": ["note"],                                          # apps/api/src/features/F5/approve-complete/decide.ts（無い・空・空白だけは 422 E-VAL-020・K-163）
    "createSignup": ["email", "name", "password"],                       # apps/api/src/features/F1/sign-up/input.ts:40〜47（E-VAL-004・010・005）
    "verifySignup": ["token"],                                           # apps/api/src/features/F1/verify-email/index.ts:227（E-PAGE-006）
    "requestPasswordReset": ["email"],                                   # apps/api/src/features/F1/password-reset/index.ts（無い・空・形違いは 422 E-VAL-004・K-313）
    "signInWithPassword": ["email", "password"],                         # apps/api/src/features/F1/login/sign-in.ts（無い・空は 422 E-VAL-008）
    "verifySignInCode": ["pending"],                                     # apps/api/src/features/F1/login/sign-in-code.ts（待ちの印が無いと 422。code と backup_code はどちらか 1 つ・条件つき）
    "requestAdminRecovery": ["pending"],                                 # apps/api/src/features/F1/admin-recovery/index.ts（待ちの印が無いと 422・K-302 と同じ）
    "confirmTwoFactor": ["code"],                                        # apps/api/src/features/F1/two-factor/index.ts（無い・空・6 けたでないは 422 欄 code・K-311）
    "resetPassword": ["token", "new_password"],                          # apps/api/src/features/F1/password-reset/index.ts（無い・文字でないは 422・K-314）
    "changePassword": ["current_password", "new_password"],              # apps/api/src/features/F1/change-password/index.ts（無い・文字でないは 422・欄ごと・K-312）
    "setMyPassword": ["new_password"],                                   # apps/api/src/features/F1/change-password/index.ts（無い・文字でないは 422・K-312）
    "renamePasskey": ["name"],                                           # apps/api/src/features/F1/passkeys/index.ts（無い・空・41 文字以上・制御文字は 422・欄 name・K-309）
    "consentToTerms": ["agree", "terms_version_id", "privacy_version_id"],   # apps/api/src/features/F1/consent-terms/index.ts:72・88〜90（E-VAL-019）
    "claimPairingCode": ["code"],                                        # apps/api/src/features/F3/connect-pc/code.ts:28
    "saveMyTicketDraft": ["draft_id"],                                   # apps/api/src/features/F4/create-ticket/hooks.ts:170
    "createTicket": ["title", "scope_id", "kind_id", "assignee_member_id", "due_on"],   # apps/api/src/features/F4/create-ticket/input.ts:28〜38
    "updateMemory": ["body"],                                            # apps/api/src/hooks/agent.ts:63（覚えることが空です）
    "reportJobProgress": ["kind"],                                       # apps/api/src/features/F5/delegate/bridge.ts（kind が無い・決まった値でないは 422・K62-API-032）
    "finishBridgeJob": ["state"],                                        # apps/api/src/features/F5/delegate/bridge.ts（state が無い・done／stopped／cancelled 以外は 422・K62-API-032）
}
# 類 F（K-144 ⑲）：道の値を口が値域つきで断る口（operationId → 道の値の名前 → pattern）。名前が id で終わる道の値は uuid のまま
PATH_PATTERNS = {
    # apps/api/src/features/F3/connect-pc/hooks.ts:191（mac・win）・200（ほかの英小文字だけは 422）・202〜204（ほかは目録の名前か 404）
    "downloadBridgeRelease": {"name": r"^(?:mac|win|[\s\S]*[^a-z][\s\S]*)$"},
    # apps/api/src/features/F5/delegate/tools.ts（道具の名前は ticket_read と会話の道具 8 つだけ。それ以外は 422・K62-API-032）
    "callKanameTool": {"name": "^(?:ticket_read|draft_read|goal_set|goal_remove|ledger_set|ledger_remove|duty_set|duty_remove|remember)$"},
}
# 類 G（K-144 ⑳・㉟）：契約の形に合う値を口が 422 で断る体の値のうち、書ける値域（operationId → 欄 → 値域の言葉）。
#   type・format・nullable は変えない（入口の zod は値域の言葉を読まない＝今のエラー ID と文言のまま）。値域は口が受ける値の集合より狭く書かない
import sys as _sys  # noqa: E402
from pathlib import Path as _Path  # noqa: E402

_sys.path.insert(0, str(_Path(__file__).resolve().parent.parent / "scripts" / "ci"))
import email_patterns as _EP  # noqa: E402  登録・ログインのメールの形（K-1117・口は packages/auth/src/signup.ts の isLoginEmail）
_CODE_SEP = "\\s\\-‐‑‒–—―ー−－"
_CODE_CHAR = "2-9A-HJKMNP-Za-hjkmnp-z２-９Ａ-ＨＪＫＭＮＰ-Ｚａ-ｈｊｋｍｎｐ-ｚ"
VALUE_RANGES = {
    "createTicket": {   # apps/api/src/features/F4/create-ticket/input.ts の checkCreate
        "title": {"pattern": "\\S", "maxLength": 200},
        "due_on": {"pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"},
        "start_on": {"pattern": "^(?:[0-9]{4}-[0-9]{2}-[0-9]{2})?$"},
        "priority": {"enum": ["", "mid", "high"]},
        "estimate_minutes": {"anyOf": [{"type": "integer", "minimum": 0, "maximum": 100000},
                                       {"type": "string", "pattern": "^(?:0*(?:[0-9]{1,5}|100000))?$"}], "nullable": True},
        "sections": {"propertyNames": {"pattern": "^[a-z][a-z0-9_]{0,40}$"},
                     "additionalProperties": {"type": "string"}},   # 区画の中身の上限は置かない（D-130.3）。守りは送る量 1MB だけ
        "notify_member_ids": {"maxItems": 20},
    },
    "claimPairingCode": {   # apps/api/src/features/F3/connect-pc/code.ts:27〜36（NFKC・大文字・区切りを落として、見分けやすい英数字 6 けた。32 字まで）
        "code": {"maxLength": 32, "pattern": f"^[{_CODE_SEP}]*(?:[{_CODE_CHAR}][{_CODE_SEP}]*){{6}}$"},
    },
    "delegateTicket": {"no_spec_reason": {"pattern": "\\S", "maxLength": 500}},   # K-565：app.ticket_delegate が最後の砦（REASON_INVALID）
    "updateConversation": {"title": {"pattern": "\\S"}},   # apps/api/src/hooks/agent.ts（改行を空白にして前後を落とし、空は 422）
    "updateMemory": {"body": {"pattern": "\\S"}},          # apps/api/src/hooks/agent.ts
    "createMemory": {"confidence": {"pattern": "^-?(?:[0-8](?:\\.[0-9]+)?|9(?:\\.(?:[0-9]{1,2}|(?:[0-8][0-9]|9[0-8])[0-9]+|99[0-4][0-9]*))?)$"}, "kind_id": {"enum": ["rule", "preference", "example", None]}},   # memories.confidence numeric(3,2)（10 以上は DB が断る）
    "createSignup": {   # apps/api/src/features/F1/sign-up/input.ts:37〜47
        "email": {"pattern": _EP.LOGIN_EMAIL},   # 部品 better-auth の z.email() の形を前後の空白で挟んだ物（口も z.email() で見る・K-1117）
        "name": {"pattern": "\\S", "maxLength": 100},
        "company_name": {"maxLength": 100},
        "password": {"minLength": 12},
    },
    "verifySignup": {"token": {"pattern": "\\S"}},      # apps/api/src/features/F1/verify-email/index.ts:226〜227
    "signInWithPassword": {"email": {"pattern": "\\S"}, "password": {"pattern": "\\S"}},   # apps/api/src/features/F1/login/sign-in.ts（空は 422 E-VAL-008）
    "verifySignInCode": {"code": {"pattern": "\\S", "maxLength": 64}, "backup_code": {"pattern": "\\S", "maxLength": 64}},   # apps/api/src/features/F1/login/sign-in-code.ts（空・64 文字を超えると 422 E-VAL-009）
    "renamePasskey": {"name": {"pattern": "\\S"}},     # apps/api/src/features/F1/passkeys/index.ts（空・空白だけは 422・K-309）
    "confirmTwoFactor": {"code": {"pattern": "\\S", "maxLength": 64}},   # apps/api/src/features/F1/two-factor/index.ts（空・6 けたでないは 422 欄 code・K-311）
    "consentToTerms": {"agree": {"enum": [True]}},      # apps/api/src/features/F1/consent-terms/index.ts:72
    "completeTicket": {   # apps/api/src/features/F5/approve-complete/complete.ts と app.ticket_complete（0100）。形の誤り（負の番号・整数でない版）は 422・false は 422 E-VAL-023
        "todo_checked": {"items": {"type": "integer", "minimum": 0}},
        "todo_version": {"minimum": 0},
        "conditions_confirmed": {"enum": [True]},
    },
    "finishBridgeJob": {"result": {"maxLength": 200000}},   # apps/api/src/features/F5/delegate/bridge.ts（REPLY_MAX・200000 字を超える結果は 422・K62-API-032）。その欄だけの上限（D-130.1 の外）
}
# 形全体の決まり（欄をまたぐ決まり・K-355）：operationId → JSON Schema の言葉（oneOf／anyOf／allOf／not だけ）。その口の入力の形にそのまま重ねる。
#   中で使う欄の名前（properties・required）は入力の形に在る物だけ（作り手 05_flow/build_api.py が確かめて止める）。チケットごとの分は screen_api.d に書く
INPUT_RULES: dict[str, dict] = {}
# 問い合わせの値域（K-468）：operationId → 問い合わせの名前 → JSON Schema の言葉（enum・pattern・minLength・maxLength・format・anyOf だけ）。
#   その口の問い合わせの欄に重ねる（作り手 05_flow/build_api.py の qparams）。口が 422 にするのは、契約に書けるこの形に合わない値だけ（書けない決まりの例外の表は足さない）。
#   名前が *_id・*_ids で終わる欄には書けない（uuid の形を壊さない）。チケットごとの分は screen_api.d の断片が同じ名前の表で足す
QUERY_RANGES: dict[str, dict[str, dict]] = {}
# 契約に書けない値の決まり（口の振る舞いのまま 422）。その口の 422 の説明と x-unexpressible-422 に書く。fuzz での扱いは K-62 の受け持ち
UNEXPRESSIBLE_422 = {
    "createTicket": ["期限が今日より前（E-VAL-012・今日は日本時間）", "暦に無い日付の期限・開始", "開始が期限より後", "優先度が高で理由が空",
                     "種別の必須の区画が空（E-VAL-013）", "グループ・種別・担当者・知らせる人がその会社に無いか書けない（E-VAL-014）",
                     "親のチケットが深すぎる（E-VAL-015）", "前後の空白・NFKC で長さが変わる題名"],
    "claimPairingCode": ["NFKC で英数字になる字（① など）"],
    "updateConversation": ["名前が null（空と同じ）"],
    "changePassword": ["漏れたことのあるパスワード（E-VAL-011）", "12 文字より短い・128 文字を超える新しいパスワード（E-VAL-005・E-VAL-026・文字の数で数える）", "今のパスワードが違う（欄 current_password）"],
    "setMyPassword": ["漏れたことのあるパスワード（E-VAL-011）", "12 文字より短い・128 文字を超える新しいパスワード（E-VAL-005・E-VAL-026・文字の数で数える）"],
    "createSignup": ["漏れたことのあるパスワード（E-VAL-011）", "制御文字・NFKC で形や長さが変わるメール・名前・会社名"],
    "stepUp": ["2 段階を使う人のコードが空（条件つき）", "password も passkey も無い・password が空（どちらか 1 つ・K-309）", "passkey が object でない"],
    "renamePasskey": ["NFKC と前後の空白を除いて 41 文字以上の名前", "制御文字（改行・タブ・NUL など）を含む名前"],
    "consentToTerms": ["無い版の ID（版の ID の在りか）"],
    "dismissSetupTasks": ["任意でない項目・知らない key"],   # K-250：key は形（string）だけ契約に書け、任意の項目（credentials）かは口が決める
    # K-332：名前とパスワードはログインしていない人だけが要る（条件つきなので必須にしない）。口（features/F2/invitations/accept.ts）が断る
    "acceptInvitation": ["ログインしていない人の名前が空・NFKC と前後の空白を落として 100 文字を超える（E-VAL-007）", "パスワードが 12 文字より短い・128 文字を超える（E-VAL-005・E-VAL-026）", "漏れたことのあるパスワード（E-VAL-011）"],
}
# 頭（header）で受ける値（operationId → 名前）。URL に載せるとアクセスの記録に残るものは頭で渡す（D-128.142）
HEADERS = {
    "getSignupStatus": ["x-signup-token"],
    "resendSignupEmail": ["x-signup-token"],
    # K-62：道具の鍵（その仕事の間だけ・DB にはハッシュだけ）。PC の印（x-bridge-session）と両方が要る（D-110）
    "callKanameTool": ["x-kaname-tool-token"],
}
RESPONSES = {
    "getScopeOverview": ("ScopeOverview", {"by_stage": "array", "milestones": "array", "recent": "array", "total": "integer"}),
    "previewTicketKindChange": ("TicketKindChangePreview", {"added_sections": "array", "removed_sections": "array", "moved_to_body": "array", "checks_reset": "boolean"}),
    "previewTicketDelete": ("TicketDeletePreview", {"children": "integer", "descendants": "integer", "attachments": "integer", "artifacts": "integer", "pending_approvals": "integer", "links": "integer", "running_runs": "integer", "descendant_pending_approvals": "integer", "descendant_running_runs": "integer", "restorable_until": "string"}),
    "search": ("SearchHit", {"kind": "string", "id": "string", "title": "string", "snippet": "string", "url": "string"}),
    "listTicketTimeline": ("TimelineItem", {"id": "string", "kind": "string", "at": "string", "actor": "object?", "message": "object?", "changes": "array?", "run": "object?", "deleted": "object?"}),
    "lintTestSpecs": ("TestSpecLint", {"missing": "array", "warnings": "array"}),
    "completeTicket": ("TicketCompletion", {"ticket": "object", "knowledge_candidates": "array", "skipped_reason": "string", "unchecked": "object"}),
    "bulkUpdateTickets": ("BulkResult", {"updated": "array", "skipped": "array"}),
    "listApprovalQueue": ("ApprovalQueueItem", {"kind": "string", "id": "string", "ticket_id": "string?", "ticket_number": "string", "title": "string", "from_member_id": "string", "from_name": "string", "check_summary": "string", "due_on": "string?", "decide_inline": "boolean", "irreversible": "boolean", "primary_action": "string", "secondary_action": "string", "note": "string?", "created_at": "string"}),   # K-161：期限なし・聞き直しでない行は due_on・note が null
    "getApproval": ("ApprovalDetail", {"approval": "object", "ticket": "object", "operation": "object", "message_text": "string", "artifact_version": "object", "checks": "array", "check_summary": "string", "cautions": "array", "irreversible": "boolean", "can_decide": "boolean", "chain": "array"}),
    "previewBulkApproval": ("BulkApprovalPreview", {"eligible": "array", "excluded": "array"}),
    "bulkApprove": ("BulkResult", {"updated": "array", "skipped": "array"}),
    "getCloneNow": ("CloneNow", {"current": "object", "next": "array", "waiting_approvals": "integer", "stopped": "integer"}),
    "getCloneGrowth": ("CloneGrowth", {"delegated": "integer", "passed_without_edit_rate": "number", "saved_hours": "number", "trend": "array", "often_fixed": "array"}),
    "countKnows": ("KnowsCounts", {"rules": "integer", "work_types": "integer", "memories": "integer", "candidates": "integer"}),
    "listCloneActivity": ("ActivityItem", {"kind": "string", "at": "string", "title": "string", "ticket_id": "string?", "used": "array", "result": "string"}),   # action_runs.ticket_id は null 可（K-62 が足した列）
    # 型の後ろの ? は null を許す（申し込みが無い・期限が無いときは null）
    "createSignup": ("SignupCreated", {"email": "string", "sent": "boolean", "mail_error": "string?", "mail_error_kind": "string?", "expires_at": "string", "signup_token": "string"}),
    "resendSignupEmail": ("SignupResent", {"email": "string?", "sent": "boolean", "mail_error": "string?", "mail_error_kind": "string?", "pending": "boolean", "registered": "boolean", "expired": "boolean"}),
    "getSignupStatus": ("SignupStatus", {"state": "string", "email": "string?", "expires_at": "string?"}),
    # 確定した（K-52）。ふつうは token にログインの印・signed_in=true。別のアカウントでログイン中に確定したら token=null・signed_in=false（D-128.137）。本人の id は返さない
    #   terms_pending（K-53）：確定の最後に refresh_terms_pending で決めたこのセッションの同意し直しの印。true なら画面は同意し直しの画面（/login?step=terms&next=…）へ
    "verifySignup": ("SignupVerified", {"email": "string", "token": "string?", "signed_in": "boolean", "terms_pending": "boolean"}),
    # 再設定のメールを頼んだ（K-313）。いつも accepted=true（登録の有無・送れたかを答えに出さない・D-042）
    "requestPasswordReset": ("PasswordForgotAccepted", {"accepted": "boolean"}),
    # パスワードで入った（K-301）。2 段階なし：token にログインの印・two_factor=false・pending=null。2 段階あり：token=null・two_factor=true・pending に待ちの印（中身の見えない文字列・5 分。6 けたで入るのは K-302）
    "signInWithPassword": ("SignInResult", {"token": "string?", "two_factor": "boolean", "pending": "string?"}),
    # 確認のコードで入った（K-302）。token にログインの印・backup_codes_left に残りのバックアップコードの数。TOTP の鍵・コードは返さない
    "verifySignInCode": ("SignInCodeResult", {"token": "string", "backup_codes_left": "integer"}),
    # ログアウトした（K-306）。いつも signed_out=true。閉じたのはその画面のセッションだけ（別のブラウザ・PC は残る）
    "signOut": ("SignedOut", {"signed_out": "boolean"}),
    # 管理者に頼んだ（K-305）。sent（届けた）・already（1 時間の内に頼んである）・failed（1 通でも送れなかった・押し直せる）・no_admin（本人のほかに管理者がいない・運営が戻す）
    "requestAdminRecovery": ("AdminRecoveryResult", {"result": "string"}),
    # 新しいパスワードを決めた（K-314）。いつも reset=true。ログインの印は入れない（再設定の後は自動で入らない・D-125.140）
    "resetPassword": ("PasswordResetDone", {"reset": "boolean"}),
    # 規約の今の版（K-53）：kind ごとに 1 つ。作った人・運営のテナントの ID は返さない
    "getCurrentTerms": ("CurrentTerms", {"id": "string", "kind": "string", "version": "string", "url": "string", "published_at": "string"}),
    "consentToTerms": ("TermsConsented", {"consented": "boolean"}),
    # 会話と記憶の口（K-144 ㉒）：表の行ではなく、口（apps/api/src/hooks/agent.ts）が返すとおりの形
    "createConversation": ("ConversationCreated", {"id": "uuid", "conversation_id": "uuid"}),
    "updateConversation": ("ConversationUpdated", {"id": "uuid", "ok": "boolean"}),
    "updateMemory": ("MemoryUpdated", {"id": "uuid", "ok": "boolean"}),
    # K-308：端末の一覧（sessions）と安全の記録（recent_events）は F10 の口に回した。mfa_pending は付けるまで進めない印（D-128.141）。backup_codes_left は部品が読めないとき null（K308-API-013）
    "getMySecurity": ("MySecurity", {"passkeys": "array", "has_password": "boolean", "two_factor": "boolean", "two_factor_required": "boolean", "backup_codes_left": "integer?", "mfa_pending": "boolean"}),
    # K-311：secret は認証アプリに手で入れる鍵の文字（この答えの 1 回だけ）。期限は設けない（PM が決めた作り方 2026-11-17）
    "startTwoFactor": ("TwoFactorSetup", {"otpauth_uri": "string", "secret": "string"}),
    # K-311：バックアップコード 10 個はこの答えの 1 回だけ。部品がセッションを作り直したら token に新しい印（無ければ null・画面は差し替える）
    "confirmTwoFactor": ("TwoFactorEnabled", {"backup_codes": "string[]", "token": "string?"}),
    "regenerateBackupCodes": ("BackupCodes", {"codes": "array"}),
    "stepUp": ("StepUp", {"step_up_at": "string", "valid_until": "string"}),
    # K-312：revoked は切った Kaname のセッションの数（今の画面のほか・全部のワークスペースの端末と PC）
    "changePassword": ("PasswordChanged", {"revoked": "integer"}),
    "setMyPassword": ("PasswordSet", {"ok": "boolean"}),
    "getMe": ("Me", {"member": "object", "workspaces": "array", "workspace_name": "string?"}),   # workspace_name：今いる会社の名前（前後の空白を取り、空なら null）。今は GET /api/auth-ext/me が返す（K-253）
    "getMyUsage": ("MyUsage", {"five_hour": "object", "month": "object", "by_workspace": "array", "notify_at_percent": "integer", "on_exhausted": "string"}),
    # K-250：はじめにやること（passkey・pc・credentials の 3 つ）。passkey は機能ができるまで available false・行き先 null（D-145.11）。credentials は任意（optional）で「あとで」で飛ばせる（skipped・D-145.13）
    "listSetupTasks": ("SetupTask", {"key": "string", "label": "string", "desc": "string", "done": "boolean", "href": "string?", "available": "boolean", "optional": "boolean", "skipped": "boolean"}),
    # K-250：閉じる・飛ばすの後の今の状態（箱を閉じたか・飛ばした項目）
    "dismissSetupTasks": ("SetupTasksDismissed", {"dismissed": "boolean", "skipped": "string[]"}),
    "getNotificationSettings": ("NotificationSettings", {"email_digest": "boolean", "quiet_hours": "object", "paused_until": "string?", "urgent_override": "array", "events": "array"}),
    "createPairingCode": ("PairingCode", {"code": "string", "expires_at": "string"}),
    "getLatestBridgeRelease": ("BridgeRelease", {"released": "boolean", "version": "string", "released_at": "string", "update": "object?"}),   # その OS・CPU の更新が無いと update: null
    "claimPairingCode": ("BridgeClaim", {"device_token": "string", "device_id": "string", "member_id": "string", "device_label": "string"}),
    # 置き場が外なら短い期限の署名 URL（D-128.153）。手元のフォルダならファイルそのもの（JSON ではない）
    "downloadBridgeRelease": ("BridgeReleaseLink", {"url": "string", "expires_at": "string"}),
    "sendHeartbeat": ("BridgeHeartbeat", {"ok": "boolean", "browser": "string?", "outdated": "boolean", "device_id": "string"}),
    "listMyDevices": ("BridgeDevice", {"id": "string", "device_label": "string?", "state": "string", "last_seen_at": "string?", "connected_at": "string", "version": "string?", "health": "array", "health_at": "string?", "browser": "string", "revoke_reason": "string?"}),
    # can：見ている人ができること（K-62 が delegate を足す・D-128.138）
    "getTicket": ("TicketDetail", {"ticket": "object", "sections": "array", "kind": "object?", "stage": "object?", "assignee": "object?", "can": "object", "approval": "object?", "completed": "object?", "time": "object", "hold": "object?"}),   # approval：決まっていない承認待ち 1 つ（K-162・D-128.178）。can.complete と completed（完了の時刻と押した人の名前。完了の前は null）は K-165。can.progress・can.actual・time（予定・人の分・AI の分）・hold（保留の理由・再開の条件・時刻・人。保留でなければ null）は K-387
    "listTicketKinds": ("TicketKindChoice", {"id": "string", "name": "string", "color": "string?", "position": "integer", "is_builtin": "boolean", "sections": "array"}),
    "listMyTicketDrafts": ("TicketDraft", {"draft_id": "string", "body": "object?", "saved_at": "string?"}),
    "saveMyTicketDraft": ("TicketDraft", {"draft_id": "string", "body": "object?", "saved_at": "string?"}),   # 捨てた・使い終わった下書きは body・saved_at が null
    # K-62：仕事は行の中身をそのまま job に（無ければ null）。古い Bridge には渡さず outdated（E-CONN-012）
    "takeBridgeJob": ("BridgeJob", {"job": "object?", "forbidden_domains": "array", "next_ms": "integer", "outdated": "boolean"}),
    "getJobControl": ("JobControl", {"stop": "boolean", "reason": "string?", "steers": "array"}),   # 止める理由が無ければ null（K-62・Q2 回 2）
    "delegateTicket": ("TicketDelegation", {"run_id": "string", "job_id": "string", "status": "string", "pc": "string"}),
    # K-162：承認した答え（pc は任せた人の PC が 75 秒以内に知らせていれば live・K-62 と同じ式）。差し戻し（K-163）も同じ形
    "approveApproval": ("ApprovalDecided", {"id": "string", "decision": "string?", "decided_at": "string?", "status_id": "string?", "ticket_id": "string?", "run_id": "string", "pc": "string"}),
    "returnApproval": ("ApprovalDecided", {"id": "string", "decision": "string?", "decided_at": "string?", "status_id": "string?", "ticket_id": "string?", "run_id": "string", "pc": "string"}),
    "finishBridgeJob": ("BridgeFinish", {"ok": "boolean", "outcome": "string"}),
    "callKanameTool": ("BridgeToolResult", {"result": "object?"}),   # 道具の答え（ticket_read の区画・会話の道具の答え）。無ければ null
    # 実行の 1 件（K-62）。今の実行の様子を読む 1 つの口（K-63 も使う）。pc は live／asleep、checks.state は検査が入るまで none。
    #   まだ無い時刻・途中の 1 行・止まった理由・差し戻しの理由は null（? は null を許す・Q2 回 2）
    "getActionRun": ("ActionRunView", {"id": "string", "ticket_id": "string", "phase": "string", "status": "string", "by": "object", "pc": "string",
                                        "silent": "boolean", "last_event_at": "string?", "progress": "string?", "stopped_reason": "string?",
                                        "return_reason": "string?", "started_at": "string?", "finished_at": "string?", "taken_over_at": "string?", "reason_kind": "string?", "checks": "object"}),
    "listTicketRuns": ("ActionRunView", {"id": "string", "ticket_id": "string", "phase": "string", "status": "string", "by": "object", "pc": "string",
                                          "silent": "boolean", "last_event_at": "string?", "progress": "string?", "stopped_reason": "string?",
                                          "return_reason": "string?", "started_at": "string?", "finished_at": "string?", "taken_over_at": "string?", "reason_kind": "string?", "checks": "object"}),
    # K-354：PC の鍵でしか開けない封（平文を返さない）。封の外は情報の id・種類・名前・使える場所・2 段階の種類・期限だけ
    "resolveCredential": ("ResolvedCredential", {"credential_id": "uuid", "kind": "string", "name": "string", "destinations": "array", "two_factor": "string",
                                                 "expires_at": "string?", "server_key": "string", "iv": "string", "tag": "string", "ciphertext_for_executor": "string"}),
    "getWorkTypeUpload": ("WorkTypeUploadCheck", {"package": "object", "checks": "array", "passed": "boolean", "test_scenarios": "integer", "changelog": "string?"}),
    "getPlanProposalImpact": ("PlanProposalImpact", {"tenants": "integer", "monthly_revenue_diff": "integer", "existing_from": "string", "new_from": "string?", "by_workspace": "array"}),
    "checkRule": ("RuleCheck", {"conflicts": "array", "similar": "array", "needs_approval_from": "string", "warnings": "array"}),
    "getWorkspaceMembers": ("WorkspaceMembers", {"groups": "array", "invitations": "array", "alerts": "array", "count": "integer"}),
    "createInvitationLink": ("InvitationLink", {"url": "string", "expires_at": "string"}),
    "getMember": ("MemberDetail", {"member": "object", "groups": "array", "role_bundle": "object", "granted": "array", "revoked": "array", "assigned": "object", "clone": "object", "login": "object", "recent_events": "array"}),
    "previewMemberRemoval": ("MemberRemovalPreview", {"tickets": "array", "handovers_cancelled": "array", "approvals_reassigned": "array", "sole_approver": "array", "deleted": "array", "kept": "array", "restorable_until": "string"}),
    "getWorkspaceRules": ("WorkspaceRules", {"rules": "array", "rules_by_layer": "array", "escalations": "array", "work_types": "array"}),
    "previewEscalationRule": ("EscalationPreview", {"matched_last_month": "integer", "examples": "array"}),
    "getExport": ("ExportStatus", {"status": "string", "url": "string", "expires_at": "string?"}),
    "getWorkspaceSettings": ("WorkspaceSettings", {"workspace": "object", "plan": "object", "subscription": "object", "price_change": "object", "permissions": "array", "fixed_rules": "array", "deletion": "object"}),
    "listWorkspacePlans": ("PlanChoice", {"plan_id": "string", "name": "string?", "price_monthly": "integer?", "limits": "object?", "current": "boolean", "can_choose": "boolean", "reason": "string", "effective_from": "string"}),
    "getBilling": ("Billing", {"payee": "object", "billing_contact": "object", "terms": "string", "invoices": "array"}),
    "downloadInvoicePdf": ("SignedUrl", {"url": "string", "expires_at": "string"}),
    "listClients": ("ClientRow", {"id": "string", "name": "string", "summary": "string", "groups": "array", "owner_member_id": "string?", "visibility": "string", "active_tickets": "integer", "open_requests": "integer", "waiting_acceptances": "integer", "last_activity_at": "string"}),
    "listClientLinkCandidates": ("ClientLinkCandidate", {"ticket_id": "string", "number": "string", "title": "string", "reason": "string"}),
    "getClient": ("ClientDetail", {"client": "object", "groups": "array", "contacts": "array", "todo": "array", "rules": "array", "knowledge": "array", "counts": "object"}),
    "listClientActivity": ("ClientActivityItem", {"at": "string", "actor": "object", "kind": "string", "text": "string", "ticket_id": "string", "client_visible": "boolean"}),
    "getClientPortalPreview": ("PortalHome", {"to_review": "array", "requests": "array", "tickets": "array"}),
    "getClientRequest": ("ClientRequestDetail", {"request": "object", "messages": "array", "ticket_draft": "object", "questions": "array", "reply_draft": "string", "route_suggestion": "object"}),
    "getPortalHome": ("PortalHome", {"to_review": "array", "requests": "array", "tickets": "array"}),
    "askPortalRequestQuestions": ("PortalQuestions", {"available": "boolean", "questions": "array"}),
    "getPortalRequest": ("PortalRequest", {"request": "object", "messages": "array"}),
    "getPortalTicket": ("PortalTicket", {"title": "string", "stage": "string", "due_on": "string?", "artifacts": "array", "messages": "array", "sections": "array"}),
    "getPortalAcceptance": ("PortalAcceptance", {"acceptance": "object", "artifact": "object", "preview_url": "string", "message": "string?", "due_on": "string?"}),
    "getKnowledgeHome": ("KnowledgeHome", {"to_verify": "array", "proposals": "array", "recent": "array", "popular": "array", "count": "integer"}),
    "getKnowledgeTree": ("KnowledgeTree", {"company_name": "string", "company_nodes": "array", "groups": "array", "my_nodes": "array", "can_write": "object", "admin_counts": "object?", "truncated": "boolean"}),   # K-675（土台 3.1）
    "askKnowledge": ("KnowledgeAnswer", {"mode": "string", "answer": "string", "citations": "array", "hits": "array"}),
    "getKnowledgePage": ("KnowledgePageDetail", {"id": "uuid", "title": "string", "desc": "string", "state": "string", "must": "boolean", "must_blocked": "string?", "place": "object", "acts": "array", "body": "object?", "draft": "object?", "request": "object?", "copied_from": "object?", "shared_from": "object?", "raise_to": "object?", "foot": "object"}),   # K-675（土台 3.1）
    "getKnowledgeUsage": ("KnowledgeUsage", {"reads_3m": "integer", "returns": "integer", "recent_tickets": "array", "hot_sections": "array"}),
    "getKnowledgeLinks": ("KnowledgeLinks", {"nodes": "array", "edges": "array", "unlinked_mentions": "array"}),
    "searchKnowledgeLinkTargets": ("KnowledgeLinkTarget", {"kind": "string", "id": "string", "title": "string", "place": "string"}),
    "listKnowledgeVerifications": ("KnowledgeVerification", {"page_id": "string", "title": "string", "place": "string", "owner_member_id": "string", "due_on": "string", "interval": "string", "ai_check": "string", "suggested_action": "string", "newer_page_id": "string"}),
    "exportKnowledgeMarkdown": ("SignedUrl", {"url": "string", "expires_at": "string"}),
    "getKnowledgeImport": ("KnowledgeImportPreview", {"source": "string", "pages": "integer", "folders": "integer", "links": "integer", "topics": "integer", "images": "integer", "mapping": "object", "warnings": "array"}),
    "listOpsWorkspaces": ("OpsWorkspaceRow", {"id": "string", "name": "string", "admin": "object", "plan": "string", "members": "string", "pc_connected": "string", "runs_month": "integer", "attention": "array", "billing": "string", "state": "string"}),
    "getOpsWorkspace": ("OpsWorkspace", {"workspace": "object", "pc": "object", "runs": "object", "stopped": "object", "files": "object", "stop_reasons": "array", "recent": "array", "info": "object"}),
    "listOpsWorkspaceMembers": ("OpsWorkspaceMember", {"name": "string", "email": "string", "role": "string", "last_seen_at": "string", "pc": "string", "login": "string"}),
    "getOpsWorkspaceBilling": ("OpsWorkspaceBilling", {"plan": "object", "usage": "object", "payment_terms": "string", "invoices": "array"}),
    "getShell": ("Shell", {"approvals_waiting": "integer", "notifications_unread": "integer", "groups": "array", "pc": "object", "setup_left": "integer", "banner": "object", "workspace": "object"}),
    "getOpsShell": ("OpsShell", {"inquiries_unassigned": "integer", "inquiries_mine": "integer", "invoices_overdue": "integer", "banner": "object"}),
    "getTicketShape": ("TicketShape", {"kinds": "array", "stages": "array", "axes": "array", "handover_rules": "array", "limits": "object", "template_updates": "integer"}),
    "previewTicketShapeChange": ("TicketShapeChangePreview", {"removed": "array", "needs_move_to": "array", "affected_tickets": "integer", "over_limits": "array"}),
    "getOpsInquiry": ("OpsInquiryDetail", {"inquiry": "object", "messages": "array", "context": "object", "workspace": "object"}),
    "getOpsNotice": ("OpsNoticeDetail", {"notice": "object", "updates": "array", "affects": "object", "placements": "array"}),
    # いまの様子（K-307・誰でも）：直っていない障害（公開したお知らせに結んだもの）といま中のメンテナンスだけ。ログイン後の口の型 ServiceStatus とは分ける
    "getServiceStatus": ("PublicServiceStatus", {"incidents": "array", "maintenance": "object?"}),
    # 招待の下見（K-331）：表の写し（token_hash まで出る）でなく、画面が形を決める欄だけ。signed_in はログイン中だけ { email, email_matches, already_member }
    "getInvitation": ("InvitationPreview", {"state": "string", "workspace_name": "string", "inviter_name": "string?", "group_name": "string?",
                                            "role": "string", "message": "string?", "email": "string?", "expires_at": "string",
                                            "account_exists": "boolean", "signed_in": "object?"}),
    # 招待で参加した（K-332）：ログインの印（部品のセッションの token）・入ったワークスペース・次に移る画面（入った直後は /mfa-setup）
    "acceptInvitation": ("InvitationAccepted", {"token": "string", "workspace_id": "string", "next": "string"}),
    "getServiceStatusForMember": ("ServiceStatus", {"components": "array", "banner": "object", "maintenance": "object"}),
}
# 一覧の答えの meta に足す数（数だけの API を作らず、一覧の 1 回目で返す・D-128.111）。値は型の名前か、型の決まりの辞書（null を返す欄・K-92）
META = {
    "listScopes": {"writable": "array"},   # チケットを書けるグループの id（K-60）
    "listSetupTasks": {"dismissed": "boolean"},   # 箱を「いまは閉じる」で閉じたか（K-250・D-128.62）
    "listApprovalQueue": {"counts": "object"},
    "listClients": {"counts": "object"},
    "listOpsWorkspaces": {"summary": "object"},
    "listOpsInquiries": {"counts": "object"},
    "listOpsInvoices": {"summary": "object"},
}
# 上限の差し替え（operationId → 1 分あたりの回数と鍵）。無い口は public 10/ip・GET 120/user・それ以外 60/user
RATES = {
    "claimPairingCode": "5/min/ip",   # 総当たりを防ぐ（D-089）
}
# 一覧の口の細目（K-92）：limit の上限・sort を受けない口・説明（行為から作る説明の代わり）・答えの meta の形（endpoints.json の outputs_2xx）
LIST_DETAILS = {
}
# 一覧の絞り込み（operationId → query の名前）。cursor・limit・sort はいつも付く（sort は LIST_DETAILS で外せる）
QUERIES = {
    "search": ["q", "kinds"],
    "listNotifications": ["unread", "actor_member_id"],
    "listMembers": ["scope_id", "q"],
    "listClients": ["q", "mine", "scope_id", "has_requests", "waiting_acceptance"],
    "listSavedViews": ["share"],
    "listApprovalQueue": ["kind", "sort"],
    "listApprovalHistory": ["decision", "from", "to"],
    "listConversations": ["q", "starred"],
    "listMemories": ["kind", "since"],
    "listLearningCandidates": ["trigger", "target"],
    "listRules": ["scope", "client_id"],
    "listWorkTypes": ["origin", "sort"],
    "listCloneActivity": ["kind", "from", "to"],
    "listCredentials": [],   # 絞り込みを受けない（会社はセッションから決める・cursor と limit は形だけ・K-351）
    "listPlanProposals": ["state"],
    "listPlanHistory": ["plan_id"],
    "getNotificationSettings": ["tenant_id"],
    "getLatestBridgeRelease": ["os", "arch"],   # 一覧でない口の問い合わせ（K-144）。値が違えば update: null
    "listAuditEvents": ["q", "kind", "member_id", "ticket_id", "from", "to"],
    "listScopes": ["layer_id"],
    "listClientActivity": ["client_visible"],
    "listClientRequests": ["state", "client_id"],
    "listClientLinkCandidates": ["name", "domain"],
    "listKnowledgePages": ["scope_id", "parent_id", "topic", "owner_id", "state", "sort"],
    "searchKnowledgeLinkTargets": ["q"],
    "listKnowledgeVerifications": ["mine", "soon"],
    "listKnowledgeProposals": ["mine"],
    "listOpsWorkspaces": ["q", "attention", "state", "plan", "sort"],
    "listOpsInquiries": ["box", "kind", "sort"],
    "listOpsNotices": ["kind", "state"],
    "listOpsInvoices": ["month", "state"],
    "listOpsWorkspaceAudit": ["from", "to"],
    "listNotices": ["kind", "unread"],
}

# 誰が呼べるか（03_architecture/ゼロトラストの決まり.md §2・ZT1・ZT5）。operationId → (権限, 範囲の説明, step_up)
#   step_up が True の API は直前（15 分以内）の本人確認が無いと 403。"irreversible" は取り消せない操作のときだけ要る
#   "admin_role" は管理者の役割を付けるときだけ要る
PERMS = {
    # チケット
    "listTickets": ("read", "見られるグループのチケットだけ（RLS）", False),
    "getScopeOverview": ("read", "そのグループが見える人（席のグループとその下・権限の付いたグループ。見えないグループは 404）。数えるのは見えるチケットだけ", False),
    "search": ("read", "見られるチケット・ページ・決定・自分の会話だけ", False),
    "getTicket": ("read", "そのチケットのグループを見られる人", False),
    "createTicket": ("write", "書けるグループにだけ作れる。複製・AI の案も同じ", False),
    "updateTicket": ("write", "そのチケットを書ける人（担当者・書ける権限の人）。今は段・実績・保留の理由と再開の条件だけ（ほかの欄は段 8・E-VAL-018）。期限と担当を変えるときは理由が必須（段 8）", False),
    "previewTicketKindChange": ("write", "そのグループの人", False),
    "listWorkTypeCandidates": ("read", "その人が使える業務の型だけ", False),
    "previewTicketDelete": ("assignee", "作った人か、そのグループで tickets の edit を持つ人（D-125.62・P14）", False),
    "deleteTicket": ("assignee", "作った人か、そのグループで tickets の edit を持つ人（D-125.62）。子・孫の扱い（children）を選ぶ", False),
    "restoreTicket": ("assignee", "消した本人と、そのグループのマネージャー・管理者（D-128.84）", False),
    "completeTicket": ("write", "そのチケットを直せる人なら誰でも（担当者・書ける権限の人・D-128.138）。完了の条件は同じ", False),
    "bulkUpdateTickets": ("write", "1 件ずつ updateTicket と同じ権限で確かめ、権限の無い行は外して理由を返す", False),
    "listMyTicketDrafts": ("self", "自分の下書きだけ（いま入っているワークスペースの分）", False),
    "saveMyTicketDraft": ("self", "自分の下書きだけ", False),
    "createTicketImport": ("write", "取り込む先のグループに書ける人", False),
    "getTicketImport": ("self", "取り込んだ本人", False),
    "commitTicketImport": ("self", "取り込んだ本人（確定のときに取り込む先の権限をもう一度確かめる）", False),
    "updateTicketBody": ("write", "そのグループの人", False),
    "listTicketVersions": ("read", "そのチケットを見られる人", False),
    "restoreTicketVersion": ("write", "そのグループの人", False),
    "makeKindTemplateFromTicket": ("admin", "チケットの形を直せる人（D-128.48・D-128.83）", False),
    "listTestSpecs": ("read", "そのチケットを見られる人", False),
    "createTestSpec": ("write", "そのグループの人", False),
    "updateTestSpec": ("write", "そのグループの人。OFF にするときは理由が必須", False),
    "deleteTestSpec": ("write", "そのグループの人", False),
    "suggestTestSpecs": ("write", "そのグループの人（分身は呼んだ人の権限の中で動く）", False),
    "lintTestSpecs": ("write", "そのグループの人", False),
    "listChecks": ("read", "そのチケットを見られる人", False),
    "markHumanCheck": ("approver", "③ 人の確認を割り当てられた人（承認する人）", False),
    "delegateTicket": ("write", "そのチケットを直せる人なら誰でも（D-128.138）。動くのは押した人の AI（その人の PC）", False),
    "dryRunTicket": ("assignee", "担当者（宛先は自分に差し替える）", False),
    "listTicketRuns": ("read", "そのチケットを見られる人", False),
    "getActionRun": ("read", "そのチケットを見られる人。ブラウザの様子の写しは担当者と承認する人だけ", False),
    "stopActionRun": ("assignee", "担当者・承認する人・マネージャー", False),
    "listTicketReferences": ("read", "そのチケットを見られる人。見られないページは題名も出さない", False),
    "listTicketTimeline": ("read", "そのチケットを見られる人", False),
    "createTicketMessage": ("read", "そのチケットを見られる人（閲覧のみの人も書ける。段や決定は変えられない・⑧）", False),
    "updateTicketMessage": ("self", "書いた本人", False),
    "deleteTicketMessage": ("read", "書いた本人か、そのチケットのグループのマネージャー（口と DB の関数が確かめる）。消すと 1 行の跡が残る（⑪）", False),
    "starTicketMessage": ("read", "そのチケットを見られる人（自分の印だけ）", False),
    "listTicketDecisions": ("read", "そのチケットを見られる人（見るだけの人も読める）", False),
    "createTicketDecision": ("write", "そのチケットを書ける人（見るだけの人は足せない・⑧）。決めた人は同じ会社の今のメンバー（既定は本人）", False),
    "updateTicketDecision": ("write", "そのチケットを書ける人（見るだけの人は変えられない・⑧）", False),
    "createTicketHandover": ("write", "渡すは担当者、配るはマネージャー、引き取りの申し出はメンバー、上へ上げるは担当者", False),
    "answerTicketHandover": ("recipient", "渡された・判断を仰がれた相手だけ", False),
    "listTicketLinks": ("read", "両方のチケットを見られる人（片方が見えないときは番号だけ）", False),
    "createTicketLink": ("write", "両方のチケットに書ける人", False),
    "deleteTicketLink": ("write", "そのグループの人", False),
    "listTicketArtifacts": ("read", "そのチケットを見られる人", False),
    "getArtifactVersion": ("read", "そのチケットを見られる人（ファイルは期限つきの署名 URL）", False),
    "createTicketAttachment": ("write", "そのグループの人（大きさ・種類の上限）", False),
    "requestAcceptance": ("assignee", "担当者とマネージャー。送る先はその取引先の人だけ", False),
    "listSavedViews": ("self", "自分のものと、グループの全員に見せたもの", False),
    "createSavedView": ("self", "グループの全員に見せるのは、そのグループが見える人（見えないグループは 404）", False),
    "updateSavedView": ("self", "作った本人", False),
    "deleteSavedView": ("self", "作った本人", False),
    "listNotifications": ("self", "自分あてだけ", False),
    "readNotification": ("self", "自分あてだけ", False),
    "readAllNotifications": ("self", "自分あてだけ", False),
    "listTicketKinds": ("read", "そのワークスペースのメンバー", False),
    "listTicketStages": ("read", "同上", False),
    "listTicketFields": ("read", "そのワークスペースのメンバー", False),
    "listMembers": ("read", "同上（メールは管理者と本人だけ）", False),
    "listClients": ("read", "見られる取引先だけ（担当グループだけの取引先・D-128.54）", False),
    # 承認待ち
    "listApprovalQueue": ("self", "自分が決めるものだけ", False),
    "getApproval": ("approver", "承認する人。担当者とマネージャーは読むだけ", False),
    "approveApproval": ("approver", "承認する人だけ。本人確認は取り直さない（D-128.177）", False),
    "editApproval": ("approver", "承認する人", False),
    "returnApproval": ("approver", "承認する人（理由が必須）", False),
    "stopApproval": ("approver", "承認する人・担当者・マネージャー", False),
    "withdrawApproval": ("approver", "承認した本人だけ・実行中になる前だけ（D-125.105）", False),
    "previewBulkApproval": ("approver", "自分が承認するものだけ", False),
    "bulkApprove": ("approver", "自分が承認するもので、条件（D-128.86）に合うものだけ。サーバーがもう一度確かめる", False),
    "listApprovalHistory": ("self", "自分が決めたものだけ", False),
    # チケットの右のパネル（そのチケットでの自分の分身との話）
    "getTicketAgentSession": ("read", "そのチケットを見られる人。話は自分の分身とのものだけ（ほかの人の話は見えない）", False),
    "sendTicketAgentMessage": ("write", "そのチケットに書ける人。分身は呼んだ人の権限の中でだけ読む・動く。外に出る操作は承認を通る", False),
    "applyTicketAgentProposal": ("write", "そのチケットに書ける人。反映すると確認をやり直す", False),
    # 分身の部屋（自分の分身のことは本人だけ）
    "getMyClone": ("self", "自分の分身だけ", False),
    "updateMyClone": ("self", "自分の分身だけ（許可のモード・自動で覚える）。全部許可にするのは本人が選んだときだけ", False),
    "listConversations": ("self", "自分の会話だけ（管理者も運営も中身は見ない。運営が中を見る 1 時間の許可のときだけ）", False),
    "createConversation": ("self", "自分の分身とだけ", False),
    "getConversation": ("self", "自分の会話だけ", False),
    "updateConversation": ("self", "自分の会話だけ（名前・星・記憶に使わない・閉じる）", False),
    "deleteConversation": ("self", "自分の会話だけ", False),
    "listConversationMessages": ("self", "自分の会話だけ", False),
    "streamConversation": ("self", "自分の会話だけ。書きながらの返事・何をしているか・手順を流す（D-104.8）", False),
    "sendConversationMessage": ("self", "自分の会話だけ。分身は本人の権限の中でだけ読む・動く", False),
    "stopConversation": ("self", "自分の会話だけ", False),
    "createConversationAttachment": ("self", "自分の会話だけ（大きさ・種類の上限）", False),
    "answerAgentPermission": ("self", "自分の分身の許可だけ", False),
    "createArtifactFromMessage": ("self", "自分の会話の返事だけ", False),
    "updateArtifact": ("self", "書き出した本人。チケットに付いた成果物はそのチケットに書ける人", False),
    "restoreArtifactVersion": ("self", "同上", False),
    "getShell": ("self", "本人の数だけ（承認待ち・知らせ・星を付けたグループの件数・PC のつながり・はじめにやることの残り・帯）", False),
    "countKnows": ("self", "自分の分身が知っていること（自分・使える取引先・層・ワークスペースの決まりを含む）", False),
    "listMemories": ("self", "自分の記憶だけ", False),
    "createMemory": ("self", "自分の記憶だけ", False),
    "updateMemory": ("self", "自分の記憶だけ", False),
    "deleteMemory": ("self", "自分の記憶だけ", False),
    "promoteMemoryToRule": ("self", "自分の守ることにするだけ。ぶつかりは点検し、上の決まりとぶつかるときは例外の申請へ", False),
    "listLearningCandidates": ("self", "自分の分身の覚えたいこと。層に上がってきたものはその層のマネージャー", False),
    "acceptLearningCandidate": ("self", "自分のものは本人。層・ワークスペースに入れるのはマネージャー・管理者（D-125.110）", False),
    "dismissLearningCandidate": ("self", "同上", False),
    "postponeLearningCandidate": ("self", "本人", False),
    "requestRuleException": ("self", "本人が申請する。OK するのは管理者かその層のマネージャー（承認待ち・D-128.89）", False),
    # 守ること
    "listRules": ("read", "自分のもの・自分が使える取引先・自分の層・ワークスペースの決まり", False),
    "getRule": ("read", "同上。効いた記録は見られるチケットのものだけ", False),
    "checkRule": ("self", "書いている本人（点検だけで何も変えない）", False),
    "createRule": ("self", "自分の守ることは本人。取引先の守ることはその取引先の担当とマネージャー。層・ワークスペースの決まりはワークスペースの管理から（ここでは作れない）", False),
    "updateRule": ("self", "作った本人と、その範囲を直せる人。上の層の決まりは直せない（写して自分用にする）", False),
    "deleteRule": ("self", "同上", False),
    # やり方（業務の型）
    "listWorkTypes": ("read", "自分のもの・層から・ワークスペースから・運営の全社向け のうち使えるものだけ", False),
    "getWorkType": ("read", "同上。裏のスキルの作りは見せず、欄と説明だけ（D-126.21）", False),
    "createWorkType": ("self", "自分のやり方として作る", False),
    "copyWorkType": ("self", "使えるやり方を写して自分用にする", False),
    "updateWorkTypeDraft": ("self", "自分のやり方は本人。層のやり方はその層のマネージャー、ワークスペースのものは管理者", False),
    "listWorkTypeVersions": ("read", "そのやり方を使える人", False),
    "tryWorkType": ("self", "直せる人。外には何も出ない（試すだけ）", False),
    "releaseWorkType": ("self", "直せる人。機械の検査が通らない版は使い始められない", False),
    "requestWorkTypeSpread": ("self", "本人が申請する。OK するのはそのグループのマネージャー（承認待ち・D-128.89）", False),
    # やったこと
    "getCloneNow": ("self", "自分の分身だけ", False),
    "getCloneGrowth": ("self", "自分の分身だけ", False),
    "listCloneActivity": ("self", "自分の分身がやったことだけ", False),
    "exportCloneActivity": ("self", "自分の分身がやったことだけ", False),
    "takeoverActionRun": ("assignee", "そのチケットの担当者だけ（自分で進める形に切り替える。動いている・待っている仕事はその場で止める）", False),
    # ログイン・登録（ログイン前は public。どれも IP ごとの上限が厳しい・同じ答えを返して有る無しを漏らさない）
    "createSignup": ("public", "誰でも。確認のメールを押すまで会社も利用者も作らない（D-088.2）。漏れたパスワードは弾く（D-125.137）", False),
    "getSignupStatus": ("public", "申し込んだ本人の画面（申し込みの印で）。メールの有る無しは漏らさない", False),
    "resendSignupEmail": ("public", "同上。送る回数に上限", False),
    "getCurrentTerms": ("public", "誰でも", False),
    "verifySignup": ("public", "確認のメールのリンクを持つ人（1 回だけ・期限つき）", False),
    "signInWithPassword": ("public", "誰でも。失敗が続くと鍵をかける。会社が止められていれば入れない（D-125.126）", False),
    "verifySignInCode": ("public", "パスワードを通った直後の人だけ（その途中の印で・5 分）", False),
    "requestAdminRecovery": ("public", "パスワードを通った直後の人だけ。管理者に知らせが届き、管理者が本人を確かめて戻す", False),
    "consentToTerms": ("self", "本人。規約が変わったら次のログインで同意し直す（D-125.162）", False),
    "stepUp": ("self", "本人。パスキーなら指 1 本、パスワードの人は 2 段階のコードも。15 分効く（D-125.139）", False),
    "signOut": ("self", "本人", False),
    "requestPasswordReset": ("public", "誰でも。メールの有る無しにかかわらず同じ答え", False),
    "resetPassword": ("public", "再設定のリンクを持つ人（1 回だけ・期限つき）。済んだら全部の端末と Bridge を切る（D-125.140）", False),
    "getInvitation": ("public", "招待のリンクを持つ人（期限つき）。見せるのはワークスペースの名前・招いた人・グループ・役割・ひとことと、招待の状態・宛てのアカウントの有無・ログイン中の様子だけ（K-331）", False),
    "acceptInvitation": ("public", "招待のリンクを持つ人。ログイン中なら今のアカウントで入り、無ければ作る（D-125.150）", False),
    # 自分の安全の設定
    "getMySecurity": ("self", "自分のものだけ", False),
    "renamePasskey": ("self", "自分のパスキーだけ", False),
    "deletePasskey": ("self", "自分のパスキーだけ。最後の入り方は消せない。取り直しか、ログインから 15 分の内（K-309・代表の答え ⑬）", "login_or_step_up"),
    "startTwoFactor": ("self", "本人。パスワードの無い人（パスキーだけ）は先にパスワードを決める（409・E-AUTH-020）", "login_or_step_up"),
    "confirmTwoFactor": ("self", "本人（コードがそろったら付く。バックアップコードは 1 回だけ見せる）", False),
    "disableTwoFactor": ("self", "本人。パスキーを持たずパスワードだけで入る人は外せない（D-128.61）", True),
    "regenerateBackupCodes": ("self", "本人（前のコードは使えなくなる）", True),
    "changePassword": ("self", "本人。変えたら今の画面だけ残し、全部のワークスペースのほかの端末と Bridge を切る（D-128.141）。取り直しか、ログインから 15 分の内（代表の答え ⑬）", "login_or_step_up"),
    "setMyPassword": ("self", "本人。パスワードの無い人（パスキーだけ）だけ。ある人は 409（代表の答え ②）。取り直しか、ログインから 15 分の内（代表の答え ⑬）", "login_or_step_up"),
    "listMySessions": ("self", "自分の端末だけ", False),
    "revokeMySession": ("self", "自分の端末だけ", False),
    "revokeOtherSessions": ("self", "自分の端末だけ（この端末以外）", False),
    "resetMemberTwoFactor": ("admin", "ワークスペースの管理者が、本人を確かめてから戻す。記録に残り、本人に知らせる（D-125.138）", True),
    # 自分の設定
    "getMe": ("self", "自分のものだけ", False),
    "updateMe": ("self", "自分のものだけ（名前 100 文字・呼ばれ方 20 文字・言語・見た目・週のはじめ・時間帯）", False),
    "uploadAvatar": ("self", "自分の顔だけ（画像の種類と大きさの上限）", False),
    "requestEmailChange": ("self", "本人。新しいアドレスに確かめのメールを送る（ログインに効くので本人確認を取り直す）", True),
    "verifyEmailChange": ("self", "確かめのメールのリンクを持つ本人（1 回だけ・期限つき）。古いアドレスにも知らせる", False),
    "leaveWorkspace": ("self", "本人。担当を渡し終わってから（D-128.65）。最後の管理者は抜けられない", True),
    "getMyUsage": ("self", "自分の分身の使った量だけ", False),
    "listSetupTasks": ("self", "自分のものだけ", False),
    "dismissSetupTasks": ("self", "自分のものだけ", False),
    "getNotificationSettings": ("self", "自分の知らせの設定だけ（ワークスペースごと）", False),
    "updateNotificationSettings": ("self", "同上。新しい端末で入った知らせは止められない", False),
    "copyNotificationSettings": ("self", "自分が入っているワークスペースにだけ写せる", False),
    # 預けたログイン情報（値はだれにも返さない）
    "listCredentials": ("self", "自分の個人の物と、自分のワークスペースの物の名前と使い方だけ。値と金庫の参照は返さない（D-128.57）", False),
    "createCredential": ("self", "自分の個人の物か、edit を持つ人はワークスペースの物を預ける。値は書くだけで二度と返さない。使える場所（宛先）が必須。取り直しか、ログインから 15 分の内（D-125.139・D-128.57）", "login_or_step_up"),
    "updateCredential": ("self", "自分の個人の物か、edit を持つ人はワークスペースの物の値・使える場所・期限・説明の上書き。名前・層・種類は変えない。取り直しか、ログインから 15 分の内（D-125.139・D-128.57）", "login_or_step_up"),
    "deleteCredential": ("self", "自分の個人の物か、edit を持つ人はワークスペースの物。消したらすぐ使えなくなり、金庫の値も失効（D-128.57）", False),
    "checkCredentialLogin": ("self", "自分のもの。自分の PC で試しにログインして確かめる（値は PC の実行器だけが使う）", False),
    "answerCredentialLoginCheck": ("self", "自分のもの（確かめの途中で聞かれたコードに答える）", False),
    # PC（人が呼ぶ）
    "createPairingCode": ("self", "本人。コードは 10 分・1 回だけ", False),
    "listMyDevices": ("self", "自分の PC だけ", False),
    "updateMyDevice": ("self", "自分のアカウントの PC だけ（AI が使うブラウザ・K-364）", False),
    "revokeMyDevice": ("self", "自分の PC だけ。外すとその PC の仕事は止まり、預けたログイン情報も取り出せなくなる", True),
    "getLatestBridgeRelease": ("self_or_device", "ログインしている人と、つないだ PC の印（PC が自分で新しい版を見に来る・D-109・D-128.137）", False),
    "downloadBridgeRelease": ("self_or_device", "ログインしている人と、つないだ PC の印（D-128.137）。置き場が外なら短い期限の署名 URL（D-128.153）", False),
    # PC（Bridge）が呼ぶ。本人のセッションに結ばれた PC の印で呼び、本人が切られたら止まる
    "claimPairingCode": ("public", "接続コードを持つ PC（まだ PC の印が無い。コードそのものが鍵：1 回だけ・10 分・1 分に 5 回まで・D-089・D-128.93）。つないだら本人に知らせる", False),
    "sendHeartbeat": ("device", "その人の PC", False),
    "reportUsage": ("device", "その人の PC（その人の使った量だけ）", False),
    "takeBridgeJob": ("device", "その人の PC に渡された仕事だけ。使えない道具と止めるサイト（D-107）を一緒に渡す", False),
    "reportJobProgress": ("device", "その仕事を受け取った PC だけ", False),
    "finishBridgeJob": ("device", "同上", False),
    "askFromBridge": ("device", "同上（本人に聞く）", False),
    "getBridgeQuestionAnswer": ("device", "同上", False),
    "getJobControl": ("device", "同上（止める・割り込みの指示を受け取る）", False),
    "reportBrowserState": ("device", "同上。写しに預けたログイン情報が写り込んだら隠してから送る（D-128.57）", False),
    "mirrorConversationEntries": ("device", "同上（会話の記録の写し。正は本人の PC・D-112）", False),
    "listMirrorTargets": ("device", "同上（取り戻す先：直近の本人の会話と、そこで使った Claude Code の session・D-112）", False),
    "putArtifactFromBridge": ("device", "同上", False),
    "callKanameTool": ("device", "同上。分身は本人の権限の中でだけ Kaname の道具を呼べる", False),
    "resolveCredential": ("device", "その人の PC の実行器だけ。持ち主と使える場所が合うときだけ・その仕事の間だけ。AI と画面には返さない（D-128.57）", False),
    "reportCredentialCheck": ("device", "その人の PC", False),
    "getFileForBridge": ("device", "その仕事に付いたファイルだけ（期限つきの署名 URL）", False),
    # 運営：配るもの（運営の人で、そのできることを持つ人だけ・D-128.70）
    "listOpsWorkTypes": ("ops:distribute", "配るものを持つ運営の人", False),
    "getOpsWorkType": ("ops:distribute", "同上。どのワークスペースがどの版を使っているかは数だけ（中身は見ない）", False),
    "uploadWorkTypePackage": ("ops:distribute", "同上。上げた一式は機械の検査（必須の節・資格情報や固有名が入っていない・テスト場面 5 以上・版と変更点）を通す（D-080）", False),
    "getWorkTypeUpload": ("ops:distribute", "同上", False),
    "releaseOpsWorkType": ("ops:distribute", "同上。検査が通らない一式は出せない。全部のワークスペースに効くので本人確認を取り直す", True),
    "rollbackOpsWorkType": ("ops:distribute", "同上（前の版に戻す）", True),
    "listOperations": ("ops:distribute", "同上（第1フェーズは汎用のブラウザ操作 1 つ・D-126.19）", False),
    "listOpsTemplates": ("ops:distribute", "同上", False),
    "getOpsTemplate": ("ops:distribute", "同上", False),
    "releaseOpsTemplate": ("ops:distribute", "同上。使っているワークスペースには知らせが届き、取り込むかは各管理者が選ぶ（D-125.72）", True),
    "listOpsPlans": ("ops:plan_propose", "値段の案か値段を決めるを持つ運営の人", False),
    "listPlanProposals": ("ops:plan_propose", "同上", False),
    "createPlanProposal": ("ops:plan_propose", "値段の案を持つ運営の人。理由が必須", False),
    "updatePlanProposal": ("ops:plan_propose", "案を作った本人（決める人に回す前だけ）", False),
    "getPlanProposalImpact": ("ops:plan_propose", "値段の案か値段を決めるを持つ運営の人", False),
    "submitPlanProposal": ("ops:plan_propose", "案を作った本人", False),
    "decidePlanProposal": ("ops:plan_decide", "値段を決めるを持つ運営の人。自分の案は決められない（決められる人が 1 人しかいないときだけ例外）。全部の顧客に効くので本人確認を取り直す（D-128.72）", True),
    "returnPlanProposal": ("ops:plan_decide", "同上（差し戻す理由が必須）", False),
    "listPlanHistory": ("ops:plan_propose", "値段の案か値段を決めるを持つ運営の人（消せない記録）", False),
    # ワークスペースの管理（入口は権限のある人だけに出る・D-128.48。招く・役割・外すは管理者と権限を付けた人だけ・D-128.97）
    "getWorkspaceMembers": ("admin", "管理者と、メンバーを直す権限を付けた人", False),
    "createInvitations": ("admin", "管理者と、招く権限を付けた人。マネージャーは招けない（D-128.97）。管理者として招くときは本人確認を取り直す", "admin_role"),
    "createInvitationLink": ("admin", "同上（7 日・1 回だけのリンク）", "admin_role"),
    "resendInvitation": ("admin", "同上", False),
    "revokeInvitation": ("admin", "同上。取り消すとリンクはすぐ使えなくなる", False),
    "updateMemberRole": ("admin", "管理者と、役割を変える権限を付けた人。自分の役割と、最後の管理者は変えられない", True),
    "nudgeMember": ("admin", "管理者と、メンバーを直す権限を付けた人（知らせを送るだけ）", False),
    "getMember": ("admin", "同上。本人のものは自分の設定で見る", False),
    "updateMemberGroups": ("admin", "管理者と、役割を変える権限を付けた人（グループを移す・兼ねる）。見えるものが変わるので本人確認を取り直す", True),
    "updateMemberPermissions": ("admin", "管理者と、権限を付ける権限を持つ人。自分に足すことはできない", True),
    "suspendMember": ("admin", "管理者と、外す権限を付けた人。自分と最後の管理者は止められない", True),
    "resumeMember": ("admin", "同上", True),
    "previewMemberRemoval": ("admin", "同上", False),
    "removeMember": ("admin", "同上。個人の記憶・会話・預けたログイン情報・PC の接続はすぐ消える（D-128.96）。自分は外せない（抜けるのは自分の設定から）", True),
    "listScopes": ("read", "ワークスペースのメンバー（グループと層の並びと名前だけ）", False),
    "createScope": ("admin", "層とグループを直せる人（既定は管理者・D-125.116）", False),
    "updateScope": ("admin", "同上", False),
    "createLayer": ("admin", "同上", False),
    "updateLayer": ("admin", "同上", False),
    "getWorkspaceRules": ("read", "ワークスペースのメンバーなら読める。直せるのは決まりを直せる人", False),
    "createWorkspaceRule": ("admin", "決まりを直せる人（既定は管理者・D-125.66）。層の決まりはその層のマネージャーも（D-127.11）", False),
    "updateWorkspaceRule": ("admin", "同上", False),
    "deleteWorkspaceRule": ("admin", "同上", False),
    "previewEscalationRule": ("admin", "同上（当てはまる件数を数えるだけ）", False),
    "createEscalationRule": ("admin", "同上（D-128.87）", False),
    "updateEscalationRule": ("admin", "同上", False),
    "deleteEscalationRule": ("admin", "同上", False),
    "getTicketShape": ("read", "ワークスペースのメンバー（種別と区画・作業の段・分類の軸・渡すときの決まりと上限）", False),
    "previewTicketShapeChange": ("admin", "決まりを直せる人（消すもの・移し先が要るもの・当たるチケットの数を見るだけ）", False),
    "saveTicketShape": ("admin", "決まりを直せる人（既定は管理者・D-125.66）。「この形にする」で種別・区画・段・軸・渡すときをまとめて保存。消すものは移し先が必須（D-125.69）。上限 種別 10・段 8・足す軸 5・区画 20。仕組みの段は変えられない。これから作るチケットから効く（D-128.111）", False),
    "listKindTemplateUpdates": ("admin", "同上", False),
    "applyKindTemplateUpdate": ("admin", "同上（取り込むかは管理者が選ぶ・D-125.72）", False),
    "listHandoverRules": ("read", "ワークスペースのメンバー（渡すときに読む）", False),
    "listAuditEvents": ("read", "自分の操作と、自分が関わるチケットの記録は誰でも。ワークスペース全体は管理者と権限を付けた人（D-125.132）", False),
    "createExport": ("admin", "書き出す権限のある人（既定は管理者とマネージャー。マネージャーは自分のグループの分だけ）。本人確認を取り直す", True),
    "getExport": ("self", "頼んだ本人だけ。受け取りは期限つきの署名 URL", False),
    "getWorkspaceSettings": ("admin", "管理者と、設定の権限を付けた人", False),
    "updateWorkspace": ("admin", "同上（名前・取引先の既定）", False),
    "uploadWorkspaceLogo": ("admin", "同上", False),
    "updateWorkspacePermissions": ("admin", "管理者だけ（権限を付けた人でも「誰ができるか」は変えられない）", True),
    "listWorkspacePlans": ("admin", "プランと支払いの権限のある人（既定は管理者）", False),
    "changePlan": ("admin", "同上。上げるとすぐ・下げると次の請求日から。人数が上限を超えるときは下げられない（D-128.65）", True),
    "requestWorkspaceDeletion": ("admin", "ワークスペースを消す権限のある人（既定は管理者）。名前を打って確かめる。14 日は取り消せる（D-128.65）", True),
    "cancelWorkspaceDeletion": ("admin", "同上（14 日のあいだ）", False),
    "getBilling": ("admin", "プランと支払いの権限のある人", False),
    "downloadInvoicePdf": ("admin", "同上（期限つきの署名 URL）", False),
    "updateBillingContact": ("admin", "同上", False),
    # 取引先（社内・D-128.53・D-128.54）
    "updateTicketClientShare": ("assignee", "担当者とマネージャー。テスト仕様・決定ログ・分身の記録は見せられない（D-128.53）", False),
    "listClientLinkCandidates": ("write", "取引先を足す人。見られるチケットの中だけ", False),
    "createClient": ("write", "メンバー以上（閲覧のみは不可）", False),
    "getClient": ("read", "見られる取引先だけ（担当グループだけの取引先はそのグループの人と管理者）。チケットはグループの権限で見える", False),
    "updateClient": ("manager", "取引先の担当・担当グループのマネージャー・管理者", False),
    "listClientActivity": ("read", "同上。チケットのやり取りは見られるものだけ", False),
    "updateClientShare": ("manager", "取引先の担当・担当グループのマネージャー・管理者。テスト仕様・決定ログ・分身の記録は見せられない", False),
    "getClientPortalPreview": ("read", "見られる取引先だけ（先方からの見え方を見るだけ）", False),
    "createClientContact": ("manager", "取引先の担当・担当グループのマネージャー・管理者", False),
    "updateClientContact": ("manager", "同上", False),
    "removeClientContact": ("manager", "同上。外すとクライアントの場所に入れなくなり、セッションはすぐ切れる", False),
    "inviteClientContact": ("manager", "同上（7 日で切れる招待）", False),
    "remindAcceptance": ("assignee", "そのチケットの担当者とマネージャー", False),
    "listClientRequests": ("read", "見られる取引先の依頼だけ", False),
    "getClientRequest": ("read", "同上。先方の書いたものはデータとして扱い、分身への指示としては読まない（ZT8）", False),
    "updateClientRequest": ("write", "その取引先の担当と担当グループの人（届け先のグループを変える）", False),
    "replyToClientRequest": ("write", "同上。返事は先方に見える", False),
    "acceptClientRequest": ("write", "同上。受けるとチケットになり依頼とつながったまま残る", False),
    "declineClientRequest": ("write", "同上（理由を返す）", False),
    # クライアントの場所（取引先の人・自分の取引先の中だけ・/portal/ の下だけ）
    "getPortalHome": ("client", "自分の取引先の、見せると決めたものだけ（D-128.100）", False),
    "askPortalRequestQuestions": ("client", "自分の取引先の担当の分身に聞く。担当の PC が閉じていれば聞かない（D-128.101）。書いたものはデータとして渡す", False),
    "createPortalRequest": ("client", "「依頼できる」の人だけ。同じ取引先の人に見える", False),
    "getPortalRequest": ("client", "自分の取引先の依頼だけ", False),
    "postPortalRequestMessage": ("client", "「依頼できる」の人だけ。自分の取引先の依頼だけ", False),
    "uploadPortalAttachment": ("client", "「依頼できる」の人だけ。ファイルは検査してから置く（関門 C4）", False),
    "getPortalTicket": ("client", "自分の取引先のチケットで、見せると決めた項目だけ", False),
    "getPortalAcceptance": ("client", "確かめてもらう相手と、同じ取引先の人（見るだけ）", False),
    "answerAcceptance": ("client", "確かめてもらう相手だけ。OK がチケットの完了の条件になる（D-125.124）", False),
    # ナレッジ（D-128.50〜.52・D-128.105・.106）
    "getKnowledgeHome": ("read", "見られるページだけ（置き場の権限・自分のページは本人）", False),
    "getKnowledgeTree": ("self", "社内の人（自分の見える棚の木だけ。棚ごとの見える人は行の守りと口が決める・K-675）", False),
    "listKnowledgePages": ("read", "同上。しまったページは書ける人だけ", False),
    "askKnowledge": ("read", "見られる公開のページだけから答える。PC がつながっていれば本人の分身が出典つきで答え、なければ当てはまるページと行を出す（D-128.105）", False),
    "sendKnowledgeAnswerFeedback": ("read", "答えを見た本人。「いいえ」は持ち主への直す案になる", False),
    "getKnowledgePage": ("read", "見えるページだけ（行の守り）。下書きは書いている本人だけ・K-675", False),
    "createKnowledgePage": ("write", "社内の人。棚ごとの書ける人（会社・グループ・自分）は行の守りと口が決める（見えない棚は 404・書けない棚は 403・K-675）", False),
    "updateKnowledgePage": ("write", "そのページに書ける人（app.kpage_writable）。同じ棚の中で動かす・K-675", False),
    "saveKnowledgeDraft": ("write", "そのページに書ける人（app.kpage_writable）。下書きは書き終えるまでほかの人に見せない・K-675", False),
    "discardKnowledgeDraft": ("write", "そのページに書ける人（下書きを書いた本人の分だけ捨てる）・K-675", False),
    "publishKnowledgePage": ("write", "そのページに書ける人（app.kpage_writable）。書き終えると版が 1 つ増える（お知らせは出さない）・K-675", False),
    "uploadKnowledgeAttachment": ("write", "同上。ファイルは検査してから置く（関門 C4）", False),
    "listKnowledgeVersions": ("read", "見えるページだけ（行の守り）。公開した版を新しい順に・K-675", False),
    "restoreKnowledgeVersion": ("write", "書ける人：ワークスペース全体のページはメンバー以上・グループのページはそのグループのメンバー以上・自分のページは本人（D-128.106）（新しい版として戻す）", False),
    "exportKnowledgeMarkdown": ("read", "見られるページだけ（期限つきの署名 URL）", False),
    "getKnowledgeUsage": ("read", "見られるページだけ。読んだチケットは見られるものだけ出す", False),
    "getKnowledgeLinks": ("read", "同上。つながりの先も見られるものだけ", False),
    "linkKnowledgeMention": ("write", "書ける人：ワークスペース全体のページはメンバー以上・グループのページはそのグループのメンバー以上・自分のページは本人（D-128.106）", False),
    "searchKnowledgeLinkTargets": ("read", "見られるページ・決まり・取引先だけ", False),
    "listKnowledgeMessages": ("read", "見られるページだけ", False),
    "postKnowledgeMessage": ("read", "見られる人なら書ける（閲覧のみも質問できる）", False),
    "listKnowledgeVerifications": ("read", "見られるページだけ。分身の点検は持ち主の PC がつながっているときに作る", False),
    "verifyKnowledgePage": ("write", "持ち主と、その置き場のマネージャー・管理者", False),
    "archiveKnowledgePage": ("write", "同上。しまうと探しても出ず分身も読まない。版と記録は残り戻せる", False),
    "unarchiveKnowledgePage": ("write", "同上", False),
    "listKnowledgeProposals": ("read", "見られるページへの案だけ", False),
    "acceptKnowledgeProposal": ("write", "持ち主と、その置き場のマネージャー・管理者。自分のページへの案は確かめずに入る", False),
    "declineKnowledgeProposal": ("write", "同上（理由を残す）", False),
    "createKnowledgeImport": ("write", "書ける人：ワークスペース全体のページはメンバー以上・グループのページはそのグループのメンバー以上・自分のページは本人（D-128.106）（取り込む先の置き場に書ける人）。ファイルは検査してから読む（関門 C4）", False),
    "getKnowledgeImport": ("write", "取り込んだ本人", False),
    "commitKnowledgeImport": ("write", "取り込んだ本人。既定は下書きで入れる（持ち主が公開するまで分身は読まない）", False),
    # 運営の残り（運営の人で、そのできることを持つ人だけ・D-128.70。ops:any は運営の人なら誰でも）
    "getOpsShell": ("ops:any", "運営の人なら誰でも（左のメニューの数だけ。お金の数はお金を持つ人にだけ出す）", False),
    "listOpsWorkspaces": ("ops:any", "運営の人なら誰でも。数と種類だけで中身（チケット・会話）は出さない", False),
    "exportOpsWorkspaces": ("ops:any", "同上（名前・プラン・数だけ。管理者のメールは入れない）。書き出したことは運営の記録に残る", False),
    "getOpsWorkspace": ("ops:any", "同上。止まった理由は種類と数だけ", False),
    "listOpsWorkspaceMembers": ("ops:inquiry", "問い合わせを持つ運営の人（名前・役割・最後に入った・PC・入り方だけ）。運営は役割も中身も変えない", False),
    "resendOpsVerification": ("ops:inquiry", "同上（本人確認のメールを送り直すだけ）。顧客の記録にも残る", False),
    "getOpsWorkspaceBilling": ("ops:money", "お金を持つ運営の人", False),
    "changeOpsWorkspacePlan": ("ops:money", "同上。管理者に頼まれたときだけ代わりに変える（頼まれた問い合わせを付ける）。顧客の記録にも残る", True),
    "listOpsWorkspaceInquiries": ("ops:inquiry", "問い合わせを持つ運営の人", False),
    "listOpsWorkspaceAudit": ("ops:any", "運営の人なら誰でも（消せない記録）", False),
    "openPeek": ("ops:peek", "中を見るを持つ運営の人。理由が必須・1 時間・見るだけ。運営の記録と顧客の記録の両方に残る（D-128.68・D-128.108）", True),
    "closePeek": ("ops:peek", "開いた本人", False),
    "stopWorkspace": ("ops:stop", "止めるを持つ運営の人。理由が必須。既定は先に知らせて 7 日後、すぐ止めるのは規約違反・危ないときだけ。顧客の記録にも残る", True),
    "resumeWorkspace": ("ops:stop", "同上", True),
    "sendWorkspaceNotice": ("ops:notice", "お知らせを持つ運営の人（その 1 社にだけ出す）", False),
    "listOpsInquiries": ("ops:inquiry", "問い合わせを持つ運営の人", False),
    "getOpsInquiry": ("ops:inquiry", "同上。付いてきた情報は画面の場所・時刻・ブラウザ・PC のつながりだけ（チケットの中身や会話は付かない・D-128.71）", False),
    "updateOpsInquiry": ("ops:inquiry", "同上（担当・状態・後で）", False),
    "replyOpsInquiry": ("ops:inquiry", "同上。返事は顧客の困ったとき・お知らせ と画面の知らせに届く", False),
    "addOpsInquiryNote": ("ops:inquiry", "同上。社内メモは運営の中だけで、顧客には出ない", False),
    "listOpsNotices": ("ops:notice", "お知らせを持つ運営の人", False),
    "createOpsNotice": ("ops:notice", "同上（下書きで作る）", False),
    "getOpsNotice": ("ops:notice", "同上", False),
    "updateOpsNotice": ("ops:notice", "同上（書き直す・出す日）", False),
    "publishOpsNotice": ("ops:notice", "同上。メンテだけ各ワークスペースの管理者にメールでも届ける（D-128.109）", False),
    "addIncidentUpdate": ("ops:notice", "同上（調べている → 原因が分かった → 様子を見ている → 直った）", False),
    "listOpsInvoices": ("ops:money", "お金を持つ運営の人", False),
    "issueOpsInvoices": ("ops:money", "同上。下書きを確かめてまとめて出す。全部のワークスペースに届くので本人確認を取り直す", True),
    "recordPayment": ("ops:money", "同上。差があれば未入金のまま残す。顧客の請求書の画面と記録にも出る（D-128.69）", True),
    "exportOpsInvoices": ("ops:money", "同上", False),
    "listOpsMembers": ("ops:ops_people", "運営の人を持つ運営の人", False),
    "addOpsMember": ("ops:ops_people", "同上。足した人はパスキーでしか入れない", True),
    "updateOpsMemberCaps": ("ops:ops_people", "同上。自分のできることは変えられない。値段の案と値段を決めるは分ける（D-128.72）", True),
    "removeOpsMember": ("ops:ops_people", "同上。自分は外せない。外すとセッションはすぐ切れる", True),
    # 困ったとき・お知らせ（顧客の側・D-128.71）
    "listMyInquiries": ("self", "自分の問い合わせだけ", False),
    "createInquiry": ("self", "本人。「いま見ている画面の情報」は画面の場所・時刻・ブラウザ・PC のつながりだけ（チケットの中身や会話は付けない）", False),
    "getMyInquiry": ("self", "自分の問い合わせだけ。運営の社内メモは出ない", False),
    "postInquiryMessage": ("self", "同上", False),
    "resolveMyInquiry": ("self", "同上", False),
    "uploadInquiryAttachment": ("self", "本人。ファイルは検査してから置く（関門 C4）", False),
    "listNotices": ("read", "ワークスペースのメンバー（全部向けと、自分のワークスペース・プラン向けのお知らせだけ）", False),
    "markNoticeRead": ("self", "本人の既読だけ", False),
    "getServiceStatusForMember": ("read", "ワークスペースのメンバー", False),
    "getServiceStatus": ("public", "誰でも（稼働状況とメンテの予定だけ。どのワークスペースのことも出さない）", False),
    "listPortalNotices": ("client", "取引先の人（全部向けの障害・メンテだけ）", False),
}

# 成功の状態コード（既定は POST 201・それ以外 200）。POST でも「作らず決めるだけ」で 200 を返す口だけ書く（K-410）。チケットごとの分は screen_api.d に書く
SUCCESS_STATUS: dict[str, int] = {}

# チケットごとのファイル（screen_api.d/K-xxx.py）の分を足す（K-325）。同じ鍵・同じ operationId が 2 つあれば止まる
from registry_d import merge_py as _merge_py  # noqa: E402
import credential_patterns as _CP  # noqa: E402  預けたログイン情報の口が打ったとおりを照らす pattern（K-383・口は apps/api/src/features/F3/credentials/patterns.ts）

_merge_py(globals(), _Path(__file__).resolve().parent / "screen_api.d", screen_lists=("SCREEN_API",),
          helpers={"T": T, "_CODE_SEP": _CODE_SEP, "_CODE_CHAR": _CODE_CHAR, "_CP": _CP})
