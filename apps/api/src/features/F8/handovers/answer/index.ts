// 答える口の振り分け（answerTicketHandover・PATCH /ticket_handovers/:id・入口の行の言葉は recipient＝app.handover_answerer(id, 呼んだ人, false)・K-401）。
//   1 入力 → 2 共通の確かめ（無い 404・答える人でない 403・もう決まった 409）→ 3 上へ上げるは 409・E-HND-001、ほかは種類ごとのファイルへ。
//   種類ごとのファイルは各葉（K-403 pass・K-408 offer・K-409 distribute・K-410 グループ宛て）が本物にする。振り分けはこのファイルだけが書く
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import type { HandoverDeps } from "../deps.js";
import { answerGate } from "../gate.js";
import { isReply, parseAnswer } from "../input.js";
import { notReady, type AnswerKind } from "../kinds.js";
import { answerDistribute } from "./distribute.js";
import { answerDistributeGroup } from "./distribute-group.js";
import { answerOffer } from "./offer.js";
import { answerPass } from "./pass.js";

const route = (kind: string, target: string): AnswerKind | null =>
  kind === "pass"
    ? answerPass
    : kind === "offer"
      ? answerOffer
      : kind === "distribute"
        ? target === "scope"
          ? answerDistributeGroup
          : answerDistribute
        : null;

export function answerHandover(d: HandoverDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const input = parseAnswer(a.input as Record<string, unknown>);
    if (isReply(input)) return input;
    const handoverId = a.id ?? "";
    const gate = await answerGate(d, a, handoverId);
    if (isReply(gate)) return gate;
    const kind = route(gate.kind, gate.target);
    if (!kind) return notReady(); // 上へ上げる（段 9 では作らない・D-148.1）
    return kind({ d, a, handoverId, input, gate });
  };
}
