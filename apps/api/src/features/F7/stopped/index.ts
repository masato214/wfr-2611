// 止まった AI の仕事（K-485）の口の振る舞い：自分で直す（takeover.ts）と、読む 2 つの口への止まった理由の種類の足し（view.ts）。
//   種類の表は reason-kind.ts の 1 か所。口の登録は hooks/stopped.ts（K-326）
export { createTakeover } from "./takeover.js";
export { stoppedViewHooks } from "./view.js";
export { REASON_KIND_ERROR, REASON_KINDS, reasonKindOf, withReasonKind, type ReasonKind } from "./reason-kind.js";
