# K-949 問い合わせる口（createInquiry・POST /api/v1/inquiries）の断りの番号。入力と答えの形は K-948 の断片が持つ（ここでは形の鍵を足さない）。
#   振る舞いは apps/api/src/features/F12/inquiries/create.ts と DB の関数 app.inquiry_create（K-949 の migration）
ERRORS_4XX = {
    "createInquiry": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "付けた添付が無い・別の人の・別の会社の・消した物（欄も details も付けない＝在るかを漏らさない・D-156.26）",
         "ears_form": "UNWANTED: IF 付けた添付が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も書かない"},
        {"status": 409, "code": "E-INQ-001", "body": {"error": "conflict", "code": "E-INQ-001"}, "errors": ["E-INQ-001"],
         "trigger": "付けた添付の検査が済んでいない（上げ終わる前）か、もう別の問い合わせに付けた（同時に付けたときの後の 1 つも）",
         "ears_form": "UNWANTED: IF 付けた添付がまだ付けられないなら、Kaname は 409 と E-INQ-001 を返し、問い合わせも添付も前のまま残す"},
    ],
}
