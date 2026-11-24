#!/usr/bin/env python3
"""canvas_gate.py — 画面デザインのキャンバスの写し（04_design/canvas・D-128.23）の検査。前の画面の見本（06_mockup v1・v2）をしまってからの正（D-128.117）。
 CV1 canvas.json の boards と .dc.html のファイルが 1 対 1（写し忘れ・消し忘れが無い）
 CV2 boards の page が pages にある
 CV3 製品名は半角の Kaname だけ（「かなめ」「製品名：要」を使わない・AD-011 と同じ）
 CV4 第1フェーズの画面（flow.json の release v1）に、どれもキャンバスの絵がある。絵はどれも、どれか 1 つの画面か共通か later に入る
     （later＝後のフェーズへ送った画面の絵。flow に在り第1フェーズでない画面だけ・絵の並びは空でない・K-711）
     （対応表 04_design/canvas-screens.json・K-45。ここが無いと、画面に絵があるかを誰も見ていなかった）"""
import glob, json, os, re, sys
D = "04_design/canvas"
C = json.load(open(f"{D}/canvas.json", encoding="utf-8"))
files = {os.path.basename(p) for p in glob.glob(f"{D}/*.dc.html")}
boards = set(C["boards"])
pages = {p["id"] for p in C["pages"]}
fails = []
if boards - files: fails.append(("CV1", f"ファイルの無い board {sorted(boards - files)[:6]}"))
if files - boards: fails.append(("CV1", f"board の無いファイル {sorted(files - boards)[:6]}"))
m = sorted(k for k, b in C["boards"].items() if b.get("page") not in pages)
if m: fails.append(("CV2", f"page が無い board {m[:6]}"))
m = sorted(f for f in files if re.search(r"かなめ|製品名[：:]\s*要", open(f"{D}/{f}", encoding="utf-8").read()))
if m: fails.append(("CV3", f"製品名に「かなめ」を使っている {m[:6]}"))
MAP = "04_design/canvas-screens.json"
if not os.path.exists(MAP):
    fails.append(("CV4", f"画面とキャンバスの絵の対応表 {MAP} が無い"))
else:
    import collections
    mp = json.load(open(MAP, encoding="utf-8"))
    v1 = {x["id"] for x in json.load(open("05_flow/flow.json", encoding="utf-8"))["screens"] if x.get("release") == "v1"}
    scr = mp.get("screens", {})
    names = {f.replace(".dc.html", "") for f in files}
    # 後のフェーズへ送った画面の絵（later・K-711）：消さずに残す。第1フェーズの画面は載せられず、絵は数えて 2 か所を見る
    later = {k: v for k, v in mp.get("later", {}).items() if not k.startswith("_")}
    flow_ids = {x["id"] for x in json.load(open("05_flow/flow.json", encoding="utf-8"))["screens"]}
    if set(later) & v1: fails.append(("CV4", f"later の画面が flow の第1フェーズにある {sorted(set(later) & v1)[:8]}"))
    if set(later) - flow_ids: fails.append(("CV4", f"later の画面が flow に無い {sorted(set(later) - flow_ids)[:8]}"))
    if [k for k, v in later.items() if not v]: fails.append(("CV4", f"later の絵の並びが空 {sorted(k for k, v in later.items() if not v)[:8]}"))
    every = [b for v in scr.values() for b in v] + list(mp.get("common", {}).get("boards", [])) + [b for v in later.values() for b in v]
    # キャンバスの絵が無く、正が本番と同じ部品で作ったモック（段 2 の /dev/mock）の画面は、理由つきで mock_only に載せる（K-315）。
    #   抜け道にしない：理由が空・第1フェーズに無い画面・モックの置き場に screen: "<画面>" の見本が無い画面は赤
    MOCKS = "apps/web/app/(dev)/dev/mock/f1/mocks.tsx"
    mock_src = open(MOCKS, encoding="utf-8").read() if os.path.exists(MOCKS) else ""
    mock_only = set()
    for k, v in mp.get("mock_only", {}).items():
        if not (isinstance(v, str) and v.strip()):
            fails.append(("CV4", f"mock_only の {k} に理由が無い"))
        elif k not in v1:
            fails.append(("CV4", f"mock_only の {k} は flow の第1フェーズに無い画面"))
        elif f'screen: "{k}"' not in mock_src:
            fails.append(("CV4", f"mock_only の {k} のモックが {MOCKS} に無い"))
        elif scr.get(k):
            fails.append(("CV4", f"mock_only の {k} にはキャンバスの絵もある（どちらか 1 つ）"))
        else:
            mock_only.add(k)
    nob = sorted(v1 - mock_only - {k for k, v in scr.items() if v})
    if nob: fails.append(("CV4", f"絵の無い画面 {nob[:8]}"))
    if set(scr) - v1: fails.append(("CV4", f"flow の第1フェーズに無い画面 {sorted(set(scr) - v1)[:8]}"))
    if names - set(every): fails.append(("CV4", f"どの画面にも共通にも入っていない絵 {sorted(names - set(every))[:8]}"))
    if set(every) - names: fails.append(("CV4", f"対応表にあるのにキャンバスに無い絵 {sorted(set(every) - names)[:8]}"))
    dup = sorted(b for b, n in collections.Counter(every).items() if n > 1)
    if dup: fails.append(("CV4", f"2 か所に入っている絵 {dup[:8]}"))
print(f"キャンバスの画面 {len(files)} ／ ページ {len(pages)}")
for k, x in fails: print(f"  ★ [{k}] {x}")
print("PASS — CV1〜CV4 すべて緑" if not fails else f"FAIL — {len(fails)} 件"); sys.exit(0 if not fails else 2)
