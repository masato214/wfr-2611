#!/usr/bin/env python3
"""口の文書（08_api/phase1/<名前>.md）に、葉ごとの断片（<名前>.d/K-<番号>.md）を合わせた写しを作る作り手（K-1112）。

  python3 scripts/ci/api_doc_d.py           断片の置き場がある文書ごとに、合わせた写しを 08_api/phase1/合わせた/<名前>.md に書く
  python3 scripts/ci/api_doc_d.py --check   書かずに、今の写しと違えば 1 で終わる

なぜ：葉どうしが同じ文書の隣り合う表の行を直すと、取り込みでぶつかって本線を取り込み直し、CI を取り直していた。
葉ごとのファイルに書けば別のファイルなので、ぶつからない。本体は今作っている葉がまだ直に直しているので、生成物にはしない
（本体を作り直すと、その葉の直しが取り込みで消える）。合わせた写しだけを生成物（設定 changes_ignore）にする。

断片の形（ほかの字は止める）：
  - 見出しの行（# で始まる）。本体に同じ字の見出しがちょうど 1 つ要る
  - 表の行（| で始まる）。鍵は 1 つ目の欄の字。本体のその見出しの下に同じ鍵の行があれば置き換え、無ければその見出しの表の最後の行の後に足す
  - 空の行と <!-- --> の 1 行の注釈
鍵「同上」・本体で 2 つある鍵・2 つの断片が同じ見出しと鍵を持つ・表の無い見出し・見出しより前の行は止める（黙ってどちらかを取らない）。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from registry_d import RegistryConflict  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
DOCS = "08_api/phase1"
OUT = "合わせた"
AMBIGUOUS = {"同上", ""}
COMMENT = re.compile(r"^<!--.*-->$")
FRAGMENT = re.compile(r"^K-[1-9][0-9]*\.md$")
HEAD = (
    "<!-- 生成物・手で直さない。作り手 scripts/ci/api_doc_d.py が {body} に {frag}/ の断片を合わせて作る（K-1112）。"
    "直すのは本体（今作っている葉だけ）か、葉ごとの断片 {frag}/K-<番号>.md -->\n"
)


def is_row(line: str) -> bool:
    return line.startswith("|") and not re.match(r"^\|\s*:?-{3,}", line)


def row_key(line: str) -> str:
    return line.strip().strip("|").split("|")[0].strip()


def body_rows(text: str) -> dict[tuple[str, str], list[int]]:
    """本体の表の行：(見出し, 鍵) → 行の番号（0 から）の並び。表の区切りの行（|---|）は数えない"""
    rows: dict[tuple[str, str], list[int]] = {}
    heading = ""
    for i, line in enumerate(text.split("\n")):
        if line.startswith("#"):
            heading = line.rstrip()
        elif is_row(line):
            rows.setdefault((heading, row_key(line)), []).append(i)
    return rows


def parse_fragment(path: Path) -> list[tuple[str, str, str]]:
    """断片を (見出し, 鍵, 行) の並びにする。形に合わない行は止める"""
    out: list[tuple[str, str, str]] = []
    heading = None
    for n, raw in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
        line = raw.rstrip()
        if not line or COMMENT.match(line):
            continue
        if line.startswith("#"):
            heading = line
            continue
        if not is_row(line):
            raise RegistryConflict(f"{path.name}:{n} は見出しか表の行だけを書く（ほかの字は本体に書く）：{line[:40]}")
        if heading is None:
            raise RegistryConflict(f"{path.name}:{n} の表の行の前に、本体の見出しの行が要る")
        key = row_key(line)
        if key in AMBIGUOUS:
            raise RegistryConflict(f"{path.name}:{n} の鍵「{key}」では置き換える行が決まらない（1 つ目の欄に字を書く）")
        out.append((heading, key, line))
    return out


def merge(body: str, frags: list[Path]) -> str:
    """本体に断片を番号の順に合わせた字を返す。本体は書き換えない"""
    lines = body.split("\n")
    rows = body_rows(body)
    headings = [l.rstrip() for l in lines if l.startswith("#")]
    owners: dict[tuple[str, str], str] = {}
    replace: dict[int, str] = {}
    append: dict[str, list[str]] = {}
    for path in frags:
        for heading, key, line in parse_fragment(path):
            if headings.count(heading) != 1:
                raise RegistryConflict(f"{path.name}: 見出し「{heading}」が本体に {headings.count(heading)} 個ある（ちょうど 1 つの見出しに足す）")
            k = (heading, key)
            if k in owners:
                raise RegistryConflict(f"{owners[k]} と {path.name} が「{heading}」の鍵「{key}」を両方持つ")
            owners[k] = path.name
            at = rows.get(k, [])
            if len(at) > 1:
                raise RegistryConflict(f"{path.name}: 本体の「{heading}」に鍵「{key}」の行が {len(at)} つある（置き換える行が決まらない）")
            if at:
                replace[at[0]] = line
            else:
                append.setdefault(heading, []).append(line)
    last: dict[str, int] = {}
    heading = ""
    for i, line in enumerate(lines):
        if line.startswith("#"):
            heading = line.rstrip()
        elif line.startswith("|") and heading in append:
            last[heading] = i
    for h in append:
        if h not in last:
            raise RegistryConflict(f"見出し「{h}」の下に表が無い（足す先の表を本体に作る）")
    out: list[str] = []
    after = {i: h for h, i in last.items()}
    for i, line in enumerate(lines):
        out.append(replace.get(i, line))
        if i in after:
            out.extend(append[after[i]])
    return "\n".join(out)


def fragments(directory: Path) -> list[Path]:
    """置き場の断片（K-<数字>.md）を番号の順に出す。README.md と隠しファイルは外す。決まりに合わない名前は止める"""
    found: list[Path] = []
    for path in sorted(directory.iterdir()):
        if path.name == "README.md" or path.name.startswith("."):
            continue
        if not FRAGMENT.match(path.name) or not path.is_file():
            raise RegistryConflict(f"{directory.name}: {path.name} は置けない名前（置けるのは K-<数字>.md・README.md）")
        found.append(path)
    return sorted(found, key=lambda p: int(p.stem.split("-", 1)[1]))


def targets(root: Path) -> list[tuple[Path, Path, Path]]:
    """(本体, 断片の置き場, 合わせた写し)。置き場がある文書だけ"""
    docs = root / DOCS
    found = []
    for body in sorted(docs.glob("*.md")):
        frag = body.with_suffix(".d")
        if frag.is_dir():
            found.append((body, frag, docs / OUT / body.name))
    return found


def build(root: Path) -> dict[Path, str]:
    result: dict[Path, str] = {}
    for body, frag, out in targets(root):
        head = HEAD.format(body=body.relative_to(root).as_posix(), frag=frag.relative_to(root).as_posix())
        result[out] = head + merge(body.read_text(encoding="utf-8"), fragments(frag))
    return result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--root", default=str(ROOT))
    a = ap.parse_args()
    root = Path(a.root)
    try:
        result = build(root)
    except RegistryConflict as e:
        print(f"口の文書の断片：{e}（何も書いていない）")
        return 1
    stale = []
    for out, text in result.items():
        if a.check:
            if not out.is_file() or out.read_text(encoding="utf-8") != text:
                stale.append(out.relative_to(root).as_posix())
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
    known = set(result)
    extra = [p for p in sorted((root / DOCS / OUT).glob("*.md")) if p not in known] if (root / DOCS / OUT).is_dir() else []
    if a.check and (stale or extra):
        for s in stale:
            print(f"口の文書の断片：{s} が古い（python3 scripts/ci/api_doc_d.py で作り直す）")
        for p in extra:
            print(f"口の文書の断片：{p.relative_to(root).as_posix()} は断片の置き場の無い写し（消す）")
        return 1
    if not a.check:
        for p in extra:
            p.unlink()
    print(f"口の文書の断片：{len(result)} つの文書を合わせた（{'確かめだけ' if a.check else '書いた'}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
