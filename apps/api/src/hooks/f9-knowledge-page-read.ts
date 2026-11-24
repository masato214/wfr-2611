// ナレッジのページと前の版を読む口 3 本（K-677）の契約の登録。振る舞いの本体は apps/api/src/features/F9/knowledge/read.ts・versions.ts。
//   ナレッジのほかの口は、それぞれの葉が自分の hooks のファイルを作る（持ち主の表は features/F9/knowledge/ops.ts）
import type { Hook } from "../contract/deps.js";
import { createGetKnowledgePage } from "../features/F9/knowledge/read.js";
import { createGetKnowledgePageVersion, createListKnowledgeVersions } from "../features/F9/knowledge/versions.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgePageReadHooks(d: HookDeps): Record<string, Hook> {
  return {
    getKnowledgePage: { before: createGetKnowledgePage(d.appPool) },
    listKnowledgeVersions: { before: createListKnowledgeVersions(d.appPool) },
    getKnowledgePageVersion: { before: createGetKnowledgePageVersion(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgePageReadHooks",
  make: (d) => knowledgePageReadHooks(d),
  fuzz: "same",
});
