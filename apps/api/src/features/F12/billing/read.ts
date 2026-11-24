// 請求書を読む口（getBilling・GET /workspace/billing）と請求書の PDF の口（downloadInvoicePdf・GET /invoices/:id/pdf）（K-958・D-156.29・D-156.31・D-156.32）。
//   見られるのは管理者と「プランと支払い」（tenants の billing の能力）を付けた人。入口（op.ts の権限の言葉 admin）と DB の関数の頭の 2 層で確かめる。
//   中身は DB の関数（app.billing_get・app.billing_invoice_pdf）が 1 取引・文 1 つで返す。支払い条件と振込先は設定の値（D-125.24・直書きしない）。
//   PDF は置き場の関門 C4（objects.signUrl）で期限つきの署名 URL を出す（証跡は関門が書く）。読むだけ（DB に書かない）。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Config } from "@kaname/config";
import type { ObjectStore } from "@kaname/storage";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { down, replyOf } from "./errors.js";

/** PDF の署名 URL の期限（秒）。10 分 */
export const PDF_URL_TTL_SEC = 600;

export interface BillingDeps {
  appPool: pg.Pool;
  objects: Pick<ObjectStore, "signUrl">;
  /** 要求の時に読む（材料を作る時に読まない・k144 の葉の土台は appPool しか渡さない） */
  config: () => Partial<Pick<Config, "baseUrl" | "billing">> | undefined;
}

type Fn = { error?: string; data?: Record<string, unknown>; pdf_ref?: string };

const call = async (d: BillingDeps, a: HookArgs, sql: string, args: unknown[]): Promise<Fn | null> =>
  withTenant(d.appPool, a.ctx, async (cl) => (await cl.query<{ v: Fn | null }>(sql, args)).rows[0]?.v ?? null);

export function getBilling(d: BillingDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: Fn | null;
    try {
      v = await call(d, a, "select app.billing_get() as v", []);
    } catch (e) {
      return down(e);
    }
    if (!v) return down({ name: "empty" });
    if (v.error) return replyOf(v.error);
    const billing = d.config()?.billing;
    return {
      status: 200,
      body: {
        data: {
          ...v.data,
          terms: billing?.terms ?? "",
          payee: { lines: [...(billing?.payeeLines ?? [])] },
        },
      },
    };
  };
}

export function downloadInvoicePdf(d: BillingDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: Fn | null;
    try {
      v = await call(d, a, "select app.billing_invoice_pdf($1) as v", [a.id ?? ""]);
    } catch (e) {
      return down(e);
    }
    if (!v) return down({ name: "empty" });
    if (v.error) return replyOf(v.error);
    if (!v.pdf_ref) return down({ name: "no_ref" });
    const baseUrl = d.config()?.baseUrl;
    let s: Awaited<ReturnType<ObjectStore["signUrl"]>>;
    try {
      s = await d.objects.signUrl(a.ctx, v.pdf_ref, PDF_URL_TTL_SEC);
    } catch (e) {
      return down(e);
    }
    if (s.status !== "done" || !baseUrl)
      return down({ name: s.status === "done" ? "no_base_url" : `sign_${s.status}` });
    return {
      status: 200,
      body: { data: { url: `${baseUrl}/api/auth-ext${s.value.url}`, expires_at: s.value.expiresAt.toISOString() } },
    };
  };
}
