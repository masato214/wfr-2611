// ページを動かす・消す前の守りの順の正本（K-681）。中の確かめは後ろの葉が自分のファイルを差し替える（ここは差し替えない）。
//   動かす：承認待ちの頼み（E-KNW-011）だけ。消す：011 → 必ず守る（E-KNW-050）→ 共有している（E-KNW-051）の順で最初に当たった番号
import type pg from "pg";
import { hasPendingRequest } from "./pending-request.js";
import { isSharedOut } from "./shared.js";

export interface GuardPage {
  readonly id: string;
  readonly is_must: boolean;
}

export async function moveBlocker(cl: pg.PoolClient, page: GuardPage): Promise<"E-KNW-011" | null> {
  return (await hasPendingRequest(cl, page.id)) ? "E-KNW-011" : null;
}

export async function deleteBlocker(
  cl: pg.PoolClient,
  page: GuardPage,
): Promise<"E-KNW-011" | "E-KNW-050" | "E-KNW-051" | null> {
  if (await hasPendingRequest(cl, page.id)) return "E-KNW-011";
  if (page.is_must) return "E-KNW-050";
  if (await isSharedOut(cl, page.id)) return "E-KNW-051";
  return null;
}
