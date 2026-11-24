// 題名の下の帯（上げる・共有の頼みの承認待ち・断られた）（K-677 が置いた器）。K-687 が中身を差し替える。この葉の間は頼みの表が無いので null
import type { PagePartCtx, PageRequest } from "./types.js";

export async function readRequest(p: PagePartCtx): Promise<PageRequest | null> {
  void p;
  return null;
}
