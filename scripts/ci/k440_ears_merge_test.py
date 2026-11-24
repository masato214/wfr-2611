#!/usr/bin/env python3
"""K-440 の試験：ears-elsewhere の断片どうしが、同じ口（op）の covers を足し合わせる（scripts/ci/build_registries.py）。

  python3 scripts/ci/k440_ears_merge_test.py      行 ID は K440-SHAPE-NNN（チケット 11_tickets/K-440.md の表の行と 1 対 1）

断片は一時フォルダに作る（DB なし・本物の 07_qa/test-plan/ears-elsewhere.d は読まない）。
足し合わせるのは kind ears の ops だけ。errors・ci_scope の同じ鍵が今も止まることは k325_registries_test.py（K325-REG-011・014）が見る。
テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import build_registries  # noqa: E402
import registry_d  # noqa: E402


class Tmp(unittest.TestCase):
    def setUp(self) -> None:
        self._t = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self._t.name)

    def tearDown(self) -> None:
        self._t.cleanup()

    def put_json(self, name: str, obj: object) -> None:
        (self.d / name).write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")

    def stops(self, *words: str) -> str:
        """今のフォルダの断片を足し合わせると止まる。止める文に words が全部出る。文を返す"""
        with self.assertRaises(registry_d.RegistryConflict) as cm:
            build_registries.build("ears", self.d)
        for word in words:
            self.assertIn(word, str(cm.exception))
        return str(cm.exception)


class EarsMerge(Tmp):
    def test_K440_SHAPE_001_same_op_covers_add_up(self) -> None:
        """同じ口 opA の covers が 4 つの断片（K-1・K-2・K-3・K-10）に分かれていても 1 つの口に足し合わさる：file・reason は書いた断片の値のまま（file が同じ値なら 2 つ目以降が書いてもよい・covers しか書かない断片も許す）、covers は全部が番号の順（K-10 は K-3 の後）に並び、{file, mark} の形も別の名前が同じ行 ID を持つ形も残り、同じ covers の名前を同じ値で 2 つの断片が結ぶ形（文字の行 ID も {file, mark} の形も）は 1 つにまとまり（止まらない）、断片が _base.json の口 opB に covers だけを足す形も通り（_base.json の物が先）、_base.json の別の口 opZ・断片 1 つだけの別の口 opC・_doc は変わらず、作り直しても同じ"""
        self.put_json("_base.json", {"_doc": "d", "ops": {
            "opZ": {"file": "z.test.ts"},
            "opB": {"file": "base.test.ts", "covers": {"t_base": "ROW-B0"}}}})
        self.put_json("K-1.json", {"ops": {
            "opA": {"file": "a.test.ts", "reason": "r", "covers": {"t_one": "ROW-1"}},
            "opC": {"file": "c.test.ts", "covers": {"t_c": "ROW-C"}}}})
        self.put_json("K-2.json", {"ops": {"opA": {"covers": {"t_two": {"file": "b.test.ts", "mark": "ROW-2"}}}}})
        self.put_json("K-3.json", {"ops": {"opA": {"file": "a.test.ts", "covers": {
            "t_three": "ROW-1", "t_one": "ROW-1", "t_two": {"file": "b.test.ts", "mark": "ROW-2"}}}}})
        self.put_json("K-10.json", {"ops": {
            "opA": {"covers": {"t_ten": "ROW-10"}},
            "opB": {"covers": {"t_frag": "ROW-B1"}}}})
        out = build_registries.build("ears", self.d)
        a = out["ops"]["opA"]
        self.assertEqual(a["file"], "a.test.ts")
        self.assertEqual(a["reason"], "r")
        self.assertEqual(list(a["covers"]), ["t_one", "t_two", "t_three", "t_ten"])
        self.assertEqual(a["covers"]["t_one"], "ROW-1")   # K-3 も同じ値で結んでいる：1 つにまとまる
        self.assertEqual(a["covers"]["t_two"], {"file": "b.test.ts", "mark": "ROW-2"})   # K-3 も {file, mark} の同じ値で結んでいる：1 つにまとまる
        self.assertEqual(a["covers"]["t_three"], "ROW-1")
        self.assertEqual(a["covers"]["t_ten"], "ROW-10")
        self.assertEqual(out["ops"]["opC"], {"file": "c.test.ts", "covers": {"t_c": "ROW-C"}})
        self.assertEqual(out["ops"]["opB"], {"file": "base.test.ts", "covers": {"t_base": "ROW-B0", "t_frag": "ROW-B1"}})
        self.assertEqual(list(out["ops"]["opB"]["covers"]), ["t_base", "t_frag"])
        self.assertEqual(out["ops"]["opZ"], {"file": "z.test.ts"})
        self.assertEqual(out["_doc"], "d")
        self.assertEqual(build_registries.build("ears", self.d), out)

    def test_K440_SHAPE_002_conflicts_stop_and_write_nothing(self) -> None:
        """足し合わせてはならない形は、口の名前と 2 つのファイルの名前を出して止まり、何も書かない：covers 以外の鍵（file）が断片どうしで違う値／同じ covers の名前を 2 つの断片が違う値で結ぶ／3 つ目の断片が 2 つ目の足した名前を結ぶ（止める文には名前を最初に足した K-2 と K-3 が出て、口を最初に書いた K-1 は出ない）／口の値がオブジェクトでない／_base.json が結んだ covers の名前を断片が違う値で結ぶ・_base.json の file と違う値を断片が書く"""
        self.put_json("_base.json", {"_doc": "d", "ops": {"opB": {"file": "base.test.ts"}}})
        self.put_json("K-1.json", {"ops": {"opA": {"file": "a.test.ts", "covers": {"t_one": "ROW-1"}}}})
        # covers 以外（file）が違う値
        self.put_json("K-2.json", {"ops": {"opA": {"file": "other.test.ts", "covers": {"t_two": "ROW-2"}}}})
        self.stops("opA", "K-1.json", "K-2.json", "file")
        # 同じ covers の名前を 2 つが違う値で結ぶ
        self.put_json("K-2.json", {"ops": {"opA": {"covers": {"t_one": "ROW-9"}}}})
        self.stops("opA", "K-1.json", "K-2.json", "t_one")
        # 3 つ目の断片が、2 つ目の断片が足した名前を結ぶ
        self.put_json("K-2.json", {"ops": {"opA": {"covers": {"t_two": "ROW-2"}}}})
        self.put_json("K-3.json", {"ops": {"opA": {"covers": {"t_two": "ROW-3"}}}})
        message = self.stops("opA", "K-2.json", "K-3.json", "t_two")
        self.assertNotIn("K-1.json", message)
        (self.d / "K-3.json").unlink()
        # 口の値がオブジェクトでない
        self.put_json("K-2.json", {"ops": {"opA": "not-an-object"}})
        self.stops("opA", "K-2.json")
        # _base.json が結んだ covers の名前を断片が結ぶ／_base.json の file と違う値を断片が書く
        self.put_json("_base.json", {"_doc": "d", "ops": {"opB": {"file": "base.test.ts", "covers": {"t_base": "ROW-B0"}}}})
        self.put_json("K-2.json", {"ops": {"opB": {"covers": {"t_base": "ROW-B9"}}}})
        self.stops("opB", "_base.json", "K-2.json", "t_base")
        self.put_json("K-2.json", {"ops": {"opB": {"file": "other.test.ts", "covers": {"t_x": "ROW-1"}}}})
        self.stops("opB", "_base.json", "K-2.json", "file")
        self.put_json("K-2.json", {"ops": {"opB": {"covers": {"t_x": "ROW-1"}}}})   # これは通る。止まる形に戻す
        build_registries.build("ears", self.d)
        self.put_json("K-2.json", {"ops": {"opB": {"covers": {"t_base": "ROW-B9"}}}})
        # 作り手の行（--only）：1 で終わり、書き先は作られない
        out = self.d / "ears-elsewhere.json"
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "ci" / "build_registries.py"),
                            "--only", "ears", "--dir", str(self.d), "--out", str(out)],
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        last = (r.stdout + r.stderr).strip().splitlines()[-1]
        for word in ("opB", "_base.json", "K-2.json"):
            self.assertIn(word, last)
        self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
