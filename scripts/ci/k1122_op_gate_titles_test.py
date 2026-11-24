#!/usr/bin/env python3
"""K-1122：op_gate の --rows-in は、流した試験のファイルの「試験の題」に出る行 ID だけを照らす（コメント・題でない字は数えない）。

  python3 scripts/ci/k1122_op_gate_titles_test.py
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import op_gate  # noqa: E402

PY = sys.executable
GATE = str(ROOT / "scripts/ci/op_gate.py")
HEAD = "| ID | 画面 | テスト観点 | テスト項目 | 前提条件 | 操作手順 | 期待結果 | 結果 | 備考 | タスク | 実行条件 |\n|---|---|---|---|---|---|---|---|---|---|---|\n"


def spec_row(rid: str, task: str, result: str = "") -> str:
    return f"| {rid} | 画面 | 操作 | 押す | - | 押す | 出る | {result} |  | {task} | L1 |\n"


class Box:
    """使い捨ての置き場：仕様の表・チケットの一覧・試験のファイル・報告"""

    def __init__(self, rows: list[tuple[str, str, str]]):
        self.tmp = Path(tempfile.mkdtemp())
        spec = self.tmp / "spec"
        spec.mkdir()
        (spec / "k.md").write_text(HEAD + "".join(spec_row(*r) for r in rows), encoding="utf-8")
        tickets = sorted({r[1] for r in rows})
        (self.tmp / "tickets.json").write_text(json.dumps({"tickets": [{"id": t} for t in tickets]}), encoding="utf-8")
        (self.tmp / "apps/web/tests/k").mkdir(parents=True)

    def spec_file(self, src: str, name: str = "a.spec.ts") -> str:
        p = self.tmp / "apps/web/tests/k" / name
        p.write_text(src, encoding="utf-8")
        return str(p)

    def report(self, suites: list[dict]) -> str:
        f = self.tmp / "r.json"
        f.write_text(json.dumps({"suites": suites}), encoding="utf-8")
        return str(f)

    def gate(self, rep: str | None, *specs: str) -> subprocess.CompletedProcess:
        """rep が None なら --report を渡さない（本物の G48 と同じく spec/op-gate.json の reports から読む）"""
        args = [PY, GATE, "--spec", str(self.tmp / "spec"), "--tickets", str(self.tmp / "tickets.json")] + (["--report", rep] if rep else [])
        for s in specs:
            args += ["--rows-in", s]
        return subprocess.run(args + ["--pending-from-report"], capture_output=True, text=True, cwd=self.tmp)

    def close(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)


def suite(file: str | None, results: dict[str, str]) -> dict:
    s = {"title": file or "", "specs": [{"title": f"{rid} 出る", "tests": [{"results": [{"status": st}]}]} for rid, st in results.items()]}
    if file is not None:
        s["file"] = file
    return s


class Titles(unittest.TestCase):
    def setUp(self):
        self.box = None

    def tearDown(self):
        if self.box:
            self.box.close()

    def test_K1122_OG_001_comment_ids_not_checked(self):
        # 前の画面の行 K9-UI-016 は結果 PASS で、この回では流れていない（報告に無い）。コメントに出るだけなら照らさない
        b = self.box = Box([("K1-UI-001", "K-1", ""), ("K9-UI-016", "K-9", "PASS"), ("K9-UI-017", "K-9", "PASS"), ("K9-UI-018", "K-9", "PASS")])
        sp = b.spec_file(
            "// 頭のコメント K9-UI-016 が見ている\n"
            "/* ブロックのコメント\n   K9-UI-017 も見ている */\n"
            'test("K1-UI-001 出る", async () => {\n'
            "  await go(); // 行の後ろのコメント K9-UI-018\n"
            "});\n"
        )
        r = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-001": "passed"})]), sp)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, out)
        for rid in ("K9-UI-016", "K9-UI-017", "K9-UI-018"):
            self.assertNotIn(rid, out, f"コメントの {rid} を照らした")
        self.assertIn("検査 1 行", out, "題の K1-UI-001 の 1 行だけを照らす")

    def test_K1122_OG_002_title_ids_checked(self):
        b = self.box = Box([("K1-UI-001", "K-1", ""), ("K1-UI-002", "K-1", "PASS")])
        sp = b.spec_file('test("K1-UI-001 出る", async () => {});\ntest("K1-UI-002 出る", async () => {});\n')
        bad = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-001": "failed"})]), sp)
        out = bad.stdout + bad.stderr
        self.assertEqual(bad.returncode, 1, out)
        self.assertIn("K1-UI-001 [操作]: 結果が空で、今の回の報告ではテストは failed", out)
        self.assertIn("K1-UI-002 [操作]: PASS だが行 ID を名前に持つ実ブラウザのテストが無い", out, "題に在るのに流れていない行は赤のまま")
        ok = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-001": "passed", "K1-UI-002": "passed"})]), sp)
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)

    def test_K1122_OG_003_title_forms(self):
        forms = {
            "K1-UI-011": "test.describe(\"K1-UI-011 群\", () => {});",
            "K1-UI-012": "test.describe.serial('K1-UI-012 群', () => {});",
            "K1-UI-013": "test.skip(\"K1-UI-013 飛ばす\", async () => {});",
            "K1-UI-014": "it(\"K1-UI-014 出る\", () => {});",
            "K1-UI-015": "describe(\"K1-UI-015 群\", () => {});",
            "K1-UI-016": "for (const w of WIDTHS) test(`K1-UI-016 幅 ${w}：出る`, async () => {});",
            "K1-UI-017": 'row(R["K1-UI-017"], async (page) => {});',
            "K1-UI-018": "test(\n  \"K1-UI-018 次の行に題\",\n  async () => {},\n);",
            "K1-UI-019": 'test("K1-UI-019 http://127.0.0.1/a // b", async () => {});',
            "K1-UI-020": 'const g = "a/*b";\ntest("K1-UI-020 字の中の /* は始まりでない", async () => {});',
        }
        b = self.box = Box([(rid, "K-1", "") for rid in forms])
        sp = b.spec_file("\n".join(forms.values()) + "\n")
        r = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-019": "passed"})]), sp)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        for rid in forms:
            if rid != "K1-UI-019":
                self.assertIn(f"{rid} [操作]: 未実施（結果が空）", out, f"題の書き方 {forms[rid]!r} の ID を照らしていない")
        self.assertIn("検査 10 行", out)

    def test_K1122_OG_004_non_title_strings_not_checked(self):
        non_titles = {
            "K9-UI-026": 'const RX = /^\\s*- (a|b) "((?:[^"\\\\]|\\\\.)*)"/; const s = "K9-UI-026";\ntest("K1-UI-003 正規表現の後の題", async () => {});',
            "K9-UI-028": 'const x = (a - b) / 2; const y = n / 3;\ntest("K1-UI-004 割り算の後の題", async () => {});',
            "K9-UI-029": 'function f(s) { return /K9-UI-029/.test(s); }',
            "K9-UI-021": 'test("K1-UI-001 出る", async () => { expect(x).toBe("K9-UI-021"); });',
            "K9-UI-022": "if (/K9-UI-022/.test(s)) n++;",
            "K9-UI-023": 'if (re.test("K9-UI-023")) n++;',
            "K9-UI-024": 'await test.step("K9-UI-024 段", async () => {});',
            "K9-UI-025": 'const T = `外す ${"K9-UI-025"} の後`;',
            "K9-UI-027": 'mytest("K9-UI-027 呼び名が違う", () => {});',
        }
        # K1-UI-003・004 は正規表現・割り算の直ぐ後の題（報告に無い・BLOCKED で数にだけ入る）：読み違えると後ろを飲み込んで数えなくなる
        b = self.box = Box([("K1-UI-001", "K-1", ""), ("K1-UI-003", "K-1", "BLOCKED（流さない）"), ("K1-UI-004", "K-1", "BLOCKED（流さない）")]
                           + [(rid, "K-9", "PASS") for rid in non_titles])
        sp = b.spec_file("\n".join(non_titles.values()) + "\n")
        r = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-001": "passed"})]), sp)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, out)
        for rid in non_titles:
            self.assertNotIn(rid, out, f"題でない {non_titles[rid]!r} の ID を照らした")
        self.assertIn("検査 3 行", out, "正規表現・割り算の後の題 K1-UI-003・004 も照らす")

    def test_K1122_OG_005_dynamic_titles_from_report(self):
        b = self.box = Box([("K1-UI-007", "K-1", ""), ("K1-UI-008", "K-1", ""), ("K1-UI-009", "K-1", "PASS")])
        sp = b.spec_file('for (const id of ["K1-UI-007"]) test(`${id} 出る`, async () => {});\n')
        rep = b.report([suite("k/a.spec.ts", {"K1-UI-007": "failed"}), suite("k/other.spec.ts", {"K1-UI-008": "failed"}),
                        suite(None, {"K1-UI-009": "failed"})])
        r = b.gate(rep, sp)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        self.assertIn("K1-UI-007 [操作]: 結果が空で、今の回の報告ではテストは failed", out, "流したファイルの報告の題の ID は照らす")
        self.assertNotIn("K1-UI-008", out, "別のファイルの報告の題は照らさない")
        self.assertNotIn("K1-UI-009", out, "ファイルの名前の無い報告の題は照らさない")
        self.assertIn("検査 1 行", out)
        ok = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-007": "passed"})]), sp)
        self.assertEqual(ok.returncode, 0, ok.stdout + ok.stderr)
        # 本物の G48（web_run.py）は --report を渡さず、op-gate.json の reports から読む。その道でも報告の題を引く
        (b.tmp / "spec/op-gate.json").write_text(json.dumps({"reports": [b.report([suite("k/a.spec.ts", {"K1-UI-007": "failed"})])]}), encoding="utf-8")
        cfg = b.gate(None, sp)
        out = cfg.stdout + cfg.stderr
        self.assertEqual(cfg.returncode, 1, out)
        self.assertIn("K1-UI-007 [操作]: 結果が空で、今の回の報告ではテストは failed", out, "op-gate.json の報告の題も引く")

    def test_K1122_OG_007_broken_source_does_not_crash(self):
        b = self.box = Box([("K1-UI-001", "K-1", ""), ("K9-UI-030", "K-9", "PASS")])
        for src in ('test("K1-UI-001 出る", async () => {});\n/* 閉じないコメント K9-UI-030\n',
                    'test("K1-UI-001 出る", async () => {});\nconst s = "閉じない字 K9-UI-030\n',
                    'test("K1-UI-001 出る", async () => {});\nconst t = `閉じない ${a K9-UI-030\n'):
            sp = b.spec_file(src)
            r = b.gate(b.report([suite("k/a.spec.ts", {"K1-UI-001": "passed"})]), sp)
            out = r.stdout + r.stderr
            self.assertNotIn("Traceback", out, src)
            self.assertEqual(r.returncode, 0, src + out)
            self.assertNotIn("K9-UI-030", out, src)

    def test_K1122_OG_008_real_k363_spec(self):
        src = (ROOT / "apps/web/tests/k/k363-remove-pc.spec.ts").read_text(encoding="utf-8")
        ids = op_gate.title_ids(src)
        self.assertIn("K57-UI-016", src, "前提：本物の試験のコメントに K57-UI-016 が在る")
        self.assertNotIn("K57-UI-016", ids, "コメントの K57-UI-016 を数えた（K-1151 の赤）")
        self.assertNotIn("K60-UI-033", ids, "コメントの K60-UI-033 を数えた")
        self.assertIn("K363-UI-004", ids, "題の K363-UI-004 を数えていない")


class Wiring(unittest.TestCase):
    def test_K1122_OG_006_ci_wiring(self):
        line = (ROOT / "scripts/ci/g65.d/K-1122.txt").read_text(encoding="utf-8").strip()
        self.assertEqual(line, "python3 scripts/ci/k1122_op_gate_titles_test.py")
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        self.assertIn("python3 scripts/ci/k1122_op_gate_titles_test.py", wf, "作り手で CI の定義に載っている")
        import web_run  # noqa: PLC0415
        last = web_run.commands("g48", full=False, specs=["apps/web/tests/k/a.spec.ts"], tasks=[])[-1]
        self.assertIn("op_gate.py", " ".join(last))
        self.assertEqual([last[i + 1] for i, a in enumerate(last) if a == "--rows-in"], ["apps/web/tests/k/a.spec.ts"], "範囲の回は今のまま --rows-in で流した試験を渡す")


if __name__ == "__main__":
    unittest.main()
