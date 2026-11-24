// 運営が受信箱の問い合わせの担当・状態・後でを変える（K-974）の契約の口 updateOpsInquiry。
//   振る舞いの本体は apps/api/src/features/F12/ops/inbox-update.ts。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createUpdateOpsInquiry } from "../features/F12/ops/inbox-update.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsInboxUpdateHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    updateOpsInquiry: { before: createUpdateOpsInquiry(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsInboxUpdateHooks",
  make: (d) => opsInboxUpdateHooks(d),
  fuzz: "same",
});
