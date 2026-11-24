// 優先度・親を変える（K-440）の答え：DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   断る番号は役割で分ける（代表の答え answer=f0f290e785a9・03_architecture/共通の決まり.md）：
//     422＝形の誤り（契約に書ける物だけ）／404＝指した物が無い・見えない（在るかを漏らさない）／409＝今の状態ではできない
//   404・409 の body は error と code などの正本の文だけ（field・details・detail を付けない）。
//   写し元は F6/progress/errors.ts と同じ形（F6 のファイルは触らない）。ログに理由の字・題名を出さない（ログは場所と言葉だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 入力の形違い（422・欄ごとの文）。入口（op.ts）と同じ形 */
export const invalid = (details: { field: string; message: string }[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー（field・details・detail を付けない：在るかを漏らさない・欄を指さない） */
export const bare = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
};

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[ticket-sort] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return bare("E-PAGE-003", 503);
};

/** 優先度に使える値 */
export const PRIORITIES = ["mid", "high"] as const;
export const PRIORITY_MESSAGE = "mid か high のどちらかにしてください";
/** 高にするのに理由が無い・空・空白と制御文字だけ（形の誤り・422） */
export const REASON_MISSING_MESSAGE = "優先度を高にするときは、理由を書いてください";
/** 高でないのに理由を付けた・理由だけを送った（形の誤り・422） */
export const REASON_ONLY_HIGH_MESSAGE = "優先度を高にするときだけ書けます";
/** 親の id の形の誤り（422） */
export const PARENT_MESSAGE = "チケットの id（uuid）か null で送ってください";

/** 親を決められない 409 の番号（DB の関数の言葉 → 正本の番号） */
export const PARENT_CODES: Readonly<Record<string, string>> = {
  parent_self: "E-TKT-001",
  parent_below: "E-TKT-002",
  parent_depth: "E-TKT-003",
  parent_due: "E-TKT-004",
};

/** DB の関数 app.ticket_sort_set の答え { error: <言葉> } → 答え。知らない言葉は止める側（503） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  // チケットが無い・消した・見えない／親が無い・消した・別の会社・見えない（どちらも在るかを漏らさない）
  if (word === "not_found" || word === "parent_not_found") return bare("E-PAGE-001", 404);
  if (word === "not_member" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  const parentCode = PARENT_CODES[word];
  if (parentCode) return bare(parentCode, 409);
  // 守りの二重の層（口の前処理と同じ決まり。口を通れば起きない）
  if (word === "reason_required") return invalid([{ field: "priority_reason", message: REASON_MISSING_MESSAGE }]);
  if (word === "bad_priority") return invalid([{ field: "priority", message: PRIORITY_MESSAGE }]);
  // 守りの判定で例外（guard_failed・D-136.1）。知らない言葉も止める側
  return down(where, word);
}
