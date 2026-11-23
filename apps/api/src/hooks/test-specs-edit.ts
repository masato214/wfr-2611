// 確認項目にチェックを付ける・外す・文を直す・行を外す口（K-435）の契約の口。振る舞いの本体は apps/api/src/features/F4/test-spec/update.ts・delete.ts。
//   読む・足す（K-434 の test-specs-create.ts）には足さない（それぞれの葉が自分の hooks のファイルを持つ）
import type { Hook } from "../contract/deps.js";
import { createDeleteTestSpec } from "../features/F4/test-spec/delete.js";
import { createUpdateTestSpec } from "../features/F4/test-spec/update.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function testSpecsEditHooks(d: HookDeps): Record<string, Hook> {
  return {
    updateTestSpec: { before: createUpdateTestSpec(d.appPool) },
    deleteTestSpec: { before: createDeleteTestSpec(d.appPool) },
  };
}

export const register = defineHooks({
  name: "testSpecsEditHooks",
  make: (d) => testSpecsEditHooks(d),
  fuzz: "same",
});
