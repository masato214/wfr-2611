// 止まった AI の仕事から「自分で直す」と、止まった理由の種類（K-485）の契約の口。振る舞いの本体は apps/api/src/features/F7/stopped/。
//   getActionRun・listTicketRuns は K-62 の口（hooks/delegate.ts）に reason_kind を足した物に差し替える（並びに頼らない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createTakeover, stoppedViewHooks } from "../features/F7/stopped/index.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function stoppedHooks(d: HookDeps): Record<string, Hook> {
  const h = stoppedViewHooks(d.appPool);
  return {
    takeoverActionRun: { before: createTakeover(d.appPool) },
    getActionRun: { ...h["getActionRun"] },
    listTicketRuns: { ...h["listTicketRuns"] },
  };
}

export const register = defineHooks({
  name: "stoppedHooks",
  make: (d) => stoppedHooks(d),
  fuzz: "same",
  replaces: ["getActionRun", "listTicketRuns"],
});
