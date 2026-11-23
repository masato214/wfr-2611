#!/usr/bin/env python3
"""K-1114 見た目と式の検査が、組み立てた画面の置き場（apps/web/.next-prod・CI の build:test の出力）を読まない試験。

CI の web の組は画面を組み立ててから（NEXT_DIST_DIR=.next-prod）画面の試験を流す。D8（生の長さ）は apps/web の下を全部読み、
組み立てた JS と CSS の生の値（4000 を超える）を数えて K400-DS-002 が赤になっていた。作りものの木は tempfile の中に作る。
行 ID は K1114-CI-001〜003（チケット 11_tickets/K-1114.md の表）。
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))

import class_gate  # noqa: E402
import design_gate  # noqa: E402
import design_raw_lengths  # noqa: E402


def _write(base: Path, rel: str, text: str) -> None:
    p = base / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


class BuildDirSkip(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.base = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_K1114_CI_001_raw_lengths_skip_next_prod(self) -> None:
        """K1114-CI-001 D8 の置き場の読み：.next-prod の下の .css と .js は読まず、画面の .css と .tsx は読む"""
        _write(self.base, "web/features/a.css", ".a { margin: 22px; }\n")
        _write(self.base, "web/features/a.tsx", 'export const A = () => <div className="mb-[22px]" />;\n')
        _write(self.base, "web/.next-prod/static/css/b.css", ".b { margin: 22px; }\n")
        _write(self.base, "web/.next-prod/server/app/page.js", 'e("div",{className:"mb-[22px]"})\n')
        css = [p.relative_to(self.base).as_posix() for p in design_raw_lengths.css_files(self.base, ["web"])]
        mark = [p.relative_to(self.base).as_posix() for p in design_raw_lengths.markup_files(self.base, ["web"])]
        self.assertEqual(css, ["web/features/a.css"])
        self.assertEqual(mark, ["web/features/a.tsx"])

    def test_K1114_CI_002_unused_scales_skip_next_prod(self) -> None:
        """K1114-CI-002 D6（使われない段）：.next-prod の中でだけ使われる段は「使われない」と出る（組み立てた出力で使ったことにしない）"""
        _write(self.base, "web/features/a.css", ".a { font-size: var(--k-text-body); }\n")
        _write(self.base, "web/.next-prod/static/css/b.css", ".b { font-size: var(--k-text-display); }\n")
        src = {"typography": {"body": {"fontSize": "14px"}, "display": {"fontSize": "28px"}}}
        self.assertEqual(design_gate.unused_scales(src, [str(self.base / "web")]), ["display"])

    def test_K1114_CI_003_class_gate_skip_next_prod(self) -> None:
        """K1114-CI-003 class_gate のファイル集め：.next-prod の下の .tsx は読まず、画面の .tsx は読む"""
        _write(self.base, f"{class_gate.WEB}/features/a.tsx", "export const A = 1;\n")
        _write(self.base, f"{class_gate.WEB}/.next-prod/server/b.tsx", "export const B = 1;\n")
        got = [p.relative_to(self.base).as_posix() for p in class_gate._files(self.base, ".tsx")]
        self.assertEqual(got, [f"{class_gate.WEB}/features/a.tsx"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
