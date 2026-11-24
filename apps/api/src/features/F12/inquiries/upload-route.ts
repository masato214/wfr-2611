// 問い合わせの添付の上げ終わりの受け口（POST /api/uploads/inquiry/:token/done・契約の口の外・K-950・D-156.11）と、
//   外の置き場が無いとき（開発・試験・CI）だけのローカルの上げ先（PUT /api/uploads/local）。セッションは見ない（印・署名だけで判定）。
//   上げ終わり：① 印の行を鍵を取らずに読む → ② 関門 C4 で置き場の物を読む（DB の接続を持たない）→ ③ 大きさ → ④ 頭のバイト
//   → ⑤ 1 つの取引で鍵を取り（同時の 2 回目は 404）、検査の印・置き場の参照・証跡を書く。③④⑤ で受けないときは置き場の物を消す
//   無い・見えない＝404（欄・details なし）・DB の失敗＝503 E-PAGE-003・種類が違う＝415 E-INQ-003・大きさ＝400／413 E-INQ-004
import { Hono } from "hono";
import type { Context } from "hono";
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { ObjectStore } from "@kaname/storage";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookDeps } from "../../../hooks/registry.js";
import { sniffOk } from "./sniff.js";
import { tokenHash } from "./upload.js";

/** 1 つの添付の上限（D-156.26） */
export const INQUIRY_MAX_BYTES = 10 * 1024 * 1024;
/** 印の形（32 バイトの乱数の base64url） */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

interface Peeked {
  id: string;
  tenant_id: string;
  member_id: string;
  mime: string;
  size: number;
  upload_ref: string;
}
type Status = 200 | 400 | 403 | 404 | 413 | 415 | 503;

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : "Error");
const catalog = (c: Context, status: Status, code: string) => c.json(new KanameError(code).toJSON(), status);
const notFound = (c: Context) => c.json({ error: "not_found", code: "E-PAGE-001" }, 404);

export interface InquiryDoneDeps {
  appPool: pg.Pool;
  objects: Pick<ObjectStore, "get" | "delete" | "acceptSignedPut" | "hasExternalPut">;
}

/** 受けない物を置き場から消す（消せなくても答えは変えない・記録は関門 C4 が残す） */
async function discard(d: InquiryDoneDeps, ctx: TenantContext, ref: string): Promise<void> {
  try {
    await d.objects.delete(ctx, ref);
  } catch (e) {
    console.error(`[inquiries] 受けない添付を置き場から消せなかった（${kindOf(e)}）`);
  }
}

async function peek(d: InquiryDoneDeps, hash: string): Promise<Peeked | null> {
  const r = await d.appPool.query<{ v: Peeked | null }>("select app.inquiry_attachment_peek($1) as v", [hash]);
  return r.rows[0]?.v ?? null;
}

/** ⑤ 1 つの取引：鍵を取って受ける。取れなければ false（同時の 2 回目・もう受けた） */
async function accept(d: InquiryDoneDeps, ctx: TenantContext, hash: string, p: Peeked, size: number): Promise<boolean> {
  return withTenant(d.appPool, ctx, async (cl) => {
    const t = await cl.query<{ id: string | null }>("select app.inquiry_attachment_take($1) as id", [hash]);
    if (t.rows[0]?.id !== p.id) return false;
    const r = await cl.query<{ ok: boolean }>("select app.inquiry_attachment_done($1, $2, $3) as ok", [
      p.id,
      p.upload_ref,
      size,
    ]);
    return r.rows[0]?.ok === true;
  });
}

async function done(d: InquiryDoneDeps, c: Context): Promise<Response> {
  const token = c.req.param("token") ?? "";
  if (!TOKEN_RE.test(token)) return notFound(c);
  const hash = tokenHash(token);
  let p: Peeked | null;
  try {
    p = await peek(d, hash);
  } catch (e) {
    console.error(`[inquiries] 上げ終わりの印を読めなかった（${kindOf(e)}）`);
    return catalog(c, 503, "E-PAGE-003");
  }
  if (!p) return notFound(c);
  const ctx: TenantContext = { tenantId: p.tenant_id, userId: p.member_id, role: "member" };
  const g = await d.objects.get(ctx, p.upload_ref);
  const body = g.status === "done" ? g.value.body : new Uint8Array(0);
  const placed = g.status === "done";
  if (body.byteLength > INQUIRY_MAX_BYTES) {
    await discard(d, ctx, p.upload_ref);
    return catalog(c, 413, "E-INQ-004");
  }
  if (body.byteLength !== Number(p.size)) {
    if (placed) await discard(d, ctx, p.upload_ref);
    return catalog(c, 400, "E-INQ-004");
  }
  if (!sniffOk(p.mime, body.subarray(0, 16))) {
    await discard(d, ctx, p.upload_ref);
    return catalog(c, 415, "E-INQ-003");
  }
  let ok: boolean;
  try {
    ok = await accept(d, ctx, hash, p, body.byteLength);
  } catch (e) {
    console.error(`[inquiries] 上げ終わりを記録できなかった（添付 ${p.id}・${kindOf(e)}）`);
    await discard(d, ctx, p.upload_ref);
    return catalog(c, 503, "E-PAGE-003");
  }
  // 同時の 2 回目・もう受けた：置き場の物は 1 回目の物なので消さない
  if (!ok) return notFound(c);
  return c.json({ data: { id: p.id, size: body.byteLength } }, 200);
}

/** ローカルの上げ先（外の置き場が無いときだけ）：署名どおりの大きさと種類の体だけを置く（S3 と同じく違う体は 403） */
async function localPut(d: InquiryDoneDeps, c: Context): Promise<Response> {
  const body = new Uint8Array(await c.req.arrayBuffer());
  const r = await d.objects.acceptSignedPut(c.req.query(), body, c.req.header("content-type") ?? null);
  if (r.status === "done") return c.body(null, 200);
  if (r.status === "denied") return c.json({ error: "forbidden", code: "SIGNATURE_INVALID" }, 403);
  return catalog(c, 503, "E-PAGE-003");
}

/** server.ts が /api/uploads に差す */
export function inquiryUploadRoute(deps: Pick<HookDeps, "appPool" | "objects">): Hono {
  const d: InquiryDoneDeps = { appPool: deps.appPool, objects: deps.objects };
  const app = new Hono();
  app.post("/inquiry/:token/done", (c) => done(d, c));
  if (!d.objects.hasExternalPut()) app.put("/local", (c) => localPut(d, c));
  return app;
}
