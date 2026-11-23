# K-706 項目を足す口（createTicketField）の契約の形の表に足す分（K-325 の断片）
_TYPES = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"]
REQUIRED_INPUTS = {
    "createTicketField": {"name", "field_type", "kind_ids"},
}
NO_REQUIRED_INPUTS = {}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "createTicketField": {
        "name": {"pattern": "\\S", "maxLength": 80},
        "field_type": {"enum": list(_TYPES)},
        "kind_ids": {"minItems": 1},
        "options": {"items": {"type": "object", "required": ["name"], "additionalProperties": False,
                              "properties": {"id": {"type": "string", "format": "uuid"}, "name": {"type": "string", "pattern": "\\S", "maxLength": 80}}}},
    },
}
UNEXPRESSIBLE_422 = {
    "createTicketField": ["前後の空白を落とした名前・選ぶ物の名前が 40 字を超える（契約の長さは落とす前の余裕を持たせて 80）"],
}
AGENT_ANSWERS = {}
