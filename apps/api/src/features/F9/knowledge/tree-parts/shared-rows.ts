// 自分の入っていないグループから、自分のグループに共有された物（K-676 が置いた器）。K-719 が中身を差し替える（共有の表は K-689）。
//   この葉の間は共有の表が無いので空の配列
import type pg from "pg";
import type { FolderRow, PageRow } from "../tree.js";

export interface SharedGroupRows {
  readonly group_id: string;
  readonly group_name: string;
  readonly group_code: string | null;
  readonly folders: readonly FolderRow[];
  readonly pages: readonly PageRow[];
}

export async function readSharedRows(cl: pg.PoolClient): Promise<readonly SharedGroupRows[]> {
  void cl;
  return [];
}
