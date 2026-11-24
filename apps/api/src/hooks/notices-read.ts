// お知らせを読む口（K-954）の契約の口 listNotices・markNoticeRead。振る舞いの本体は apps/api/src/features/F12/notices/。
//   帯と様子（K-955）は自分の hooks のファイルを作る（このファイルに足さない）。上限・問い合わせの値と体の形・道の uuid は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createListNotices } from "../features/F12/notices/list.js";
import { createMarkNoticeRead } from "../features/F12/notices/read.js";
import { defineHooks } from "./registry.js";

export function noticesReadHooks(d: { appPool: Parameters<typeof createListNotices>[0] }): Record<string, Hook> {
  return {
    listNotices: { before: createListNotices(d.appPool) },
    markNoticeRead: { before: createMarkNoticeRead(d.appPool) },
  };
}

export const register = defineHooks({
  name: "noticesReadHooks",
  make: (d) => noticesReadHooks({ appPool: d.appPool }),
  fuzz: "same",
});
