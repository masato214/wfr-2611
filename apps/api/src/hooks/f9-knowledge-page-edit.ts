// ナレッジのページを動かす・消す口 2 本（K-681）の契約の登録。振る舞いの本体は apps/api/src/features/F9/knowledge/page-move.ts・page-delete.ts。
//   持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createUpdateKnowledgePage } from "../features/F9/knowledge/page-move.js";
import { createDeleteKnowledgePage } from "../features/F9/knowledge/page-delete.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgePageEditHooks(d: HookDeps): Record<string, Hook> {
  return {
    updateKnowledgePage: { before: createUpdateKnowledgePage(d.appPool) },
    deleteKnowledgePage: { before: createDeleteKnowledgePage(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgePageEditHooks",
  make: (d) => knowledgePageEditHooks(d),
  fuzz: "same",
});
