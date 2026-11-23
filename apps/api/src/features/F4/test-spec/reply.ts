// 確認項目の口の断りの答え（K-434。K-435 も使う）。番号の決まり（控え帳 2026-11-20 16:51・2026-11-21 01:15）：
//   422＝契約に書ける形の誤りだけ（番号なし・欄つき）／404＝無い・見えない（欄・details なし＝在るかを漏らさない）／
//   409＝今の状態ではできない（欄・details・detail なし）／403＝書けない人。ログに題名の文を出さない（チケットの id と例外の種類だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 形の誤り（422・欄つき）。入口（op.ts）の形の確かめと同じ答え。欄は title */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** 無い・見えない・消された・別の会社（入口の 404 と同じ体） */
export const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });

/** 見えるが書けない人 */
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** 完了したチケットの確認項目は変えられない（409・E-SPEC-001・D-150.33）。体は error と code だけ */
export const conflictDone = (): HookReply => {
  const e = kanameError("E-SPEC-001");
  return { status: e.status, body: { error: e.entry.cls, code: e.code } };
};

/** Kaname の側で落ちた（DB に書けない・読めない）。何も残さなかったとき（503・E-PAGE-003） */
export const unavailable = (): HookReply => {
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 先に変えられた（版が今と違う・409・E-SPEC-020）。体は error と code だけ */
export const conflictVersion = (): HookReply => {
  const e = kanameError("E-SPEC-020");
  return { status: e.status, body: { error: e.entry.cls, code: e.code } };
};

/** チェックが付いている行の文は直せない（409・E-SPEC-021・外してから直す） */
export const conflictChecked = (): HookReply => {
  const e = kanameError("E-SPEC-021");
  return { status: e.status, body: { error: e.entry.cls, code: e.code } };
};

/** ナレッジから入った行は文を直せない・行を外せない（409・E-SPEC-022） */
export const conflictLocked = (): HookReply => {
  const e = kanameError("E-SPEC-022");
  return { status: e.status, body: { error: e.entry.cls, code: e.code } };
};
