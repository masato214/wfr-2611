// 本文を書き終える契約の口（K-432）。振る舞いの本体は apps/api/src/features/F4/body/update.ts。
//   版を戻す・版を読む口は K-433 が自分の hooks のファイル（ticket-versions.ts）に持つ（このファイルに足さない）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createUpdateTicketBody } from "../features/F4/body/update.js";
import { defineHooks } from "./registry.js";

export function ticketBodyHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    updateTicketBody: { before: createUpdateTicketBody(appPool) },
  };
}

export const register = defineHooks({
  name: "ticketBodyHooks",
  make: (d) => ticketBodyHooks(d.appPool),
  fuzz: "same",
});
