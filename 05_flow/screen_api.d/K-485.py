# K-485 止まった AI の仕事から「自分で直す」口（takeoverActionRun）
# 体は空（どの欄も無い・strict なので知らない欄は 422）。答えは実行の 1 件（getActionRun・listTicketRuns と同じ ActionRunView の 16 欄）
INPUTS = {
    "takeoverActionRun": ("ActionRunTakeoverInput", {}),
}

RESPONSES = {
    "takeoverActionRun": ("ActionRunView", {"id": "string", "ticket_id": "string", "phase": "string", "status": "string", "by": "object", "pc": "string",
                                            "silent": "boolean", "last_event_at": "string?", "progress": "string?", "stopped_reason": "string?",
                                            "return_reason": "string?", "started_at": "string?", "finished_at": "string?", "taken_over_at": "string?",
                                            "reason_kind": "string?", "checks": "object"}),
}

# 権限（403・担当者だけ）・見えない／無い／消した（404）・今の状態ではできない（409 ×3）・体に知らない欄（422）・取引が失敗（503・取引ごと戻る）
ERRORS_4XX = {
    "takeoverActionRun": [
        {"status": 403, "code": "E-STP-001", "body": {"error": "permission", "code": "E-STP-001"}, "errors": ["E-STP-001"],
         "trigger": "担当者でない人（書ける人・AI に任せた人でもよい）・担当者のいないチケットで、自分で直すにしようとした",
         "ears_form": "UNWANTED: IF 担当者でない人か担当者のいないチケットで自分で直すにしようとしたなら、Kaname は 403 と E-STP-001 を返し、実行も仕事も段もやり取りも変えない"},
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"},
         "trigger": "別の会社・見えないグループ・無い id・消したチケットの実行（有ることも漏らさない）",
         "ears_form": "UNWANTED: IF 見えない実行・無い実行・消したチケットの実行を自分で直すにしようとしたなら、Kaname は 404 を返し、何も変えない"},
        {"status": 409, "code": "E-STP-002", "body": {"error": "conflict", "code": "E-STP-002"}, "errors": ["E-STP-002"],
         "trigger": "承認待ち・完了のチケット・承認の後の実行・作り終えた実行で、自分で直すにしようとした",
         "ears_form": "UNWANTED: IF 承認待ち・完了のチケットか承認の後の実行か作り終えた実行を自分で直すにしようとしたなら、Kaname は 409 と E-STP-002 を返し、何も変えない"},
        {"status": 409, "code": "E-STP-003", "body": {"error": "conflict", "code": "E-STP-003"}, "errors": ["E-STP-003"],
         "trigger": "もう自分で進めることにした実行を、もう一度（二度押し・別のタブ・同時に 2 つの負けた方）",
         "ears_form": "UNWANTED: IF もう自分で進めることにした実行をもう一度自分で直すにしようとしたなら、Kaname は 409 と E-STP-003 を返し、やり取りの行も証跡も増やさない"},
        {"status": 409, "code": "E-STP-004", "body": {"error": "conflict", "code": "E-STP-004"}, "errors": ["E-STP-004"],
         "trigger": "同じチケットにもっと新しい実行がある古い止まりを指している",
         "ears_form": "UNWANTED: IF 同じチケットにもっと新しい実行があるのに古い止まりを自分で直すにしようとしたなら、Kaname は 409 と E-STP-004 を返し、新しい実行を止めずに何も変えない"},
        {"status": 422, "code": "VALIDATION_ERROR", "body": {"error": "validation_failed", "details": []}, "errors": [],
         "trigger": "体に知らない項目（strict）",
         "ears_form": "UNWANTED: IF 体に知らない項目があるなら、Kaname は 422 と項目ごとの理由を返し、何も変えない"},
        {"status": 503, "code": "E-PAGE-003", "body": {"error": "dependency", "code": "E-PAGE-003"}, "errors": ["E-PAGE-003"],
         "trigger": "切り替える DB の関数が使えない・証跡が書けない・DB が落ちた（取引ごと戻る）",
         "ears_form": "UNWANTED: IF 切り替える関数か証跡の書き込みか DB が落ちたなら、Kaname は 503 と E-PAGE-003 を返し、実行も仕事もチケットもやり取りも変えない"},
    ],
}

# 自分で直すの答えは、止まった・動いている実行 1 件（チケットの実行だけ。task の実行は引き取れない）なので ticket_id・phase は必ず入る（K-62 の読む 2 つの口と同じ理由）
NOT_NULL_ANSWERS = {
    "takeoverActionRun.ticket_id": "チケットの実行だけを引き取る口。DB の関数 app.run_takeover は ticket_id を持つ実行だけを読む（action_runs.ticket_id は会話の実行のために null 可）",
    "takeoverActionRun.phase": "作る段（phase make）の実行だけを引き取る口。DB の関数 app.run_takeover が make でなければ DECIDED で断る（action_runs.phase は会話の実行のために null 可）",
}
