// 葉 K-706「項目のマスタを読む・足す」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   この葉の口（読む・足す）は道の値の id を持たないので、入口の uuid の行は無い（直す・消すの行 K144-API-974・975 は K-717 の k144.d/K-717.ts）。
//   テストはチケットを作る人が書き、実装する人は変えない。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 項目のマスタを読む・足す口の振る舞い（葉の hooks のファイルの register・K-326）を、最初の要求の前に 1 回だけ読む // K-706
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ticket-fields-write"]); // K-706
  },
};
