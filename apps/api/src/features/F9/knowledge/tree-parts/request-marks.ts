// 木のページの承認待ち・断られたの印（K-676 が置いた器・K-687 が中身を差し替えた）。
//   waiting＝そのページに承認待ちの頼み（上げる・共有）がある（読める人みんな）／
//   declined＝頼んだ人本人が見ていて、断られて帯を消していない頼みがある。両方あれば waiting が先。1 文でページの並びを渡す
import type pg from "pg";

const MARKS_SQL = `select r.page_id,
       bool_or(r.state = 'pending') as waiting,
       bool_or(r.state = 'declined' and r.dismissed_at is null and r.requested_by = app.user_id()) as declined
  from knowledge_requests r
 where r.page_id = any($1::uuid[]) and r.tenant_id = app.tenant_id() and r.deleted_at is null
   and r.state in ('pending', 'declined')
 group by r.page_id`;

export async function readRequestMarks(
  cl: pg.PoolClient,
  pageIds: readonly string[],
): Promise<ReadonlyMap<string, "waiting" | "declined">> {
  if (pageIds.length === 0) return new Map();
  const rows = (await cl.query<{ page_id: string; waiting: boolean; declined: boolean }>(MARKS_SQL, [[...pageIds]]))
    .rows;
  const marks = new Map<string, "waiting" | "declined">();
  for (const r of rows) {
    if (r.waiting) marks.set(r.page_id, "waiting");
    else if (r.declined) marks.set(r.page_id, "declined");
  }
  return marks;
}
