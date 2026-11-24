// 足元の 1 行（K-677）：最後に書き終えた版の人（published_by の表示名）・時刻・版の番号（ページの current_version）・AI がこの 30 日に開いた数。
//   まだ書き終えていないページは人が null・時刻はページの更新の時刻・版は 0。時刻は ISO 8601（UTC・Z）
import type { PageFoot, PagePartCtx } from "./types.js";

const FOOT_SQL = `select (select m.display_name from members m where m.id = v.published_by) as name, v.published_at,
       app.kn_page_ai_opened_30d($1) as ai
  from (select 1) x
  left join lateral (select pv.published_by, pv.published_at from knowledge_page_versions pv
                      where pv.page_id = $1 and pv.tenant_id = app.tenant_id() and pv.kind = 'published' and pv.deleted_at is null
                      order by pv.version desc limit 1) v on true`;

export async function readFoot(p: PagePartCtx): Promise<PageFoot> {
  const r = (
    await p.cl.query<{ name: string | null; published_at: Date | null; ai: number | null }>(FOOT_SQL, [p.page.id])
  ).rows[0];
  const ai = Number(r?.ai ?? 0);
  if (p.page.state === "draft" || !r?.published_at) {
    return { last_editor_name: null, last_edited_at: p.page.updated_at.toISOString(), version: 0, ai_opened_30d: ai };
  }
  return {
    last_editor_name: r.name ?? null,
    last_edited_at: r.published_at.toISOString(),
    version: p.page.current_version,
    ai_opened_30d: ai,
  };
}
