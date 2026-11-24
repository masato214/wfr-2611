// 詳細の渡しの記録を読む口（listTicketHandovers・GET /tickets/:id/handovers・K-405・D-128.115・D-148.35）。
//   そのチケットの渡し（消していない物）を新しい順に 50 件、1 取引・文 1 つ（app.ticket_handovers_read）で返す。
//   読めるのはそのチケットを読める人と、その渡しを渡した人・答える人。別の会社・見えない・消したチケットは 404（中身を返さない）。
//   読むだけ（DB に書かない）。帯を 1 回だけ出す・断られた帯を閉じる覚えは画面の手元で、この口は書かない。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HandoverDeps } from "./deps.js";
import { notFound } from "./errors.js";

/** 1 回に返す渡しの数（DB の関数 app.ticket_handovers_read と同じ数） */
export const HANDOVER_LIST_MAX = 50;

export function listTicketHandovers(d: Pick<HandoverDeps, "appPool">) {
  return async (a: HookArgs): Promise<HookReply> => {
    const v = await withTenant(d.appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ v: unknown[] | null }>("select app.ticket_handovers_read($1) as v", [a.id ?? ""]);
      return r.rows[0]?.v ?? null;
    });
    if (!Array.isArray(v)) return notFound();
    return { status: 200, body: { data: v, meta: { limit: HANDOVER_LIST_MAX } } };
  };
}
