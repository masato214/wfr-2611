// 状態（作業の段）を読む・足す・直す・消す・並べる口（K-705）の契約の口。振る舞いの本体は apps/api/src/features/F9/settings/stages.ts。
//   読む口 listTicketStages（持ち主は K-59）の答えの形（TicketStageSetting・鍵 6）もここで決める（土台-settings.md の 4 章）
import type { Hook } from "../contract/deps.js";
import {
  createCreateTicketStage,
  createDeleteTicketStage,
  createListTicketStages,
  createReorderTicketStages,
  createUpdateTicketStage,
} from "../features/F9/settings/stages.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketStagesHooks(d: HookDeps): Record<string, Hook> {
  return {
    listTicketStages: { before: createListTicketStages(d.appPool) },
    createTicketStage: { before: createCreateTicketStage(d.appPool) },
    updateTicketStage: { before: createUpdateTicketStage(d.appPool) },
    deleteTicketStage: { before: createDeleteTicketStage(d.appPool) },
    reorderTicketStages: { before: createReorderTicketStages(d.appPool) },
  };
}

export const register = defineHooks({
  name: "ticketStagesHooks",
  make: (d) => ticketStagesHooks(d),
  fuzz: "same",
});
