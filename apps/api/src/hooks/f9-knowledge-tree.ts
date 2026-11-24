// ナレッジの木を読む口（K-676）の契約の登録。振る舞いの本体は apps/api/src/features/F9/knowledge/tree.ts。
//   ナレッジのほかの口は、それぞれの葉が自分の hooks のファイルを作る（持ち主の表は features/F9/knowledge/ops.ts）
import type { Hook } from "../contract/deps.js";
import { createGetKnowledgeTree } from "../features/F9/knowledge/tree.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeTreeHooks(d: HookDeps): Record<string, Hook> {
  return {
    getKnowledgeTree: { before: createGetKnowledgeTree(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeTreeHooks",
  make: (d) => knowledgeTreeHooks(d),
  fuzz: "same",
});
