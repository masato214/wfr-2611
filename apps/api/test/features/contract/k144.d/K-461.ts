// 葉 K-461「知らせを読む口（listNotifications）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 8 の知らせの口は、葉ごとの hooks のファイルの register（K-326）を葉ごとの 1 行が自分の分だけ足す。最初の要求の前に 1 回だけ読む // K-461
    (await import("../../F7/notify.harness.js")).addNotifyLeafHooks(f, "notifications-list"); // K-461（一覧：K144-API-861）
  },
  UUID_PARAM_CASES: [
    ["K144-API-861", "listNotifications", "query", "actor_member_id"], // K-461
  ],
};
