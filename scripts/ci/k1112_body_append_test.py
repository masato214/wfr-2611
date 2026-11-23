#!/usr/bin/env python3
"""K-1112：共通の台帳の本体に葉が直に行を足さない（.d だけで足せる・合わせた結果は同じ・本体に直に足すと赤）。

  python3 scripts/ci/k1112_body_append_test.py
"""
from __future__ import annotations

import ast
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import api_doc_d  # noqa: E402
import body_append_gate  # noqa: E402
from registry_d import RegistryConflict  # noqa: E402

PY = sys.executable
DUMP = (   # set は並びに意味が無い（作り手も並べ直して使う）ので、並べてから比べる。dict と list は並びも比べる
    "import sys, json; sys.path.insert(0, '05_flow'); import screen_api as s\n"
    "def norm(v):\n"
    "    if isinstance(v, (set, frozenset)): return ['<set>', *sorted(repr(norm(x)) for x in v)]\n"
    "    if isinstance(v, dict): return [[repr(k), norm(x)] for k, x in v.items()]\n"
    "    if isinstance(v, (list, tuple)): return [type(v).__name__, *[norm(x) for x in v]]\n"
    "    return repr(v)\n"
    "print(json.dumps({n: norm(v) for n, v in vars(s).items() if n.isupper() and not n.startswith('_')}, sort_keys=True))\n"
)


def tables(src: str) -> list[tuple[str, ast.expr]]:
    out = []
    for node in ast.parse(src).body:
        target = node.targets[0] if isinstance(node, ast.Assign) and len(node.targets) == 1 else getattr(node, "target", None)
        value = getattr(node, "value", None)
        if isinstance(target, ast.Name) and target.id.isupper() and not target.id.startswith("_") and value is not None:
            out.append((target.id, value))
    return out


def copy_tree(dst: Path) -> None:
    (dst / "05_flow").mkdir(parents=True)
    shutil.copy(ROOT / "05_flow" / "screen_api.py", dst / "05_flow" / "screen_api.py")
    (dst / "scripts" / "ci").mkdir(parents=True)
    for p in (ROOT / "scripts" / "ci").glob("*.py"):   # 断片が読む部品（credential_patterns・invite_patterns など）
        shutil.copy(p, dst / "scripts" / "ci" / p.name)
    shutil.copytree(ROOT / "05_flow" / "screen_api.d", dst / "05_flow" / "screen_api.d")


def dump(root: Path) -> dict:
    r = subprocess.run([PY, "-c", DUMP], cwd=root, capture_output=True, text=True, env={**os.environ, "PYTHONHASHSEED": "0"})
    if r.returncode != 0:
        raise AssertionError(r.stderr[-600:])
    return json.loads(r.stdout)


def seg(lines: list[str], node: ast.AST) -> tuple[int, int, int, int]:
    return node.lineno - 1, node.col_offset, node.end_lineno - 1, node.end_col_offset


def cut(src: str, start: ast.AST, end: ast.AST) -> str:
    """start の頭から end の終わり（と続くカンマ）までを src から外す"""
    lines = src.split("\n")
    l0, c0, _, _ = seg(lines, start)
    _, _, l1, c1 = seg(lines, end)
    rest = lines[l1][c1:]
    if rest.lstrip().startswith(","):
        c1 += len(rest) - len(rest.lstrip()) + 1
    return "\n".join(lines[:l0] + [lines[l0][:c0] + lines[l1][c1:]] + lines[l1 + 1:])


class ScreenApiD(unittest.TestCase):
    def setUp(self) -> None:
        self.src = (ROOT / "05_flow" / "screen_api.py").read_text(encoding="utf-8")
        self.real = dump(ROOT)

    def test_K1112_BA_001_move_last_entry_of_every_table_to_d(self) -> None:
        """K1112-BA-001：本体のどの表も、最後の 1 つを .d（K-1.py）へ移すと合わせた結果が今とちょうど同じ"""
        names = [n for n, _ in tables(self.src)]
        self.assertGreaterEqual(len(names), 24)
        moved = 0
        for name, value in tables(self.src):
            if isinstance(value, ast.Dict) and value.keys:
                k, v = value.keys[-1], value.values[-1]
                if name == "SCREEN_API":
                    row = v.elts[-1]
                    frag = f"SCREEN_API = {{{ast.unparse(k)}: [{ast.get_source_segment(self.src, row)}]}}\n"
                    new = cut(self.src, row, row)
                else:
                    frag = f"{name} = {{{ast.get_source_segment(self.src, k)}: {ast.get_source_segment(self.src, v)}}}\n"
                    new = cut(self.src, k, v)
            elif isinstance(value, (ast.Set, ast.List)) and value.elts:
                e = value.elts[-1]
                if isinstance(value, ast.Set) and len(value.elts) == 1:
                    continue   # 1 つしかない set の字を外すと {} の dict になる（本体の形が変わる）
                body = ast.get_source_segment(self.src, e)
                frag = f"{name} = {{{body}}}\n" if isinstance(value, ast.Set) else f"{name} = [{body}]\n"
                new = cut(self.src, e, e)
            else:
                continue
            with tempfile.TemporaryDirectory() as d, self.subTest(table=name):
                root = Path(d)
                copy_tree(root)
                (root / "05_flow" / "screen_api.py").write_text(new, encoding="utf-8")
                (root / "05_flow" / "screen_api.d" / "K-1.py").write_text(frag, encoding="utf-8")
                self.assertEqual(dump(root), self.real, f"{name} の最後の 1 つを .d に移すと合わせた結果が変わる")
                moved += 1
        self.assertGreaterEqual(moved, 20)

    def test_K1112_BA_002_empty_and_new_keys_are_addable(self) -> None:
        """K1112-BA-002：空の表（INPUT_RULES・QUERY_RANGES）にも、どの表にも、新しい鍵を .d だけで足せる"""
        frag = "".join(
            f"{n} = {{'k1112_new': 1}}\n" if isinstance(v, ast.Dict) and n != "SCREEN_API"
            else (f"{n} = {{'k1112_new'}}\n" if isinstance(v, ast.Set) else (f"{n} = ['k1112_new']\n" if isinstance(v, ast.List) else ""))
            for n, v in tables(self.src))
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            copy_tree(root)
            (root / "05_flow" / "screen_api.d" / "K-999999.py").write_text(frag, encoding="utf-8")
            got = dump(root)
        for name in ("INPUT_RULES", "QUERY_RANGES", "PERMS", "UNEXPRESSIBLE_422", "LIST_OPS", "RESPONSES"):
            self.assertIn("'k1112_new'", json.dumps(got[name], ensure_ascii=False), name)

    def test_K1112_BA_003_every_body_table_is_mergeable(self) -> None:
        """K1112-BA-003：本体の頭の段の大文字の表は全部 dict・set・list の字（.d で足せる形）。T だけは手助けの字"""
        odd = [n for n, v in tables(self.src) if not isinstance(v, (ast.Dict, ast.Set, ast.List)) and n != "T"]
        self.assertEqual(odd, [], "dict・set・list の字でない表は .d で足せない")


def frag(d: Path, name: str, text: str) -> Path:
    p = d / name
    p.write_text(text, encoding="utf-8")
    return p


BODY = "# 題\n\n## 1. 表\n\n| 画面 | API |\n|---|---|\n| 一覧 | `GET /a` |\n| 詳細 | `GET /a/:id` |\n\n## 2. 誰が\n\n| API | 誰が |\n|---|---|\n| `GET /a` | read |\n| 同上 | x |\n| 同上 | y |\n\n文\n"


class ApiDocD(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_K1112_BA_004_replace_and_append(self) -> None:
        """K1112-BA-004：同じ見出しと鍵の行は置き換え、無い鍵は見出しの表の最後に足す。断片は番号の順"""
        a = frag(self.d, "K-2.md", "## 1. 表\n| 詳細 | `GET /a/:id`（直した） |\n")
        b = frag(self.d, "K-10.md", "## 1. 表\n| 消す | `DELETE /a/:id` |\n\n## 2. 誰が\n<!-- 注 -->\n| `DELETE /a/:id` | write |\n")
        c = frag(self.d, "K-3.md", "## 1. 表\n| 作る | `POST /a` |\n")
        got = api_doc_d.merge(BODY, [a, c, b]).split("\n")
        self.assertEqual(got[6:11], ["| 一覧 | `GET /a` |", "| 詳細 | `GET /a/:id`（直した） |", "| 作る | `POST /a` |", "| 消す | `DELETE /a/:id` |", ""])
        self.assertIn("| `DELETE /a/:id` | write |", got)
        self.assertEqual(got.index("| `DELETE /a/:id` | write |"), got.index("| 同上 | y |") + 1)
        self.assertTrue(got[-2:] == ["文", ""])

    def test_K1112_BA_005_errors_stop(self) -> None:
        """K1112-BA-005：無い見出し・鍵「同上」・本体で 2 つある鍵・2 つの断片が同じ鍵・見出しより前の行・表でない字・表の無い見出し・置けない名前は止める"""
        cases = {
            "無い見出し": ("## 9. 無い\n| a | b |\n", "見出し"),
            "同上": ("## 1. 表\n| 同上 | b |\n", "同上"),
            "見出しの前": ("| a | b |\n", "見出し"),
            "表でない字": ("## 1. 表\nふつうの文\n", "見出しか表の行"),
        }
        for label, (text, word) in cases.items():
            with self.subTest(label):
                p = frag(self.d, "K-5.md", text)
                with self.assertRaises(RegistryConflict) as cm:
                    api_doc_d.merge(BODY, [p])
                self.assertIn(word, str(cm.exception))
                self.assertIn("K-5.md", str(cm.exception))
        body2 = BODY.replace("| 詳細 |", "| 一覧 |")
        with self.assertRaises(RegistryConflict) as cm:
            api_doc_d.merge(body2, [frag(self.d, "K-6.md", "## 1. 表\n| 一覧 | z |\n")])
        self.assertIn("2 つ", str(cm.exception))
        x = frag(self.d, "K-7.md", "## 1. 表\n| 一覧 | p |\n")
        y = frag(self.d, "K-8.md", "## 1. 表\n| 一覧 | q |\n")
        with self.assertRaises(RegistryConflict) as cm:
            api_doc_d.merge(BODY, [x, y])
        self.assertIn("K-7.md", str(cm.exception))
        self.assertIn("K-8.md", str(cm.exception))
        with self.assertRaises(RegistryConflict) as cm:   # 表の無い見出し（# 題）に足す
            api_doc_d.merge(BODY, [frag(self.d, "K-9.md", "# 題\n| 新しい | 行 |\n")])
        self.assertIn("表が無い", str(cm.exception))
        for bad in ("extra.md", "K-01.md", "K-3.txt"):   # 置けない断片の名前
            with self.subTest(name=bad):
                d = self.d / f"n_{bad}"
                d.mkdir()
                (d / bad).write_text("## 1. 表\n", encoding="utf-8")
                (d / "README.md").write_text("説明", encoding="utf-8")
                with self.assertRaises(RegistryConflict) as cm:
                    api_doc_d.fragments(d)
                self.assertIn(bad, str(cm.exception))

    def test_K1112_BA_006_real_tree_copy_is_fresh(self) -> None:
        """K1112-BA-006：本物の木の合わせた写しは最新（--check が 0）で、断片が無い今は本体と 1 字も違わない（頭の 1 行を除く）"""
        r = subprocess.run([PY, "scripts/ci/api_doc_d.py", "--check"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout)
        body = (ROOT / "08_api/phase1/01_チケット.md").read_text(encoding="utf-8")
        merged = (ROOT / "08_api/phase1/合わせた/01_チケット.md").read_text(encoding="utf-8")
        frags = [p for p in (ROOT / "08_api/phase1/01_チケット.d").iterdir() if p.name.startswith("K-")]
        self.assertTrue(merged.startswith("<!-- 生成物・手で直さない。"))
        if not frags:
            self.assertEqual(merged.split("\n", 1)[1], body)

    def test_K1112_BA_007_check_stale_and_orphan(self) -> None:
        """K1112-BA-007：断片を足して作り直さないと --check が 1・置き場の無い写しも 1。作り直すと 0"""
        root = self.d / "r"
        docs = root / "08_api" / "phase1"
        (docs / "01_x.d").mkdir(parents=True)
        (docs / "01_x.md").write_text(BODY, encoding="utf-8")
        run = lambda *a: subprocess.run([PY, str(ROOT / "scripts/ci/api_doc_d.py"), "--root", str(root), *a], capture_output=True, text=True)
        self.assertEqual(run().returncode, 0)
        self.assertEqual(run("--check").returncode, 0)
        frag(docs / "01_x.d", "K-4.md", "## 1. 表\n| 作る | `POST /a` |\n")
        r = run("--check")
        self.assertEqual(r.returncode, 1)
        self.assertIn("古い", r.stdout)
        self.assertEqual(run().returncode, 0)
        self.assertIn("| 作る | `POST /a` |", (docs / "合わせた" / "01_x.md").read_text(encoding="utf-8"))
        (docs / "合わせた" / "02_y.md").write_text("x", encoding="utf-8")
        self.assertEqual(run("--check").returncode, 1)


SA = 'T = "tickets"\nSCREEN_API = {\n    "s": [\n        ("GET", "/a", "A1", T, "getA", []),\n    ],\n}\nPERMS = {\n    "getA": ("read", "誰でも", False),\n}\nLIST_OPS = {"getA"}\n'
DOC = "# 題\n\n## 4. 誰が\n\n| API | 誰が |\n|---|---|\n| `GET /a` | read |\n"


class Gate(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.r = Path(self.tmp.name)
        self.g("init", "-q", "-b", "main")
        self.g("config", "user.email", "t@example.com")
        self.g("config", "user.name", "t")
        self.w("05_flow/screen_api.py", SA)
        self.w("08_api/phase1/01_x.md", DOC)
        self.w(body_append_gate.LEDGER, json.dumps({"_doc": "", "tickets": ["K-50"], "entries": ["05_flow/screen_api.py|LIST_OPS 'x'", "08_api/phase1/01_x.md|`GET /g`"]}))
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

    def test_K1112_BA_008_body_key_added_is_red(self) -> None:
        """K1112-BA-008：葉が本体の表に新しい鍵（PERMS・LIST_OPS・SCREEN_API の口）を足すと赤。文に葉の番号・表・鍵・置き場"""
        self.w("05_flow/screen_api.py", SA.replace('    "getA": ("read", "誰でも", False),\n', '    "getA": ("read", "誰でも", False),\n    "getB": ("read", "b", False),\n')
               .replace('{"getA"}', '{"getA", "getB"}')
               .replace('        ("GET", "/a", "A1", T, "getA", []),\n', '        ("GET", "/a", "A1", T, "getA", []),\n        ("GET", "/b", "A1", T, "getB", []),\n'))
        self.commit("K-7 feat: 足す")
        red = self.red()
        self.assertEqual(len(red), 3, red)
        self.assertTrue(all("K-7" in b and "screen_api.d/<番号>.py" in b for b in red))
        self.assertTrue(any("PERMS" in b and "'getB'" in b for b in red))
        self.assertTrue(any("SCREEN_API" in b and "'getB'" in b for b in red))
        r = subprocess.run([PY, str(ROOT / "scripts/ci/body_append_gate.py"), "--root", str(self.r), "--base-ref", self.base], capture_output=True, text=True)
        self.assertEqual(r.returncode, 1)
        self.assertIn("赤 3 件", r.stdout)

    def test_K1112_BA_009_d_fragment_and_value_edit_are_green(self) -> None:
        """K1112-BA-009：.d の断片で足す・本体の今ある鍵の値を直す・文書の見出しの字（表のある見出しも）を直す・新しい節と表の頭の行を作るのは緑"""
        self.w("05_flow/screen_api.d/K-7.py", 'PERMS = {"getB": ("read", "b", False)}\n')
        self.w("05_flow/screen_api.py", SA.replace('"誰でも"', '"誰でも（直した）"'))
        self.w("08_api/phase1/01_x.md", DOC.replace("# 題", "# 題（直した）").replace("## 4. 誰が", "## 5. 誰が呼べるか") + "\n## 6. 新しい節\n\n| API | 何 |\n|---|---|\n")
        self.w("08_api/phase1/01_x.d/K-7.md", "## 5. 誰が呼べるか\n| `GET /b` | read |\n\n## 6. 新しい節\n| `GET /c` | 足す |\n")
        self.commit("K-7 feat: 断片で足す")
        self.assertEqual(self.red(), [])
        r = subprocess.run([PY, str(ROOT / "scripts/ci/body_append_gate.py"), "--root", str(self.r), "--base-ref", self.base], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_K1112_BA_010_body_doc_row_added_or_changed_is_red(self) -> None:
        """K1112-BA-010：本体の文書の表の行を足す・直すと赤（文に文書・見出し・鍵・置き場）"""
        self.w("08_api/phase1/01_x.md", DOC.replace("| read |", "| write |") + "| `GET /b` | read |\n")
        self.commit("K-8 feat: 文書に直に")
        red = self.red()
        self.assertEqual(len(red), 2, red)
        self.assertTrue(all("K-8" in b and "01_x.d/<番号>.md" in b for b in red))
        self.assertTrue(any("`GET /b`" in b for b in red) and any("`GET /a`" in b for b in red))

    def test_K1112_BA_011_grandfather_and_ledger_shrink_only(self) -> None:
        """K1112-BA-011：猶予の台帳の鍵（LIST_OPS 'x'・文書の行 `GET /g`）は件名に依らず緑・台帳に無い鍵は猶予の葉の件名でも赤・台帳を増やすと赤・減らすと消した鍵が赤"""
        self.w("05_flow/screen_api.py", SA.replace("LIST_OPS = {\"getA\"}", "LIST_OPS = {\"getA\", \"x\"}"))
        self.w("08_api/phase1/01_x.md", DOC + "| `GET /g` | read |\n")
        self.commit("K-50 feat: 前から作っていた葉")
        self.assertEqual(self.red(), [])
        self.w("05_flow/screen_api.py", SA.replace("LIST_OPS = {\"getA\"}", "LIST_OPS = {\"getA\", \"x\", \"w\"}"))
        self.commit("K-50 feat: 件名だけ猶予の葉にした")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("'w'", red[0])
        self.w(body_append_gate.LEDGER, json.dumps({"_doc": "", "tickets": ["K-50"], "entries": ["05_flow/screen_api.py|LIST_OPS 'x'", "08_api/phase1/01_x.md|`GET /g`", "05_flow/screen_api.py|LIST_OPS 'w'"]}))
        self.commit("K-9 chore: 台帳に足す")
        red = self.red()
        self.assertTrue(any("減らすだけ" in b and "LIST_OPS 'w'" in b for b in red), red)
        self.w(body_append_gate.LEDGER, json.dumps({"_doc": "", "tickets": [], "entries": []}))
        self.commit("K-9 chore: 台帳を減らす")
        red = self.red()
        self.assertTrue(any("'x'" in b for b in red) and any("`GET /g`" in b for b in red), red)   # 猶予を外せば前の直の足しが出る

    def test_K1112_BA_015_statement_forms_are_red(self) -> None:
        """K1112-BA-015：表に足す書き方の文（X[k] = …・.update・|=・for）と {**X} で本体に足しても赤。件名に番号の無いコミットも見る"""
        extra = ('PERMS["getC"] = ("read", "c", False)\nPERMS.update({"getD": ("read", "d", False)})\nLIST_OPS |= {"getE"}\n'
                 'for _op in ("getF",):\n    LIST_OPS.add(_op)\n')
        self.w("05_flow/screen_api.py", SA.replace("PERMS = {\n", "PERMS = {\n    **{\"getG\": (\"read\", \"g\", False)},\n") + extra)
        self.commit("番号を書かないコミット")
        red = self.red()
        self.assertEqual(len(red), 5, red)
        self.assertTrue(all("番号を書かない" in b for b in red))
        for word in ("PERMS['getC']", "PERMS.update", "LIST_OPS |=", "for _op", "PERMS **"):
            self.assertTrue(any(word in b for b in red), word)

    def test_K1112_BA_016_doc_rows_only_new_lines(self) -> None:
        """K1112-BA-016：文書の表の行を消す・並べ替えるのは緑。取り込みで両方の親が足した「同上」の行は、どれかの親に同じ字があれば数えない"""
        self.w("08_api/phase1/01_x.d/K-4.md", "")
        self.w("08_api/phase1/01_x.md", DOC.replace("| `GET /a` | read |\n", ""))
        self.commit("K-4 chore: 行を消す")
        self.assertEqual(self.red(), [])
        D2 = DOC.replace("| `GET /a` | read |\n", "")
        self.g("checkout", "-q", "-b", "left")
        self.w("08_api/phase1/01_x.md", D2 + "| 同上 | L |\n")
        left = self.commit("K-4 feat: 左")
        self.g("checkout", "-q", "main")
        self.w("08_api/phase1/01_x.md", D2 + "| 同上 | M |\n")
        self.commit("K-1 chore: 本線")
        self.base = self.g("rev-parse", "HEAD")
        subprocess.run(["git", "merge", "-q", "--no-ff", left], cwd=self.r, capture_output=True)   # ぶつかる（同じ所に足した）
        self.w("08_api/phase1/01_x.md", D2 + "| 同上 | M |\n| 同上 | L |\n")   # 両方を残して解く
        self.commit("K-4 merge: 左を取り込む")
        red = self.red()
        self.assertEqual([b for b in red if "merge" in b], [], red)   # 取り込みのコミットは数えない
        self.assertEqual(len(red), 1, red)   # 左のコミットの「同上 L」だけ
        self.w("08_api/phase1/01_x.md", D2 + "| 同上 | M |\n| 同上 | L |\n| 同上 | N |\n")
        self.g("add", "-A")
        self.g("commit", "-q", "--amend", "--no-edit")
        self.assertTrue(any("merge" in b and "同上" in b for b in self.red()))   # 解くときに足した行は数える

    def test_K1112_BA_012_merge_counts_only_new_in_resolution(self) -> None:
        """K1112-BA-012：取り込みのコミットは、どの親にも無かった鍵だけを数える（ぶつかりを解くときに足した物）"""
        self.g("checkout", "-q", "-b", "side")
        self.w("05_flow/screen_api.d/K-3.py", 'LIST_OPS = {"y"}\n')
        self.commit("K-3 feat: 断片")
        self.g("checkout", "-q", "main")
        self.w("05_flow/screen_api.py", SA.replace("LIST_OPS = {\"getA\"}", "LIST_OPS = {\"getA\", \"m\"}"))
        mainline = self.commit("K-50 feat: 本線に入った葉")
        self.g("checkout", "-q", "side")
        self.g("merge", "-q", "--no-ff", "-m", "K-3 merge: 本線を取り込む", "main")
        self.base = self.g("merge-base", "HEAD", mainline)
        self.assertEqual(self.red(), [])
        self.w("05_flow/screen_api.py", SA.replace("LIST_OPS = {\"getA\"}", "LIST_OPS = {\"getA\", \"m\", \"z\"}"))
        self.g("add", "-A")
        self.g("commit", "-q", "--amend", "--no-edit")
        red = self.red()
        self.assertEqual(len(red), 1, red)
        self.assertIn("K-3", red[0])
        self.assertIn("'z'", red[0])

    def test_K1112_BA_013_unreadable_base_is_red(self) -> None:
        """K1112-BA-013：比べる元が空・読めないなら赤（黙って比べずに緑にしない）"""
        for base in ("", "0" * 40):
            with self.subTest(base=base):
                red = body_append_gate.check(self.r, base)
                self.assertEqual(len(red), 1)
                self.assertIn("読めない", red[0])


class Wiring(unittest.TestCase):
    def test_K1112_BA_014_wired(self) -> None:
        """K1112-BA-014：G74 が CI の定義に在り base を env で渡す・作り手が目録に在る・写しが changes_ignore・猶予の台帳に K-1112 が無い"""
        plan = (ROOT / "05_flow/build_testplan.py").read_text(encoding="utf-8")
        self.assertIn('"id": 74', plan)
        wf = (ROOT / ".github/workflows/v3-gate.yml").read_text(encoding="utf-8")
        i = wf.index('- name: "G74 ')
        step = wf[i:wf.index("- name:", i + 10)]
        self.assertIn("CI_BASE: ${{ steps.scope.outputs.base }}", step)
        self.assertIn('python3 scripts/ci/body_append_gate.py --base-ref "$CI_BASE"', step)
        self.assertIn("api_doc_d.py --check", step)
        gen = json.loads((ROOT / "scripts/ci/generated.json").read_text(encoding="utf-8"))
        self.assertTrue(any(g["run"] == "python3 scripts/ci/api_doc_d.py" and g["outputs"] == ["08_api/phase1/合わせた/*.md"] for g in gen["generators"]))
        self.assertIn('"08_api/phase1/合わせた/*.md"', (ROOT / "ticket-flow.yaml").read_text(encoding="utf-8"))
        led = json.loads((ROOT / body_append_gate.LEDGER).read_text(encoding="utf-8"))
        self.assertNotIn("K-1112", led["tickets"])
        self.assertTrue(all(t.startswith("K-") for t in led["tickets"]))
        self.assertTrue(led["entries"] and all("|" in e for e in led["entries"]))
        self.assertTrue(all(e.split("|", 1)[0] == body_append_gate.SCREEN_API or body_append_gate.is_body_doc(e.split("|", 1)[0]) for e in led["entries"]))


if __name__ == "__main__":
    unittest.main(verbosity=1)
