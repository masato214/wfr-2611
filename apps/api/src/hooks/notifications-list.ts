// 知らせを読む口（K-461）の契約の口 listNotifications。振る舞いの本体は apps/api/src/features/F7/notifications/list.ts。
//   既読にする口・外枠の未読の数は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createListNotifications } from "../features/F7/notifications/list.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function notificationsListHooks(d: HookDeps): Record<string, Hook> {
  return {
    listNotifications: { before: createListNotifications(d.appPool) },
  };
}

export const register = defineHooks({
  name: "notificationsListHooks",
  make: (d) => notificationsListHooks(d),
  fuzz: "same",
});
