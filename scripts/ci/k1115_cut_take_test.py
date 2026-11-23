#!/usr/bin/env python3
"""K-1115 の試験：切る段の枝から 1 本の分を持ち込む台本（scripts/tickets/cut_take.py）が、重ねた元の行のすぐ下に足すだけの
自分の行を足し、切る段だけの印の無い行が本線に無ければ止める。行 ID は K1115-CT-NNN。
作りものの git の木は K-187 の試験（scripts/ci/k187_cut_take_test.py）の土台をそのまま使う（試験の行は借りない）"""
from __future__ import annotations

import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "tickets"))
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import k187_cut_take_test as base  # noqa: E402  土台（setUp・tearDown・take）と作りものの木の部品だけを借りる

SHARED = base.SHARED
TAIL = base.TAIL
git = base.git
put = base.put


class StackedOnMerged(unittest.TestCase):
    """重ねた元 K-6 が分かれ目の後に本線へ入った形（K-581 の形）"""

    setUp = base.CutTake.setUp
    tearDown = base.CutTake.tearDown
    take = base.CutTake.take

    def stack_case(self, cut_lines: list[str], main_lines: list[str]) -> str:
        """重ねた元 K-6 が分かれ目の後に本線へ入った形を作り、t/K-5 で本線の版を返す"""
        git(self.repo, "checkout", "-q", "c/x")
        put(self.repo, {SHARED: "\n".join(cut_lines)})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "cut: 重ねて切る")
        git(self.repo, "checkout", "-q", "main")
        main_shared = "\n".join(main_lines)
        put(self.repo, {SHARED: main_shared})
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-qm", "K-6 feat: 重ねた元が本線に入った")
        git(self.repo, "checkout", "-q", "-B", "t/K-5", "main")
        return main_shared

    def assert_stops_untouched(self, main_shared: str, *words: str) -> None:
        import cut_take
        with self.assertRaises(SystemExit) as e:
            cut_take.take(self.repo, "K-5", "c/x", shared=[SHARED], regenerate=False)
        for w in words:
            self.assertIn(w, str(e.exception))
        self.assertEqual((self.repo / SHARED).read_text(encoding="utf-8"), main_shared, "共有の試験を書き換えている")
        self.assertFalse((self.repo / "11_tickets/K-5.md").exists())

    def test_K1115_CT_001_own_lines_right_below_a_later_merged_stack_base_are_added(self) -> None:
        # 重ねた元（K-6）が分かれ目の後に本線へ入り、切る段では K-6 の行のすぐ下に自分（K-5）の行がある（K-581 の形）
        self.stack_case(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL],
                        ["const A = 1;", "const s6 = 6; // K-6", *TAIL])
        self.take()
        s = (self.repo / SHARED).read_text(encoding="utf-8")
        self.assertEqual(s, "\n".join(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL]))

    def test_K1115_CT_002_unmarked_cut_line_missing_from_mainline_stops(self) -> None:
        # 重ねた元の行のすぐ下に自分の行があり、離れた所に印の無い行（切る段だけの行）もある。本線にはその印の無い行が無い：
        # 自分の印を外した版を元にすると、印の無い行を本線が消したように見えて落ちるので、落とさずに止める
        main_shared = self.stack_case(
            ["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL[:-1], "const x = 9;", ""],
            ["const A = 1;", "const s6 = 6; // K-6", *TAIL])
        self.assert_stops_untouched(main_shared, "印の無い行が本線に無い：const x = 9;")

    def test_K1115_CT_003_other_unmerged_range_is_left_out_without_stopping(self) -> None:
        # 同じぶつかる並びに、まだのチケット K-7 の範囲が離れた所にある：範囲の中身は印の無い行として数えない
        self.stack_case(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL[:-1],
                         "// K-7 ここから", "const block7 = 7;", "// K-7 ここまで", ""],
                        ["const A = 1;", "const s6 = 6; // K-6", *TAIL])
        self.take()
        s = (self.repo / SHARED).read_text(encoding="utf-8")
        self.assertEqual(s, "\n".join(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL]))

    def test_K1115_CT_004_dropped_line_with_same_text_elsewhere_stops(self) -> None:
        # 切る段で印の無い `});` を足したが本線の版に無い。ほかの所に同じ字面の `});` はある：数で比べて落ちたと見て止める
        main_shared = self.stack_case(
            ["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", "});", *TAIL[:-1], "});", ""],
            ["const A = 1;", "const s6 = 6; // K-6", "});", *TAIL])
        self.assert_stops_untouched(main_shared, "印の無い行が本線に無い：});")

    def test_K1115_CT_005_second_merge_conflict_stops(self) -> None:
        # 重ねた元の行を本線が別の字面に直して入れた：自分の印を外した版を元にしても、すぐ下の自分の行とぶつかるので止める
        main_shared = self.stack_case(["const A = 1;", "const s6 = 6; // K-6", "const s5 = 5; // K-5", *TAIL],
                                      ["const A = 1;", "const s6 = 66; // K-6", *TAIL])
        self.assert_stops_untouched(main_shared, "ぶつかる", SHARED)


if __name__ == "__main__":
    unittest.main(verbosity=2)
