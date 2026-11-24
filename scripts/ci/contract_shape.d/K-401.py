# K-401 渡す口・答える口（createTicketHandover・answerTicketHandover）の契約の形の表に足す分（K-325 の断片）
# apps/api/src/features/F8/handovers/input.ts（種類と決め方は決まった値だけ・理由は要る）。欄をまたぐ形の決まりは 05_flow/screen_api.d/K-401.py の INPUT_RULES
REQUIRED_INPUTS = {
    "createTicketHandover": {"kind", "reason"},
    "answerTicketHandover": {"decision"},
}
VALUE_RANGES = {
    "createTicketHandover": {"kind": {"enum": ["pass", "offer", "distribute"]}},
    "answerTicketHandover": {"decision": {"enum": ["accept", "decline"]}},
}
