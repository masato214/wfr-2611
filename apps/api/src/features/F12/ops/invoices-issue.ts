// 運営が月の請求書をまとめて出す（K-981・issueOpsInvoices・POST /api/v1/ops/invoices/issue・D-156.31・D-156.53・D-128.108）。
//   お金を持つ運営の人と本人確認の取り直し（15 分）は入口（契約の ops:money・step_up always）。入力の形（month・dry_run）も入口（422）。
//   opsTx の 1 取引で app.ops_invoices_issue を 1 回呼ぶ → 断りの言葉 → 番号。下書き（dry_run）は何も書かない。
//   出すときは会社ごとに請求書・運営と会社の記録・管理者への鈴を同じ取引で書く（どれかが落ちれば全部戻る・503）。
//   PDF はこの葉では作らない（p_pdf は空・K-1013 が足す）。ログは場所と SQLSTATE だけ（会社の名前・額を出さない）
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

type Answer = { data?: unknown; error?: unknown };

const WHERE = "invoices-issue";

/** 欄も details も付けない（控え帳） */
const conflict = (code: string): HookReply => ({ status: 409, body: kanameError(code).toJSON() });

/** DB の関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(word: string): HookReply {
  if (word === "month_open") return conflict("E-BILL-002");
  if (word === "nothing_to_issue") return conflict("E-BILL-003");
  console.error(`[ops] ${WHERE} の DB が断った（${/^[a-z_]+$/.test(word) ? word : "unknown"}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}

export function createIssueOpsInvoices(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const month = typeof a.input["month"] === "string" ? a.input["month"] : "";
    const dry = a.input["dry_run"] === true;
    let r: Answer | undefined;
    try {
      r = await opsTx(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: Answer }>("select app.ops_invoices_issue($1, $2, '{}'::jsonb) as v", [month, dry]))
            .rows[0]?.v,
      );
    } catch (e) {
      return opsErrorReply(e, WHERE);
    }
    if (!r) return replyOf("empty");
    if (r.error !== undefined || r.data === undefined) return replyOf(String(r.error));
    return { status: 201, body: { data: r.data } };
  };
}
