// 自分が承認できる待ちの数（K-676 が置いた器）。K-688 が中身を差し替える。この葉の間は承認待ちの表が無いので 0
import type pg from "pg";

export async function countApprovals(cl: pg.PoolClient): Promise<number> {
  void cl;
  return 0;
}
