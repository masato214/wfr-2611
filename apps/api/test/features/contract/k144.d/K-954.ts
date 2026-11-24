// 葉 K-954「お知らせを読む・読んだ印（listNotices・markNoticeRead）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 13 のお知らせの口は、葉ごとの hooks のファイルの register（K-326）。最初の要求の前に 1 回だけ読む // K-954
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["notices-read"]); // K-954（読んだ印：K144-API-954）
  },
  UUID_PARAM_CASES: [
    ["K144-API-954", "markNoticeRead", "path", "id"], // K-954
  ],
  BODIES: {
    markNoticeRead: {}, // K-954
  },
};
