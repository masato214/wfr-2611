// 運営の受信箱を読む（K-973）の契約の口 listOpsInquiries・getOpsInquiry。振る舞いの本体は apps/api/src/features/F12/ops/inbox-read.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createGetOpsInquiry, createListOpsInquiries } from "../features/F12/ops/inbox-read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsInboxReadHooks(d: HookDeps): Record<string, Hook> {
  return {
    listOpsInquiries: { before: createListOpsInquiries(d.appPool) },
    getOpsInquiry: { before: createGetOpsInquiry(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsInboxReadHooks",
  make: (d) => opsInboxReadHooks(d),
  fuzz: "same",
});
