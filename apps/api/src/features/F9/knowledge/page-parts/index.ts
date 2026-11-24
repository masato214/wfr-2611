// ページの答えの部品を全部呼んで鍵に入れる（K-677）。read.ts はここを呼ぶだけ（後ろの葉は自分のファイルを差し替え、read.ts もここも直さない）。
//   acts の並びは must → raise → share → copy → edit
import { mustActs } from "./act-must.js";
import { raiseActs } from "./act-raise.js";
import { shareActs } from "./act-share.js";
import { copyActs } from "./act-copy.js";
import { editActs } from "./act-edit.js";
import { readRequest } from "./request.js";
import { readRaiseTo } from "./raise-to.js";
import { readSharedFrom } from "./shared-from.js";
import { readCopiedFrom } from "./copied-from.js";
import { readFoot } from "./foot.js";
import type { CopiedFrom, PageAct, PageFoot, PagePartCtx, PageRequest, RaiseTo, SharedFrom } from "./types.js";

export interface PageParts {
  readonly acts: readonly PageAct[];
  readonly request: PageRequest | null;
  readonly copied_from: CopiedFrom | null;
  readonly shared_from: SharedFrom | null;
  readonly raise_to: RaiseTo | null;
  readonly foot: PageFoot;
}

/** 1 つの取引の中で順に呼ぶ（同じ client を並べて使わない） */
export async function readPageParts(p: PagePartCtx): Promise<PageParts> {
  const acts = [
    ...(await mustActs(p)),
    ...(await raiseActs(p)),
    ...(await shareActs(p)),
    ...(await copyActs(p)),
    ...(await editActs(p)),
  ];
  return {
    acts,
    request: await readRequest(p),
    copied_from: await readCopiedFrom(p),
    shared_from: await readSharedFrom(p),
    raise_to: await readRaiseTo(p),
    foot: await readFoot(p),
  };
}
