// 葉 K-717「項目を直す・並べる・消す」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   道の値 :id が uuid の形でなければ 422 になる行（直す口・消す口）。行 ID は段 10 の枠 K144-API-970〜979 のうち 974・975 を取った（K-706 から移した。976 は空き）。
//   テストはチケットを作る人が書き、実装する人は変えない。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 項目を直す・並べる・消す口の振る舞い（葉の hooks のファイルの register・K-326）を、最初の要求の前に 1 回だけ読む // K-717
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ticket-fields-edit"]); // K-717
  },
  UUID_PARAM_CASES: [
    ["K144-API-974", "updateTicketField", "path", "id"], // K-717
    ["K144-API-975", "deleteTicketField", "path", "id"], // K-717
  ],
};
