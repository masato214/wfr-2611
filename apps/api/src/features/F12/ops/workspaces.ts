// 運営の外枠の数（getOpsShell・GET /api/v1/ops/shell）と全社の一覧（listOpsWorkspaces・GET /api/v1/ops/workspaces）（K-963・関門 C2・D-156.3・D-156.4）。
//   読むだけ（DB に書かない・運営の記録も書かない）。振る舞いの本体は DB の関数 app.ops_shell・app.ops_workspaces（20261128010300_ops_workspaces.sql）。
//   上限・認証・運営の人だけ（ops:any）・知らない問い合わせの名前・NUL・q の長さ・view／plan／sort の値は契約の入口（op.ts）が先に確かめる。
//   ここでも値の形を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。DB の断りは opsErrorReply（K-947）
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

export const VIEWS = ["all", "attention", "stopped", "closing"] as const;
export const PLANS = ["free", "team", "business"] as const;
export const SORTS = ["attention", "members", "runs"] as const;
/** q の上限（送られたままの字で数える・K-1006 の QUERY_RANGES と同じ） */
export const Q_MAX = 100;

interface Issue {
  field: string;
  message: string;
}
export interface WorkspacesQuery {
  q: string | null;
  view: (typeof VIEWS)[number];
  plan: (typeof PLANS)[number] | null;
  sort: (typeof SORTS)[number];
  limit: number | null;
}

const pick = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  field: string,
  issues: Issue[],
): T | null => {
  if (raw === undefined || raw === "") return null;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  issues.push({ field, message: allowed.join("・") });
  return null;
};

/** 問い合わせの値を整える。空の値は指定なし（既定 view all・sort attention・limit は全部） */
export function parseWorkspacesQuery(
  raw: Record<string, string>,
): { ok: true; value: WorkspacesQuery } | { ok: false; details: Issue[] } {
  const issues: Issue[] = [];
  const qRaw = raw["q"] ?? "";
  if ([...qRaw].length > Q_MAX) issues.push({ field: "q", message: `${Q_MAX} 字まで` });
  const view = pick(raw["view"], VIEWS, "view", issues) ?? "all";
  const plan = pick(raw["plan"], PLANS, "plan", issues);
  const sort = pick(raw["sort"], SORTS, "sort", issues) ?? "attention";
  const limitRaw = raw["limit"] ?? "";
  let limit: number | null = null;
  if (limitRaw !== "") {
    limit = /^[0-9]{1,4}$/.test(limitRaw) ? Number(limitRaw) : NaN;
    if (!Number.isInteger(limit) || limit < 1) issues.push({ field: "limit", message: "1 以上の整数" });
  }
  if (issues.length) return { ok: false, details: issues };
  const q = qRaw.trim();
  return { ok: true, value: { q: q === "" ? null : q, view, plan, sort, limit } };
}

export function createGetOpsShell(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const data = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: unknown }>("select app.ops_shell() as j");
        return r.rows[0]!.j;
      });
      return { status: 200, body: { data } };
    } catch (e) {
      return opsErrorReply(e, "shell");
    }
  };
}

export function createListOpsWorkspaces(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseWorkspacesQuery(a.c.req.query());
    if (!parsed.ok)
      return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: parsed.details } };
    const v = parsed.value;
    try {
      const data = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: { data: unknown[] } }>("select app.ops_workspaces($1, $2, $3, $4, $5) as j", [
          v.q,
          v.view,
          v.plan,
          v.sort,
          v.limit,
        ]);
        return r.rows[0]!.j.data;
      });
      return { status: 200, body: { data } };
    } catch (e) {
      return opsErrorReply(e, "workspaces");
    }
  };
}
