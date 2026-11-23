#!/usr/bin/env python3
"""共通の台帳の本体に、葉が直に行を足していないか（K-1112）。

  python3 scripts/ci/body_append_gate.py --base-ref <本線との分かれ目>
  python3 scripts/ci/body_append_gate.py --ledger-now      今作っている葉の枝（t/K-*）が足した物を台帳に書く（台帳を作る回だけ）

なぜ：同時に作る葉が同じ本体（05_flow/screen_api.py の表・08_api/phase1/*.md の表）に行を足すと、取り込みでぶつかる。
足す分は葉ごとのファイルに書く：
  05_flow/screen_api.py の表の新しい鍵   → 05_flow/screen_api.d/K-<番号>.py（同じ名前の表で書く）
  08_api/phase1/<名前>.md の表の行       → 08_api/phase1/<名前>.d/K-<番号>.md（作り手 scripts/ci/api_doc_d.py が合わせる）

見るのは、比べる元の木と今の先頭の木の差（K-1120）。比べる元の木に無く、今の先頭の木に在る物だけを数える。
途中のコミットで足して後で戻した物は数えない（取り込む木に無いので、ぶつからない。葉の履歴は書き直せない）：
  - screen_api.py：頭の段の表に新しい鍵が増えた。SCREEN_API は operationId を鍵にする。{**X} も 1 つの鍵として数える。
    頭の段の、表に足す書き方の文（X[k] = …・X.update(…)・X |= …・for など、大文字の名前に代入する以外の文）も新しい物を数える。
    今ある鍵の値を直すのは見ない（.d は本体の鍵を上書きできないので）
  - 08_api/phase1/*.md（.d の中・合わせた写しは除く）：表の行で、どの親の同じ文書にも同じ字の行が無い物（足した・直した）。
    表の頭の行（次の行が |---| の行）は数えない（新しい表・節・文書の形は本体に作り、行は断片に書く）。見出しの字の直し・消した行は見ない
赤の文の頭のコミットは、比べる元から先頭までで、その鍵・行を最後に足したコミット（直す人が場所を探すための物。判定には使わない）。
コミットを 1 つずつ見るとき（この文のコミット探しと、台帳の作り手 --ledger-now）、取り込みのコミットは、どの親にも無かった物だけを数える
猶予：台帳 scripts/ci/body_append_grandfather.json の entries（この決まりの前に始めていた葉が、その枝で既に足していた鍵と行の鍵）は数えない。
台帳は分かれ目より増やせない（減らすだけ）。比べる元が読めない・空なら赤（黙って比べずに緑にしない）。
"""
from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import api_doc_d  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
SCREEN_API = "05_flow/screen_api.py"
DOCS = "08_api/phase1"
LEDGER = "scripts/ci/body_append_grandfather.json"
MAINLINE = "claude/modest-lamport-77ue02"
UNKNOWN = "（足したコミットは分からない）"


def git(root: Path, *args: str, check: bool = True) -> str:
    r = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}：{r.stderr.strip()[:200]}")
    return r.stdout if r.returncode == 0 else ""


def show(root: Path, rev: str, path: str) -> str | None:
    r = subprocess.run(["git", "show", f"{rev}:{path}"], cwd=root, capture_output=True, text=True, encoding="utf-8")
    return r.stdout if r.returncode == 0 else None


def _table(node: ast.stmt) -> tuple[str, ast.expr] | None:
    target = node.targets[0] if isinstance(node, ast.Assign) and len(node.targets) == 1 else getattr(node, "target", None)
    value = getattr(node, "value", None)
    if isinstance(node, (ast.Assign, ast.AnnAssign)) and isinstance(target, ast.Name) and value is not None:
        return target.id, value
    return None


def py_keys(src: str | None) -> set[str]:
    """本体の表の鍵（「表 鍵」の字）と、表に足す書き方の文（「文 …」）。読めない字は空（親が無い・まだ無いのと同じ）"""
    if not src:
        return set()
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return set()
    keys: set[str] = set()
    for node in tree.body:
        t = _table(node)
        if t is None:
            if not isinstance(node, (ast.Import, ast.ImportFrom)) and not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant)):
                keys.add(f"文 {ast.unparse(node)}")
            continue
        name, value = t
        if not name.isupper() or name.startswith("_"):
            continue
        if isinstance(value, ast.Dict):
            for k, v in zip(value.keys, value.values):
                if k is None:
                    keys.add(f"{name} **{ast.unparse(v)}")
                elif name == "SCREEN_API" and isinstance(v, ast.List):
                    for row in v.elts:
                        keys.add(f"{name} {ast.unparse(row.elts[4])}" if isinstance(row, ast.Tuple) and len(row.elts) > 4 else f"{name} {ast.unparse(row)}")
                else:
                    keys.add(f"{name} {ast.unparse(k)}")
        elif isinstance(value, (ast.Set, ast.List)):
            keys.update(f"{name} {ast.unparse(e)}" for e in value.elts)
        else:
            keys.add(f"文 {ast.unparse(node)}")   # 字でない表（内包・関数の呼び出し）は文として数える
    return keys


def md_lines(src: str | None) -> list[str]:
    """表の行（頭の行と区切りの行を除く）"""
    if not src:
        return []
    lines = src.split("\n")
    out = []
    for i, line in enumerate(lines):
        if not api_doc_d.is_row(line):
            continue
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if nxt.startswith("|") and not api_doc_d.is_row(nxt):
            continue   # 表の頭の行
        out.append(line)
    return out


def changed(root: Path, rev: str, parents: list[str]) -> set[str]:
    """どの親とも違う本体のファイル（取り込みは、どれかの親と同じなら足した物は無い）"""
    paths = [SCREEN_API, DOCS]
    if not parents:
        return set(git(root, "ls-tree", "-r", "--name-only", "-z", rev, "--", *paths).split("\0")) - {""}
    sets = [set(git(root, "diff", "--name-only", "-z", "--no-renames", p, rev, "--", *paths).split("\0")) - {""} for p in parents]
    return set.intersection(*sets)


def is_body_doc(path: str) -> bool:
    return path.startswith(DOCS + "/") and path.count("/") == DOCS.count("/") + 1 and path.endswith(".md")


def added(root: Path, rev: str, parents: list[str]) -> list[tuple[str, str]]:
    """このコミットが本体に直に足した物：(台帳の鍵, 説明)"""
    found: list[tuple[str, str]] = []
    touched = changed(root, rev, parents)
    if SCREEN_API in touched:
        now = py_keys(show(root, rev, SCREEN_API))
        before = set().union(*(py_keys(show(root, p, SCREEN_API)) for p in parents)) if parents else set()
        for key in sorted(now - before):
            table = key.split(" ", 1)[0]
            where = "05_flow/screen_api.d/<番号>.py の同じ名前の表" if table != "文" else "05_flow/screen_api.d/<番号>.py（足す文は書かず、表の字で）"
            found.append((f"{SCREEN_API}|{key}", f"{SCREEN_API} に {key[:120]}（{where}に書く）"))
    for doc in sorted(t for t in touched if is_body_doc(t)):
        olds = set().union(*(md_lines(show(root, p, doc)) for p in parents)) if parents else set()
        for line in md_lines(show(root, rev, doc)):
            if line in olds:
                continue
            key = api_doc_d.row_key(line)
            found.append((f"{doc}|{key}", f"{doc} の表の行「{key}」（{DOCS}/{Path(doc).stem}.d/<番号>.md に書く）"))
    return found


def ledger(src: str | None) -> set[str]:
    if src is None:
        return set()
    return {str(t) for t in json.loads(src)["entries"]}


def scan(root: Path, base: str, head: str = "HEAD") -> list[tuple[str, str, str]]:
    """(コミット, 台帳の鍵, 説明) を、base..head のコミット 1 つずつから新しい順に出す（台帳の作り手と、赤の文のコミット探し）"""
    out = []
    for line in git(root, "log", "--format=%H%x09%P%x09%s", f"{base}..{head}").splitlines():
        sha, parents, subject = (line.split("\t", 2) + ["", ""])[:3]
        for key, text in added(root, sha, parents.split()):
            out.append((f"{sha[:10]} {subject[:40]}", key, text))
    return out


def check(root: Path, base: str) -> list[str]:
    if not base or not git(root, "rev-parse", "--verify", "--quiet", f"{base}^{{commit}}", check=False).strip():
        return [f"比べる元 {base or '（空）'} が読めない（黙って比べずに緑にしない）"]
    bad: list[str] = []
    try:
        now_l = ledger(show(root, "HEAD", LEDGER))
        base_src = show(root, base, LEDGER)
        if base_src is not None and (grown := sorted(now_l - ledger(base_src))):
            bad.append(f"{LEDGER}：分かれ目より猶予が {len(grown)} 増えた（{', '.join(grown)[:200]}・台帳は減らすだけ）")
    except (ValueError, KeyError, TypeError) as e:
        return [f"{LEDGER} が読めない（{e}）"]
    net = [(key, text) for key, text in added(root, "HEAD", [base]) if key not in now_l]   # 比べる元の木に無く、今の先頭の木に在る物
    who: dict[str, str] = {}
    if net:   # 文に出すコミット：新しい順に見て最初に当たった物（＝最後に足したコミット）
        for commit, key, _ in scan(root, base):
            who.setdefault(key, commit)
    for key, text in net:
        bad.append(f"{who.get(key, UNKNOWN)} が本体に直に足した：{text}")
    return bad


def ledger_now(root: Path) -> int:
    """今作っている葉（台帳の tickets）の枝が、本線との分かれ目から足した物を entries に書く"""
    path = root / LEDGER
    data = json.loads(path.read_text(encoding="utf-8"))
    entries: set[str] = set()
    for t in data["tickets"]:
        ref = f"t/{t}"
        if not git(root, "rev-parse", "--verify", "--quiet", ref, check=False).strip():
            continue
        base = git(root, "merge-base", ref, MAINLINE).strip()
        entries.update(key for _, key, _ in scan(root, base, ref))
    data["entries"] = sorted(entries)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"本体への直の足し：猶予 {len(entries)} 個を書いた（葉 {len(data['tickets'])} 本）")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base-ref", default="")
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--ledger-now", action="store_true")
    a = ap.parse_args()
    if a.ledger_now:
        return ledger_now(Path(a.root))
    try:
        bad = check(Path(a.root), a.base_ref)
    except RuntimeError as e:
        bad = [str(e)]
    for b in bad:
        print(f"本体への直の足し：{b}")
    if bad:
        print(f"本体への直の足し：赤 {len(bad)} 件（決まりは scripts/ci/body_append_gate.py の頭）")
        return 1
    print("本体への直の足し：無い（緑）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
