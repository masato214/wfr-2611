# K-705 状態（作業の段）を足す・直す・並べる・消す口（createTicketStage・updateTicketStage・deleteTicketStage・reorderTicketStages）と、
#   読む口 listTicketStages の答えの形（TicketStageSetting・鍵 6）。設計は 07_functional/段10-F9/土台-settings.md の 3・4 章。
#   権限は ticket_stages の edit（管理者の束に入っている）。DB の関数 app.ticket_stage_* も同じ確かめを持つ（2 層）
SCREEN_API = {
    "masters": [
        ("POST", "/ticket_stages", "A118", "ticket_stages", "createTicketStage", ["audit_events"]),
        ("PATCH", "/ticket_stages/:id", "A118", "ticket_stages", "updateTicketStage", ["audit_events"]),
        ("DELETE", "/ticket_stages/:id", "A118", "ticket_stages", "deleteTicketStage", ["tickets", "audit_events"]),
        ("POST", "/ticket_stages/order", "A118", "ticket_stages", "reorderTicketStages", ["audit_events"]),
    ],
}

PERMS = {
    "createTicketStage": ("admin", "チケットの状態を直せる人（ticket_stages の edit・既定は管理者・D-125.66）。作業の状態は 8 まで・終わりの状態の直前に足す", False),
    "updateTicketStage": ("admin", "同上。名前と色を直す（仕組みの状態は色だけ・始めと終わりは key を変えない）", False),
    "deleteTicketStage": ("admin", "同上。始め・終わり・仕組みの状態・使っているチケットが在る状態は消せない", False),
    "reorderTicketStages": ("admin", "同上。全部の状態の並びを渡す（始めが先頭・終わりが最後）", False),
}

# 体は strict（知らない欄は 422）。並べるは PUT の前例が無いので POST（答えは 200）
INPUTS = {
    "createTicketStage": ("TicketStageCreateInput", {"name": "string", "color_key": "string"}),
    "updateTicketStage": ("TicketStageUpdateInput", {"name": "string", "color_key": "string"}),
    "reorderTicketStages": ("TicketStageOrderInput", {"stage_ids": "uuid[]"}),
}

REQUIRED_INPUTS = {
    "createTicketStage": ["name", "color_key"],   # apps/api/src/features/F9/settings/stages.ts（無いと 422・欄つき）
    "reorderTicketStages": ["stage_ids"],
}

_TONES = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"]
# 名前は入口が前後の空白を落とした後 1〜20 字（今の ticket_stages.name の check と同じ）・色は見分けの色 8 つの鍵・並びは 1 つ以上
VALUE_RANGES = {
    "createTicketStage": {"name": {"pattern": "\\S", "maxLength": 20}, "color_key": {"enum": list(_TONES)}},
    "updateTicketStage": {"name": {"pattern": "\\S", "maxLength": 20}, "color_key": {"enum": list(_TONES)}},
    "reorderTicketStages": {"stage_ids": {"minItems": 1}},
}

# 直すは name・color_key のどれか 1 つは要る（空の体は 422）
INPUT_RULES = {
    "updateTicketStage": {"anyOf": [{"required": ["name"]}, {"required": ["color_key"]}]},
}

UNEXPRESSIBLE_422: dict = {}   # 決まりは全部 VALUE_RANGES・INPUT_RULES で契約に書いた

# 状態の 1 行（鍵ちょうど 6）。lock は start（key が todo）・end（key が done）・system（仕組みの状態）・null
_STAGE = {"id": "uuid", "key": "string?", "name": "string", "color_key": "string", "position": "integer", "lock": "string?"}
RESPONSES = {
    "listTicketStages": ("TicketStageSetting", dict(_STAGE)),
    "createTicketStage": ("TicketStageSetting", dict(_STAGE)),
    "updateTicketStage": ("TicketStageSetting", dict(_STAGE)),
    "deleteTicketStage": ("TicketStageDeleted", {"id": "uuid"}),
    "reorderTicketStages": ("TicketStageSetting", dict(_STAGE)),
}

# 並べるは全部の並びを返す（POST だが新しい物を作らないので 200）
SUCCESS_STATUS = {
    "reorderTicketStages": 200,
}
LIST_RESULT_OPS = {"reorderTicketStages": "並べ直した後の全部の状態を並びの順に返す"}

RATES = {
    "createTicketStage": "30/min/user",
    "updateTicketStage": "30/min/user",
    "deleteTicketStage": "30/min/user",
    "reorderTicketStages": "30/min/user",
}

_E404 = {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "状態が無い・消した・別の会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 状態が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も変えない"}
_E503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "状態の行か証跡を書く DB の関数（app.ticket_stage_*）が使えない・書けない（1 つの取引なので何も残らない）",
         "ears_form": "UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、状態も証跡も前のまま残す"}
_E422 = lambda what: {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
                      "trigger": what,
                      "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"}
_E409 = lambda code, what, ears: {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code],
                                  "trigger": what, "ears_form": ears}

ERRORS_4XX = {
    "createTicketStage": [
        _E409("E-STG-001", "同じ名前の状態がある（仕組みの状態の名前も含む・消した状態は数えない）",
              "UNWANTED: IF 同じ名前の状態があるなら、Kaname は 409 と E-STG-001 を返し、状態を足さない"),
        _E409("E-STG-002", "作業の状態（仕組みの状態を除く）がもう 8 つある",
              "UNWANTED: IF 作業の状態がもう 8 つあるなら、Kaname は 409 と E-STG-002 を返し、状態を足さない"),
        _E422("名前が空白だけか 20 字を超える・NUL・色が 8 つの鍵のどれでもない・名前か色が無い・知らない欄（strict）"),
        _E503,
    ],
    "updateTicketStage": [
        _E404,
        _E409("E-STG-001", "同じ名前の状態がある（仕組みの状態の名前も含む）",
              "UNWANTED: IF 同じ名前の状態があるなら、Kaname は 409 と E-STG-001 を返し、状態を変えない"),
        _E409("E-STG-004", "仕組みの状態（確認中・承認待ち・実行中）の名前を変えようとした（色だけは変えられる）",
              "UNWANTED: IF 仕組みの状態の名前を変えようとしたなら、Kaname は 409 と E-STG-004 を返し、状態を変えない"),
        _E422("名前が空白だけか 20 字を超える・色が 8 つの鍵のどれでもない・空の体・知らない欄（strict）・:id が uuid でない"),
        _E503,
    ],
    "deleteTicketStage": [
        _E404,
        _E409("E-STG-003", "始め・終わり・仕組みの状態を消そうとした",
              "UNWANTED: IF 始め・終わり・仕組みの状態なら、Kaname は 409 と E-STG-003 を返し、状態を消さない"),
        {"status": 409, "code": "E-STG-005", "body": {"error": "conflict", "code": "E-STG-005", "detail": {"ticket_count": 1}}, "errors": ["E-STG-005"],
         "trigger": "その状態のチケットが在る（消したチケットも数える。枚数は detail.ticket_count）",
         "ears_form": "UNWANTED: IF その状態のチケットが在るなら、Kaname は 409 と E-STG-005 と枚数を返し、状態を消さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": ":id が uuid でない",
         "ears_form": "UNWANTED: IF :id が uuid でないなら、Kaname は 422 を返し、何も消さない"},
        _E503,
    ],
    "reorderTicketStages": [
        _E409("E-STG-006", "並びが今の生きている状態の全部と合わない（足りない・余る・重なる・消した状態・別の会社の状態）",
              "UNWANTED: IF 並びが今の状態と合わないなら、Kaname は 409 と E-STG-006 を返し、並びを変えない"),
        _E409("E-STG-007", "始めの状態が先頭でない・終わりの状態が最後でない",
              "UNWANTED: IF 始めが先頭でないか終わりが最後でないなら、Kaname は 409 と E-STG-007 を返し、並びを変えない"),
        _E422("stage_ids が無い・空・uuid でない要素・知らない欄（strict）"),
        _E503,
    ],
}
