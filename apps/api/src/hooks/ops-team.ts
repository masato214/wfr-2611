// 運営の人を読む・足す口（K-985・契約の口 listOpsMembers・addOpsMember）。中身は apps/api/src/features/F12/ops/team.ts。
//   上限・本人確認の取り直し（契約の step_up）・知らない欄は契約の入口（op.ts）が先に確かめる。材料の mailer が無い fuzz の的では送らずに mail_sent: false
import type { Hook } from "../contract/deps.js";
import { createAddOpsMember, createListOpsMembers, type OpsTeamDeps } from "../features/F12/ops/team.js";
import { defineHooks } from "./registry.js";

export function opsTeamHooks(d: OpsTeamDeps): Record<string, Hook> {
  return {
    listOpsMembers: { before: createListOpsMembers(d) },
    addOpsMember: { before: createAddOpsMember(d) },
  };
}

export const register = defineHooks({
  name: "opsTeamHooks",
  make: (d) =>
    opsTeamHooks({
      auth: d.auth,
      appPool: d.appPool,
      authPool: d.authPool,
      repo: d.repo,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      webBaseUrl: d.config.webBaseUrl ?? "",
    }),
  fuzz: "same",
});
