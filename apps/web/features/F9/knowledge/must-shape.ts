// K-691「必ず守る」と似たページの、画面の外の純粋な関数（@/ を読まない・元の値を変えない）。
//   口の答えの形は 07_functional/段10-F9/土台-knowledge.md の 3.2 と K-685（setKnowledgeMust）・K-686（findSimilarKnowledge）
import type { PageBrief, ShelfKind } from "./types";

/** 口の acts の must-on ⇔ must-off を部品の押し込みの読みに入れ替える（K-682 の shape.ts の物を使う） */
export { partActsOf } from "./shape";

/** 本文が長くて付けられないときの訳（仮） */
export const MUST_BLOCKED_TOO_LONG = "本文が 2,000 字を超えているので、「必ず守る」は付けられません。";
/** 似たページを探せなかったときのお知らせ（仮） */
export const SIMILAR_FAILED = {
  save: "似たページを探せませんでした。このまま書き終えます。",
  raise: "似たページを探せませんでした。このまま頼みます。",
} as const;
/** 似たページを探す口へ送る本文の長さ（コードポイント） */
export const SIMILAR_TEXT_HEAD = 500;

/** 付けた／外したお知らせ（仮） */
export function mustToast(on: boolean, shelfName: string, used: number, limit: number): string {
  return `「必ず守る」を${on ? "付けました" : "外しました"}（${shelfName}の棚 ${used} / ${limit} 件）`;
}

export interface TargetPlace {
  shelf: ShelfKind;
  shelf_name: string;
  folders: readonly string[];
}

/** 小窓の対象の行：棚 › フォルダ › 題名（グループの棚は「グループ：<名前>」） */
export function pageTarget(place: TargetPlace, title: string): string {
  const shelf = place.shelf === "group" ? `グループ：${place.shelf_name}` : place.shelf_name;
  return [shelf, ...place.folders, title].join(" › ");
}

export interface MustFullPage {
  id: string;
  title: string;
  folder: string;
}
export interface MustFull {
  shelfName: string;
  limit: number;
  pages: MustFullPage[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 上限の断り（409 E-KNW-060）の体の detail を読む。形が違う行は捨てる・detail が壊れていれば null */
export function mustFullOf(body: unknown): MustFull | null {
  if (!isObj(body) || !isObj(body["detail"])) return null;
  const d = body["detail"];
  const shelfName = d["shelf_name"];
  const limit = d["limit"];
  const pages = d["pages"];
  if (typeof shelfName !== "string" || typeof limit !== "number" || !Number.isFinite(limit) || !Array.isArray(pages))
    return null;
  const rows = pages.filter(
    (p): p is MustFullPage =>
      isObj(p) && typeof p["id"] === "string" && typeof p["title"] === "string" && typeof p["folder"] === "string",
  );
  return { shelfName, limit, pages: rows.map((p) => ({ id: p.id, title: p.title, folder: p.folder })) };
}

export interface SimilarSource {
  page_id: string;
  title: string;
  desc: string;
  text: string;
}
export interface SimilarBody {
  title: string;
  desc?: string;
  text?: string;
  exclude_page_id: string;
}

/** 似たページを探す口の体：題名は前後の空白を落とす・説明と本文は空なら送らない・本文は頭の 500 字だけ */
export function similarBody(src: SimilarSource): SimilarBody {
  const desc = src.desc.trim();
  const text = src.text.trim() ? Array.from(src.text).slice(0, SIMILAR_TEXT_HEAD).join("") : "";
  return {
    title: src.title.trim(),
    ...(desc ? { desc } : {}),
    ...(text ? { text } : {}),
    exclude_page_id: src.page_id,
  };
}

/** 似たページの答えの並び（形が違う行は捨てる） */
export function briefsOf(pages: unknown): PageBrief[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .filter(
      (p): p is PageBrief =>
        isObj(p) &&
        typeof p["id"] === "string" &&
        typeof p["title"] === "string" &&
        typeof p["desc"] === "string" &&
        typeof p["place"] === "string",
    )
    .map((p) => ({ id: p.id, title: p.title, desc: p.desc, place: p.place }));
}
