// 葉 K-705「状態を足す・直す・並べる・消す」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   道の値 :id が uuid の形でなければ 422 になる行（直す口・消す口）。行 ID は段 10 の枠 K144-API-970〜979 のうち 972・973 を取った。
//   テストはチケットを作る人が書き、実装する人は変えない。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 状態を書く口の振る舞い（葉の hooks のファイルの register・K-326）を、最初の要求の前に 1 回だけ読む // K-705
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ticket-stages-write"]); // K-705
  },
  UUID_PARAM_CASES: [
    ["K144-API-972", "updateTicketStage", "path", "id"], // K-705
    ["K144-API-973", "deleteTicketStage", "path", "id"], // K-705
  ],
};
