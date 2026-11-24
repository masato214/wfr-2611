// 運営の受信箱の答えの形（K-973・K-948 の「画面が使う答えの形」）。形づくりは DB の関数 app.ops_inquiries・app.ops_inquiry の中で、
//   ここは鍵の並びだけそろえる（契約の並びと同じ・知らない鍵は落とす）。K-974（担当・状態・後で）も 1 行の形に使う
type Json = Record<string, unknown>;

/** 受信箱の 1 行の 10 欄 */
export const OPS_INQUIRY_ROW_KEYS = [
  "id",
  "title",
  "topic",
  "state",
  "workspace",
  "asker",
  "owner",
  "later_until",
  "created_at",
  "last_message_at",
] as const;
/** 1 件の 13 欄（1 行の 10 欄と、やり取り・画面の情報・右のワークスペースの様子） */
export const OPS_INQUIRY_DETAIL_KEYS = [...OPS_INQUIRY_ROW_KEYS, "messages", "context", "workspace_status"] as const;
/** やり取りの 1 件の 6 欄（kind は customer・reply・note） */
export const OPS_INQUIRY_MESSAGE_KEYS = ["id", "kind", "author_name", "body", "attachments", "created_at"] as const;
/** 右の様子の 5 欄（数と種類だけ・D-156.3） */
export const OPS_WORKSPACE_STATUS_KEYS = ["plan_name", "members", "pc", "stuck_runs", "overdue"] as const;

const pick = (src: unknown, keys: readonly string[]): Json => {
  const o = (src ?? {}) as Json;
  return Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
};

export const toOpsInquiryRow = (src: unknown): Json => pick(src, OPS_INQUIRY_ROW_KEYS);

export function toOpsInquiryDetail(src: unknown): Json {
  const d = pick(src, OPS_INQUIRY_DETAIL_KEYS);
  const messages = Array.isArray(d["messages"]) ? (d["messages"] as unknown[]) : [];
  return {
    ...d,
    messages: messages.map((m) => {
      const x = pick(m, OPS_INQUIRY_MESSAGE_KEYS);
      return { ...x, attachments: Array.isArray(x["attachments"]) ? x["attachments"] : [] };
    }),
    context: d["context"] ?? {},
    workspace_status: pick(d["workspace_status"], OPS_WORKSPACE_STATUS_KEYS),
  };
}
