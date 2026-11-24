// 葉 K-401「渡しの口の置き場と、渡す前の下見の口」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行は「作った口 × uuid の値」と 1 対 1（契約の形の検査 K144-SHAPE-017）。この葉が作った口になる 4 本のうち、
//   uuid の道の値を持つ 3 本（下見・渡す・答える）の行を置く。決まりの口（listHandoverRules）は uuid の値を持たない。
//   段 9 の k144 の番号は葉ごとの枠：この葉が 900〜902（段 7 が 090〜093）、K-405 950・K-406 960〜961・K-410 910（新しい葉は 9N0 から）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 9 の口は apps/api/src/hooks/handovers.ts の register（K-326）。最初の要求の前に 1 回だけ読む（準備で読まない：
    //   実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。正しい uuid は無い行なので 404 の道を回る
    let loading: Promise<void> | null = null;
    const load = async (): Promise<void> => {
      const m = (await import("../../../../src/hooks/handovers.js")) as {
        register: { make: (d: unknown) => Record<string, unknown> };
      };
      Object.assign(f.hooks, m.register.make({ appPool: f.pool, config: { webBaseUrl: "", env: "test" } }));
    };
    const base = f.req;
    f.req = async (method, path, o) => {
      await (loading ??= load());
      return base(method, path, o);
    };
  },
  UUID_PARAM_CASES: [
    ["K144-API-900", "previewTicketHandover", "path", "id"], // K-401
    ["K144-API-901", "createTicketHandover", "path", "id"], // K-401
    ["K144-API-902", "answerTicketHandover", "path", "id"], // K-401
  ],
  BODIES: {
    createTicketHandover: { kind: "pass", to_member_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", reason: "理由" }, // K-401
    answerTicketHandover: { decision: "accept" }, // K-401
  },
};
