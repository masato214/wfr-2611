# K-973 運営の受信箱を読む口（listOpsInquiries・getOpsInquiry）。入力と答えの形・箱と種類の値は K-948 の断片が持つ。
#   ここは getOpsInquiry の断り（無い・消した問い合わせは 404・欄なし）だけ。一覧の limit の上限 100 は K-948 の LIST_DETAILS の値を直す
#   （同じ鍵を 2 つの断片に書けないため）。振る舞いは apps/api/src/features/F12/ops/inbox-read.ts と DB の関数 app.ops_inquiries・app.ops_inquiry
ERRORS_4XX = {
    "getOpsInquiry": [
        {"status": 404, "code": "NOT_FOUND", "body": {"error": "not_found", "code": "NOT_FOUND"}, "errors": [],
         "trigger": "問い合わせが無い・消した・消した会社や作りかけの会社・運営の会社の問い合わせ（欄も details も付けない）",
         "ears_form": "UNWANTED: IF 問い合わせが無いか消してあるなら、Kaname は 404 と NOT_FOUND を返し、在るかを漏らさず何も書かない"},
    ],
}
