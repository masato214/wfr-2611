"""K-1005 契約の作り直し（請求書・請求先・プラン・運営の請求と入金・1 社のプランと請求）の試験。

テストの名前の頭の行 ID（K1005-DC-…）は 11_tickets/K-1005.md の表のマスに 1 対 1 で結ぶ。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
読むのは作り手が出した契約（scripts/ci/f12_contract_kit.py・K-948 が運ぶ）。
"""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import f12_contract_kit as k  # noqa: E402
from portable_regex import portable  # noqa: E402  作り手が契約に書くときの直し（K-1117）

BILL_STATES = ["unpaid", "paid", "overdue"]
OPS_INVOICE = {"id", "workspace", "plan_name", "month", "amount_total", "state", "paid_total", "difference", "due_on", "can_record_payment", "payments"}
PLAN_CHOICE = {"plan_key", "name", "price_monthly", "member_limit", "current", "can_choose", "reason", "effective_from",
               "summary", "recommended", "upgrade", "upcoming"}
PLAN_CHANGE = {"plan_key", "effective_from", "prorated_amount", "next_invoice_on"}


class UserBilling(unittest.TestCase):
    def test_K1005_DC_001_get_billing(self) -> None:
        """K1005-DC-001 getBilling：答えは terms・payee・contact・invoices・overdue・free・can_edit_contact の 7 欄（表の写しの subscriptions を返さない）"""
        self.assertEqual(k.output_fields("getBilling"), {"terms", "payee", "contact", "invoices", "overdue", "free", "can_edit_contact"})

    def test_K1005_DC_002_pdf_unchanged(self) -> None:
        """K1005-DC-002 downloadInvoicePdf の形は今のまま（url と expires_at・書き出しではない＝D-156.13）"""
        self.assertEqual(k.output_fields("downloadInvoicePdf"), {"url", "expires_at"})

    def test_K1005_DC_003_billing_contact(self) -> None:
        """K1005-DC-003 updateBillingContact：入力は company・attn・email（全部必須・D-156.30）・email は形・答えは同じ 3 欄"""
        self.assertEqual(k.input_fields("updateBillingContact"), {"company", "attn", "email"})
        self.assertEqual(k.required_fields("updateBillingContact"), {"company", "attn", "email"})
        self.assertEqual(k.input_prop("updateBillingContact", "email").get("format"), "email")
        for f in ("company", "attn"):
            p = k.input_prop("updateBillingContact", f)
            self.assertEqual((p.get("minLength"), p.get("maxLength")), (1, 100), f)
            self.assertEqual(p.get("pattern"), portable("\\S"), f"{f} は空白だけを断る（D-156.38・作り手が JS と同じ字にして書く＝K-1117）")
        self.assertEqual(k.output_fields("updateBillingContact"), {"company", "attn", "email"})

    def test_K1005_DC_004_list_plans(self) -> None:
        """K1005-DC-004 listWorkspacePlans：1 行は 12 欄（plan_id をやめ plan_key・_id は uuid の決まり。下絵の字を作る summary・recommended・upgrade・upcoming を含む＝D-156.43）・
        upgrade と upcoming は null を許す object・meta に今の人数と上限（D-156.36）"""
        self.assertEqual(k.output_fields("listWorkspacePlans"), PLAN_CHOICE)
        for f in ("upgrade", "upcoming"):  # 中の欄は契約の型に出ない（object? の 1 つ）。中身は振る舞いの葉 K-961・K-1017 の試験が見る
            p = k.output_prop("listWorkspacePlans", f)
            self.assertEqual((p.get("type"), p.get("nullable")), ("object", True), f)
        self.assertNotIn("plan_id", k.output_fields("listWorkspacePlans"))
        self.assertEqual(k.meta_fields("listWorkspacePlans"), {"members", "member_limit"})

    def test_K1005_DC_005_change_plan(self) -> None:
        """K1005-DC-005 changePlan：入力は plan_key だけ（必須）・答えは plan_key・effective_from・prorated_amount・next_invoice_on"""
        self.assertEqual(k.input_fields("changePlan"), {"plan_key"})
        self.assertEqual(k.required_fields("changePlan"), {"plan_key"})
        self.assertEqual(k.output_fields("changePlan"), PLAN_CHANGE)


class OpsBilling(unittest.TestCase):
    def test_K1005_DC_006_list_ops_invoices(self) -> None:
        """K1005-DC-006 listOpsInvoices：1 行は 10 欄・問い合わせは month（YYYY-MM）・state（3 つ）・cursor・limit。meta に summary を持たない（D-156.4）"""
        self.assertEqual(k.output_fields("listOpsInvoices"), OPS_INVOICE)
        self.assertEqual(k.query_names("listOpsInvoices"), {"month", "state", "cursor", "limit"})
        self.assertEqual(k.query_param("listOpsInvoices", "month").get("pattern"), "^[0-9]{4}-(0[1-9]|1[0-2])$")
        self.assertEqual(k.query_param("listOpsInvoices", "state").get("enum"), BILL_STATES)
        self.assertNotIn("summary", k.meta_fields("listOpsInvoices"))
        self.assertEqual(k.output_prop("listOpsInvoices", "payments").get("type"), "array")  # 1 件の中身は K-982・K-983 の試験が見る

    def test_K1005_DC_007_issue(self) -> None:
        """K1005-DC-007 issueOpsInvoices：入力は month と dry_run（month 必須・下書きを見るのは dry_run true・D-156.31）・答えは month・count・total・lines"""
        self.assertEqual(k.input_fields("issueOpsInvoices"), {"month", "dry_run"})
        self.assertEqual(k.required_fields("issueOpsInvoices"), {"month"})
        self.assertEqual(k.output_fields("issueOpsInvoices"), {"month", "count", "total", "lines"})

    def test_K1005_DC_008_record_payment(self) -> None:
        """K1005-DC-008 recordPayment：入力は amount（1 以上の整数）・paid_on（日付）・payer_name・reverses_payment_id（uuid・取り消しの行・D-156.32）。必須は amount と paid_on。答えは 1 行の 10 欄"""
        self.assertEqual(k.input_fields("recordPayment"), {"amount", "paid_on", "payer_name", "reverses_payment_id"})
        self.assertEqual(k.required_fields("recordPayment"), {"amount", "paid_on"})
        amt = k.input_prop("recordPayment", "amount")
        self.assertEqual((amt.get("type"), amt.get("minimum")), ("integer", 1))
        self.assertEqual(k.input_prop("recordPayment", "paid_on").get("format"), "date")
        self.assertEqual(k.input_prop("recordPayment", "reverses_payment_id").get("format"), "uuid")
        self.assertEqual(k.output_fields("recordPayment"), OPS_INVOICE)

    def test_K1005_DC_009_workspace_billing(self) -> None:
        """K1005-DC-009 getOpsWorkspaceBilling：答えは plan・members・payment_terms・invoices の 4 欄（利用量は人数だけ・D-156.36）"""
        self.assertEqual(k.output_fields("getOpsWorkspaceBilling"), {"plan", "members", "payment_terms", "invoices"})

    def test_K1005_DC_010_ops_change_plan(self) -> None:
        """K1005-DC-010 changeOpsWorkspacePlan：入力は plan_key と inquiry_id（頼まれた問い合わせ・uuid・どちらも必須）・答えは changePlan と同じ 4 欄"""
        self.assertEqual(k.input_fields("changeOpsWorkspacePlan"), {"plan_key", "inquiry_id"})
        self.assertEqual(k.required_fields("changeOpsWorkspacePlan"), {"plan_key", "inquiry_id"})
        self.assertEqual(k.input_prop("changeOpsWorkspacePlan", "inquiry_id").get("format"), "uuid")
        self.assertEqual(k.output_fields("changeOpsWorkspacePlan"), PLAN_CHANGE)

    def test_K1005_DC_011_uuid_and_perms(self) -> None:
        """K1005-DC-011 `_id` の欄は uuid・権限の言葉は今のまま（利用者は admin・運営は ops:money）"""
        user = ["getBilling", "downloadInvoicePdf", "updateBillingContact", "listWorkspacePlans", "changePlan"]
        ops = ["listOpsInvoices", "issueOpsInvoices", "recordPayment", "getOpsWorkspaceBilling", "changeOpsWorkspacePlan"]
        for op in user + ops:
            self.assertEqual(k.id_fields_are_uuid(k.input_schema(op)), [], f"{op} の入力")
            self.assertEqual(k.id_fields_are_uuid(k.output_schema(op)), [], f"{op} の答え")
        for op in ops:
            self.assertEqual(k.perm_word(op), "ops:money", op)
        for op in user:
            self.assertEqual(k.perm_word(op), k.endpoint(op)["permission"]["who"], op)


if __name__ == "__main__":
    unittest.main()
