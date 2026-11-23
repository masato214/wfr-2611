#!/usr/bin/env python3
"""D8 生の長さ：画面の CSS に、トークン（var(--…)）を通らない生の長さが無いか（K-261）。design_gate.py が読む。

由来：D1〜D7 は色・字の大きさ・書体・角丸・部品の値しか見ず、画面の CSS に生で書いた大きさ・余白・行の高さ・影
（padding: 10px 12px・gap: 6px・max-width: 720px・line-height: 1.9・box-shadow: 0 8px 24px …）を通した。
画面のチケットが 7 本続けてレビューで差し戻しになった。

決まりはどれもプロジェクトの design-gate.json の raw_lengths から読む（プロジェクトの名前・道を決め打ちしない）：
  paths        見る置き場（設定ファイルの在る所からの道。フォルダなら下の .css を全部。node_modules・.next などは読まない）
  token_css    トークンの定義元（ここで定義された名前を var で読むのがトークン。ここの宣言は見ない）
  token_prefix トークンの頭（例 --k-）。この頭で token_css に無い名前を読むと赤（打ち間違いは予備の値に黙って倒れる）
  allow        許す値（{"value", "reason"}・理由の無い許しは赤）。"0" はどの単位の零にも当たる
  ledger       台帳（{"_doc", "entries": [{file, selector, prop, value, count, reason}]}）。減らすだけ
  other_checks 別の段が比べる値（既定：font-size の px は D4・border-radius の px は D3）。それ以外の単位は D8 が見る

赤になるもの：宣言（素の規則・@media などの中・入れ子の中のどれでも）の値に、
  ・数と長さの単位（UNITS）が var(…) の外にある（var の予備の値の中・calc/min/max/clamp の中も見る）
  ・line-height の単位の無い数（1.9 など）
  ・トークンでない自前の変数の定義（--x: 12px）に生の長さがある・その変数を var(--x) で読む（どの性質でも）
  ・token_prefix の名前が token_css にも見る置き場の定義にも無い
見ないもの：@media・@container・@keyframes などの条件と区切り（宣言ではない）・色の関数の中・文字と url(…) の中・
  単位の無い数（line-height のほか）・どこにも定義の無い token_prefix でない名前（JS が入れる物。値は見えない）
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

UNITS = ("px", "rem", "em", "%", "vw", "vh", "vi", "vb", "vmin", "vmax", "svh", "lvh", "dvh", "svw", "lvw",
         "dvw", "svi", "lvi", "dvi", "svb", "lvb", "dvb", "svmin", "svmax", "lvmin", "lvmax", "dvmin", "dvmax",
         "ch", "ex", "cap", "ic", "lh", "rlh", "rem", "rex", "rch", "ric", "rcap",
         "cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax", "pt", "pc", "cm", "mm", "in", "q")
LEN = re.compile(r"(?<![\w#.-])(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)(" +
                 "|".join(sorted(set(UNITS), key=len, reverse=True)) + r")(?![\w-])", re.I)
BARE = re.compile(r"(?<![\w#.-])(-?(?:\d+\.?\d*|\.\d+))(?![\w%.-])")
COLOR_FN = re.compile(r"\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(", re.I)
VAR = re.compile(r"var\(\s*(--[\w-]+)\s*(,)?", re.I)
DEFAULT_OTHER = {"font-size": ["px"], "border-radius": ["px"]}
SKIP_DIRS = {"node_modules", ".next", ".next-prod", ".turbo", "dist", "build", "out", "coverage", "test-results",
             "playwright-report", ".git"}


# ---------------------------------------------------------------- CSS を宣言に分ける
def _keep_len(m: re.Match, head: str = "", tail: str = "") -> str:
    s = m.group(0)
    return head + re.sub(r"[^\n]", " ", s[len(head):len(s) - len(tail)]) + tail


def _blank(css: str) -> str:
    """文字と url(…) の中を同じ長さの空白にする（中の { ; : を数えない。行の数は変えない）"""
    css = re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", lambda m: _keep_len(m, m.group(0)[0], m.group(0)[-1]), css)
    return re.sub(r"url\((?:[^()]|\([^()]*\))*\)", lambda m: _keep_len(m, "url(", ")"), css, flags=re.I)


def declarations(css: str) -> list[tuple[str, str, str, int]]:
    """(セレクタの鎖・性質・値・行) の並び。@media などの中・入れ子の中の宣言も拾う。条件（前置き）は宣言にしない"""
    css = re.sub(r"/\*.*?\*/", _keep_len, css, flags=re.S)
    text = _blank(css)
    out: list[tuple[str, str, str, int]] = []
    stack: list[str] = []
    seg, paren = 0, 0
    for i, ch in enumerate(text):
        if ch == "(":
            paren += 1
            continue
        if ch == ")":
            paren = max(0, paren - 1)
            continue
        if paren or ch not in "{};":
            continue
        raw = text[seg:i]
        if ch == "{":
            stack.append(re.sub(r"\s+", " ", css[seg:i]).strip())
        elif ":" in raw and stack and (any(not x.startswith("@") for x in stack)
                                       or stack[-1].lower().startswith("@property")):
            k = raw.split(":", 1)[0].strip().lower()
            if re.fullmatch(r"--[\w-]+|-?[a-z][\w-]*", k):
                val = re.sub(r"\s+", " ", css[seg:i].split(":", 1)[1]).strip()
                val = re.sub(r"\s*!\s*important$", "", val, flags=re.I)
                line = css.count("\n", 0, seg + len(raw) - len(raw.lstrip())) + 1
                out.append((" >> ".join(stack), k, val, line))
        if ch == "}" and stack:
            stack.pop()
        seg = i + 1
    return out


# ---------------------------------------------------------------- 値を見る
def _drop_fns(v: str, pat: re.Pattern) -> str:
    out, i = [], 0
    for m in pat.finditer(v):
        if m.start() < i:
            continue
        out.append(v[i:m.start()])
        j, depth = m.end(), 1
        while j < len(v) and depth:
            depth += {"(": 1, ")": -1}.get(v[j], 0)
            j += 1
        i = j
    out.append(v[i:])
    return " ".join(out)


def strip_vars(v: str) -> tuple[str, list[str]]:
    """var(--名前) を外し、予備の値（, の後ろ）だけを残す。戻り：(残り, 読んだ名前)"""
    names: list[str] = []
    while True:
        m = VAR.search(v)
        if not m:
            return v, names
        names.append(m.group(1))
        j, depth = m.end(), 1
        while j < len(v) and depth:
            depth += {"(": 1, ")": -1}.get(v[j], 0)
            j += 1
        inner = v[m.end():j - 1] if m.group(2) else ""
        v = v[:m.start()] + " " + inner + " " + v[j:]


def _is_zero(tok: str) -> bool:
    m = re.match(r"-?(?:\d+\.?\d*|\.\d+)", tok)
    return bool(m) and float(m.group(0)) == 0


PURE_PX = re.compile(r"^\s*(?:-?(?:\d+\.?\d*|\.\d+)px\s*/?\s*)+$", re.I)
ONE_PX = re.compile(r"^\s*-?(?:\d+\.?\d*|\.\d+)px\s*$", re.I)


def left_to_other(prop: str, value: str, other: dict[str, list[str]]) -> bool:
    """別の段（D3・D4）がこの値をそのまま比べるか。比べるのは、値が px の字だけのとき（関数・変数・別の単位を含まない）。
    font-size は D4 が最初の px しか見ないので 1 つだけのとき"""
    units = {u.lower() for u in other.get(prop, [])}
    if units != {"px"}:
        return False
    return bool((ONE_PX if prop == "font-size" else PURE_PX).match(value))


def _clean(value: str) -> str:
    v = re.sub(r"\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|url\((?:[^()]|\([^()]*\))*\)", " ", value, flags=re.I)
    v = _drop_fns(strip_vars(v)[0], COLOR_FN)
    return re.sub(r"#[0-9a-fA-F]{3,8}\b", " ", v)


def bare_slots(prop: str, value: str) -> str:
    """単位の無い数が行の高さになる所の字（line-height は値の全部・font の略記は / の後ろの 1 つ）"""
    v = _clean(value)
    if prop == "line-height":
        return LEN.sub(" ", v)
    if prop == "font":
        m = re.search(r"/\s*(-?(?:\d+\.?\d*|\.\d+)(?![\w%.]))", v)
        return m.group(1) if m else ""
    return ""


def raw_tokens(prop: str, value: str, allow: set[str], skip_px: bool = False) -> list[str]:
    """値の中の生の長さ（許しの値を除く）。skip_px は別の段（D3・D4）がこの値を比べるときだけ真"""
    v = _clean(value)
    hits = [m.group(1) + m.group(2).lower() for m in LEN.finditer(v) if not (skip_px and m.group(2).lower() == "px")]
    hits += [m.group(1) for m in BARE.finditer(bare_slots(prop, value))]
    return [h for h in hits if not ((_is_zero(h) and "0" in allow) or h.lower() in allow)]


def bare_var_reads(prop: str, value: str) -> list[str]:
    """行の高さになる所で読む変数の名前（line-height の値の中・font の / の直後）"""
    if prop == "line-height":
        return strip_vars(value)[1]
    if prop == "font":
        return re.findall(r"/\s*var\(\s*(--[\w-]+)", value)
    return []


# ---------------------------------------------------------------- 置き場を読む
def css_files(base: Path, paths: list[str]) -> list[Path]:
    out: set[Path] = set()
    for p in paths:
        q = base / p
        if q.is_dir():
            out |= {f for f in q.rglob("*.css") if f.is_file() and not SKIP_DIRS & set(f.relative_to(base).parts)}
        elif q.is_file() and q.suffix == ".css":
            out.add(q)
    return sorted(out)


MARKUP_EXT = (".tsx", ".jsx", ".ts", ".js", ".mjs", ".cjs", ".html", ".vue", ".svelte")
ARBITRARY = re.compile(r"(?<![\w\[-])((?:[\w-]+:)*-?[\w-]*\[[^\]\s\"'`]+\](?:/[\w.\[\]]+)?)")
STYLE_ATTR = re.compile(r"\bstyle\s*=\s*(?=[{\"'])")
DOM_STYLE = re.compile(r"\.style\s*(?:\.\s*[\w$]+\s*=(?!=)|\[[^\]]+\]\s*=(?!=)|\.\s*setProperty\s*\()[^;\n]*"
                       r"|\bObject\.assign\s*\(\s*[\w$.]+\.style\b[^;\n]*"
                       r"|\.setAttribute\s*\(\s*[\"'`]style[\"'`][^;\n]*")


TEST_DIRS = {"tests", "__tests__", "e2e"}          # 試験の台本は画面ではない（画面の生の値を数えない）
TEST_FILE = re.compile(r"\.(?:spec|test)\.[cm]?[jt]sx?$")


def markup_files(base: Path, paths: list[str]) -> list[Path]:
    out: set[Path] = set()
    for p in paths:
        q = base / p
        if q.is_dir():
            out |= {f for f in q.rglob("*") if f.is_file() and f.suffix in MARKUP_EXT and not TEST_FILE.search(f.name)
                    and not (SKIP_DIRS | TEST_DIRS) & set(f.relative_to(base).parts)}
        elif q.is_file() and q.suffix in MARKUP_EXT:
            out.add(q)
    return sorted(out)


def _attr_end(text: str, i: int) -> int:
    if text[i] in "\"'":
        j = text.find(text[i], i + 1)
        return len(text) if j == -1 else j + 1
    depth, j = 0, i
    while j < len(text):
        depth += {"{": 1, "}": -1}.get(text[j], 0)
        j += 1
        if depth == 0:
            break
    return j


def markup_findings(base: Path, paths: list[str], allow: set[str]) -> list[dict]:
    """画面のコード（.tsx など）の生の長さ：Tailwind の任意値（max-w-[920px]・[padding:10px]）・style 属性（どれも）・
    DOM の style へ書く値。CSS の外で見た目を書く道を台帳で数える"""
    found: list[dict] = []
    for f in markup_files(base, paths):
        rel = f.relative_to(base).as_posix()
        text = f.read_text(encoding="utf-8", errors="replace")
        line_of = lambda pos: text.count("\n", 0, pos) + 1  # noqa: E731
        for m in ARBITRARY.finditer(text):
            inner = m.group(1)[m.group(1).index("[") + 1:m.group(1).rindex("]")].replace("_", " ")
            if raw_tokens("", inner, allow):
                found.append({"file": rel, "selector": "className", "prop": "任意値", "value": m.group(1),
                              "line": line_of(m.start()), "raw": raw_tokens("", inner, allow)})
        for m in STYLE_ATTR.finditer(text):
            end = _attr_end(text, m.end())
            body = re.sub(r"\s+", " ", text[m.end():end]).strip()
            found.append({"file": rel, "selector": "style 属性", "prop": "style", "value": body,
                          "line": line_of(m.start()), "raw": ["style={…}"]})
        for m in DOM_STYLE.finditer(text):
            found.append({"file": rel, "selector": "DOM の style", "prop": "style",
                          "value": re.sub(r"\s+", " ", m.group(0)).strip(), "line": line_of(m.start()),
                          "raw": ["DOM の style に書く所"]})
    return found


def read_conf(conf: dict, base: Path) -> tuple[dict, list[str]]:
    problems: list[str] = []
    paths, tokens = conf.get("paths") or [], conf.get("token_css") or []
    if not paths:
        problems.append("raw_lengths.paths が無い（見る置き場を書く）")
    if not tokens:
        problems.append("raw_lengths.token_css が無い（トークンの定義元を書く）")
    if not conf.get("ledger"):
        problems.append("raw_lengths.ledger が無い（台帳の道を書く）")
    allow: set[str] = set()
    for a in conf.get("allow") or []:
        if not isinstance(a, dict) or not str(a.get("reason") or "").strip():
            problems.append(f"raw_lengths.allow の理由が無い：{a}")
            continue
        allow.add(str(a.get("value")).strip().lower())
    token_files = []
    for t in tokens:
        if (base / t).is_file():
            token_files.append((base / t).resolve())
        else:
            problems.append(f"raw_lengths.token_css の {t} が無い")
    other = conf.get("other_checks", DEFAULT_OTHER)
    return {"paths": paths, "tokens": token_files, "allow": allow, "prefix": str(conf.get("token_prefix") or ""),
            "other": other}, problems


def _close(seed: set[str], defs: dict[str, list[str]]) -> set[str]:
    """自前の変数を何段でも辿る：seed の名前を var で読む定義も、変わらなくなるまで足す"""
    out = set(seed)
    while True:
        more = {k for k, vals in defs.items() if k not in out and any(set(strip_vars(v)[1]) & out for v in vals)}
        if not more:
            return out
        out |= more


def scan(base: Path, conf: dict, checked: set[Path] | None = None) -> tuple[list[dict], list[str], int]:
    """戻り：(赤（file・selector・prop・value・line・raw）, 設定の問題, 見た .css の数)。
    checked は別の段（D3・D4）が読んだファイル。そこにある px だけの font-size・border-radius は D8 から外す"""
    c, problems = read_conf(conf, base)
    checked = {p.resolve() for p in (checked or set())}
    token_names: set[str] = set()
    for f in c["tokens"]:
        token_names |= {k for _, k, _, _ in declarations(f.read_text(encoding="utf-8")) if k.startswith("--")}
    files = [f for f in css_files(base, c["paths"]) if f.resolve() not in c["tokens"]]
    if c["paths"] and not files:
        problems.append("raw_lengths.paths の下に .css が 1 つも無い（黙って緑にしない）")
    decls = []
    for f in files:
        for sel, k, v, ln in declarations(f.read_text(encoding="utf-8", errors="replace")):
            last = sel.split(" >> ")[-1]
            if last.lower().startswith("@property") and k == "initial-value":
                k = last.split(None, 1)[1].strip() if " " in last else k   # @property の初めの値＝その変数の定義
            decls.append((f.relative_to(base).as_posix(), f.resolve(), sel, k, v, ln))
    defs: dict[str, list[str]] = {}
    for _, _, _, k, v, _ in decls:
        if k.startswith("--"):
            defs.setdefault(k, []).append(v)
    local = set(defs)
    local_raw = _close({k for k, vals in defs.items() if any(raw_tokens("", v, c["allow"]) for v in vals)}, defs)
    local_bare = _close({k for k, vals in defs.items()
                         if any(BARE.search(LEN.sub(" ", _clean(v))) for v in vals)}, defs)
    found: list[dict] = []
    for rel, path, sel, prop, val, ln in decls:
        skip = path in checked and left_to_other(prop, val, c["other"])
        raws = raw_tokens(prop, val, c["allow"], skip_px=skip)
        for name in strip_vars(val)[1]:
            if name in token_names:
                continue
            if name in local_raw:
                raws.append(f"var({name})＝生の値の自前の変数")
            elif c["prefix"] and name.startswith(c["prefix"]) and name not in local:
                raws.append(f"var({name})＝無いトークン")
        for name in bare_var_reads(prop, val):
            if name in local_bare and name not in token_names and name not in local_raw:
                raws.append(f"var({name})＝単位の無い行の高さの自前の変数")
        if raws:
            found.append({"file": rel, "selector": sel, "prop": prop, "value": val, "line": ln, "raw": raws})
    found += markup_findings(base, c["paths"], c["allow"])
    return found, problems, len(files)


# ---------------------------------------------------------------- 台帳
def key(e: dict) -> tuple[str, str, str, str]:
    return (e["file"], e["selector"], e["prop"], e["value"])


def counts(found: list[dict]) -> dict[tuple[str, str, str, str], int]:
    out: dict[tuple[str, str, str, str], int] = {}
    for f in found:
        out[key(f)] = out.get(key(f), 0) + 1
    return out


def show(k: tuple[str, str, str, str]) -> str:
    return f"{k[1]} {{ {k[2]}: {k[3]} }}"


def ledger_map(entries: list[dict]) -> tuple[dict[tuple, int], list[str]]:
    bad: list[str] = []
    seen: dict[tuple, int] = {}
    for e in entries:
        try:
            k = key(e)
        except (KeyError, TypeError):
            bad.append(f"台帳の行の形が違う（file・selector・prop・value・count・reason）：{e}")
            continue
        if k in seen:
            bad.append(f"台帳に同じ行が 2 つ：{k[0]}  {show(k)}")
        n = e.get("count")
        if not isinstance(n, int) or isinstance(n, bool) or n < 1:
            bad.append(f"台帳の行の count が 1 以上の整数でない：{k[0]}  {show(k)}")
            n = 0
        if not str(e.get("reason") or "").strip():
            bad.append(f"台帳の行の理由が空：{k[0]}  {show(k)}")
        seen[k] = n
    return seen, bad


def ledger_problems(found: list[dict], entries: list[dict]) -> list[str]:
    seen, bad = ledger_map(entries)
    now = counts(found)
    lines = {key(f): f["line"] for f in found}
    for k, n in sorted(now.items()):
        if n > seen.get(k, 0):
            bad.append(f"D8 {k[0]}:{lines[k]}  {show(k)}（台帳に無い生の値 {n - seen.get(k, 0)} 個。トークンにする）")
    for k, led in sorted(seen.items()):
        if 0 < led and now.get(k, 0) < led:
            bad.append(f"台帳を減らす（直った）：{k[0]}  {show(k)}  台帳 {led} → 今 {now.get(k, 0)}")
    return bad


def shrink(found: list[dict], entries: list[dict]) -> list[dict]:
    """直った分だけ台帳を減らす（台帳に無い赤は足さない）"""
    now = counts(found)
    out = []
    for e in entries:
        try:
            n = min(int(e.get("count") or 0), now.get(key(e), 0))
        except (KeyError, TypeError, ValueError):
            continue
        if n > 0:
            out.append({**e, "count": n})
    return out


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=False)
    except OSError as e:
        return subprocess.CompletedProcess(["git", *args], 1, "", str(e))


def base_problems(cfg_file: Path, ref: str, entries: list[dict]) -> tuple[list[str], str]:
    """分かれ目の台帳（分かれ目の設定が指す道）と比べる。足した行・増やした count は赤。
    分かれ目の設定に raw_lengths が無いときだけ、台帳を入れる回として比べずに通す"""
    root = cfg_file.parent
    top = _git(root, "rev-parse", "--show-toplevel")
    if top.returncode != 0:
        return [f"git の木でない（比べる版 {ref} と比べられない）"], ""
    if not ref or _git(root, "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}").returncode != 0:
        return [f"比べる版 {ref or '（空）'} が読めない"], ""
    rel_cfg = cfg_file.resolve().relative_to(Path(top.stdout.strip()).resolve()).as_posix()
    r = _git(root, "show", f"{ref}:{rel_cfg}")
    try:
        base_conf = json.loads(r.stdout).get("raw_lengths") if r.returncode == 0 else None
    except ValueError as e:
        return [f"分かれ目の {rel_cfg} が読めない（{e}）"], ""
    if not base_conf:
        return [], f"分かれ目 {ref[:12]} の設定に raw_lengths が無い（台帳を入れる回。比べない）"
    rel_led = (Path(rel_cfg).parent / str(base_conf.get("ledger") or "")).as_posix()
    r = _git(root, "show", f"{ref}:{rel_led}")
    if r.returncode != 0:
        return [f"分かれ目の台帳 {rel_led} が無い（分かれ目の設定が指す台帳と比べる）"], ""
    try:
        base, _ = ledger_map(json.loads(r.stdout)["entries"])
    except (ValueError, KeyError, TypeError) as e:
        return [f"分かれ目の台帳が読めない（{e}）"], ""
    now, _ = ledger_map(entries)
    bad = []
    for k, n in sorted(now.items()):
        if k not in base:
            bad.append(f"分かれ目の台帳に無い行（足して通さない）：{k[0]}  {show(k)}")
        elif n > base[k]:
            bad.append(f"分かれ目より count が増えた（足して通さない）：{k[0]}  {show(k)}  {base[k]} → {n}")
    return bad, ""


def run(cfg_file: Path, cfg: dict, base_ref: str | None, no_base: bool, do_shrink: bool,
        checked: set[Path] | None = None) -> tuple[list[str], str, int]:
    """D8 を流す。戻り：(赤の行, 知らせ, 見た .css の数)"""
    conf = cfg.get("raw_lengths")
    if not isinstance(conf, dict) or not conf:
        return [f"D8 設定が無い：{cfg_file} に raw_lengths を書く（黙って緑にしない）"], "", 0
    if not no_base and base_ref is None:
        return ["D8 比べ方の指定が無い：--ledger-base-ref <版> か --no-base を付ける（黙って比べずに緑にしない）"], "", 0
    base = cfg_file.parent
    found, problems, n = scan(base, conf, checked)
    bad = [f"D8 {p}" for p in problems]
    led_file = base / str(conf.get("ledger") or "")
    try:
        entries = json.loads(led_file.read_text(encoding="utf-8"))["entries"]
        if not isinstance(entries, list):
            raise TypeError("entries が並びでない")
    except (OSError, ValueError, KeyError, TypeError) as e:
        return bad + [f"D8 台帳 {led_file} が読めない（{e}）"], "", n
    if do_shrink:
        doc = json.loads(led_file.read_text(encoding="utf-8"))
        doc["entries"] = shrink(found, entries)
        led_file.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        entries = doc["entries"]
    bad += ledger_problems(found, entries)
    note = ""
    if not no_base:
        more, note = base_problems(cfg_file, base_ref or "", entries)
        bad += [f"D8 {m}" for m in more]
    return bad, note, n
