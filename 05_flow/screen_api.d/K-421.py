# K-421 招待のリンク（createInvitationLink）
# 宛てのメールを持たない、7 日・1 回だけの招待のリンクを作る（D-148.22）。グループ・役割を選ぶ。strict（ほかの欄は 422）。
#   役割は member・manager・viewer・admin の 4 つ（admin のときだけ本人確認を取り直す）。
#   答えの形（InvitationLink：url・expires_at）と権限は screen_api.py の今のまま。答えにトークンが入るので冪等の器に残さない（NO_GENERIC_409）
INPUTS = {
    "createInvitationLink": ("InvitationLinkCreateInput", {"scope_id": "uuid", "role_key": "string"}),
}

# apps/api/src/features/F10/invite/link.ts の入力（グループ・役割は無ければ 422）
REQUIRED_INPUTS = {
    "createInvitationLink": ["scope_id", "role_key"],
}

# apps/api/src/features/F10/invite/link.ts（役割は 4 つだけ）
VALUE_RANGES = {
    "createInvitationLink": {
        "role_key": {"enum": ["member", "manager", "viewer", "admin"]},
    },
}

# 契約に書けない形の誤りは無い（グループが無い・消したは DB の中身で決まるので 404・E-INV-011）
UNEXPRESSIBLE_422 = {}

# リンクを作る：権限（403）・本人確認（403）・入力の形（422）・グループが無い（404）・DB が落ちた（503）
ERRORS_4XX = {
    "createInvitationLink": [
        {"status": 403, "code": "STEP_UP_REQUIRED", "body": {"error": "step_up_required", "code": "STEP_UP_REQUIRED"},
         "trigger": "管理者として入るリンクを作るのに、本人確認の取り直しが直前 15 分の内に無い",
         "ears_form": "UNWANTED: IF 管理者として入るリンクを作るのに取り直しが直前 15 分の内に無いなら、Kaname は 403 と STEP_UP_REQUIRED を返し、招待を作らない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "code": "VALIDATION_ERROR"},
         "trigger": "グループを選んでいない・役割が決まった値の外・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 を返し、招待のリンクを作らない"},
        {"status": 404, "code": "E-INV-011", "body": {"error": "not_found", "code": "E-INV-011", "details": []}, "errors": ["E-INV-011"],
         "trigger": "グループがこの会社に無い・消した（E-INV-011）",
         "ears_form": "UNWANTED: IF グループがこの会社に無い・消したなら、Kaname は 404 と E-INV-011 を返し、招待のリンクを作らない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "招待の行と証跡を書く DB が落ちた",
         "ears_form": "UNWANTED: IF 招待を書く DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、招待も証跡も残さない"},
    ],
}
