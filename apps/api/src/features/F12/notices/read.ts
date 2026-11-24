// お知らせの読んだ印（K-954）：markNoticeRead（POST /api/v1/notices/:id/read）。開いたときに付く（ボタンは無い・D-156.27）。
//   体は空の {}（知らない鍵は入口が 422）。:id の形（uuid）は入口が確かめる。会社と人はセッションから（体から受けない）。
//   見えるか（届け先・管理者だけ）と書くのは DB の関数 app.member_notice_read の 1 取引（関門 C2）：見えなければ not_found → 404 E-PAGE-001（何も書かない）、
//   見えれば本人の 1 行（一意の索引・2 回目と同時の 2 回は最初の read_at のまま）。鈴の知らせ（notifications）は書かない（D-156.28）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { down, replyOfWord } from "./errors.js";
import { toNoticeRead } from "./shape.js";

export function createMarkNoticeRead(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    let res: { data?: unknown; error?: unknown } | undefined;
    try {
      res = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { data?: unknown; error?: unknown } }>("select app.member_notice_read($1) as v", [
          a.id,
        ]);
        return r.rows[0]?.v;
      });
    } catch (e) {
      return down("markNoticeRead", e);
    }
    if (!res || typeof res !== "object") return down("markNoticeRead", { name: "答えが空" });
    if (res.error !== undefined) return replyOfWord("markNoticeRead", res.error);
    return { status: 200, body: { data: toNoticeRead(res.data) } };
  };
}
