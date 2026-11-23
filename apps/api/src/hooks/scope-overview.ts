// グループの概要（K-477）の契約の口。振る舞いの本体は apps/api/src/features/F7/overview/overview.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。読むだけの口なので ONE_TX_HOOKS には足さない（1 要求に withTenant は 1 つだけ）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createGetScopeOverview } from "../features/F7/overview/overview.js";
import { defineHooks } from "./registry.js";

export function scopeOverviewHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    getScopeOverview: { before: createGetScopeOverview(appPool) },
  };
}

export const register = defineHooks({
  name: "scopeOverviewHooks",
  make: (d) => scopeOverviewHooks(d.appPool),
  fuzz: "same",
});
