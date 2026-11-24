// 帯の操作「直す」（K-677）：ページに書ける人（app.kpage_writable・下書きは持ち主）だけに edit
import type { PageAct, PagePartCtx } from "./types.js";

export async function editActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  return p.writable ? ["edit"] : [];
}
