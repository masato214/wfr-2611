#!/usr/bin/env python3
"""画面のクラスが CSS に在るか・外枠の決まりを本文で使っていないか・新しい層に CSS の外の見た目を書いていないか（K-214）。

  python3 scripts/ci/class_gate.py --ledger-base-ref <本線との分かれ目>   台帳は分かれ目の台帳より増やせない
  python3 scripts/ci/class_gate.py --no-base                              分かれ目と比べない（手元で流すとき。明示しないと赤）
  python3 scripts/ci/class_gate.py --selftest                             作りものの木で赤を 1 つずつ起こす
  そのほか：--root <根>（既定はこの台本の置き場の 2 つ上）・--ledger <台帳>・--tickets <11_tickets>

見るもの（apps/web の .tsx と .css。node_modules・.next は読まない。CSS の定義はセレクタの部分の .名前 だけ。注釈・文字・:not(…)・値の中は数えない。
  定義に数える .css は、.ts・.tsx の import "…css"（./・../・@/）と、そこから @import で辿れる物だけ）：
  ・className="…"・className={…} の中の文字（"…"・'…'・`…` の静的な部分。cn() の引数も同じ）・classNames={{ 鍵: "…" }} の値
  ・undefined   どの層でも：頭が k と数字の後に - の名前（k-・k62-）が、どの .css にも .名前 で無い
  ・shell       外枠の名前（components/k/shell.css に在って、部品の CSS＝components/k のほかの .css に無い k の名前）を components/k の外で使う・
                components/k の外の .css が定義する（別の CSS に書いて抜けさせない。その .css の行で出す）
  ・built       `k-btn-${v}` のように名前を組み立てていて確かめられない（どの層でも k の名前。新しい層はどの名前でも）
  ・unresolved  新しい層で、値になる位置（三項の枝・?? と || の両側・&& の右・${} の中・cn の引数）が字・受け取った className・空のどれでもない
                （変数・呼び出し・as・join・...xs・計算した鍵など。読めない書き方は赤に倒す）。&& の左と三項の条件は見ない。cn({ 鍵: 条件 }) の鍵は字として判定
  ・foreign     新しい層で、CSS に在る k の名前でも sr-only でもない字（tailwind の字・[ を含む任意の値）
  ・style       新しい層の style={…}
  新しい層＝apps/web/features・apps/web/components/k。前の世代（components/ai など・D-128.78 で外す側）と app/ は foreign・style・unresolved を見ない

台帳 scripts/ci/class_ledger.json（{"_doc", "entries": [{kind, cls, file, owner, reason}]}・鍵は (kind, cls, file)）：
  今ある赤は台帳に載せて通す。台帳は減らすだけ（K-143 の結果の台帳と同じ形・D-129.51）。赤になるもの：
  台帳に無い赤／赤の無い台帳の行（台帳から消す）／分かれ目の台帳に無い行／入れた時点の行の数を超えた／同じ行が 2 つ／
  持ち主のチケットが 11_tickets に無い・理由が空／比べる版が読めない／比べ方の指定が無い
由来：段 1 の 4 画面が CSS に定義の無いクラスを使い、作る画面が外枠の .k-panel を本文の箱に流用していた（調べの H2・H3）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_ROOT = HERE.parent.parent
LEDGER_REL = "scripts/ci/class_ledger.json"
LEDGER_CAP = 32                      # 台帳を入れた時点の行の数（K-214）。減らすだけなので超えたら赤
WEB = "apps/web"
SKIP_DIRS = {"node_modules", ".next", ".next-prod"}
NEW_LAYERS = ("apps/web/features/", "apps/web/components/k/")
SHELL_DIR = "apps/web/components/k/"
SHELL_CSS = "apps/web/components/k/shell.css"
ALLOWED_FOREIGN = {"sr-only"}        # 画面の読み上げだけの決まり（許す一覧はこの 1 つ）
K_NAME = re.compile(r"^k\d*-")
CSS_CLASS = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.S)
CSS_STRING = re.compile(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'")
TS_CSS_IMPORT = re.compile(r"""^\s*import\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+\.css)['"]""", re.M)
CSS_IMPORT = re.compile(r"""@import\s+(?:url\(\s*)?['"]([^'"]+\.css)['"]""")
CSS_PRELUDE = re.compile(r"([^{}]*)\{")
CSS_NOT = re.compile(r":not\((?:[^()]|\([^()]*\))*\)")
ATTR = re.compile(r"\b(className|classNames|style)\s*=\s*(?=[\"'{])")
IDENT = re.compile(r"^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*$")
UNRESOLVED_SHOWN = 60   # 読めない式を台帳の名前にするときの字数
KINDS = ("undefined", "shell", "built", "unresolved", "foreign", "style")


# ---------------------------------------------------------------- ファイルを集める
def _files(root: Path, suffix: str) -> list[Path]:
    out: list[Path] = []
    for d, dirs, names in os.walk(root / WEB):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        out += [Path(d) / n for n in sorted(names) if n.endswith(suffix)]
    return out


def _blank(m: re.Match) -> str:
    """消した所を同じ長さの空白にする（改行は残す。行の番号を変えない）"""
    return re.sub(r"[^\n]", " ", m.group(0))


def css_selector_defs(text: str):
    """CSS の定義：セレクタの部分（{ より前）の .名前 だけ。注釈・文字・:not(…) の中・値の中は数えない。(名前, 位置)"""
    text = CSS_STRING.sub(_blank, CSS_COMMENT.sub(_blank, text))
    for m in CSS_PRELUDE.finditer(text):
        start = m.start(1) + m.group(1).rfind(";") + 1   # 入れ子の書き方で、前の宣言の後ろだけ
        pre = text[start:m.end(1)]
        if pre.lstrip().startswith("@"):
            continue
        pre = CSS_NOT.sub(_blank, pre)
        for c in CSS_CLASS.finditer(pre):
            yield c.group(1), start + c.start()


def _resolve(root: Path, frm: Path, spec: str) -> Path | None:
    """import の行き先。./・../ は読む側からの道、@/ は apps/web。外の部品（node_modules）は辿らない"""
    if spec.startswith("@/"):
        return (root / WEB / spec[2:]).resolve()
    if spec.startswith("."):
        return (frm.parent / spec).resolve()
    return None


def loaded_css(root: Path) -> set[Path]:
    """読み込まれた .css：.ts・.tsx の import "…css" と、そこから @import で辿れる物"""
    todo = [q for f in _files(root, ".ts") + _files(root, ".tsx")
            for spec in TS_CSS_IMPORT.findall(f.read_text(encoding="utf-8"))
            if (q := _resolve(root, f, spec)) is not None]
    seen: set[Path] = set()
    while todo:
        q = todo.pop()
        if q in seen or not q.is_file():
            continue
        seen.add(q)
        text = CSS_COMMENT.sub("", q.read_text(encoding="utf-8"))
        todo += [r for spec in CSS_IMPORT.findall(text) if (r := _resolve(root, q, spec if spec.startswith(("@/", ".")) else "./" + spec)) is not None]
    return seen


def css_defs(root: Path, only: set[Path] | None = None) -> dict[str, dict[str, int]]:
    """名前 → {定義している .css（root からの posix の道）: 最初の行}。only を渡すとその .css だけ"""
    defs: dict[str, dict[str, int]] = {}
    for p in _files(root, ".css"):
        if only is not None and p.resolve() not in only:
            continue
        rel = p.relative_to(root).as_posix()
        text = p.read_text(encoding="utf-8")
        for name, pos in css_selector_defs(text):
            defs.setdefault(name, {}).setdefault(rel, text.count("\n", 0, pos) + 1)
    return defs


def shell_names(defs: dict[str, dict[str, int]], every: dict[str, dict[str, int]] | None = None) -> set[str]:
    """外枠の名前：shell.css に在って、読み込まれた部品の CSS（components/k の shell.css 以外の .css）に無い k の名前"""
    every = defs if every is None else every
    return {n for n, where in every.items() if K_NAME.match(n) and SHELL_CSS in where
            and not any(f.startswith(SHELL_DIR) and f != SHELL_CSS for f in defs.get(n, {}))}


# ---------------------------------------------------------------- 式を読む（文字・テンプレート・入れ子の括弧）
def _skip_quote(s: str, i: int) -> int:
    """s[i] が " か ' のとき、閉じた後の位置"""
    q, i = s[i], i + 1
    while i < len(s) and s[i] != q:
        i += 2 if s[i] == "\\" else 1
    return i + 1


def _skip_template(s: str, i: int) -> int:
    i += 1
    while i < len(s) and s[i] != "`":
        if s[i] == "\\":
            i += 2
        elif s.startswith("${", i):
            i = _skip_braces(s, i + 1)
        else:
            i += 1
    return i + 1


def _skip_braces(s: str, i: int) -> int:
    """s[i] が { のとき、対応する } の後の位置"""
    depth = 0
    while i < len(s):
        c = s[i]
        if c in "\"'":
            i = _skip_quote(s, i)
            continue
        if c == "`":
            i = _skip_template(s, i)
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return i


def _tokens(chunk: str, base: int, glued_left: bool, glued_right: bool):
    """静的な字の塊を空白で分ける。(名前, 位置, 組み立ての途中か)"""
    toks = [(m.group(0), base + m.start(), m.start(), m.end()) for m in re.finditer(r"\S+", chunk)]
    for n, (t, pos, a, b) in enumerate(toks):
        built = (glued_left and n == 0 and a == 0) or (glued_right and n == len(toks) - 1 and b == len(chunk))
        yield t, pos, built


def strings_in(s: str, base: int = 0):
    """式 s の中の文字の名前を全部。(名前, 位置, 組み立ての途中か)"""
    i = 0
    while i < len(s):
        c = s[i]
        if c in "\"'":
            end = _skip_quote(s, i)
            yield from _tokens(s[i + 1:end - 1], base + i + 1, False, False)
            i = end
        elif c == "`":
            i = yield from _template(s, i, base)
        else:
            i += 1


def _template(s: str, i: int, base: int):
    j, start, after_interp = i + 1, i + 1, False
    while j < len(s) and s[j] != "`":
        if s[j] == "\\":
            j += 2
        elif s.startswith("${", j):
            yield from _tokens(s[start:j], base + start, after_interp, True)
            end = _skip_braces(s, j + 1)
            yield from strings_in(s[j + 2:end - 1], base + j + 2)
            j = start = end
            after_interp = True
        else:
            j += 1
    yield from _tokens(s[start:j], base + start, after_interp, False)
    return j + 1


def _top_args(s: str) -> list[str]:
    """cn( … ) の中を、いちばん外の , で分ける"""
    out, depth, cur, i = [], 0, 0, 0
    while i < len(s):
        c = s[i]
        if c in "\"'":
            i = _skip_quote(s, i)
            continue
        if c == "`":
            i = _skip_template(s, i)
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            out.append(s[cur:i])
            cur = i + 1
        i += 1
    return out + [s[cur:]]


def _top(s: str):
    """いちばん外（括弧・文字・テンプレートの外）の位置を順に"""
    depth, i = 0, 0
    while i < len(s):
        c = s[i]
        if c in "\"'":
            i = _skip_quote(s, i)
            continue
        if c == "`":
            i = _skip_template(s, i)
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif depth == 0:
            yield i
        i += 1


def _match_close(s: str, i: int) -> int:
    """s[i] が ( か [ か { のとき、対応する閉じの位置"""
    depth, k = 0, i
    while k < len(s):
        c = s[k]
        if c in "\"'":
            k = _skip_quote(s, k)
            continue
        if c == "`":
            k = _skip_template(s, k)
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0:
                return k
        k += 1
    return -1


def _ternary(s: str) -> tuple[str, str, str] | None:
    q = None
    nest = 0
    for i in _top(s):
        c = s[i]
        if c == "?" and q is None:
            if s[i + 1:i + 2] in ("?", ".") or s[i - 1:i] == "?":
                continue
            q = i
        elif q is not None and c == "?" and s[i + 1:i + 2] not in ("?", ".") and s[i - 1:i] != "?":
            nest += 1
        elif q is not None and c == ":":
            if nest:
                nest -= 1
            else:
                return s[:q], s[q + 1:i], s[i + 1:]
    return None


def _split(s: str, ops: tuple[str, ...]) -> list[str]:
    out, cur = [], 0
    skip = -1
    for i in _top(s):
        if i < skip:
            continue
        for op in ops:
            if s.startswith(op, i) and not (op == "??" and s.startswith("??=", i)):
                out.append(s[cur:i])
                cur = skip = i + len(op)
                break
    return out + [s[cur:]] if out else [s]


def _whole(s: str, open_i: int) -> bool:
    """s[open_i] の括弧が s の最後で閉じるか"""
    return _match_close(s, open_i) == len(s) - 1


def _template_holes(s: str):
    """`…` の中の ${} のうち、名前にくっついていない物の中身（くっついた物は built で出る）"""
    j = 1
    while j < len(s) - 1:
        if s[j] == "\\":
            j += 2
        elif s.startswith("${", j):
            end = _skip_braces(s, j + 1)
            glued = (j > 1 and not s[j - 1].isspace()) or (end < len(s) - 1 and not s[end].isspace())
            if not glued:
                yield s[j + 2:end - 1]
            j = end
        else:
            j += 1


EMPTY = {"undefined", "null", "false", "true", "''", '""', "``"}


def _object_keys(body: str, base: int, unres: list[str], keys: list[tuple[str, int]]) -> None:
    """cn({ … }) の鍵：引用符の無い鍵は字として、計算した鍵・広げる書き方は読めない（値は条件なので見ない）"""
    for part in _top_args(body):
        off = base + len(part) - len(part.lstrip())
        p = part.strip()
        if not p:
            continue
        if p.startswith("...") or p.startswith("["):
            unres.append(p.split(":", 1)[0].strip() if p.startswith("[") else p)
            continue
        colon = next((i for i in _top(p) if p[i] == ":"), None)
        k = (p[:colon] if colon is not None else p).strip()
        if re.fullmatch(r"[A-Za-z_$][\w$-]*", k):
            keys.append((k, off))


def values(s: str, base: int, unres: list[str], keys: list[tuple[str, int]]) -> None:
    """新しい層の className={…} の値になる位置を辿る。読めない物は unres に、オブジェクトの鍵は keys に"""
    lead = len(s) - len(s.lstrip())
    s, base = s.strip(), base + lead
    while s.startswith("(") and _whole(s, 0):
        inner = s[1:-1]
        base += 1 + len(inner) - len(inner.lstrip())
        s = inner.strip()
    if not s or s in EMPTY or re.fullmatch(r"-?\d+(\.\d+)?", s):
        return
    if s[0] in "\"'" and _skip_quote(s, 0) == len(s):
        return
    if s[0] == "`" and _skip_template(s, 0) == len(s):
        for hole in _template_holes(s):
            values(hole, base, unres, keys)
        return
    t = _ternary(s)
    if t:
        values(t[1], base, unres, keys)
        values(t[2], base, unres, keys)
        return
    parts = _split(s, ("||", "??"))
    if len(parts) > 1:
        for x in parts:
            values(x, base, unres, keys)
        return
    parts = _split(s, ("&&",))
    if len(parts) > 1:
        values(parts[-1], base, unres, keys)   # && の左は条件なので見ない
        return
    m = re.match(r"(?:cn|clsx|cx|classnames|classNames)\s*\(", s)
    if m and _whole(s, m.end() - 1):
        inner = s[m.end():-1]
        for a in _top_args(inner):
            a_strip = a.strip()
            if a_strip.startswith("..."):
                unres.append(a_strip)
            elif a_strip.startswith("{") and _whole(a_strip, 0):
                _object_keys(a_strip[1:-1], base, unres, keys)
            else:
                values(a, base, unres, keys)
        return
    if s.startswith("{") and _whole(s, 0):
        _object_keys(s[1:-1], base, unres, keys)
        return
    if IDENT.match(s):
        if s.split(".")[-1] != "className":   # 受け取った className は呼んだ側で確かめる
            unres.append(s)
        return
    unres.append(re.sub(r"\s+", " ", s)[:UNRESOLVED_SHOWN])


# ---------------------------------------------------------------- 1 つのファイルを見る
def scan_file(text: str, rel: str, defs: dict[str, dict[str, int]], shell: set[str] | None = None) -> list[dict]:
    new = rel.startswith(NEW_LAYERS)
    in_k = rel.startswith(SHELL_DIR)
    shell = shell_names(defs) if shell is None else shell
    line_of = lambda pos: text.count("\n", 0, pos) + 1  # noqa: E731
    out: list[dict] = []
    add = lambda kind, cls, pos: out.append({"kind": kind, "cls": cls, "file": rel, "line": line_of(pos)})  # noqa: E731
    for m in ATTR.finditer(text):
        attr, i = m.group(1), m.end()
        if attr == "style":
            if new and text[i] == "{":
                add("style", "style", m.start())
            continue
        if text[i] == "{":
            end = _skip_braces(text, i)
            expr, base = text[i + 1:end - 1], i + 1
            if new and attr == "className":
                unres: list[str] = []
                keys: list[tuple[str, int]] = []
                values(expr, base, unres, keys)
                for v in unres:
                    add("unresolved", v, m.start())
                for k, pos in keys:
                    _judge(k, pos, False, new, in_k, defs, shell, add)
        else:
            end = _skip_quote(text, i)
            expr, base = text[i:end], i
        for tok, pos, built in strings_in(expr, base):
            _judge(tok, pos, built, new, in_k, defs, shell, add)
    return out


def _judge(tok: str, pos: int, built: bool, new: bool, in_k: bool, defs: dict[str, dict[str, int]], shell: set[str], add) -> None:
    is_k = bool(K_NAME.match(tok))
    if built:
        if is_k or new:
            add("built", tok, pos)
        return
    where = defs.get(tok)
    if is_k and not where:
        add("undefined", tok, pos)
    elif tok in shell and not in_k:
        add("shell", tok, pos)
    elif new and not is_k and tok not in ALLOWED_FOREIGN:
        add("foreign", tok, pos)


def scan(root: Path) -> list[dict]:
    """木の赤の全部。各要素は kind・cls・file（root からの posix の道）・line"""
    root = Path(root)
    every = css_defs(root)                       # 外枠の名前を外の .css が定義するのは、読み込まれていなくても赤
    defs = css_defs(root, loaded_css(root))      # 在る・無いは読み込まれた .css だけで決める（import を忘れた .css で通さない）
    shell = shell_names(defs, every)
    out: list[dict] = [{"kind": "shell", "cls": n, "file": f, "line": line}
                       for n in sorted(shell) for f, line in sorted(every[n].items()) if not f.startswith(SHELL_DIR)]
    for p in _files(root, ".tsx"):
        out += scan_file(p.read_text(encoding="utf-8"), p.relative_to(root).as_posix(), defs, shell)
    return out


# ---------------------------------------------------------------- 台帳と比べる
def key(e: dict) -> tuple[str, str, str]:
    return (e["kind"], e["cls"], e["file"])


def ledger_problems(findings: list[dict], entries: list[dict], tickets: Path) -> list[str]:
    bad: list[str] = []
    keys = [key(e) for e in entries]
    if len(entries) > LEDGER_CAP:
        bad.append(f"台帳の行が {len(entries)} 行で、入れた時点の {LEDGER_CAP} 行を超えた（台帳は減らすだけ）")
    bad += [f"台帳に同じ行が 2 つ以上：{k}" for k in sorted({k for k in keys if keys.count(k) > 1})]
    for e in entries:
        if e.get("kind") not in KINDS:
            bad.append(f"台帳の行の種類が知らない物：{key(e)}")
        owner = str(e.get("owner") or "")
        if not re.fullmatch(r"K-\d+", owner) or not (tickets / f"{owner}.md").is_file():
            bad.append(f"台帳の行の持ち主 {owner or '（空）'} が 11_tickets に無い：{key(e)}")
        if not str(e.get("reason") or "").strip():
            bad.append(f"台帳の行の理由が空：{key(e)}")
    led = set(keys)
    for f in findings:
        if key(f) not in led:
            bad.append(f"{f['kind']} {f['cls']}  {f['file']}:{f['line']}（台帳に無い赤。直す）")
    found = {key(f) for f in findings}
    bad += [f"台帳から消す（もう赤でない）：{k[0]} {k[1]}  {k[2]}" for k in sorted(led - found)]
    return bad


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=False)
    except OSError as e:
        return subprocess.CompletedProcess(["git", *args], 1, "", str(e))


def base_problems(root: Path, ledger_path: Path, ref: str, entries: list[dict]) -> tuple[list[str], str]:
    """分かれ目の台帳に無い行。返り値：(問題, 知らせ)"""
    if not ref or _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return [f"比べる版 {ref or '（空）'} が読めない"], ""
    try:
        rel = ledger_path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return [f"台帳 {ledger_path} が根 {root} の外にある（分かれ目の版と比べられない）"], ""
    r = _git(root, "show", f"{ref}:./{rel}")
    if r.returncode != 0:
        return [], f"分かれ目 {ref[:12]} に台帳が無い（台帳を入れる回。行の数は {LEDGER_CAP} 行までで止める）"
    try:
        base = {key(e) for e in json.loads(r.stdout)["entries"]}
    except (ValueError, KeyError, TypeError) as e:
        return [f"分かれ目の台帳が読めない（{e}）"], ""
    return [f"分かれ目の台帳に無い行（台帳に足して通さない）：{k[0]} {k[1]}  {k[2]}"
            for k in sorted({key(e) for e in entries} - base)], ""


def run(root: Path, ledger_path: Path, tickets: Path, base_ref: str | None, no_base: bool) -> int:
    if not no_base and base_ref is None:
        print("class_gate：--ledger-base-ref <版> か --no-base が要る（黙って比べずに緑にしない）")
        return 1
    try:
        entries = json.loads(ledger_path.read_text(encoding="utf-8"))["entries"]
        if not isinstance(entries, list):
            raise TypeError("entries が並びでない")
    except (OSError, ValueError, KeyError, TypeError) as e:
        print(f"class_gate：台帳 {ledger_path} が読めない（{e}）")
        return 1
    findings = scan(root)
    bad = ledger_problems(findings, entries, tickets)
    note = ""
    if not no_base:
        more, note = base_problems(root, ledger_path, base_ref or "", entries)
        bad += more
    if note:
        print(f"class_gate：{note}")
    if bad:
        print(f"class_gate：赤 {len(bad)}")
        for b in bad:
            print(f"  ✗ {b}")
        return 1
    print(f"class_gate：緑（台帳で通した {len({key(f) for f in findings})}・見た .tsx {len(_files(root, '.tsx'))}）")
    return 0


# ---------------------------------------------------------------- 自己試験
def selftest() -> int:
    cases = [
        ("undefined", 'export const P = () => <p className="k-a k-zzz" />;\n'),
        ("shell", 'export const P = () => <p className="k-panel" />;\n'),
        ("built", "export const P = ({v}) => <p className={`k-btn-${v}`} />;\n"),
        ("unresolved", "export const P = ({c}) => <p className={c} />;\n"),
        ("foreign", 'export const P = () => <p className="text-[13px]" />;\n'),
        ("style", "export const P = () => <p style={{ gap: 0 }} />;\n"),
    ]
    tmp = Path(tempfile.mkdtemp(prefix="class-gate-"))
    try:
        for rel, body in (("apps/web/components/k/k.css", ".k-a { gap: 0; }\n"),
                          ("apps/web/components/k/shell.css", ".k-panel { gap: 0; }\n"),
                          ("apps/web/app/layout.tsx", 'import "../components/k/k.css";\nimport "../components/k/shell.css";\n'),
                          ("11_tickets/K-1.md", "---\nid: K-1\n---\n")):
            (tmp / rel).parent.mkdir(parents=True, exist_ok=True)
            (tmp / rel).write_text(body, encoding="utf-8")
        page = tmp / "apps/web/features/F0/x/page.tsx"
        page.parent.mkdir(parents=True, exist_ok=True)
        ledger = tmp / LEDGER_REL
        ledger.parent.mkdir(parents=True, exist_ok=True)
        ng = 0
        for kind, body in cases:
            page.write_text(body, encoding="utf-8")
            got = {f["kind"] for f in scan(tmp)}
            ledger.write_text(json.dumps({"entries": []}), encoding="utf-8")
            red = run(tmp, ledger, tmp / "11_tickets", None, True) == 1
            ok = got == {kind} and red
            ng += not ok
            print(f"  {'OK' if ok else 'NG'} {kind}：見つけた {sorted(got)}・台帳が空で赤 {red}")
        page.write_text('export const P = () => <p className="k-a sr-only" />;\n', encoding="utf-8")
        green = run(tmp, ledger, tmp / "11_tickets", None, True) == 0
        nobase = run(tmp, ledger, tmp / "11_tickets", None, False) == 1
        ng += not (green and nobase)
        print(f"  {'OK' if green and nobase else 'NG'} 赤の無い木は緑 {green}・比べ方の指定が無いと赤 {nobase}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"class_gate --selftest：{'緑' if ng == 0 else f'赤 {ng}'}")
    return 1 if ng else 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    ap.add_argument("--ledger", type=Path, default=None)
    ap.add_argument("--tickets", type=Path, default=None)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--ledger-base-ref", default=None)
    g.add_argument("--no-base", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    root = a.root.resolve()
    return run(root, a.ledger or root / LEDGER_REL, a.tickets or root / "11_tickets", a.ledger_base_ref, a.no_base)


if __name__ == "__main__":
    sys.exit(main())
