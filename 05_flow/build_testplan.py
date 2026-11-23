#!/usr/bin/env python3
"""build_testplan.py — S11 test-verification の成果物を上流から機械生成する（手で書かない）。
入力: 07_tasks/tickets.json（3-tier AC・qa_rows）／08_api/ears-ac-seed.json（EARS）／07_functional/entities.json（RLS）／
      03_architecture/foundation_gates.json（CI ゲート 26）／choke-points.json／02_tech_stack/selected-stack.json／07_qa/test-specs
出力: 07_qa/test-plan/test-plan.json（信頼源）・test-plan.md・test-plan.html・ears-test-mapping.json・access-matrix.json・.github/workflows/v3-gate.yml
検査: scripts/ci/tv_gate.py"""
import json, re, os, sys, datetime, html
from pathlib import Path
sys.path.insert(0, "scripts/ci")   # 作り手は根で流れる
import gate_cmds  # noqa: E402  段の命令の並びをチケットごとのファイル（scripts/ci/g65.d・g47.d）から作る（K-376）
# G65 の並びの最後は k248 の試験（決まり K248-G57-016・K323-CI-010）。どのファイルに書いてあっても作り手が最後に動かす
G65_LAST = "python3 scripts/ci/k248_scope_reach_test.py"
TODAY = datetime.date.today().isoformat(); OUT = "07_qa/test-plan"
J = lambda p: json.load(open(p, encoding="utf-8"))
T = J("07_tasks/tickets.json"); TASKS = T["tasks"]; EARS = J("08_api/ears-ac-seed.json")["ac_seeds"]; EN = J("07_functional/entities.json"); EN = EN.get("entities") or EN["items"]
FG = J("03_architecture/foundation_gates.json"); CP = J("03_architecture/choke-points.json")["choke_points"]; ST = J("02_tech_stack/selected-stack.json")["stack"]
ERR = J("07_qa/test-specs/errors.json")["errors"]; JR = J("07_qa/test-specs/journeys/plan.json")["rows"]
# 根拠の決定は作る仕事のチケット（11_tickets）と関門から。しまった 07_tasks の source は使わない（D-128.117）
KN = J("11_tickets/tickets.json")["tickets"]
SRC = sorted({s for t in KN for s in t.get("decisions", []) if s.startswith("D-")} | {s for c in CP for s in c.get("source", []) if str(s).startswith("D-")})
# ---------------------------------------------------------------- 3-tier AC ↔ テスト段
TIER_MAP = [
    {"tier": "structural（モック・契約と一致）", "level": "mock-impl drift lint／OpenAPI 契約", "tool": "pnpm ci:mock-impl-diff（h1・状態・第2ナビ・列の値）／pnpm ci:openapi-diff", "gate": "ui-mock-impl-diff・G11", "ladder": "L1"},
    {"tier": "functional.api（EARS EVENT-DRIVEN）", "level": "契約＋結合（実 Postgres）", "tool": "pnpm test（EARS から生成した test）＋ Schemathesis（openapi.yaml → fuzz）", "gate": "backend-coverage・G3", "ladder": "L1"},
    {"tier": "functional.unwanted 401/403（EARS UNWANTED）", "level": "認可・RLS（role × operation）", "tool": "access-matrix.json → pnpm ci:access-matrix（他テナント・権限なし・本人のみ）", "gate": "backend-access-matrix・G4/G6", "ladder": "L1"},
    {"tier": "functional.unwanted 422/409/429", "level": "unit（検証・冪等・レート）", "tool": "pnpm test（正規化の入出力表＝表記ゆらぎ・境界値）", "gate": "backend-coverage・G3", "ladder": "L1"},
    {"tier": "functional.unwanted 502（G-15）", "level": "結合（外部を故意に切る）", "tool": "pnpm test（Bridge／外部のスタブが完了信号なしで終わる）", "gate": "backend-coverage", "ladder": "L1"},
    {"tier": "functional.acceptance（行為が最後まで通る）", "level": "E2E（staging）", "tool": "Playwright（journeys/plan.json の流れ・runnable_after が揃った順）", "gate": "e2e・G15", "ladder": "L2"},
    {"tier": "regression.coverage", "level": "coverage", "tool": "pnpm test -- --coverage（lines 80／branches 70）", "gate": "backend-coverage・G3", "ladder": "L1"},
    {"tier": "regression.lint／type", "level": "静的", "tool": "pnpm lint／pnpm type-check／AC validator", "gate": "static・G1/G2/G14", "ladder": "L1"},
    {"tier": "regression.choke（関門の迂回）", "level": "静的解析（import グラフ）", "tool": "pnpm ci:choke -- --id C1..C8／no-dynamic-call／例外台帳", "gate": "static・G16〜G25", "ladder": "L1"},
    {"tier": "regression.spec（仕様の層）", "level": "仕様ゲート（Python）", "tool": "layer_audit --run／qa-ladder validate／error_catalog gate／skill_pkg_gate", "gate": "spec・G27〜G31", "ladder": "L1"},
    {"tier": "regression.task（そのタスクの L1 行）", "level": "正本の行", "tool": "qa-ladder gate --task <ブランチのタスク>", "gate": "task-gate・G32", "ladder": "L1"},
    {"tier": "L3〜L5（Wave・リリース・全体）", "level": "回帰（差分）", "tool": "completion_gate.sh／qa-coverage.py／負荷（k6・L4 のみ）", "gate": "締め（CI 外・手動起動）", "ladder": "L3-L5"},
]
# ---------------------------------------------------------------- EARS → test（1 文 1 test）
def slug(ep):
    m, p = ep.split(" ", 1); return (m.lower() + "_" + re.sub(r"[^a-z0-9]+", "_", p.lower().replace("/api/v1/", "")).strip("_"))
def classify(line):
    form = line.split(":")[0]; s = re.search(r"\b(401|403|404|409|410|413|422|429|500|502|503)\b", line); code = s.group(1) if s else ""
    if form == "EVENT-DRIVEN": return form, code, "contract+integration", "backend-coverage", "ok"
    if form == "UBIQUITOUS": return form, code, "contract", "backend-coverage", "shape"
    if "E-AUTH-010" in line: return form, code, "access（同意し直し・K-53）", "backend-access-matrix", "terms_pending"   # 役の 403 と混ぜない
    if "MFA_REQUIRED" in line: return form, code, "access（付けるまで進めない・K-321）", "backend-access-matrix", "mfa_pending"   # 役の 403 と混ぜない
    if code in ("401", "403"): return form, code, "access", "backend-access-matrix", "rejected_" + code
    if code == "429": return form, code, "unit", "backend-coverage", "rate_limited"
    if code == "413": return form, code, "unit（送る量の守り・1MB・D-130.1）", "backend-coverage", "too_large"   # K-144 回 11：体を受ける口の全部
    if code == "502": return form, code, "integration（外部を切る・G-15）", "backend-coverage", "upstream_failed"
    if code == "409": return form, code, "unit（冪等）", "backend-coverage", "conflict"
    if code == "404": return form, code, "unit", "backend-coverage", "not_found"
    if code == "410": return form, code, "unit（期限・使い終わり）", "backend-coverage", "gone"
    if code == "500": return form, code, "unit（途中の失敗・全部戻す）", "backend-coverage", "server_error"
    if code == "503" and "E-PAGE-003" in line: return form, code, "unit（入口でセッションを解けない・止める側に倒す・K-53）", "backend-coverage", "session_unresolved"   # 全部の口（K-144 回 6）
    if code == "503": return form, code, "結合（届かない・止める側に倒す・G-15）", "backend-coverage", "unavailable"   # K-144 回 6：前は 422 に分けていた
    return form, code, "unit（検証・表記ゆらぎ）", "backend-coverage", "rejected_422"
task_by_text = {}
for t in TASKS:
    for a in t["acceptance_criteria_inline"]["tier_2_functional"]: task_by_text.setdefault(a["text"], []).append(t["id"])
mappings = []; n = 0
for e in EARS:
    sl = slug(e["endpoint"]); seen = {}
    for line in e["ears_ac_seed"]:
        n += 1; form, code, level, gate, kind = classify(line); k = f"{kind}"; seen[k] = seen.get(k, 0) + 1; fn = f"test_{sl}_{k}" + (f"_{seen[k]}" if seen[k] > 1 else "")
        mappings.append({"test_id": f"TC-{n:03d}", "endpoint": e["endpoint"], "feature_id": e["feature_id"], "acts": e["acts"], "screens": e["screen_ids"], "ears_form": form, "http_code": code, "ears_text": line,
                         "test_file": f"apps/api/test/generated/{sl}.test.ts", "test_function": fn, "test_level": level, "gate": gate, "ladder": "L1", "tasks": task_by_text.get(line, [])})
json.dump({"version": "v3", "skill": "test-verification", "created_at": TODAY, "_doc": "08_api/ears-ac-seed.json の 1 文 = 1 test。05_flow/build_testplan.py が生成。tickets の tier_2 と同じ文なので、実装者は tasks の列で自分の分を引く",
           "generator": "packages/api/test/generate_from_ears.ts（EARS の文 → vitest/jest の骨組み。EVENT-DRIVEN=正常・UNWANTED=異常・UBIQUITOUS=契約の形）", "counts": {"endpoints": len(EARS), "tests": len(mappings), "by_form": {f: sum(1 for m in mappings if m["ears_form"] == f) for f in ("EVENT-DRIVEN", "UNWANTED", "UBIQUITOUS")}},
           "mappings": mappings}, open(f"{OUT}/ears-test-mapping.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- access matrix（RLS の policy × 場合）
CASES = {"select": [("同じ会社・見える範囲", "OK"), ("同じ会社・見えない層", "NG（0 行）"), ("他の会社（SET LOCAL を別テナントに）", "NG（0 行）"), ("SET LOCAL を飛ばす", "NG（0 行・エラー）")],
         "insert,update,delete": [("権限あり・自分の範囲", "OK"), ("権限なし（担当者・閲覧のみ）", "NG（403・副作用なし）"), ("他の会社", "NG（0 行・副作用なし）"), ("SET LOCAL を飛ばす", "NG（エラー）")]}
ROLE_JA = {"member": "会社の人（R1〜R4・権限で分かれる）", "ops": "運営（R6）", "authenticated": "ログイン済み（本人のもの）", "client": "取引先の人（クライアントの場所）"}
# 取引先の人：役が合わない・他の会社・文脈なしでは 0 行。自分の取引先の行が読める・書けることは packages/db/test/clients.test.ts で見る（先方の人の登録が要る）
CASES_CLIENT = [("取引先として登録されていない人が client の文脈で", "NG（0 行・副作用なし）"), ("他の会社（取引先の人）", "NG（0 行・副作用なし）"), ("SET LOCAL を飛ばす", "NG（0 行・エラー）")]
CASES_AUTH = [("ログイン済み（会社の人）", "OK"), ("SET LOCAL を飛ばす", "NG（0 行）")]
CASES_SYSTEM = [("関門の関数（app.record_*）から", "OK"), ("会社の人が直接 INSERT", "NG（弾く）"), ("UPDATE／DELETE（誰でも）", "NG（追記専用）")]
CASES_OPS_OWN = [("運営の文脈", "OK"), ("会社の人（自社の文脈）", "NG（0 行）"), ("SET LOCAL を飛ばす", "NG（0 行）")]
CASES_OPS_WRITE = [("運営の文脈", "OK"), ("会社の人（運営でない）", "NG（弾く・副作用なし）"), ("SET LOCAL を飛ばす", "NG（弾く）")]
am = []
# 業務の表（public）として作らない表は場合表に入れない（K-12）：ログインの部品の側（kaname_auth）と、ER 図で「段階 1 は作らない」と決めた表
NOT_PUBLIC = {"passkeys": "ログインの部品の側（kaname_auth・D-128.119）", "pending_signup": "ログインの部品の側（kaname_auth・D-088.2）"}
NOT_BUILT = {e["table_name"]: "段階 1 は作らない（D-099.2）" for e in EN if "段階 1 は作らない" in (e.get("note") or "")}
for en in EN:
    if en["table_name"] in NOT_PUBLIC or en["table_name"] in NOT_BUILT:
        continue
    for p in en["access_control_policies"]:
        cases = CASES_OPS_OWN if p["name"].endswith(("_ops_own", "_ops_all")) else CASES_SYSTEM if p["role"] == "system" else CASES_CLIENT if p["role"] == "client" else CASES_AUTH if p["role"] == "authenticated" else (CASES_OPS_WRITE if p["role"] == "ops" and p["operation"] != "select" else CASES.get(p["operation"], CASES["select"] if p["operation"] == "select" else CASES["insert,update,delete"]))
        for case, exp in cases:
            if p["role"] == "ops" and "他の会社" in case: exp = "NG（顧客が許可した範囲・期限の中だけ OK）"
            # 同じ表に「ログイン済みなら読める」（運営が全社に出す版・型）があれば、会社の人が読めるのはそちらの守り
            if p["name"].endswith(("_ops_own", "_ops_all")) and "会社の人" in case and any(x["role"] == "authenticated" and x["operation"] == "select" for x in en["access_control_policies"]):
                exp = "OK（全社向けの読みの policy で読める）"
            if p["name"].endswith("self_only_write") and "権限なし" in case: exp = "OK（自分の行だけ）・他人の行は NG"
            am.append({"entity": en["id"], "table": en["table_name"], "policy": p["name"], "role": p["role"], "role_ja": ROLE_JA.get(p["role"], p["role"]), "operation": p["operation"], "case": case, "expected": exp, "predicate": p["predicate"][:160], "source": p.get("source", [])})
json.dump({"version": "v3", "created_at": TODAY, "_doc": "entities.json の access_control_policies × 場合（見える範囲／見えない層／他の会社／SET LOCAL 無し／権限なし）。1 行 1 test。pnpm ci:access-matrix が全行を実 Postgres で流す",
           "counts": {"entities": len(EN), "policies": sum(len(e["access_control_policies"]) for e in EN), "cases": len(am)}, "cases": am}, open(f"{OUT}/access-matrix.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- CI ゲート（26 ＋ 仕様の層 ＋ タスク）
SPEC_GATES = [
    {"id": 27, "name": "層の棚卸し（G21）", "script": "set -o pipefail; mkdir -p \"$RUNNER_TEMP/gate-logs\"; python3 scripts/ci/layer_audit.py --run --db-range \"${CI_DB_RANGE:-true}\" 2>&1 | tee \"$RUNNER_TEMP/gate-logs/g27.log\"", "env": "          CI_DB_RANGE: ${{ steps.scope.outputs.db_range }}\n", "job": "spec", "blocking": True},   # DB の層は DB の範囲を触った回だけ（空は true＝流す・D-133.6）
    {"id": 28, "name": "正本 ↔ tickets の参照整合（qa-ladder validate）", "script": "python3 scripts/ci/qa-ladder.py validate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json", "job": "spec", "blocking": True},
    {"id": 29, "name": "エラー一覧 E1〜E9（引数を省かない）", "script": "python3 scripts/ci/error_catalog.py gate --catalog 07_qa/test-specs/errors.json --mocks 06_mockup/v1 --spec 07_qa/test-specs --choke 03_architecture/choke-points.json", "job": "spec", "blocking": True},
    {"id": 30, "name": "スキル一式 SK1〜SK6", "script": "python3 scripts/ci/skill_pkg_gate.py 10_skills", "job": "spec", "blocking": True},
    {"id": 31, "name": "テスト計画の整合 TV1〜TV8", "script": "python3 scripts/ci/tv_gate.py", "job": "spec", "blocking": True},
    {"id": 32, "name": "そのタスクの L1 行（ブランチ task/<ID>）", "script": "python3 scripts/ci/qa-ladder.py gate --spec 07_qa/test-specs --tickets 07_tasks/tickets.json --task \"$TASK_ID\"", "job": "task-gate", "blocking": True},
    {"id": 33, "name": "RLS の場合表（access-matrix.json 全行）", "script": "pnpm ci:access-matrix -- --matrix 07_qa/test-plan/access-matrix.json", "job": "database", "blocking": True},
    {"id": 34, "name": "EARS → test の対応（mapping の test が全部存在）", "script": "pnpm ci:ears-mapping -- --mapping 07_qa/test-plan/ears-test-mapping.json", "job": "database", "blocking": True},
    {"id": 35, "name": "有限資源の静的検査（G-16：関門外の生クライアント・タイムアウト無し・冪等キー無しの書込）", "script": "pnpm ci:resource-static", "job": "static", "blocking": True},
    {"id": 36, "name": "契約 fuzz（Schemathesis・openapi.yaml・作った口を本物の DB の上で叩く。答えの形の元の DB の列の書き出しも確かめる）", "script": "pnpm ci:schemathesis", "job": "database", "blocking": True},
    {"id": 37, "name": "デザインのトークンと新しい部品（正本どおり・明るい／暗いのコントラスト AA・生の値 D1〜D4・部品の値 D5・文字の段 D6／D7・プレビュー）", "script": "python3 04_design/gen_tokens.py --web --check && python3 04_design/gen_preview.py --check && python3 scripts/ci/design_gate.py --design 04_design/DESIGN-kaname.md --mocks apps/web/components/k apps/web/features --css apps/web/styles/k-tokens.css --part --scales --usage apps/web apps/bridge/src && python3 scripts/ci/k218_design_canvas_test.py", "job": "spec", "blocking": True},
    {"id": 38, "name": "生成物が全部最新（作り手を全部回して、中身が変わる生成物・落ちる作り手・目録に無い生成物を赤にする・D-128.123）", "script": "python3 scripts/ci/generated_gate.py --selftest && python3 scripts/ci/generated_gate.py", "job": "spec", "blocking": True},
    {"id": 46, "name": "使っている部品が技術の選定の記録と合う（package.json と selected-stack.json の packages を 1 対 1・D-128.123）", "script": "python3 scripts/ci/stack_gate.py --selftest && python3 scripts/ci/stack_gate.py --base-ref \"$CI_BASE\"", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "spec", "blocking": True},
    {"id": 47, "name": "書いた検査が CI から回る・検査の自己試験（ci_wiring_gate・エラーの参照・自己試験・D-128.123）", "script": gate_cmds.script(Path("scripts/ci/g47.d")), "job": "spec", "blocking": True},
    {"id": 51, "name": "利用者の流れと DB の表の目録（行為はどれも 1 つの流れ・表はどれも目録に・凍結の表をコードが使わない・D-128.126・D-128.127）", "script": "python3 scripts/ci/flow_db_gate.py --selftest && python3 scripts/ci/flow_db_gate.py", "job": "spec", "blocking": True},
    {"id": 48, "name": "新しい画面の実ブラウザの試験と、押した証拠（本番の形で組み立てた画面の上・行 ID の試験が全部の行で通る・記録なし・K-36。今の回の報告から結果の記録を作り、結果が空の行は今の回の報告で確かめる・K-143）", "script": "BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py g48", "env": "          CI_FULL: ${{ needs.static.outputs.full }}\n          CI_WEB_SPECS: ${{ needs.static.outputs.web_g48 }}\n          CI_WEB_OTHER: ${{ needs.static.outputs.web_g59 }}\n          CI_WEB_TASKS: ${{ needs.static.outputs.web_tasks }}\n          CI_WEB_GATES: ${{ needs.static.outputs.web_gates }}\n", "job": "web", "blocking": True},
    {"id": 59, "name": "中間テスト（いくつかのチケットを合わせた一続きの操作・本物のブラウザと本物の口と DB・試験用の受け箱・K-54 から）", "script": "PLAYWRIGHT_JUNIT_OUTPUT_NAME=\"$GITHUB_WORKSPACE/junit/web-skeleton.xml\" BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py g59", "env": "          CI_FULL: ${{ needs.static.outputs.full }}\n          CI_WEB_SPECS: ${{ needs.static.outputs.web_g59 }}\n          CI_WEB_OTHER: ${{ needs.static.outputs.web_g48 }}\n          CI_WEB_GATES: ${{ needs.static.outputs.web_gates }}\n", "job": "web", "blocking": True},
    {"id": 70, "name": "キャンバスとの見た目の突き合わせ（入れた組・幅ごと・値の読み方を data: の頁で確かめる・K-238）", "script": "PLAYWRIGHT_JUNIT_OUTPUT_NAME=\"$GITHUB_WORKSPACE/junit/web-fidelity.xml\" BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py gate 70", "env": "          CI_FULL: ${{ needs.static.outputs.full }}\n          CI_WEB_GATES: ${{ needs.static.outputs.web_gates }}\n          CI_WEB_SPECS: ${{ needs.static.outputs.web_g48 }}\n          CI_WEB_OTHER: ${{ needs.static.outputs.web_g59 }}\n", "job": "web", "blocking": True},    {"id": 73, "name": "Bridge の輪が Chrome を動かす通しの画面の試験（組み立てた Bridge・頭なしの Chrome・的のログイン画面・K-379）", "script": "PLAYWRIGHT_JUNIT_OUTPUT_NAME=\"$GITHUB_WORKSPACE/junit/web-bridge.xml\" BASE_URL=http://127.0.0.1:3124 python3 scripts/ci/web_run.py gate 73", "env": "          CI_FULL: ${{ needs.static.outputs.full }}\n          CI_WEB_GATES: ${{ needs.static.outputs.web_gates }}\n          CI_WEB_SPECS: ${{ needs.static.outputs.web_g48 }}\n          CI_WEB_OTHER: ${{ needs.static.outputs.web_g59 }}\n", "job": "web", "blocking": True},
]
SPEC_GATES.append({"id": 53, "name": "試験はどれも 1 つのチケットに属する（単体の試験・実ブラウザの試験・口ごとの権限の試験の持ち主・D-128.140）", "script": "python3 scripts/ci/test_owner_gate.py --selftest && python3 scripts/ci/test_owner_gate.py", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 54, "name": "決定のトレース（決定ログの決めたことが導出物から逆引きできる・T1〜T12。手で流していたのを CI に入れた・D-128.147）", "script": "cp 01_hearing/要件一覧.md $RUNNER_TEMP/req.md && python3 scripts/ci/trace_gate.py --index && cmp $RUNNER_TEMP/req.md 01_hearing/要件一覧.md && python3 scripts/ci/trace_gate.py", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 55, "name": "No Ticket, No Commit（コミットにチケットの番号・D-128.147・K-47）", "script": "python3 scripts/ci/ticket_commit_gate.py --selftest && python3 scripts/ci/ticket_commit_gate.py", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 56, "name": "取り込む順（depends_on の実装が先に枝にある・K-94）", "script": "python3 scripts/ci/k341_order_gate_speed_test.py && python3 scripts/ci/ticket_order_gate_test.py && python3 scripts/ci/ticket_order_gate.py --selftest && python3 scripts/ci/ticket_order_gate.py --base-ref \"$CI_BASE\"", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 62, "name": "CI の無駄を止める台本の試験（範囲の表の spec・層の棚卸しの elsewhere・部品の出た日の記録・K-156）", "script": "python3 scripts/ci/ci_lean_test.py", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 57, "name": "チケットの CI の範囲の台本の試験（K-107）", "script": "python3 scripts/ci/ci_scope_test.py && python3 scripts/ci/ticket_affects_test.py", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 60, "name": "決める人の決定の行が、決める人への問い合わせの答えの記録と結びつく（130 番の決定から照らす・129 番までは答えの記録が無いので外す・K-103・L-014）", "script": "python3 scripts/ci/decision_source_gate.py --selftest && python3 scripts/ci/decision_source_gate.py --log 01_hearing/決定ログ_進行中.md --answers 01_hearing/decider-answers.jsonl --label 高本さん --since D-130", "job": "spec", "blocking": True})
# 決める人の答えの記録を写しで上書きして落としていないか（本線との分かれ目と比べる・全部を流す回は取り込む先と比べる）と、
#   着手前のチケットの期待結果が起きる結果で書かれ、別のチケットに回した機能の間が書かれているか（K13・K14）。G60 の隣（K-146・D-129.52）。
#   base と取り込む先は組の出力・入力なので run の命令の文字に入れず env で渡す（K107-CS-034）
SPEC_GATES.append({"id": 63, "name": "決める人の答えの記録は和で移す（前の版にあった答えを落としていない・比べる版が読めない・無いなら赤・K-146）", "script": "python3 scripts/ci/answers_merge.py --selftest && python3 scripts/ci/answers_merge.py check 01_hearing/decider-answers.jsonl --base \"$CI_ANSWERS_BASE\" --target \"$CI_TARGET_REF\"", "env": "          CI_ANSWERS_BASE: ${{ steps.scope.outputs.base }}\n          CI_TARGET_REF: ${{ inputs.target || github.event.repository.default_branch }}\n", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 64, "name": "着手前のチケットの期待結果は起きる結果で・別のチケットに回した機能はそれまでの間を書く（K13・K14・K-146・D-129.52）", "script": "python3 scripts/ci/ticket_rows_gate.py --selftest && python3 scripts/ci/ticket_process_test.py && python3 scripts/ci/ticket_rows_ci.py", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 65, "name": "CI の形の試験（DB は組の中で・重い検査もチケットの範囲だけ・JUnit の記録・K-172／組ごとの Linux の VM・K-173）", "script": gate_cmds.script(Path("scripts/ci/g65.d"), last=G65_LAST), "job": "spec", "blocking": True})
# コミットの名義（author のメールのドメイン）が配る側のチームの物でなければ赤（K-206）。static の組＝出す前の手元の検査でも流れる。
#   比べる元は範囲の段（G0）の出力なので run の命令の文字に入れず env で渡す
SPEC_GATES.append({"id": 66, "name": "コミットの名義がチームの物（本線との差分のコミットの author のメールのドメイン・K-206）", "script": "python3 scripts/ci/author_gate.py --base-ref \"$CI_BASE\"", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "static", "blocking": True})
# 画面の JSX のクラスがどの CSS にも在るか・外枠（components/k/shell.css）の決まりを本文で使っていないか・新しい層に CSS の外の見た目を書いていないか（K-214）。
#   今ある赤は台帳 scripts/ci/class_ledger.json で通し、台帳は本線との分かれ目（G0 の base）と比べて減らすだけ。base は env で渡す（K107-CS-034）
SPEC_GATES.append({"id": 67, "name": "画面のクラスが CSS に在る・外枠の決まりを本文で使わない（台帳は減らすだけ・K-214）", "script": "python3 scripts/ci/class_gate.py --selftest && python3 scripts/ci/class_gate.py --ledger-base-ref \"$CI_BASE\" && python3 scripts/ci/k214_class_gate_test.py", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 68, "name": "画面のチケットに正のモック（突き合わせの組）・組の持ち主と両向き（台帳は減らすだけ・K-215・D-143.5）", "script": "python3 scripts/ci/canvas_field_gate.py --ledger-base-ref \"$CI_BASE\" --ticket \"$CI_TICKET\" && python3 scripts/ci/k215_canvas_field_test.py && python3 scripts/ci/k300_mock_field_test.py", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n          CI_TICKET: ${{ inputs.ticket }}\n", "job": "spec", "blocking": True})
SPEC_GATES.append({"id": 69, "name": "キャンバスとの突き合わせの設定（段 1 の組・要る要素と値・入れた組は外せず弱められない・入っていない組の数と持ち主が取り込み済みなのに入っていない組・自己試験と K-216 の試験は G65・K-238）", "script": "python3 scripts/ci/fidelity_config.py --base-ref \"$CI_BASE\" && python3 scripts/ci/fidelity_config.py --owners-done --base-ref \"$CI_BASE\" ${CI_TICKET:+--ticket \"$CI_TICKET\"} && python3 scripts/ci/k238_fidelity_ci_test.py", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n          CI_TICKET: ${{ inputs.ticket }}\n", "job": "spec", "blocking": True})
# キャンバスの絵の値（色・書体・角丸・文字の大きさ）が正本の段に在る（D1〜D4 が 0。D6 は知らせ・D5 は掛けない・K-254）。
#   幅の台帳は本線との分かれ目（G0 の base）と比べて減らすだけ。base は env で渡す（G67 と同じ形・命令の注入を防ぐ）
#   同じ段でこのチケットの試験も流す（幅の台帳の上限と作り手の流し直し。tests: の .py はチケットの回でしか流れない・G37 の末尾の K-218 と同じ形）
SPEC_GATES.append({"id": 71, "name": "キャンバスの値が正本の段（色・書体・角丸・文字）・幅の台帳は減らすだけ・台帳の形と作り手の流し直し（K-254）", "script": "python3 scripts/ci/canvas_design_gate.py --ledger-base-ref \"$CI_BASE\" && python3 scripts/ci/k254_canvas_values_test.py", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "spec", "blocking": True})
# 画面の CSS の生の長さ（D8・K-261）：大きさ・余白・間・行の高さ・影・枠の太さなどにトークンを通らない生の値が無い。
#   今ある値は台帳 scripts/ci/raw_length_ledger.json で通し、台帳は本線との分かれ目（G0 の base）と比べて減らすだけ。base は env で渡す（G67 と同じ形）。
#   G37 に混ぜない（K218-DS-025 が G37 の命令を CI_BASE 無しで流す）。同じ段でこのチケットの試験も流す（G71 と同じ形）
SPEC_GATES.append({"id": 72, "name": "画面の CSS の生の長さ（大きさ・余白・間・行の高さ・影・枠の太さが正本のトークンを通る・D8・台帳は減らすだけ・K-261）", "script": "python3 scripts/ci/design_gate.py --design 04_design/DESIGN-kaname.md --mocks apps/web/components/k apps/web/features --css apps/web/styles/k-tokens.css --part --no-components --raw-lengths --ledger-base-ref \"$CI_BASE\" && python3 scripts/ci/k261_raw_lengths_test.py", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "spec", "blocking": True})
# 共通の台帳の本体（05_flow/screen_api.py の表・08_api/phase1/*.md の表）に、葉が直に行を足していないか（K-1112）。足す分は葉ごとのファイル
#   （screen_api.d/K-<番号>.py・<名前>.d/K-<番号>.md）。本線との分かれ目（G0 の base）からのコミット 1 つずつを見る。base は env で渡す（G67 と同じ形）
SPEC_GATES.append({"id": 74, "name": "共通の台帳の本体に葉が直に行を足さない（足す分は葉ごとのファイル .d・猶予の台帳は減らすだけ・K-1112）", "script": "python3 scripts/ci/body_append_gate.py --base-ref \"$CI_BASE\" && python3 scripts/ci/api_doc_d.py --check && python3 scripts/ci/k1112_body_append_test.py", "env": "          CI_BASE: ${{ steps.scope.outputs.base }}\n", "job": "spec", "blocking": True})
# 試験の結果の欄は CI の記録から機械で書く。印の無い PASS は台帳の行だけ・台帳は本線との分かれ目（static の G0 が出す base）と比べて減らすだけ（K-143・D-129.51）。
#   base は組の出力なので run の命令の文字に入れず env で渡す（CS-034・命令の注入を防ぐ）
SPEC_GATES.append({"id": 61, "name": "試験の結果の欄の PASS は CI の記録から書いたものだけ（手で書いた PASS は赤・印の無い古い PASS は台帳に載った行だけ・台帳は減らすだけ・K-143・D-129.51）", "script": "python3 scripts/ci/ci_results_test.py && python3 scripts/ci/ci_results_ledger_test.py && python3 scripts/ci/ci_results.py check --specs '07_qa/test-specs/**/*.md' --records 07_qa/ci-results --ledger 07_qa/test-plan/result-ledger.json --ledger-base-ref \"$CI_LEDGER_BASE\" --target-ref \"$CI_TARGET_REF\"", "env": "          CI_LEDGER_BASE: ${{ steps.scope.outputs.base }}\n          CI_TARGET_REF: ${{ inputs.target || github.event.repository.default_branch }}\n", "job": "spec", "blocking": True})
# CI の台。変数 CI_RUNNER が無ければ今までの Mac の VM（K-640）
RUNS_ON = "${{ fromJSON(vars.CI_RUNNER || '[\"self-hosted\",\"linux-vm\"]') }}"
# spec の組を 3 つに分けて static の後に同時に流す（K-323）。段の名前・命令・if は変えず、置く組だけを変える。
#   実測（2026-11-18 の緑の 3 回の中央値・秒）：G56 281・G67 147・G65 110・G57 41・G27 10・ほか 21 段は合計 約 50・組の準備 約 40。
#   いちばん重い G56 を 1 組（spec-2）、次の G67 を 1 組（spec-3）、残りは spec（前からの試験が spec の組に置くと決めている段は全部ここ）。
#   どの組も spec と同じ準備（部品・DB・本線との分かれ目 scope）を持ち、scope の出力は自分の組の段から同じ入力で出す（組をまたいで渡さない）
SPEC_GROUP = {56: "spec-2", 67: "spec-3"}
SPEC_GROUPS = ["spec", "spec-2", "spec-3"]
SPEC_GATES = [{**g, "job": SPEC_GROUP.get(g["id"], g["job"])} for g in SPEC_GATES]
# ---------------------------------------------------------------- 単体の試験（G3）を 6 つに分けて同時に流す（D-128.140）
#   全部（回帰）は取り込みの前だけ。分けた 1 つずつが自分の Postgres を持ち（GitHub でも act でも job ごと・DB の番号は割り当て）、
#   結果（vitest の blob。coverage も入る）を unit が集めて合わせ、同じ閾値（vitest.config.ts）を合わせた結果に当てる。
#   分けた側は閾値を当てない（1 つ分の coverage は足りなくて当たり前）
# チケットの CI の範囲（K-107・D-128.169）：static の G0（scripts/ci/ci_scope.py）が、変えたファイルから流す組・試験・組の数を決める。
#   入力 scope の既定は full（GitHub で手で押したとき・入力を渡さないときは全部）。act_ci.sh が scope=auto を渡した回だけ絞る。
#   ★外から来る値（入力・static の出力）は run の命令の文字に入れない。env に渡し、ci_scope.py が JSON で読んで引数の並びで流す
UNIT_SHARDS = 6
UNIT_DIR = ".vitest-reports"
SO = "needs.static.outputs"
UNIT_ENV = (f"          CI_UNIT_FILES: ${{{{ {SO}.unit_files }}}}\n          CI_COVERAGE_ARGS: ${{{{ {SO}.coverage_args }}}}\n"
            f"          CI_UNIT_SHARDS: ${{{{ {SO}.unit_shards }}}}\n")
UNIT_MERGE = ('[ -n "$CI_UNIT_SHARDS" ] || { echo "★ FAIL static の出力が空（G0 が流れていない）"; exit 1; }\n'
              'if [ "$CI_UNIT_SHARDS" = "0" ]; then echo "流す試験 0 本（チケットの CI の範囲・G0）"; exit 0; fi\n'
              f'n=$(ls {UNIT_DIR}/blob-*-"$CI_UNIT_SHARDS".json 2>/dev/null | wc -l)\n'
              '[ "$n" -eq "$CI_UNIT_SHARDS" ] || { echo "★ FAIL 分けた単体の試験の結果が $CI_UNIT_SHARDS つのうち $n つしか無い"; exit 1; }\n'
              f"python3 scripts/ci/ci_scope.py run-merge && python3 scripts/ci/ci_scope.py check-count --report {UNIT_DIR}/merged.json\n")
SCOPE_STEP = ('      - name: "G0 チケットの CI の範囲（変えたファイル → 依存の地図 → 流す組と試験・K-107）"\n        id: scope\n'
              "        env:\n          CI_SCOPE_INPUT: ${{ inputs.scope || 'full' }}\n          CI_BASE_INPUT: ${{ inputs.base }}\n          CI_TICKET_INPUT: ${{ inputs.ticket }}\n"
              '        run: python3 scripts/ci/ci_scope.py --base "$CI_BASE_INPUT" --head HEAD --scope "$CI_SCOPE_INPUT" --ticket "$CI_TICKET_INPUT" --github-output "$GITHUB_OUTPUT"\n')
# spec の段が自分で出す本線との分かれ目（static を待たないため。入力は static の G0 と同じ・値は env で渡す・K-143）
SPEC_SCOPE_STEP = ('      - name: "本線との分かれ目を出す（spec の段が自分で・static を待たない・G61 が読む・K-143）"\n        id: scope\n'
                   "        env:\n          CI_SCOPE_INPUT: ${{ inputs.scope || 'full' }}\n          CI_BASE_INPUT: ${{ inputs.base }}\n          CI_TICKET_INPUT: ${{ inputs.ticket }}\n"
                   '        run: python3 scripts/ci/ci_scope.py --base "$CI_BASE_INPUT" --head HEAD --scope "$CI_SCOPE_INPUT" --ticket "$CI_TICKET_INPUT" --github-output "$GITHUB_OUTPUT"\n')
SCOPE_OUTPUTS = "    outputs:\n" + "".join(f"      {k}: ${{{{ steps.scope.outputs.{k} }}}}\n" for k in
                                         ("full", "unit", "database", "web", "unit_shards", "unit_files", "migration_files", "coverage_args", "base", "gates", "py_tests",
                                          "web_g48", "web_g59", "web_gates", "web_tasks"))
SQUAWK_STEP = ('      - name: "G58 migration の lint（Squawk・変えた・足した migration だけ・K-107）"\n        if: ${{ !cancelled() }}\n'
               f"        env:\n          CI_MIGRATION_FILES: ${{{{ {SO}.migration_files }}}}\n          CI_BASE: ${{{{ {SO}.base }}}}\n"
               "        run: python3 scripts/ci/ci_scope.py run-squawk\n")
# 画面の組み立ての型の確かめ（K-631）：チケットの CI が画面の試験を後回しにする回（web=defer）でも、next build が見る型（route の型＋tsc）は流す。
#   web=run の回は web の組の next build（build:test）が同じ型を見るので流さない（二重にしない）。出す前の手元の検査は web の入力を渡さない（空）ので、
#   ここ（static）で流れる。DB もブラウザも要らない軽い段（11 秒ほど）。typegen の出力先は build:test と同じ .next-prod：
#   tsconfig は .next を除き .next-prod/types だけを数えるので、揃えないと Link の型（link.d.ts）とページの型（validator.ts）が tsc に入らない。G0（id: scope）より後ろに置く
WEB_TYPES_STEP = ('      - name: "画面の型の確かめ（next typegen ＋ tsc・web=defer の回も画面の組み立ての型は流す。web=run の回は web の組の next build が同じ型を見る・K-631）"\n'
                  "        if: ${{ !cancelled() && steps.scope.outputs.web == 'true' && inputs.web != 'run' }}\n"
                  "        run: NEXT_DIST_DIR=.next-prod pnpm --filter @kaname/web exec next typegen && pnpm --filter @kaname/web exec tsc --noEmit\n")
def unit_if(i): return f"!cancelled() && {SO}.unit == 'true'" + (f" && fromJSON({SO}.unit_shards) >= {i}" if i > 1 else "")
ALL_GATES = [{**g, "job": "unit" if g["id"] == 3 else ("database" if g["id"] in (4, 6, 12) else ("e2e" if g["id"] == 15 else "static"))} for g in FG["merge_gates"]] + SPEC_GATES
ALL_GATES = [{**g, "script": UNIT_MERGE, "env": UNIT_ENV + f"          CI_FULL: ${{{{ {SO}.full }}}}\n", "name": g["name"] + f"（分けて流した結果を合わせ、閾値を当て、決めた試験が全部流れたかを見る）"} if g["id"] == 3 else g for g in ALL_GATES]
def yrun(script): return json.dumps(script, ensure_ascii=False) if re.search(r"[{}\[\]]|: |^[!&*|>%@`#]", script) else script   # YAML の素の値にできない命令は "…" で
# 重い検査（K-172・D-133.7）：scope=ticket では、範囲の台本の出力 gates（",27,57," の形）に入っているときだけ流す。scope=full は全部。
#   G27 は spec の「層の棚卸し」（static にも同じ番号の別の段がある）。database の組は static の出力、spec の組は自分の scope の段を見る
HEAVY = {27: "spec", 36: "database", 38: "spec", 47: "spec", 56: "spec-2", 57: "spec", 62: "spec"}   # G56 は spec-2 の組（K-323）
def gate_if(g):
    if HEAVY.get(g["id"]) != g["job"]:
        return "!cancelled()"
    src = "needs.static.outputs" if g["job"] == "database" else "steps.scope.outputs"
    return f"!cancelled() && ({src}.full == 'true' || contains({src}.gates, ',{g['id']},'))"
def step(g): return f'      - name: "G{g["id"]} {g["name"]}{" [CRITICAL]" if g["id"] in FG.get("kaname_critical_gates", []) else ""}"\n        if: ${{{{ {gate_if(g)} }}}}\n' + (f"        env:\n{g['env']}" if g.get("env") else "") + (f"        run: |\n" + "".join(f"          {l}\n" for l in g["script"].rstrip("\n").split("\n")) if "\n" in g["script"] else f"        run: {yrun(g['script'])}\n")   # 前の検査が赤でも次の検査を流す（赤を全部いっぺんに見る。job は赤のまま）
# DB は組ごとに違う固定の番号を台に出す（K-47）。GitHub は組ごとに別の台なので番号は何でもよく、act は 1 台で組を同時に流し、
#   組の容れ物を台の網に置く（DB には localhost:番号 でしかつながらず、割り当てた番号も渡さない）ので、組ごとに番号を分ける。
#   database 5432・unit-<i> 5432+i・spec 5439
def pg(port):
    """K-172：services は Linux の台でしか動かない。DB は組の中で立てる（DB_START・DB_STOP）。組の頭には何も足さない"""
    return ""
# 容れ物の名前に回と組の印・番号は空いているもの・pg_isready で待つ（時間切れは赤）・DATABASE_URL は GITHUB_ENV だけで渡す
# 待つのは TCP で（初めの立ち上げの仮の server は socket だけで「準備よし」を返し、その後止まる・K-172 の CI で踏んだ）
DB_START = """      - name: DB を立てる（組の中・空いている番号・K-172）
        env: { PG_NAME: "kaname-ci-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.job }}" }
        run: |
          python3 scripts/ci/ci_db_sweep.py --keep "$PG_NAME"   # 台が落ちた回の残りを消す（6 時間を過ぎた kaname-ci- だけ）
          docker run -d --rm --name "$PG_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=kaname_test -p 127.0.0.1::5432 pgvector/pgvector:pg16 >/dev/null
          port=$(docker port "$PG_NAME" 5432/tcp | head -1 | sed 's/.*://')
          for i in $(seq 1 60); do docker exec "$PG_NAME" pg_isready -h 127.0.0.1 -U postgres -q && break; sleep 1; done
          docker exec "$PG_NAME" pg_isready -h 127.0.0.1 -U postgres -q || { echo "★ DB が 60 秒で立ち上がらない"; exit 1; }
          { echo "PG_NAME=$PG_NAME"; echo "PGPORT=$port"; echo "DATABASE_URL=postgres://postgres:postgres@localhost:$port/kaname_test"; echo "DATABASE_URL_ADMIN=postgres://postgres:postgres@localhost:$port/kaname_test"; } >> "$GITHUB_ENV"
"""
DB_STOP = """      - name: DB を消す（赤でも必ず）
        if: always()
        run: docker rm -f "kaname-ci-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.job }}" >/dev/null 2>&1 || true
"""
# GitHub の台（ubuntu-24.04）に無い lsof を、入っていなければ入れる（Mac の箱の像には在るので何も呼ばない・K-641）。更新が落ちたら入れるに進まない
TOOLS_STEP = """      - name: 台の道具をそろえる（lsof・入っていれば飛ばす・K-641）
        run: command -v lsof >/dev/null 2>&1 || { sudo apt-get update -qq && sudo apt-get install -y -qq lsof; }
"""
# Python の部品は台に置いた venv（回をまたいで使い回す・組の中で pip install しない）
VENV = ("      - uses: actions/setup-python@v5   # VM の Python は 3.12。GitHub の台と同じく版を用意する（K-173）\n"
        "        with: { python-version: '3.14' }\n"
        "      - run: bash scripts/ci/ci_venv.sh\n")
# 準備の時間切れ（Hook timed out）を、ほかの赤と見分けて 1 行で出す（組が赤のときだけ・組の赤は変えない・自動で流し直さない・K-193）。
#   spec の組の vitest は層の棚卸し（G27）の中で流れ JUnit を残さないので、G27 の出力の写し（gate-logs）も読む
def hook_note(*more): return ("      - name: 準備の時間切れを見分ける（Hook timed out の赤を 1 行で出す・K-193）\n        if: ${{ failure() }}\n"
                              f"        run: python3 scripts/ci/hook_timeout.py note {' '.join(('junit',) + more)}\n")
def junit_up(job): return f"""      - uses: actions/upload-artifact@v4
        if: always()
        with: {{ name: junit-{job}, path: junit/, if-no-files-found: error, retention-days: 7 }}
"""
NODE = "      - uses: actions/checkout@v4\n        with: { fetch-depth: 0 }\n      - uses: pnpm/action-setup@v4\n        with: { dest: '${{ runner.tool_cache }}/setup-pnpm' }   # 置き場は runner ごと（同じ台の runner が同時に ~/setup-pnpm を取り合う・K-172）\n      - uses: actions/setup-node@v4\n        with: { node-version: '${{ env.NODE_VERSION }}' }   # 自分の台は部品が台に残る：GitHub の cache に上げ下ろししない（K-172）\n      - run: pnpm install --frozen-lockfile\n" + VENV
PYS = "      - uses: actions/checkout@v4\n" + VENV
UNIT_JOBS = "".join(f"""  unit-{i}:
    runs-on: {RUNS_ON}
    # 単体の試験の {i}/{UNIT_SHARDS}（自分の Postgres の上で。結果は unit が合わせる・D-128.140）。組の数・流す試験は static の G0 が決める（K-107）
    needs: [static]
    if: ${{{{ {unit_if(i)} }}}}
    steps:
{NODE}{DB_START}      - name: "G3.{i} 単体の試験の {i} 組目（自分の DB の上で。coverage の閾値は合わせた後に当てる）"
        if: ${{{{ !cancelled() }}}}
        env:
{UNIT_ENV}        run: python3 scripts/ci/ci_scope.py run-unit --shard {i}
      - uses: actions/upload-artifact@v4
        if: ${{{{ !cancelled() }}}}
        with: {{ name: vitest-blob-{i}, path: {UNIT_DIR}/, include-hidden-files: true, retention-days: 1 }}
{hook_note()}{junit_up(f"unit-{i}")}{DB_STOP}""" for i in range(1, UNIT_SHARDS + 1)) + f"""  unit:
    runs-on: {RUNS_ON}
    # 分けた単体の試験の結果を合わせ、coverage の閾値（vitest.config.ts）を合わせた結果に当てる（DB は要らない）
    needs: [static, {", ".join(f"unit-{i}" for i in range(1, UNIT_SHARDS + 1))}]
    if: ${{{{ !cancelled() }}}}
    steps:
{NODE}      - uses: actions/download-artifact@v4
        if: ${{{{ {SO}.unit == 'true' }}}}
        with: {{ pattern: vitest-blob-*, path: {UNIT_DIR}, merge-multiple: true }}
{''.join(step(g) for g in ALL_GATES if g['job'] == 'unit')}"""
# spec-2・spec-3（K-323）：spec と同じ準備と分かれ目の段・自分の検査の段・DB を消す段。Python の試験・JUnit は spec の組だけ（この組は JUnit を書かない）
SPEC_MORE = "".join(f"""
  {job}:
    runs-on: {RUNS_ON}
    # spec の組を分けた 1 つ（K-323）。待ち方と準備は spec と同じ（static の後・static が赤でも飛ばさない・本線との分かれ目は自分で出す）
    needs: [static]
    if: ${{{{ !cancelled() }}}}
    steps:
{NODE}{DB_START}{SPEC_SCOPE_STEP}{''.join(step(g) for g in ALL_GATES if g['job'] == job)}{DB_STOP}""" for job in SPEC_GROUPS[1:])
yml = f"""# .github/workflows/v3-gate.yml — Kaname CI ゲート {len(ALL_GATES)} 本（05_flow/build_testplan.py が生成。手で直さない）
# 方針: {FG['policy']}
# 段: static（静的・関門）→ database（実 Postgres・RLS・契約）／ unit-1〜unit-{UNIT_SHARDS}（単体の試験を分けて同時に・それぞれ自分の Postgres）→ unit（合わせて coverage の閾値）／ spec・spec-2・spec-3（仕様の層・重い G56 と G67 を別の組に分けて同時に・K-323）／ task-gate（そのタスクの L1 行）→ auto-merge。staging を指す統合テスト（G15）はここに無い：別の定義 staging-e2e.yml を main から手で起こす（K-204）
# GitHub の上では自動で流さない（D-128.135）。CI はこの workflow をそのまま手元で act で流す（D-128.147・K-47）。GitHub では手で押したときだけ動く
# G0（static の 5 段目）：チケットの CI の範囲（K-107・D-128.169）。全部は scope=full（既定）。act_ci.sh が scope=auto・base を渡した回だけ、
#   unit-1〜6・database・web を影響の範囲に絞る（static・spec は毎回）。外から来る値は env で渡す（run の命令の文字に入れない）
name: v3-gate
on:
  workflow_dispatch:
    inputs:
      scope:
        description: "CI の範囲（ticket＝そのチケットの中身だけ・full＝全部。全部は大分類の統合のときだけ・ticket-flow）"
        type: choice
        options: [ticket, full]
        default: full
      ticket:
        description: "チケットの番号（scope=ticket のとき。コミットのチケットの番号と違えば止める）"
        type: string
        default: ''
      base:
        description: "比べる元（40 桁のコミット。auto のときだけ使う）"
        type: string
        default: ''
      target:
        description: "取り込む先の枝の名前（G61 が比べる元の先祖かを確かめる。act_ci.sh が台の側で決めて渡す・枝の中のファイルから読まない・K-143）"
        type: string
        default: ''
      web:
        description: "画面の試験の組（web）を流すか。defer ならこの回は流さず、鎖の終わりに同じチケットの版でまとめて流す（ticket-flow の ci.py web）"
        type: choice
        options: [run, defer]
        default: run
concurrency:
  group: ${{{{ github.workflow }}}}-${{{{ github.ref }}}}
  cancel-in-progress: true
env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
jobs:
  static:
    runs-on: {RUNS_ON}
{SCOPE_OUTPUTS}    steps:
{NODE}{SCOPE_STEP}{''.join(step(g) for g in ALL_GATES if g['job'] == 'static')}{WEB_TYPES_STEP}
  database:
    runs-on: {RUNS_ON}
    needs: [static]
    if: ${{{{ !cancelled() && {SO}.database == 'true' }}}}
    steps:
{NODE}{DB_START}{SQUAWK_STEP}{''.join(step(g) for g in ALL_GATES if g['job'] == 'database')}{hook_note()}{DB_STOP}
{UNIT_JOBS}  spec:
    runs-on: {RUNS_ON}
    # static の後に流す（act は needs の無い組を 1 段目にまとめて段ごとに流すので、needs が無いと spec が static と並び、
    #   database・unit・web が spec の終わりまで待つ・K-156）。static が赤でも飛ばさない（K-143）のは if の !cancelled() で守る。
    #   G61 が要る本線との分かれ目（base）は、この段の中で同じ scope の台本を流して自分で出す（static の G0 と同じ入力・PM の判断 2026-11-08 17:40）
    needs: [static]
    if: ${{{{ !cancelled() }}}}
    # 仕様の層の検査は Python だけでなく pnpm の検査と DB の検査も呼ぶ（層の棚卸し G21）。database と同じ Postgres を付ける
    steps:
{NODE}{DB_START}{SPEC_SCOPE_STEP}      - name: "チケットの Python の試験（tests: の .py を JUnit に・K-172）"
        if: ${{{{ !cancelled() }}}}
        env:
          CI_PY_TESTS: ${{{{ steps.scope.outputs.py_tests }}}}
        run: python3 scripts/ci/junit_unittest.py --out junit/spec-py.xml --files-json "$CI_PY_TESTS"
{''.join(step(g) for g in ALL_GATES if g['job'] == 'spec')}{hook_note('"$RUNNER_TEMP/gate-logs"')}{junit_up("spec")}{DB_STOP}{SPEC_MORE}
  task-gate:
    runs-on: {RUNS_ON}
    if: github.event_name == 'pull_request' && startsWith(github.head_ref, 'task/')
    needs: [{', '.join(SPEC_GROUPS)}]
    steps:
{PYS}      - name: "ブランチ名からタスク ID を取る（task/T-A-01 → T-A-01）"
        run: echo "TASK_ID=${{{{ github.head_ref }}}}" | sed 's#task/##' >> "$GITHUB_ENV"
{''.join(step(g) for g in ALL_GATES if g['job'] == 'task-gate')}
  web:
    runs-on: {RUNS_ON}
    # 新しい画面（apps/web/components/k の上）の実ブラウザの試験。staging も札も要らない：CI の中で本番の形に組み立てて立ち上げる（K-36）
    needs: [static]
    # 入力 web=defer の回は組ごと流さない（チケットの CI で画面の試験を後回しにし、取り込んだ後に ci.py web が web=run で流す・K-258）。
    #   入力が空の回（push・入力を渡さない回）は今までどおり流れる
    if: ${{{{ !cancelled() && {SO}.web == 'true' && inputs.web != 'defer' }}}}
    # 本物の口と DB を使う画面の試験（K-53 の K53-UI-023・024・D-128.172）のために、Postgres と API をこの組の中で立てる。
    #   ほかの画面の試験は今までどおり口を網の手前で差し替える（page.route）ので、どちらの道も同じ組で流れる
    # 組ごとに使い捨ての Linux の VM で走る。画面と口の番号（3011・3124・3191）は VM の中だけなので、回をまたいで同時に走ってよい（K-258）
    env:
      KANAME_DEV_PAGES: '1'
      NEXT_PUBLIC_KANAME_DEV_PAGES: '1'
      # 画面の試験が本物の口を叩く先（apps/web/tests/_lib/api.ts の API_BASE・DATABASE_URL_ADMIN・KANAME_API_LOG）。画面は組み立てのときに口の先を埋める
      API_BASE: http://127.0.0.1:3011
      NEXT_PUBLIC_API_BASE: http://127.0.0.1:3011
      PLAYWRIGHT_JUNIT_OUTPUT_NAME: ${{{{ github.workspace }}}}/junit/web.xml   # 絶対の道（Playwright は設定の置き場 apps/web からの道で読む・K-176）
      # 試験用の受け箱（apps/web/tests/_lib/mailbox.ts・K-54）。API は Resend の SDK の行き先（RESEND_BASE_URL）をここにして、本物の送出の道でメールを出す
      QA_MAILBOX_PORT: '3191'
      # 規約・プライバシーポリシーの文面のページ（K-53）が埋める値。試験の値（本番の値は K-85・K-86 が決める）
      OPERATOR_ADDRESS: 東京都千代田区試験 1-1
      LEGAL_COURT: 東京地方裁判所
      LEGAL_HOSTING_PROVIDER: 試験のホスティング
      LEGAL_MAIL_PROVIDER: 試験のメール
      LEGAL_SECRETS_PROVIDER: 試験の秘密の置き場
      LEGAL_STORAGE_PROVIDER: 試験の置き場
    steps:
{NODE}{DB_START}      - run: pnpm --filter @kaname/web exec playwright install --with-deps chromium   # 像の温めと同じ・字体と apt の部品をそろえる（K-641）
{TOOLS_STEP}      - name: 画面と口の番号が空いているか（手元の開発のサーバーに当たって古いコードで緑にしない・K-172）
        run: |
          for port in 3011 3124 3191; do if lsof -ti tcp:$port >/dev/null 2>&1; then echo "★ 番号 $port が使われている（手元の開発のサーバーなど）。止めてから流し直す"; exit 1; fi; done
          echo "KANAME_API_LOG=$RUNNER_TEMP/api.log" >> "$GITHUB_ENV"   # 口の記録の置き場（画面の試験が読む・回ごとの置き場）
      - name: DB に migration を当て、API を立ち上げる（本物の口の画面の試験・K-53。メールは試験用の受け箱へ・K-54）
        run: |
          pnpm db:migrate
          (env NODE_ENV=development PORT=3011 BASE_URL=http://127.0.0.1:3011 WEB_BASE_URL=http://127.0.0.1:3124 \
            DATABASE_URL=postgres://kaname_app:kaname_app@localhost:$PGPORT/kaname_test \
            AUTH_DATABASE_URL=postgres://kaname_auth:kaname_auth@localhost:$PGPORT/kaname_test \
            AUTH_SECRET=ci-web-secret-0123456789-abcdefghijklmnop SECRETS_MASTER_KEY=BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc= \
            STORAGE_ENDPOINT=http://127.0.0.1:9000 STORAGE_REGION=ap-northeast-1 STORAGE_BUCKET=kaname-ci STORAGE_ACCESS_KEY_ID=ci STORAGE_SECRET_ACCESS_KEY=ci \
            KANAME_DEV_FAKE_BUCKET=1 KANAME_DEV_STORAGE_DIR=$RUNNER_TEMP/kaname-storage \
            RESEND_API_KEY=re_qa_mailbox RESEND_BASE_URL=http://127.0.0.1:3191 \
            pnpm exec tsx apps/api/src/dev.ts > $RUNNER_TEMP/api.log 2>&1 & echo $! > $RUNNER_TEMP/api.pid)
          for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3011/health && exit 0; sleep 2; done
          cat $RUNNER_TEMP/api.log; exit 1
      - run: pnpm --filter @kaname/web build:test
      - name: 画面を立ち上げる
        run: |
          (pnpm --filter @kaname/web start:test > $RUNNER_TEMP/web.log 2>&1 & echo $! > $RUNNER_TEMP/web.pid)
          for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:3124/dev/k/showcase && exit 0; sleep 2; done
          cat $RUNNER_TEMP/web.log; exit 1
      - name: Bridge を組み立てる（配布と同じ build・専用の段 G73 が使う・K-379）
        run: pnpm --filter @kaname/bridge build
{''.join(step(g) for g in ALL_GATES if g['job'] == 'web')}      - uses: actions/upload-artifact@v4
        # 結果の記録（G48 の record が書く）。緑の回にこそ要る：取り込みの台本（pm_merge.sh）がここから写して結果の欄を書く（K-143・D-129.51）
        if: ${{{{ !cancelled() }}}}
        with: {{ name: ci-results, path: 07_qa/ci-results/, if-no-files-found: error, retention-days: 7 }}
{junit_up("web")}      - name: 立てた API と画面を止める（赤でも必ず・Mac の台は残るので次の回が古いサーバーに当たらないように）
        if: always()
        run: |
          bash scripts/ci/kill_tree.sh "$RUNNER_TEMP/api.pid" "$RUNNER_TEMP/web.pid"   # 孫以下（node・next-server）まで
          # 始める前に空いていた番号なので、今いるのはこの回の残り。残れば赤（次の回が古いサーバーに当たらないように）
          for port in 3011 3124 3191; do if lsof -ti tcp:$port >/dev/null 2>&1; then echo "★ 止めた後も番号 $port が使われている"; exit 1; fi; done
{DB_STOP}  junit:
    runs-on: {RUNS_ON}
    # 試験の組の JUnit を 1 つの artifact「junit」にまとめる（ticket-flow の ci.py が読む・K-172）。落ちた組があってもまとめる
    needs: [{", ".join(f"unit-{i}" for i in range(1, UNIT_SHARDS + 1))}, {", ".join(SPEC_GROUPS)}, web]
    if: always()
    steps:
      - uses: actions/upload-artifact/merge@v4
        with: {{ name: junit, pattern: junit-*, delete-merged: false }}
  auto-merge:
    runs-on: {RUNS_ON}
    needs: [static, database, unit, {', '.join(SPEC_GROUPS)}, task-gate]
    if: github.event_name == 'pull_request' && !contains(github.event.pull_request.labels.*.name, 'no-auto-merge')
    permissions: {{ contents: write, pull-requests: write }}
    steps:
      - name: Enable auto-merge (squash)
        run: gh pr merge --squash --auto "${{{{ github.event.pull_request.number }}}}"
        env:
          GH_TOKEN: ${{{{ secrets.GITHUB_TOKEN }}}}
"""
open(".github/workflows/v3-gate.yml", "w", encoding="utf-8").write(yml)
# staging を指す統合テストの回（K-204）。ふだんの CI（v3-gate.yml）とは別の定義：main から手で起こしたときだけ。
#   住所と鍵は GitHub の Environment「staging」に在り、名前だけをここに書く。渡すのは健康診断と統合テストの 2 つの段の env だけ
#   （定義の env・組の env に書くと、依存の部品の後処理や組み立ての段にも渡る）。値・住所はここにも定義にも書かない
STAGING_NAMES = ("STAGING_BASE_URL", "STAGING_API_BASE", "STAGING_DATABASE_READ_URL", "STAGING_RESEND_READ_KEY")
STAGING_ENV = "".join(f"          {n}: ${{{{ secrets.{n} }}}}\n" for n in STAGING_NAMES)
STAGING_SPECS = "apps/e2e/staging/**/*.spec.ts"   # 統合テストの置き場（K-65 が作る物だけ）
# DB の束ね役（Supabase の pooler）の証明書は Supabase の自前の認証局の物。台の既定の信頼の元には無いので、根の証明書（公開の物）を版に入れて足す（確かめは外さない）
STAGING_CA = "${{ github.workspace }}/infra/certs/supabase-root-2021.crt"
STAGING_APPLIED = '"$RUNNER_TEMP/applied.json"'      # DB に当たっている migration の一覧の一時の置き場（版に入らない）
G15 = [g for g in ALL_GATES if g["job"] == "e2e"]
assert len(G15) == 1 and G15[0]["id"] == 15, "staging の回に出す関門は G15 の 1 つ"
staging_yml = f"""# .github/workflows/staging-e2e.yml — staging を指す統合テストの回（05_flow/build_testplan.py が生成。手で直さない・K-204）
# 起こすのは main から手で（gh workflow run staging-e2e.yml --ref main）。push・PR・時刻では起きない。枝から起こした回は組ごと流れない
# 住所と鍵は Environment「staging」に在る（起こせる枝は main だけ）。ここに書くのは名前だけで、渡すのは健康診断と統合テストの 2 つの段だけ
# 健康診断が赤なら統合テストは流れない。試験が 0 本の回は「まだ無い」と知らせる（流して緑、にしない）。上げるのは JUnit の記録だけ
name: staging-e2e
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: staging-e2e
  cancel-in-progress: false
env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
jobs:
  e2e:
    if: github.ref == 'refs/heads/main'
    environment: staging
    runs-on: {RUNS_ON}
    timeout-minutes: 30
    steps:
{NODE}      - name: "Bridge を組み立てる（配布と同じ build・K-97）"
        run: pnpm --filter @kaname/bridge build
      - name: "組み立てた輪を確かめる"
        run: |
          test -f apps/bridge/dist/loop.js
          test -f apps/bridge/dist/runner.js
          test -f apps/bridge/dist/pairing.js
          node -e "if (typeof require('./apps/bridge/dist/loop.js').startLoop !== 'function') process.exit(1)"
      - name: "staging の健康診断"
        env:
{STAGING_ENV}          NODE_EXTRA_CA_CERTS: {STAGING_CA}
        run: |
          node scripts/ci/staging_db_migrations.mjs > {STAGING_APPLIED}
          python3 scripts/ci/staging_health.py --need STAGING_DATABASE_READ_URL --need STAGING_RESEND_READ_KEY --applied {STAGING_APPLIED}
      - run: pnpm --filter @kaname/e2e exec playwright install --with-deps chromium
      - name: "統合テストがまだ無い"
        if: ${{{{ hashFiles('{STAGING_SPECS}') == '' }}}}
        run: echo "::warning::統合テストがまだ無い（apps/e2e/staging に試験が 0 本）。この回は健康診断だけ"
      - name: "G{G15[0]['id']} {G15[0]['name']}"
        if: ${{{{ hashFiles('{STAGING_SPECS}') != '' }}}}
        env:
{STAGING_ENV}          NODE_EXTRA_CA_CERTS: {STAGING_CA}
          PLAYWRIGHT_JUNIT_OUTPUT_NAME: ${{{{ github.workspace }}}}/junit/e2e-staging.xml
        run: {G15[0]['script']}
      - name: "staging の速さ（K-237）"
        if: ${{{{ !cancelled() }}}}
        env:
          STAGING_BASE_URL: ${{{{ secrets.STAGING_BASE_URL }}}}
          STAGING_API_BASE: ${{{{ secrets.STAGING_API_BASE }}}}
        run: python3 scripts/ci/staging_perf.py
      - uses: actions/upload-artifact@v4
        if: ${{{{ !cancelled() }}}}
        with: {{ name: junit, path: junit/, retention-days: 3 }}
"""
open(".github/workflows/staging-e2e.yml", "w", encoding="utf-8").write(staging_yml)
# 本番に出す前の関門（D-128.113）。ふだんの CI はゼロトラストの残りが「増えない」ことだけ見る。本番の前は残りが 0・秘密なし・弱点なし を求める
release_yml = f"""# .github/workflows/release-gate.yml — 本番に出す前の関門（05_flow/build_testplan.py が生成。手で直さない・D-128.113）
# 本番へのデプロイは、この関門が緑のときだけにする（Vercel の本番デプロイを、このワークフローの成功に結び付ける）
name: release-gate
on:
  workflow_dispatch:
  push:
    tags: ['v*']
  release:
    types: [published]
env:
  NODE_VERSION: '22'
  PNPM_VERSION: '10'
jobs:
  release-gate:
    runs-on: {RUNS_ON}
    steps:
{NODE}      - name: "ゼロトラストの実装の残りが 0（--strict）"
        run: pnpm ci:zt:strict
      - name: "権限の試験（契約の全 API）"
        run: pnpm ci:authz
      - name: "契約の外の道すじが無い"
        run: pnpm ci:endpoints
      - name: "秘密の混入が無い"
        run: pnpm ci:secret-scan
      - name: "本番で使う部品に moderate 以上の弱点が無い"
        run: pnpm audit --prod --audit-level=moderate
"""
open(".github/workflows/release-gate.yml", "w", encoding="utf-8").write(release_yml)
# ---------------------------------------------------------------- リスク・対象外・枠組み
crit_tasks = [t for t in TASKS if t["critical"]]
RISK = [
    {"area": "テナント越え（RLS・SET LOCAL）", "risk": "高", "why": "1 社のデータが別の会社に見える。旧製品の死因の 1 つ", "tests": "access-matrix 全行（G33）・G4/G6・上流を故意に壊す行（rls-matrix.md）", "priority": "最優先"},
    {"area": "関門の迂回（外に出る操作・資格情報）", "risk": "高", "why": "承認前の送信・課金・資格情報の露出", "tests": "G16〜G25（静的解析）・UNWANTED 403 の副作用なし", "priority": "最優先"},
    {"area": "口座状態の波及（退会・停止・権限変更）", "risk": "高", "why": "退会後もセッション・Bridge が生きる（G-14）", "tests": "leave 表の行（7 出来事）・sessions revoked 0 秒", "priority": "最優先"},
    {"area": "AI の無言終了・Bridge 切断（G-15／G-12）", "risk": "中", "why": "exit 0 で空応答が完了扱いになる／切断直後 90 秒の誤表示", "tests": "502 の UNWANTED（外部を切る）・切替直後 0 秒の行", "priority": "優先"},
    {"area": "契約のずれ（画面 ↔ API ↔ 型）", "risk": "中", "why": "3 クライアントが同じ契約を叩く。ずれると UI 断線（G-03）", "tests": "G11 openapi-diff・Schemathesis（G36）・mock-impl-diff", "priority": "優先"},
    {"area": "表記ゆらぎ・境界値", "risk": "中", "why": "全角で入れた利用者がログインできず離脱した事故", "tests": "unit の入出力表（screens/*.md 表記ゆらぎ行）", "priority": "優先"},
    {"area": "見た目の細部（色・余白）", "risk": "低", "why": "治具（状態・横溢れ・レイアウト）で既に測っている", "tests": "mock-impl-diff だけ。スナップショット比較は入口画面 3 枚に限定", "priority": "後回し"},
]
NOT_TESTED = ["画面の見た目のスナップショット全画面（治具の実測で代替。入口 3 画面だけ）", "負荷の実測（L1〜L3 では静的検査 G35 のみ。L4 リリース前に k6 で同時 50・集中時 rps・失敗率を実測）", "本番データを触る通し（本番は L4 のスモークだけ。通しは staging）", "Bridge 経由の実 LLM 応答の内容評価（AI 実動は ai-runtime-matrix の行で見る。CI では完了信号の有無と形だけ）"]
TS = ST.get("testing", {})
FRAMEWORK = {"unit_contract": TS.get("unit_contract", "未定（selected-stack.json の stack.testing に無い → user に確認。決め打ちしない）"), "contract_fuzz": TS.get("contract_fuzz", "Schemathesis（openapi.yaml）"), "consumer_contract": TS.get("consumer_contract", "未定"), "e2e": TS.get("e2e", ST.get("e2e", "未定")), "access": "実 Postgres（pgvector/pg16）で SET LOCAL を切り替えて流す（pnpm ci:access-matrix）", "load": TS.get("load", "k6（L4 のみ）"), "ci": "GitHub Actions（.github/workflows/v3-gate.yml）"}
MOCK = {"db": "モックしない。CI は実 Postgres（migration＋seed）。RLS はモックで再現できない", "external": "C1/C6/C7 の外は記録済み応答のスタブ（関門の中で差し替え）。完了信号なし・タイムアウトのケースを必ず 1 本", "llm": "C3 は Bridge のスタブ（決まった応答・無言終了・途中切断）。実 LLM は staging の L2 で", "storage": "C4 はローカルのバケット代替。G-11 の存在確認は staging と production で実施"}
LADDER = [{"stage": "L1", "what": "tickets qa_rows.l1（正本の行 3,000 超）＋ EARS の test ＋ access-matrix", "where": "staging（単体・契約はローカル可）", "when": "実装した本人が merge 前", "gate": "qa-ladder gate --task（G32）"},
          {"stage": "L2", "what": f"journeys/plan.json {len(JR)} 行（流れ 9）", "where": "staging", "when": "runnable_after が揃った最後のタスクが merge 前", "gate": "同上（揃った流れを自動で含む）"},
          {"stage": "L3", "what": "Wave の L1＋L2 全部 ＋ 前 Wave の回帰（差分）", "where": "staging", "when": "Wave 締め", "gate": "completion_gate.sh"},
          {"stage": "L4", "what": "正本 full ＋ 本番スモーク（prod-smoke.md）＋ 負荷実測", "where": "staging ＋ 本番（スモークのみ）", "when": "リリース前", "gate": "qa-coverage.py STATUS 完了"},
          {"stage": "L5", "what": "full ＋ 正本の鮮度監査", "where": "staging", "when": "年次・大改修", "gate": "同上"}]
plan = {"version": "v3", "project": "Kaname", "created_at": TODAY, "skill": "test-verification", "_doc": "05_flow/build_testplan.py が上流（tickets・EARS・entities・foundation_gates・choke-points・stack）から機械生成。手で直さない", "source": SRC,
        "inputs": {"tickets": len(TASKS), "l1_rows": sum(len(t["qa_rows"]["l1"]) for t in TASKS), "ears_endpoints": len(EARS), "ears_tests": len(mappings), "entities": len(EN), "policies": sum(len(e["access_control_policies"]) for e in EN), "access_cases": len(am), "errors": len(ERR), "journey_rows": len(JR), "critical_tasks": len(crit_tasks)},
        "framework": FRAMEWORK, "tier_mapping": TIER_MAP, "risk": RISK, "not_tested": NOT_TESTED, "mock_strategy": MOCK, "ladder": LADDER,
        "coverage": {"lines": FG["merge_gates"][2]["threshold"]["lines"], "branches": FG["merge_gates"][2]["threshold"]["branches"], "business_logic": 80, "utilities": 60, "note": "閾値は foundation_gates.json G3 から"},
        "gates": ALL_GATES, "stages": {"static": "静的・関門（DB 不要）", "database": "実 Postgres（RLS・契約・coverage・access-matrix・EARS 対応）", "spec": "仕様の層（Python・G21/qa-ladder/エラー一覧/スキル/テスト計画）", "task-gate": "PR のブランチ task/<ID> の L1 行", "e2e": "main から手で起こす staging の回（.github/workflows/staging-e2e.yml）", "auto-merge": "static＋database＋spec＋task-gate が全部緑"},
        "merge_criteria": ["G1〜G36 が全部緑（統合テスト（G15）は staging-e2e.yml の回で）", "ears-test-mapping.json の test が全部存在（G34）", "access-matrix.json の全行 PASS（G33）", "そのタスクの qa_rows.l1 が全行 PASS か理由つき BLOCKED（G32）", "連続 3 回失敗で高本さんへ（foundation_gates.retry_protocol）"],
        "change_follow_up": "仕様・チケットが途中で変わったら qa_delta.py --changed … --gate。EARS の差分は ears-test-mapping.json の差分として出す（全部作り直さない）",
        "critical_gates": FG.get("kaname_critical_gates", []), "retry_protocol": FG.get("retry_protocol", {}), "next_skill": "sprint-planning（S13）"}
json.dump(plan, open(f"{OUT}/test-plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# ---------------------------------------------------------------- MD / HTML（JSON からの写し）
def tbl(h, rows): return "| " + " | ".join(h) + " |\n|" + "---|" * len(h) + "\n" + "".join("| " + " | ".join(str(c).replace("|", "／") for c in r) + " |\n" for r in rows)
md = [f"# Kaname テスト計画（v3・{TODAY}・機械生成）", "", f"> 05_flow/build_testplan.py が生成。信頼源は test-plan.json。根拠の決定：{' '.join(SRC)}", "",
      "## 入力", "", tbl(["項目", "数"], list(plan["inputs"].items())), "## 3-tier AC ↔ テストの段", "", tbl(["3-tier", "段", "道具", "ゲート", "梯子"], [[x["tier"], x["level"], x["tool"], x["gate"], x["ladder"]] for x in TIER_MAP]),
      "## リスク", "", tbl(["領域", "リスク", "理由", "テスト", "優先"], [[x["area"], x["risk"], x["why"], x["tests"], x["priority"]] for x in RISK]), "## テストしないもの（理由つき）", ""] + [f"- {x}" for x in NOT_TESTED] + ["",
      "## 枠組み", "", tbl(["用途", "道具"], list(FRAMEWORK.items())), "## モックの方針", "", tbl(["対象", "方針"], list(MOCK.items())), "## テスト・ラダー", "", tbl(["段", "何を", "どこで", "いつ", "ゲート"], [[x["stage"], x["what"], x["where"], x["when"], x["gate"]] for x in LADDER]),
      f"## CI ゲート {len(ALL_GATES)} 本（.github/workflows/v3-gate.yml）", "", tbl(["#", "名前", "script", "job", "致命"], [[f"G{g['id']}", g["name"], f"`{g['script']}`", g["job"], "★" if g["id"] in plan["critical_gates"] else ""] for g in ALL_GATES]),
      "## マージ可能の判断", ""] + [f"- {x}" for x in plan["merge_criteria"]] + ["", f"## EARS → test（{len(mappings)} 本・ears-test-mapping.json）", "", tbl(["形", "本数"], list(plan["inputs"].items())[:0] + [[k, v] for k, v in {f: sum(1 for m in mappings if m["ears_form"] == f) for f in ("EVENT-DRIVEN", "UNWANTED", "UBIQUITOUS")}.items()]),
      f"## RLS の場合表（{len(am)} 行・access-matrix.json）", "", tbl(["役", "policy 数", "場合 数"], [[ROLE_JA[r], sum(1 for e in EN for p in e['access_control_policies'] if p['role'] == r), sum(1 for c in am if c['role'] == r)] for r in ROLE_JA]),
      "## 途中変更", "", plan["change_follow_up"], "", "## 次", "", plan["next_skill"], ""]
open(f"{OUT}/test-plan.md", "w", encoding="utf-8").write("\n".join(md))
def hrows(h, rows): return "<table><thead><tr>" + "".join(f"<th>{html.escape(str(x))}</th>" for x in h) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"
page = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Kaname テスト計画</title><style>body{{font:14px/1.6 -apple-system,'Hiragino Sans',sans-serif;margin:32px;color:#1f2328;background:#fafaf8}}table{{border-collapse:collapse;margin:8px 0 20px;width:100%}}th,td{{border:1px solid #d9d6cf;padding:6px 10px;text-align:left;vertical-align:top;font-size:13px}}th{{background:#f0ede6}}h1{{font-size:22px}}h2{{font-size:17px;margin-top:28px;border-bottom:1px solid #d9d6cf;padding-bottom:4px}}code{{background:#eeece6;padding:1px 4px;border-radius:3px}}</style></head><body>
<h1>Kaname テスト計画（v3・{TODAY}）</h1><p>信頼源 test-plan.json（05_flow/build_testplan.py が生成）。tickets {len(TASKS)}／L1 行 {plan['inputs']['l1_rows']}／EARS test {len(mappings)}／RLS の場合 {len(am)}／CI ゲート {len(ALL_GATES)}</p>
<h2>3-tier AC ↔ テストの段</h2>{hrows(["3-tier","段","道具","ゲート","梯子"], [[x["tier"],x["level"],x["tool"],x["gate"],x["ladder"]] for x in TIER_MAP])}
<h2>リスク</h2>{hrows(["領域","リスク","理由","テスト","優先"], [[x["area"],x["risk"],x["why"],x["tests"],x["priority"]] for x in RISK])}
<h2>テストしないもの</h2><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in NOT_TESTED)}</ul>
<h2>枠組み・モックの方針</h2>{hrows(["用途","道具"], list(FRAMEWORK.items()))}{hrows(["対象","方針"], list(MOCK.items()))}
<h2>テスト・ラダー</h2>{hrows(["段","何を","どこで","いつ","ゲート"], [[x["stage"],x["what"],x["where"],x["when"],x["gate"]] for x in LADDER])}
<h2>CI ゲート {len(ALL_GATES)} 本</h2>{hrows(["#","名前","script","job","致命"], [[f"G{g['id']}",g["name"],g["script"],g["job"],"★" if g["id"] in plan["critical_gates"] else ""] for g in ALL_GATES])}
<h2>マージ可能の判断</h2><ul>{''.join(f'<li>{html.escape(x)}</li>' for x in plan["merge_criteria"])}</ul>
<h2>EARS → test（先頭 40）</h2>{hrows(["ID","endpoint","形","code","段","ゲート","タスク"], [[m["test_id"],m["endpoint"],m["ears_form"],m["http_code"],m["test_level"],m["gate"]," ".join(m["tasks"])] for m in mappings[:40]])}
<h2>RLS の場合表（先頭 40）</h2>{hrows(["表","policy","役","操作","場合","期待"], [[c["table"],c["policy"],c["role_ja"],c["operation"],c["case"],c["expected"]] for c in am[:40]])}
</body></html>"""
open(f"{OUT}/test-plan.html", "w", encoding="utf-8").write(page)
print(f"tests {len(mappings)} (endpoints {len(EARS)}) / access cases {len(am)} (policies {plan['inputs']['policies']}) / gates {len(ALL_GATES)} / critical tasks {len(crit_tasks)} → {OUT}/ + .github/workflows/v3-gate.yml・staging-e2e.yml")
