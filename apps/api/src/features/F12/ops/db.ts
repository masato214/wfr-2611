// 運営が会社を触る口から呼ぶ DB の土台（K-947・関門 C2・D-156.3・D-156.12・D-156.17・D-128.108）。
//   運営が別の会社を触る道は security definer の関数 app.ops_<名前> だけ。口はこの opsTx の中で関数を呼び、例外は opsErrorReply で答える。
//   opsTx         … 運営の文脈（role ops・tenantId null・userId は運営の会社の members.id）の 1 つの取引（withTenant）
//   opsAudit      … 運営の記録と指した会社の記録の両方に 1 行（app.record_ops_audit）。呼んだ取引が落ちれば両方戻る
//   opsErrorReply … DB の断り → 口の答え：42501 → 403 FORBIDDEN／P0002 → 404 NOT_FOUND（欄・details なし）／ほか → 503 E-PAGE-003
//                   ログは場所と SQLSTATE だけ（例外の文・値を出さない）
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookReply } from "../../../contract/deps.js";

/** 運営の文脈の 1 つの取引で fn を流す。運営の文脈でなければ投げる（会社の文脈で運営の関数を呼ばない） */
export async function opsTx<T>(
  pool: pg.Pool,
  ctx: TenantContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  if (ctx.role !== "ops" || ctx.tenantId !== null || !ctx.userId) {
    throw new Error("opsTx は運営の文脈（role ops・tenantId null・userId あり）でだけ使う");
  }
  return withTenant(pool, ctx, fn);
}

export interface OpsAuditEntry {
  /** 指した会社（その会社の audit_events にも同じ行が残る） */
  readonly tenantId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly payload?: Record<string, unknown>;
}

/** 運営の記録と会社の記録の両方に 1 行（中を見るの許可 grant は付けない）。返すのは ops_audit_events.id */
export async function opsAudit(client: pg.PoolClient, a: OpsAuditEntry): Promise<string> {
  const r = await client.query<{ id: string }>("select app.record_ops_audit($1, $2, $3, $4, null, $5::jsonb) as id", [
    a.tenantId,
    a.action,
    a.targetType,
    a.targetId,
    JSON.stringify(a.payload ?? {}),
  ]);
  return r.rows[0]!.id;
}

const sqlState = (e: unknown): string => {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : "unknown";
};

/** DB の断りを口の答えに直す。どれでもない失敗は止める側に倒す（503） */
export function opsErrorReply(e: unknown, where: string): HookReply {
  const state = sqlState(e);
  if (state === "42501") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (state === "P0002") return { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
  console.error(`[ops] ${where} の DB が失敗した（${state}）`);
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
}
