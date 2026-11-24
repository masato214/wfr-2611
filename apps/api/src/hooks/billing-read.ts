// 段 13「請求とプラン（利用者の側）」の請求書を読む口（K-958）。振る舞いの本体は apps/api/src/features/F12/billing/read.ts。
//   材料の config は要求の時に読む（make で読まない・k144 の葉の土台 leafHooks は appPool しか渡さない）
import type { Hook } from "../contract/deps.js";
import { downloadInvoicePdf, getBilling, type BillingDeps } from "../features/F12/billing/read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function billingReadHooks(
  d: Pick<HookDeps, "appPool"> & Partial<Pick<HookDeps, "objects" | "config">>,
): Record<string, Hook> {
  const deps: BillingDeps = {
    appPool: d.appPool,
    objects: {
      signUrl: (ctx, ref, ttl) => {
        if (!d.objects) throw new Error("置き場の関門が無い");
        return d.objects.signUrl(ctx, ref, ttl);
      },
    },
    config: () => d.config,
  };
  return {
    // 請求書の画面の中身（読むだけ・関数 1 回・1 取引）
    getBilling: { before: getBilling(deps) },
    // 出した請求書の PDF の期限つきの署名 URL（関門 C4）
    downloadInvoicePdf: { before: downloadInvoicePdf(deps) },
  };
}

export const register = defineHooks({
  name: "billingReadHooks",
  make: (d) => billingReadHooks(d),
  fuzz: "same",
});
