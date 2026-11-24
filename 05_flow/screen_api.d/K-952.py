# K-952 問い合わせに返事を書く口（postInquiryMessage・POST /api/v1/inquiries/:id/messages）と済みにする口（resolveMyInquiry・POST /api/v1/inquiries/:id/resolve）の断りの番号。
#   入力と答えの形は K-948 の断片が持つ（ここでは形の鍵を足さない）。振る舞いは apps/api/src/features/F12/inquiries/reply.ts と DB の関数 app.inquiry_post・app.inquiry_resolve（K-952 の migration）
ERRORS_4XX = {
    "postInquiryMessage": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "他人の（同じ会社の管理者が書く）・別の会社の・無い・消した問い合わせ、または付けた添付が無い・見えない（欄も details も付けない＝在るかを漏らさない・D-156.25・D-156.26）",
         "ears_form": "UNWANTED: IF 書く問い合わせか付けた添付が本人の物でないか無いなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず何も書かない"},
        {"status": 409, "code": "E-INQ-001", "body": {"error": "conflict", "code": "E-INQ-001"}, "errors": ["E-INQ-001"],
         "trigger": "付けた添付の検査が済んでいない（上げ終わる前）か、もう別の書き込みに付けた",
         "ears_form": "UNWANTED: IF 付けた添付がまだ付けられないなら、Kaname は 409 と E-INQ-001 を返し、書き込みも状態も添付も前のまま残す"},
    ],
    "resolveMyInquiry": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "他人の（同じ会社の管理者が済みにする）・別の会社の・無い・消した問い合わせ（欄も details も付けない＝在るかを漏らさない・D-156.25）",
         "ears_form": "UNWANTED: IF 済みにする問い合わせが本人の物でないか無いなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず状態を変えない"},
    ],
}
