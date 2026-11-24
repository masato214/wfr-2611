// 帯の操作「上げる（raise・承認待ちの間は返さない）」（K-677 が置いた器）。K-687 が中身を差し替える。この葉の間は空
import type { PageAct, PagePartCtx } from "./types.js";

export async function raiseActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  void p;
  return [];
}
