# K-717 項目を直す・消す・並べる口（updateTicketField・deleteTicketField・reorderTicketFields）の契約の形の表に足す分（K-325 の断片）
_TYPES = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"]
_OPTION = {"type": "object", "required": ["name"], "additionalProperties": False,
           "properties": {"id": {"type": "string", "format": "uuid"}, "name": {"type": "string", "pattern": "\\S", "maxLength": 80}}}
REQUIRED_INPUTS = {
    "reorderTicketFields": {"field_ids"},
}
NO_REQUIRED_INPUTS = {
    "updateTicketField": "送った欄だけ直す（K-717）。欄が 1 つは要る（空の体は形の決まり INPUT_RULES で 422）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "updateTicketField": {
        "name": {"pattern": "\\S", "maxLength": 80},
        "field_type": {"enum": list(_TYPES)},
        "kind_ids": {"minItems": 1},
        "options": {"minItems": 1, "items": dict(_OPTION)},
    },
    "reorderTicketFields": {"field_ids": {"minItems": 1}},
}
UNEXPRESSIBLE_422 = {
    "updateTicketField": ["前後の空白を落とした名前・選ぶ物の名前が 40 字を超える（契約の長さは落とす前の余裕を持たせて 80）",
                          "選ぶ型でない項目を選ぶ型に変えるのに選ぶ物を送らない（今の型で決まる・同じ選ぶ型のままなら選ぶ物を送らなくてよい）"],
}
AGENT_ANSWERS = {}
