// 問い合わせに返事を書く口と済みにする口（K-952）：postInquiryMessage（POST /api/v1/inquiries/:id/messages）・resolveMyInquiry（POST /api/v1/inquiries/:id/resolve）。
//   認証・上限（60/分/人）・先方の権限の人の 403・入力の形（422）・道の id の形は契約の入口（op.ts）が先に確かめる。
//   書く：内容の前後の空白を落とし、添付の重なりを 1 つに → 関門 C2 の app.inquiry_post を withTenant の 1 取引で 1 回。
//     どの状態からも「返事を待っている」（open）に戻る（済み・後での後でも開き直る・D-156.25）。答えは 201 { data: MyInquiryMessage }（K-951 の toMessage）。
//   済み：app.inquiry_resolve を 1 回。もう済みなら何も変えずに同じ答え。答えは 200 { data: MyInquiry }（K-949 の toMyInquiry）。
//   見えない問い合わせ（他人・別の会社・無い・消した）は 404 E-PAGE-001（欄なし）。断りの言葉 → 番号は K-949 の errors.ts。
//   運営への知らせは作らない（D-125.130）。ログに内容・ファイルの名前を出さない（例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { blank, inquiriesDown, replyOf } from "./errors.js";
import { toMessage, type MessageRow } from "./read.js";
import { toMyInquiry, type InquiryRow } from "./shape.js";
import { uniqueIds } from "./create.js";

type Answer<T> = { data?: T; error?: unknown };

/** 書き込みの元（DB の関数の答え。created_at は jsonb の字） */
type PostedRow = Omit<MessageRow, "created_at"> & { created_at: string };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** DB の関数を withTenant の 1 取引で 1 回呼ぶ。書く所の失敗（例外）は undefined ではなく例外のまま上げる */
async function callFn<T>(
  appPool: pg.Pool,
  a: HookArgs,
  sql: string,
  params: unknown[],
): Promise<Answer<T> | undefined> {
  return withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Answer<T> }>(sql, params)).rows[0]?.v);
}

export function createPostInquiryMessage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const body = text(a.input["body"]);
    if (!body) return blank("body");
    const ids = uniqueIds(a.input["attachment_ids"]);
    const where = "問い合わせに書く";
    let r: Answer<PostedRow> | undefined;
    try {
      r = await callFn<PostedRow>(appPool, a, "select app.inquiry_post($1::uuid, $2, $3::uuid[]) as v", [
        a.id,
        body,
        ids,
      ]);
    } catch (e) {
      return inquiriesDown(where, (e as Error)?.name ?? "Error");
    }
    if (!r) return replyOf({ error: "empty" }, where);
    if (r.error === "empty") return blank("body");
    if (r.error !== undefined || !r.data) return replyOf(r, where);
    return { status: 201, body: { data: toMessage({ ...r.data, created_at: new Date(r.data.created_at) }) } };
  };
}

export function createResolveMyInquiry(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const where = "問い合わせを済みにする";
    let r: Answer<InquiryRow> | undefined;
    try {
      r = await callFn<InquiryRow>(appPool, a, "select app.inquiry_resolve($1::uuid) as v", [a.id]);
    } catch (e) {
      return inquiriesDown(where, (e as Error)?.name ?? "Error");
    }
    if (!r) return replyOf({ error: "empty" }, where);
    if (r.error !== undefined || !r.data) return replyOf(r, where);
    return { status: 200, body: { data: toMyInquiry(r.data) } };
  };
}
