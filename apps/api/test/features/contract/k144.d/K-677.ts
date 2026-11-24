// 葉 K-677 が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行：この葉が作る口（getKnowledgePage・listKnowledgeVersions・getKnowledgePageVersion）の道の値 id が uuid でなければ、口の振る舞いに入る前に 422（欄 id・理由 uuid）。
//   切る段では K-675 の葉のファイルが 12 本をまとめて持っていたのを、口を作る葉ごとに分けた（行 ID と中身は同じ・2026-11-23 PM の決め：
//   作っていない口の行を置くと契約の形の検査 SHAPE-017 が赤）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // ページを読む口（getKnowledgePage・listKnowledgeVersions・getKnowledgePageVersion）は、葉の hooks のファイルの register（K-326）を葉ごとの 1 行が自分の分だけ足す。最初の要求の前に 1 回だけ読む（足さないと口が無く 501）// K-677
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["f9-knowledge-page-read"]); // K-677
  },
  UUID_PARAM_CASES: [
    ["K144-API-100", "getKnowledgePage", "path", "id"], // K-677
    ["K144-API-101", "listKnowledgeVersions", "path", "id"], // K-677
    ["K144-API-102", "getKnowledgePageVersion", "path", "id"], // K-677
  ],
};
