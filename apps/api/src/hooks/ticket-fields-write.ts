// 項目のマスタを読む・足す口（K-706）の契約の口。振る舞いの本体は apps/api/src/features/F9/settings/fields.ts。
//   直す・並べる・消す（K-717）は ticket-fields-edit.ts が持つ（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createCreateTicketField, createListTicketFieldMaster } from "../features/F9/settings/fields.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketFieldsWriteHooks(d: HookDeps): Record<string, Hook> {
  return {
    listTicketFieldMaster: { before: createListTicketFieldMaster(d.appPool) },
    createTicketField: { before: createCreateTicketField(d.appPool) },
  };
}

export const register = defineHooks({
  name: "ticketFieldsWriteHooks",
  make: (d) => ticketFieldsWriteHooks(d),
  fuzz: "same",
});
