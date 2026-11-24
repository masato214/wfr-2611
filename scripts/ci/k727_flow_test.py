#!/usr/bin/env python3
"""K-727 の試験（流れ：flow.json・flows.json・ナビ・親の入れ物）。行 ID は K727-FL-NNN（11_tickets/K-727.md の表と 1 対 1）。
作る段で phase1.py・flows.json を直し、作り手（05_flow/build_flow.py）で flow.json を作り直してから緑になる（切る段の枝では赤）。
テストはチケットを作る人が書き、実装する人は変えない"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
FLOW = json.loads((ROOT / "05_flow" / "flow.json").read_text(encoding="utf-8"))
FLOWS = json.loads((ROOT / "05_flow" / "flows.json").read_text(encoding="utf-8"))
SCREENS = {s["id"]: s for s in FLOW["screens"]}
ACTS = {a["id"]: a for ph in FLOW["backbone"] for a in ph["acts"]}
NAV = FLOW["navigation"]


def heads(path: str) -> dict[str, str]:
    t = (ROOT / path).read_text(encoding="utf-8").split("---")[1]
    return dict(re.findall(r"^([a-z_]+):\s*(.*)$", t, re.M))


class FlowTest(unittest.TestCase):
    def test_K727_FL_001_masters_screen(self) -> None:
        """画面 masters は「チケットの設定」・道 /workspace/ticket-settings・第 1 フェーズ・役は R1 と R2 だけ（管理者だけ）・目的に「決まり」「守ること」が無い"""
        s = SCREENS["masters"]
        self.assertEqual((s["name"], s["route"], s["release"]), ("チケットの設定", "/workspace/ticket-settings", "v1"))
        self.assertEqual(sorted(s["roles"]), ["R1", "R2"])
        self.assertNotRegex(s["purpose"] + s["name"], "守ること|決まり")
        self.assertEqual(sorted(s["acts"]), ["A118", "A120"])

    def test_K727_FL_002_knowledge_screen(self) -> None:
        """画面 knowledge の道は /knowledge のまま・行為 A114・A136・A93 を持ち（A137 は画面 tickets）・目的が「記憶」でなく棚・上げる・共有・写すを言う"""
        s = SCREENS["knowledge"]
        self.assertEqual(s["route"], "/knowledge")
        self.assertTrue({"A114", "A136", "A93"} <= set(s["acts"]), s["acts"])
        self.assertIn("A137", SCREENS["tickets"]["acts"])
        self.assertNotIn("記憶", s["purpose"])
        for w in ("グループ", "上げる", "共有", "写す"):
            self.assertIn(w, s["purpose"])
        self.assertEqual(ACTS["A136"]["release"], "v1")
        self.assertEqual(ACTS["A137"]["release"], "v1")

    def test_K727_FL_003_acts_text(self) -> None:
        """行為 A118・A114・A93 の文が新しい形：A118 は「チケットの設定を整える」・A93 は「見直すページ」・A114 は「必ず守る」を含み、「決まりを整える」「記憶」が無い。新しい行為は D-152 を根拠に持つ"""
        self.assertTrue(ACTS["A118"]["act"].startswith("チケットの設定を整える"))
        self.assertIn("見直すページ", ACTS["A93"]["act"])
        self.assertIn("必ず守る", ACTS["A114"]["act"])
        for a in ("A118", "A114", "A93", "A136", "A137"):
            self.assertNotRegex(ACTS[a]["act"], "決まりを整える|記憶")
            self.assertTrue(any(x.startswith("D-152.") for x in ACTS[a]["source"]), a)

    def test_K727_FL_004_navigation(self) -> None:
        """主ナビの「（名前）のAI」は clone-chat・ai-activity だけ（rules・work-types は外れ）。どの役の by_role にも rules・work-types が出ない。ナレッジの第 2 ナビは「ページ」「管理」・チケットの設定は「種別」「状態」「項目」"""
        ai = next(s for s in NAV["sections"] if s["key"] == "ai")
        self.assertEqual(ai["screens"], ["clone-chat", "ai-activity"])
        for role, ids in NAV["by_role"].items():
            self.assertTrue({"rules", "work-types"}.isdisjoint(ids), role)
        sub = NAV["sub_by_screen"]
        self.assertEqual([x["label"] for x in sub["knowledge"]], ["ページ", "管理"])
        self.assertEqual([x["label"] for x in sub["masters"]], ["種別", "状態", "項目"])

    def test_K727_FL_005_rules_worktypes_sent_by_k711(self) -> None:
        """画面 rules・work-types は K-711 が口と一緒に後のフェーズへ送った（口より先に送ると契約の口が黙って消える・D-152.22。
        送る回は口を全部外した K-711・PM の決め 2026-11-24）。画面は消さずに v2 で残る"""
        for sid in ("rules", "work-types"):
            self.assertEqual(SCREENS[sid]["release"], "v2", sid)

    def test_K727_FL_006_flows(self) -> None:
        """flows.json：F9 に A118・A114・A136・A93・A137 が在り、A117 は F10 に移り F9 に無い。効き方の影響 E3 の変更は「チケットの設定」と「必ず守る」を言う"""
        f = {x["id"]: x for x in FLOWS["flows"]}
        self.assertTrue({"A118", "A114", "A136", "A93", "A137"} <= set(f["F9"]["acts"]))
        self.assertIn("A117", f["F10"]["acts"])
        self.assertNotIn("A117", f["F9"]["acts"])
        e3 = next(e for e in FLOWS["effects"] if e["id"] == "E3")
        self.assertIn("チケットの設定", e3["change"])
        self.assertIn("必ず守る", e3["change"])

    def test_K727_FL_007_parents(self) -> None:
        """親の入れ物：K-69 の screens は knowledge・masters（画面の葉が本線に入るまで親が持つ・layers は持たない。rules・work-types は K-711 が後のフェーズへ送って外した）・題が新しい形。K-70 の screens に layers が入る"""
        h69 = heads("11_tickets/K-69.md")
        self.assertEqual(h69["screens"], "[knowledge, masters]")
        self.assertIn("ナレッジ", h69["title"])
        self.assertIn("layers", heads("11_tickets/K-70.md")["screens"])

    def test_K727_FL_008_sources_exist(self) -> None:
        """phase1.py が根拠に挙げた D-152.n は全部、決定ログ §152 に在る（T3 の先取り）"""
        used = set(re.findall(r"D-152\.\d+", (ROOT / "05_flow" / "phase1.py").read_text(encoding="utf-8")))
        log = (ROOT / "01_hearing" / "決定ログ_進行中.md").read_text(encoding="utf-8")
        have = set(re.findall(r"^\|\s*(D-152\.\d+)\s*\|", log, re.M))
        self.assertTrue(used, "phase1.py が D-152 を 1 つも根拠にしていない")
        self.assertEqual(sorted(used - have), [])

    def test_K727_FL_009_gates(self) -> None:
        """画面の導出の検査 flow_gate（G1〜G10・G17・G22）と、流れと DB の検査 flow_db_gate が 0 で終わる"""
        for args in (
            ["scripts/ci/flow_gate.py", "--flow", "05_flow/flow.json", "--choke", "03_architecture/choke-points.json"],
            ["scripts/ci/flow_db_gate.py"],
        ):
            p = subprocess.run([sys.executable, *args], cwd=ROOT, capture_output=True, text=True, timeout=300)
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)


if __name__ == "__main__":
    unittest.main()
