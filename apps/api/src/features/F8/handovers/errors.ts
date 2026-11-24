// 段 9 の渡す・答える口の、DB の関数の答えの言葉 → HTTP と errors.json の文（K-401）。文言はコードに書かず正本（errors.json）から引く。
//   振り分けの共通の確かめ（app.handover_gate・app.handover_answer_gate）と、種類の葉（K-402〜K-410）の DB の関数の答えは全部 replyOf で返す
//   （種類の葉はこのファイルを直さない）。ログに理由・お願い・人の名前・メールを出さない（言葉と場所だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー（欄・明細の値つき）。欄があれば入口と同じ形の details にも 1 件入れる */
export const fromCatalog = (
  code: string,
  status: number,
  o: { field?: string; detail?: Record<string, unknown>; message?: string } = {},
): HookReply => {
  const e = kanameError(code, o.detail ?? {});
  const body: Record<string, unknown> = {
    ...e.toJSON(),
    ...(o.field ? { field: o.field, details: [{ field: o.field, message: o.message ?? e.entry.message }] } : {}),
  };
  // 404 には field・details・detail を付けない（在るかを漏らさない・控え帳 2026-11-20 16:51）：正本の体の空の detail も外す
  if (status === 404) delete body["detail"];
  return { status, body };
};

/** 入力の形違い（422・欄つき）。入口（op.ts）と同じ形 */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** 見つからない（他の会社・見えない・消した。中身を返さない） */
export const notFound = (): HookReply => fromCatalog("E-PAGE-001", 404);

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉（か例外の種類）だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[handover] ${where}：${word} なので止める側に倒した`);
  return fromCatalog("E-PAGE-003", 503);
};

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

const TARGET_SUSPENDED: Record<string, string> = { suspended: "止まっています", invited: "招待中です" };
const asText = (v: unknown): string => (typeof v === "string" ? v : "");

/** 相手の断り（欄 to_member_id か to_scope_id） */
function targetReply(v: Record<string, unknown>): HookReply | null {
  const reason = asText(v["reason"]);
  if (Object.hasOwn(TARGET_SUSPENDED, reason))
    return fromCatalog("E-HND-006", 409, { detail: { 名前: asText(v["名前"]), 訳: TARGET_SUSPENDED[reason] } });
  if (reason === "gone") return fromCatalog("E-HND-014", 404);
  if (reason === "self") return fromCatalog("E-HND-010", 409);
  if (reason === "missing") return fromCatalog("E-HND-013", 422, { field: "to_member_id" }); // 契約の形（pass・distribute は相手かグループが要る）の外の入力
  if (reason === "scope") return fromCatalog("E-HND-012", 404);
  return null;
}

/** DB の関数の答え { error: <言葉>, … } → 答え。知らない言葉は止める側（503・言葉はログにだけ残し、答えに出さない） */
export function replyOf(v: { error: string; [k: string]: unknown }, where = "答え"): HookReply {
  const word = v.error;
  if (word === "not_found") return notFound();
  if (word === "forbidden" || word === "replaces_forbidden") return fromCatalog("E-HND-002", 403);
  if (word === "closed") return fromCatalog("E-HND-009", 409);
  if (word === "busy") return fromCatalog("E-HND-003", 409);
  if (word === "waiting") return fromCatalog("E-HND-004", 409, { detail: { 名前: asText(v["名前"]) } });
  if (word === "target") {
    const r = targetReply(v);
    if (r) return r;
  }
  // 一緒に切り替えるもの：ワークスペースの決まり（DB の中身）と合わない＝今の状態ではできない（409）。形の誤りは入口（input.ts）の 422
  if (word === "switch") return fromCatalog("E-HND-011", 409);
  if (word === "replaces_decided" || word === "decided")
    return fromCatalog("E-HND-005", 409, { detail: { 状態: asText(v["state"]) } });
  if (word === "due") return fromCatalog("E-HND-008", 409);
  return down(where, `知らない答え（${word}）`);
}
