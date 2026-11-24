"""K-1006 契約の作り直し（運営の外枠の数 getOpsShell・全社の一覧・1 社・メンバー・記録・中を見る・止める・再開）の試験。

テストの名前の頭の行 ID（K1006-DC-…）は 11_tickets/K-1006.md の表のマスに 1 対 1 で結ぶ。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
読むのは作り手が出した契約（scripts/ci/f12_contract_kit.py・K-948 が運ぶ）。
"""
from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import f12_contract_kit as k  # noqa: E402

WS_ROW = {"id", "name", "admin_name", "plan_name", "members", "pc", "runs_month", "attention", "billing_state", "state", "state_since"}
WS = {"id", "name", "plan_name", "state", "stop", "admin", "pc", "runs_month", "stuck_runs", "files", "recent", "peek"}
PEEK = {"id", "workspace_id", "reason", "expires_at", "closed_at"}


class Shell(unittest.TestCase):
    def test_K1006_DC_001_ops_shell(self) -> None:
        """K1006-DC-001 getOpsShell：答えは operator・inbox・invoices・workspaces・runs_month・pwned の 6 欄（上の数・箱・請求の数をここに寄せる・D-156.4）"""
        self.assertEqual(k.output_fields("getOpsShell"), {"operator", "inbox", "invoices", "workspaces", "runs_month", "pwned"})
        self.assertFalse(k.is_list("getOpsShell"))


class Workspaces(unittest.TestCase):
    def test_K1006_DC_002_list(self) -> None:
        """K1006-DC-002 listOpsWorkspaces：1 行は 11 欄（数と種類だけ・中身を返さない）・問い合わせは q・view・plan・sort・cursor・limit。meta に summary を持たない"""
        self.assertEqual(k.output_fields("listOpsWorkspaces"), WS_ROW)
        self.assertEqual(k.query_names("listOpsWorkspaces"), {"q", "view", "plan", "sort", "cursor", "limit"})
        self.assertNotIn("summary", k.meta_fields("listOpsWorkspaces"))

    def test_K1006_DC_003_list_ranges(self) -> None:
        """K1006-DC-003 問い合わせの値：view は all・attention・stopped・closing／plan は free・team・business／sort は attention・members・runs（気にかけるを上に・人数・今月の実行・D-156.47）／q は 100 字まで"""
        self.assertEqual(k.query_param("listOpsWorkspaces", "view").get("enum"), ["all", "attention", "stopped", "closing"])
        self.assertEqual(k.query_param("listOpsWorkspaces", "plan").get("enum"), ["free", "team", "business"])
        self.assertEqual(k.query_param("listOpsWorkspaces", "sort").get("enum"), ["attention", "members", "runs"])
        self.assertEqual(k.query_param("listOpsWorkspaces", "q").get("maxLength"), 100)

    def test_K1006_DC_004_get(self) -> None:
        """K1006-DC-004 getOpsWorkspace：答えは 12 欄（stop は止める予定・止めた日・理由／peek は自分が開いている中を見る許可）"""
        self.assertEqual(k.output_fields("getOpsWorkspace"), WS)

    def test_K1006_DC_005_members_and_resend(self) -> None:
        """K1006-DC-005 listOpsWorkspaceMembers：1 行は member_id（uuid）・name・email・role_label・last_seen_at・pc・login_methods・verified。resendOpsVerification：入力は空の体・答えは sent_at"""
        self.assertEqual(k.output_fields("listOpsWorkspaceMembers"),
                         {"member_id", "name", "email", "role_label", "last_seen_at", "pc", "login_methods", "verified"})
        self.assertEqual(k.input_fields("resendOpsVerification"), set())
        self.assertEqual(k.output_fields("resendOpsVerification"), {"sent_at"})

    def test_K1006_DC_006_inquiries_and_audit(self) -> None:
        """K1006-DC-006 listOpsWorkspaceInquiries：1 行は id・title・topic・asker_name・owner_name・state・created_at。listOpsWorkspaceAudit：1 行は id・at・actor_name・action・action_label・target_label・reason／問い合わせは from・to・cursor・limit"""
        self.assertEqual(k.output_fields("listOpsWorkspaceInquiries"),
                         {"id", "title", "topic", "asker_name", "owner_name", "state", "created_at"})
        self.assertEqual(k.output_fields("listOpsWorkspaceAudit"),
                         {"id", "at", "actor_name", "action", "action_label", "target_label", "reason"})
        self.assertEqual(k.query_names("listOpsWorkspaceAudit"), {"from", "to", "cursor", "limit"})

    def test_K1006_DC_007_peek(self) -> None:
        """K1006-DC-007 openPeek：入力は reason（1〜200・必須）・minutes（1〜60・必須・D-128.68 の 1 時間）・inquiry_id（uuid・任意）。closePeek と openPeek の答えは 5 欄"""
        self.assertEqual(k.input_fields("openPeek"), {"reason", "minutes", "inquiry_id"})
        self.assertEqual(k.required_fields("openPeek"), {"reason", "minutes"})
        m = k.input_prop("openPeek", "minutes")
        self.assertEqual((m.get("minimum"), m.get("maximum")), (1, 60))
        r = k.input_prop("openPeek", "reason")
        self.assertEqual((r.get("minLength"), r.get("maxLength")), (1, 200))
        for op in ("openPeek", "closePeek"):
            self.assertEqual(k.output_fields(op), PEEK, op)

    def test_K1006_DC_008_stop_resume(self) -> None:
        """K1006-DC-008 stopWorkspace：入力は reason_key（unpaid・violation・danger・request）・mode（scheduled・now）・stop_on（日付）・note・admin_notice。必須は reason_key と mode。resumeWorkspace：入力は note（任意）。どちらも答えは 1 社の 12 欄"""
        self.assertEqual(k.input_fields("stopWorkspace"), {"reason_key", "mode", "stop_on", "note", "admin_notice"})
        self.assertEqual(k.required_fields("stopWorkspace"), {"reason_key", "mode"})
        self.assertEqual(k.input_prop("stopWorkspace", "reason_key").get("enum"), ["unpaid", "violation", "danger", "request"])
        self.assertEqual(k.input_prop("stopWorkspace", "mode").get("enum"), ["scheduled", "now"])
        self.assertEqual(k.input_prop("stopWorkspace", "stop_on").get("format"), "date")
        self.assertEqual(k.input_fields("resumeWorkspace"), {"note"})
        for op in ("stopWorkspace", "resumeWorkspace"):
            self.assertEqual(k.output_fields(op), WS, op)

    def test_K1006_DC_009_uuid_perms_scope(self) -> None:
        """K1006-DC-009 `_id` の欄は uuid・権限の言葉は今のまま（shell・一覧・1 社・記録は ops:any／メンバー・送り直し・問い合わせは ops:inquiry／中を見るは ops:peek／止める・再開は ops:stop）"""
        want = {"getOpsShell": "ops:any", "listOpsWorkspaces": "ops:any", "getOpsWorkspace": "ops:any",
                "listOpsWorkspaceAudit": "ops:any", "listOpsWorkspaceMembers": "ops:inquiry",
                "resendOpsVerification": "ops:inquiry", "listOpsWorkspaceInquiries": "ops:inquiry",
                "openPeek": "ops:peek", "closePeek": "ops:peek", "stopWorkspace": "ops:stop", "resumeWorkspace": "ops:stop"}
        for op, word in want.items():
            self.assertEqual(k.perm_word(op), word, op)
            self.assertEqual(k.id_fields_are_uuid(k.input_schema(op)), [], f"{op} の入力")
            self.assertEqual(k.id_fields_are_uuid(k.output_schema(op)), [], f"{op} の答え")


if __name__ == "__main__":
    unittest.main()
