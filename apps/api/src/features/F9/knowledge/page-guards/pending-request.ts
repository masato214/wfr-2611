// 承認待ちの頼みがあるか（K-681 が置いた器・K-687 が中身を差し替えた）。knowledge_requests に page_id ＝そのページ・
//   state = 'pending'・消していない行があれば true（上げる・共有を問わない）。行の守りは承認待ちの頼みをページが見える人に見せる。
//   K-685 も setKnowledgeMust の E-KNW-011 に使う
import type pg from "pg";

const PENDING_SQL = `select exists (select 1 from knowledge_requests r
  where r.page_id = $1 and r.tenant_id = app.tenant_id() and r.state = 'pending' and r.deleted_at is null) as hit`;

export async function hasPendingRequest(cl: pg.PoolClient, pageId: string): Promise<boolean> {
  const r = (await cl.query<{ hit: boolean }>(PENDING_SQL, [pageId])).rows[0];
  return r?.hit === true;
}
