// 選べるプラン（K-961・listWorkspacePlans・GET /api/v1/workspace/plans）とプランを変える（changePlan・POST /api/v1/workspace/plan）。
//   どちらも関門 C2 の DB の関数（app.workspace_plans・app.plan_change）を withTenant の 1 取引で 1 回呼ぶ → 断りの言葉 → 番号。
//   本人確認の取り直し（changePlan・15 分）は入口（契約の step_up always）。上げる＝すぐ・下げる＝来月 1 日から（D-128.65）。
//   日割りの額は頼みの行に残し、請求書を出す葉 K-981 が次の請求書に足す（D-156.31）。お知らせ・メールは送らない（D-125.130）。
//   ログに会社・人・プランの中身を出さない（場所と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

type Answer = { data?: unknown; meta?: unknown; error?: unknown; detail?: unknown };

/** 止める側に倒す（503・E-PAGE-003）。ログには場所と言葉（例外の種類）だけ */
const down = (where: string, word: string): HookReply => {
  console.error(`[billing] ${where}（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

/** 欄も details も付けない（在るかを漏らさない・控え帳）。404 は detail も外す */
const flat = (code: string, status: number, detail?: Record<string, unknown>): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code, detail ?? {}).toJSON() };
  if (status === 404) delete body["detail"];
  return { status, body };
};

/** DB の関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(r: Answer, where: string): HookReply {
  const word = String(r.error);
  if (word === "forbidden") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (word === "not_found") return flat("E-PAGE-001", 404);
  if (word === "same_plan") return flat("E-PLAN-001", 409);
  if (word === "over_limit") {
    const d = (r.detail ?? {}) as Record<string, unknown>;
    return flat("E-PLAN-002", 409, { members: d["members"], member_limit: d["member_limit"] });
  }
  return down(where, word);
}

/** 関数を 1 取引で 1 回呼ぶ。例外は 503（1 取引なので何も残らない） */
async function callFn(
  appPool: pg.Pool,
  a: HookArgs,
  sql: string,
  params: unknown[],
  where: string,
  failed: string,
): Promise<Answer | HookReply> {
  try {
    const v = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Answer }>(sql, params)).rows[0]?.v);
    return v ?? down(where, "empty");
  } catch (e) {
    return down(failed, (e as Error)?.name ?? "Error");
  }
}

const isReply = (v: Answer | HookReply): v is HookReply => "status" in v;

export function createListWorkspacePlans(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const where = "選べるプランを読む";
    const r = await callFn(appPool, a, "select app.workspace_plans() as v", [], where, "選べるプランを読めなかった");
    if (isReply(r)) return r;
    if (r.error !== undefined || r.data === undefined) return replyOf(r, where);
    return { status: 200, body: { data: r.data, meta: r.meta } };
  };
}

export function createChangePlan(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const where = "プランを変える";
    const key = typeof a.input["plan_key"] === "string" ? a.input["plan_key"].trim() : "";
    const r = await callFn(appPool, a, "select app.plan_change($1) as v", [key], where, "プランを変えられなかった");
    if (isReply(r)) return r;
    if (r.error !== undefined || r.data === undefined) return replyOf(r, where);
    return { status: 200, body: { data: r.data } };
  };
}
