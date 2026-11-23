// 実行の 1 件（getActionRun）・実行の一覧（listTicketRuns）の答えに止まった理由の種類（reason_kind）を足す（K-485）。
//   本体は K-62 の人が呼ぶ口（F5/delegate）。ここはその 200 の答えの実行 1 件ずつに withReasonKind（reason-kind.ts の 1 つ）を掛けるだけで、
//   ほかの欄・状態コード・エラーの答えは触らない
import type pg from "pg";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { delegateHooks } from "../../F5/delegate/index.js";
import { withReasonKind } from "./reason-kind.js";

type Run = { status: string; stopped_reason?: string | null };

export function stoppedViewHooks(pool: pg.Pool): Record<string, Hook> {
  const base = delegateHooks(pool);
  const wrap = (op: "getActionRun" | "listTicketRuns", add: (data: unknown) => unknown): Hook => ({
    ...base[op],
    before: async (a: HookArgs): Promise<HookReply | void> => {
      const r = await base[op]?.before?.(a);
      if (!r || r.status !== 200) return r;
      const body = r.body as { data: unknown };
      return { ...r, body: { ...body, data: add(body.data) } };
    },
  });
  return {
    getActionRun: wrap("getActionRun", (data) => withReasonKind(data as Run)),
    listTicketRuns: wrap("listTicketRuns", (data) => (data as Run[]).map((x) => withReasonKind(x))),
  };
}
