// 上げる小窓の上げる先・承認する人（K-677 が置いた器・K-687 が中身を差し替えた）。
//   上げられるページ（書ける人・公開済み・承認待ちでない・会社の棚でない）だけ。自分の棚のページは呼んだ人の主の所属（members.scope_id）の
//   グループ（会社のいちばん上なら null）・グループの棚のページは会社。approver_names は先の承認する人から呼んだ人を除いた表示名（コードポイント順）
import { hasPendingRequest } from "../page-guards/pending-request.js";
import type { PagePartCtx, RaiseTo } from "./types.js";

const MAIN_GROUP_SQL = `select s.id from members m join scopes s on s.id = m.scope_id
 where m.id = $1 and m.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null`;
const TARGET_SQL = `select app.kn_shelf_name($1, false) as name,
       coalesce((select array_agg(m.display_name order by m.display_name collate "C", m.id)
                   from members m where m.id in (select app.kn_approvers_of($1)) and m.id <> $2), '{}') as names`;

/** 上げる先の scope（上げられないページは null） */
async function targetOf(p: PagePartCtx): Promise<{ scope: string; shelf: "group" | "company" } | null> {
  if (!p.writable || p.page.state !== "published" || p.shelf.kind === "company") return null;
  if (await hasPendingRequest(p.cl, p.page.id)) return null;
  if (p.shelf.kind === "group") {
    const co = (await p.cl.query<{ id: string | null }>("select app.kn_company_scope() as id")).rows[0]?.id;
    return co ? { scope: co, shelf: "company" } : null;
  }
  const g = (await p.cl.query<{ id: string }>(MAIN_GROUP_SQL, [p.memberId])).rows[0]?.id;
  return g ? { scope: g, shelf: "group" } : null;
}

export async function readRaiseTo(p: PagePartCtx): Promise<RaiseTo | null> {
  const t = await targetOf(p);
  if (!t) return null;
  const r = (await p.cl.query<{ name: string | null; names: string[] }>(TARGET_SQL, [t.scope, p.memberId])).rows[0];
  return {
    shelf: t.shelf,
    shelf_name: r?.name ?? "",
    group_id: t.shelf === "group" ? t.scope : null,
    approver_names: r?.names ?? [],
  };
}
