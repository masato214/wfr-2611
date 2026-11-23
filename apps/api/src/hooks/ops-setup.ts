// パスキーを付けるリンクの口（K-945・契約の口 startOpsSetup）。中身は apps/api/src/features/F12/ops-setup/。上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createStartOpsSetup, type OpsSetupDeps } from "../features/F12/ops-setup/setup.js";
import { defineHooks } from "./registry.js";

export function opsSetupHooks(d: OpsSetupDeps): Record<string, Hook> {
  // 冪等キーは使わない：答えにログインの印が入り、リンクは 1 回だけ（器に残すと 2 回目に 201 を返す・2 回目は 409 E-PAGE-006）
  return { startOpsSetup: { before: createStartOpsSetup(d), noIdempotency: true } };
}

export const register = defineHooks({
  name: "opsSetupHooks",
  make: (d) => opsSetupHooks({ auth: d.auth, appPool: d.appPool, authPool: d.authPool }),
  fuzz: "same",
});
