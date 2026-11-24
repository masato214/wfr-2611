# K-958 請求書を読む口（getBilling）と請求書の PDF の口（downloadInvoicePdf）
#   契約の形（答えの 7 欄・PDF の { url, expires_at }）は K-1005 の断片が持つ。この葉は振る舞いと、PDF の口の 404・409 を足す
#   振る舞いの本体は apps/api/src/features/F12/billing/read.ts（DB の関数 app.billing_get・app.billing_invoice_pdf）
ERRORS_4XX = {
    "downloadInvoicePdf": [
        {"status": 404, "code": "E-PAGE-001", "body": {"error": "not_found", "code": "E-PAGE-001"}, "errors": ["E-PAGE-001"],
         "trigger": "請求書が無い・消した・出していない（下書き）・別の会社の物（欄も details も付けない＝在るかを漏らさない）",
         "ears_form": "UNWANTED: IF 請求書が無いか見えないなら、Kaname は 404 と E-PAGE-001 を返し、在るかを漏らさず署名しない"},
        {"status": 409, "code": "E-BILL-001", "body": {"error": "conflict", "code": "E-BILL-001"}, "errors": ["E-BILL-001"],
         "trigger": "出した請求書の PDF がまだできていない（pdf_ref が空。作るのは請求書を出す葉）",
         "ears_form": "UNWANTED: IF 請求書の PDF がまだできていないなら、Kaname は 409 と E-BILL-001 を返し、署名しない"},
    ],
}
