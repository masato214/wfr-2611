// チケットを直す口（updateTicket・PATCH /api/v1/tickets/:id）の「欄ごとの処理の表」（K-387）。
//   同じ口を 2 つの hooks のファイルが持つと口の登録（registry）が止めるので、口は 1 つ（hooks/ticket-update.ts）にして、
//   欄の組（どの欄を受け、どう書くか）をこの表に足す形にする。後の段（段 8 の K-67 の残り・F7）は組のファイルを作り、下の並びに 1 行足す。
//   表のどの組にも無い欄は、口の前処理が 422 E-VAL-018（まだ変えられない・黙って無視しない・D-128.152）で断る（update.ts）
import type pg from "pg";
import type { Row } from "@kaname/db/repository";
import type { HookReply } from "../../contract/deps.js";
import { ticketFieldsFields } from "../F4/ticket-fields/fields.js";
import { ticketSortFields } from "../F4/ticket-sort/fields.js";
import { progressFields } from "../F6/progress/fields.js";

/** 組の答え：書けた（答えの data に足す鍵）か、断った（その答えをそのまま返し、同じ処理で書いた物は全部戻す） */
export type GroupResult = { ok: true; data: Row } | { ok: false; reply: HookReply };

/** 欄の組。apply は送られた欄のうち fields に入る物だけを受け、口の 1 つの処理（withTenant）の中で書く。
 *  inputIssues は前処理で、契約に書ける形の決まり（422）だけを DB を引く前に断る（DB の中身で決まる断りは apply の 404・409） */
export interface TicketFieldGroup {
  name: string;
  fields: readonly string[];
  inputIssues?: (raw: Row) => HookReply | null;
  apply: (cl: pg.PoolClient, ticketId: string, input: Row) => Promise<GroupResult>;
}

/** 欄の組の並び（この順に apply を呼ぶ）。K-387：段・実績・保留（F6/progress）／K-440：優先度・親（F4/ticket-sort）／K-564：会社の項目の値（F4/ticket-fields） */
export const TICKET_FIELD_GROUPS: readonly TicketFieldGroup[] = [progressFields, ticketSortFields, ticketFieldsFields];
