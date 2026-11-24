// 頼みを取り下げる口・断りの帯を消す口（K-687・契約の口 withdrawKnowledgeRequest〔DELETE /api/v1/knowledge/requests/:id〕・
//   dismissKnowledgeRequest〔POST /api/v1/knowledge/requests/:id/dismiss〕）。入口は頼みの行を読まない（row_rules.mjs の ROW_EXEMPT）。
//   1 つの取引の中で：頼みが見えない（app.kn_request_visible）→ 404 → app.kn_request_end の断り（not_found 404・forbidden 403・
//   decided 409 E-KNW-104・not_declined 409 E-KNW-105）→ 証跡（knowledge.raise.withdraw／dismiss）→ 200 { id, state }。
//   DB の失敗は 503 E-PAGE-003（何も残さない）。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflict, forbidden, notFound, unavailable } from "./reply.js";

type Action = "withdraw" | "dismiss";
type Reason = "not_found" | "forbidden" | "decided" | "not_declined";
interface EndResult {
  readonly ok: boolean;
  readonly reason?: Reason;
  readonly state?: string;
}

const VISIBLE_SQL = "select app.kn_request_visible($1) as ok";
const END_SQL = "select app.kn_request_end($1, $2) as r";
const AUDIT_SQL = "select app.record_audit($1, 'knowledge_requests', $2, 'C2', '{}'::jsonb)";

const REFUSAL: Readonly<Record<Reason, () => HookReply>> = {
  not_found: notFound,
  forbidden,
  decided: () => conflict("E-KNW-104"),
  not_declined: () => conflict("E-KNW-105"),
};
const AUDIT: Readonly<Record<Action, string>> = {
  withdraw: "knowledge.raise.withdraw",
  dismiss: "knowledge.raise.dismiss",
};

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

async function run(cl: pg.PoolClient, id: string, action: Action): Promise<HookReply> {
  const seen = (await cl.query<{ ok: boolean }>(VISIBLE_SQL, [id])).rows[0];
  if (seen?.ok !== true) return notFound();
  const r = (await cl.query<{ r: EndResult }>(END_SQL, [id, action])).rows[0]!.r;
  if (!r.ok) return (REFUSAL[r.reason ?? "not_found"] ?? notFound)();
  await cl.query(AUDIT_SQL, [AUDIT[action], id]);
  return { status: 200, body: { data: { id, state: r.state } } };
}

function createEnd(appPool: pg.Pool, action: Action): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const id = a.id;
    if (!id || !isUuid(id)) return notFound();
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, id, action));
    } catch (e) {
      console.error(`[knowledge] 頼みを終えられなかった（${action}・${kindOf(e)}）`);
      return unavailable();
    }
  };
}

export const createWithdrawKnowledgeRequest = (appPool: pg.Pool): ((a: HookArgs) => Promise<HookReply>) =>
  createEnd(appPool, "withdraw");
export const createDismissKnowledgeRequest = (appPool: pg.Pool): ((a: HookArgs) => Promise<HookReply>) =>
  createEnd(appPool, "dismiss");
