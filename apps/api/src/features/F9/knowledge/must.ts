// 必ず守るを付ける・外す口（K-685・契約の口 setKnowledgeMust・PUT /api/v1/knowledge_pages/:id/must）。
//   1 つの取引の中で：見えない → 404・書けない → 403・まだ書き終えていない → 409 E-KNW-010・すでに同じ印 → 200（何も変えない）・
//   承認待ちの頼み → 409 E-KNW-011・app.kn_must_set（棚の錠の中で字数 → 上限）：too_long → 409 E-KNW-061・full → 409 E-KNW-060（detail に今付いている一覧）。
//   印が変わったときだけ証跡（knowledge.must.on／off・題名を入れない）。DB の失敗は 503 E-PAGE-003（check 違反だけ 409 E-KNW-010）。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { checkKnowledgeInput } from "./input.js";
import { conflict, forbidden, notFound, unavailable } from "./reply.js";
import { hasPendingRequest } from "./page-guards/pending-request.js";

const PAGE_SQL = `select p.state, p.is_must, app.kpage_writable(p.id) as writable from knowledge_pages p
 where p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null
   and p.state in ('draft', 'published') and app.kpage_visible(p.id)`;
const SET_SQL = "select app.kn_must_set($1, $2) as r";
const AUDIT_SQL = "select app.record_audit($1, 'knowledge_pages', $2, 'C2', '{}'::jsonb)";

interface SetResult {
  readonly ok: boolean;
  readonly reason?: "denied" | "draft" | "too_long" | "full";
  readonly changed?: boolean;
  readonly must?: boolean;
  readonly used?: number;
  readonly limit?: number;
  readonly shelf_name?: string;
  readonly pages?: readonly { id: string; title: string; folder: string }[];
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

/** 関数の断りを答えに直す */
function refusal(r: SetResult): HookReply {
  if (r.reason === "too_long") return conflict("E-KNW-061");
  if (r.reason === "full")
    return conflict("E-KNW-060", { shelf_name: r.shelf_name, limit: r.limit, pages: r.pages ?? [] });
  if (r.reason === "draft") return conflict("E-KNW-010");
  return forbidden();
}

async function run(cl: pg.PoolClient, id: string, must: boolean): Promise<HookReply> {
  const page = (await cl.query<{ state: string; is_must: boolean; writable: boolean }>(PAGE_SQL, [id])).rows[0];
  if (!page) return notFound();
  if (page.writable !== true) return forbidden();
  if (page.state !== "published") return conflict("E-KNW-010");
  if (page.is_must !== must && (await hasPendingRequest(cl, id))) return conflict("E-KNW-011");
  const r = (await cl.query<{ r: SetResult }>(SET_SQL, [id, must])).rows[0]!.r;
  if (!r.ok) return refusal(r);
  if (r.changed) await cl.query(AUDIT_SQL, [must ? "knowledge.must.on" : "knowledge.must.off", id]);
  return { status: 200, body: { data: { id, must: r.must, used: r.used, limit: r.limit } } };
}

export function createSetKnowledgeMust(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkKnowledgeInput("setKnowledgeMust", a.input);
    if (bad) return bad;
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, a.id!, a.input["must"] === true));
    } catch (e) {
      if ((e as { code?: unknown })?.code === "23514") return conflict("E-KNW-010");
      console.error(`[knowledge] 必ず守るを付け外しできなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
