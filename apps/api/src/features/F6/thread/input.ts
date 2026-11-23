// やり取りに書く口（K-385）の入力の整え。体の形（strict・uuid の形）は入口（op.ts と契約の schemas）が確かめる。
//   ここは本文の空の判定と、人の並びの整え（重なりを落とす・知らせる人から自分を外す）。DB の関数（app.ticket_message_post）も同じ整えをする（2 層）
//   本文は入口の normalize（NFKC と前後の空白を落とす）を通った後の字を、それ以上は落とさず・切らずに使う（D-130.4・字数の上限なし D-130.1）
import type { Row } from "@kaname/db/repository";
import { cleanString, wellFormed } from "../well-formed.js";

/** 空白だけ：JS の \s は全角の空白（U+3000）・改行・タブも含む（NFKC の後は全角の空白も半角になっている） */
const BLANK = /^\s*$/;

/** 本文が無い・空・空白だけか（文字でない物は形の誤りなので、ここでは空と見ず入口の確かめに回す） */
export function isBlankBody(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  return typeof raw === "string" && BLANK.test(raw);
}

/** 重なりを 1 つにし、並びは最初に出た順 */
export function uniqueIds(ids: readonly string[] | undefined): string[] {
  return [...new Set(ids ?? [])];
}

/** 知らせる人の並びから自分を外す（@ は本文の札なので自分も残す・⑮7） */
export function withoutMe(ids: readonly string[], me: string): string[] {
  return ids.filter((id) => id !== me);
}

export interface PostPayload {
  body: string;
  mention_member_ids: string[];
  notify_member_ids: string[];
  quote_of_id: string | null;
  // K-389：段の欄（送ったものだけ入る。DB の関数は鍵があるかで決める）
  stage_key?: string;
  stage_id?: string;
  hold_reason?: string;
  resume_condition?: string;
}

/** 書き込みと一緒に送れる段の欄（K-389・K-387 の段の組の欄から実績を除いた物） */
export const STAGE_FIELDS = ["stage_key", "stage_id", "hold_reason", "resume_condition"] as const;

/** 保留の理由・再開の条件は自由な字：K-387 の口と同じく、対にならないサロゲートは U+FFFD にして渡す（jsonb に入らず 503 にしない） */
const FREE_TEXT: readonly string[] = ["hold_reason", "resume_condition"];

/** 送られた段の欄だけを取り出す（無い欄は鍵ごと入れない） */
export function stageFieldsOf(input: Row): Partial<Pick<PostPayload, (typeof STAGE_FIELDS)[number]>> {
  return Object.fromEntries(
    STAGE_FIELDS.filter((k) => input[k] !== undefined).map((k) => [
      k,
      FREE_TEXT.includes(k) ? cleanString(input[k]) : input[k],
    ]),
  ) as Partial<Pick<PostPayload, (typeof STAGE_FIELDS)[number]>>;
}

const idList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** 入口を通った入力から、DB の関数に渡す体を作る（自分を知らせる人から外し、重なりを落とす） */
export function toPostPayload(input: Row, me: string): PostPayload {
  const quote = input["quote_of_id"];
  return {
    body: wellFormed(String(input["body"] ?? "")),
    mention_member_ids: uniqueIds(idList(input["mention_member_ids"])),
    notify_member_ids: withoutMe(uniqueIds(idList(input["notify_member_ids"])), me),
    quote_of_id: typeof quote === "string" && quote !== "" ? quote : null,
    ...stageFieldsOf(input),
  };
}
