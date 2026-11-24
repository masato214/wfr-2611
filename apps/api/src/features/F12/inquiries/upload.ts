// 問い合わせの添付を上げる先を求める口（uploadInquiryAttachment・POST /api/v1/inquiries/attachments・K-950）。
//   体（1 つ 10MB・D-156.26）は口を通さない：添付の行と 1 回だけの印を DB の関数 app.inquiry_attachment_start で作り、
//   関門 C4 が大きさと種類を署名した置き場の上げ先（upload_url）と、上げ終わりの受け口（done_url）を返す。
//   印はここで 1 回だけ返す（冪等の器に残さない）。行には印の sha256 だけを持つ。ログに名前・中身・印を出さない
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { ObjectStore } from "@kaname/storage";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";

/** 印の期限（10 分）と上げ先の期限は同じ */
export const UPLOAD_TTL_SEC = 600;
/** 道の区切りを落として空になった名前 */
const NAME_FALLBACK = "ファイル";

export interface InquiryUploadDeps {
  appPool: pg.Pool;
  objects: Pick<ObjectStore, "presignPut">;
  /** 口の住所の頭（config.baseUrl）。上げ終わりの受け口とローカルの上げ先はこの下 */
  baseUrl: string;
}

/** 印の hash（行が持つのはこれだけ） */
export const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");

/** 名前は前後の空白を落とし、道の区切り（/・\）の最後の後ろだけを残す。残りが空なら「ファイル」 */
export function cleanName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  const last = (s.split(/[/\\]/).pop() ?? "").trim();
  return last || NAME_FALLBACK;
}

const unavailable = (): HookReply => ({ status: 503, body: new KanameError("E-PAGE-003").toJSON() });
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const kindOf = (e: unknown): string => (e instanceof Error ? e.name : "Error");

interface Started {
  data?: { id: string; upload_ref: string; expires_at: string };
  error?: string;
}

export function inquiryUploadHook(d: InquiryUploadDeps): Hook {
  const base = d.baseUrl.replace(/\/+$/, "");
  return {
    noIdempotency: true, // 答えに 1 回だけの印（done_url）が入る。器に残さない
    before: async (a: HookArgs): Promise<HookReply> => {
      const name = cleanName(a.input["name"]);
      const mime = String(a.input["content_type"]);
      const size = Number(a.input["size"]);
      const token = randomBytes(32).toString("base64url");
      let v: Started | undefined;
      try {
        v = await withTenant(
          d.appPool,
          a.ctx,
          async (cl) =>
            (
              await cl.query<{ v: Started }>("select app.inquiry_attachment_start($1, $2, $3, $4) as v", [
                name,
                mime,
                size,
                tokenHash(token),
              ])
            ).rows[0]?.v,
        );
      } catch (e) {
        console.error(`[inquiries] 添付の行を作れなかった（${kindOf(e)}）`);
        return unavailable();
      }
      if (!v?.data) return v?.error === "forbidden" ? forbidden() : unavailable();
      const s = await d.objects.presignPut(a.ctx, v.data.upload_ref, {
        contentType: mime,
        size,
        ttlSec: UPLOAD_TTL_SEC,
        localBase: `${base}/api/uploads/local`,
      });
      // 署名が作れない：行は消さない（印が期限で使えなくなる）
      if (s.status !== "done") {
        console.error(`[inquiries] 上げ先を作れなかった（添付 ${v.data.id}・${s.status}）`);
        return unavailable();
      }
      return {
        status: 201,
        body: {
          data: {
            id: v.data.id,
            upload_url: s.value.url,
            done_url: `${base}/api/uploads/inquiry/${token}/done`,
            expires_at: new Date(v.data.expires_at).toISOString(),
          },
        },
      };
    },
  };
}
