// 会社の項目の値を書く（K-564）の答え：DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   断る番号は役割で分ける（代表の答え answer=f0f290e785a9・03_architecture/共通の決まり.md）：
//     422＝形の誤り（契約に書ける物だけ）／404＝指した物が無い・見えない（在るかを漏らさない）／409＝今の状態ではできない
//   404・409 の body は error と code などの正本の文だけ（field・details・detail を付けない）。
//   作るとき（K-437）も同じ表を読む（関数 app.ticket_fields_set の言葉 → 番号）。ログに値の字・項目の名前を出さない（ログは場所と言葉だけ）
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
  console.error(`[ticket-fields] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return bare("E-PAGE-003", 503);
};

/** 欄 fields の形の誤りの文（422） */
export const FIELDS_SHAPE_MESSAGE =
  "fields は、項目の id（uuid）を鍵に、文字・数・true か false・文字の並び・null のどれかを値にした 1 つ以上の組で送ってください";
export const FIELDS_DUPLICATE_MESSAGE = "同じ項目の id が重なっています";

/** 項目の値を決められない 409 の番号（DB の関数の言葉 → 正本の番号） */
export const FIELD_CODES: Readonly<Record<string, string>> = {
  not_in_kind: "E-FLD-001",
  bad_option: "E-FLD-002",
  bad_type: "E-FLD-003",
  required_empty: "E-FLD-004",
};

/** DB の関数 app.ticket_fields_set の答え { error: <言葉> } → 答え。知らない言葉は止める側（503） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  // チケットが無い・消した・見えない／項目が無い・消した・別の会社（どちらも在るかを漏らさない）
  if (word === "not_found" || word === "field_not_found") return bare("E-PAGE-001", 404);
  if (word === "not_member" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  const code = FIELD_CODES[word];
  if (code) return bare(code, 409);
  // 守りの判定で例外（guard_failed・D-136.1）。知らない言葉も止める側
  return down(where, word);
}
