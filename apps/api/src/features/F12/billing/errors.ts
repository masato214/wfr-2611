// 段 13 の請求書を読む口（K-958）の、DB の関数の断りの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   ログに請求先の字・額・人の名前を出さない（場所と例外の種類だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー。404 には detail を付けない（在るかを漏らさない） */
export const fromCatalog = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code, {}).toJSON() };
  if (status === 404) delete body["detail"];
  return { status, body };
};

/** 止める側に倒す（503・E-PAGE-003）。ログは決まった字と例外の種類だけ */
export const down = (e: unknown): HookReply => {
  console.error(`[billing] 請求書を読めなかった（${kindOf(e)}）`);
  return fromCatalog("E-PAGE-003", 503);
};

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
export function replyOf(word: string): HookReply {
  if (word === "forbidden") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (word === "not_found") return fromCatalog("E-PAGE-001", 404);
  if (word === "pdf_missing") return fromCatalog("E-BILL-001", 409);
  return down({ name: `unknown:${word}` });
}
