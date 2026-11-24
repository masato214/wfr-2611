# K-1005 請求とプランの契約の作り直し（契約だけ・振る舞いは後の葉 K-958〜K-962・K-968・K-981〜K-984・K-1017）
#   利用者の 5 口（getBilling・downloadInvoicePdf・updateBillingContact・listWorkspacePlans・changePlan）と
#   運営の 5 口（listOpsInvoices・issueOpsInvoices・recordPayment・getOpsWorkspaceBilling・changeOpsWorkspacePlan）を、画面の下絵が要る欄にする。
#   本体 05_flow/screen_api.py の前からの行（listWorkspacePlans・getBilling・getOpsWorkspaceBilling の答え・listOpsInvoices の META の summary）は本体で直した。
#   お金は税込の円の整数・日付は YYYY-MM-DD。形で書ける物だけ 422（人数が上限を超えるプランに下げる・決まった月の請求書が無い・同じ入金の二重は振る舞いの葉の 409／404）

_MONTH = "^[0-9]{4}-(0[1-9]|1[0-2])$"
_STATES = ["unpaid", "paid", "overdue"]   # お支払い待ち・払われた・期限を過ぎた（D-156.29）

# 体は strict（知らない欄は 422）
INPUTS = {
    "updateBillingContact": ("BillingContactInput", {"company": "string", "attn": "string", "email": "string"}),
    "changePlan": ("PlanChangeInput", {"plan_key": "string"}),
    "issueOpsInvoices": ("OpsInvoiceIssueInput", {"month": "string", "dry_run": "boolean"}),
    # 取り消しは打ち消しの行（reverses_payment_id に取り消す入金の id・D-156.32）
    "recordPayment": ("PaymentRecordInput", {"amount": "integer", "paid_on": "string", "payer_name": "string", "reverses_payment_id": "uuid"}),
    "changeOpsWorkspacePlan": ("OpsPlanChangeInput", {"plan_key": "string", "inquiry_id": "uuid"}),
}

REQUIRED_INPUTS = {
    "updateBillingContact": ["company", "attn", "email"],   # 請求先 3 欄は全部必須（D-156.30）
    "changePlan": ["plan_key"],
    "issueOpsInvoices": ["month"],   # dry_run が true なら下書きを返して出さない（D-156.31）
    "recordPayment": ["amount", "paid_on"],
    "changeOpsWorkspacePlan": ["plan_key", "inquiry_id"],   # 頼まれた問い合わせを付ける
}

VALUE_RANGES = {
    # 会社名・宛名は空白だけを断る（D-156.38・K959-API-003 が頼る）
    "updateBillingContact": {
        "company": {"minLength": 1, "maxLength": 100, "pattern": "\\S"},
        "attn": {"minLength": 1, "maxLength": 100, "pattern": "\\S"},
        "email": {"format": "email"},
    },
    "changePlan": {"plan_key": {"pattern": "\\S"}},
    "issueOpsInvoices": {"month": {"pattern": _MONTH}},
    "recordPayment": {
        "amount": {"minimum": 1},
        "paid_on": {"format": "date"},
        "payer_name": {"minLength": 1, "maxLength": 100},
    },
    "changeOpsWorkspacePlan": {"plan_key": {"pattern": "\\S"}},
}

_PLAN_CHANGE = {"plan_key": "string", "effective_from": "string", "prorated_amount": "integer", "next_invoice_on": "string"}
# 運営の請求の 1 行（11 欄・D-156.44）。payments はその請求書の入金の並び { id（uuid）, paid_on, amount, payer_name?, reversed }（取り消しの行そのものは並べない）
_OPS_INVOICE = {"id": "uuid", "workspace": "object", "plan_name": "string", "month": "string", "amount_total": "integer", "state": "string",
                "paid_total": "integer", "difference": "integer", "due_on": "string", "can_record_payment": "boolean", "payments": "array"}
RESPONSES = {
    "updateBillingContact": ("BillingContact", {"company": "string", "attn": "string", "email": "string"}),
    "changePlan": ("PlanChange", dict(_PLAN_CHANGE)),
    "listOpsInvoices": ("OpsInvoiceRow", dict(_OPS_INVOICE)),
    # まとめて出す：lines の 1 行は { workspace, plan_name, amount, tax, prorated, total }（D-156.31）
    "issueOpsInvoices": ("OpsInvoiceIssue", {"month": "string", "count": "integer", "total": "integer", "lines": "array"}),
    "recordPayment": ("OpsInvoiceRow", dict(_OPS_INVOICE)),
    "changeOpsWorkspacePlan": ("PlanChange", dict(_PLAN_CHANGE)),
}

# 選べるプランの答えの meta：いまの人数（社内の人だけ・ゲストは数えない＝D-156.51）と上限（D-156.36）
META = {
    "listWorkspacePlans": {"members": "integer", "member_limit": "integer"},
}

# 運営の請求の問い合わせ：month は YYYY-MM・state は 3 つ（QUERIES の month・state は本体の行のまま）
QUERY_RANGES = {
    "listOpsInvoices": {"month": {"pattern": _MONTH}, "state": {"enum": list(_STATES)}},
}

# 運営の請求の一覧は sort を受けない。請求の数（文書だけに在った summary）は getOpsShell に寄せた（D-156.4）
LIST_DETAILS = {
    "listOpsInvoices": {"sort": False, "desc": "取得（invoices）— 運営が月ごとの請求書を見る（お支払い待ち・払われた・期限を過ぎた・入金の並びつき）"},
}
