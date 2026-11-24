#!/usr/bin/env python3
"""K-1120：G74（本体への直の足し）は、分かれ目と今の先頭の木の差で判定する（途中で足して後で戻した履歴は数えない）。

  python3 scripts/ci/k1120_body_append_tree_test.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import body_append_gate  # noqa: E402

PY = sys.executable
GATE = str(ROOT / "scripts/ci/body_append_gate.py")
SA = 'T = "tickets"\nSCREEN_API = {\n    "s": [\n        ("GET", "/a", "A1", T, "getA", []),\n    ],\n}\nPERMS = {\n    "getA": ("read", "誰でも", False),\n}\nLIST_OPS = {"getA"}\n'
SA_ADDED = (SA.replace('    "getA": ("read", "誰でも", False),\n', '    "getA": ("read", "誰でも", False),\n    "getB": ("read", "b", False),\n')
            .replace('{"getA"}', '{"getA", "getB"}')
            .replace('        ("GET", "/a", "A1", T, "getA", []),\n', '        ("GET", "/a", "A1", T, "getA", []),\n        ("GET", "/b", "A1", T, "getB", []),\n'))
DOC = "# 題\n\n## 4. 誰が\n\n| API | 誰が |\n|---|---|\n| `GET /a` | read |\n"
LEDGER0 = {"_doc": "", "tickets": ["K-50"], "entries": ["05_flow/screen_api.py|LIST_OPS 'x'", "08_api/phase1/01_x.md|`GET /g`"]}


class Tree(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.r = Path(self.tmp.name)
        self.g("init", "-q", "-b", body_append_gate.MAINLINE)
        self.g("config", "user.email", "t@example.com")
        self.g("config", "user.name", "t")
        self.w("05_flow/screen_api.py", SA)
        self.w("08_api/phase1/01_x.md", DOC)
        self.w(body_append_gate.LEDGER, json.dumps(LEDGER0))
        self.base = self.commit("K-1 chore: 元")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def g(self, *a: str) -> str:
        return subprocess.run(["git", *a], cwd=self.r, check=True, capture_output=True, text=True).stdout.strip()

    def w(self, rel: str, text: str) -> None:
        p = self.r / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def commit(self, subject: str) -> str:
        self.g("add", "-A")
        self.g("commit", "-q", "--allow-empty", "-m", subject)
        return self.g("rev-parse", "HEAD")

    def red(self) -> list[str]:
        return body_append_gate.check(self.r, self.base)

    def cli(self) -> subprocess.CompletedProcess:
        return subprocess.run([PY, GATE, "--root", str(self.r), "--base-ref", self.base], capture_output=True, text=True)

    def test_K1120_CT_001_table_keys_added_then_moved_to_d_is_green(self) -> None:
        """K1120-CT-001：途中のコミットで本体の表（PERMS・LIST_OPS・SCREEN_API）に鍵を足し、後のコミットで本体を元に戻して断片に移した枝は緑（赤 0 件・終わりの番号 0）"""
        self.w("05_flow/screen_api.py", SA_ADDED)
        self.commit("K-401 fix: 本体に直に足した")
        self.w("05_flow/screen_api.py", SA)
        self.w("05_flow/screen_api.d/K-401.py", 'SCREEN_API = {"s": [("GET", "/b", "A1", "tickets", "getB", [])]}\nPERMS = {"getB": ("read", "b", False)}\nLIST_OPS = {"getB"}\n')
        self.commit("K-401 fix: 本体を戻して断片に移す")
        self.assertEqual(self.red(), [])
        r = self.cli()
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("無い（緑）", r.stdout)

    def test_K1120_CT_002_doc_rows_added_or_edited_then_reverted_is_green(self) -> None:
        """K1120-CT-002：途中のコミットで本体の文書の表に行を足す・今ある行を直し、後のコミットで本体を元の字に戻して断片に移した枝は緑"""
        self.w("08_api/phase1/01_x.md", DOC.replace("| read |", "| write |") + "| `GET /b` | read |\n")
        self.commit("K-401 fix: 文書に直に")
        self.w("08_api/phase1/01_x.md", DOC)
        self.w("08_api/phase1/01_x.d/K-401.md", "## 4. 誰が\n| `GET /a` | write |\n| `GET /b` | read |\n")
        self.commit("K-401 fix: 文書を戻して断片に移す")
        self.assertEqual(self.red(), [])
        self.assertEqual(self.cli().returncode, 0)

    def test_K1120_CT_003_still_added_at_head_is_red(self) -> None:
        """K1120-CT-003：途中のコミットで足した鍵と行が今の先頭に残っていれば赤（後のコミットが別のファイルだけを変えていても）。鍵・行ごとに 1 件で、文に足したコミットの件名・鍵・置き場"""
        self.w("05_flow/screen_api.py", SA_ADDED)
        self.w("08_api/phase1/01_x.md", DOC + "| `GET /b` | read |\n")
        self.commit("K-7 feat: 足す")
        self.w("別.txt", "x")
        self.commit("K-7 docs: 別のファイル")
        red = self.red()
        self.assertEqual(len(red), 4, red)
        self.assertTrue(all("K-7 feat: 足す" in b for b in red), red)
        for word in ("PERMS 'getB'", "LIST_OPS 'getB'", "SCREEN_API 'getB'", "`GET /b`"):
            self.assertEqual(len([b for b in red if word in b]), 1, (word, red))
        self.assertTrue(any("screen_api.d/<番号>.py" in b for b in red) and any("01_x.d/<番号>.md" in b for b in red))
        r = self.cli()
        self.assertEqual(r.returncode, 1)
        self.assertIn("赤 4 件", r.stdout)

    def test_K1120_CT_004_partial_revert_only_remaining_is_red(self) -> None:
        """K1120-CT-004：途中で鍵を 2 つ足し、後のコミットで 1 つだけ戻した枝は、残った 1 つだけが赤（戻した鍵は文に出ない）"""
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "p", "q"}'))
        self.commit("K-7 feat: 2 つ足す")
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "q"}'))
        self.commit("K-7 fix: p を戻す")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("LIST_OPS 'q'", red[0])
        self.assertNotIn("'p'", red[0])

    def test_K1120_CT_005_added_reverted_added_again_counts_once(self) -> None:
        """K1120-CT-005：同じ鍵を足す → 戻す → もう一度足した枝は赤 1 件（コミットの数だけ数えない）。文のコミットは最後に足したコミット"""
        with_w = SA.replace('{"getA"}', '{"getA", "w"}')
        self.w("05_flow/screen_api.py", with_w)
        self.commit("K-7 feat: 1 回目")
        self.w("05_flow/screen_api.py", SA)
        self.commit("K-7 fix: 戻す")
        self.w("05_flow/screen_api.py", with_w)
        self.commit("K-7 feat: 2 回目")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("LIST_OPS 'w'", red[0])
        self.assertIn("2 回目", red[0])

    def test_K1120_CT_006_ledger_rules_unchanged(self) -> None:
        """K1120-CT-006：猶予の台帳は今のまま：台帳の鍵が今の先頭に在っても緑・台帳が分かれ目より増えていれば赤（減らすだけ）・台帳から消した鍵が今の先頭に在れば赤。途中で台帳を増やして後で戻した枝は緑"""
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "x"}'))
        self.w("08_api/phase1/01_x.md", DOC + "| `GET /g` | read |\n")
        self.commit("K-50 feat: 前から作っていた葉")
        self.assertEqual(self.red(), [])
        grown = {**LEDGER0, "entries": [*LEDGER0["entries"], "05_flow/screen_api.py|LIST_OPS 'w'"]}
        self.w(body_append_gate.LEDGER, json.dumps(grown))
        self.commit("K-9 chore: 台帳に足す")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("減らすだけ", red[0])
        self.assertIn("LIST_OPS 'w'", red[0])
        self.w(body_append_gate.LEDGER, json.dumps(LEDGER0))
        self.commit("K-9 chore: 台帳を戻す")
        self.assertEqual(self.red(), [])
        self.w(body_append_gate.LEDGER, json.dumps({**LEDGER0, "entries": LEDGER0["entries"][:1]}))
        self.commit("K-9 chore: 台帳を減らす")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("`GET /g`", red[0])
        self.assertIn("前から作っていた葉", red[0])

    def test_K1120_CT_007_ledger_now_still_walks_commits(self) -> None:
        """K1120-CT-007：台帳の作り手（--ledger-now）は今のまま、葉の枝のコミットを 1 つずつ見る：途中で足して後で戻した鍵も entries に入る"""
        self.g("checkout", "-q", "-b", "t/K-50")
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "v"}'))
        self.commit("K-50 feat: 足す")
        self.w("05_flow/screen_api.py", SA)
        self.commit("K-50 fix: 戻す")
        self.g("checkout", "-q", body_append_gate.MAINLINE)
        r = subprocess.run([PY, GATE, "--root", str(self.r), "--ledger-now"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        led = json.loads((self.r / body_append_gate.LEDGER).read_text(encoding="utf-8"))
        self.assertEqual(led["entries"], ["05_flow/screen_api.py|LIST_OPS 'v'"])
        self.assertEqual(led["tickets"], ["K-50"])

    def test_K1120_CT_008_merge_resolution(self) -> None:
        """K1120-CT-008：本線を取り込んだ枝（比べる元＝取り込んだ本線の先頭）は、本線が足した鍵を数えない。取り込みを解くときに足した鍵が今の先頭に残れば赤（文に取り込みのコミットの件名）、後のコミットで戻せば緑"""
        self.g("checkout", "-q", "-b", "side")
        self.w("05_flow/screen_api.d/K-3.py", 'LIST_OPS = {"y"}\n')
        self.commit("K-3 feat: 断片")
        self.g("checkout", "-q", body_append_gate.MAINLINE)
        with_m = SA.replace('{"getA"}', '{"getA", "m"}')
        self.w("05_flow/screen_api.py", with_m)
        self.base = self.commit("K-50 feat: 本線に入った葉")
        self.g("checkout", "-q", "side")
        self.g("merge", "-q", "--no-ff", "-m", "K-3 merge: 本線を取り込む", body_append_gate.MAINLINE)
        self.assertEqual(self.red(), [])
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "m", "z"}'))
        self.g("add", "-A")
        self.g("commit", "-q", "--amend", "--no-edit")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("K-3 merge", red[0])
        self.assertIn("LIST_OPS 'z'", red[0])
        self.w("05_flow/screen_api.py", with_m)
        self.commit("K-3 fix: 解くときに足した鍵を戻す")
        self.assertEqual(self.red(), [])

    def test_K1120_CT_009_base_edges(self) -> None:
        """K1120-CT-009：比べる元が空・読めないなら赤 1 件「読めない」（今のまま）。比べる元が今の先頭と同じなら緑"""
        for base in ("", "0" * 40):
            with self.subTest(base=base):
                red = body_append_gate.check(self.r, base)
                self.assertEqual(len(red), 1)
                self.assertIn("読めない", red[0])
        self.assertEqual(body_append_gate.check(self.r, self.g("rev-parse", "HEAD")), [])

    def test_K1120_CT_011_adder_commit_unknown(self) -> None:
        """K1120-CT-011：鍵が在った時点から分かれた枝が、本体から鍵を消した元を取り込むときに鍵を残して解いた（足したコミットが比べる元から先頭までに無い）なら、赤 1 件で文に鍵と「足したコミットは分からない」。台本は終わりの番号 1"""
        with_w = SA.replace('{"getA"}', '{"getA", "w"}')
        self.w("05_flow/screen_api.py", with_w)
        self.commit("K-401 fix: 元の葉が足していた")
        self.g("checkout", "-q", "-b", "child")
        self.w("別.txt", "x")
        self.commit("K-402 feat: 子")
        self.g("checkout", "-q", body_append_gate.MAINLINE)
        self.w("05_flow/screen_api.py", SA)
        self.base = self.commit("K-401 fix: 本体を戻す")
        self.g("checkout", "-q", "child")
        self.g("merge", "-q", "--no-ff", "-m", "K-402 merge: 元を取り込む", body_append_gate.MAINLINE)
        self.w("05_flow/screen_api.py", with_w)   # 取り込みを「鍵を残す」で解いた（枝側の親と同じ字）
        self.g("add", "-A")
        self.g("commit", "-q", "--amend", "--no-edit")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("LIST_OPS 'w'", red[0])
        self.assertIn("足したコミットは分からない", red[0])
        r = self.cli()
        self.assertEqual(r.returncode, 1)
        self.assertIn("赤 1 件", r.stdout)


class Wiring(unittest.TestCase):
    def test_K1120_CT_010_wired(self) -> None:
        """K1120-CT-010：この試験が G65 の置き場に 1 行で在る。G74 の段は今のまま（比べる元を env で渡して body_append_gate.py を流す）"""
        self.assertEqual((ROOT / "scripts/ci/g65.d/K-1120.txt").read_text(encoding="utf-8"), "python3 scripts/ci/k1120_body_append_tree_test.py\n")
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        i = wf.index('- name: "G74 ')
        step = wf[i:wf.index("- name:", i + 10)]
        self.assertIn("CI_BASE: ${{ steps.scope.outputs.base }}", step)
        self.assertIn('python3 scripts/ci/body_append_gate.py --base-ref "$CI_BASE"', step)
        self.assertIn("python3 scripts/ci/k1120_body_append_tree_test.py", wf)


if __name__ == "__main__":
    unittest.main(verbosity=1)
