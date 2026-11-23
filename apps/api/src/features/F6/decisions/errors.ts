// 決定の口（K-390 読む・足す／K-391 改める・取り消す）の DB の答えの言葉 → HTTP と errors.json の文。
//   文言はコードに書かず正本（errors.json）から引く（F5/approve-complete/errors.ts と同じ形）。
//   ログに決めたことの字・理由・人の id を出さない（場所と言葉だけ・D-136.1）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー（欄つき。details の文は details で上書きできる） */
export const fromCatalog = (code: string, status: number, o: { field?: string; message?: string } = {}): HookReply => {
  const e = kanameError(code);
  return {
    status,
    body: {
      ...e.toJSON(),
      ...(o.field ? { field: o.field, details: [{ field: o.field, message: o.message ?? e.entry.message }] } : {}),
    },
  };
};

/** 取引先のルールにするのは取引先の画面ができてから（段 12・代表の答え ㉒） */
export const CLIENT_RULE_LATER = "取引先の画面ができてから使えます";

/** action が無い・知らない言葉（改める・取り消すの口が関数を呼ぶ前に使う・K-391）。入口の zod は enum を読まないので口が自分で断る */
export const badAction = (): HookReply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "action", message: "revise・cancel のどちらかを選んでください" }],
  },
});

/** 指した人・書き込みが見つからないときの details の文（欄ごと） */
export const DECIDER_NOT_FOUND = "決めた人は、この会社のメンバーから選んでください";
export const SOURCE_NOT_FOUND = "元の書き込みが見つかりません。やり取りを読み直してください";

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const decisionsDown = (where: string, word: string): HookReply => {
  console.error(`[decisions] ${where}：止める側に倒した（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

/** DB の関数の答え { error: <言葉>, field? } → 答え。知らない言葉は止める側（503・言葉は記録にだけ残す） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  if (word === "not_found") return fromCatalog("E-PAGE-001", 404);
  // 今のメンバーでない・書けない（見るだけの人は足せない・⑧）
  if (word === "not_member" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (word === "text_empty") return fromCatalog("E-VAL-042", 422, { field: "text" });
  // 改める・取り消す（K-391）：別の人が先に改めた／取り消した（読み直してもう一度・㉒）、取り消す理由が空
  if (word === "superseded") return fromCatalog("E-CONF-031", 409);
  if (word === "cancelled") return fromCatalog("E-CONF-033", 409);
  if (word === "reason_empty") return fromCatalog("E-VAL-045", 422, { field: "reason" });
  // 指した人・書き込みが無い・見えない（同じ会社の今のメンバーでない・このチケットの消していない書き込みでない）は 404（形の誤りではない・代表の答え answer=431fc50df51b・f0f290e785a9）
  if (word === "bad_decider")
    return fromCatalog("E-PAGE-001", 404, { field: "decided_by_member_id", message: DECIDER_NOT_FOUND });
  if (word === "bad_source")
    return fromCatalog("E-PAGE-001", 404, { field: "source_message_id", message: SOURCE_NOT_FOUND });
  // 取引先のルールにする：段 12 の取引先の画面ができるまで、今の状態ではできない（409・PM の決め）。details は決めた文
  if (word === "not_yet") return fromCatalog("E-CONF-037", 409, { field: "promoted_to", message: CLIENT_RULE_LATER });
  if (word === "bad_promoted")
    return {
      status: 422,
      body: {
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "promoted_to", message: "ticket か client_rule" }],
      },
    };
  // 守りの判定で例外（guard_failed）と知らない言葉は止める側
  return decisionsDown(where, word);
}
