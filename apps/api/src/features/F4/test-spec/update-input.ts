// 直す入力の取り出し（K-435・updateTestSpec）。入口（op.ts）が契約の strict な形（version と、checked か title のどちらか 1 つ）で確かめ済みの体から、
//   DB の関数 app.test_spec_update に渡す p を作る。確かめは契約と DB の関数が持つ（外れの答えの欄は version・checked・title）。
//   id は道（:id）から決め、体に入れさせない（入口が知らない欄を 422 にする）
import type { Row } from "@kaname/db/repository";

/** DB の関数に渡す欄（省かれた欄は渡さない） */
export interface UpdateInput {
  version?: unknown;
  checked?: unknown;
  title?: unknown;
}

export function parseUpdate(input: Row): UpdateInput {
  const out: UpdateInput = {};
  if (input["version"] !== undefined) out.version = input["version"];
  if (input["checked"] !== undefined) out.checked = input["checked"];
  if (input["title"] !== undefined) out.title = input["title"];
  return out;
}
