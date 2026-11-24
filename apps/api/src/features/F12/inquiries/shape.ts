// 顧客に返す問い合わせの形（K-948 の「画面が使う答えの形」MyInquiry の 7 欄）。K-949 作る・K-951 読む・K-952 返事と済みが同じ関数で答える。
//   顧客の状態の読み替え：open・later → waiting（返事を待っている）／waiting → replied（返事あり）／done → done（済み）
export type MyInquiryState = "waiting" | "replied" | "done";
export interface MyInquiry {
  id: string;
  title: string;
  topic: string | null;
  state: MyInquiryState;
  created_at: string;
  last_reply_at: string | null;
  has_unread_reply: boolean;
}

/** DB の行（関数の答え・読む口の行）。last_reply_at は運営の返事（見え方 all・送った人なし）の最新、asker_read_at は本人が最後に開いた時刻 */
export interface InquiryRow {
  id: unknown;
  title: unknown;
  topic?: unknown;
  topic_key?: unknown;
  state: unknown;
  created_at: unknown;
  last_reply_at?: unknown;
  asker_read_at?: unknown;
}

const STATE: Record<string, MyInquiryState> = { open: "waiting", later: "waiting", waiting: "replied", done: "done" };

const iso = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function toMyInquiry(row: InquiryRow): MyInquiry {
  const lastReply = iso(row.last_reply_at);
  const readAt = iso(row.asker_read_at);
  const topic = row.topic ?? row.topic_key ?? null;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    topic: topic === null ? null : String(topic),
    state: STATE[String(row.state)] ?? "waiting",
    created_at: iso(row.created_at) ?? "",
    last_reply_at: lastReply,
    has_unread_reply: lastReply !== null && (readAt === null || Date.parse(lastReply) > Date.parse(readAt)),
  };
}
