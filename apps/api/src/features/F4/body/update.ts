// 本文を書き終える口（updateTicketBody・PATCH /api/v1/tickets/:id/body・K-432）の振る舞い。
//   入口が契約の形（version・doc だけ・知らない欄は 422）を確かめた後、ここで doc の中身（validateDoc）を確かめ、text を doc から作り（toTicketBody）、
//   app.ticket_body_set（関門 C2）が 1 つの取引で本文の行・版の行・やり取りの 1 行・証跡を書く。版が合わなければ 409（E-SEC-004）・完了したチケットは 409（E-SEC-005）。
//   中身が同じなら何も書かず changed false。本文を直したことは担当者に知らせない（D-150.29）。
// ログに本文・題名を出さない（共通の決まり）。書けなかったら例外の種類だけ
import type pg from "pg";
import { toTicketBody } from "@kaname/contracts";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { bodyReply, unavailable } from "./errors.js";
import { checkBodyUpdate } from "./input.js";

/** 書き終えた本文の中身は、入口が揃えた体（NFKC・前後の空白を落とした物）でなく、画面が送ったままを使う（字の間の空白・全角を壊さない） */
async function sentDoc(a: HookArgs): Promise<unknown> {
  try {
    const raw: unknown = await a.c.req.json();
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return (raw as Record<string, unknown>)["doc"];
  } catch {
    // 読めなければ入口が揃えた体の doc を使う
  }
  return a.input["doc"];
}

export function createUpdateTicketBody(appPool: pg.Pool): NonNullable<Hook["before"]> {
  return async (a: HookArgs): Promise<HookReply> => {
    const checked = checkBodyUpdate({ ...a.input, doc: await sentDoc(a) });
    if (!checked.ok)
      return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: checked.details } };
    const body = toTicketBody(checked.doc);
    let v: Record<string, unknown>;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Record<string, unknown> }>("select app.ticket_body_set($1::uuid, $2::jsonb) as v", [
              a.id,
              JSON.stringify({ version: checked.version, doc: body.doc, text: body.text }),
            ])
          ).rows[0]!.v,
      );
    } catch (ex) {
      console.error(`[ticket-body] 書けなかった（${(ex as Error)?.name ?? "Error"}）`);
      return unavailable();
    }
    if (v["ok"] !== true) return bodyReply(String(v["error"]));
    return {
      status: 200,
      body: { data: { version: v["version"], changed: v["changed"], edited_at: v["edited_at"] } },
    };
  };
}
