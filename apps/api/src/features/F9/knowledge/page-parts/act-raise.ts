// 帯の操作「上げる（raise）」（K-677 が置いた器・K-687 が中身を差し替えた）。
//   書ける人・公開済み・承認待ちでなく・上げる先がある（readRaiseTo が null でない）ときだけ ["raise"]
import { readRaiseTo } from "./raise-to.js";
import type { PageAct, PagePartCtx } from "./types.js";

export async function raiseActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  return (await readRaiseTo(p)) ? ["raise"] : [];
}
