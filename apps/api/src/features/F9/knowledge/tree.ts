// ナレッジの木を読む口（K-676・契約の口 getKnowledgeTree・GET /api/v1/knowledge/tree）。読むだけ（DB に書かない・お知らせも AI も呼ばない）。
//   棚は 会社（いちばん上のグループ）・グループ（自分の入っている物・管理者でも入っていない物は出ない）・自分（持ち主が自分）の 3 つ。
//   守りは 2 重：行の守り（K-674）の上で読み、口の文でも棚と持ち主の等号で絞る（行ごとに見える・見えないの関数を呼ばない）。
//   取引は 1 つ（withTenant）・文は 5〜8（棚の材料・フォルダ・ページ・印・管理の数 2・共有）。木は 5,000 ノードまで（フォルダを先に）。
//   承認待ちの印・共有のグループ・管理の数は tree-parts/ の器（後ろの葉が中身を差し替える）。ログに題名・名前を出さない
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { unavailable } from "./reply.js";
import { treeMark, type TreeNode } from "./shape.js";
import { readRequestMarks } from "./tree-parts/request-marks.js";
import { readSharedRows, type SharedGroupRows } from "./tree-parts/shared-rows.js";
import { countApprovals } from "./tree-parts/approvals-count.js";
import { countReview } from "./tree-parts/review-count.js";

/** 木で返すノード（フォルダとページの合計）の上限 */
export const TREE_MAX = 5000;
const TONES = ["teal", "plum", "amber"] as const;
type Tone = (typeof TONES)[number];

/** フォルダの読み行 */
export interface FolderRow {
  readonly id: string;
  readonly name: string;
  readonly parent_folder_id: string | null;
  readonly scope_id: string;
  readonly is_personal: boolean;
}
/** ページの読み行 */
export interface PageRow {
  readonly id: string;
  readonly title: string;
  readonly is_must: boolean;
  readonly folder_id: string | null;
  readonly scope_id: string;
  readonly is_personal: boolean;
  readonly is_draft: boolean;
  readonly copied: boolean;
}
interface GroupInfo {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly idx: number;
  readonly mine: boolean;
  readonly writable: boolean;
  readonly manager: boolean;
}
interface Basis {
  readonly company_name: string;
  readonly company_scope: string | null;
  readonly company_writable: boolean;
  readonly is_admin: boolean;
  readonly groups: readonly GroupInfo[];
}

/** ① 今の人の棚の材料（1 文）。グループの番号は会社の中の作った順（消したグループも数える＝色が人やグループの消しで変わらない） */
const BASIS_SQL = `with gs as (
  select s.id, s.name, nullif(s.ticket_prefix, '') as code, s.deleted_at,
         (row_number() over (order by s.created_at, s.id) - 1)::int as idx
    from scopes s where s.tenant_id = app.tenant_id() and s.parent_id is not null
), mine as (select unnest(app.kn_my_groups()) as id)
select (select t.name from tenants t where t.id = app.tenant_id()) as company_name,
       app.kn_company_scope() as company_scope,
       coalesce(app.kn_shelf_writable(app.kn_company_scope(), false, null), false) as company_writable,
       coalesce(app.is_admin(app.user_id()), false) as is_admin,
       coalesce((select json_agg(json_build_object(
                  'id', g.id, 'name', g.name, 'code', g.code, 'idx', g.idx,
                  'mine', g.id in (select id from mine),
                  'writable', g.id in (select id from mine) and app.kn_shelf_writable(g.id, false, null),
                  'manager', g.id in (select id from mine) and app.kn_group_manager(app.user_id(), g.id))
                  order by g.idx)
                 from gs g where g.deleted_at is null), '[]'::json) as groups`;

/** 棚の条件：会社の棚か入っているグループ（自分の棚でない）・または自分が持ち主の自分の棚 */
const SHELF_WHERE = `x.tenant_id = app.tenant_id() and x.deleted_at is null
   and ((not x.is_personal and (x.scope_id = $1::uuid or x.scope_id = any($2::uuid[])))
        or (x.is_personal and x.owner_member_id = app.user_id()))`;
/** ② フォルダ */
const FOLDERS_SQL = `select x.id, x.name, x.parent_folder_id, x.scope_id, x.is_personal from knowledge_folders x
 where ${SHELF_WHERE}
 order by x.position, x.name collate "C", x.id limit $3`;
/** ③ ページ（公開済みと、自分の下書きだけ） */
const PAGES_SQL = `select x.id, x.title, x.is_must, x.folder_id, x.scope_id, x.is_personal,
       (x.state = 'draft') as is_draft, (x.copied_from_page_id is not null) as copied from knowledge_pages x
 where ${SHELF_WHERE}
   and (x.state = 'published' or (x.state = 'draft' and x.owner_member_id = app.user_id()))
 order by x.position, x.title collate "C", x.id limit $3`;

type Marks = ReadonlyMap<string, "waiting" | "declined">;

/** フォルダの親子に組み立てる（並びは読んだ順のまま。親が見つからない物は棚の直下）。同じ親の中は フォルダ → ページ */
export function buildNodes(folders: readonly FolderRow[], pages: readonly PageRow[], marks: Marks): TreeNode[] {
  const known = new Set(folders.map((f) => f.id));
  const kids = new Map<string | null, { folders: FolderRow[]; pages: PageRow[] }>();
  const slot = (k: string | null) => {
    const s = kids.get(k) ?? { folders: [], pages: [] };
    kids.set(k, s);
    return s;
  };
  for (const f of folders)
    slot(f.parent_folder_id && known.has(f.parent_folder_id) ? f.parent_folder_id : null).folders.push(f);
  for (const p of pages) slot(p.folder_id && known.has(p.folder_id) ? p.folder_id : null).pages.push(p);
  const at = (k: string | null): TreeNode[] => {
    const s = kids.get(k);
    if (!s) return [];
    const fs = s.folders.map((f): TreeNode => ({ kind: "folder", id: f.id, name: f.name, children: at(f.id) }));
    const ps = s.pages.map((p): TreeNode => ({
      kind: "page",
      id: p.id,
      title: p.title,
      must: p.is_must,
      mark: treeMark({
        draft: p.is_draft,
        copied: p.copied,
        waiting: marks.get(p.id) === "waiting",
        declined: marks.get(p.id) === "declined",
      }),
    }));
    return [...fs, ...ps];
  };
  return at(null);
}

const toneOf = (idx: number): Tone => TONES[((idx % 3) + 3) % 3]!;
const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

interface Loaded {
  readonly basis: Basis;
  readonly folders: readonly FolderRow[];
  readonly pages: readonly PageRow[];
  readonly truncated: boolean;
  readonly marks: Marks;
  readonly counts: { approvals: number; review: number } | null;
  readonly shared: readonly SharedGroupRows[];
}

async function load(appPool: pg.Pool, ctx: TenantContext): Promise<Loaded> {
  return withTenant(appPool, ctx, async (cl) => {
    const basis = (await cl.query<Basis>(BASIS_SQL)).rows[0]!;
    const myGroups = basis.groups.filter((g) => g.mine).map((g) => g.id);
    const params = [basis.company_scope, myGroups, TREE_MAX + 1];
    const allFolders = (await cl.query<FolderRow>(FOLDERS_SQL, params)).rows;
    const allPages = (await cl.query<PageRow>(PAGES_SQL, params)).rows;
    const folders = allFolders.slice(0, TREE_MAX);
    const pages = allPages.slice(0, TREE_MAX - folders.length);
    const truncated = allFolders.length + allPages.length > TREE_MAX;
    const marks = await readRequestMarks(
      cl,
      pages.map((p) => p.id),
    );
    const manages = basis.is_admin || basis.groups.some((g) => g.manager);
    const counts = manages ? { approvals: await countApprovals(cl), review: await countReview(cl) } : null;
    const shared = await readSharedRows(cl);
    return { basis, folders, pages, truncated, marks, counts, shared };
  });
}

/** 読んだ物を棚ごとの木にする */
function toTree(l: Loaded): Record<string, unknown> {
  const { basis } = l;
  const pick = (f: (r: { scope_id: string; is_personal: boolean }) => boolean) =>
    buildNodes(l.folders.filter(f), l.pages.filter(f), l.marks);
  const idxOf = new Map(basis.groups.map((g) => [g.id, g.idx]));
  const mine = basis.groups
    .filter((g) => g.mine)
    .map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      tone: toneOf(g.idx),
      shared: false,
      nodes: pick((r) => !r.is_personal && r.scope_id === g.id),
    }));
  const shared = l.shared.map((s) => ({
    id: s.group_id,
    name: s.group_name,
    code: s.group_code,
    tone: toneOf(idxOf.get(s.group_id) ?? 0),
    shared: true,
    nodes: buildNodes(s.folders, s.pages, l.marks),
  }));
  return {
    company_name: basis.company_name,
    company_nodes: pick((r) => !r.is_personal && r.scope_id === basis.company_scope),
    groups: [...mine, ...shared],
    my_nodes: pick((r) => r.is_personal),
    can_write: {
      company: basis.company_writable,
      group_ids: basis.groups.filter((g) => g.writable).map((g) => g.id),
      me: true,
    },
    admin_counts: l.counts,
    truncated: l.truncated,
  };
}

export function createGetKnowledgeTree(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let l: Loaded;
    try {
      l = await load(appPool, a.ctx);
    } catch (e) {
      console.error(`[knowledge] 木を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (l.truncated) console.warn(`[knowledge] 木を ${TREE_MAX} で切った`);
    return { status: 200, body: { data: toTree(l) } };
  };
}
