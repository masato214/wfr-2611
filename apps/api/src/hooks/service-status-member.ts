// ログイン後の稼働状況と上の帯（K-955）の契約の口 getServiceStatusForMember。振る舞いの本体は apps/api/src/features/F12/notices/status.ts。
//   ログイン前の稼働状況（K-307・service-status.ts）は触らない。上限・社内の人だけは契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createServiceStatusForMember } from "../features/F12/notices/status.js";
import { defineHooks } from "./registry.js";

export function serviceStatusMemberHooks(d: {
  appPool: Parameters<typeof createServiceStatusForMember>[0];
}): Record<string, Hook> {
  return {
    getServiceStatusForMember: { before: createServiceStatusForMember(d.appPool) },
  };
}

export const register = defineHooks({
  name: "serviceStatusMemberHooks",
  make: (d) => serviceStatusMemberHooks({ appPool: d.appPool }),
  fuzz: "same",
});
