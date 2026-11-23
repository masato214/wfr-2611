# K-391 決定を改める・取り消す口（updateTicketDecision）
#   体：action（必須・revise＝改める／cancel＝取り消す）・text（revise のとき必須・字数の上限なし）・reason（revise は改める理由で空でよい・cancel は必須）。
#   知らない欄は 422（strict）。答え TicketDecisionChange は decision（新しい決定・取り消したときは取り消した決定）と previous（改めた元の決定・取り消したときは null）と message_id（やり取りに足した 1 行）。
#   decision・previous は K-390 の TicketDecision と同じ 12 の鍵（画面 K-398 が読む）
INPUTS = {
    "updateTicketDecision": ("TicketDecisionUpdateInput", {"action": "string", "text": "string?", "reason": "string?"}),
}

REQUIRED_INPUTS = {
    "updateTicketDecision": ["action"],
}

VALUE_RANGES = {
    "updateTicketDecision": {"action": {"enum": ["revise", "cancel"]}},
}

# 形全体の決まり（欄をまたぐ決まり・K-355 の INPUT_RULES の書き方・代表の答え answer=f0f290e785a9：検査の例外は足さない・K-387 と同じ）
#   改める（revise）は新しい決定 text が要り空・空白・制御文字だけでない（E-VAL-042）／取り消す（cancel）は理由 reason が要り空・空白・制御文字だけでない（E-VAL-045）
#   revise の reason は空でよく、cancel の text は読まない。ルールにする経路はこの口に無い（取引先を持たない・代表の答え answer=4961f0280e9a）
_NOT_BLANK = "[^\\s\\u0000-\\u001f\\u007f]"
INPUT_RULES = {
    "updateTicketDecision": {"oneOf": [
        {"properties": {"action": {"enum": ["revise"]}, "text": {"pattern": _NOT_BLANK}}, "required": ["text"]},
        {"properties": {"action": {"enum": ["cancel"]}, "reason": {"pattern": _NOT_BLANK}}, "required": ["reason"]},
    ]},
}

# 契約に書けない値の決まりは無い（検査の例外は足さない・代表の答え answer=f0f290e785a9）
UNEXPRESSIBLE_422: dict = {}

RESPONSES = {
    "updateTicketDecision": ("TicketDecisionChange", {"decision": "object", "previous": "object?", "message_id": "uuid"}),
}

ERRORS_4XX = {
    "updateTicketDecision": [
        {"status": 409, "code": "E-CONF-031", "body": {"error": "conflict", "code": "E-CONF-031"}, "errors": ["E-CONF-031", "E-CONF-033"],
         "trigger": "読んだ後にほかの人が先に改めた（改められた決定を改める・取り消す・E-CONF-031）／取り消した（取り消した決定を改める・取り消す・E-CONF-033）。読み直してからもう一度",
         "ears_form": "UNWANTED: IF 決定がすでに改められているか取り消されているなら、Kaname は 409（E-CONF-031・E-CONF-033）を返し、何も書かない"},
        {"status": 422, "code": "E-VAL-042", "body": {"error": "validation_failed", "code": "E-VAL-042"}, "errors": ["E-VAL-042", "E-VAL-045"],
         "trigger": "改めるとき新しい決定が無い・空・空白だけ・制御文字だけ（E-VAL-042・欄 text）／取り消すとき理由が無い・空・空白だけ・制御文字だけ（E-VAL-045・欄 reason）。action が無い・知らない言葉は 422 VALIDATION_ERROR（欄 action）",
         "ears_form": "UNWANTED: IF 改めるのに新しい決定が空か、取り消すのに理由が空なら、Kaname は 422（E-VAL-042・E-VAL-045）を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（今のメンバーか・書けるか）の所で例外になった・DB の関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定ができなかったなら、Kaname は 503 を返し、止める側に倒して何も書かない（守りの判定の例外）"},
    ],
}
