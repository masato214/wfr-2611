#!/usr/bin/env python3
"""K-626 の試験：spec-sync の P（プロジェクト全体の棚卸し）の残りの穴を塞ぐ — 保管・証拠の層は理由つきで「見ない」と宣言し、
鮮度の遅れ（P3）は追いつかせるか追いつかなくてよい理由を書き、P が緑になる。

  python3 scripts/ci/k626_p_audit_closed_test.py      行 ID は K626-PAU-NNN（11_tickets/K-626.md の行の表と 1 対 1）

決まり：
  ・見ないと宣言してよいのは「保管（置き換え前の記録）」と「検査の証拠（機械が書く報告）」だけ。決定ログの reflect_in が名指しした層は宣言できない
  ・この葉が足す project_audit.ignore / stale_ok の行は path が実在し、reason は 15 字以上（前からの行は見ない）
  ・鮮度の遅れ（P3）の元は、11_tickets/K-350.md に例として書いた `<!-- decision: D-147 … -->` を project_audit が決定として読んだこと（本物の D-147 は package.json を名指ししない）。
    stale_ok で隠さず、例の書き方を直す（決定ログ以外の .md に決定の印の形が無い）
  ・P 全体が緑（P1〜P5 が空）かは、G65 に『今の全体』を入れない決め（PM 2026-11-21）により、K-629 の完了の条件が見る。ここでは作った小さな木で宣言の効き方を確かめる
テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import unittest

import yaml

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
AUDIT = ROOT / "scripts" / "spec-sync" / "project_audit.py"
MAP = ROOT / "spec-dependencies.yaml"
LOG = ROOT / "01_hearing" / "決定ログ_進行中.md"
MINE = ("11_tickets/_old/", "07_qa/ci-results/", "01_hearing/聞くこと_K-146.md")  # 聞くこと_K-146.md は K-623 が足す D-136 の線（reflect_in 名指し）で P2 から消える
KEEP_OK = ("11_tickets/_old", "07_qa/ci-results")  # 見ないと宣言してよい層（保管・証拠）


def audit() -> dict:
    r = subprocess.run([sys.executable, str(AUDIT), "--project-root", str(ROOT), "--json"], capture_output=True, text=True, cwd=ROOT)
    return json.loads(r.stdout)


def pa() -> dict:
    return yaml.safe_load(MAP.read_text(encoding="utf-8")).get("project_audit") or {}


def reflect_heads() -> set[str]:
    heads: set[str] = set()
    for m in re.finditer(r"<!--\s*decision:\s*D-[\d.]+\s(.*?)-->", LOG.read_text(encoding="utf-8"), re.S):
        r = re.search(r"reflect_in:\s*\[(.*?)\]", m.group(1), re.S)
        if r:
            heads |= {x.strip().rstrip("/") for x in r.group(1).split(",") if x.strip()}
    return heads


class PAuditClosedTest(unittest.TestCase):
    def test_K626_PAU_001_archives_evidence_and_the_hearing_note_are_not_in_p2(self) -> None:
        left = [f for f in audit()["P2_no_check"] if f.startswith(MINE)]
        self.assertEqual(left, [], f"P2 に残った: {left[:5]}")

    def test_K626_PAU_002_the_rows_this_leaf_added_have_a_real_path_and_a_reason(self) -> None:
        # この葉が足した行だけを見る（前からの行には、組み立ての出力の置き場＝git に無い道や、理由が『同上』の行がある）
        bad = []
        for kind in ("ignore", "stale_ok"):
            for row in pa().get(kind) or []:
                p = str(row.get("path", ""))
                if not (p.startswith(MINE) or "package.json" in p):
                    continue
                if not (ROOT / p.rstrip("/")).exists() or len(str(row.get("reason", ""))) < 15:
                    bad.append(f"{kind}:{p}")
        self.assertEqual(bad, [], bad)

    def test_K626_PAU_003_what_is_ignored_for_this_leaf_is_only_archive_or_evidence(self) -> None:
        mine_rows = [r for r in pa().get("ignore") or [] if str(r.get("path", "")).startswith(MINE)]
        for r in mine_rows:
            self.assertTrue(str(r["path"]).rstrip("/").startswith(KEEP_OK), f"保管・証拠でない層を見ないと宣言した: {r['path']}")
        # ci-results と _old は、全体を宣言する（1 ファイルずつではなく層として）
        paths = [str(r["path"]).rstrip("/") for r in mine_rows]
        self.assertIn("11_tickets/_old", paths)
        self.assertIn("07_qa/ci-results", paths)

    def test_K626_PAU_004_no_ignored_layer_is_named_by_a_decision_reflect_in(self) -> None:
        heads = reflect_heads()
        bad = []
        for r in pa().get("ignore") or []:
            p = str(r.get("path", "")).rstrip("/")
            if any(h == p or h.startswith(p + "/") for h in heads):
                bad.append(p)
        self.assertEqual(bad, [], f"決定が反映先に名指しした層を『見ない』にした: {bad}")

    def test_K626_PAU_005_no_ticket_text_looks_like_a_decision_mark_so_only_the_log_is_read(self) -> None:
        # 鮮度の誤読の元：チケットに例として書いた決定の印の形を、project_audit が決定の正本として読んでいた（K-350.md）。
        # 全体の .md を数えず、この葉が直す物（K-350.md と K-626.md）だけを見る。P 全体が緑かは K-629 の完了の条件へ移した
        rx = re.compile(r"<!--\s*decision:")
        for rel in ("11_tickets/K-350.md", "11_tickets/K-626.md"):
            self.assertIsNone(rx.search((ROOT / rel).read_text(encoding="utf-8")), f"{rel} に決定の印の形が在る")

    def test_K626_PAU_006_declarations_hide_only_their_own_layer_in_a_small_tree(self) -> None:
        # 作った小さな木：保管・証拠の中の物は P に出ず、隣（宣言していない場所）の新しい物は出る
        import shutil
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            t = pathlib.Path(d)
            shutil.copy(MAP, t / "spec-dependencies.yaml")
            (t / "01_hearing").mkdir()
            shutil.copy(LOG, t / "01_hearing/決定ログ_進行中.md")
            for rel in ("11_tickets/_old/KN-1.md", "11_tickets/K-1.md", "07_qa/ci-results/x.json", "scripts/ci/zz_new_ledger.json"):
                (t / rel).parent.mkdir(parents=True, exist_ok=True)
                (t / rel).write_text("{}" if rel.endswith(".json") else "# 保管\n", encoding="utf-8")
            r = subprocess.run([sys.executable, str(AUDIT), "--project-root", str(t), "--json"], capture_output=True, text=True, cwd=t)
            out = json.loads(r.stdout)
            seen = out["P1_map_holes"] + out["P2_no_check"]
            self.assertNotIn("11_tickets/_old/KN-1.md", seen)
            self.assertNotIn("07_qa/ci-results/x.json", seen)
            self.assertIn("scripts/ci/zz_new_ledger.json", seen)
            # 生きているチケット（11_tickets/K-1.md）は宣言に巻き込まれず、数えられたまま（`11_tickets/*` を丸ごと隠す宣言を許さない）
            self.assertEqual(out["by_group"]["11_tickets"]["n"], 1)

    def test_K626_PAU_007_g65_place_holds_this_test_exactly_once(self) -> None:
        hits = [p.name for p in (ROOT / "scripts/ci/g65.d").glob("*.txt") if "k626_p_audit_closed_test.py" in p.read_text(encoding="utf-8")]
        self.assertEqual(hits, ["K-626.txt"])


if __name__ == "__main__":
    unittest.main()
