// 帯の操作「写す（copy・自分の棚でない公開済みのページ）」（K-677 が置いた器）。K-690 が中身を差し替える。この葉の間は空
import type { PageAct, PagePartCtx } from "./types.js";

export async function copyActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  void p;
  return [];
}
