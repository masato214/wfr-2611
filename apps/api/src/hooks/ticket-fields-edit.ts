// 項目を直す・消す・並べる口（K-717）の契約の口。振る舞いの本体は apps/api/src/features/F9/settings/fields-edit.ts。
//   足す・マスタを読む（K-706）は ticket-fields-write.ts が持つ（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import {
  createDeleteTicketField,
  createReorderTicketFields,
  createUpdateTicketField,
} from "../features/F9/settings/fields-edit.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketFieldsEditHooks(d: HookDeps): Record<string, Hook> {
  return {
    updateTicketField: { before: createUpdateTicketField(d.appPool) },
    deleteTicketField: { before: createDeleteTicketField(d.appPool) },
    reorderTicketFields: { before: createReorderTicketFields(d.appPool) },
  };
}

export const register = defineHooks({
  name: "ticketFieldsEditHooks",
  make: (d) => ticketFieldsEditHooks(d),
  fuzz: "same",
});
