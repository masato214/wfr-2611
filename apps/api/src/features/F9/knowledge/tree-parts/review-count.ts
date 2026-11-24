// 見直すページの数（K-676 が置いた器）。K-695 が中身を差し替える。この葉の間は見直しの決めが無いので 0
import type pg from "pg";

export async function countReview(cl: pg.PoolClient): Promise<number> {
  void cl;
  return 0;
}
