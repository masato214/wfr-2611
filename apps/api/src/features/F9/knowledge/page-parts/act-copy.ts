// 帯の操作「写す（copy）」（K-677 が置いた器・K-690 が中身を差し替えた）。
//   公開済みで、自分の棚のページでないとき copy を出す（写すのは読める人の権利：書ける人・読むだけの人・共有先の人のだれにも）。
//   書き終えていないページ・自分の棚のページ（自分の写しも）には出さない
import type { PageAct, PagePartCtx } from "./types.js";

export async function copyActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  if (p.page.state !== "published") return [];
  if (p.shelf.kind === "me" || p.page.is_personal) return [];
  return ["copy"];
}
