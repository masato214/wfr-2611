// 自分の問い合わせを読む口（K-951）の契約の口 listMyInquiries・getMyInquiry。振る舞いの本体は apps/api/src/features/F12/inquiries/read.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createGetMyInquiry, createListMyInquiries } from "../features/F12/inquiries/read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function inquiryReadHooks(d: HookDeps): Record<string, Hook> {
  return {
    listMyInquiries: { before: createListMyInquiries(d.appPool) },
    getMyInquiry: { before: createGetMyInquiry(d.appPool) },
  };
}

export const register = defineHooks({
  name: "inquiryReadHooks",
  make: (d) => inquiryReadHooks(d),
  fuzz: "same",
});
