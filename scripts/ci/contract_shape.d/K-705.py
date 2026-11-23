# K-705 状態を足す・直す・並べる・消す口（createTicketStage・updateTicketStage・deleteTicketStage・reorderTicketStages）の契約の形の表に足す分（K-325 の断片）
#   必須の欄（足す：名前と色・並べる：並び）と値域（名前 1〜20 字・色 8 つ・並び 1 つ以上）。直すは必須の欄が無い（どれか 1 つは要る＝INPUT_RULES）
_TONES = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"]
REQUIRED_INPUTS = {
    "createTicketStage": {"name", "color_key"},
    "reorderTicketStages": {"stage_ids"},
}
NO_REQUIRED_INPUTS = {
    "updateTicketStage": "送った欄だけ直す（K-705）。name・color_key のどれか 1 つは要る（空の体は形の決まり INPUT_RULES で 422）",
}
PATH_PATTERNS = {}
VALUE_RANGES = {
    "createTicketStage": {"name": {"pattern": "\\S", "maxLength": 20}, "color_key": {"enum": list(_TONES)}},
    "updateTicketStage": {"name": {"pattern": "\\S", "maxLength": 20}, "color_key": {"enum": list(_TONES)}},
    "reorderTicketStages": {"stage_ids": {"minItems": 1}},
}
UNEXPRESSIBLE_422 = {}
AGENT_ANSWERS = {}
