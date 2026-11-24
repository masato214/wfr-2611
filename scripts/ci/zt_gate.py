#!/usr/bin/env python3
"""zt_gate.py — ゼロトラストの決まり（03_architecture/ゼロトラストの決まり.md・D-128.88）の検査。

設計の検査（赤なら止める）：
  ZT1  画面の表（05_flow/screen_api.py）から作る API は全部「誰が呼べるか」を持つ。言葉は決まりの §2 のものだけ
  ZT5  本人確認を取り直す操作（決まりの ZT5）に step_up が付いている
  ZT9  運営の画面の API は ops:<できること> だけ。顧客の画面の API は ops: を使わない
  ZT2  契約で、権限が public でない API がログイン不要になっていない（その逆も）・client の API は契約でも client
  ZT4  取引先の人（client）の API は /portal/ の下だけ。/portal/ の API は client だけ
実装の残り（数を出す。--strict のときだけ赤）：
  ZT3  ER 図 §16 の表で、packages/db/policies に RLS の決まりが無いもの
  ZT6  セッションの期限と見張り（操作が無いと 12 時間・IP や国の急な変化）
  ZT11 画面の守りの設定（Content-Security-Policy など）

使い方: python3 scripts/ci/zt_gate.py [--strict | --lower-baseline]
  ふだん：実装の残りが zt_baseline.json より増えたら赤（ラチェット）。--strict（本番の前）：残りが 1 つでもあれば赤
"""
from __future__ import annotations
import glob, importlib.util, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORDS = {"public", "read", "write", "assignee", "approver", "recipient", "self", "manager", "admin", "client", "device", "self_or_device"}
OPS_CAPS = {"any", "inquiry", "peek", "money", "stop", "notice", "distribute", "plan_propose", "plan_decide", "ops_people"}
# 本人確認を取り直す操作（D-125.139・D-128.68・D-128.70）。表に出てきたら step_up が要る
# approveApproval は外した：AI の成果物の承認では本人確認を取り直さない（D-128.177・K-162）
STEP_UP_REQUIRED = {"createCredential", "updateCredential", "updateMemberRole", "updateMemberPermissions",
                    "createExport", "openPeek", "stopWorkspace", "recordPayment", "decidePlanProposal",
                    "startTwoFactor", "disableTwoFactor", "regenerateBackupCodes", "changePassword", "deletePasskey", "resetMemberTwoFactor",
                    "requestEmailChange", "revokeMyDevice", "releaseOpsTemplate",
                    "updateMemberGroups", "suspendMember", "resumeMember", "removeMember", "updateWorkspacePermissions",
                    "changePlan", "requestWorkspaceDeletion", "createInvitations", "createInvitationLink",
                    "changeOpsWorkspacePlan", "resumeWorkspace", "issueOpsInvoices", "addOpsMember", "updateOpsMemberCaps", "removeOpsMember"}
# PC がまだ印を持たないうちに呼ぶ口（接続コードそのものが鍵・1 分 5 回・10 分・1 回だけ・D-089・D-128.93・K-57）
BRIDGE_PUBLIC = {"claimPairingCode"}
PUBLIC_OK = {"signup", "verify-email", "login", "password-reset", "invite-accept", "help"}   # ログイン前の画面だけが public を使える


def load_screen_api():
    spec = importlib.util.spec_from_file_location("screen_api", os.path.join(ROOT, "05_flow", "screen_api.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def design_fails(sa) -> list[str]:
    fails = []
    perms = getattr(sa, "PERMS", {})
    for sid, rows in sa.SCREEN_API.items():
        for m, path, _act, _table, opid, _more in rows:
            if opid not in perms:
                fails.append(f"[ZT1] {sid} {m} {path}（{opid}）に「誰が呼べるか」が無い"); continue
            who, scope, step = perms[opid]
            ok_word = who in WORDS or (who.startswith("ops:") and who[4:] in OPS_CAPS)
            if not ok_word: fails.append(f"[ZT1] {opid} の権限 {who!r} は決まりの言葉に無い")
            if not str(scope).strip(): fails.append(f"[ZT1] {opid} の範囲の説明が空")
            if opid in STEP_UP_REQUIRED and not step: fails.append(f"[ZT5] {opid} は本人確認の取り直しが要る操作なのに step_up が無い")
            if sid.startswith("ops-") and not who.startswith("ops:"): fails.append(f"[ZT9] 運営の画面 {sid} の {opid} が ops: でない（{who}）")
            if not sid.startswith("ops-") and who.startswith("ops:"): fails.append(f"[ZT9] 顧客の画面 {sid} の {opid} が ops: を使っている")
            if who == "device" and not path.startswith("/bridge/"): fails.append(f"[ZT10] {opid} は PC の印（device）で呼ぶのに /bridge/ の下に無い")
            if path.startswith("/bridge/") and who not in ("device", "self", "self_or_device") and opid not in BRIDGE_PUBLIC: fails.append(f"[ZT10] {opid}（/bridge/）は device か self でなければならない")
            if who == "self_or_device" and not path.startswith("/bridge/"): fails.append(f"[ZT10] {opid} は PC の印でも呼ぶのに /bridge/ の下に無い")
            if who == "client" and not path.startswith("/portal"): fails.append(f"[ZT4] {opid} は取引先の人（client）が呼ぶのに /portal/ の下に無い")
            if path.startswith("/portal") and who != "client": fails.append(f"[ZT4] {opid}（/portal/）は client でなければならない")
            if sid == "portal" and who != "client": fails.append(f"[ZT4] クライアントの場所の {opid} が client でない（{who}）")
            if who == "public" and sid not in PUBLIC_OK and opid not in BRIDGE_PUBLIC: fails.append(f"[ZT1] ログイン前ではない画面 {sid} の {opid} が public になっている")
    # ZT3（設計）：ログイン済みなら誰でも読める（authenticated・true）のは、本当のマスタ（全社で共通の一覧・運営が配る版）だけ。
    #   それ以外の表がそうなっていると、別の会社の行が読める（子の表は親の見え方に従わせる・D-128.115）。直すチケットが決まっているものだけ残りとして許す
    import json, importlib.util as _u
    ents = os.path.join(ROOT, "07_functional", "entities.json")
    _sp = _u.spec_from_file_location("rls_policies", os.path.join(ROOT, "05_flow", "rls_policies.py")); _r = _u.module_from_spec(_sp); _sp.loader.exec_module(_r)
    CATALOG = {"distribution_versions", "plan_versions", "terms_versions", "skills"}   # 運営が全社に配る版（どの会社にも同じものを見せる）
    if os.path.exists(ents):
        for e in json.load(open(ents, encoding="utf-8"))["entities"]:
            open_read = any(p["role"] == "authenticated" and p["operation"] in ("select", "all") and p["predicate"].strip() == "true" for p in e["access_control_policies"])
            master = "マスタ" in (e.get("note") or "") or e["table_name"] in CATALOG
            if open_read and not master and e["table_name"] not in _r.PENDING_CHILD_TABLES:
                fails.append(f"[ZT3] {e['table_name']} はマスタでないのに、ログイン済みなら誰でも読める（別の会社の行が見える）。05_flow/rls_policies.py で親の見え方に従わせる")
    # ZT2：契約（08_api/endpoints.json）で、権限が public でない API がログイン不要になっていないか
    ep = os.path.join(ROOT, "08_api", "endpoints.json")
    if os.path.exists(ep):
        import json
        for e in json.load(open(ep, encoding="utf-8"))["endpoints"]:
            pm = e.get("permission")
            if pm and pm["who"] != "public" and e.get("auth", {}).get("role") == "public":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 {pm['who']} なのに契約ではログイン不要（public）になっている")
            if pm and pm["who"] == "client" and e.get("auth", {}).get("role") != "client":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 client なのに契約の役割が client でない")
            if pm and pm["who"] == "device" and e.get("auth", {}).get("role") != "device":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 device なのに契約の役割が device でない")
            if pm and pm["who"] == "public" and e.get("auth", {}).get("role") != "public":
                fails.append(f"[ZT2] {e['method']} {e['path']} は権限 public なのに契約ではログインが要る")
    # 契約の外の道すじの行き先（K-21・08_api/auth-ext-routes.json）：登録されている道すじは全部表にあり、移す先は契約の口、外すものは決定と理由を持つ
    rp = os.path.join(ROOT, "08_api", "auth-ext-routes.json")
    table = json.load(open(rp, encoding="utf-8"))["routes"] if os.path.exists(rp) else []
    known = {(r["method"], r["route"]): r for r in table}
    ops = {e["operation_id"] for e in json.load(open(os.path.join(ROOT, "08_api", "endpoints.json"), encoding="utf-8"))["endpoints"]}
    log = open(os.path.join(ROOT, "01_hearing", "決定ログ_進行中.md"), encoding="utf-8").read()
    for f in glob.glob(os.path.join(ROOT, "apps", "api", "src", "auth", "*.ts")):
        for m, pth in re.findall(r'app\.(get|post|patch|put|delete)\("([^"]+)"', open(f, encoding="utf-8").read()):
            r = known.get((m.upper(), "/api/auth-ext" + pth))
            if not r: fails.append(f"[ZT1] 契約の外の道すじ {m.upper()} /api/auth-ext{pth} の行き先が 08_api/auth-ext-routes.json に無い（移す先の口か、外す決定を書く）"); continue
            if r.get("to") and r["to"] not in ops: fails.append(f"[ZT1] {m.upper()} /api/auth-ext{pth} の移す先 {r['to']} が契約に無い")
            if not r.get("to") and not (str(r.get("reason", "")).strip() and f"| {r.get('decision')} |" in log): fails.append(f"[ZT1] {m.upper()} /api/auth-ext{pth} を外す根拠（決定ログにある決定と理由）が無い")
    return fails


def impl_todo() -> tuple[list[str], dict]:
    todo = []; metrics = {}
    er = open(os.path.join(ROOT, "03_architecture", "ER図.md"), encoding="utf-8").read()
    sec = er.split("## 16.")[1].split("\n## ")[0] if "## 16." in er else ""
    tables = sorted(set(re.findall(r"^\| \*\*`([a-z_]+)`\*\*", sec, flags=re.M)))
    pol = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "packages", "db", "policies", "*.sql")))
    # ログインの部品の側（kaname_auth）の表は業務の表の RLS を持たない（その側の口だけが触る・D-088.2・D-128.119）。段階 1 は作らない表も数えない
    auth_side = {"passkeys", "pending_signup"}
    not_built = set(re.findall(r"^\| `([a-z_]+)` \|[^\n]*段階 1 は作らない", er, flags=re.M))
    for t in tables:
        if t in auth_side or t in not_built:
            continue
        if not re.search(rf"\bon\s+(?:public\.)?{t}\b", pol, flags=re.I): todo.append(f"[ZT3] {t} に RLS の決まりが無い")
    metrics["rls_missing"] = sum(1 for x in todo if x.startswith("[ZT3]"))
    import importlib.util as _u2
    _sp2 = _u2.spec_from_file_location("rls_policies", os.path.join(ROOT, "05_flow", "rls_policies.py")); _r2 = _u2.module_from_spec(_sp2); _sp2.loader.exec_module(_r2)
    for t, k in _r2.PENDING_CHILD_TABLES.items(): todo.append(f"[ZT3] {t} はまだ「ログイン済みなら誰でも読める」。{k} で直す")
    metrics["open_read_child"] = len(_r2.PENDING_CHILD_TABLES)
    auth = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "packages", "auth", "src", "**", "*.ts"), recursive=True))
    web = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "apps", "web", "next.config.*")) + glob.glob(os.path.join(ROOT, "apps", "web", "middleware.*")))
    op = open(os.path.join(ROOT, "apps", "api", "src", "contract", "op.ts"), encoding="utf-8").read() if os.path.exists(os.path.join(ROOT, "apps", "api", "src", "contract", "op.ts")) else ""
    if '"client"' not in op: todo.append("[ZT4] 契約の入口（apps/api/src/contract/op.ts）が取引先の人（client）を分けていない。client は /portal/ の API だけ通す")
    # ZT1（実装）：契約の外で登録されている道すじ（手で書いた /api/auth-ext・Bridge・預けたログイン情報 など）
    #   Better Auth そのものの /api/auth/* は部品の中身なので数えない。全部を契約に入れるか、理由つきで除外するまで残りに出す
    outside = []
    for f in glob.glob(os.path.join(ROOT, "apps", "api", "src", "auth", "*.ts")):
        for m, pth in re.findall(r'app\.(get|post|patch|put|delete)\("([^"]+)"', open(f, encoding="utf-8").read()):
            outside.append(f"{m.upper()} /api/auth-ext{pth}")
    if outside: todo.append(f"[ZT1] 契約の外で登録されている道すじ {len(outside)} 本（apps/api/src/auth/*.ts）。契約に入れて誰が呼べるかを書く")
    metrics["outside_routes"] = len(outside)
    # セッションの見張り（K-20）：解決が要求ごとに app.session_check を呼び、その関数が時間（idle・max_age）と国・端末（country_changed・device_changed）で閉じる
    mig = "".join(open(f, encoding="utf-8").read() for f in glob.glob(os.path.join(ROOT, "packages", "db", "migrations", "*.sql")))
    check_fn = re.search(r"function app\.session_check\b.*?\$\$;", mig, re.S)
    body = check_fn.group(0) if check_fn else ""
    calls = "app.session_check(" in auth
    metrics["session_idle"] = int(not (calls and "'idle'" in body and "'max_age'" in body))
    metrics["session_geo"] = int(not (calls and "'country_changed'" in body and "'device_changed'" in body))
    if metrics["session_idle"]: todo.append("[ZT6] 操作が無いときの期限（12 時間）・最長（7 日）で閉じる仕組み（app.session_check）が無いか、解決が呼んでいない")
    if metrics["session_geo"]: todo.append("[ZT6] 国・端末の急な変化で閉じる仕組み（app.session_check）が無いか、解決が呼んでいない")
    # 画面の守り（K-23）：middleware が全部の画面の応答に lib/security-headers.ts の見出しを付け、その中に 4 つの守りがある
    sec_p = os.path.join(ROOT, "apps", "web", "lib", "security-headers.ts")
    sec = open(sec_p, encoding="utf-8").read() if os.path.exists(sec_p) else ""
    wired = "securityHeaders(" in web and "matcher" in web
    need = ["Content-Security-Policy", "frame-ancestors", "Referrer-Policy", "Strict-Transport-Security", "'nonce-"]
    metrics["csp"] = int(not (wired and all(x in sec for x in need)))
    if metrics["csp"]: todo.append("[ZT11] 画面の守りの見出し（CSP・frame-ancestors・Referrer-Policy・HSTS・nonce）を全部の画面に付ける仕組みが apps/web に無い")
    metrics["client_gate"] = int('"client"' not in op)
    # ZT1・ZT5（実装）：権限の言葉の段と本人確認の取り直しが入口にあるか。
    #   言葉ごとの確かめは apps/api/src/contract/permissions.ts の CHECKS に置く（キーが言葉）。無い言葉を使う API の数を残りに出す
    import json
    perm_src = os.path.join(ROOT, "apps", "api", "src", "contract", "permissions.ts")
    have = set(re.findall(r'^\s*"?([a-z:_*]+)"?\s*:', open(perm_src, encoding="utf-8").read(), flags=re.M)) if os.path.exists(perm_src) else set()
    eps = json.load(open(os.path.join(ROOT, "08_api", "endpoints.json"), encoding="utf-8"))["endpoints"]
    need = [e for e in eps if (e.get("permission") or {}).get("who", "public") != "public"]
    miss_word = [e for e in need if e["permission"]["who"] not in have and not (e["permission"]["who"].startswith("ops:") and "ops:*" in have)]
    step_impl = bool(re.search(r"stepUpAt|step_up_at|requireStepUp", op))
    miss_step = [] if step_impl else [e for e in eps if (e.get("permission") or {}).get("step_up")]
    metrics["perm_words_missing"] = len(miss_word); metrics["step_up_missing"] = len(miss_step)
    if miss_word: todo.append(f"[ZT1] 権限の言葉の段（{'・'.join(sorted({e['permission']['who'] for e in miss_word}))}）が入口に無い API {len(miss_word)} 本（apps/api/src/contract/permissions.ts）。役の段は入口で止めている")
    if miss_step: todo.append(f"[ZT5] 本人確認の取り直しを入口で確かめていない API {len(miss_step)} 本（apps/api/src/contract/op.ts）")
    return todo, metrics


BASELINE = os.path.join(ROOT, "scripts", "ci", "zt_baseline.json")


def main() -> int:
    """ふだん：設計の赤があれば止める。実装の残りは記録（zt_baseline.json）より増えたら止める（ラチェット）。
       --strict（本番の前）：実装の残りが 1 つでもあれば止める。
       --lower-baseline：残りが減ったとき、記録の数を下げる（上げることはできない）"""
    import json
    strict = "--strict" in sys.argv
    sa = load_screen_api()
    fails = design_fails(sa)
    todo, metrics = impl_todo()
    n_api = sum(len(r) for r in sa.SCREEN_API.values())
    print(f"ゼロトラスト：画面の表の API {n_api} 本 ／ 設計の赤 {len(fails)} ／ 実装の残り {len(todo)}")
    for f in fails: print("  ★ " + f)
    for t in todo: print("  ・ " + t)
    base = json.load(open(BASELINE, encoding="utf-8"))["metrics"] if os.path.exists(BASELINE) else {}
    up = {k: (v, base.get(k, 0)) for k, v in metrics.items() if v > base.get(k, 0)}
    down = {k: (v, base[k]) for k, v in metrics.items() if k in base and v < base[k]}
    if "--lower-baseline" in sys.argv:
        if up: print("FAIL — 増えたものがあるので記録は下げられない（増やすことはできない）"); return 2
        json.dump({"_doc": "ゼロトラストの実装の残りの記録（zt_gate.py）。ふだんの CI はこれより増えたら止める。減ったら --lower-baseline で下げる。本番の前は --strict で 0 が要る", "metrics": {k: min(v, base.get(k, v)) for k, v in metrics.items()}}, open(BASELINE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("記録を下げた：" + "・".join(f"{k} {b}→{v}" for k, (v, b) in down.items()) if down else "下げるものは無い"); return 0
    if fails: print("FAIL — 設計の決まりを満たしていない"); return 2
    if up:
        for k, (v, b) in up.items(): print(f"  ★ [増えた] {k}：記録 {b} → いま {v}")
        print("FAIL — 実装の残りが記録より増えた（新しく守りの穴を作った）"); return 2
    if down: print("  （減った：" + "・".join(f"{k} {b}→{v}" for k, (v, b) in down.items()) + "。python3 scripts/ci/zt_gate.py --lower-baseline で記録を下げる）")
    if strict and todo: print("FAIL — 実装の残りがある（--strict・本番の前は 0 が要る）"); return 2
    print("PASS — 設計の決まりは満たしている" + ("（実装の残りは記録より増えていない。本番の前に 0 にする）" if todo else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
