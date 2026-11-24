// 欄の組「段・実績・保留」（K-387・段 7 F6「自分で進める」）。チケットを直す口（updateTicket）の欄ごとの処理の表に登録する（ticket-update/fields.ts）。
//   前処理（inputIssues）：契約に書ける形の決まり（422）だけを、DB を引く前に断る（代表の答え answer=f0f290e785a9）。
//     stage_id と stage_key の両方／stage_key は todo・doing・hold だけ／保留の理由と条件は空白と制御文字だけでない字／
//     stage_key hold なら理由と条件の両方が要る／stage_key todo・doing に理由と条件は付けない／実績は 0〜100000
//   書くのは関門 C2 の DB の関数 app.ticket_progress_set（段・保留の列・実績・やり取りの変更の 1 行・担当者の受け箱の行・証跡を 1 つの処理で）だけ。
//   受け箱の知らせ（担当者でない人が段を変えたときだけ・画面の中だけ・D-125.130）も、その関数の中で書く（宛先を口に任せない＝守りの 2 層目）。
//   DB の中身で決まる断り（指した段が無い 404・仕組みの段や完了の段・保留でないのに理由だけ 409）は関数の答えから（errors.ts）。
//   答え：200 { ticket, stage, changed, message_id }（関数の changes・notify_assignee は書き込みと一緒に呼ぶ K-389 のためで、口は返さない）
import type pg from "pg";
import type { Row } from "@kaname/db/repository";
import type { HookReply } from "../../../contract/deps.js";
import type { GroupResult, TicketFieldGroup } from "../../ticket-update/fields.js";
import { HOLD_ONLY_MESSAGE, MINUTES_MESSAGE, STAGE_BOTH_MESSAGE, holdMissing, invalid, replyOf } from "./errors.js";
import { cleanString } from "../well-formed.js";

/** この組が受ける欄（段は stage_id か stage_key のどちらか 1 つ） */
export const PROGRESS_FIELDS = ["stage_id", "stage_key", "actual_minutes", "hold_reason", "resume_condition"] as const;
/** stage_key で選べる段（段 7 のメニューの段。完了は完了の小窓 completeTicket から・会社が足した段は stage_id か F9） */
export const STAGE_KEYS = ["todo", "doing", "hold"] as const;
const HOLD_FIELDS = ["hold_reason", "resume_condition"] as const;
const MINUTES_MAX = 100000;

/** 契約の pattern に合わない字か：空白（JavaScript の \s）と制御文字だけ、または NUL を含む（NUL はどの口でも入口で 422・黙って取り除かない・answer=c8b3f4c3aef8） */
// eslint-disable-next-line no-control-regex
const blank = (v: string): boolean => v.includes("\u0000") || v.replace(/[\u0000-\u001f\u007f]/g, " ").trim() === "";

/** 形の決まり（契約に書ける物だけ）。違えば 422 の答え、合えば null。型の違い（数でない・null の字の欄）は入口の契約の確かめに任せる */
export function progressIssues(raw: Row): HookReply | null {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k);
  if (has("stage_id") && has("stage_key")) return invalid([{ field: "stage_key", message: STAGE_BOTH_MESSAGE }]);
  const key = raw["stage_key"];
  if (typeof key === "string" && !(STAGE_KEYS as readonly string[]).includes(key))
    return invalid([{ field: "stage_key", message: "todo・doing・hold のどれかにしてください" }]);
  const missing = HOLD_FIELDS.filter((f) => {
    const v = raw[f];
    return typeof v === "string" ? blank(v) : key === "hold" && !has(f);
  });
  if (missing.length) return holdMissing(missing, 422);
  if (key === "todo" || key === "doing") {
    const extra = HOLD_FIELDS.filter((f) => has(f));
    if (extra.length) return invalid(extra.map((field) => ({ field, message: HOLD_ONLY_MESSAGE })));
  }
  const m = raw["actual_minutes"];
  if (typeof m === "number" && Number.isInteger(m) && (m < 0 || m > MINUTES_MAX))
    return invalid([{ field: "actual_minutes", message: MINUTES_MESSAGE }]);
  return null;
}

type Progress = Row & { error?: unknown; fields?: unknown };

/** jsonb に入らない対にならないサロゲートを U+FFFD にする（F6 の口の共通の置き換え・../well-formed.ts。NUL は前処理が 422 にするのでここへ来ない） */
const clean = cleanString;
const cleaned = (input: Row): Row =>
  Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, (HOLD_FIELDS as readonly string[]).includes(k) ? clean(v) : v]),
  );

async function apply(cl: pg.PoolClient, ticketId: string, input: Row): Promise<GroupResult> {
  const where = "段・実績・保留を変える";
  const r = (
    await cl.query<{ v: Progress | null }>("select app.ticket_progress_set($1, $2::jsonb) as v", [
      ticketId,
      JSON.stringify(cleaned(input)),
    ])
  ).rows[0]?.v;
  if (!r) return { ok: false, reply: replyOf({ error: "empty" }, where, input) };
  if (r.error !== undefined) return { ok: false, reply: replyOf(r, where, input) };
  return {
    ok: true,
    data: { ticket: r["ticket"], stage: r["stage"], changed: r["changed"], message_id: r["message_id"] ?? null },
  };
}

export const progressFields: TicketFieldGroup = {
  name: "progress",
  fields: PROGRESS_FIELDS,
  inputIssues: progressIssues,
  apply,
};
