// 似たページを探す口（K-686）の契約の登録。振る舞いの本体は apps/api/src/features/F9/knowledge/similar.ts。
//   持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createFindSimilarKnowledge } from "../features/F9/knowledge/similar.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeSimilarHooks(d: HookDeps): Record<string, Hook> {
  return {
    findSimilarKnowledge: { before: createFindSimilarKnowledge(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeSimilarHooks",
  make: (d) => knowledgeSimilarHooks(d),
  fuzz: "same",
});
