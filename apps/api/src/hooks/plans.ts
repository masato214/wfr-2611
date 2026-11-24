// 選べるプランとプランを変える口（K-961）の契約の口。振る舞いの本体は apps/api/src/features/F12/billing/plans.ts。
//   請求書を読む口（K-958）・請求先を直す口（K-959）は別のファイル（同じファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createChangePlan, createListWorkspacePlans } from "../features/F12/billing/plans.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function plansHooks(d: HookDeps): Record<string, Hook> {
  return {
    listWorkspacePlans: { before: createListWorkspacePlans(d.appPool) },
    changePlan: { before: createChangePlan(d.appPool) },
  };
}

export const register = defineHooks({
  name: "plansHooks",
  make: (d) => plansHooks(d),
  fuzz: "same",
});
