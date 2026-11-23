// 状態（作業の段）の設定の口（K-705・契約の口 listTicketStages・createTicketStage・updateTicketStage・deleteTicketStage・reorderTicketStages）。
//   設計は 07_functional/段10-F9/土台-settings.md の 3・4 章。仕事は DB の関数 app.ticket_stage_* が持ち（権限 → 確かめ → 書く → 証跡を 1 つの取引）、
//   口は「入力の確かめ → 関数を呼ぶ → 答えの形にする」だけ。断りの言葉 → 番号：
//     name_taken＝409 E-STG-001／limit＝E-STG-002／locked_delete＝E-STG-003／name_locked＝E-STG-004／in_use＝E-STG-005（detail.ticket_count）／
//     order_mismatch＝E-STG-006／order_ends＝E-STG-007／not_found＝404 E-PAGE-001（欄・details なし）／forbidden＝403／invalid＝422（欄つき）。
//   想定外の例外は 503 E-PAGE-003（1 つの取引なので何も残らない）。ログに状態の名前を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

/** 答えの 1 行（鍵ちょうど 6）。lock は start（key が todo）・end（key が done）・system（仕組みの段）・null */
export interface TicketStageSetting {
  id: string;
  key: string | null;
  name: string;
  color_key: string;
  position: number;
  lock: "start" | "end" | "system" | null;
}

interface StageRow {
  id: string;
  key: string | null;
  name: string;
  color_key: string;
  position: number;
  is_fixed: boolean;
}

export const toStageSetting = (r: StageRow): TicketStageSetting => ({
  id: r.id,
  key: r.key,
  name: r.name,
  color_key: r.color_key,
  position: r.position,
  lock: r.key === "todo" ? "start" : r.key === "done" ? "end" : r.is_fixed ? "system" : null,
});

type Outcome = { data: unknown } | { error: string; field?: string; ticket_count?: number };

const CONFLICT: Record<string, string> = {
  name_taken: "E-STG-001",
  limit: "E-STG-002",
  locked_delete: "E-STG-003",
  name_locked: "E-STG-004",
  in_use: "E-STG-005",
  order_mismatch: "E-STG-006",
  order_ends: "E-STG-007",
};

function invalid(field: string): HookReply {
  return {
    status: 422,
    body: {
      error: "validation_failed",
      code: "VALIDATION_ERROR",
      details: [{ field, message: "入力内容を確認してください" }],
    },
  };
}
function notFound(): HookReply {
  return { status: 404, body: { error: "not_found", code: "E-PAGE-001" } };
}
function forbidden(): HookReply {
  return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
}
function unavailable(): HookReply {
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}
function conflict(code: string, detail?: Record<string, unknown>): HookReply {
  const e = kanameError(code);
  return { status: e.status, body: { error: e.entry.cls, code: e.code, ...(detail ? { detail } : {}) } };
}
function kindOf(e: unknown): string {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
}

/** 関数の答え → 口の答え（ok は okStatus）。対象を指さない口（足す・並べる）用：404 は返さない */
function settle(v: Outcome | undefined, okStatus: number): HookReply {
  if (!v) return unavailable();
  if ("data" in v) return { status: okStatus, body: { data: v.data } };
  if (v.error === "forbidden") return forbidden();
  if (v.error === "invalid") return invalid(v.field ?? "body");
  const code = CONFLICT[v.error];
  if (!code) return unavailable();
  return v.error === "in_use" ? conflict(code, { ticket_count: v.ticket_count ?? 0 }) : conflict(code);
}
/** 対象（:id）を指す口（直す・消す）用：無い・見えない状態は 404 */
function settleTarget(v: Outcome | undefined, okStatus: number): HookReply {
  if (v && "error" in v && v.error === "not_found") return notFound();
  return settle(v, okStatus);
}

const LIST_SQL =
  "select id, key, name, color_key, position, is_fixed from ticket_stages where deleted_at is null order by position, id";

export function createListTicketStages(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      const rows = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<StageRow>(LIST_SQL)).rows);
      const q = Number(a.c.req.query("limit"));
      return {
        status: 200,
        body: { data: rows.map(toStageSetting), meta: { limit: Number.isInteger(q) && q > 0 ? q : 50 } },
      };
    } catch (e) {
      console.error(`[ticket-stages] 読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}

/** 関数を 1 つの取引で呼ぶ。例外は 503（何も残らない）。答えの形は口ごとに answer が決める */
function callFn(
  appPool: pg.Pool,
  where: string,
  sql: string,
  params: (a: HookArgs) => unknown[] | HookReply,
  answer: (v: Outcome | undefined) => HookReply,
): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = params(a);
    if (!Array.isArray(p)) return p;
    try {
      const v = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Outcome }>(sql, p)).rows[0]?.v);
      return answer(v);
    } catch (e) {
      console.error(`[ticket-stages] ${where}できなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}

export const createCreateTicketStage = (appPool: pg.Pool) =>
  callFn(
    appPool,
    "足す",
    "select app.ticket_stage_create($1, $2) as v",
    (a) => {
      if (typeof a.input["name"] !== "string") return invalid("name");
      if (typeof a.input["color_key"] !== "string") return invalid("color_key");
      return [a.input["name"], a.input["color_key"]];
    },
    (v) => settle(v, 201),
  );

export const createUpdateTicketStage = (appPool: pg.Pool) =>
  callFn(
    appPool,
    "直す",
    "select app.ticket_stage_update($1, $2::jsonb) as v",
    (a) => {
      const patch: Record<string, unknown> = {};
      if (a.input["name"] !== undefined) patch["name"] = a.input["name"];
      if (a.input["color_key"] !== undefined) patch["color_key"] = a.input["color_key"];
      if (!Object.keys(patch).length) return invalid("body");
      return [a.id, JSON.stringify(patch)];
    },
    (v) => settleTarget(v, 200),
  );

export const createDeleteTicketStage = (appPool: pg.Pool) =>
  callFn(
    appPool,
    "消す",
    "select app.ticket_stage_delete($1) as v",
    (a) => [a.id],
    (v) => settleTarget(v, 200),
  );

export const createReorderTicketStages = (appPool: pg.Pool) =>
  callFn(
    appPool,
    "並べる",
    "select app.ticket_stage_reorder($1::uuid[]) as v",
    (a) => {
      const ids = a.input["stage_ids"];
      if (!Array.isArray(ids) || !ids.length) return invalid("stage_ids");
      return [ids];
    },
    (v) => settle(v, 200),
  );
