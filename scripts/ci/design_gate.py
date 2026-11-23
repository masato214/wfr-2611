#!/usr/bin/env python3
"""D1〜D6：デザインの正本（DESIGN-*.md）と画面を双方向で突き合わせる。

由来 L-017：DESIGN.md を作っても、値を突き合わせる検査が無ければ
正本と画面は別々に育ち、両方それぞれ緑のまま別のデザインになる。

  D1 色      画面に出る色が正本の色トークンに無い
  D2 書体    font-family が正本の fontFamily に無い
  D3 角丸    border-radius が正本の rounded の段に無い
  D4 文字    font-size が正本の typography の段に無い
  D5 部品    components の定義に対応する規則が画面に無い／規則に書いた値（地・字・線・角丸・余白・高さ・太さ・文字）が正本と違う
             （design-gate.json の component_selectors。キャンバスの絵には --no-components で掛けない・K-218）
  D6 未使用  正本にあって画面がどこにも使っていない色・型の段（＝絵に描いた餅）
             --scales：文字の段の名前が --usage の下のどこにも出てこない（名前は完全に一致で数える・K-218）
  D7 段の数  文字の大きさの種類が design-gate.json の max_type_sizes（既定 10）を超える（K-218）
  D8 生の長さ  画面の CSS の大きさ・余白・間・行の高さ・影・枠の太さなどに、トークン（var）を通らない生の長さがある。
             --raw-lengths を付けた回だけ。決まりと台帳（減らすだけ）は design-gate.json の raw_lengths（K-261・design_raw_lengths.py）

規約: .claude/rules/common/design-system.md
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import design_raw_lengths  # noqa: E402

GREY = re.compile(r"^#(?:(\w)\1\1|(\w\w)\2\2)$", re.I)          # #fff #000 #333 など無彩色
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGBA = re.compile(r"rgba?\(([^)]*)\)")
VARDEF = re.compile(r"(--[\w-]+)\s*:\s*([^;}]+)")
VARUSE = re.compile(r"var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)")
PX = re.compile(r"(-?\d*\.?\d+)px")


def norm_hex(v: str) -> str:
    v = v.strip().lower()
    if len(v) == 4:                                              # #abc -> #aabbcc
        v = "#" + "".join(c * 2 for c in v[1:])
    if len(v) == 9:                                              # 透過は色として比べない
        v = v[:7]
    return v


def is_neutral(v: str) -> bool:
    if GREY.match(v):
        return True
    h = norm_hex(v)
    if len(h) != 7:
        return False
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return r == g == b


def walk(node, out_colors: set, out_fonts: set, out_sizes: set, out_radii: set, parent: str = ""):
    """正本の木を歩いて「色に見える値」「fontSize」「fontFamily」「角丸」を拾う。
    正本の形（テーマの入れ子・状態色を別表にする 等）を決め打ちしない。"""
    if isinstance(node, dict):
        for k, v in node.items():
            kl = str(k).lower()
            if isinstance(v, (dict, list)):
                walk(v, out_colors, out_fonts, out_sizes, out_radii, kl)
                continue
            s = str(v).strip()
            if HEX.fullmatch(s):
                out_colors.add(norm_hex(s))
            elif "fontfamily" in kl:
                out_fonts.add(s.strip('"\'').lower())
            elif "fontsize" in kl and PX.search(s):
                out_sizes.add(PX.search(s).group(1))
            elif kl.startswith(("rounded", "radius", "borderradius")) or parent.startswith(("rounded", "radius")):
                for m in PX.finditer(s):
                    out_radii.add(m.group(1))
    elif isinstance(node, list):
        for v in node:
            walk(v, out_colors, out_fonts, out_sizes, out_radii, parent)


def load_source(p: Path) -> dict:
    t = p.read_text(encoding="utf-8")
    if p.suffix == ".md":
        m = re.match(r"^---\n(.*?)\n---\n", t, re.S)
        if not m:
            sys.exit(f"正本にフロントマターがありません: {p}")
        return yaml.safe_load(m.group(1))
    return yaml.safe_load(t) if p.suffix in (".yaml", ".yml") else json.loads(t)


def css_of(p: Path) -> str:
    t = p.read_text(encoding="utf-8", errors="replace")
    if p.suffix in (".html", ".htm"):
        return "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", t, re.S)) + "\n" + \
               "\n".join(f"x{{{s}}}" for s in re.findall(r'style="([^"]*)"', t))
    return t


def resolve(val: str, vars_: dict, depth: int = 0) -> str:
    if depth > 8:
        return val
    def sub(m):
        name, fallback = m.group(1), (m.group(2) or "").strip()
        return vars_.get(name, fallback)
    out = VARUSE.sub(sub, val)
    return resolve(out, vars_, depth + 1) if "var(" in out and out != val else out


# ---- D5：部品の定義 ⇔ CSS の規則（K-218）----
# 比べる値：正本の部品の鍵 → CSS の性質（同じ値の書き方が 2 つあるものは、規則に在る方を比べる）
D5_KEYS = {
    "backgroundColor": ("background-color", "background"), "textColor": ("color",), "border": ("border",),
    "borderTop": ("border-top",), "borderBottom": ("border-bottom",), "rounded": ("border-radius",),
    "padding": ("padding",), "height": ("min-height", "height"), "width": ("width",),
    "fontWeight": ("font-weight",), "typography": ("font-size",), "gap": ("gap",), "opacity": ("opacity",),
    "zIndex": ("z-index",),
}
REF = re.compile(r"\{(\w+)\.([\w-]+)\}")


def strip_at_blocks(css: str) -> str:
    """@media などの入れ子の塊（{ の中に { がある）を外す。D5 は素の規則だけを部品の契約とする"""
    out, i, n = [], 0, len(css)
    while i < n:
        if css[i] == "@":
            j = css.find("{", i)
            k = css.find(";", i)
            if j == -1 or (k != -1 and k < j):          # @import など塊の無いもの
                i = (k + 1) if k != -1 else n
                continue
            depth, j = 1, j + 1
            while j < n and depth:
                depth += {"{": 1, "}": -1}.get(css[j], 0)
                j += 1
            i = j
            continue
        out.append(css[i])
        i += 1
    return "".join(out)


def norm_sel(sel: str) -> str:
    return re.sub(r"\s+", " ", sel.replace("'", '"')).strip()


def rules_of(css: str) -> list[tuple[list[str], dict[str, str]]]:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = []
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", strip_at_blocks(css)):
        sels = [norm_sel(x) for x in m.group(1).split(",") if x.strip()]
        decls = {}
        for d in m.group(2).split(";"):
            if ":" in d:
                k, v = d.split(":", 1)
                decls[k.strip().lower()] = v.strip()
        out.append((sels, decls))
    return out


def norm_val(v: str) -> str:
    v = re.sub(r"\s+", " ", v.strip().lower())
    v = HEX.sub(lambda m: norm_hex(m.group(0)), v)
    return re.sub(r"\b0px\b", "0", v)


def src_value(src: dict, spec_val, key: str) -> str | None:
    """正本の部品の値を本当の値に開く。開けないものは None（比べない）"""
    def sub(m: re.Match) -> str:
        g, k = m.group(1), m.group(2)
        for group in ([g] if g != "colors" else ["colors"]):
            v = (src.get(group) or {}).get(k)
            if v is not None:
                return str(v)
        return m.group(0)
    raw = str(spec_val)
    if key == "typography":
        t = REF.fullmatch(raw)
        if not t:
            return None
        size = ((src.get("typography") or {}).get(t.group(2)) or {}).get("fontSize")
        return str(size) if size is not None else None
    out = REF.sub(sub, raw)
    return None if REF.search(out) else out


def check_components(src: dict, cfg: dict, files: list[Path], vars_: dict) -> tuple[list[str], dict[str, int], int]:
    """戻り：赤の行・部品ごとの比べた値の数・訳で外した部品の数。
    正本の部品にある値が規則に無ければ赤（CSS に無い）。セレクタも訳（component_exempt）も無い部品は赤"""
    comps = src.get("components") or {}
    sels = cfg.get("component_selectors") or {}
    exempt = {x.get("part"): str(x.get("reason") or "").strip() for x in cfg.get("component_exempt", [])}
    rules = [r for f in files for r in rules_of(css_of(f))]

    def decls_for(sel: str) -> dict[str, str] | None:
        want, got, hit = norm_sel(sel), {}, False
        for ss, d in rules:
            if want in ss:
                hit = True
                got.update(d)
        return got if hit else None

    bad: list[str] = []
    by_part: dict[str, int] = {}
    for name, conf in sels.items():
        sel = conf.get("selector") if isinstance(conf, dict) else conf
        shapes = conf.get("shape", []) if isinstance(conf, dict) else []
        shapes = [shapes] if isinstance(shapes, str) else list(shapes)
        spec = comps.get(name)
        if spec is None:
            bad.append(f"D5 {name} 正本の components に無い（design-gate.json の component_selectors を直す）")
            continue
        own = decls_for(sel)
        if own is None:
            bad.append(f"D5 {name} セレクタ {sel} の規則が CSS に無い")
            continue
        merged: dict[str, str] = {}
        for sh in shapes:
            merged.update(decls_for(sh) or {})
        merged.update(own)
        n = 0
        for key, props in D5_KEYS.items():
            if key not in spec:
                continue
            want = src_value(src, spec[key], key)
            if want is None:
                continue
            n += 1
            prop = next((p for p in props if p in merged), None)
            if prop is None:
                bad.append(f"D5 {name} {props[0]} CSS に無い（正本 {want}）")
                continue
            have = resolve(merged[prop], vars_)
            if norm_val(want) != norm_val(have):
                bad.append(f"D5 {name} {prop} 正本 {want} ／ CSS {have}")
        by_part[name] = n
    for name in comps:
        if name in sels:
            continue
        if not exempt.get(name):
            bad.append(f"D5 {name} セレクタも訳も無い（design-gate.json の component_selectors か component_exempt に書く）")
    for name in exempt:
        if name not in comps or name in sels:
            bad.append(f"D5 {name} 訳があるのに正本の部品に無い・セレクタと重なる（component_exempt を直す）")
    return bad, by_part, len([c for c in comps if c not in sels])


SKIP_DIRS = {"node_modules", ".next", ".next-prod", ".turbo", "dist", "build", "coverage", "test-results", "playwright-report"}
GENERATED = {"k-tokens.css", "tokens.css"}
USAGE_EXT = {".css", ".ts", ".tsx", ".js", ".mjs", ".html"}


def unused_scales(src: dict, usage: list[str]) -> list[str]:
    names = list((src.get("typography") or {}).keys())
    text = []
    for u in usage:
        for f in Path(u).rglob("*"):
            if f.is_file() and f.suffix in USAGE_EXT and f.name not in GENERATED and not (SKIP_DIRS & set(f.parts)):
                text.append(f.read_text(encoding="utf-8", errors="replace"))
    for spec in (src.get("components") or {}).values():
        text.append(" ".join(str(v) for v in spec.values()))
    blob = "\n".join(text)
    out = []
    for n in names:
        pat = (rf"(?:--k-text-|--k-lh-|--k-fw-|--text-|--lh-){re.escape(n)}(?![\w-])"
               rf"|\{{typography\.{re.escape(n)}\}}")
        if not re.search(pat, blob):
            out.append(n)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--design", required=True)
    ap.add_argument("--mocks", nargs="+", required=True, help="画面のフォルダかグロブ")
    ap.add_argument("--css", nargs="*", default=[], help="一緒に読む CSS（トークンの定義元を含める）")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--part", action="store_true",
                    help="画面の一部だけを見る（D6 未使用は製品全体でしか判定できないので見ない）")
    ap.add_argument("--no-components", action="store_true",
                    help="D5 を掛けない（キャンバスの絵は部品のクラスを持たない。部品とキャンバスの突き合わせは G70）")
    ap.add_argument("--scales", action="store_true",
                    help="文字の段を数える：使われない段（D6 段・--usage の下）と大きさの種類（D7）")
    ap.add_argument("--usage", nargs="*", default=[], help="--scales で段の名前を探すフォルダ（生成物のトークンは除く）")
    ap.add_argument("--raw-lengths", action="store_true",
                    help="D8 を流す：design-gate.json の raw_lengths の置き場の CSS に生の長さが無いか（台帳は減らすだけ・K-261）")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--ledger-base-ref", default=None, help="D8 の台帳を比べる版（本線との分かれ目）")
    g.add_argument("--no-base", action="store_true", help="D8 の台帳を分かれ目と比べない（手元で流すとき）")
    ap.add_argument("--shrink-ledger", action="store_true", help="D8 の台帳から直った分だけを減らして書き直す（足さない）")
    a = ap.parse_args()

    root = Path(a.design).resolve().parent
    cfg, cfg_file = {}, root / "design-gate.json"
    for up in [root, *root.parents]:
        f = up / "design-gate.json"
        if f.exists():
            cfg, cfg_file = json.loads(f.read_text(encoding="utf-8")), f
            break

    src = load_source(Path(a.design))
    colors, fonts, sizes, radii = set(), set(), set(), set()
    # 暗いテーマ（正本の dark:・D-128.55）の色は「正本にある色」として認める（D1）が、
    # 画面の絵（キャンバス・モック）は明るいテーマで描くので、使っていない色（D6）には数えない
    dark_src = src.pop("dark", None) if isinstance(src, dict) else None
    walk(src, colors, fonts, sizes, radii)
    dark_colors: set = set()
    if dark_src:
        walk(dark_src, dark_colors, set(), set(), set())

    files: list[Path] = []
    for pat in [*a.mocks, *a.css]:
        p = Path(pat)
        files += sorted(p.rglob("*.html")) + sorted(p.rglob("*.css")) if p.is_dir() else \
                 [Path(x) for x in sorted(Path().glob(pat))] if any(c in pat for c in "*?[") else ([p] if p.exists() else [])
    ignore = set(cfg.get("ignore_files", []))
    files = [f for f in files if f.name not in ignore and "node_modules" not in f.parts]
    if not files:
        sys.exit("画面が 1 枚も見つかりません")

    vars_: dict[str, str] = {}
    for f in files:
        for name, val in VARDEF.findall(css_of(f)):
            vars_.setdefault(name, val.strip())

    allow_c = {norm_hex(str(x.get("value", x))) for x in cfg.get("allow_colors", [])}
    allow_s = {str(x.get("value", x)).rstrip("px") for x in cfg.get("allow_sizes", [])}
    bad_c, bad_s, bad_r, bad_f = {}, {}, {}, {}
    used_c, used_s = set(), set()

    for f in files:
        css = css_of(f)
        for name, raw in VARDEF.findall(css):                    # 変数の定義そのものも検査対象
            css += f"\n/*def*/x{{color:{raw}}}" if HEX.search(raw) else ""
        for m in HEX.finditer(resolve(css, vars_)):
            v = norm_hex(m.group(0))
            if v in colors:
                used_c.add(v)
            elif not is_neutral(v) and v not in allow_c and v not in dark_colors:
                bad_c.setdefault(v, set()).add(f.name)
        for m in re.finditer(r"font-size\s*:\s*([^;}]+)", css):
            val = resolve(m.group(1), vars_)
            px = PX.search(val)
            if not px:
                continue
            if px.group(1) in sizes:
                used_s.add(px.group(1))
            elif px.group(1) not in allow_s:
                bad_s.setdefault(px.group(1), set()).add(f.name)
        for m in re.finditer(r"border-radius\s*:\s*([^;}]+)", css):
            for px in PX.finditer(resolve(m.group(1), vars_)):
                if px.group(1) not in radii and px.group(1) != "0":
                    bad_r.setdefault(px.group(1), set()).add(f.name)
        for m in re.finditer(r"font-family\s*:\s*([^;}]+)", css):
            first = resolve(m.group(1), vars_).split(",")[0].strip().strip('"\'').lower()
            if fonts and first not in fonts and first not in ("inherit", "ui-monospace"):
                bad_f.setdefault(first, set()).add(f.name)

    d5_bad: list[str] = []
    d5_by_part: dict[str, int] = {}
    d5_free = 0
    if not a.no_components and cfg.get("component_selectors"):
        d5_bad, d5_by_part, d5_free = check_components(src, cfg, files, vars_)
    d5_parts, d5_compared = len(d5_by_part), sum(d5_by_part.values())
    scale_unused: list[str] = []
    type_sizes: set[str] = set()
    max_sizes = int(cfg.get("max_type_sizes", 10))
    if a.scales:
        scale_unused = unused_scales(src, a.usage)
        type_sizes = {str(v.get("fontSize")) for v in (src.get("typography") or {}).values()
                      if isinstance(v, dict) and "fontSize" in v}

    d8_bad, d8_note, d8_files = [], "", 0
    if a.raw_lengths:
        d8_bad, d8_note, d8_files = design_raw_lengths.run(cfg_file, cfg, a.ledger_base_ref, a.no_base, a.shrink_ledger,
                                                           set(files))

    res = {
        "D1_色_正本に無い": {k: sorted(v)[:3] for k, v in sorted(bad_c.items())},
        "D2_書体_正本に無い": {k: sorted(v)[:3] for k, v in sorted(bad_f.items())},
        "D3_角丸_段に無い": {k: sorted(v)[:3] for k, v in sorted(bad_r.items())},
        "D4_文字_段に無い": {k: sorted(v)[:3] for k, v in sorted(bad_s.items())},
        "D5_部品": ("掛けていません（--no-components）" if a.no_components else
                    "検査していません（design-gate.json の component_selectors が無い）"
                    if not cfg.get("component_selectors") else d5_bad),
        "D6_未使用_色": "一部だけ見ています（--part）" if a.part else sorted(colors - used_c),
        "D6_未使用_文字": "一部だけ見ています（--part）" if a.part else sorted(sizes - used_s, key=float),
        "D6_段_使われない": scale_unused if a.scales else "数えていません（--scales が無い）",
        "D7_段の数": ([f"大きさの種類 {len(type_sizes)} 個（上限 {max_sizes}）"] if len(type_sizes) > max_sizes else [])
                     if a.scales else "数えていません（--scales が無い）",
        "D8_生の長さ": d8_bad if a.raw_lengths else "掛けていません（--raw-lengths が無い）",
    }
    fails = sum(len(res[k]) for k in ("D1_色_正本に無い", "D2_書体_正本に無い", "D3_角丸_段に無い",
                                      "D4_文字_段に無い", "D5_部品", "D6_未使用_色", "D6_未使用_文字",
                                      "D6_段_使われない", "D7_段の数", "D8_生の長さ")
                if not isinstance(res[k], str))
    if a.json:
        print(json.dumps({"files": len(files), "fails": fails, "d5_parts": d5_parts, "d5_compared": d5_compared,
                          "d5_by_part": d5_by_part,
                          **res}, ensure_ascii=False, indent=2))
    else:
        print(f"画面 {len(files)} 枚 / 正本 {Path(a.design).name}")
        for k, v in res.items():
            if isinstance(v, str):
                print(f"  {k}: {v}"); continue
            extra = f"  (部品 {d5_parts} 個・比べた値 {d5_compared} 個・訳で外した部品 {d5_free} 個)" \
                if k == "D5_部品" else f"  (見た .css {d8_files} 本)" if k == "D8_生の長さ" else ""
            print(f"  {k}: {len(v)} 件{extra}" + (f"  {list(v)[:8]}" if v and k not in ("D5_部品", "D8_生の長さ") else ""))
            if k == "D8_生の長さ" and d8_note:
                print(f"    （知らせ）{d8_note}")
            if k in ("D5_部品", "D8_生の長さ"):
                for line in v:
                    print(f"    {line}")
        print("PASS" if fails == 0 else f"不合格 {fails} 件")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
