"""契約の pattern を、schemathesis（Python の re）と口（JavaScript の RegExp）で同じ字の集まりにする（K-1117）。

\\s \\S \\d \\D \\w \\W は、Python と JS で当たる字が違う（Python の \\s は \\x1c〜\\x1f・\\x85 を含み BOM を含まない・JS は逆。
Python の \\d は全部の国の数字）。口は JS なので、JS と同じ字を並べた形に直す。作り手 05_flow/build_api.py が契約を書く前に当てる。
元の表（screen_api.py・screen_api.d・contract_shape.d の写し）は今の字のままで、比べる試験も比べる前にこれを当てる。
"""
from __future__ import annotations

# JavaScript の \\s（trim が落とす字と同じ）。scripts/ci/invite_patterns.py の WS（K-419）と同じ字
WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff"
_IN = {"s": WS, "d": "0-9", "w": "A-Za-z0-9_"}             # 字の組の中に並べる字
_OUT = {"s": f"[{WS}]", "S": f"[^{WS}]", "d": "[0-9]", "D": "[^0-9]", "w": "[A-Za-z0-9_]", "W": "[^A-Za-z0-9_]"}
_SKIP = ("example", "examples")


def _class(p: str, i: int) -> tuple[str, int]:
    """p[i] の [ から閉じる ] までを直す。返すのは (直した字の組, 次の位置)"""
    j = i + 1
    if j < len(p) and p[j] == "^":
        j += 1
    toks: list[str] = []
    while j < len(p) and p[j] != "]":
        if p[j] == "\\" and j + 1 < len(p):
            toks.append(p[j:j + 2])
            j += 2
        else:
            toks.append(p[j])
            j += 1
    if j >= len(p):
        raise ValueError(f"字の組が閉じていない: {p}")
    head = p[i:i + 2] if p[i + 1:i + 2] == "^" else "["
    if "\\s" in toks and "\\S" in toks:   # どの字でも（両方で同じ）
        return p[i:j + 1], j + 1
    bad = [t for t in toks if t in ("\\S", "\\D", "\\W")]
    if bad:
        raise ValueError(f"字の組の中の {bad[0]} は JS と同じ字に直せない: {p}")
    body = "".join(_IN.get(t[1], t) if len(t) == 2 and t[0] == "\\" else t for t in toks)
    return f"{head}{body}]", j + 1


def portable(p: str) -> str:
    """pattern の \\s \\S \\d \\D \\w \\W を JS と同じ字を並べた形に直す（2 回当てても同じ）。直せない形は ValueError"""
    out: list[str] = []
    i = 0
    while i < len(p):
        c = p[i]
        if c == "\\" and i + 1 < len(p):
            e = p[i + 1]
            if e in "bB":
                raise ValueError(f"\\{e}（言葉の境目）は Python と JS で違う: {p}")
            out.append(_OUT.get(e, p[i:i + 2]))
            i += 2
        elif c == "[":
            s, i = _class(p, i)
            out.append(s)
        else:
            out.append(c)
            i += 1
    return "".join(out)


def walk(node: object, _seen: dict[int, object] | None = None) -> object:
    """dict と list をたどり、鍵 pattern の文字を portable で直した新しい物を返す（example・examples の下はたどらない）。
    同じ物を 2 か所から指している所は、直した後も同じ物を指す（契約の YAML の &id／*id の書き方が変わらない）"""
    seen = {} if _seen is None else _seen
    if id(node) in seen:
        return seen[id(node)]
    if isinstance(node, dict):
        out: dict = {}
        seen[id(node)] = out
        for k, v in node.items():
            out[k] = portable(v) if k == "pattern" and isinstance(v, str) else v if k in _SKIP else walk(v, seen)
        return out
    if isinstance(node, list):
        items: list = []
        seen[id(node)] = items
        items.extend(walk(v, seen) for v in node)
        return items
    return node
