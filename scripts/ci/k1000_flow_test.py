#!/usr/bin/env python3
"""K-1000 の試験（段 13 の流れと文書：flow.json の A80・A138・ops-skills・運営のナビ、親 K-72 の apis、08_api/phase1/10 の上の数）。
行 ID は K1000-FL-NNN（11_tickets/K-1000.md の表と 1 対 1）。段 10 の K-727 と同じ形：流れの正本は作り手の出力なので、
phase1.py と flows.json を直して build_flow.py で作り直した flow.json を読む。テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
FLOW = ROOT / "05_flow" / "flow.json"
FLOWS = ROOT / "05_flow" / "flows.json"
PHASE1 = ROOT / "05_flow" / "phase1.py"
K72 = ROOT / "11_tickets" / "K-72.md"
DOC10 = ROOT / "08_api" / "phase1" / "10_運営と困ったとき.md"
DECISIONS = ROOT / "01_hearing" / "決定ログ_進行中.md"
ENDPOINTS = ROOT / "08_api" / "endpoints.json"
USER_APIS = [
    "listMyInquiries", "createInquiry", "getMyInquiry", "postInquiryMessage", "resolveMyInquiry", "uploadInquiryAttachment",
    "listNotices", "markNoticeRead", "getServiceStatusForMember",
    "getBilling", "downloadInvoicePdf", "updateBillingContact",
    "listWorkspacePlans", "changePlan",
]
WORK_TYPE_APIS = ["getOpsWorkType", "getWorkTypeUpload", "listOpsWorkTypes", "releaseOpsWorkType", "rollbackOpsWorkType", "uploadWorkTypePackage"]
R6_NAV = ["ops-home", "ops-tenant", "ops-support", "ops-notices", "ops-billing", "ops-skills", "ops-team"]
GONE = "業務の型"


def flow() -> dict:
    return json.loads(FLOW.read_text(encoding="utf-8"))


def acts(f: dict) -> dict[str, dict]:
    return {a["id"]: a for p in f["backbone"] for a in p["acts"]}


def head_list(path: pathlib.Path, key: str) -> list[str]:
    head = path.read_text(encoding="utf-8").split("---")[1]
    m = re.search(rf"^{key}:\s*\[(.*)\]$", head, re.M)
    return [x.strip() for x in (m.group(1) if m else "").split(",") if x.strip()]


class FlowTest(unittest.TestCase):
    def test_K1000_FL_001_a80_read_only(self) -> None:
        """A80 は「操作の版を見る（読むだけ）」で、文・人の手・裏側に「業務の型」が無く、触る関門が無く、根拠に D-156.7 を持つ"""
        f = flow()
        a = acts(f)["A80"]
        bp = f["blueprint"]["A80"]
        self.assertEqual(a["act"], "操作の版を見る（読むだけ）")
        for s in (a["act"], bp["human"], bp["backstage"]):
            self.assertNotIn(GONE, s)
        self.assertEqual(bp["choke_points"], [])
        self.assertIn("D-156.7", a["source"])

    def test_K1000_FL_002_a138_recovery(self) -> None:
        """A138（照合が使えなかった登録を確かめる）が第 1 フェーズの行為として在り、役は R6 だけ・画面は ops-home・関門 C2・根拠に D-128.146 と D-156.8。流れ F12 の行為にも在る"""
        f = flow()
        a = acts(f).get("A138")
        self.assertIsNotNone(a, "A138 が無い")
        self.assertEqual(a["roles"], ["R6"])
        self.assertEqual(a["release"], "v1")
        self.assertEqual(f["act_to_screen"]["A138"], ["ops-home"])
        self.assertEqual(f["blueprint"]["A138"]["choke_points"], ["C2"])
        self.assertTrue({"D-128.146", "D-156.8"} <= set(a["source"]))
        f12 = [x for x in json.loads(FLOWS.read_text(encoding="utf-8"))["flows"] if x["id"] == "F12"][0]
        self.assertIn("A138", f12["acts"])

    def test_K1000_FL_003_ops_skills_screen(self) -> None:
        """画面 ops-skills（配るもの）の目的と扱う物に「業務の型」が無く、目的に「操作」「ひな形」「プラン」が在り、扱う物はその 3 つ"""
        s = [x for x in flow()["screens"] if x["id"] == "ops-skills"][0]
        self.assertNotIn(GONE, s["purpose"])
        for w in ("操作", "ひな形", "プラン"):
            self.assertIn(w, s["purpose"])
        self.assertEqual(s["objects"], ["操作", "ひな形", "プラン"])

    def test_K1000_FL_004_ops_nav(self) -> None:
        """運営（R6）の主ナビは ワークスペース・1 社・問い合わせ・お知らせ・請求・配るもの・運営の人 の順（D-156.1）で、配るものの第 2 ナビは 操作・ひな形・プラン の 3 つ"""
        nav = flow()["navigation"]
        self.assertEqual(nav["by_role"]["R6"], R6_NAV)
        self.assertEqual([x["label"] for x in nav["sub_by_screen"]["ops-skills"]], ["操作", "ひな形", "プラン"])

    def test_K1000_FL_005_no_work_type_for_ops(self) -> None:
        """運営の役 R6 の説明・用事 J12 の文・流れ F12 の行為の文のどれにも「業務の型」が無い"""
        f = flow()
        r6 = [r for r in f["roles"] if r["id"] == "R6"][0]
        j12 = [j for j in f["jobs"] if j["id"] == "J12"][0]
        f12 = [x for x in json.loads(FLOWS.read_text(encoding="utf-8"))["flows"] if x["id"] == "F12"][0]
        texts = [r6.get("desc", ""), j12["statement"]] + [acts(f)[i]["act"] for i in f12["acts"]]
        self.assertEqual([t for t in texts if GONE in t], [])

    def test_K1000_FL_006_k72_apis(self) -> None:
        """親 K-72 の apis: に利用者の口 14 本が全部在り、業務の型の 6 口が無く、どの口も契約（endpoints.json）に在る"""
        apis = head_list(K72, "apis")
        self.assertEqual([a for a in USER_APIS if a not in apis], [])
        self.assertEqual([a for a in WORK_TYPE_APIS if a in apis], [])
        eps = json.loads(ENDPOINTS.read_text(encoding="utf-8"))
        rows = eps if isinstance(eps, list) else eps.get("endpoints", list(eps.values()))
        ops = {r.get("operationId") or r.get("operation_id") or r.get("id") for r in rows if isinstance(r, dict)}
        self.assertEqual([a for a in apis if a not in ops], [])

    def test_K1000_FL_007_doc_counts(self) -> None:
        """文書 08_api/phase1/10 に、文書だけの上の数の口 3 本（/ops/workspaces/summary・/ops/inquiries/counts・/ops/invoices/summary）が無く、上の数は getOpsShell に寄せると書いてある（D-156.4）"""
        doc = DOC10.read_text(encoding="utf-8")
        for p in ("/ops/workspaces/summary", "/ops/inquiries/counts", "/ops/invoices/summary"):
            self.assertNotIn(p, doc)
        self.assertIn("getOpsShell", doc)

    def test_K1000_FL_008_sources_exist(self) -> None:
        """phase1.py が根拠に挙げた D-156.n は 1 つ以上在り、どれも決定ログ §156 の表に在る"""
        used = sorted(set(re.findall(r"D-156\.\d+", PHASE1.read_text(encoding="utf-8"))))
        self.assertTrue(used, "phase1.py が D-156 を根拠に挙げていない")
        log = DECISIONS.read_text(encoding="utf-8")
        self.assertEqual([d for d in used if not re.search(rf"^\|\s*{re.escape(d)}\s*\|", log, re.M)], [])

    def test_K1000_FL_009_flow_gates(self) -> None:
        """画面の導出の検査（flow_gate.py の G1〜G10・G17・G22）と流れと表の検査（flow_db_gate.py）が 0 で終わる"""
        for cmd in (
            ["scripts/ci/flow_gate.py", "--flow", "05_flow/flow.json", "--choke", "03_architecture/choke-points.json"],
            ["scripts/ci/flow_db_gate.py"],
        ):
            p = subprocess.run([sys.executable, *cmd], cwd=ROOT, capture_output=True, text=True, timeout=300)
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)

    def test_K1000_FL_010_coverage(self) -> None:
        """チケットの被覆の検査（coverage_gate.py の KC5 無い口を書かない・KC7 口の持ち主は 1 枚）が 0 で終わる"""
        p = subprocess.run(
            [sys.executable, "scripts/tickets/coverage_gate.py", "--only", "KC5", "--only", "KC7"],
            cwd=ROOT, capture_output=True, text=True, timeout=300,
        )
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)


if __name__ == "__main__":
    unittest.main()
