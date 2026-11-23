// 葉 K-432「本文を書き終える口（updateTicketBody）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 5 の枠 K144-API-500〜599（葉ごと：K-432 500・K-433 510〜512。段 7 は 700 台・段 9 は 900 台・本線と段 4 は 001〜072・801〜855 で重ならない）。
//   入口の uuid の行（道の値 :id）と、その口を叩く時の体。体は正しい uuid で 422 にならない形（無いチケットは口の確かめで 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 5 の本文を書き終える口は apps/api/src/hooks/ticket-body.ts の register（K-326）。最初の要求の前に 1 回だけ読む
    //   （準備で読まない：実装の前に、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。正しい uuid は無い行なので 404 の道を回る
    let loading: Promise<void> | null = null;
    const load = async (): Promise<void> => {
      const m = (await import("../../../../src/hooks/ticket-body.js")) as {
        register: { make: (d: unknown) => Record<string, unknown> };
      };
      Object.assign(f.hooks, m.register.make({ appPool: f.pool }));
    };
    const base = f.req;
    f.req = async (method, path, o) => {
      await (loading ??= load());
      return base(method, path, o);
    };
  },
  UUID_PARAM_CASES: [
    ["K144-API-500", "updateTicketBody", "path", "id"], // K-432
  ],
  BODIES: {
    updateTicketBody: { version: 1, doc: { type: "doc", content: [] } }, // K-432
  },
};
