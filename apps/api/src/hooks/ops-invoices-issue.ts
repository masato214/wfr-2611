// 運営が月の請求書をまとめて出す口（K-981・issueOpsInvoices）の契約の口。振る舞いの本体は apps/api/src/features/F12/ops/invoices-issue.ts。
//   請求書の一覧（K-983）・入金の記録（K-982）は別のファイル（同じファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createIssueOpsInvoices } from "../features/F12/ops/invoices-issue.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsInvoicesIssueHooks(d: HookDeps): Record<string, Hook> {
  return {
    issueOpsInvoices: { before: createIssueOpsInvoices(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsInvoicesIssueHooks",
  make: (d) => opsInvoicesIssueHooks(d),
  fuzz: "same",
});
