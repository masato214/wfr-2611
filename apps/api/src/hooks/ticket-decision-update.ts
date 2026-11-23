// 決定を改める・取り消す口（K-391）の契約の口。振る舞いの本体は apps/api/src/features/F6/decisions/update.ts。
//   読む・足す口（K-390）は ticket-decisions.ts。ここは別のファイル（同じファイルに足さない）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createUpdateTicketDecision } from "../features/F6/decisions/update.js";
import { defineHooks } from "./registry.js";

export function ticketDecisionUpdateHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    updateTicketDecision: { before: createUpdateTicketDecision(appPool) },
  };
}

export const register = defineHooks({
  name: "ticketDecisionUpdateHooks",
  make: (d) => ticketDecisionUpdateHooks(d.appPool),
  fuzz: "same",
});
