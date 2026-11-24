// ナレッジの本文を確かめて text を作る（K-675）。口が画面から受けた doc を、送られたままの形で確かめる（直さない）。
//   text は画面から受けず、doc から口が作る（探す・AI が読む・字数の上限はこの text で数える）
import { toTicketBody, validateDoc, type TicketBody } from "@kaname/contracts";

export type DocInput = { ok: true; body: TicketBody } | { ok: false; message: string };

/** doc を確かめ、通れば { doc, text }。外れは理由の文（ログに本文を出さない） */
export function parseDocInput(input: unknown): DocInput {
  const r = validateDoc(input);
  if (!r.ok) return { ok: false, message: r.reason };
  return { ok: true, body: toTicketBody(r.doc) };
}
