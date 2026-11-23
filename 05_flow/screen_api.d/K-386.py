# K-386 やり取りの書き込みを直す・消す・☆ の口（updateTicketMessage・deleteTicketMessage・starTicketMessage）
#   直す：体は本文（必須）と @ する人だけ（strict）。知らせる人は直さない。書いた本人だけ（入口の言葉 self）
#   消す：入口の言葉 read（行が見える）。本人かマネージャーかは口と DB の関数が確かめる（scripts/ci/row_rules.mjs は変えない）
#   ☆：体は空の形。答えは 1 件の形でなく { id, stars, starred }（画面は ☆ の数だけを書き換える）
_ITEM = {"id": "string", "kind": "string", "at": "string", "actor": "object?", "message": "object?", "changes": "array?", "run": "object?", "deleted": "object?"}

INPUTS = {
    "updateTicketMessage": ("TicketMessageEditInput", {"body": "string", "mention_member_ids": "uuid[]"}),
    "starTicketMessage": ("TicketMessageStarInput", {}),
}

REQUIRED_INPUTS = {"updateTicketMessage": ["body"]}

# 本文は空白だけでない（全角の空白・改行も）。入口の形の確かめでは言い表せないので、口が E-VAL-027 で断る
VALUE_RANGES = {"updateTicketMessage": {"body": {"pattern": "\\S"}}}

UNEXPRESSIBLE_422 = {}

RESPONSES = {
    "updateTicketMessage": ("TimelineItem", _ITEM),
    "deleteTicketMessage": ("TimelineItem", _ITEM),
    "starTicketMessage": ("TicketMessageStar", {"id": "string", "stars": "integer", "starred": "boolean"}),
}

_NF = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}}
_DOWN = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"]}

_BROKE = {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"]}

ERRORS_4XX = {
    "updateTicketMessage": [
        {"status": 422, "code": "E-VAL-027", "body": {"error": "validation", "code": "E-VAL-027"}, "errors": ["E-VAL-027"],
         "trigger": "本文が無い・空・空白だけ（全角の空白・改行も）",
         "ears_form": "UNWANTED: IF 本文が無い・空・空白だけなら、Kaname は 422 と E-VAL-027 を返し、何も変えない"},
        {**_NF, "trigger": "書き込みが無い・見えない・消した・チケットを消した",
         "ears_form": "UNWANTED: IF 書き込みが無い・見えない・消した・チケットを消したなら、Kaname は 404 と NOT_FOUND を返し、何も変えない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "@ する人が選べない（見られない・抜けた・止められた）。在るかを漏らさないので 404（欄・details・detail なし・控え帳 2026-11-21 01:15）",
         "ears_form": "UNWANTED: IF @ する人が選べないなら、Kaname は 404 と E-PAGE-001 を返し、欄の名前も明細も付けず、何も変えない"},
        {**_DOWN, "trigger": "守りの判定で例外・関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない（止める側に倒す）"},
        {**_BROKE, "trigger": "書く所で DB が落ちた（1 つの処理なので何も変わらない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、書き込みを前のまま残す"},
    ],
    "deleteTicketMessage": [
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "書いた本人でもそのグループのマネージャーでもない",
         "ears_form": "UNWANTED: IF 書いた本人でもそのグループのマネージャーでもないなら、Kaname は 403 と FORBIDDEN を返し、消さない"},
        {**_NF, "trigger": "書き込みが無い・見えない・消した・書き込みでない（変更・仕組みの行）・チケットを消した",
         "ears_form": "UNWANTED: IF 書き込みが無い・見えない・もう消した・書き込みでないなら、Kaname は 404 と NOT_FOUND を返し、何も変えない"},
        {**_DOWN, "trigger": "守りの判定で例外・関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない（止める側に倒す）"},
        {**_BROKE, "trigger": "書く所で DB が落ちた（1 つの処理なので何も変わらない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、書き込みを前のまま残す"},
    ],
    "starTicketMessage": [
        {**_NF, "trigger": "書き込みが無い・見えない・消した・書き込みでない（変更・仕組みの行）・チケットを消した",
         "ears_form": "UNWANTED: IF 書き込みが無い・見えない・消した・書き込みでないなら、Kaname は 404 と NOT_FOUND を返し、何も変えない"},
        {**_DOWN, "trigger": "守りの判定で例外・関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も変えない（止める側に倒す）"},
        {**_BROKE, "trigger": "書く所で DB が落ちた（1 つの処理なので何も変わらない・ログは場所と例外の種類だけ）",
         "ears_form": "UNWANTED: IF 書く所の DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、書き込みを前のまま残す"},
    ],
}

# POST でも 200 を返す（押すたびに付く・外れる ☆。試験 K386-API-012）
SUCCESS_STATUS = {"starTicketMessage": 200}
