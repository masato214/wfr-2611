# K-422 招待のリンクで新しく入る人の確認の口（confirmInvitationJoin・D-148.51）
#   参加を押した時点（acceptInvitation・202）では利用者も所属も作らない。確認のメールのリンクを押したこの口で初めて、
#   認証の利用者（メールは確かめ済み）・所属・招待を使った印を作り、ログインの印を返す（201）。体は { token } だけ（strict）
SCREEN_API = {
    "invite-accept": [
        ("POST", "/auth/invitations/confirm", "A03|A96", "invitations", "confirmInvitationJoin", ["members", "tenant_memberships", "terms_consents", "sessions"]),
    ],
}

PERMS = {
    "confirmInvitationJoin": ("public", "確認のメールのリンクを持つ人。押した時点で参加が決まる（D-148.51）", False),
}

INPUTS = {
    "confirmInvitationJoin": ("InvitationJoinConfirmInput", {"token": "string"}),
}

REQUIRED_INPUTS = {
    "confirmInvitationJoin": ["token"],
}

# 確認のトークンが空白だけは契約の決まりで書く（K-355 の request_ref と同じ書き方・UNEXPRESSIBLE_422 には足さない）
_EMAIL = "^\\s*[^@\\s]+@[^@\\s]+\\.[^@\\s]+\\s*$"   # 登録（createSignup）・K-638 と同じ（NFKC で直した後に口の EMAIL_RE で見るより狭く書く）
VALUE_RANGES = {
    # リンクの招待で新しく入る人が送るメールの形（空・空白だけ・形違いは 422・E-INV-013。無いときは招待の行で決まるので契約に書かず 409・E-INV-016）
    "acceptInvitation": {"email": {"pattern": _EMAIL}},
    "confirmInvitationJoin": {"token": {"pattern": "\\S"}},
}

# 確認して参加が決まった：ログインの印（部品のセッションの token）・入ったワークスペース・次に移る画面（入った直後は /mfa-setup）
RESPONSES = {
    "confirmInvitationJoin": ("InvitationJoinConfirmed", {"token": "string", "workspace_id": "uuid", "next": "string"}),
}

# 確認の順（features/F2/invitations/confirm.ts）：保留の行に印を付ける（無い・閉じた 404・使われた／期限切れ 410）→ 招待の様子（410）・止められたワークスペース 403
#   → そのメールにもうアカウント 409 → 利用者・受諾・セッション（落ちたら 503）。冪等キーは使わない（2 回目にログインの印を渡さない）
ERRORS_4XX = {
    "confirmInvitationJoin": [
        {"status": 403, "code": "E-AUTH-012", "body": {"error": "auth", "code": "E-AUTH-012"}, "errors": ["E-AUTH-012"],
         "trigger": "招いたワークスペースが止められている（確認までの間に止められた）",
         "ears_form": "UNWANTED: IF 招いたワークスペースが止められているなら、Kaname は 403 と E-AUTH-012 を返し、利用者を作らず招待も使わない"},
        {"status": 404, "code": "E-INV-001", "body": {"error": "not_found", "code": "E-INV-001"}, "errors": ["E-INV-001"],
         "trigger": "確認のリンクの印が見つからない（でたらめ・押し直しで替わった前のリンク・閉じた保留の行）",
         "ears_form": "UNWANTED: IF 確認のリンクの印が見つからないなら、Kaname は 404 と E-INV-001 を返し、何も作らない"},
        {"status": 409, "code": "E-INV-006", "body": {"error": "conflict", "code": "E-INV-006"}, "errors": ["E-INV-006"],
         "trigger": "確認までの間に、同じメールのアカウントができた（その人が別に登録した）",
         "ears_form": "UNWANTED: IF 確認までの間に同じメールのアカウントができたなら、Kaname は 409 と E-INV-006 を返し、利用者を作らず保留の行を閉じる"},
        {"status": 410, "code": "E-INV-014", "body": {"error": "not_found", "code": "E-INV-014"}, "errors": ["E-INV-014", "E-INV-015", "E-INV-004", "E-INV-002", "E-INV-003"],
         "trigger": "確認のリンクの期限（24 時間）が切れた（E-INV-014）・もう使われた（E-INV-015）・招待がもう使われた（E-INV-004）・取り消された（E-INV-002）・期限切れ（E-INV-003）",
         "ears_form": "UNWANTED: IF 確認のリンクか招待が使えないなら、Kaname は 410 とその理由の番号を返し、利用者を作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "確認のトークンが無い・空白だけ・本文に知らない欄",
         "ears_form": "UNWANTED: IF 確認のトークンが受け付けられないなら、Kaname は 422 と欄ごとの理由を返し、何も作らない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "保留の行・利用者を作る所・受諾の関数・セッションを作る所が落ちた",
         "ears_form": "UNWANTED: IF 利用者を作る所か受諾が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、作った利用者を消して確認の印を戻す。セッションだけが落ちたなら参加は取り消さない"},
    ],
}
