// お知らせを読む口（K-954）：listNotices（GET /api/v1/notices）。読むだけ（DB に書かない・鈴の知らせも出さない・D-156.28）。
//   上限・認証・社内の人だけ（先方の権限は 403）・問い合わせの値 kind・unread の形は契約の入口（op.ts）が先に確かめる。
//   届け先（出したか・誰に・管理者だけ）は DB の関数 app.member_notices の 1 か所（app.notice_for_member → app.notice_for_tenant）。
//   1 取引・文 1 つ。101 件を引き、101 件目があれば捨てて 100 件を返し、ログに 1 行（題・本文・id は出さない）。
//   cursor・limit は入口の形の確かめだけで、口は新しい順の 100 件まで（お知らせは月に数件）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { down } from "./errors.js";
import { toNotice } from "./shape.js";

/** 返す件数の上限 */
export const LIST_MAX = 100;

export function createListNotices(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const q = a.c.req.query();
    const kind = q["kind"] ? q["kind"] : null;
    const unread = q["unread"] === "true";
    try {
      const rows = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: unknown }>("select app.member_notices($1, $2, $3) as v", [
          kind,
          unread,
          LIST_MAX + 1,
        ]);
        return r.rows[0]?.v;
      });
      if (!Array.isArray(rows)) throw new Error("お知らせの答えが配列でない");
      if (rows.length > LIST_MAX) console.warn("[notices] 一覧を 100 件で切った");
      return { status: 200, body: { data: rows.slice(0, LIST_MAX).map(toNotice) } };
    } catch (e) {
      return down("listNotices", e);
    }
  };
}
