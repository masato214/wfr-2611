// 問い合わせの口（K-949 作る・K-951 読む・K-952 返事と済み）の DB の答えの言葉 → HTTP と errors.json の文。
//   文言はコードに書かず正本（errors.json）から引く。ログに題・内容・画面の情報・ファイルの名前を出さない（場所と言葉だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 欄も details も付けない（在るかを漏らさない・控え帳） */
const flat = (code: string, status: number): HookReply => ({ status, body: kanameError(code).toJSON() });

/** 止める側に倒す（503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const inquiriesDown = (where: string, word: string): HookReply => {
  console.error(`[inquiries] ${where}：止める側に倒した（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

/** 欄ごとの 422（題・内容が空白だけ。契約の形が先に断るので、ここは 2 層目） */
export const blank = (field: string): HookReply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field, message: "空白だけでは送れません" }],
  },
});

/** DB の関数の答え { error: <言葉> } → 答え。知らない言葉は止める側（503・言葉は記録にだけ残す） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  if (word === "forbidden") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  // 添付が無い・別の人の・別の会社の・消した（D-156.26）
  if (word === "not_found") return flat("E-PAGE-001", 404);
  // 添付の検査が済んでいない・もう付けた（同時に付けた後の 1 つも）
  if (word === "attachment_unusable") return flat("E-INQ-001", 409);
  return inquiriesDown(where, word);
}
