#!/usr/bin/env python3
"""操作の実証ゲート（説明文の PASS を赤にする）。

  python3 scripts/ci/op_gate.py --spec 07_qa/test-specs --tickets 07_tasks/tickets.json（11_tickets/tickets.json も読める・行のタスクの列が KN-…） --report apps/web/test-results/report.json [--report apps/e2e/test-results/report.json] --task T-U-05 [--task …] | --wave W11 --waves 08_schedule/wave-schedule.json | --all

規則（test-ladder §6・L-003 Rule 10 を機械にしたもの）:
  O1 実ブラウザで確かめる観点（既定：操作・状態・主アクション・到達性・横溢れ・空・止まっている・表記ゆらぎ・共通シェル・部品・エラー A/B/C）の行は、
     結果が PASS なら **その行 ID を名前に含む Playwright のテストが、直近の JSON 報告で passed** でなければ赤。
     説明文だけの PASS・テストが無い PASS・落ちたテストの PASS は全部赤。
     API の層の行（E-…-A の「エラーが出る」等）は、本物の DB の上で流した vitest の JSON 報告（名前に行 ID）も証拠に数える（op-gate.json の reports に並べる）。
  O2 結果が空の行は「未実施」で赤（--pending-from-report のときは、今の回の報告で passed なら緑・落ちていれば赤・K-143）。BLOCKED は理由（結果か備考に「（…）」）が無ければ赤。N/A は観点「操作」には書けない（要素がモックにある）。
  O3 「発注者確認」の行は、手順ファイル（テスト項目に書いてある .md）の末尾に「OK: 日付 名前」があるときだけ PASS。無ければ BLOCKED（発注者の確認待ち）だけを許す。
  O4 報告が無い・空・仕様より古い（行の結果が書かれた後に流していない）なら、その旨を赤で出す。
  --rows-in（チケットの範囲の回）で照らすのは、流した試験のファイルの「試験の題」に出る行 ID だけ（K-1122）：
     字で書いた題（test/it/describe(…)・row(R["…"])）と、報告の中の流したファイルの試験の題の和。コメント・題でない字は数えない。
観点の集合は <spec>/op-gate.json（{"evidence_views": [...], "report_max_age_h": 48}）で足せる。プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys, time

DEFAULT_VIEWS = ["操作", "状態", "主アクション", "到達性", "横溢れ", "空・止まっている", "表記ゆらぎ", "共通シェル", "部品", "役割の出し分け", "見え方"]
ID_RE = re.compile(r"\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3}(?:-[ABC])?\b")


TITLE_HEADS = {"test", "it", "describe"}
TITLE_MODS = {"describe", "only", "skip", "fixme", "fail", "serial", "parallel", "concurrent", "todo"}
REGEX_AFTER_WORDS = {"return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "yield", "await", "instanceof"}


def _skip_quoted(src: str, i: int, q: str) -> tuple[str, int]:
    """'…'・"…" を読む。返すのは中身と次の位置（閉じなければ終わりまで・中身は None 扱いで空）"""
    j = i + 1
    out = []
    while j < len(src):
        ch = src[j]
        if ch == "\\":
            out.append(src[j:j + 2]); j += 2; continue
        if ch == q:
            return "".join(out), j + 1
        if ch == "\n":
            break
        out.append(ch); j += 1
    return "", len(src)   # 閉じない字：後ろは数えない


def _skip_template(src: str, i: int) -> tuple[str, int]:
    """`…` を読む。${…} の中は同じ読み方で読み飛ばし、題の字には数えない（空白 1 つに置き換える）"""
    j = i + 1
    out = []
    while j < len(src):
        ch = src[j]
        if ch == "\\":
            out.append(src[j:j + 2]); j += 2; continue
        if ch == "`":
            return "".join(out), j + 1
        if src.startswith("${", j):
            _, j = _tokens(src, j + 2, stop_brace=True)
            out.append(" ")
            continue
        out.append(ch); j += 1
    return "", len(src)


def _skip_regex(src: str, i: int) -> int:
    j, in_class = i + 1, False
    while j < len(src):
        ch = src[j]
        if ch == "\\":
            j += 2; continue
        if ch == "\n":
            return j
        if in_class:
            in_class = ch != "]"
        elif ch == "[":
            in_class = True
        elif ch == "/":
            j += 1
            while j < len(src) and (src[j].isalnum() or src[j] == "_"):
                j += 1
            return j
        j += 1
    return len(src)


def _tokens(src: str, i: int = 0, stop_brace: bool = False) -> tuple[list[tuple[str, str]], int]:
    """TS/JS の字を（種類, 値）の並びにする。種類：name・str（字とテンプレートの中身）・p（記号）。コメントと正規表現は捨てる。
    stop_brace なら、対になる } で止まる（テンプレートの ${…} の中）"""
    toks: list[tuple[str, str]] = []
    depth = 0
    n = len(src)
    while i < n:
        ch = src[i]
        if ch.isspace():
            i += 1; continue
        if src.startswith("//", i):
            k = src.find("\n", i)
            i = n if k < 0 else k; continue
        if src.startswith("/*", i):
            k = src.find("*/", i + 2)
            i = n if k < 0 else k + 2; continue
        if ch in "'\"":
            v, i = _skip_quoted(src, i, ch); toks.append(("str", v)); continue
        if ch == "`":
            v, i = _skip_template(src, i); toks.append(("str", v)); continue
        if ch == "/":
            prev = toks[-1] if toks else None
            is_div = prev is not None and (prev[0] == "str" or (prev[0] == "name" and prev[1] not in REGEX_AFTER_WORDS) or prev[1] in (")", "]", "}"))
            if not is_div:
                i = _skip_regex(src, i); toks.append(("p", "regex")); continue
        if ch.isalnum() or ch in "_$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$"):
                j += 1
            toks.append(("name", src[i:j])); i = j; continue
        if stop_brace:
            if ch == "{":
                depth += 1
            elif ch == "}":
                if depth == 0:
                    return toks, i + 1
                depth -= 1
        toks.append(("p", ch)); i += 1
    return toks, n


def title_ids(src: str) -> set[str]:
    """試験のファイルの字で書いた題に出る行 ID（K-1122）。コメント・体の中の字・test.step・x.test(…) は数えない"""
    toks, _ = _tokens(src)
    ids: set[str] = set()
    for k, (kind, v) in enumerate(toks):
        if kind != "name" or (k and toks[k - 1] == ("p", ".")):
            continue
        j = k + 1
        if v in TITLE_HEADS:
            while j + 1 < len(toks) and toks[j] == ("p", ".") and toks[j + 1][0] == "name" and toks[j + 1][1] in TITLE_MODS:
                j += 2
            if j + 1 < len(toks) and toks[j] == ("p", "(") and toks[j + 1][0] == "str":
                ids |= set(ID_RE.findall(toks[j + 1][1]))
        elif v == "row":
            w = toks[j:j + 5]
            if len(w) == 5 and w[0] == ("p", "(") and w[1][0] == "name" and w[2] == ("p", "[") and w[3][0] == "str" and w[4] == ("p", "]"):
                ids |= set(ID_RE.findall(w[3][1]))
    return ids


def _same_file(report_file: str, given: str) -> bool:
    rf = report_file.replace("\\", "/").lstrip("./")
    g = os.path.normpath(given).replace("\\", "/")
    return bool(rf) and (g == rf or g.endswith("/" + rf))


def report_title_ids(paths: list[str], files: list[str]) -> set[str]:
    """Playwright の報告のうち、ファイルの名前（testDir からの道）が流した試験のファイルに当たる試験の題の行 ID（上の段の題もつなぐ）"""
    ids: set[str] = set()

    def walk(s: dict, path: list[str], file: str) -> None:
        file = s.get("file") or file
        for sp in s.get("specs", []):
            f = sp.get("file") or file
            if f and any(_same_file(f, g) for g in files):
                ids.update(ID_RE.findall(" ".join(path + [sp.get("title", "")])))
        for c in s.get("suites", []):
            walk(c, path + [s.get("title", "")], file)

    for p in paths:
        if not os.path.exists(p):
            continue
        try:
            rep = json.load(open(p, encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue   # 読めない報告は O4 が赤にする
        for s in rep.get("suites", []):
            walk(s, [], "")
    return ids


def load_rows(spec: str) -> dict[str, dict]:
    rows = {}
    for fp in glob.glob(os.path.join(spec, "**", "*.md"), recursive=True):
        for ln in open(fp, encoding="utf-8"):
            if not ln.startswith("| ") or ln.startswith("| ID "):
                continue
            c = [x.strip() for x in ln.strip().strip("|").split("|")]
            if len(c) < 11 or not re.match(r"^[A-Z]", c[0]):
                continue
            rows[c[0]] = {"id": c[0], "file": os.path.relpath(fp), "view": c[2], "item": c[3], "result": c[7], "note": c[8], "task": c[9]}
    return rows


def load_report(paths: list[str]) -> tuple[dict[str, str], float]:
    """テスト名 → 状態（passed/failed/skipped）。
    同じ報告の中では、名前に含まれる行 ID を鍵にして最悪の状態を取る。
    報告どうしは **新しい報告が古い報告を上書きする**（「直近の報告」が真実。古い報告の失敗を、直した後の報告より優先しない）"""
    by_id: dict[str, str] = {}
    newest = 0.0
    rank = {"passed": 0, "skipped": 1, "timedOut": 2, "failed": 2, "interrupted": 2}
    for p in sorted((x for x in paths if os.path.exists(x)), key=os.path.getmtime):
        newest = max(newest, os.path.getmtime(p))
        rep = json.load(open(p, encoding="utf-8"))
        seen_here: set[str] = set()

        def walk(s, path):
            for sp in s.get("specs", []):
                title = " ".join(path + [sp.get("title", "")])
                st = "skipped"
                for t in sp.get("tests", []):
                    for r in t.get("results", []):
                        st = r.get("status", st)
                for rid in ID_RE.findall(title):
                    cur = by_id.get(rid) if rid in seen_here else None   # 別の（古い）報告の値は上書きする
                    if cur is None or rank.get(st, 2) > rank.get(cur, 0):
                        by_id[rid] = st
                    seen_here.add(rid)
            for c in s.get("suites", []):
                walk(c, path + [s.get("title", "")])

        for s in rep.get("suites", []):
            walk(s, [])
        # vitest の JSON 報告（--reporter=json）も証拠にする：API の層の行（E-…-A の「エラーが出る」・BRG の API の行）は
        # 本物の DB の上で流した vitest が実測で、名前に行 ID を持つ（write_results.mjs と同じ読み方・T-B-14）
        for f in rep.get("testResults", []):
            for a in f.get("assertionResults", []):
                st = "passed" if a.get("status") == "passed" else "failed" if a.get("status") == "failed" else "skipped"
                title = " ".join(a.get("ancestorTitles", []) + [a.get("title", "")])
                for rid in ID_RE.findall(title):
                    cur = by_id.get(rid) if rid in seen_here else None
                    if cur is None or rank.get(st, 2) > rank.get(cur, 0):
                        by_id[rid] = st
                    seen_here.add(rid)
    return by_id, newest


def handoff_ok(item: str) -> tuple[bool, str]:
    m = re.search(r"(\S+\.md)", item)
    if not m:
        return False, "手順ファイルの指定が無い"
    fp = m.group(1)
    if not os.path.exists(fp):
        return False, f"手順ファイルが無い（{fp}）"
    ok = [ln for ln in open(fp, encoding="utf-8") if re.match(r"^OK:\s*\d{4}-\d{2}-\d{2}\s+\S+", ln.strip())]
    return (True, ok[-1].strip()) if ok else (False, f"{fp} に「OK: 日付 名前」が無い")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--tickets", required=True)
    ap.add_argument("--report", action="append", default=[])
    ap.add_argument("--task", action="append", default=[])
    ap.add_argument("--wave", default="")
    ap.add_argument("--waves", default="")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--json", action="store_true")
    # 本物の画面ができるまでは、前の画面の正本の不合格を記録にして、記録に無い不合格が出たら赤（D-128.117・緑にするのは KN-37）
    ap.add_argument("--baseline", default="")
    ap.add_argument("--record", action="store_true")
    # 結果の欄は取り込みの台本が CI の記録から書く（K-143・D-129.51）。CI の回では、結果が空の行を今の回の報告で確かめる
    ap.add_argument("--pending-from-report", action="store_true")
    ap.add_argument("--rows-in", action="append", default=[],
                    help="このファイル（流した試験）に書かれた行 ID の行だけを照らす。照らすチケットは行の「タスク」列から（K-177）")
    a = ap.parse_args()
    cfg = {}
    cp = os.path.join(a.spec, "op-gate.json")
    if os.path.exists(cp):
        cfg = json.load(open(cp, encoding="utf-8"))
    views = set(cfg.get("evidence_views", DEFAULT_VIEWS))
    layers = set(cfg.get("layers", ["ui"]))   # 実ブラウザの証拠を要る層（既定 ui）。backend の行は契約の生成テスト（EARS）が証拠＝別ゲート
    tj = json.load(open(a.tickets, encoding="utf-8"))
    if "tickets" in tj:
        # Kaname を作るチケット（11_tickets・D-128.114）：行の「タスク」の列がチケットの番号。--all は、行を持つチケット全部
        #   （作業の段に関わらず、PASS と書いた行は証拠が要る）
        spec_rows = load_rows(a.spec)
        tasks = {}
        for t in tj["tickets"]:
            l1 = [rid for rid, r in spec_rows.items() if r["task"] == t["id"]]
            tasks[t["id"]] = {"id": t["id"], "deliverable_layer": "ui", "status": "done" if l1 else "", "qa_rows": {"l1": l1}}
    else:
        tasks = {t["id"]: t for t in tj["tasks"]}
    targets = list(a.task)
    only: set[str] | None = None
    # 報告の一覧は op-gate.json に 1 つだけ持つ。--report を書かなければそれを使う（呼ぶ側に書き写すと足し忘れる）
    reports = a.report or cfg.get("reports", [])
    if a.rows_in:   # チケットの範囲の回（K-177）：流した試験の題に出る行だけ（K-1122・コメントは数えない）。持ち主のチケットでない行も照らす
        named: set[str] = report_title_ids(reports, a.rows_in)
        for f in a.rows_in:
            named |= title_ids(open(f, encoding="utf-8", errors="replace").read())
        rows_all = load_rows(a.spec)
        only = {rid for rid in rows_all if rid in named}
        for rid in only:
            t = rows_all[rid]["task"]
            tasks.setdefault(t, {"id": t, "deliverable_layer": "ui", "status": "done", "qa_rows": {"l1": []}})
            if rid not in tasks[t]["qa_rows"]["l1"]:
                tasks[t]["qa_rows"]["l1"].append(rid)
        targets = sorted({rows_all[rid]["task"] for rid in only})
    if a.wave:
        ws = json.load(open(a.waves, encoding="utf-8"))
        for w in (ws.get("waves", ws) if isinstance(ws, dict) else ws):
            if w.get("id") == a.wave:
                targets += w.get("l1_tasks") or w.get("tasks") or []
    if a.all:
        targets = [t for t, x in tasks.items() if x.get("status") == "done"]
    if not targets:
        if a.rows_in:
            print("流した試験のファイルに、仕様の行 ID が 1 つも無い（照らす行が無い）"); return 0
        print("対象のタスクが無い（--task / --wave / --all）"); return 2
    rows = load_rows(a.spec)
    by_id, newest = load_report(reports)
    fails: list[str] = []
    stats = {"checked": 0, "evidenced": 0, "blocked": 0, "na": 0}
    if reports and not by_id:
        fails.append(f"O4 報告が無いか空（{', '.join(reports)}）。Playwright を json reporter で流してから")
    elif newest and os.environ.get("SPEC_SYNC_RUN") != "1" and (time.time() - newest) > cfg.get("report_max_age_h", 48) * 3600:
        # 仕様の同期の回（SPEC_SYNC_RUN=1）では報告の新しさを見ない。新しさは区切りの回で見る（D-128.149）
        fails.append(f"O4 報告が {int((time.time() - newest) / 3600)} 時間前で古い（上限 {cfg.get('report_max_age_h', 48)} h）。流し直す")
    for tid in targets:
        t = tasks.get(tid)
        if not t:
            fails.append(f"{tid}: tickets.json に無い"); continue
        if t.get("deliverable_layer") not in layers:
            continue
        for rid in t.get("qa_rows", {}).get("l1", []):
            if only is not None and rid not in only:
                continue
            r = rows.get(rid)
            if not r:
                fails.append(f"{tid} {rid}: 正本に行が無い"); continue
            v = r["view"]; res = r["result"]
            is_err = bool(re.match(r"^E-.*-[ABC]$", rid))
            if not (v in views or is_err or v == "発注者確認"):
                continue
            stats["checked"] += 1
            if v == "発注者確認":
                ok, why = handoff_ok(r["item"])
                if res.startswith("PASS") and not ok:
                    fails.append(f"{tid} {rid}: 発注者確認が PASS だが {why}")
                elif res.startswith("PASS"):
                    stats["evidenced"] += 1
                elif res.startswith("BLOCKED"):
                    stats["blocked"] += 1
                else:
                    fails.append(f"{tid} {rid}: 発注者確認が未実施（{why}）。BLOCKED（発注者の確認待ち）か OK が要る")
                continue
            if not res:
                st = by_id.get(rid) if a.pending_from_report else None
                if st == "passed":
                    stats["evidenced"] += 1   # 今の回の報告で通った。結果の欄は取り込みの台本が書く（K-143）
                elif st is not None:
                    fails.append(f"{tid} {rid} [{v}]: 結果が空で、今の回の報告ではテストは {st}")
                else:
                    fails.append(f"{tid} {rid} [{v}]: 未実施（結果が空）")
                continue
            if res.startswith("BLOCKED"):
                if "（" in res or r["note"]:
                    stats["blocked"] += 1
                else:
                    fails.append(f"{tid} {rid} [{v}]: BLOCKED に理由が無い")
                continue
            if res.startswith("N/A") or res.startswith("PASS（該当なし"):
                if v == "操作":
                    fails.append(f"{tid} {rid} [操作]: 要素がモックにある行を N/A にできない（{r['item'][:40]}）")
                else:
                    stats["na"] += 1
                continue
            if res.startswith("PASS"):
                st = by_id.get(rid)
                if st is None:
                    fails.append(f"{tid} {rid} [{v}]: PASS だが行 ID を名前に持つ実ブラウザのテストが無い（説明文の PASS）")
                elif st != "passed":
                    fails.append(f"{tid} {rid} [{v}]: PASS だがテストは {st}")
                else:
                    stats["evidenced"] += 1
                continue
            fails.append(f"{tid} {rid} [{v}]: 結果の形が読めない「{res[:30]}」（PASS／BLOCKED（理由）／N/A（理由））")
    key = lambda f: "O4 報告" if f.startswith("O4 ") else f
    if a.baseline:
        B = json.load(open(a.baseline, encoding="utf-8")) if os.path.exists(a.baseline) else {}
        if a.record:
            B["op_gate"] = {"ticket": "KN-37", "reason": "前の画面（06_mockup v1・v2）の正本。本物の画面とその押した証拠ができるまで記録にする（D-128.117）", "fails": sorted({key(f) for f in fails})}
            open(a.baseline, "w", encoding="utf-8").write(json.dumps(B, ensure_ascii=False, indent=1) + "\n")
            print(f"不合格 {len(B['op_gate']['fails'])} を記録した（{a.baseline}）"); return 0
        known = set(B.get("op_gate", {}).get("fails", []))
        new_f = [f for f in fails if key(f) not in known]
        gone = len(known - {key(f) for f in fails})
        print(f"検査 {stats['checked']} 行：実ブラウザの証拠あり {stats['evidenced']}・BLOCKED {stats['blocked']}・N/A {stats['na']}・不合格 {len(fails)}（記録 {len(known)}）")
        for f in new_f[:40]:
            print("  ✗ 記録に無い不合格：" + f)
        if gone:
            print(f"  直った不合格 {gone} → --record で記録を下げる")
        print("PASS — 記録に無い不合格は無い（前の画面の分は KN-37 で緑にする）" if not new_f else f"不合格 — 記録に無いもの {len(new_f)} 件")
        return 0 if not new_f else 1
    if a.json:
        print(json.dumps({"status": "PASS" if not fails else "FAIL", "fails": fails, "stats": stats}, ensure_ascii=False, indent=1))
    else:
        for f in fails[:80]:
            print("  ✗ " + f)
        if len(fails) > 80:
            print(f"  … ほか {len(fails) - 80} 件")
        print(f"検査 {stats['checked']} 行：実ブラウザの証拠あり {stats['evidenced']}・BLOCKED {stats['blocked']}・N/A {stats['na']}・不合格 {len(fails)}")
        print("PASS — 実ブラウザで押した証拠が全部の行にある" if not fails else f"不合格 — {len(fails)} 件（説明文の PASS は証拠にならない）")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
