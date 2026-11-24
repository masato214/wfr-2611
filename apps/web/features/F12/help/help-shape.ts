// 困ったとき・お知らせ（K-956）の、口の答え → 部品の値（画面の外の純粋な関数・@/ を読まない）。
//   答えの形は K-1004（listNotices・getServiceStatusForMember）と K-948（listMyInquiries）の「画面が使う答えの形」。
//   時刻はどれも日本時間。障害は「MM/DD HH:MM」・ほかは「MM/DD」（下絵の字・0 埋め）。メンテの時間は「11/10（月）2:00〜3:00」。
//   上の帯（K-957）も jstWhen・windowOf を使う（同じ読み替えを 2 つ作らない・D-156.10）。知らない様子はふつうに見せない（G-15）
import type { InquiryView, NoticeDetailView, NoticeKind, NoticeView, StatusView } from "./views";

export interface NoticeIn {
  id: string;
  kind: "incident" | "maintenance" | "release";
  title: string;
  body: string;
  state: "investigating" | "identified" | "monitoring" | "resolved" | null;
  published_at: string;
  unread: boolean;
  maintenance: { from: string; to: string; impact: string | null } | null;
  updates: unknown[];
}
export interface StatusComponentIn {
  key: string;
  label: string;
  state: "normal" | "degraded" | "down";
}
export interface StatusIn {
  components: StatusComponentIn[];
  bands: unknown[];
  maintenance_now: { from: string; to: string } | null;
}
export interface InquiryIn {
  id: string;
  title: string;
  topic: "usage" | "trouble" | "billing" | "other";
  state: "waiting" | "replied" | "done";
  created_at: string;
  last_reply_at: string | null;
  has_unread_reply: boolean;
}

const KIND: Record<NoticeIn["kind"], NoticeKind> = { incident: "障害", maintenance: "メンテ", release: "リリース" };
const INCIDENT_STATE: Record<string, string> = {
  investigating: "調べている",
  identified: "原因が分かった",
  monitoring: "様子を見ている",
  resolved: "直った",
};
const STATUS: Record<string, StatusView["state"]> = { normal: "ふつう", degraded: "遅れている", down: "止まっている" };
const TOPIC: Record<string, string> = {
  usage: "使い方",
  trouble: "うまく動かない",
  billing: "お金・プラン",
  other: "ほか",
};
const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
/** 送ったばかり（「いま」と出す）の幅 */
const JUST_NOW_MS = 60_000;
const JST_MS = 9 * 60 * 60 * 1000;

interface JstParts {
  month: number;
  day: number;
  hour: number;
  minute: number;
  week: number;
}
const jstParts = (iso: string): JstParts => {
  const d = new Date(Date.parse(iso) + JST_MS);
  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    week: d.getUTCDay(),
  };
};
const two = (n: number): string => String(n).padStart(2, "0");
const md = (p: JstParts): string => `${two(p.month)}/${two(p.day)}`;
const hm = (p: JstParts): string => `${p.hour}:${two(p.minute)}`;

/** 日本時間の「MM/DD」（withTime なら「MM/DD HH:MM」） */
export function jstWhen(iso: string, withTime: boolean): string {
  const p = jstParts(iso);
  return withTime ? `${md(p)} ${two(p.hour)}:${two(p.minute)}` : md(p);
}

/** メンテの時間「11/10（月）2:00〜3:00」（日をまたぐと終わりにも日付と曜日） */
export function windowOf(from: string, to: string): string {
  const a = jstParts(from);
  const b = jstParts(to);
  const sameDay = a.month === b.month && a.day === b.day;
  const end = sameDay ? hm(b) : `${md(b)}（${WEEK[b.week]}）${hm(b)}`;
  return `${md(a)}（${WEEK[a.week]}）${hm(a)}〜${end}`;
}

const lines = (body: string): string[] => body.split(/\r?\n/);

/** お知らせの 1 行：要約は本文の 1 行目・未読と障害の様子は在るときだけ */
export function noticeView(n: NoticeIn): NoticeView {
  const state = n.state ? INCIDENT_STATE[n.state] : undefined;
  return {
    id: n.id,
    kind: KIND[n.kind] ?? "リリース",
    title: n.title,
    body: lines(n.body)[0] ?? "",
    when: jstWhen(n.published_at, n.kind === "incident"),
    ...(n.unread ? { unread: true } : {}),
    ...(state ? { state } : {}),
  };
}

/** お知らせ 1 件：メンテの時間と影響・中身は本文の 2 行目から（1 行だけなら 1 行目） */
export function noticeDetailView(n: NoticeIn): NoticeDetailView {
  const all = lines(n.body);
  const rest = all.slice(1).join("\n");
  const m = n.maintenance;
  return {
    ...noticeView(n),
    ...(m?.from && m.to ? { window: windowOf(m.from, m.to) } : {}),
    ...(m?.impact ? { impact: m.impact } : {}),
    full: rest.trim() ? rest : (all[0] ?? ""),
  };
}

/** 稼働状況の 1 行。知らない値は「遅れている」（ふつうに見せない） */
export function statusView(c: StatusComponentIn): StatusView {
  return { label: c.label, state: STATUS[c.state] ?? "遅れている" };
}

/** 自分の問い合わせの 1 行。作って 1 分以内は「いま」 */
export function inquiryView(q: InquiryIn, now: number): InquiryView {
  const created = Date.parse(q.created_at);
  const when = now - created < JUST_NOW_MS ? "いま" : jstWhen(q.created_at, false);
  const base = { id: q.id, title: q.title, kind: TOPIC[q.topic] ?? "ほか", when };
  if (q.state === "waiting") return { ...base, waiting: true };
  if (q.state === "done") return { ...base, replied: true, done: true };
  return { ...base, replied: true };
}
