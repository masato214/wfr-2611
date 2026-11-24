# K-974 運営が受信箱の問い合わせの担当・状態・後でを変える口（updateOpsInquiry）
#   契約の形（入力の欄・state の値・答えの 1 行）は K-948 の断片が持つ。この葉は組み合わせの決まり（INPUT_RULES）と断る番号を足す。
#   振る舞いの本体は apps/api/src/features/F12/ops/inbox-update.ts（DB の関数 app.ops_inquiry_update）
# 組み合わせ：1 つ以上の欄（空の {} は 422）・取ると外すを両方 true にしない・state と later_until を一緒に送らない
INPUT_RULES = {
    "updateOpsInquiry": {"allOf": [
        {"anyOf": [{"required": [x]} for x in ("take", "release", "state", "later_until")]},
        {"not": {"properties": {"take": {"const": True}, "release": {"const": True}}, "required": ["take", "release"]}},
        {"not": {"required": ["state", "later_until"]}},
    ]},
}

# 後での日時が今以前は、読むときの時刻で決まるので契約に書けない（409 E-OPS-008）
ERRORS_4XX = {
    "updateOpsInquiry": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "問い合わせが無い・消した・作りかけの会社や消した会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 問い合わせが無いか消してあるなら、Kaname は 404 を返し、担当も状態も変えない"},
        {"status": 409, "code": "E-OPS-005", "body": {"error": "conflict", "code": "E-OPS-005"}, "errors": ["E-OPS-005"],
         "trigger": "ほかの人が担当の問い合わせを取る・外す・状態を変える／担当なしの問い合わせの状態を、取らずに変える",
         "ears_form": "UNWANTED: IF ほかの人が担当か、担当が自分でないなら、Kaname は 409 と E-OPS-005 を返し、担当も状態も変えない"},
        {"status": 409, "code": "E-OPS-008", "body": {"error": "conflict", "code": "E-OPS-008"}, "errors": ["E-OPS-008"],
         "trigger": "後での日時が今以前（読むときの時刻で決まる）",
         "ears_form": "UNWANTED: IF 後での日時が今以前なら、Kaname は 409 と E-OPS-008 を返し、担当も状態も変えない"},
    ],
}
