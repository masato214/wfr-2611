// 帯の操作「必ず守る（must-on・must-off）」（K-677 が置いた器）。K-685 が中身を差し替える。この葉の間は空
import type { PageAct, PagePartCtx } from "./types.js";

export async function mustActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  void p;
  return [];
}
