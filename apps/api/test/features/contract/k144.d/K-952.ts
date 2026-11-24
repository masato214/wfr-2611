// 葉 K-952「返事を書く・済みにする（postInquiryMessage・resolveMyInquiry）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は葉ごとの枠（K-952＝990）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 13 の問い合わせの口は、葉ごとの hooks のファイルの register（K-326）。最初の要求の前に 1 回だけ読む // K-952
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["inquiry-reply"]); // K-952（道の値：K144-API-990・991）
  },
  UUID_PARAM_CASES: [
    ["K144-API-990", "postInquiryMessage", "path", "id"], // K-952
    ["K144-API-991", "resolveMyInquiry", "path", "id"], // K-952
  ],
  BODIES: {
    postInquiryMessage: { body: "もう一度見てください" }, // K-952
    resolveMyInquiry: {}, // K-952
  },
};
