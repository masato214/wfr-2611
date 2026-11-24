// 運営の外枠の数と全社の一覧（K-963）の契約の口 getOpsShell・listOpsWorkspaces。振る舞いの本体は apps/api/src/features/F12/ops/workspaces.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createGetOpsShell, createListOpsWorkspaces } from "../features/F12/ops/workspaces.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsWorkspacesHooks(d: HookDeps): Record<string, Hook> {
  return {
    getOpsShell: { before: createGetOpsShell(d.appPool) },
    listOpsWorkspaces: { before: createListOpsWorkspaces(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsWorkspacesHooks",
  make: (d) => opsWorkspacesHooks(d),
  fuzz: "same",
});
