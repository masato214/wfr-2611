// 共有された側の帯（K-677 が置いた器）。K-719 が中身を差し替える（共有の表は K-689）。この葉の間は null
import type { PagePartCtx, SharedFrom } from "./types.js";

export async function readSharedFrom(p: PagePartCtx): Promise<SharedFrom | null> {
  void p;
  return null;
}
