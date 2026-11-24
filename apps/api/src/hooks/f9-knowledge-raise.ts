// 上の棚に上げる口（K-687：頼む・取り下げる・断りの帯を消す）の契約の登録。振る舞いの本体は
//   apps/api/src/features/F9/knowledge/raise.ts と raise-end.ts。持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createRequestKnowledgeRaise } from "../features/F9/knowledge/raise.js";
import { createDismissKnowledgeRequest, createWithdrawKnowledgeRequest } from "../features/F9/knowledge/raise-end.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeRaiseHooks(d: HookDeps): Record<string, Hook> {
  return {
    requestKnowledgeRaise: { before: createRequestKnowledgeRaise(d.appPool) },
    withdrawKnowledgeRequest: { before: createWithdrawKnowledgeRequest(d.appPool) },
    dismissKnowledgeRequest: { before: createDismissKnowledgeRequest(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeRaiseHooks",
  make: (d) => knowledgeRaiseHooks(d),
  fuzz: "same",
});
