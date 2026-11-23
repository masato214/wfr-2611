#!/usr/bin/env python3
"""K-625 の試験：spec-sync の P（プロジェクト全体の棚卸し）の P2「検査の穴」のうち、台帳・登録の断片・設定の層に、
本当にその層を読む機械の検査（layer_checks の check）を結ぶ。

  python3 scripts/ci/k625_layer_ledgers_test.py      行 ID は K625-LAY-NNN（11_tickets/K-625.md の行の表と 1 対 1）

決まり：
  ・対象は下の MINE（台帳・.d の断片・設定）。11_tickets/_old・07_qa/ci-results・聞くこと_K-146 は K-626 の持ち物でここでは見ない
  ・check は実在する検査の道具（scripts/…）を呼び、その道具（か design-gate.json）が層の名前を読む。名前を読まない検査を結ぶのは「検査があるふり」
  ・manual（手で見る）が許されるのは、断片の置き方の説明（README）と、旧い進め方の設定（ai-team.yaml・ci-gates.yaml）だけで、理由は 15 字以上
  ・別の段（G65 など）が流している試験を check に結ぶ行は `elsewhere: G<番号>` を付け、G27 では流さない（K-156・印が本当かは ci_wiring_gate の W5 が見る）
  ・G27 が自分で流す層（check があり elsewhere が無い）のファイルは、範囲の地図（ci_scope の gates の 27）に当たる（ticket-flow.yaml は今は当たらない）
  ・layer_audit 自身を check に書かない（無限に回る・memory の注意）
テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
"""
from __future__ import annotations

import fnmatch
import glob
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
MINE = (
    "scripts/ci/author_gate.json", "scripts/ci/canvas_field_ledger.json", "scripts/ci/canvas_layout_ledger.json",
    "scripts/ci/class_ledger.json", "scripts/ci/lock_dates.json", "scripts/ci/perf_budget.json",
    "scripts/ci/raw_length_ledger.json", "scripts/ci/runner_tools.json", "scripts/ci/staging_region.json",
    "scripts/ci/ci_scope.json", "scripts/ci/ci_scope.d/", "scripts/ci/g47.d/", "scripts/ci/g65.d/",
    "scripts/ci/contract_shape.d/", "07_qa/test-plan/ears-elsewhere.d/", "07_qa/test-plan/result-ledger.json",
    "05_flow/screen_api.d/", "apps/api/test/features/contract/k144.d/", "packages/auth/src/disabled-paths.d/",
    "apps/web/vercel.json", "ticket-flow.yaml", "ai-team.yaml", "ci-gates.yaml",
)
MANUAL_OK = ("README.md", "ai-team.yaml", "ci-gates.yaml")


def mine(rel: str) -> bool:
    return any(rel == m or (m.endswith("/") and rel.startswith(m)) for m in MINE)


def p2() -> list[str]:
    r = subprocess.run([sys.executable, str(AUDIT), "--project-root", str(ROOT), "--json"], capture_output=True, text=True, cwd=ROOT)
    return json.loads(r.stdout)["P2_no_check"]


def rows() -> list[dict]:
    return yaml.safe_load(MAP.read_text(encoding="utf-8"))["layer_checks"]


def covers(decl: str, rel: str) -> bool:
    decl = decl.strip()
    if "*" in decl:
        return fnmatch.fnmatch(rel, decl) or fnmatch.fnmatch(rel, decl + "*")
    return rel == decl or rel.startswith(decl.rstrip("/") + "/")


def rows_for(rel: str) -> list[dict]:
    return [r for r in rows() if r.get("file") and covers(str(r["file"]), rel)]


def my_files() -> list[str]:
    out: list[str] = []
    for m in MINE:
        base = m.rstrip("/")
        out += [str(pathlib.Path(p).relative_to(ROOT)) for p in glob.glob(str(ROOT / base) + ("/**" if m.endswith("/") else ""), recursive=True)
                if pathlib.Path(p).is_file() and p.endswith((".md", ".json", ".yaml", ".yml"))]
    return sorted(set(out))


class LedgerLayersTest(unittest.TestCase):
    def test_K625_LAY_001_none_of_my_layers_is_left_in_p2(self) -> None:
        left = [f for f in p2() if mine(f)]
        self.assertEqual(left, [], f"P2 に残った層: {left}")

    def test_K625_LAY_002_every_check_calls_a_script_that_exists(self) -> None:
        bad = []
        for f in my_files():
            for r in rows_for(f):
                if r.get("check"):
                    toks = re.findall(r"scripts/[\w./-]+\.(?:py|mjs)", str(r["check"]))
                    if not toks or any(not (ROOT / t).is_file() for t in toks):
                        bad.append(f"{f}: {r['check']}")
                    if "layer_audit" in str(r["check"]):
                        bad.append(f"{f}: layer_audit を check に書いた")
        self.assertEqual(bad, [], bad)

    def test_K625_LAY_003_manual_is_only_for_readmes_and_the_old_process_configs(self) -> None:
        bad = []
        for f in my_files():
            rs = rows_for(f)
            if any(r.get("check") for r in rs):
                continue
            manual = [str(r.get("manual") or "") for r in rs if r.get("manual")]
            if not manual or not f.endswith(MANUAL_OK) or not any(len(x) >= 15 for x in manual):
                bad.append(f)
        self.assertEqual(bad, [], f"check が無く、手で見るの許しにも当たらない層: {bad}")

    def test_K625_LAY_004_the_check_reads_the_layer_by_its_name(self) -> None:
        design = (ROOT / "design-gate.json").read_text(encoding="utf-8")
        bad = []
        for f in my_files():
            for r in rows_for(f):
                if not r.get("check"):
                    continue
                toks = re.findall(r"scripts/[\w./-]+\.(?:py|mjs)", str(r["check"]))
                hay = "".join((ROOT / t).read_text(encoding="utf-8") for t in toks if (ROOT / t).is_file())
                if any(t.endswith("design_gate.py") for t in toks):
                    hay += design  # 置き場を design-gate.json が名指しするのは design_gate.py を呼ぶ行だけ
                name = pathlib.PurePosixPath(f).name
                folder = pathlib.PurePosixPath(f).parent.name
                # 名前そのものを読むこと。置き場の名前で通してよいのは、親が `.d` で終わる断片の置き場だけ（`ci` や `web` で通さない）
                if name not in hay and not (folder.endswith(".d") and folder in hay):
                    bad.append(f"{f} ← {r['check']}")
        self.assertEqual(bad, [], f"層の名前を読まない検査: {bad}")

    def test_K625_LAY_005_a_new_unregistered_ledger_would_show_up_in_p2(self) -> None:
        # 守り：台帳を足して layer_checks に書かなければ P2 に出る（検査の仕組みが生きている）。作りものの根で確かめる
        import shutil
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            t = pathlib.Path(d)
            shutil.copy(MAP, t / "spec-dependencies.yaml")
            (t / "01_hearing").mkdir()
            shutil.copy(ROOT / "01_hearing/決定ログ_進行中.md", t / "01_hearing/決定ログ_進行中.md")
            (t / "scripts/ci").mkdir(parents=True)
            (t / "scripts/ci/zz_new_ledger.json").write_text("{}", encoding="utf-8")
            r = subprocess.run([sys.executable, str(AUDIT), "--project-root", str(t), "--json"], capture_output=True, text=True, cwd=t)
            out = json.loads(r.stdout)
            self.assertIn("scripts/ci/zz_new_ledger.json", out["P1_map_holes"] + out["P2_no_check"])

    def test_K625_LAY_006_every_file_of_a_checked_layer_is_read_by_g27_scope(self) -> None:
        # 層の検査（G27）が読むファイルを変えた回で G27 が流れる（範囲の地図 gates の 27 に当たる）。k245 の 011 と同じ決まりをこの層に
        sys.path.insert(0, str(HERE))
        import ci_scope  # noqa: E402
        globs = json.loads((ROOT / "scripts/ci/ci_scope.json").read_text(encoding="utf-8"))["gates"]["27"]
        miss = [f for f in my_files() if any(r.get("check") and not r.get("elsewhere") for r in rows_for(f)) and not ci_scope.match(f, globs)]
        self.assertEqual(miss, [], f"G27 の範囲（gates の 27）に当たらない層のファイル: {miss}")

    def test_K625_LAY_007_g65_place_holds_this_test_exactly_once(self) -> None:
        hits = [p.name for p in (ROOT / "scripts/ci/g65.d").glob("*.txt") if "k625_layer_ledgers_test.py" in p.read_text(encoding="utf-8")]
        self.assertEqual(hits, ["K-625.txt"])


if __name__ == "__main__":
    unittest.main()
