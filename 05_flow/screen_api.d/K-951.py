# K-951 自分の問い合わせを読む口（listMyInquiries・GET /api/v1/inquiries／getMyInquiry・GET /api/v1/inquiries/:id）の断りの番号。
#   入力と答えの形は K-948 の断片が持つ（ここでは形の鍵を足さない）。振る舞いは apps/api/src/features/F12/inquiries/read.ts
ERRORS_4XX = {
    "getMyInquiry": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "他人の（同じ会社の管理者が開く）・別の会社の・無い・消した問い合わせ（欄も details も付けない＝在るかを漏らさない・D-156.25）",
         "ears_form": "UNWANTED: IF 開いた問い合わせが本人の物でないか無いなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず読んだ印も入れない"},
    ],
}
