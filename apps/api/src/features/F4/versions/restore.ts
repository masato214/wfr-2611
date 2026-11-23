// 本文を版に戻す口（restoreTicketVersion・POST /api/v1/tickets/:id/versions/:v/restore・K-433）の振る舞い。
//   道の :v が数字の形でなければ 404・E-PAGE-001（DB を呼ばない）。入口が契約の形（current_version だけ・知らない欄は 422）を確かめた後、
//   app.ticket_body_restore（関門 C2）が確かめて K-432 の app.ticket_body_set を呼ぶ：本文の行・版の行（追記だけ）・やり取りの 1 行・証跡が 1 つの取引。
//   今見ている版が古ければ 409（E-SEC-004）・戻す先が今の中身と同じなら 409（E-SEC-020）・完了したチケットは 409（E-SEC-005）。
//   戻したことは担当者に知らせない（D-150.29）。ログに本文・題名を出さない（共通の決まり）。書けなかったら例外の種類だけ
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { bodyReply, unavailable } from "../body/errors.js";
import { checkRestore, pickPoint } from "./input.js";

const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "E-PAGE-001" } };

/** 戻す先が今の中身と同じ：409・E-SEC-020（field・details を付けない） */
const same = (): HookReply => ({
  status: 409,
  body: { error: "conflict", code: "E-SEC-020", message: new KanameError("E-SEC-020").entry.message },
});

export function createRestoreTicketVersion(appPool: pg.Pool): NonNullable<Hook["before"]> {
  return async (a: HookArgs): Promise<HookReply> => {
    const target = pickPoint(a.c.req.param("v"));
    if (target === null || target === "bad") return NOT_FOUND;
    const checked = checkRestore(a.input);
    if (!checked.ok)
      return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: checked.details } };
    let v: Record<string, unknown>;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Record<string, unknown> }>(
              "select app.ticket_body_restore($1::uuid, $2::int, $3::int) as v",
              [a.id, target, checked.current],
            )
          ).rows[0]!.v,
      );
    } catch (ex) {
      console.error(`[ticket-body] 戻せなかった（${(ex as Error)?.name ?? "Error"}）`);
      return unavailable();
    }
    if (v["error"] === "same") return same();
    if (v["error"] === "not_found") return NOT_FOUND; // 無い版・本文の行が無い（入口を通った見えるチケット）は E-PAGE-001
    if (v["ok"] !== true) return bodyReply(String(v["error"]));
    return {
      status: 201,
      body: { data: { version: v["version"], changed: v["changed"], edited_at: v["edited_at"] } },
    };
  };
}
