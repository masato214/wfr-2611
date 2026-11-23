// 保存した検索条件（⌘K・チケットの一覧の「保存した条件」・K-475）の契約の口 listSavedViews・createSavedView。
//   振る舞いの本体は apps/api/src/features/F7/saved-views/（input.ts・shape.ts・list.ts・create.ts）。
//   直す・消す（updateSavedView・deleteSavedView）は K-476 が自分の hooks のファイルを作る（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createCreateSavedView } from "../features/F7/saved-views/create.js";
import { input } from "../features/F7/saved-views/input.js";
import { createListSavedViews } from "../features/F7/saved-views/list.js";
import { defineHooks } from "./registry.js";

export function savedViewsHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    listSavedViews: { before: createListSavedViews(appPool) },
    createSavedView: { input, before: createCreateSavedView(appPool) },
  };
}

export const register = defineHooks({
  name: "savedViewsHooks",
  make: (d) => savedViewsHooks(d.appPool),
  fuzz: "same",
});
