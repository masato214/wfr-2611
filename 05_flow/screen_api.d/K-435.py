# K-435 確認項目にチェックを付ける・外す・文を直す口（updateTestSpec）と行を外す口（deleteTestSpec）
# 直す入力は version（必須・1 以上の整数）と、checked か title のどちらか 1 つ（strict）。ticket_id・id・tenant_id・出どころ・チェックの列・種類・判定の型・設定値・off_reason・
#   deleted_at・知らない欄は受けない（422）。題名の確かめは DB の関数 app.test_spec_title_check（K-434）が 1 か所で持つ。外す口は体も版も受けない
INPUTS = {
    "updateTestSpec": ("TestSpecUpdateInput", {"version": "integer", "checked": "boolean", "title": "string"}),
}

REQUIRED_INPUTS = {
    "updateTestSpec": ["version"],
}

# 版は 1 以上・題名は空白だけでない 200 字まで（落とす前の長さ。保存するのは前後の空白を落とした値）
VALUE_RANGES = {
    "updateTestSpec": {
        "version": {"minimum": 1},
        "title": {"pattern": "\\S", "maxLength": 200},
    },
}

# checked か title の「ちょうど 1 つ」
INPUT_RULES = {
    "updateTestSpec": {"oneOf": [{"required": ["checked"]}, {"required": ["title"]}]},
}

UNEXPRESSIBLE_422 = {}   # 決まりは全部契約に書いた（検査の例外は足さない）

# 答えの行は K-434 と同じ SpecItem（鍵ちょうど 6）。直す・付け外すは直した後の姿（version は直した後の版）・外すは外す前の姿
_ITEM = {"id": "uuid", "title": "string", "checked": "boolean", "position": "integer", "source": "string", "version": "integer"}
RESPONSES = {
    "updateTestSpec": ("TestSpecItem", dict(_ITEM)),
    "deleteTestSpec": ("TestSpecItem", dict(_ITEM)),
}

# 直す：書けない人（入口の 403）・見えない／無い／消した／別の会社／消されたチケット（404・欄も details も付けない）・完了した（409・E-SPEC-001）・
#   先に変えられた（409・E-SPEC-020）・チェックが付いている行の文（409・E-SPEC-021）・ナレッジから入った行の文（409・E-SPEC-022）・形の誤り（422）・DB の関数が落ちた（503）
# 外す：403・404・409（E-SPEC-001・E-SPEC-022）・503。外は呼ばないので 502 は無い
_E403 = {"status": 403, "code": "FORBIDDEN", "body": {"error": "forbidden", "code": "FORBIDDEN"}, "errors": []}
_E404 = {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": []}
ERRORS_4XX = {
    "updateTestSpec": [
        dict(_E403, trigger="チケットは見えるが書けない人（読むだけの人。入口の行の守り）",
             ears_form="UNWANTED: IF チケットを書けない人なら、Kaname は 403 を返し、項目も証跡も変えない"),
        dict(_E404, trigger="項目が無い・消した・チケットが見えない・ほかの会社の物・消された（欄も details も付けない＝在るかを漏らさない）",
             ears_form="UNWANTED: IF 項目が無いか見えないなら、Kaname は 404 を返し、在るかを漏らさず項目も証跡も変えない"),
        {"status": 409, "code": "E-SPEC-020", "body": {"error": "conflict", "code": "E-SPEC-020"}, "errors": ["E-SPEC-020"],
         "trigger": "送った版が今の版と違う（先にほかの人が変えた・同じ版から同時に 2 人が直した）",
         "ears_form": "UNWANTED: IF 送った版が今の版と違うなら、Kaname は 409 と E-SPEC-020 を返し、項目も版も証跡も変えない"},
        {"status": 409, "code": "E-SPEC-021", "body": {"error": "conflict", "code": "E-SPEC-021"}, "errors": ["E-SPEC-021"],
         "trigger": "チェックが付いている項目の文を直そうとした（外してから直す）",
         "ears_form": "UNWANTED: IF チェックが付いている項目の文を直そうとしたなら、Kaname は 409 と E-SPEC-021 を返し、項目も版も証跡も変えない"},
        {"status": 409, "code": "E-SPEC-001", "body": {"error": "conflict", "code": "E-SPEC-001"}, "errors": ["E-SPEC-001"],
         "trigger": "チケットが完了した（完了の確定と同時に来たときも、完了の後に来た方）",
         "ears_form": "UNWANTED: IF チケットが完了しているなら、Kaname は 409 と E-SPEC-001 を返し、項目も証跡も変えない"},
        {"status": 409, "code": "E-SPEC-022", "body": {"error": "conflict", "code": "E-SPEC-022"}, "errors": ["E-SPEC-022"],
         "trigger": "ナレッジの「必ず守る」から入った項目の文を直そうとした（チェックの付け外しはできる）",
         "ears_form": "UNWANTED: IF ナレッジから入った項目の文を直そうとしたなら、Kaname は 409 と E-SPEC-022 を返し、項目も版も証跡も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "版が無い・1 未満・整数でない／checked か title のどちらか 1 つでない／checked が真偽でない／題名が空白だけか 200 字を超える／体に知らない欄（strict）",
         "ears_form": "UNWANTED: IF 入力が決まりに合わないなら、Kaname は 422 と欄ごとの理由を返し、項目も証跡も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "項目と証跡を書く DB の関数（app.test_spec_update）が使えない・書けない",
         "ears_form": "UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目も証跡も残さない"},
    ],
    "deleteTestSpec": [
        dict(_E403, trigger="チケットは見えるが書けない人（読むだけの人。入口の行の守り）",
             ears_form="UNWANTED: IF チケットを書けない人なら、Kaname は 403 を返し、項目も証跡も変えない"),
        dict(_E404, trigger="項目が無い・もう外した・チケットが見えない・ほかの会社の物・消された（欄も details も付けない＝在るかを漏らさない）",
             ears_form="UNWANTED: IF 項目が無いか外した後か見えないなら、Kaname は 404 を返し、在るかを漏らさず項目も証跡も変えない"),
        {"status": 409, "code": "E-SPEC-001", "body": {"error": "conflict", "code": "E-SPEC-001"}, "errors": ["E-SPEC-001"],
         "trigger": "チケットが完了した（完了の確定と同時に来たときも、完了の後に来た方）",
         "ears_form": "UNWANTED: IF チケットが完了しているなら、Kaname は 409 と E-SPEC-001 を返し、項目も証跡も変えない"},
        {"status": 409, "code": "E-SPEC-022", "body": {"error": "conflict", "code": "E-SPEC-022"}, "errors": ["E-SPEC-022"],
         "trigger": "ナレッジの「必ず守る」から入った項目を外そうとした",
         "ears_form": "UNWANTED: IF ナレッジから入った項目を外そうとしたなら、Kaname は 409 と E-SPEC-022 を返し、項目も証跡も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "項目の印と証跡を書く DB の関数（app.test_spec_delete）が使えない・書けない",
         "ears_form": "UNWANTED: IF 書けないなら、Kaname は 503 と E-PAGE-003 を返し、項目は残し証跡も残さない"},
    ],
}
