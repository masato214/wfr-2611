// 上の棚に上げるのを頼む口（K-687・契約の口 requestKnowledgeRaise・POST /api/v1/knowledge_pages/:id/raise）。
//   1 つの取引の中で、確かめてから DB の関数 app.kn_raise_request を呼ぶ：見えない → 404・書けない → 403・書き終えていない → 409 E-KNW-010・
//   会社の棚 → 409 E-KNW-100・承認待ち → 409 E-KNW-011・共有している → 409 E-KNW-106・関数の断り（group_required 101・no_group／no_folder 404・
//   folder_shelf 103・no_approver 102・pending 011・draft 010・denied 403）。確かめで断る前に何も書かない。
//   証跡は頼む＝knowledge.raise.request・すぐ移る＝knowledge.raise.apply（題名を入れない）。DB の失敗は 503 E-PAGE-003（部分一意 23505 は 011・
//   引き金の KNW_FOLDER_SHELF は 103）。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflict, forbidden, invalid, notFound, unavailable } from "./reply.js";
import { hasPendingRequest } from "./page-guards/pending-request.js";
import { isSharedOut } from "./page-guards/shared.js";

const PAGE_SQL = `select p.state, p.is_personal, p.scope_id = app.kn_company_scope() as company,
       app.kpage_writable(p.id) as writable
  from knowledge_pages p
 where p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null and app.kpage_visible(p.id)`;
const RAISE_SQL = "select app.kn_raise_request($1, $2, $3, $4) as r";
const AT_SQL = "select created_at from knowledge_requests where id = $1";
const AUDIT_SQL = "select app.record_audit($1, 'knowledge_requests', $2, 'C2', '{}'::jsonb)";

const MESSAGE_MAX = 1000;
const MESSAGE = "入力内容を確認してください";

type Reason =
  | "denied"
  | "draft"
  | "company"
  | "pending"
  | "group_required"
  | "no_group"
  | "no_folder"
  | "folder_shelf"
  | "no_approver";
interface RaiseResult {
  readonly ok: boolean;
  readonly reason?: Reason;
  readonly state?: "pending" | "approved";
  readonly id?: string;
  readonly to_name?: string;
}
interface RaiseInput {
  readonly group: string | null;
  readonly folder: string | null;
  readonly message: string | null;
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

/** 入口の形の確かめに重ねて、契約の値域（message は 1,000 字まで）と uuid の形を見る。前後の空白は落とし、空は null */
function readInput(input: Readonly<Record<string, unknown>>): RaiseInput | HookReply {
  for (const k of ["group_id", "folder_id"]) {
    const v = input[k];
    if (v !== undefined && v !== null && !(typeof v === "string" && isUuid(v))) return invalid(k, MESSAGE);
  }
  const m = input["message"];
  if (m !== undefined && m !== null && (typeof m !== "string" || [...m].length > MESSAGE_MAX || m.includes("\u0000")))
    return invalid("message", MESSAGE);
  const trimmed = typeof m === "string" ? m.trim() : "";
  return {
    group: (input["group_id"] as string | null | undefined) ?? null,
    folder: (input["folder_id"] as string | null | undefined) ?? null,
    message: trimmed === "" ? null : trimmed,
  };
}

const REFUSAL: Readonly<Record<Reason, () => HookReply>> = {
  denied: forbidden,
  draft: () => conflict("E-KNW-010"),
  company: () => conflict("E-KNW-100"),
  pending: () => conflict("E-KNW-011"),
  group_required: () => conflict("E-KNW-101"),
  no_group: notFound,
  no_folder: notFound,
  folder_shelf: () => conflict("E-KNW-103"),
  no_approver: () => conflict("E-KNW-102"),
};

/** 関数を呼ぶ前の確かめ（何も書かない）。通れば null */
async function precheck(cl: pg.PoolClient, id: string): Promise<HookReply | null> {
  const page = (
    await cl.query<{ state: string; is_personal: boolean; company: boolean; writable: boolean }>(PAGE_SQL, [id])
  ).rows[0];
  if (!page) return notFound();
  if (page.writable !== true) return forbidden();
  if (page.state !== "published") return conflict("E-KNW-010");
  if (!page.is_personal && page.company) return conflict("E-KNW-100");
  if (await hasPendingRequest(cl, id)) return conflict("E-KNW-011");
  if (await isSharedOut(cl, id)) return conflict("E-KNW-106");
  return null;
}

async function run(cl: pg.PoolClient, id: string, x: RaiseInput): Promise<HookReply> {
  const stop = await precheck(cl, id);
  if (stop) return stop;
  const r = (await cl.query<{ r: RaiseResult }>(RAISE_SQL, [id, x.group, x.folder, x.message])).rows[0]!.r;
  if (!r.ok) return (REFUSAL[r.reason ?? "denied"] ?? forbidden)();
  const at = (await cl.query<{ created_at: Date }>(AT_SQL, [r.id])).rows[0]?.created_at ?? new Date();
  await cl.query(AUDIT_SQL, [r.state === "approved" ? "knowledge.raise.apply" : "knowledge.raise.request", r.id]);
  return {
    status: 201,
    body: { data: { id: r.id, kind: "raise", state: r.state, page_id: id, to_name: r.to_name, at: at.toISOString() } },
  };
}

/** DB の失敗の言葉 → 番号（同時に同じ頼み・フォルダの棚の合い）。ほかは null（503） */
function dbRefusal(e: unknown): HookReply | null {
  if ((e as { code?: unknown })?.code === "23505") return conflict("E-KNW-011");
  if (e instanceof Error && e.message.startsWith("KNW_FOLDER_SHELF")) return conflict("E-KNW-103");
  return null;
}

export function createRequestKnowledgeRaise(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const x = readInput(a.input);
    if ("status" in x) return x;
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, a.id!, x));
    } catch (e) {
      const known = dbRefusal(e);
      if (known) return known;
      console.error(`[knowledge] 上げるのを頼めなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
