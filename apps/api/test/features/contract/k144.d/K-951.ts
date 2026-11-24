// 葉 K-951「自分の問い合わせを読む（listMyInquiries・getMyInquiry）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は葉ごとの枠（K-951＝980）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 13 の問い合わせの口は、葉ごとの hooks のファイルの register（K-326）。最初の要求の前に 1 回だけ読む // K-951
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["inquiry-read"]); // K-951（1 件の道の値：K144-API-980）
  },
  UUID_PARAM_CASES: [
    ["K144-API-980", "getMyInquiry", "path", "id"], // K-951
  ],
};
