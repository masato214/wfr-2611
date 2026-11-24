# K-401 渡しの口の置き場（createTicketHandover・answerTicketHandover の入力の作り直しと断り方）・渡す前の下見の口（previewTicketHandover）・決まりを読む口（listHandoverRules）
# 渡す前の下見（D-148.2）：詳細の右の「担当者 ▾」を押して相手を選ぶ小窓が開くときに 1 回。候補・件数・決まり・子と関連の数を 1 回で返す
SCREEN_API = {
    "tickets": [
        ("GET", "/tickets/:id/handover-preview", "A51|A111|A48", T, "previewTicketHandover", ["handover_rules", "members", "scopes", "ticket_links", "ticket_handovers"]),
    ],
}

PERMS = {
    "previewTicketHandover": ("read", "そのチケットを見られる人のうち、渡す・配る・申し出るのどれかができる人（できなければ 403）", False),
}

# 渡す：種類・相手（人かグループ）・理由・お願い・返事の期限・一緒に切り替えるもの・上の層にも知らせる・別の人にする（待っている自分の渡し）。
# 答える：受ける・断る・断る理由・一緒に切り替えるもの。表の写し（ticket_id・from_member_id・state・decided_at）は受けない（strict）
INPUTS = {
    "createTicketHandover": ("TicketHandoverCreateInput", {"kind": "string", "to_member_id": "uuid?", "to_scope_id": "uuid?", "reason": "string?", "ask": "string?", "reply_due": "string?", "switch": "object?", "notify_managers": "boolean?", "replaces": "uuid?"}),
    "answerTicketHandover": ("TicketHandoverAnswerInput", {"decision": "string", "decline_reason": "string?", "switch": "object?"}),
}

REQUIRED_INPUTS = {
    "createTicketHandover": ["kind", "reason"],
    "answerTicketHandover": ["decision"],
}

# 欄の値の形（口は NUL を含む文を 422・空白と制御文字だけの理由を 422 E-HND-007・上へ上げる kind は契約の外の値として 422）
_NO_NUL = "^[^\\u0000]*$"
_VISIBLE = "^[^\\u0000]*[^\\s\\u0000-\\u001f\\u007f\\ufeff][^\\u0000]*$"
_SWITCH = {"type": "object", "nullable": True, "additionalProperties": False,
           "properties": {"children": {"type": "boolean"}, "links": {"type": "boolean"}, "group": {"type": "boolean"},
                          "axes": {"type": "array", "items": {"type": "string", "format": "uuid"}}}}
VALUE_RANGES = {
    "createTicketHandover": {"kind": {"enum": ["pass", "offer", "distribute"]}, "reason": {"pattern": _VISIBLE, "nullable": False}, "ask": {"pattern": _NO_NUL},
                             "reply_due": {"format": "date-time"}, "replaces": {"format": "uuid"}, "switch": _SWITCH},
    "answerTicketHandover": {"decision": {"enum": ["accept", "decline"]}, "decline_reason": {"pattern": _NO_NUL}, "switch": _SWITCH},
}

# 形全体の決まり（口が 422 で断る欄の組み合わせ・K-355 の INPUT_RULES の書き方）。A なら B ＝ anyOf[A でない, B]（OpenAPI 3.0 に if/then は無い）
def _null(): return {"nullable": True, "enum": [None]}   # 別名（YAML の &id）が出ないよう使うたびに作る
def _str(f): return {"required": [f], "properties": {f: {"type": "string"}}}   # 欄があって null でない
def _kind(k): return {"required": ["kind"], "properties": {"kind": {"enum": [k]}}}
def _implies(a, b): return {"anyOf": [{"not": a}, b]}
INPUT_RULES = {
    "createTicketHandover": {"allOf": [
        {"not": {"allOf": [_str("to_member_id"), _str("to_scope_id")]}},                                  # 人とグループの両方は選べない
        _implies(_kind("offer"), {"properties": {"to_member_id": _null(), "to_scope_id": _null(), "reply_due": _null()}}),   # 申し出は相手も期限も付けない
        _implies(_kind("pass"), {"properties": {"to_scope_id": _null()}}),                                  # 引き継いでもらうは人を選ぶ
        _implies(_str("replaces"), _kind("pass")),                                                        # 別の人にするのは引き継いでもらうだけ
        _implies({"anyOf": [_kind("pass"), _kind("distribute")]}, {"anyOf": [_str("to_member_id"), _str("to_scope_id")]}),   # 相手かグループが要る
    ]},
    "answerTicketHandover": {"allOf": [
        _implies({"required": ["decision"], "properties": {"decision": {"enum": ["decline"]}},},
                 {"required": ["decline_reason"], "properties": {"decline_reason": {"type": "string", "pattern": _VISIBLE}}}),   # 断るは理由が要る
    ]},
}

QUERIES = {
    "listHandoverRules": [],
}

LIST_DETAILS = {
    "listHandoverRules": {"sort": False, "desc": "取得（handover_rules）— 渡すときに一緒に切り替えるものの決まり（会社の分を全部）"},
}

# 成功の答え（種類の葉が返す形）は 16 の鍵。K-405 の一覧の 1 件は別の名前 TicketHandover
_HANDOVER = {"id": "uuid", "ticket_id": "uuid", "kind": "string", "state": "string", "from": "object", "to": "object?", "to_scope": "object?", "reason": "string?", "ask": "string?", "reply_due": "string?", "switch": "object", "switch_applied": "object?", "notify_managers": "boolean", "decline_reason": "string?", "decided_at": "string?", "created_at": "string"}
RESPONSES = {
    "previewTicketHandover": ("HandoverPreview", {"kinds": "string[]", "blocked": "string?", "waiting": "object?", "default_reply_due": "string", "rules": "array", "children": "object", "links": "object", "group": "object", "candidates": "array", "groups": "array"}),
    "listHandoverRules": ("HandoverRule", {"id": "uuid", "target": "string", "axis_id": "uuid?", "axis_name": "string?", "mode": "string"}),
    "createTicketHandover": ("TicketHandoverCreated", dict(_HANDOVER)),
    "answerTicketHandover": ("TicketHandoverAnswered", dict(_HANDOVER)),
}

# 渡す：権限（403）・見えない・相手やグループが無い（404）・止まり・相手が止まっている・自分・切り替えが決まりと合わない（409）・入力の形（422）（控え帳 answer=431fc50df51b・f0f290e785a9）
# 答える：答える人でない（403）・無い（404）・もう決まった／止まり（409）・入力（422）
# 下見：できる種類が無い（403）・見えない（404）
# 判定の所が落ちたときの 503・E-PAGE-003 は、全部の口に付く入口の行（build_api.py の four）と同じ番号なので足さない（同じ番号の行を 2 つにしない）
ERRORS_4XX = {
    "createTicketHandover": [
        {"status": 403, "code": "E-HND-002", "body": {"error": "permission", "code": "E-HND-002"}, "errors": ["E-HND-002"],
         "trigger": "担当者でない人の引き継いでもらう・管理しない人の配る・閲覧のみの人・別の人にする（replaces）が自分の渡した待っている渡しでない",
         "ears_form": "UNWANTED: IF その人がその種類で渡せないなら、Kaname は 403 と E-HND-002 を返し、何も書かない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001", "E-HND-012", "E-HND-014"],
         "trigger": "見えない・別の会社・消したチケット・無い id（有ることも漏らさない）・相手が無い人・別の会社・消した・抜けた人（E-HND-014）・グループが無い・別の会社・消した（E-HND-012）",
         "ears_form": "UNWANTED: IF 見えないチケット・無い相手・無いグループに渡そうとしたなら、Kaname は 404 と E-PAGE-001／E-HND-014／E-HND-012 を返し、何も書かない"},
        {"status": 409, "code": "E-HND-004", "body": {"error": "conflict", "code": "E-HND-004"}, "errors": ["E-HND-001", "E-HND-003", "E-HND-004", "E-HND-005", "E-HND-006", "E-HND-008", "E-HND-009", "E-HND-010", "E-HND-011"],
         "trigger": "相手が止まっている／招待中（E-HND-006）・相手が自分（E-HND-010）・切り替えがワークスペースの決まりと合わない（E-HND-011）・AI が動いている・承認を待っている（E-HND-003）・同じチケットに待っている渡しがある（E-HND-004）・別の人にするの渡しがもう決まっていた（E-HND-005）・完了したチケット（E-HND-009）・返事の期限が今より後でない（E-HND-008）・種類の葉がまだ無い（E-HND-001）",
         "ears_form": "UNWANTED: IF そのチケットが今は渡せない状態なら、Kaname は 409 と E-HND-001／E-HND-003／E-HND-004／E-HND-005／E-HND-006／E-HND-008／E-HND-009／E-HND-010／E-HND-011 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-HND-001", "E-HND-007", "E-HND-013"],
         "trigger": "契約の外の種類 escalate（E-HND-001）・理由が空（E-HND-007）・相手もグループも選んでいない（E-HND-013）・種類の値・欄の組み合わせ・期限の形・切り替えの形・NUL を含む文・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
    "answerTicketHandover": [
        {"status": 403, "code": "E-HND-002", "body": {"error": "permission", "code": "E-HND-002"}, "errors": ["E-HND-002"],
         "trigger": "答える人でない（渡した人・関係ない人・閲覧のみ・グループ宛てでそのグループを管理しない人）",
         "ears_form": "UNWANTED: IF 答える人でないなら、Kaname は 403 と E-HND-002 を返し、何も書かない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "無い・別の会社の渡し（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 無い渡しに答えようとしたなら、Kaname は 404 と E-PAGE-001 を返し、何も書かない"},
        {"status": 409, "code": "E-HND-005", "body": {"error": "conflict", "code": "E-HND-005"}, "errors": ["E-HND-001", "E-HND-005", "E-HND-003", "E-HND-009", "E-HND-011"],
         "trigger": "もう決まった渡し（受けた・断った・取り消された・二度押し）（E-HND-005）・受けるときにチケットが止まっている（E-HND-003・E-HND-009）・切り替えがワークスペースの決まりと合わない（E-HND-011）",
         "ears_form": "UNWANTED: IF その渡しがもう決まっているか今は受けられないなら、Kaname は 409 と E-HND-001／E-HND-005／E-HND-003／E-HND-009／E-HND-011 を返し、何も書かない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": ["E-HND-007"],
         "trigger": "断る理由が空（E-HND-007）・切り替えの形・NUL を含む文・決め方の値・知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、何も書かない"},
    ],
    "previewTicketHandover": [
        {"status": 403, "code": "E-HND-002", "body": {"error": "permission", "code": "E-HND-002"}, "errors": ["E-HND-002"],
         "trigger": "チケットは見えるが、渡す・配る・申し出るのどれもできない（閲覧のみ・取引先・止まっている人）",
         "ears_form": "UNWANTED: IF その人ができる種類が無いなら、Kaname は 403 と E-HND-002 を返し、候補の人などの中身を返さない"},
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "見えない・別の会社・消した・取り込みの下書きのチケット・無い id",
         "ears_form": "UNWANTED: IF 見えないチケットの下見なら、Kaname は 404 と E-PAGE-001 を返し、中身を返さない"},
    ],
}
