// 葉 K-435「テスト仕様を直す・OFF にする・消す口（updateTestSpec・deleteTestSpec）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   道の uuid（テスト仕様の id）が正しい形でなければ 422・欄 id になる行。正しい uuid では 404 の道を回る（行が無いので）。行 ID は K-434 の頭の注を見る（522・523）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["test-specs-edit"]); // K-435（直す・消す：K144-API-522・523）
  },
  UUID_PARAM_CASES: [
    ["K144-API-522", "updateTestSpec", "path", "id"], // K-435
    ["K144-API-523", "deleteTestSpec", "path", "id"], // K-435
  ],
  BODIES: {
    updateTestSpec: { version: 1, title: "直した題名" }, // K-435
  },
};
