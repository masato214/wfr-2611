// ナレッジの口の断りの答え（K-675・土台 4 章・控え帳 2026-11-20 16:51）：
//   422＝契約に書ける形の誤りだけ（番号なし・欄つき）／404＝無い・見えない・消した・別の会社（体は error と code だけ＝在るかを漏らさない）／
//   409＝今の状態ではできない（E-KNW・体は error と code。差し込む値は detail 単数＝上限の E-KNW-060）／403＝その棚に書けない／
//   503＝DB が使えない（E-PAGE-003・控え帳 2026-11-22 18:30）。ログに題名・本文を出さない
import { isKnown } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 無い・見えない・消した・別の会社（入口の 404 と同じ体） */
export const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });

/** 見えるが書けない（その棚に書けない人） */
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** 今の状態ではできない（409）。番号は台帳（errors.json）に在る物だけ。無い番号は書き間違いなので例外 */
export const conflict = (code: string, detail?: Readonly<Record<string, unknown>>): HookReply => {
  if (!isKnown(code)) throw new Error(`台帳に無いエラーの番号：${code}`);
  return { status: 409, body: { error: "conflict", code, ...(detail === undefined ? {} : { detail }) } };
};

/** DB が使えない（想定外の例外・取引が落ちた）。何も残さなかったとき */
export const unavailable = (): HookReply => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });

/** 形の誤り（422・欄つき）。入口（op.ts）の形の確かめと同じ答え。
 *  複数行の定義はファイルの最後に置く（契約の形の検査 SHAPE-010 は定義の次の 1 行も中身に数えるため、次の口の状態コードを拾わせない） */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
