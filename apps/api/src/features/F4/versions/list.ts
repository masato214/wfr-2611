// 本文の版を読む口（listTicketVersions・GET /api/v1/tickets/:id/versions?from=&to=・K-433）の振る舞い。
//   app.ticket_versions が 1 つの取引で、版の一覧（新しい順・200 まで）と比べる 2 つの版の text を返す（読むだけ・書かない）。
//   見える人なら誰でも読める（閲覧のみも）。meta.can_restore は書けて完了していない人だけ true。
// ログに本文・題名を出さない（共通の決まり）。読めなかったら例外の種類だけ
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { bodyReply, unavailable } from "../body/errors.js";
import { pickPoint } from "./input.js";

const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "E-PAGE-001" } };

export function createListTicketVersions(appPool: pg.Pool): NonNullable<Hook["before"]> {
  return async (a: HookArgs): Promise<HookReply> => {
    const from = pickPoint(a.c.req.query("from"));
    const to = pickPoint(a.c.req.query("to"));
    if (from === "bad" || to === "bad") return NOT_FOUND;
    let v: Record<string, unknown>;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Record<string, unknown> }>(
              "select app.ticket_versions($1::uuid, $2::int, $3::int) as v",
              [a.id, from, to],
            )
          ).rows[0]!.v,
      );
    } catch (ex) {
      console.error(`[ticket-body] 読めなかった（${(ex as Error)?.name ?? "Error"}）`);
      return unavailable();
    }
    if (v["error"] === "not_found") return NOT_FOUND; // 無い版・無い点・本文の行が無い（入口を通った見えるチケット）は E-PAGE-001
    if (typeof v["error"] === "string") return bodyReply(v["error"]);
    return {
      status: 200,
      body: {
        data: { versions: v["versions"], from: v["from"], to: v["to"] },
        meta: { limit: 200, truncated: v["truncated"] === true, can_restore: v["can_restore"] === true },
      },
    };
  };
}
