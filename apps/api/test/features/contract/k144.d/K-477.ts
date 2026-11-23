// 葉 K-477「グループの概要を読む（getScopeOverview）」の葉のファイル（置き方は README.md・K-378）。
//   入口の uuid の行：道の値 id が uuid でなければ、口の振る舞いに入る前に 422（欄 id・理由 uuid）。
//   口の振る舞い（hooks）は、この葉の hooks のファイル apps/api/src/hooks/scope-overview.ts を準備で 1 回だけ動的 import で足す
//   （この葉が入った木にだけ在るファイル。範囲の地図は ci_scope.d/K-477.json の reads_ok）。行 ID は K144-API-877（K-476 の 876・866 と重ならない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type pg from "pg";
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/scope-overview.js")) as {
      scopeOverviewHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.scopeOverviewHooks(f.pool));
  },
  UUID_PARAM_CASES: [["K144-API-877", "getScopeOverview", "path", "id"]],
};
