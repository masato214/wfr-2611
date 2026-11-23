// 決定を改める・取り消す口（K-391）：updateTicketDecision（PATCH /api/v1/ticket_decisions/:id）。
//   書くのは関門 C2 の app.ticket_decision_revise／app.ticket_decision_cancel（1 つの処理・関数の中でもう一度、今のメンバーか・書けるかを確かめる）だけ。
//   action：revise（改める）・cancel（取り消す）は関数を 1 回。
//   action が無い・知らない言葉は、関数を呼ぶ前に 422 VALIDATION_ERROR（入口の zod は enum を読まないので口が自分で断る）。
//   字数の上限は置かない・切らない（D-130.1）。ログに決めたことの字・理由を出さない。
//   守りの判定で例外 → 503・E-PAGE-003。書く所の DB の失敗も 503・E-PAGE-003（何も残らない・D-136.1）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { badAction, decisionsDown, replyOf } from "./errors.js";

type Changed = { decision?: unknown; previous?: unknown; message_id?: unknown; error?: unknown };

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function createUpdateTicketDecision(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const action = a.input["action"];
    if (action !== "revise" && action !== "cancel") return badAction();
    // text・reason が字でない（数・配列など）なら空として扱う（関数が空を断る）
    const text = str(a.input["text"]);
    const reason = str(a.input["reason"]);

    const where = "決定を改める・取り消す";
    let r: Changed | undefined;
    try {
      r = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (action === "revise"
            ? await cl.query<{ v: Changed }>("select app.ticket_decision_revise($1, $2, $3) as v", [a.id, text, reason])
            : await cl.query<{ v: Changed }>("select app.ticket_decision_cancel($1, $2) as v", [a.id, reason])
          ).rows[0]?.v,
      );
    } catch (e) {
      // 書く所の失敗（1 つの処理なので何も残らない）。中身を返さず、ログは場所と例外の種類だけ
      console.error(`[decisions] 決定を改める・取り消す：書く所で失敗した（${(e as Error)?.name ?? "Error"}）`);
      return decisionsDown(where, "db_error");
    }
    if (!r) return replyOf({ error: "empty" }, where);
    if (r.error !== undefined) return replyOf(r, where);
    return {
      status: 200,
      body: { data: { decision: r.decision, previous: r.previous ?? null, message_id: r.message_id } },
    };
  };
}
