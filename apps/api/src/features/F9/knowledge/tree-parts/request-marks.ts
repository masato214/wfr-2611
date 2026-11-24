// 木のページの承認待ち・断られたの印（K-676 が置いた器）。K-687（頼みの置き場を作る葉）が中身を差し替える。
//   承認待ち（waiting）・断られて帯を消していない（declined）頼みのあるページの id → 印。この葉の間は頼みの表が無いので空
import type pg from "pg";

export async function readRequestMarks(
  cl: pg.PoolClient,
  pageIds: readonly string[],
): Promise<ReadonlyMap<string, "waiting" | "declined">> {
  void cl;
  void pageIds;
  return new Map();
}
