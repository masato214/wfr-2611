// ほかのグループに共有しているか（K-681 が置いた器）。K-719 が中身を差し替える（共有の表 knowledge_shares は K-689。
//   ended_at が空の行がページ自身か上のフォルダにあれば true）。この葉の間は共有の表が無いので常に false
import type pg from "pg";

export async function isSharedOut(cl: pg.PoolClient, pageId: string): Promise<boolean> {
  void cl;
  void pageId;
  return false;
}
