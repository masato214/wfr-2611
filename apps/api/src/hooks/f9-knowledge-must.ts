// 必ず守るを付ける・外す口（K-685）の契約の登録。振る舞いの本体は apps/api/src/features/F9/knowledge/must.ts。
//   持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createSetKnowledgeMust } from "../features/F9/knowledge/must.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeMustHooks(d: HookDeps): Record<string, Hook> {
  return {
    setKnowledgeMust: { before: createSetKnowledgeMust(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeMustHooks",
  make: (d) => knowledgeMustHooks(d),
  fuzz: "same",
});
