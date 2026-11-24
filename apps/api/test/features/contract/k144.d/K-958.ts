// 葉 K-958「請求書を読む（getBilling・downloadInvoicePdf）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は葉ごとの枠（K-958＝958）。
//   hooks の make は材料の config を読まない（読むのは要求の時・leafHooks は appPool しか渡さない）
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 13 の請求の口は、葉ごとの hooks のファイルの register（K-326）。最初の要求の前に 1 回だけ読む // K-958
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["billing-read"]); // K-958（PDF の道の値：K144-API-958）
  },
  UUID_PARAM_CASES: [
    ["K144-API-958", "downloadInvoicePdf", "path", "id"], // K-958
  ],
};
