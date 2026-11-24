// 帯の操作「必ず守る（must-on・must-off）」（K-677 が置いた器・K-685 が中身を差し替えた）。
//   書ける人で、公開済みで、承認待ちの頼みが無いときだけ出す。印が付いていれば must-off・無ければ must-on。
//   本文が長くて付けられないページ（must_blocked: too_long）にも must-on を出す（画面が押せない形にして訳を文にする・押せば口が 409 E-KNW-061）
import { hasPendingRequest } from "../page-guards/pending-request.js";
import type { PageAct, PagePartCtx } from "./types.js";

export async function mustActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  if (!p.writable || p.page.state !== "published") return [];
  if (await hasPendingRequest(p.cl, p.page.id)) return [];
  return [p.page.is_must ? "must-off" : "must-on"];
}
