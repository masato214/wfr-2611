// ナレッジのページを写して直す口 1 本（K-690）の契約の登録。振る舞いの本体は
//   apps/api/src/features/F9/knowledge/copy.ts。持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createCopyKnowledgePage } from "../features/F9/knowledge/copy.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeCopyHooks(d: HookDeps): Record<string, Hook> {
  return {
    copyKnowledgePage: { before: createCopyKnowledgePage(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeCopyHooks",
  make: (d) => knowledgeCopyHooks(d),
  fuzz: "same",
});
