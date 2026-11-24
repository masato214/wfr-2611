#!/usr/bin/env python3
"""ops_definer_gate.py — 運営が別の会社を触る DB の関数が、確かめと記録を必ず持つかを見る（K-947・関門 C2・D-156.3・D-128.108）。

運営が別の会社を触る道は security definer の関数 `app.ops_<名前>` だけ。人が思い出さなくても漏れないよう、migration を読んで見る:
  ① 本体の最初の文（begin の後・declare は除く）が `perform app.ops_require(` か `<変数> := app.ops_require(`
     （入口が抜けても、関数の中で運営の人とできることを確かめる・2 層目）
  ② 本体に insert into・update・delete from があれば `app.record_ops_audit(` を呼ぶ（運営と会社の両方の記録）
読み方: packages/db/migrations/*.sql を名前の順に読み、`create [or replace] function app.ops_…` から `$tag$ … $tag$` の本体までを
1 つと数える。同じ名前は後の版で上書きする。security definer の無い関数は見ない。台帳 EXEMPT（名前 → 理由）の関数も見ない。

使い方: python3 scripts/ci/ops_definer_gate.py [--dir <migrations のフォルダ>]   誤りがあれば 1 行ずつ出して 1 で終わる
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DIR = ROOT / "packages" / "db" / "migrations"

# 型でない前からの関数・この検査の型そのもの・ログインの前に呼ぶ関数（運営の文脈がまだ無い）。理由の無い行は誤り
EXEMPT: dict[str, str] = {
    "app.ops_tenant_id": "運営の会社の id を返す定数（0003）。会社を触らない",
    "app.ops_grant_ok": "行の守り（RLS）の式の中の判定（0002・0078）。中を見るの許可を読むだけ",
    "app.ops_plan_proposal_guard": "値段の案の表の引き金（0076）。呼ぶ人の文脈で動き、運営の口の関数ではない",
    "app.ops_require": "この検査の型そのもの（運営の人とできることを確かめる・K-947）",
    "app.ops_target": "この検査の型そのもの（指す会社を絞る・K-947）",
    "app.ops_login_check": "ログインの前に呼ぶ止め（K-944）。運営の文脈がまだ無い",
    "app.ops_setup_consume": "パスキーを付けるリンクを使う関数（K-945）。ログインの前に呼び、運営の文脈がまだ無い",
}

_FUNC = re.compile(
    r"create\s+(?:or\s+replace\s+)?function\s+(app\.ops_[a-z0-9_]+)\s*\((.*?)\$([a-z_]*)\$(.*?)\$\3\$",
    re.IGNORECASE | re.DOTALL,
)
_LINE_COMMENT = re.compile(r"--[^\n]*")
_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_REQUIRE = re.compile(r"^(?:perform\s+app\.ops_require\s*\(|[a-z_][a-z0-9_]*\s*:=\s*app\.ops_require\s*\()", re.IGNORECASE)
_BEGIN = re.compile(r"\bbegin\b", re.IGNORECASE)
_DECLARE = re.compile(r"^\s*declare\b", re.IGNORECASE)
_WRITE = re.compile(r"\binsert\s+into\b|\bupdate\s+[a-z_\"]|\bdelete\s+from\b", re.IGNORECASE)
_FOR_UPDATE = re.compile(r"\bfor\s+(?:no\s+key\s+)?update\b", re.IGNORECASE)
_AUDIT = re.compile(r"\bapp\.record_ops_audit\s*\(", re.IGNORECASE)


def _strip(sql: str) -> str:
    return _LINE_COMMENT.sub("", _BLOCK_COMMENT.sub("", sql))


def _first_statement(body: str) -> str:
    """本体の最初の文。plpgsql は begin の後（declare の節は飛ばす）、sql の関数は本体の頭から。"""
    text = body
    if _DECLARE.match(text) or _BEGIN.search(text):
        m = _BEGIN.search(text)
        if m:
            text = text[m.end():]
    return text.strip().split(";", 1)[0].strip()


def _definitions(directory: Path) -> dict[str, tuple[str, str, str]]:
    """名前 → (ファイル名, 頭（引数〜$ の前）, 本体)。後の migration の版で上書きする。"""
    found: dict[str, tuple[str, str, str]] = {}
    for path in sorted(Path(directory).glob("*.sql")):
        sql = _strip(path.read_text(encoding="utf-8"))
        for m in _FUNC.finditer(sql):
            found[m.group(1).lower()] = (path.name, m.group(2), m.group(4))
    return found


def check(directory: Path = DEFAULT_DIR) -> list[str]:
    """見つけた誤りの一覧（空なら緑）。1 件は「<ファイル名>: <関数名> …」の 1 行。"""
    probs = [f"台帳 EXEMPT: {name} の理由が空" for name, why in EXEMPT.items() if not str(why).strip()]
    for name, (fname, head, body) in _definitions(directory).items():
        if name in EXEMPT or not re.search(r"\bsecurity\s+definer\b", head, re.IGNORECASE):
            continue
        if not _REQUIRE.match(_first_statement(body)):
            probs.append(f"{fname}: {name} の本体の最初の文が app.ops_require(…) でない（運営の人とできることを関数の中でも確かめる）")
        if _WRITE.search(_FOR_UPDATE.sub("", body)) and not _AUDIT.search(body):
            probs.append(f"{fname}: {name} は書くのに app.record_ops_audit(…) を呼ばない（運営と会社の両方の記録）")
    return probs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--dir", default=str(DEFAULT_DIR), help="migration のフォルダ（既定 packages/db/migrations）")
    a = ap.parse_args(argv)
    probs = check(Path(a.dir))
    for p in probs:
        print(p)
    if probs:
        print(f"FAIL — 運営の関数の誤り {len(probs)}")
        return 1
    print("PASS — 運営の関数は確かめと記録を持つ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
