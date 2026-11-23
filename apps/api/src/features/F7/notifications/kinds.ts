// 鈴の知らせの種類の表（K-461・D-151.5）。種類（event_kind_id）→ 札と行き先。DB に触らない純粋な表と関数だけ。
//   表に無い種類は一覧にも数にも出さない（読み飛ばす・P4）。新しい種類の書き手は、この表に 1 行足してから書く（足し忘れは試験 K461-API-016 が止める）。
//   札の言葉（「受ける？」「承認待ち」…）と行ごとの文は画面（K-467）が持つ。ここは札の名前と行き先だけ
import { isUuid } from "@kaname/contracts";

export type NoticeTag = "handover" | "approval" | "mention" | "stopped" | "write" | "setting";

export interface KindRule {
  tag: NoticeTag;
  /** チケットに結ぶ種類か（true なら今そのチケットが見えるときだけ出す・行き先は /tickets/<ticket_id>） */
  ticket: boolean;
  /** チケットに結ばない種類の行き先（無ければ押せない行） */
  href: string | null;
  /** 取り消し系だけ：チケットを消した後も出す。番号だけ（題名・チケットの id・行き先は出さない・D-148.5） */
  afterDelete?: true;
}

const ticketKind = (tag: NoticeTag): KindRule => ({ tag, ticket: true, href: null });
const settingKind = (href: string | null): KindRule => ({ tag: "setting", ticket: false, href });

export const KINDS: Readonly<Record<string, KindRule>> = {
  // 前から（0090・0100・0101）と段 7（K-385・K-387・K-390）・段 8（K-483）・段 5（K-440）
  "ticket.assigned": ticketKind("write"),
  "ticket.created": ticketKind("write"),
  "ticket.completed": ticketKind("write"),
  "ticket.mentioned": ticketKind("mention"),
  "ticket.message": ticketKind("write"),
  "ticket.stage_changed": ticketKind("write"),
  "ticket.decision": ticketKind("write"),
  "ticket.due_changed": ticketKind("write"),
  "ticket.sort_changed": ticketKind("write"),
  // 段 8（K-464・K-463）
  "ticket.stopped": ticketKind("stopped"),
  "approval.requested": ticketKind("approval"),
  // 段 9（K-402・K-408・K-409・K-410・K-406）：受ける？の札
  "handover.requested": ticketKind("handover"),
  "handover.offered": ticketKind("handover"),
  "handover.distributed": ticketKind("handover"),
  "handover.group_distributed": ticketKind("handover"),
  "handover.reminded": ticketKind("handover"),
  // 段 9（K-403・K-407・K-402・K-409・K-410）：書き込みの札
  "handover.accepted": ticketKind("write"),
  "handover.declined": ticketKind("write"),
  "handover.overdue": ticketKind("write"),
  "handover.managers": ticketKind("write"),
  "handover.reassigned": ticketKind("write"),
  "handover.distributed_done": ticketKind("write"),
  "handover.claimed": ticketKind("write"),
  // 取り消し系：チケットを消した後も出す（D-148.5）。番号だけ・押せない行
  "handover.withdrawn": { tag: "write", ticket: false, href: null, afterDelete: true },
  // 設定（前から：0083・0112・0089・20261119051731）
  "security.new_device": settingKind("/mfa-setup"),
  "security.admin_recovery_requested": settingKind(null), // 管理者が受け取る知らせ。本人の 2 段階認証の設定の道では用が足りない
  "bridge.connected": settingKind("/setup/bridge"),
  invitation_resend_requested: settingKind(null), // 開く画面がまだ無い
  // 秘密の置き場（K-354・20261119120700）：使える場所の外で渡そうとして止まったことを持ち主に知らせる。開く画面がまだ無い（K-357 が決めるまで押せない行）
  "credential.wrong_destination": settingKind(null),
};

/** 鈴に出してよい種類（表の鍵） */
export const KNOWN_KINDS: readonly string[] = Object.keys(KINDS);
/** チケットに結ぶ種類（今そのチケットが見えるときだけ出す）。取り消し系は含まない */
export const TICKET_KINDS: readonly string[] = KNOWN_KINDS.filter((k) => KINDS[k]!.ticket);

/** params に通す欄（種類ごとに分けず全体の 1 つの集まり・D-151.5）。ここに無い欄（本文・url・due_on・device・session_id …）は出さない。
 *  ticket_id・number・title は params に入れない（答えの上に出るので） */
export const PARAM_KEYS: ReadonlySet<string> = new Set([
  "approval_id",
  "decision_id",
  "action",
  "device_label",
  "from_name",
  "handover_id",
  "job_id",
  "message_id",
  "reason",
  "reply_due",
  "stage",
]);

/** 行き先：チケットに結ぶ種類は ticket_id が uuid の形のときだけ /tickets/<id>（それ以外は null）。
 *  結ばない種類は表の href（無ければ null）。取り消し系・表に無い種類は必ず null（押して知らない所へ飛ばさない） */
export function hrefOf(kind: string, payload: Record<string, unknown> | null | undefined): string | null {
  const rule = KINDS[kind];
  if (!rule || rule.afterDelete) return null;
  if (!rule.ticket) return rule.href;
  const id = payload?.["ticket_id"];
  return typeof id === "string" && isUuid(id) ? `/tickets/${id}` : null;
}
