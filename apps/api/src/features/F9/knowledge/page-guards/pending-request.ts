// 承認待ちの頼みがあるか（K-681 が置いた器）。K-687 が中身を差し替える（knowledge_requests に state = 'pending' の行があれば true）。
//   この葉の間は頼みの表が無いので常に false。K-685 も setKnowledgeMust の E-KNW-011 に使う
import type pg from "pg";

export async function hasPendingRequest(cl: pg.PoolClient, pageId: string): Promise<boolean> {
  void cl;
  void pageId;
  return false;
}
