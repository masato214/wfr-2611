// 問い合わせの添付を上げる先を求める口（uploadInquiryAttachment・K-950）の登録（K-326）。
//   上げ終わりの受け口（契約の口の外）は server.ts が /api/uploads に差す（features/F12/inquiries/upload-route.ts）
import type { Hook } from "../contract/deps.js";
import { inquiryUploadHook } from "../features/F12/inquiries/upload.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function inquiryUploadHooks(d: HookDeps): Record<string, Hook> {
  return {
    uploadInquiryAttachment: inquiryUploadHook({ appPool: d.appPool, objects: d.objects, baseUrl: d.config.baseUrl }),
  };
}

// fuzz の的も同じ：的の HookDeps.objects は外に出さないメモリの置き場
export const register = defineHooks({ name: "inquiryUploadHooks", make: (d) => inquiryUploadHooks(d), fuzz: "same" });
