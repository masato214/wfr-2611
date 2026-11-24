// 欄の組「会社の項目の値」（K-564・段 5 F4「チケットを作って中身を決める」）。チケットを直す口（updateTicket）の欄ごとの処理の表に登録する（ticket-update/fields.ts）。
//   欄は fields = { "<項目の id（uuid）>": 値 }（送った項目だけ変える。空にするのは null）。
//   前処理（inputIssues）：契約に書ける形の決まり（422・欄 fields）だけを、DB を引かずに断る：
//     object で 1 つ以上・鍵は uuid（大文字小文字違いで重ならない）・値は文字・数・真偽・文字の並び・null のどれか・文字に NUL を含まない。
//   値が項目の型に合うか・選択肢に在るか・種別に出るか・必須かは項目のマスタ（DB）で決まるので、契約には書けず DB の関数の答えから（errors.ts の 404・409）。
//   書くのは関門 C2 の DB の関数 app.ticket_fields_set（値の行・チケットの更新者と更新時刻・やり取りの変更の 1 行・担当者の受け箱の行・証跡を 1 つの処理で）だけ。
//   答え：200 { ticket, changed, message_id }（ticket は id・number・updated_at と、送った項目の保存した値 fields）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { Row } from "@kaname/db/repository";
import type { HookReply } from "../../../contract/deps.js";
import type { GroupResult, TicketFieldGroup } from "../../ticket-update/fields.js";
import { FIELDS_DUPLICATE_MESSAGE, FIELDS_SHAPE_MESSAGE, invalid, replyOf } from "./errors.js";

/** この組が受ける欄 */
export const TICKET_FIELDS_FIELDS = ["fields"] as const;

const isObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const noNul = (s: string): boolean => !s.includes("\u0000");

/** 値が文字・数・真偽・文字の並び・null のどれかで、文字に NUL が無い */
function validValue(v: unknown): boolean {
  if (v === null || typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") return noNul(v);
  return Array.isArray(v) && v.every((x) => typeof x === "string" && noNul(x));
}

/** 形の決まり（契約に書ける物だけ）。違えば 422 の答え、合えば null */
export function fieldsIssues(raw: Row): HookReply | null {
  const fields = raw["fields"];
  if (!isObject(fields)) return invalid([{ field: "fields", message: FIELDS_SHAPE_MESSAGE }]);
  const keys = Object.keys(fields);
  if (keys.length === 0 || !keys.every((k) => isUuid(k)) || !keys.every((k) => validValue(fields[k])))
    return invalid([{ field: "fields", message: FIELDS_SHAPE_MESSAGE }]);
  if (new Set(keys.map((k) => k.toLowerCase())).size !== keys.length)
    return invalid([{ field: "fields", message: FIELDS_DUPLICATE_MESSAGE }]);
  return null;
}

type Written = Row & { error?: unknown };

async function apply(cl: pg.PoolClient, ticketId: string, input: Row): Promise<GroupResult> {
  const where = "会社の項目の値を書く";
  const r = (
    await cl.query<{ v: Written | null }>("select app.ticket_fields_set($1, $2::jsonb) as v", [
      ticketId,
      JSON.stringify(input["fields"]),
    ])
  ).rows[0]?.v;
  if (!r) return { ok: false, reply: replyOf({ error: "empty" }, where) };
  if (r.error !== undefined) return { ok: false, reply: replyOf(r, where) };
  const ticket = isObject(r["ticket"]) ? r["ticket"] : {};
  return {
    ok: true,
    data: {
      ticket: { ...ticket, fields: r["fields"] ?? {} },
      changed: r["changed"],
      message_id: r["message_id"] ?? null,
    },
  };
}

export const ticketFieldsFields: TicketFieldGroup = {
  name: "ticketFields",
  fields: TICKET_FIELDS_FIELDS,
  inputIssues: fieldsIssues,
  apply,
};
