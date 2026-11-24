// 写しの帯（K-677）：元が今の人に見える（app.kpage_visible）なら元の題名・棚の名前・フォルダ・必ず守る。
//   元が消えた・見えない（入っていないグループ・他人の自分の棚）は同じ形で gone true・ほかは空（在るかを漏らさない）。写しでないページは null
import type { CopiedFrom, PagePartCtx } from "./types.js";

const SRC_SQL = `select p.id, p.title, p.is_must,
       app.kn_shelf_name(p.scope_id, p.is_personal) as shelf_name,
       case when p.folder_id is null then '{}'::text[] else app.kn_folder_names(p.folder_id) end as folders
  from knowledge_pages p
 where p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null
   and p.state in ('draft', 'published') and app.kpage_visible(p.id)`;

const GONE: CopiedFrom = { page_id: null, title: "", shelf_name: "", folders: [], must: false, gone: true };

export async function readCopiedFrom(p: PagePartCtx): Promise<CopiedFrom | null> {
  const src = p.page.copied_from_page_id;
  if (!src) return null;
  const r = (
    await p.cl.query<{ id: string; title: string; is_must: boolean; shelf_name: string; folders: string[] }>(SRC_SQL, [
      src,
    ])
  ).rows[0];
  if (!r) return GONE;
  return { page_id: r.id, title: r.title, shelf_name: r.shelf_name, folders: r.folders, must: r.is_must, gone: false };
}
