// 段 9「渡す・配る」の記録を読む口（K-405）。K-401 の hooks/handovers.ts は listTicketHandovers を登録しない
//   （同じ口を 2 つのファイルが持つと buildHooks が止まる）。振る舞いの本体は apps/api/src/features/F8/handovers/list.ts
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { listTicketHandovers } from "../features/F8/handovers/list.js";
import { defineHooks } from "./registry.js";

export function handoverReadHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    // 詳細の渡しの記録（読むだけ・新しい 50 件・文 1 つ）
    listTicketHandovers: {
      before: listTicketHandovers({ appPool }),
    },
  };
}

export const register = defineHooks({
  name: "handoverReadHooks",
  make: (d) => handoverReadHooks(d.appPool),
  fuzz: "same",
});
