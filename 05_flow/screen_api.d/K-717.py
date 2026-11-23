# K-717 項目を直す・消す・並べる口（updateTicketField・deleteTicketField・reorderTicketFields）。足す・マスタを読むは K-706。
#   設計は 07_functional/段10-F9/土台-settings.md の 3・4 章。権限は custom_fields の edit（管理者の束に入っている）。
#   仕事は DB の関数 app.ticket_field_update・delete・reorder が持つ（権限 → 確かめ → 書く → 証跡を 1 つの取引・2 層）。答えの 1 行は K-706 の TicketFieldSetting
SCREEN_API = {
    "masters": [
        ("PATCH", "/ticket-fields/:id", "A118", "custom_fields", "updateTicketField", ["custom_field_kinds", "ticket_kinds", "ticket_field_values", "audit_events"]),
        ("DELETE", "/ticket-fields/:id", "A118", "custom_fields", "deleteTicketField", ["audit_events"]),
        ("POST", "/ticket-fields/order", "A118", "custom_fields", "reorderTicketFields", ["audit_events"]),
    ],
}

PERMS = {
    "updateTicketField": ("admin", "会社の項目を直せる人（custom_fields の edit・既定は管理者・D-125.66）。送った欄だけ直す。値が入っている項目の型は変えられない", False),
    "deleteTicketField": ("admin", "同上。値が入っていても消せる（値の行は残り、見えなくなるだけ）", False),
    "reorderTicketFields": ("admin", "同上。全部の項目の並びを渡す", False),
}

# 体は strict（知らない欄は 422）。options の 1 つは { id?: uuid, name }。並べるは PUT の前例が無いので POST（答えは 200）
INPUTS = {
    "updateTicketField": ("TicketFieldUpdateInput", {"name": "string", "field_type": "string", "required": "boolean",
                                                     "description": "string?", "options": "array", "kind_ids": "uuid[]"}),
    "reorderTicketFields": ("TicketFieldOrderInput", {"field_ids": "uuid[]"}),
}

REQUIRED_INPUTS = {
    "reorderTicketFields": ["field_ids"],   # apps/api/src/features/F9/settings/fields-edit.ts（無い・空は 422・欄つき）
}

_TYPES = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"]
_OPTION = {"type": "object", "required": ["name"], "additionalProperties": False,
           "properties": {"id": {"type": "string", "format": "uuid"}, "name": {"type": "string", "pattern": "\\S", "maxLength": 80}}}
# 名前は前後の空白（全角・タブ・改行）を落とした後 1〜40 字を口が見る。契約の長さは落とす前の余裕を持たせて 80（K-706 と同じ）
VALUE_RANGES = {
    "updateTicketField": {
        "name": {"pattern": "\\S", "maxLength": 80},
        "field_type": {"enum": list(_TYPES)},
        "kind_ids": {"minItems": 1},
        "options": {"minItems": 1, "items": dict(_OPTION)},
    },
    "reorderTicketFields": {"field_ids": {"minItems": 1}},
}

# 直すは欄が 1 つは要る（空の体は 422）。選ばない型へ変えるときに選ぶ物を一緒に送らない
INPUT_RULES = {
    "updateTicketField": {"allOf": [
        {"anyOf": [{"required": [k]} for k in ("name", "field_type", "required", "description", "options", "kind_ids")]},
        {"not": {"required": ["field_type", "options"],
                 "properties": {"field_type": {"enum": ["short_text", "long_text", "number", "date", "check"]}}}},
    ]},
}

UNEXPRESSIBLE_422 = {
    "updateTicketField": ["前後の空白を落とした名前・選ぶ物の名前が 40 字を超える（契約の長さは落とす前の余裕を持たせて 80）",
                          "選ぶ型でない項目を選ぶ型に変えるのに選ぶ物を送らない（今の型で決まる・同じ選ぶ型のままなら選ぶ物を送らなくてよい）"],
}

_FIELD = {"id": "uuid", "name": "string", "field_type": "string", "required": "boolean", "description": "string?", "options": "array",
          "position": "integer", "kind_ids": "uuid[]", "all_kinds": "boolean", "value_count": "integer"}
RESPONSES = {
    "updateTicketField": ("TicketFieldSetting", dict(_FIELD)),
    "deleteTicketField": ("TicketFieldDeleted", {"id": "uuid"}),
    "reorderTicketFields": ("TicketFieldSetting", dict(_FIELD)),
}

# 並べるは全部の項目を並びの順に返す（POST だが新しい物を作らないので 200）
SUCCESS_STATUS = {
    "reorderTicketFields": 200,
}
LIST_RESULT_OPS = {"reorderTicketFields": "並べ直した後の全部の項目を並びの順に返す"}

RATES = {
    "updateTicketField": "30/min/user",
    "deleteTicketField": "30/min/user",
    "reorderTicketFields": "30/min/user",
}

_E404 = {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "項目・種別・選択肢の id が無い・消した・別の会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 項目か種別か選択肢が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も変えない"}
_E503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "項目の行か証跡を書く DB の関数（app.ticket_field_*）が使えない・書けない（1 つの取引なので何も残らない）",
         "ears_form": "UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目も種別の行も証跡も前のまま残す"}
_E422 = lambda what: {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
                      "trigger": what,
                      "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も変えない"}
_E409 = lambda code, what: {"status": 409, "code": code, "body": {"error": "conflict", "code": code}, "errors": [code], "trigger": what,
                            "ears_form": f"UNWANTED: IF {what}なら、Kaname は 409 と {code} を返し、何も変えない"}

ERRORS_4XX = {
    "updateTicketField": [
        _E404,
        _E409("E-FMS-001", "ほかの項目と同じ名前に直す（消していない項目の中・前後の空白を落として比べる）"),
        _E409("E-FMS-002", "値が 1 つでも入っている項目の型を変える"),
        _E409("E-FMS-004", "1 つの項目に同じ名前の選ぶ物が 2 つある"),
        _E409("E-FMS-005", "選ぶ型でない項目に選ぶ物だけを送る"),
        _E422("欄が 1 つも無い・名前が空白だけか 40 字を超える・型が 7 つの外・必須が真偽でない・種別が空か uuid でない・選ぶ物が空・選ぶ物の名前が空・選ばない型に選ぶ物・選ぶ型に変えるのに選ぶ物が無い・知らない欄（strict）"),
        _E503,
    ],
    "deleteTicketField": [_E404, _E503],
    "reorderTicketFields": [
        _E409("E-FMS-003", "並びが今の生きている項目の全部と合わない（足りない・余る・重なる・消した項目・別の会社の項目）"),
        _E422("field_ids が無い・空・uuid でない要素・知らない欄（strict）"),
        _E503,
    ],
}
