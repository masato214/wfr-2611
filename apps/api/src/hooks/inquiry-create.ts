// 問い合わせる口（K-949）の契約の口。振る舞いの本体は apps/api/src/features/F12/inquiries/create.ts。
//   読む口（K-951）・返事と済み（K-952）・添付を上げる（K-950）は別のファイル（同じファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createCreateInquiry } from "../features/F12/inquiries/create.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function inquiryCreateHooks(d: HookDeps): Record<string, Hook> {
  return {
    createInquiry: { before: createCreateInquiry(d.appPool) },
  };
}

export const register = defineHooks({
  name: "inquiryCreateHooks",
  make: (d) => inquiryCreateHooks(d),
  fuzz: "same",
});
