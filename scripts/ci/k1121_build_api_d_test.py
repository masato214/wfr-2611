#!/usr/bin/env python3
"""K-1121：契約の作り手 05_flow/build_api.py の表に葉が足す分は 05_flow/build_api.d/K-<番号>.py に書き、本体への直の足しは G74 で止める。

  python3 scripts/ci/k1121_build_api_d_test.py
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import body_append_gate  # noqa: E402

PY = sys.executable
GATE = str(ROOT / "scripts/ci/body_append_gate.py")
BUILD_API = "05_flow/build_api.py"
LEDGER_B = "scripts/ci/body_append_grandfather_build_api.json"
# 作り手が読む入力（写す物）
INPUTS = ["05_flow/build_api.py", "05_flow/screen_api.py", "05_flow/screen_api.d", "05_flow/flow.json",
          "07_functional/screens.json", "07_functional/features.json", "07_functional/entities.json", "07_functional/traceability-matrix.json",
          "03_architecture/choke-points.json", "03_architecture/colrules.json", "07_qa/test-specs/errors.json", "08_api/db-columns.json"]
# scripts/ci の部品（断片が import する部品も）は頭の段の *.py を全部写す
OUTPUTS = ["API-SPEC.md", "api-decisions.json", "api-field-consumption.json", "api-spec.html", "ears-ac-seed.json",
           "endpoints.json", "lint-mapping.json", "openapi.yaml", "screen-api-coverage.json", "types.ts"]
KEY_RE = "^[A-Za-z0-9_-]{1,200}$"
POS_RE = "^[0-9]{1,9}$"


class Builder(unittest.TestCase):
    """作り手の行：使い捨ての置き場に入力を写し、本物の build_api.py を流す"""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.r = Path(self.tmp.name)
        (self.r / "scripts/ci").mkdir(parents=True)
        for rel in INPUTS:
            src, dst = ROOT / rel, self.r / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if src.is_dir():
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
        for src in sorted((ROOT / "scripts/ci").glob("*.py")):
            shutil.copy2(src, self.r / "scripts/ci" / src.name)
        self.d = self.r / "05_flow/build_api.d"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def frag(self, name: str, text: str) -> None:
        self.d.mkdir(parents=True, exist_ok=True)
        (self.d / name).write_text(text, encoding="utf-8")

    def build(self) -> subprocess.CompletedProcess:
        return subprocess.run([PY, str(self.r / BUILD_API)], cwd=self.r, capture_output=True, text=True)

    def ok(self) -> None:
        r = self.build()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def outputs(self) -> dict[str, bytes]:
        return {n: (self.r / "08_api" / n).read_bytes() for n in OUTPUTS}

    def openapi(self) -> dict:
        return yaml.safe_load((self.r / "08_api/openapi.yaml").read_text(encoding="utf-8"))

    def consumption(self) -> list[dict]:
        return json.loads((self.r / "08_api/api-field-consumption.json").read_text(encoding="utf-8"))["fields"]

    def screen_tables(self) -> dict:
        """写した screen_api.py を流し、作り手が _sa から読む表を出す"""
        import importlib.util  # noqa: PLC0415
        spec = importlib.util.spec_from_file_location("k1121_sa", self.r / "05_flow/screen_api.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return {n: getattr(mod, n, {}) for n in ("REQUIRED_INPUTS", "VALUE_RANGES", "INPUT_RULES", "QUERIES")}

    def cursor_of(self, op_id: str) -> dict:
        for item in self.openapi()["paths"].values():
            for op in item.values():
                if op.get("operationId") == op_id:
                    return next(p["schema"] for p in op.get("parameters", []) if p["name"] == "cursor")
        raise AssertionError(f"{op_id} が契約に無い")

    def cursor_ops(self) -> dict[str, str]:
        out = {}
        for item in self.openapi()["paths"].values():
            for op in item.values():
                for p in op.get("parameters", []):
                    if p["name"] == "cursor" and p["in"] == "query":
                        out[op["operationId"]] = p["schema"].get("pattern")
        return out

    def fails(self, *needles: str) -> None:
        before = self.outputs() if (self.r / "08_api/openapi.yaml").exists() else None
        r = self.build()
        self.assertNotEqual(r.returncode, 0, r.stdout)
        text = r.stdout + r.stderr
        for n in needles:
            self.assertIn(n, text)
        if before is not None:
            self.assertEqual(self.outputs(), before, "止まったのに生成物が書かれた")

    def test_K1121_BD_001_no_fragment_is_byte_identical(self) -> None:
        """K1121-BD-001：置き場が無い／README だけ／中身の無い断片で、08_api の生成物 10 個が 1 バイトも違わない"""
        shutil.rmtree(self.d, ignore_errors=True)
        self.ok()
        none = self.outputs()
        self.frag("README.md", "# build_api.d\n")
        self.ok()
        self.assertEqual(self.outputs(), none)
        self.frag("K-9.py", "# 中身の無い断片\n")
        self.ok()
        self.assertEqual(self.outputs(), none)

    def test_K1121_BD_002_key_cursor_fragment(self) -> None:
        """K1121-BD-002：断片の KEY_CURSOR_OPS の口は cursor が鍵の形になる。本体の 3 つの口は鍵の形のまま"""
        self.ok()
        ops = self.cursor_ops()
        for op in ("listApprovalQueue", "listNotifications", "listTickets"):
            self.assertEqual(ops[op], KEY_RE, op)
        pick = sorted(o for o, pat in ops.items() if pat == POS_RE)[0]
        self.frag("K-9.py", f'KEY_CURSOR_OPS = {{"{pick}"}}\n')
        self.ok()
        self.assertEqual(self.cursor_of(pick)["pattern"], KEY_RE)
        ops2 = self.cursor_ops()
        for op in ("listApprovalQueue", "listNotifications", "listTickets"):
            self.assertEqual(ops2[op], KEY_RE, op)
        self.assertEqual({o for o, p in ops2.items() if p == KEY_RE} - {o for o, p in ops.items() if p == KEY_RE}, {pick})

    def test_K1121_BD_003_internal_fragment(self) -> None:
        """K1121-BD-003：断片の INTERNAL の名前は消費の行が全部 internal 真になり、その列を持つ表の入力の形から欄が消える"""
        self.ok()
        rows = self.consumption()
        cands = sorted({c["field"] for c in rows if not c["internal"]})
        t = self.screen_tables()
        used: set[str] = set()
        for op_fields in t["REQUIRED_INPUTS"].values():
            used |= set(op_fields)
        for op_fields in t["VALUE_RANGES"].values():
            used |= set(op_fields)
        used |= set(re.findall(r"[a-z_][a-z0-9_]*", json.dumps(t["INPUT_RULES"])))
        for qs in t["QUERIES"].values():
            used |= set(qs)
        sc = self.openapi()["components"]["schemas"]
        name, tbl = next((f, n) for f in cands if f not in used for n, s in sorted(sc.items())
                         if n.endswith("Input") and "x-operation" not in s and f in s.get("properties", {}) and n[:-5] in sc and "x-table" in sc[n[:-5]])
        self.frag("K-9.py", f'INTERNAL = {{"{name}"}}\n')
        self.ok()
        mine = [c for c in self.consumption() if c["field"] == name]
        self.assertTrue(mine)
        self.assertTrue(all(c["internal"] for c in mine), mine[:3])
        self.assertNotIn(name, self.openapi()["components"]["schemas"][tbl]["properties"])

    def test_K1121_BD_004_internal_tables_fragment(self) -> None:
        """K1121-BD-004：断片の INTERNAL_TABLES の表は消費の行が全部 internal 真で、reason が断片の字"""
        self.ok()
        rows = self.consumption()
        table = sorted({c["entity"] for c in rows if not c["internal"]})[0]   # internal が偽の行がある表＝マスタでない
        self.frag("K-9.py", f'INTERNAL_TABLES = {{"{table}": "訳の字"}}\n')
        self.ok()
        mine = [c for c in self.consumption() if c["entity"] == table]
        self.assertTrue(mine)
        for c in mine:
            self.assertTrue(c["internal"], c)
        tables = {e["table_name"]: e for e in json.loads((self.r / "07_functional/entities.json").read_text(encoding="utf-8"))["entities"]}
        if tables[table]["tenant_isolation"]["type"] != "none":
            for c in mine:
                self.assertEqual(c["reason"], "訳の字", c)

    def test_K1121_BD_005_duplicate_keys_stop(self) -> None:
        """K1121-BD-005：本体の鍵を断片が持つ／2 つの断片が同じ鍵を持つと止まり、生成物を書かない"""
        self.ok()
        self.frag("K-9.py", 'INTERNAL_TABLES = {"search_embeddings": "x"}\n')
        self.fails("元の表 と K-9.py が search_embeddings を両方持つ")
        table = sorted({c["entity"] for c in self.consumption() if not c["internal"]})[0]
        self.frag("K-9.py", f'INTERNAL_TABLES = {{"{table}": "x"}}\n')
        self.frag("K-8.py", f'INTERNAL_TABLES = {{"{table}": "y"}}\n')
        self.fails(f"K-8.py と K-9.py が {table} を両方持つ")

    def test_K1121_BD_006_wrong_table_name_or_shape_stops(self) -> None:
        """K1121-BD-006：足せない表の名前（screen_api.d の表・書き間違い）／dict の表を set で書くと止まる"""
        self.ok()
        for text in ('SUCCESS_STATUS = {"x": 200}\n', 'KEY_CURSOR_OP = {"x"}\n'):
            self.frag("K-9.py", text)
            self.fails("K-9.py", "足せる表の名前ではない")
        self.frag("K-9.py", 'INTERNAL_TABLES = {"a"}\n')
        self.fails("K-9.py", "dict で書く")

    def test_K1121_BD_007_bad_file_name_or_unreadable_stops(self) -> None:
        """K1121-BD-007：置けない名前のファイル／読めない断片は止まる"""
        self.ok()
        self.frag("notes.py", 'KEY_CURSOR_OPS = {"x"}\n')
        self.fails("notes.py", "置けない名前")
        (self.d / "notes.py").unlink()
        self.frag("K-9.py", "KEY_CURSOR_OPS = {\n")
        self.fails("K-9.py", "読めない")

    def test_K1121_BD_014_fragment_value_typos_stop(self) -> None:
        """K1121-BD-014：契約に無い口・一覧でない口・無い表・無い列を断片に書くと止まる"""
        self.ok()
        eps = json.loads((self.r / "08_api/endpoints.json").read_text(encoding="utf-8"))["endpoints"]
        single = sorted(e["operation_id"] for e in eps if e["method"] == "GET" and not e["returns_list"] and e.get("operation_id"))[0]
        for text, table, value in (('KEY_CURSOR_OPS = {"listNoSuchOp"}\n', "KEY_CURSOR_OPS", "listNoSuchOp"),
                                   (f'KEY_CURSOR_OPS = {{"{single}"}}\n', "KEY_CURSOR_OPS", single),
                                   ('INTERNAL_TABLES = {"no_such_table": "x"}\n', "INTERNAL_TABLES", "no_such_table"),
                                   ('INTERNAL = {"no_such_col"}\n', "INTERNAL", "no_such_col")):
            self.frag("K-9.py", text)
            self.fails(table, value, "05_flow/build_api.d")


BA = ('import os\nROOT = os.getcwd()\nBASE = "/api/v1"\n'
      'INTERNAL_TABLES = {"search_embeddings": "内部の索引"}\n'
      'INTERNAL = {"id", "tenant_id"}\n'
      'rows = []\n'
      'for e in []:\n    rows.append(e)\n'
      'KEY_CURSOR_OPS = {"listTickets"}\n'
      'def qtype(q):\n    return {"type": "string"}\n')
SA = 'T = "tickets"\nLIST_OPS = {"getA"}\n'
LEDGER0 = {"_doc": "", "tickets": ["K-50"], "entries": ["05_flow/screen_api.py|LIST_OPS 'x'"]}
MERGE_DEF = "_D = {'INTERNAL_TABLES': INTERNAL_TABLES, 'INTERNAL': INTERNAL, 'KEY_CURSOR_OPS': set()}\n"
MERGE_LINE = "KEY_CURSOR_OPS = KEY_CURSOR_OPS | _D['KEY_CURSOR_OPS']\n"
LEDGERB = {"_doc": "", "tickets": ["K-50"], "entries": ["05_flow/build_api.py|KEY_CURSOR_OPS 'listZ'"]}


class Gate(unittest.TestCase):
    """G74 の行：使い捨ての git の置き場で本物の検査を流す"""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.r = Path(self.tmp.name)
        self.g("init", "-q", "-b", body_append_gate.MAINLINE)
        self.g("config", "user.email", "t@example.com")
        self.g("config", "user.name", "t")
        self.w(BUILD_API, BA)
        self.w("05_flow/screen_api.py", SA)
        self.w(body_append_gate.LEDGER, json.dumps(LEDGER0))
        self.w(LEDGER_B, json.dumps(LEDGERB))
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

    def test_K1121_BD_008_table_keys_in_body_are_red(self) -> None:
        """K1121-BD-008：build_api.py の本体の表に足した鍵は赤（件名・鍵・置き場）"""
        self.w(BUILD_API, BA.replace('{"listTickets"}', '{"listTickets", "listX"}')
               .replace('"内部の索引"}', '"内部の索引", "x_tbl": "x"}').replace('"tenant_id"}', '"tenant_id", "x_col"}'))
        self.commit("K-7 feat: 足す")
        bad = self.red()
        self.assertEqual(len(bad), 3, bad)
        for key in ("KEY_CURSOR_OPS 'listX'", "INTERNAL_TABLES 'x_tbl'", "INTERNAL 'x_col'"):
            hit = [b for b in bad if key in b]
            self.assertEqual(len(hit), 1, (key, bad))
            self.assertIn("K-7 feat: 足す", hit[0])
            self.assertIn("05_flow/build_api.d/<番号>.py", hit[0])
        r = self.cli()
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("赤 3 件", r.stdout)

    def test_K1121_BD_009_append_statements_in_body_are_red(self) -> None:
        """K1121-BD-009：3 つの表を書き換える文は、頭の段・for の中・関数の中のどこでも赤。合わせの文の 2 つ目も赤"""
        self.w(BUILD_API, BA + 'KEY_CURSOR_OPS.add("listY")\nINTERNAL |= {"y"}\nINTERNAL_TABLES["y_tbl"] = "y"\n')
        self.commit("K-7 feat: 文で足す")
        bad = self.red()
        self.assertEqual(len(bad), 3, bad)
        for b in bad:
            self.assertIn("文 ", b)
            self.assertIn("05_flow/build_api.d/<番号>.py", b)
        self.assertTrue(any("KEY_CURSOR_OPS.add('listY')" in b for b in bad), bad)
        for extra in ('for k in ["y"]:\n    INTERNAL.add(k)\n',
                      'def more():\n    KEY_CURSOR_OPS.update({"listU"})\nmore()\n',
                      MERGE_LINE + MERGE_LINE, MERGE_DEF + MERGE_DEF,
                      '_D["INTERNAL"].add("y")\n', '_D["KEY_CURSOR_OPS"].add("listY")\n', '_D["INTERNAL_TABLES"]["y_tbl"] = "y"\n'):
            self.w(BUILD_API, BA + extra)
            self.commit("K-7 feat: 別の形で足す")
            bad = self.red()
            self.assertEqual(len(bad), 1, (extra, bad))
            self.assertIn("05_flow/build_api.d/<番号>.py", bad[0])

    def test_K1121_BD_010_logic_edits_value_edits_and_fragments_are_green(self) -> None:
        """K1121-BD-010：作り方の手順の直し・3 つの外の表・今ある鍵の値の直し・合わせの文 1 回・断片の足しは緑"""
        self.w(BUILD_API, BA.replace("rows.append(e)", "rows.append(e * 2)").replace('return {"type": "string"}', 'return {"type": "integer"}')
               .replace("rows = []", "rows = [1]\nseen = set()\nseen.add(1)").replace('BASE = "/api/v1"', 'BASE = "/api/v2"')
               .replace('"内部の索引"', '"内部の索引（直した）"')
               + 'OTHER = {"a": 1}\nOTHER["b"] = 2\nfor k in []:\n    seen.add(k)\n' + MERGE_DEF + '_D0 = {k: set(v) for k, v in _D.items()}\n' + MERGE_LINE)
        self.w("05_flow/build_api.d/K-5.py", 'KEY_CURSOR_OPS = {"listW"}\n')
        self.commit("K-7 fix: 作り方を直す")
        self.assertEqual(self.red(), [])
        r = self.cli()
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("無い（緑）", r.stdout)

    def test_K1121_BD_011_two_ledgers(self) -> None:
        """K1121-BD-011：台帳の鍵は数えない・新しい台帳が増えたら赤・台帳が受けない頭の鍵は赤"""
        self.w(BUILD_API, BA.replace('{"listTickets"}', '{"listTickets", "listZ"}'))
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "x"}'))
        self.commit("K-50 feat: 前から作っていた葉")
        self.assertEqual(self.red(), [])
        self.w(LEDGER_B, json.dumps({**LEDGERB, "entries": LEDGERB["entries"] + ["05_flow/build_api.py|KEY_CURSOR_OPS 'listQ'"]}))
        self.commit("K-7 chore: 台帳に足す")
        bad = self.red()
        self.assertEqual(len(bad), 1, bad)
        self.assertIn("body_append_grandfather_build_api.json", bad[0])
        self.assertIn("減らすだけ", bad[0])
        self.w(LEDGER_B, json.dumps(LEDGERB))
        self.commit("K-7 chore: 戻す")
        self.assertEqual(self.red(), [])
        # 新しい台帳に screen_api.py の鍵（分かれ目に無い台帳を作る回でも見る）
        self.g("rm", "-q", LEDGER_B)
        self.base = self.commit("K-1 chore: 新しい台帳の前")
        self.w(LEDGER_B, json.dumps({**LEDGERB, "entries": ["05_flow/screen_api.py|LIST_OPS 'w'"]}))
        self.commit("K-7 chore: 違う頭")
        bad = self.red()
        self.assertEqual(len(bad), 1, bad)
        self.assertIn("body_append_grandfather_build_api.json", bad[0])
        self.assertIn("受けない鍵", bad[0])
        self.assertIn("LIST_OPS 'w'", bad[0])
        # 今の台帳に build_api.py の鍵
        self.w(LEDGER_B, json.dumps(LEDGERB))
        self.w(body_append_gate.LEDGER, json.dumps({**LEDGER0, "entries": LEDGER0["entries"] + ["05_flow/build_api.py|INTERNAL 'q'"]}))
        self.commit("K-7 chore: 今の台帳に build の鍵")
        bad = [b for b in self.red() if "受けない鍵" in b]
        self.assertEqual(len(bad), 1, self.red())
        self.assertTrue(bad[0].startswith("scripts/ci/body_append_grandfather.json："), bad[0])

    def test_K1121_BD_011b_new_ledger_absent_at_base(self) -> None:
        """K1121-BD-011：分かれ目に新しい台帳が無く、先頭で作った枝は緑（台帳を作る回）"""
        self.g("rm", "-q", LEDGER_B)
        self.base = self.commit("K-1 chore: 新しい台帳の前")
        self.w(LEDGER_B, json.dumps(LEDGERB))
        self.w(BUILD_API, BA.replace('{"listTickets"}', '{"listTickets", "listZ"}'))
        self.commit("K-1121 chore: 台帳を作る")
        self.assertEqual(self.red(), [])

    def ledger_now(self, *extra: str) -> None:
        r = subprocess.run([PY, GATE, "--root", str(self.r), "--ledger-now", *extra], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_K1121_BD_012_ledger_now_splits_by_body(self) -> None:
        """K1121-BD-012：--ledger <台帳> はその台帳だけを、見る本体の鍵だけで書く。--ledger 無しは今の台帳だけ。段の枝の名前も読む"""
        self.g("checkout", "-q", "-b", "t/K-50")
        self.w(BUILD_API, BA.replace('{"listTickets"}', '{"listTickets", "listV"}'))
        self.w("05_flow/screen_api.py", SA.replace('{"getA"}', '{"getA", "v"}'))
        self.commit("K-50 feat: 両方に足す")
        self.g("checkout", "-q", body_append_gate.MAINLINE)
        self.g("checkout", "-q", "-b", "i/段6")
        self.w(BUILD_API, BA.replace('{"listTickets"}', '{"listTickets", "listS"}'))
        self.commit("K-757 feat: 段の枝で足す")
        self.g("checkout", "-q", body_append_gate.MAINLINE)
        self.w(LEDGER_B, json.dumps({**LEDGERB, "tickets": ["K-50", "i/段6"]}))
        self.commit("K-1121 chore: 台帳の tickets")
        a0 = (self.r / body_append_gate.LEDGER).read_bytes()
        self.ledger_now("--ledger", LEDGER_B)
        b = json.loads((self.r / LEDGER_B).read_text(encoding="utf-8"))
        self.assertEqual(b["entries"], ["05_flow/build_api.py|KEY_CURSOR_OPS 'listS'", "05_flow/build_api.py|KEY_CURSOR_OPS 'listV'"])
        self.assertEqual((self.r / body_append_gate.LEDGER).read_bytes(), a0)
        b0 = (self.r / LEDGER_B).read_bytes()
        self.ledger_now()
        a = json.loads((self.r / body_append_gate.LEDGER).read_text(encoding="utf-8"))
        self.assertEqual(a["entries"], ["05_flow/screen_api.py|LIST_OPS 'v'"])
        self.assertEqual((self.r / LEDGER_B).read_bytes(), b0)
        (self.r / LEDGER_B).unlink()
        self.ledger_now()
        self.assertFalse((self.r / LEDGER_B).exists())


class Wiring(unittest.TestCase):
    def test_K1121_BD_013_ci_wiring(self) -> None:
        """K1121-BD-013：g65.d の命令・CI の定義・CI の範囲の地図・G74 の段"""
        cmd = "python3 scripts/ci/k1121_build_api_d_test.py"
        self.assertEqual((ROOT / "scripts/ci/g65.d/K-1121.txt").read_text(encoding="utf-8").strip(), cmd)
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        self.assertIn(cmd, wf)
        self.assertRegex(wf, re.escape('python3 scripts/ci/body_append_gate.py --base-ref "$CI_BASE"'))
        import ci_scope  # noqa: PLC0415
        rules = ci_scope.load_rules(str(ROOT / "scripts/ci/ci_scope.json"))
        self.assertEqual(ci_scope.root_kind("05_flow/build_api.d/K-9.py", rules, str(ROOT)), "spec")
        self.assertEqual(ci_scope.root_kind("05_flow/build_api.d/README.md", rules, str(ROOT)), "spec")


if __name__ == "__main__":
    unittest.main(verbosity=2)
