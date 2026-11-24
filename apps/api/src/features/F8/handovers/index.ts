// 段 9（F8 渡す・配る）の口の置き場（K-401）。渡す・答えるの振り分けと、渡す前の下見・決まりを読むの 4 口。
//   足す口（一覧・取り消す・催促する・引き取る）は、その葉（K-405・K-406・K-410）が自分の hooks のファイルを作る
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { answerHandover } from "./answer/index.js";
import { createHandover } from "./create/index.js";
import type { HandoverDeps } from "./deps.js";
import { previewHandover } from "./preview.js";
import { listHandoverRules } from "./rules.js";

export type { HandoverDeps } from "./deps.js";

export interface HandoverFeature {
  create: (a: HookArgs) => Promise<HookReply>;
  answer: (a: HookArgs) => Promise<HookReply>;
  preview: (a: HookArgs) => Promise<HookReply>;
  rules: (a: HookArgs) => Promise<HookReply>;
}

export function handoverFeature(d: HandoverDeps): HandoverFeature {
  return {
    create: createHandover(d),
    answer: answerHandover(d),
    preview: previewHandover(d),
    rules: listHandoverRules(d),
  };
}
