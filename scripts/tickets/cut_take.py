#!/usr/bin/env python3
"""切る段の枝から、1 本のチケットの分だけを今の作業場所に持ち込む（K-187）。

  python3 scripts/tickets/cut_take.py <ID> <切る段の枝>      （作業場所で。ticket-flow の flow.py start --cut が設定 cut.take から呼ぶ）

チケットと試験は大分類ごとに 1 つの枝でまとめて切る（2026-11-13・決める人）。実装の段はその枝から 1 本の分だけを持ち込み、実装から始める。
  ① チケットの md と tests: の試験（生成の試験を除く）を写す
  ② 頭の欄 carry: に書いたファイルをそのまま写す
  ③ 印つきの共有の試験（SHARED）：まだ本線に入っていないほかのチケットの印の行（行の末尾の `// K-xxx`）と範囲（`// K-xxx ここから`〜`ここまで`）を外して写す
  ④ 07_qa/test-plan/ears-elsewhere.json：指す試験のファイルが無い covers と、本線に無くて試験のファイルも無い口の塊を外して写す
     （07_qa/test-plan/ears-elsewhere.d/ のあるリポジトリでは生成物なので足し合わせない。carry: の断片から作り手が作る・K-325）
  ⑤ 作り手を流す（チケットの一覧・生成の試験・テスト計画・要件一覧・目録）。生成物は写さない
切る段の枝が本線より古くても、本線に後から入った分を消さない：共有の試験と carry: のファイルは、分かれ目の版を元に 3 方向で合わせる
（ぶつかったら止める → 切る段の枝に本線を取り込んでからやり直す）。ears-elsewhere.json は本線の口と covers を残し、切る段の分を足す。
「本線に入ったチケット」は、作業場所の今の枝の履歴に、件名が「<番号> 」で始まるコミットがあるチケット。
足りない物・閉じていない印・ぶつかりがあれば、何も置かずに理由を出して止まる（作り手が落ちたときは、置いた後に止まる）。コミットは呼んだ側（ticket-flow）がする。
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile
from collections import Counter

SHARED = ["apps/api/test/features/contract/k144-contract.test.ts"]
EARS = "07_qa/test-plan/ears-elsewhere.json"
EARS_D = "07_qa/test-plan/ears-elsewhere.d"   # K-325：在れば ears-elsewhere.json は断片から作る生成物（carry: の断片をそのまま写す）
TICKETS = "11_tickets"
GENERATORS = [
    "python3 scripts/tickets/build_index.py",
    "python3 scripts/ci/build_registries.py",   # K-325：写した断片から表の生成物を作ってから生成の試験を作る（.d/ の無いリポジトリでは流さない）
    "node scripts/ci/gen_ears_tests.mjs",
    "python3 05_flow/build_testplan.py",
    "python3 scripts/ci/build_catalog.py",
    "python3 scripts/ci/trace_gate.py --index",
]
MARK = re.compile(r"//\s*([A-Z]+-\d+)\s*(ここから|ここまで)?\s*(?:$|[（：(])")


def _git(repo: pathlib.Path, *a: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), "-c", "core.quotepath=off", *a], capture_output=True, text=True, encoding="utf-8")


def _show(repo: pathlib.Path, ref: str, path: str) -> str | None:
    r = _git(repo, "show", f"{ref}:{path}")
    return r.stdout if r.returncode == 0 else None


def header_list(md: str, key: str) -> list[str]:
    """頭の欄の 1 行の並び `key: [a, b]`。欄があるのにこの形で読めなければ止める（何も持ち込まずに成功しない）"""
    head = md.split("\n---", 1)[0]
    if not re.search(rf"^{re.escape(key)}:", head, re.M):
        return []
    m = re.search(rf"^{re.escape(key)}:\s*\[(.*?)\]\s*$", head, re.M)
    if not m:
        raise SystemExit(f"止めた — チケットの頭の欄 {key}: を読めない（1 行の `{key}: [a, b]` の形で書く）")
    return [x.strip() for x in m.group(1).split(",") if x.strip()]


def merged_tickets(repo: pathlib.Path) -> set[str]:
    """本線（今の枝の履歴）に入ったチケット：件名が「<番号> 」で始まるコミットがある"""
    return set(re.findall(r"^([A-Z]+-\d+)\s", _git(repo, "log", "--format=%s").stdout, re.M))


def filter_marks(text: str, keep: set[str]) -> str:
    """印の行と範囲のうち、keep に無いチケットのものを外す"""
    out: list[str] = []
    skipping: str | None = None
    start = 0
    for no, line in enumerate(text.split("\n"), 1):
        m = MARK.search(line)
        if skipping:
            if m and m.group(1) == skipping and m.group(2) == "ここまで":
                skipping = None
            continue
        if m and m.group(1) not in keep:
            if m.group(2) == "ここから":
                skipping, start = m.group(1), no
            continue
        out.append(line)
    if skipping:
        raise SystemExit(f"止めた — 印の範囲が閉じていない：// {skipping} ここから（{start} 行目）に対する ここまで が無い")
    return "\n".join(out)


def filter_ears(cut: dict, base: dict, text_of) -> dict:
    """本線の口と covers はそのまま残す。切る段の分は、指す試験のファイルがあり、その中に印（題）がある covers と、試験のファイルがある口だけを足す。
    text_of(path) は置く中身（無ければ None）。生成の試験は「指す先に印がある」を確かめるので、印の無い covers を残すと赤になる"""
    ops = {k: {**v, "covers": dict(v.get("covers") or {})} for k, v in base.get("ops", {}).items()}
    for op, o in cut.get("ops", {}).items():
        if op not in ops and text_of(o["file"]) is None:
            continue
        cur = ops.setdefault(op, {**o, "covers": {}})
        for k, v in (o.get("covers") or {}).items():
            body = text_of(v["file"] if isinstance(v, dict) else o["file"])
            mark = v["mark"] if isinstance(v, dict) else v
            if k not in cur["covers"] and body is not None and str(mark) in body:
                cur["covers"][k] = v
    return {**cut, **{k: v for k, v in base.items() if k != "ops"}, "ops": ops}


def merge3(path: str, base: str | None, ours: str | None, theirs: str) -> str:
    """分かれ目の版（base）を元に、本線の版（ours）と切る段の版（theirs）を合わせる。ぶつかったら止める"""
    if ours is None or ours == base or ours == theirs:
        return theirs
    if base is None or theirs == base:
        if base is None and ours != theirs:
            raise SystemExit(f"止めた — {path} が本線と切る段の両方で新しく作られていて合わせられない（切る段の枝に本線を取り込んでからやり直す）")
        return ours
    with tempfile.TemporaryDirectory() as d:
        t = pathlib.Path(d)
        for n, body in (("o", ours), ("b", base), ("t", theirs)):
            (t / n).write_text(body, encoding="utf-8")
        r = subprocess.run(["git", "merge-file", "-p", str(t / "o"), str(t / "b"), str(t / "t")], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise SystemExit(f"止めた — {path} が本線の後からの変更とぶつかる（切る段の枝に本線を取り込んでからやり直す）")
    return r.stdout


def merge_own_only(path: str, fork_body: str | None, ours: str, theirs: str, own_free: str) -> str:
    """分かれ目を元にするとぶつかるとき（分かれ目の後に本線へ入った別のチケット＝重ねた元の行のすぐ下に、自分の行を足す・K-581・K-1115）：
    元の版を「切る段の版から自分の印を外した物」にして、自分の行だけを本線の版に足す（2 回目もぶつかれば merge3 が止める）。
    theirs はまだのチケットの印と範囲を外した後の版なので、外した範囲の中身は数えない。
    切る段で足した印の無い行が本線の版に無ければ、それを落とすことになるので止める。同じ字面の行（`});` など）を見落とさないよう、
    行ごとの数で比べる：切る段の版での数が、分かれ目の数と合わせた結果の数の大きい方を超える行を「落ちた」とする（空行は数えない）"""
    out = merge3(path, own_free, ours, theirs)
    before = Counter((fork_body or "").split("\n"))
    have = Counter(out.split("\n"))
    lost = [ln for ln, n in Counter(theirs.split("\n")).items()
            if ln.strip() and not MARK.search(ln) and n > max(before[ln], have[ln])]
    if lost:
        raise SystemExit(f"止めた — {path} が本線の後からの変更とぶつかる（切る段で足した印の無い行が本線に無い：{lost[0]}）")
    return out


def take(repo: pathlib.Path, tid: str, ref: str, shared: list[str] | None = None, regenerate: bool = True) -> list[str]:
    shared = SHARED if shared is None else shared
    if not re.fullmatch(r"[A-Z]+-\d+", tid) or ref.startswith("-") or not ref.strip():
        raise SystemExit(f"止めた — チケットの番号か枝の名前の形が違う：{tid} {ref}")
    md_path = f"{TICKETS}/{tid}.md"
    md = _show(repo, ref, md_path)
    if md is None:
        raise SystemExit(f"止めた — 切る段の枝 {ref} に {md_path} が無い（先に切る段で {tid} を切る）")
    fork = _git(repo, "merge-base", "HEAD", ref).stdout.strip()   # 切る段の枝と今の枝の分かれ目
    def both(path: str, theirs: str) -> str:
        return merge3(path, _show(repo, fork, path) if fork else None, _show(repo, "HEAD", path), theirs)

    files: dict[str, str] = {md_path: md}
    for f in [t for t in header_list(md, "tests") if "/generated/" not in t]:
        body = _show(repo, ref, f)
        if body is None:
            raise SystemExit(f"止めた — 切る段の枝 {ref} に {f} が無い（{tid} の tests: に書いてある）")
        files[f] = both(f, body)   # 本線に後から入った変更を消さない
    for f in header_list(md, "carry"):
        body = _show(repo, ref, f)
        if body is None:
            raise SystemExit(f"止めた — 切る段の枝 {ref} に {f} が無い（{tid} の carry: に書いてある）")
        files[f] = both(f, body)
    keep = merged_tickets(repo) | {tid}
    for f in shared:
        body = _show(repo, ref, f)
        if body is not None:
            fork_body = _show(repo, fork, f) if fork else None
            ours = _show(repo, "HEAD", f)
            theirs = filter_marks(body, keep)
            # 印の無い行は分かれ目から変わらない前提。切る段の版から、まだのチケットの印を外したものを本線の版と合わせる
            try:
                files[f] = merge3(f, filter_marks(fork_body, keep) if fork_body is not None else None, ours, theirs)
            except SystemExit:
                files[f] = merge_own_only(f, fork_body, ours, theirs, filter_marks(body, keep - {tid}))
    # .d/ のあるリポジトリでは ears-elsewhere.json は生成物：3 つの版の足し合わせをせず、carry: の断片から作り手が作る（K-325）
    ears = None if (repo / EARS_D).is_dir() else _show(repo, ref, EARS)
    if ears is not None:
        base = _show(repo, "HEAD", EARS)
        def text_of(path: str) -> str | None:
            if path in files:
                return files[path]
            f = repo / path
            return f.read_text(encoding="utf-8", errors="replace") if f.is_file() else None

        files[EARS] = json.dumps(filter_ears(json.loads(ears), json.loads(base) if base else {}, text_of), ensure_ascii=False, indent=1) + "\n"
    for f, body in files.items():   # ここまで何も置いていない（足りなければ上で止まる）
        p = repo / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
    if regenerate:
        for cmd in GENERATORS:
            if "build_registries.py" in cmd and not (repo / EARS_D).is_dir():
                continue
            r = subprocess.run(cmd, shell=True, cwd=repo, capture_output=True, text=True)
            if r.returncode != 0:
                raise SystemExit(f"止めた — 作り手が落ちた：{cmd}\n{(r.stdout + r.stderr)[-600:]}")
    return sorted(files)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    repo = pathlib.Path(_git(pathlib.Path("."), "rev-parse", "--show-toplevel").stdout.strip() or ".")
    files = take(repo, sys.argv[1], sys.argv[2])
    print(f"{sys.argv[1]}：切る段 {sys.argv[2]} から {len(files)} ファイルを持ち込んだ（生成物は作り直した）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
