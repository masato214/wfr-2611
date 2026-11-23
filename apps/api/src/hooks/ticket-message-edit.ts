// やり取りの書き込みを直す・消す・☆（K-386）の契約の口。振る舞いの本体は apps/api/src/features/F6/thread/edit.ts。
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import {
  createDeleteTicketMessage,
  createEditTicketMessage,
  createStarTicketMessage,
  inputEdit,
} from "../features/F6/thread/edit.js";
import { defineHooks } from "./registry.js";

export function ticketMessageEditHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    updateTicketMessage: { input: inputEdit, before: createEditTicketMessage(appPool) },
    deleteTicketMessage: { before: createDeleteTicketMessage(appPool) },
    starTicketMessage: { before: createStarTicketMessage(appPool) },
  };
}

export const register = defineHooks({
  name: "ticketMessageEditHooks",
  make: (d) => ticketMessageEditHooks(d.appPool),
  fuzz: "same",
});
