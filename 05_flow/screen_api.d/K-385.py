# K-385 やり取りに書き込む口（createTicketMessage）
#   入力は本文・@ する人・知らせる人・引用元と、K-389 が足した段の欄 4 つ（stage_key・stage_id・hold_reason・resume_condition）。書いた人はセッションから・種類は post に決まる。ほかの欄（実績など）は strict で 422
#   段の欄は書き込みと一緒に段を変える（1 つの取引・K-389・K-387 の app.ticket_progress_set）。断る番号は K-387 と同じ（422＝形の誤り／404＝指した物が無い／409＝今の状態ではできない）
#   答えの 1 件の形 TimelineItem は K-383 と同じ名前・同じ欄（RESPONSES）。書いた 1 件をそのまま一覧の下に足せる（読み直さない）
INPUTS = {
    "createTicketMessage": ("TicketMessageInput", {"body": "string", "mention_member_ids": "uuid[]", "notify_member_ids": "uuid[]", "quote_of_id": "uuid?",
                                                             "stage_key": "string", "stage_id": "uuid", "hold_reason": "string", "resume_condition": "string"}),
}

REQUIRED_INPUTS = {"createTicketMessage": ["body"]}

# 本文は空白だけでない（全角の空白・改行も）。入口の形の確かめでは言い表せないので、口が E-VAL-027 で断る
# 保留の理由と再開の条件は空白と制御文字だけでない字（K-387 と同じ・字数の上限は置かない）
_NOT_BLANK = "[^\\s\\u0000-\\u001f\\u007f]"
VALUE_RANGES = {"createTicketMessage": {"body": {"pattern": "\\S"}, "stage_key": {"enum": ["todo", "doing", "hold"]},
                                        "hold_reason": {"pattern": _NOT_BLANK}, "resume_condition": {"pattern": _NOT_BLANK}}}

UNEXPRESSIBLE_422: dict = {}   # 形の決まりは REQUIRED_INPUTS・VALUE_RANGES（fuzz の入力を絞る）で契約に書いた。本文の空は口の前処理が E-VAL-027 で断る（実装の答えが正）。DB の中身で決まる断りは 404（検査の例外は足さない）

# 形全体の決まり（欄をまたぐ決まり・K-355 の INPUT_RULES の書き方・代表の答え answer=f0f290e785a9：検査の例外は足さない・K-389・K-387 と同じ）
#   段は stage_id か stage_key の片方だけ／stage_key hold は理由と条件が要る／理由と条件は stage_key hold か stage_id（保留かは DB で見る・409 E-CONF-036）のときだけ付けられる
INPUT_RULES = {
    "createTicketMessage": {"allOf": [
        {"not": {"required": ["stage_id", "stage_key"]}},
        {"anyOf": [{"not": {"required": ["stage_key"]}}, {"properties": {"stage_key": {"enum": ["todo", "doing"]}}},
                   {"required": ["hold_reason", "resume_condition"]}]},
        {"anyOf": [{"required": ["stage_id"]}, {"required": ["stage_key"], "properties": {"stage_key": {"enum": ["hold"]}}},
                   {"not": {"anyOf": [{"required": ["hold_reason"]}, {"required": ["resume_condition"]}]}}]},
    ]},
}

RESPONSES = {
    "createTicketMessage": ("TimelineItem", {"id": "string", "kind": "string", "at": "string", "actor": "object?", "message": "object?", "changes": "array?", "run": "object?", "deleted": "object?"}),
}

ERRORS_4XX = {
    "createTicketMessage": [
        {"status": 422, "code": "E-VAL-027", "body": {"error": "validation", "code": "E-VAL-027", "details": []}, "errors": ["E-VAL-027"],
         "trigger": "本文が無い・空・空白だけ（全角の空白・改行も・口の前処理が断る・欄 body の明細 1 件）",
         "ears_form": "UNWANTED: IF 本文が無い・空・空白だけなら、Kaname は 422 と E-VAL-027 と欄 body の明細を返し、書き込みも受け箱の行も作らない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "@ する人・知らせる人・引用元が選べない（そのチケットを見られない人・抜けた人・止められた人・別のチケットの書き込み・消した書き込み。DB の中身で決まるので 422 にしない・欄の名前も出さない）",
         "ears_form": "UNWANTED: IF @ する人・知らせる人・引用元が選べないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も書かない"},
        # ---- K-389：書き込みと一緒に段を変えたときの断り（K-387 の updateTicket の行と同じ trigger・番号・文）
        {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"},
         "trigger": "見るだけの人（書き込めるが段は変えられない）が段の欄を付けた",
         "ears_form": "UNWANTED: IF 段を変えられない人が段の欄を付けて書いたなら、Kaname は 403 を返し、書き込みも段も残さない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "段の id（stage_id）が指す段が無い・別の会社の段・消した段（欄 stage_id）",
         "ears_form": "UNWANTED: IF 指した段が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず何も書かない"},
        {"status": 409, "code": "E-CONF-030", "body": {"error": "conflict", "code": "E-CONF-030"}, "errors": ["E-CONF-030"],
         "trigger": "今の段が仕組みの段（確認中・承認待ち・実行中）か、走っている実行・決まっていない承認待ちがあるのに段の欄を付けた",
         "ears_form": "UNWANTED: IF AI が動いている間か承認待ちの間に段を変えて書こうとしたら、Kaname は 409 と E-CONF-030 を返し、書き込みも残さない"},
        {"status": 409, "code": "E-CONF-032", "body": {"error": "conflict", "code": "E-CONF-032"}, "errors": ["E-CONF-032"],
         "trigger": "今の段が完了なのに、未着手・保留・会社が足した段を選んだ（段の欄が無ければ書ける）",
         "ears_form": "UNWANTED: IF 完了したチケットの段を開き直さずに変えて書こうとしたら、Kaname は 409 と E-CONF-032 を返し、書き込みも残さない"},
        {"status": 409, "code": "E-CONF-034", "body": {"error": "conflict", "code": "E-CONF-034", "details": []}, "errors": ["E-CONF-034"],
         "trigger": "段の id（stage_id）で、仕組みの段か完了の段を行き先にした（欄 stage_id）",
         "ears_form": "UNWANTED: IF 書き込みの口で移せない段を行き先にしたなら、Kaname は 409 と E-CONF-034 を返し、書き込みも残さない"},
        {"status": 409, "code": "E-CONF-035", "body": {"error": "conflict", "code": "E-CONF-035", "details": []}, "errors": ["E-CONF-035"],
         "trigger": "段の id（stage_id）で保留の段を選んだのに、保留の理由か再開の条件を送っていない（足りない欄ごとの明細）",
         "ears_form": "UNWANTED: IF 段の id で保留の段を選んで理由か条件が無いなら、Kaname は 409 と E-CONF-035 と足りない欄を返し、書き込みも残さない"},
        {"status": 409, "code": "E-CONF-036", "body": {"error": "conflict", "code": "E-CONF-036", "details": []}, "errors": ["E-CONF-036"],
         "trigger": "段の id（stage_id）で保留でない段を選んで保留の理由か再開の条件を付けた（欄ごとの明細）",
         "ears_form": "UNWANTED: IF 保留でない段を選んで保留の理由か条件を付けたなら、Kaname は 409 と E-CONF-036 を返し、書き込みも残さない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-VAL-041", "E-VAL-047"],
         "trigger": "形の誤り：保留の理由（E-VAL-041）か再開の条件（E-VAL-047）が空・空白だけ、stage_key hold で理由か条件が無い、stage_id と stage_key の両方、stage_key が todo・doing・hold でない、段の欄が無いか stage_key todo・doing なのに理由か条件を付けた、実績など書く欄に無い欄（欄ごとの理由）",
         "ears_form": "UNWANTED: IF 入力の形が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "チケットが無い・見えない・消した",
         "ears_form": "UNWANTED: IF チケットが無い・見えない・消したなら、Kaname は 404 と NOT_FOUND を返し、何も書かない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "書き込みと受け箱の行を 1 つの取引で書く所で DB が落ちた",
         "ears_form": "UNWANTED: IF 書き込みと受け箱の行を書く所で DB が落ちたなら、Kaname は 503 を返し、書き込みも受け箱の行も残さない（1 つの取引・止める側に倒す）"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "unavailable", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "守りの判定（見えるか）で例外・関数が知らない言葉を返した",
         "ears_form": "UNWANTED: IF 守りの判定で例外になったなら、Kaname は 503 と E-PAGE-003 を返し、何も書かない（止める側に倒す）"},
    ],
}
