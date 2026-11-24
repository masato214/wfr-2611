// 渡す口の振り分け（createTicketHandover・POST /tickets/:id/handovers・入口の行の言葉は write＝app.ticket_writable(id)・K-401）。
//   1 入力（上へ上げるは契約の外の種類・422・E-HND-001）→ 2 共通の確かめ（DB の 1 取引・読むだけ）→ 3 種類ごとのファイルへ。
//   種類ごとのファイルは各葉（K-402 pass・K-408 offer・K-409 distribute・K-410 グループに配る）が本物にする。振り分けはこのファイルだけが書く
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import type { HandoverDeps } from "../deps.js";
import { createGate } from "../gate.js";
import { isReply, parseCreate } from "../input.js";
import type { CreateKind } from "../kinds.js";
import { createDistribute } from "./distribute.js";
import { createDistributeGroup } from "./distribute-group.js";
import { createOffer } from "./offer.js";
import { createPass } from "./pass.js";

/** 種類 → 種類ごとのファイル（配るは to_scope_id があればグループに配る） */
const route = (kind: string, toScope: string | null): CreateKind =>
  kind === "pass" ? createPass : kind === "offer" ? createOffer : toScope ? createDistributeGroup : createDistribute;

export function createHandover(d: HandoverDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const input = parseCreate(a.input as Record<string, unknown>);
    if (isReply(input)) return input;
    const ticketId = a.id ?? "";
    const gate = await createGate(d, a, ticketId, input);
    if (isReply(gate)) return gate;
    return route(input.kind, input.to_scope_id)({ d, a, ticketId, input, gate });
  };
}
