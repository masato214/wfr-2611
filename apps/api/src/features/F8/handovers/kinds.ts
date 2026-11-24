// 種類ごとのファイルの約束（K-401）。振り分け（create/index.ts・answer/index.ts）が共通の確かめの後に、種類ごとの 1 ファイルを呼ぶ。
//   各葉（K-402 pass・K-403 答える pass・K-408 申し出・K-409 配る・K-410 グループに配る）は自分の 1 ファイルだけを本物にする。
//   名前と形を変えるときは K-402〜K-410 の md と試験の頭を一緒に直す
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HandoverDeps } from "./deps.js";
import { fromCatalog } from "./errors.js";

export interface CreateInput {
  kind: "pass" | "offer" | "distribute";
  to_member_id: string | null;
  to_scope_id: string | null;
  reason: string;
  ask: string | null;
  reply_due: string | null;
  switch: Record<string, unknown>;
  notify_managers: boolean;
  replaces: string | null;
}
export interface GateOk {
  kind: string;
  ticket: { id: string; number: string; title: string; scope_id: string; assignee_member_id: string };
  receiver: string | null;
  switch: { children: boolean; links: boolean; group: boolean; axes: string[] };
}
export interface CreateCtx {
  d: HandoverDeps;
  a: HookArgs;
  ticketId: string;
  input: CreateInput;
  gate: GateOk;
}
export type CreateKind = (c: CreateCtx) => Promise<HookReply>;
export interface AnswerInput {
  decision: "accept" | "decline";
  decline_reason: string | null;
  switch: Record<string, unknown> | null;
}
export interface AnswerGateOk {
  kind: string;
  target: "member" | "scope";
  ticket_id: string;
  from_member_id: string;
  to_member_id: string | null;
  to_scope_id: string | null;
}
export interface AnswerCtx {
  d: HandoverDeps;
  a: HookArgs;
  handoverId: string;
  input: AnswerInput;
  gate: AnswerGateOk;
}
export type AnswerKind = (c: AnswerCtx) => Promise<HookReply>;
/** 種類の葉が入るまで・上へ上げる渡しへの答え：今の状態ではできない（409・E-HND-001）。形の誤りではない（契約の形は kind を 3 つに絞る） */
export const notReady = (): HookReply => fromCatalog("E-HND-001", 409);
/** 種類ごとのファイルの空の形（各葉が自分の 1 ファイルを本物にするまで）。空の形に関数を 8 つ書くと、使われない関数として coverage の閾値（関数 80%）を割るので、ここの 1 つを共有する */
export const notReadyKind = async (): Promise<HookReply> => notReady();
