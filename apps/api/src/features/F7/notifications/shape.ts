// 知らせの 1 行 → 答えの形（K-461・K-462 も使う）。DB に触らない純粋な関数だけ。
//   payload は丸ごと返さない。params には PARAM_KEYS の欄だけを短くして入れる（本文・知らない欄・url・due_on を出さない・D-151.5）。
//   行き先は payload の文字でなく、種類の表と ticket_id（uuid の形のときだけ）から組む（押して知らない所へ飛ばさない）。
//   取り消し系（afterDelete）はチケットを消した後も出す行なので、番号だけを出し、ticket_id・title・href を null にする（D-148.5）
import { isUuid } from "@kaname/contracts";
import { KINDS, PARAM_KEYS, hrefOf, type NoticeTag } from "./kinds.js";

/** 文字の最大の長さ（文字の数。コードポイントの単位） */
export const CLIP_MAX = 200;
/** 文字を 200 字に切る。切るのはこの 1 つの関数だけ（コードポイントの単位。SQL 側の left(…, 200) と同じ単位・絵文字が半分に割れない） */
export const clip = (s: string): string => Array.from(s).slice(0, CLIP_MAX).join("");

/** 一覧の 1 文が返す列（list.ts の select と同じ名前） */
export interface NotificationRow {
  id: string;
  event_kind_id: string;
  payload: unknown;
  read_at: Date | null;
  created_at: Date;
  actor_id: string | null;
  actor_name: string | null;
}

export interface Notification {
  id: string;
  kind: string;
  tag: NoticeTag;
  href: string | null;
  ticket_id: string | null;
  number: string | null;
  title: string | null;
  actor: { id: string; name: string } | null;
  params: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const textOf = (v: unknown): string | null => (typeof v === "string" ? clip(v) : null);

/** payload のうち PARAM_KEYS の欄だけ：文字は clip・数・真偽・null はそのまま・stage は { key, name }（文字 2 つだけ）・それ以外の形は欄ごと落とす */
function paramsOf(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PARAM_KEYS) {
    if (!Object.hasOwn(payload, key)) continue;
    const v = payload[key];
    if (key === "stage") {
      if (isRecord(v) && typeof v["key"] === "string" && typeof v["name"] === "string")
        out[key] = { key: clip(v["key"]), name: clip(v["name"]) };
    } else if (typeof v === "string") out[key] = clip(v);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[key] = v;
  }
  return out;
}

export function toNotification(row: NotificationRow): Notification {
  const rule = KINDS[row.event_kind_id];
  const payload = isRecord(row.payload) ? row.payload : {};
  const after = rule?.afterDelete === true;
  const rawId = payload["ticket_id"];
  const ticketId = rule?.ticket === true && typeof rawId === "string" && isUuid(rawId) ? rawId : null;
  return {
    id: row.id,
    kind: row.event_kind_id,
    tag: rule?.tag ?? "write",
    href: hrefOf(row.event_kind_id, payload),
    ticket_id: ticketId,
    number: textOf(payload["number"]),
    title: after ? null : textOf(payload["title"]),
    actor: row.actor_id && row.actor_name ? { id: row.actor_id, name: row.actor_name } : null,
    params: paramsOf(payload),
    read: row.read_at !== null,
    read_at: row.read_at ? row.read_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}
