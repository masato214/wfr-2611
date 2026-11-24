// K-691「必ず守る（付ける・上限の小窓）と似たページの小窓」の単体の試験（画面の外の、決まった形だけ）：
//   口の acts → 部品の押し込みの向き・お知らせの文・小窓の見出しの場所・上限の断りの体の読み方・似たページを探す体（must-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-691.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { mustFullOf, pageTarget, mustToast, partActsOf, similarBody } from "../features/F9/knowledge/must-shape";

describe("K691-UN", () => {
  it("K691-UN-001 partActsOf：口の acts の must-off（外せる＝いま付いている）は部品の must-on（押し込んだ形）へ・must-on（付けられる＝いま付いていない）は部品の must-off へ入れ替える・ほかの操作と並びは変えない・元の配列を変えない", () => {
    const api = ["must-off", "raise", "edit"] as const;
    expect(partActsOf(api, true)).toEqual(["must-on", "raise", "edit"]);
    expect(partActsOf(["must-on", "edit"], false)).toEqual(["must-off", "edit"]);
    expect(partActsOf(["copy"], true)).toEqual(["copy"]);
    expect(partActsOf([], false)).toEqual([]);
    expect(api).toEqual(["must-off", "raise", "edit"]);
  });

  it("K691-UN-002 mustToast・pageTarget：付けた／外したお知らせは「「必ず守る」を付けました（<棚>の棚 <used> / <limit> 件）」・小窓の対象は 棚 › フォルダ › 題名（グループの棚は「グループ：<名前>」）", () => {
    expect(mustToast(true, "会社", 9, 30)).toBe("「必ず守る」を付けました（会社の棚 9 / 30 件）");
    expect(mustToast(false, "営業", 3, 20)).toBe("「必ず守る」を外しました（営業の棚 3 / 20 件）");
    expect(pageTarget({ shelf: "company", shelf_name: "会社", folders: ["経理"] }, "経費の精算")).toBe(
      "会社 › 経理 › 経費の精算",
    );
    expect(pageTarget({ shelf: "group", shelf_name: "営業", folders: ["見積もり", "古い"] }, "値引き")).toBe(
      "グループ：営業 › 見積もり › 古い › 値引き",
    );
    expect(pageTarget({ shelf: "me", shelf_name: "自分", folders: [] }, "メモ")).toBe("自分 › メモ");
  });

  it("K691-UN-003 mustFullOf：409 の体の detail から 棚の名前・上限・いま付いているページ（id・題名・フォルダ）を読む・形が違う物は捨てる・detail が無い／壊れていれば null", () => {
    const ok = mustFullOf({
      error: "e-knw-060",
      code: "E-KNW-060",
      detail: {
        shelf_name: "営業",
        limit: 20,
        pages: [
          { id: "a", title: "値引き", folder: "会社 › 経理" },
          { id: 1, title: "壊れた行", folder: "" },
          { id: "b", title: "メール", folder: "" },
        ],
      },
    });
    expect(ok).toEqual({
      shelfName: "営業",
      limit: 20,
      pages: [
        { id: "a", title: "値引き", folder: "会社 › 経理" },
        { id: "b", title: "メール", folder: "" },
      ],
    });
    expect(mustFullOf({ code: "E-KNW-060" })).toBeNull();
    expect(mustFullOf({ detail: { shelf_name: "営業", limit: "x", pages: [] } })).toBeNull();
    expect(mustFullOf(null)).toBeNull();
  });

  it("K691-UN-004 similarBody：題名は前後の空白（全角も）を落とす・説明と本文は空なら送らない・本文は頭の 500 字（コードポイントで数える）・書いているページ自身を exclude_page_id に入れる", () => {
    expect(similarBody({ page_id: "p1", title: "　請求書　", desc: "", text: "  " })).toEqual({
      title: "請求書",
      exclude_page_id: "p1",
    });
    const b = similarBody({ page_id: "p1", title: "T", desc: " 説明 ", text: "あ".repeat(800) });
    expect(b.desc).toBe("説明");
    expect(Array.from(b.text ?? "").length).toBe(500);
    const emoji = similarBody({ page_id: "p1", title: "T", desc: "", text: "😀".repeat(600) });
    expect(Array.from(emoji.text ?? "").length).toBe(500);
    expect(similarBody({ page_id: "p1", title: "T", desc: "", text: "短い" }).text).toBe("短い");
  });
});
