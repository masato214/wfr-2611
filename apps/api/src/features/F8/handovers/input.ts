// 渡す口・答える口の入力の作り直し（K-401）。入口（op.ts）が契約の strict な形（知らない欄・kind と decision の値・uuid の形）を先に確かめ、
//   ここでは契約に書けない決まりを見る：上へ上げるは段 9 では作らない・種類ごとの欄の組み合わせ・理由の空・返事の期限の形と時刻・切り替えの形・別の人にする。
//   文の欄（理由・お願い・断る理由）に上限は置かない（D-130.1・守りは送る量 1MB）。NUL（U+0000）を含む文は 422（黙って取り除かない・answer=c8b3f4c3aef8）、ほかの制御文字（タブ・改行・復帰を除く）だけを取り除き、
//   空かどうかは前後の空白（全角の空白も）を落として見る
import { isUuid } from "@kaname/contracts";
import type { HookReply } from "../../../contract/deps.js";
import { fromCatalog, invalid } from "./errors.js";
import type { AnswerInput, CreateInput } from "./kinds.js";

type Row = Record<string, unknown>;

/** NUL 以外の制御文字（タブ・改行・復帰を除く）を落とす（NUL は先に断る） */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** NUL（U+0000）を含む文字列か */
const hasNul = (v: unknown): boolean => typeof v === "string" && v.includes("\u0000");
const nulError = (field: string): HookReply => invalid(field, "NUL（U+0000）は含められません");
export const cleanText = (v: unknown): string => (typeof v === "string" ? v.replace(CONTROL, "") : "");
/** 前後の空白（全角の空白・改行・タブも）を落として空か */
export const isBlank = (s: string): boolean => s.trim() === ""; // trim は全角の空白（U+3000）・改行・タブも落とす

/** 時差つきの ISO 8601（2026-11-23T18:00:00+09:00・Z も可・秒は必須＝契約の date-time と同じ） */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const SWITCH_BOOL_KEYS = new Set(["children", "links", "group"]);

/** 切り替えの形：object で、鍵は children・links・group（真偽）と axes（uuid の並び）だけ。違えば null */
export function parseSwitch(v: unknown): Record<string, unknown> | null {
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) return null;
  for (const [k, x] of Object.entries(v as Row)) {
    if (SWITCH_BOOL_KEYS.has(k)) {
      if (typeof x !== "boolean") return null;
    } else if (k === "axes") {
      if (!Array.isArray(x) || !x.every((a) => typeof a === "string" && isUuid(a))) return null;
    } else return null;
  }
  return { ...(v as Row) };
}

const switchError = (): HookReply => invalid("switch", "children・links・group（真偽）と axes（uuid の並び）だけ");
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** 渡すの入力。断る答えか、作り直した入力 */
export function parseCreate(input: Row, now: number = Date.now()): HookReply | CreateInput {
  const kind = input["kind"];
  if (kind === "escalate") return fromCatalog("E-HND-001", 422, { field: "kind" });
  if (kind !== "pass" && kind !== "offer" && kind !== "distribute")
    return invalid("kind", "pass・offer・distribute のどれか");
  const to = str(input["to_member_id"]);
  const toScope = str(input["to_scope_id"]);
  const due = str(input["reply_due"]);
  const replaces = str(input["replaces"]);
  if (to && toScope) return invalid("to_member_id", "人とグループの両方は選べない");
  if (kind === "offer") {
    if (to) return invalid("to_member_id", "申し出は今の担当者に出す（相手は選ばない）");
    if (toScope) return invalid("to_scope_id", "申し出は今の担当者に出す（グループは選ばない）");
    if (due) return invalid("reply_due", "申し出に返事の期限は付けない");
  }
  if (kind === "pass" && toScope) return invalid("to_scope_id", "引き継いでもらうは人を選ぶ");
  if (replaces !== null) {
    if (!isUuid(replaces)) return invalid("replaces", "uuid");
    if (kind !== "pass") return invalid("replaces", "別の人にするのは引き継いでもらうだけ");
  }
  for (const f of ["reason", "ask"]) if (hasNul(input[f])) return nulError(f);
  const reason = cleanText(input["reason"]);
  if (isBlank(reason)) return fromCatalog("E-HND-007", 422, { field: "reason" });
  if (due !== null) {
    if (!ISO_WITH_ZONE.test(due) || Number.isNaN(Date.parse(due)))
      return invalid("reply_due", "時差つきの日時（ISO 8601）");
    if (Date.parse(due) <= now) return fromCatalog("E-HND-008", 409); // 時刻で決まる断り（今より後でない）＝今の状態ではできない
  }
  const sw = parseSwitch(input["switch"]);
  if (sw === null) return switchError();
  const ask = cleanText(input["ask"]);
  return {
    kind,
    to_member_id: to,
    to_scope_id: toScope,
    reason,
    ask: isBlank(ask) ? null : ask,
    reply_due: due,
    switch: sw,
    notify_managers: input["notify_managers"] === true,
    replaces,
  };
}

/** 答えるの入力。断る答えか、作り直した入力 */
export function parseAnswer(input: Row): HookReply | AnswerInput {
  const decision = input["decision"];
  if (decision !== "accept" && decision !== "decline") return invalid("decision", "accept・decline のどちらか");
  if (hasNul(input["decline_reason"])) return nulError("decline_reason");
  const reason = cleanText(input["decline_reason"]);
  if (decision === "decline" && isBlank(reason)) return fromCatalog("E-HND-007", 422, { field: "decline_reason" });
  const raw = input["switch"];
  const sw = raw === undefined || raw === null ? null : parseSwitch(raw);
  if (raw !== undefined && raw !== null && sw === null) return switchError();
  return { decision, decline_reason: decision === "decline" ? reason : null, switch: sw };
}

/** 作り直した入力か（断る答えでないか） */
export const isReply = (v: unknown): v is HookReply =>
  typeof v === "object" && v !== null && "status" in v && "body" in v;
