// 問い合わせる口（K-949）：createInquiry（POST /api/v1/inquiries）。
//   入力を整える（題と内容の前後の空白・画面の情報の 4 つの鍵・添付の重なり）→ 関門 C2 の app.inquiry_create を withTenant の 1 取引で 1 回 →
//   断りの言葉 → 番号（errors.ts）。答えは 201 { data: MyInquiry }。運営へのメール・鈴は出さない（D-125.130：運営は受信箱の数で知る）。
//   字数の上限は契約のまま（D-130.1）。ログに題・内容・画面の情報・ファイルの名前を出さない（例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { blank, replyOf } from "./errors.js";
import { toMyInquiry, type InquiryRow } from "./shape.js";

/** 画面の情報（D-128.71）で残す鍵と、字の上限。知らない鍵・型の違う値・長すぎる値は落とす（422 にしない） */
const CONTEXT_TEXT: Record<string, number> = { path: 500, at: 40, browser: 200 };

export function cleanContext(v: unknown): Record<string, string | boolean> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const src = v as Record<string, unknown>;
  const out: Record<string, string | boolean> = {};
  for (const [k, max] of Object.entries(CONTEXT_TEXT)) {
    const x = src[k];
    if (typeof x === "string" && x.length <= max) out[k] = x;
  }
  if (typeof src["pc"] === "boolean") out["pc"] = src["pc"];
  return out;
}

/** 重なりを 1 つにし、並びは最初に出た順のまま */
export const uniqueIds = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

type Made = { data?: InquiryRow; error?: unknown };

export function createCreateInquiry(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const title = text(a.input["title"]);
    const body = text(a.input["body"]);
    if (!title) return blank("title");
    if (!body) return blank("body");
    const topic = typeof a.input["topic"] === "string" ? a.input["topic"] : null;
    const ids = uniqueIds(a.input["attachment_ids"]);
    const context = cleanContext(a.input["context"]);

    const where = "問い合わせを作る";
    let r: Made | undefined;
    try {
      r = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Made }>("select app.inquiry_create($1, $2, $3, $4::uuid[], $5::jsonb) as v", [
              topic,
              title,
              body,
              ids,
              JSON.stringify(context),
            ])
          ).rows[0]?.v,
      );
    } catch (e) {
      // 書く所の失敗（1 つの取引なので何も残らない）。中身を返さず、ログは例外の種類だけ
      console.error(`[inquiries] 問い合わせを作れなかった（${(e as Error)?.name ?? "Error"}）`);
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
    if (!r) return replyOf({ error: "empty" }, where);
    if (r.error !== undefined || !r.data) return replyOf(r, where);
    return { status: 201, body: { data: toMyInquiry(r.data) } };
  };
}
