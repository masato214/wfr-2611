# K-706 項目のマスタを読む口（listTicketFieldMaster・GET /api/v1/ticket-field-master）と、項目を足す口（createTicketField・POST /api/v1/ticket-fields）
#   設計は 07_functional/段10-F9/土台-settings.md の 3・4 章。権限は custom_fields の edit（管理者の束に入っている）。読む口も同じ権限（値の数を見せるため）。
#   メンバーが読む口は段 5 の listTicketFields（鍵 7）のまま。DB の関数 app.ticket_field_* も同じ確かめを持つ（2 層）
SCREEN_API = {
    "masters": [
        ("GET", "/ticket-field-master", "A118", "custom_fields", "listTicketFieldMaster", ["custom_field_kinds", "ticket_field_values", "ticket_kinds"]),
        ("POST", "/ticket-fields", "A118", "custom_fields", "createTicketField", ["custom_field_kinds", "ticket_kinds", "audit_events"]),
    ],
}

PERMS = {
    "listTicketFieldMaster": ("admin", "会社の項目を直せる人（custom_fields の edit・既定は管理者・D-125.66）。どの種別で出すかと値の数を見る", False),
    "createTicketField": ("admin", "同上。項目を足す（型 7 つ・選ぶ物・必須・説明・どの種別で出すか）。項目の数・選ぶ物の数に上限は無い（D-130.1）", False),
}

# 体は strict（知らない欄は 422）。options の 1 つは { id?: uuid, name }（選ぶ型だけ・1 つ以上）
INPUTS = {
    "createTicketField": ("TicketFieldCreateInput", {"name": "string", "field_type": "string", "kind_ids": "uuid[]", "required": "boolean",
                                                     "description": "string?", "options": "array"}),
}

REQUIRED_INPUTS = {
    "createTicketField": ["name", "field_type", "kind_ids"],   # apps/api/src/features/F9/settings/fields.ts（無いと 422・欄つき）
}

_TYPES = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"]
# 名前は前後の空白（全角・タブ・改行）を落とした後 1〜40 字を口が見る。契約の長さは落とす前の余裕を持たせて 80
VALUE_RANGES = {
    "createTicketField": {
        "name": {"pattern": "\\S", "maxLength": 80},
        "field_type": {"enum": list(_TYPES)},
        "kind_ids": {"minItems": 1},
        "options": {"items": {"type": "object", "required": ["name"], "additionalProperties": False,
                              "properties": {"id": {"type": "string", "format": "uuid"}, "name": {"type": "string", "pattern": "\\S", "maxLength": 80}}}},
    },
}

# 選ぶ型（select・multi_select）は options が 1 つ以上・ほかの型は options を送らないか空
INPUT_RULES = {
    "createTicketField": {"oneOf": [
        {"properties": {"field_type": {"enum": ["select", "multi_select"]}, "options": {"minItems": 1}}, "required": ["options"]},
        {"properties": {"field_type": {"enum": ["short_text", "long_text", "number", "date", "check"]}, "options": {"maxItems": 0}}},
    ]},
}

UNEXPRESSIBLE_422 = {
    "createTicketField": ["前後の空白を落とした名前・選ぶ物の名前が 40 字を超える（契約の長さは落とす前の余裕を持たせて 80）"],
}

# 項目の 1 行（鍵ちょうど 10）＝段 5 の TicketField の 7 つ＋どの種別で出すか・全部の種別か・値の数
_FIELD = {"id": "uuid", "name": "string", "field_type": "string", "required": "boolean", "description": "string?", "options": "array",
          "position": "integer", "kind_ids": "uuid[]", "all_kinds": "boolean", "value_count": "integer"}
RESPONSES = {
    "listTicketFieldMaster": ("TicketFieldSetting", dict(_FIELD)),
    "createTicketField": ("TicketFieldSetting", dict(_FIELD)),
}

QUERIES = {
    "listTicketFieldMaster": [],
}
LIST_DETAILS = {
    "listTicketFieldMaster": {"sort": False, "desc": "取得（custom_fields）— 会社の項目を並びの順に全部見る（型・必須・説明・選ぶ物・どの種別で出すか・値の数）"},
}

RATES = {
    "createTicketField": "30/min/user",
}

_E503 = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "項目を読む・書く DB の関数（app.ticket_field_*）が使えない・書けない（1 つの取引なので何も残らない）",
         "ears_form": "UNWANTED: IF 読めないか書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目も証跡も前のまま残す"}

ERRORS_4XX = {
    "listTicketFieldMaster": [_E503],
    "createTicketField": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "kind_ids の種別が無い・消した・別の会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 種別が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず項目を足さない"},
        {"status": 409, "code": "E-FMS-001", "body": {"error": "conflict", "code": "E-FMS-001"}, "errors": ["E-FMS-001"],
         "trigger": "同じ名前の項目がある（消していない項目の中・前後の空白を落として比べる）",
         "ears_form": "UNWANTED: IF 同じ名前の項目があるなら、Kaname は 409 と E-FMS-001 を返し、項目を足さない"},
        {"status": 409, "code": "E-FMS-004", "body": {"error": "conflict", "code": "E-FMS-004"}, "errors": ["E-FMS-004"],
         "trigger": "1 つの項目に同じ名前の選ぶ物が 2 つある",
         "ears_form": "UNWANTED: IF 同じ名前の選ぶ物が 2 つあるなら、Kaname は 409 と E-FMS-004 を返し、項目を足さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "名前が無い・空白だけ・40 字を超える・型が 7 つの外・必須が真偽でない・種別が無い・空・uuid でない・選ぶ型に選ぶ物が無い・選ばない型に選ぶ物がある・選ぶ物の名前が空・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、項目を足さない"},
        _E503,
    ],
}
