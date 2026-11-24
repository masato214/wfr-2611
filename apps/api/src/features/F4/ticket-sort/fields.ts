// 欄の組「優先度・親」（K-440・段 5 F4「チケットを作って中身を決める」）。チケットを直す口（updateTicket）の欄ごとの処理の表に登録する（ticket-update/fields.ts）。
//   前処理（inputIssues）：契約に書ける形の決まり（422）だけを、DB を引く前に断る（代表の答え answer=f0f290e785a9）。
//     priority は mid・high だけ／high なら priority_reason が要る（制御文字を除き空なら無い）／priority_reason は high のときだけ／parent_ticket_id は uuid か null
//   書くのは関門 C2 の DB の関数 app.ticket_sort_set（優先度・理由・親の列・やり取りの変更の 1 行・担当者の受け箱の行・証跡を 1 つの処理で）だけ。
//   担当者の受け箱の知らせ（担当者でない人が変えたときだけ・画面の中だけ・D-125.130・D-150.32）も、その関数の中で書く（宛先を口に任せない＝守りの 2 層目）。
//   DB の中身で決まる断り（親が無い・見えない 404／自分・子孫・3 段超・親の期限より後 409）は関数の答えから（errors.ts）。
//   担当者・段・実績・保留・期限はこの組に入れない（担当者を黙って直に書く道は作らない）。
//   答え：200 { ticket, changed, message_id }（ticket は id・number・updated_at と、送った欄の列）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { Row } from "@kaname/db/repository";
import type { HookReply } from "../../../contract/deps.js";
import type { GroupResult, TicketFieldGroup } from "../../ticket-update/fields.js";
import { replaceLoneSurrogates } from "../../ticket-update/text.js";
import {
  PARENT_MESSAGE,
  PRIORITIES,
  PRIORITY_MESSAGE,
  REASON_MISSING_MESSAGE,
  REASON_ONLY_HIGH_MESSAGE,
  invalid,
  replyOf,
} from "./errors.js";

/** この組が受ける欄 */
export const SORT_FIELDS = ["priority", "priority_reason", "parent_ticket_id"] as const;

/** 制御文字（タブ・改行・復帰は残す）を取り除いて前後の空白を落とした後の字（DB の関数 app.ticket_sort_set と同じ決まり） */
// eslint-disable-next-line no-control-regex
const clean = (v: string): string => v.replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

/** 形の決まり（契約に書ける物だけ）。違えば 422 の答え、合えば null */
export function sortIssues(raw: Row): HookReply | null {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k);
  const prio = raw["priority"];
  const reason = raw["priority_reason"];
  if (has("priority") && !(typeof prio === "string" && (PRIORITIES as readonly string[]).includes(prio)))
    return invalid([{ field: "priority", message: PRIORITY_MESSAGE }]);
  const blankReason = !has("priority_reason") || typeof reason !== "string" || clean(reason) === "";
  if (has("priority") && prio === "high") {
    if (blankReason) return invalid([{ field: "priority_reason", message: REASON_MISSING_MESSAGE }]);
  } else if (has("priority_reason")) {
    // 中に理由を付けた・理由だけを送った
    return invalid([{ field: "priority_reason", message: REASON_ONLY_HIGH_MESSAGE }]);
  }
  const parent = raw["parent_ticket_id"];
  if (has("parent_ticket_id") && parent !== null && !(typeof parent === "string" && isUuid(parent)))
    return invalid([{ field: "parent_ticket_id", message: PARENT_MESSAGE }]);
  return null;
}

type Sorted = Row & { error?: unknown };

async function apply(cl: pg.PoolClient, ticketId: string, input: Row): Promise<GroupResult> {
  const where = "優先度・親を変える";
  const r = (
    await cl.query<{ v: Sorted | null }>("select app.ticket_sort_set($1, $2::jsonb) as v", [
      ticketId,
      JSON.stringify({
        ...input,
        ...("priority_reason" in input ? { priority_reason: replaceLoneSurrogates(input["priority_reason"]) } : {}),
      }),
    ])
  ).rows[0]?.v;
  if (!r) return { ok: false, reply: replyOf({ error: "empty" }, where) };
  if (r.error !== undefined) return { ok: false, reply: replyOf(r, where) };
  return { ok: true, data: { ticket: r["ticket"], changed: r["changed"], message_id: r["message_id"] ?? null } };
}

export const ticketSortFields: TicketFieldGroup = {
  name: "ticketSort",
  fields: SORT_FIELDS,
  inputIssues: sortIssues,
  apply,
};
