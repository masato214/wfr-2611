// 渡しのメールの文（K-401・D-148.19）。件名・相手の名前・チケットの番号と題名・返事の期限（あれば）・Kaname を開くリンクだけ。
//   理由とお願いの中身は書かない。「受けてもらえた・取り消された」はメールを出さない（受け箱の行だけ）。
//   知らない event は文を組まない（null・送る側が送れなかったに数える）。event を足す葉は、自分の試験でその文を確かめる
import type { MailRow } from "./notify.js";

const SUBJECT: Record<string, (r: MailRow) => string> = {
  requested: (r) => `【Kaname】${r.actor_name}さんから引き継ぎの頼みが届きました（${r.ticket_number}）`,
  offered: (r) => `【Kaname】${r.actor_name}さんが引き継ぎを申し出ています（${r.ticket_number}）`,
  reminded: (r) => `【Kaname】${r.actor_name}さんから引き継ぎの返事の催促が届きました（${r.ticket_number}）`,
  declined: (r) => `【Kaname】${r.actor_name}さんが引き継ぎを断りました（${r.ticket_number}）`,
  overdue: (r) => `【Kaname】${r.to_name}さんの引き継ぎの返事がまだありません（${r.ticket_number}）`,
  distributed: (r) => `【Kaname】${r.actor_name}さんからチケットが配られました（${r.ticket_number}）`,
  group_distributed: (r) => `【Kaname】${r.actor_name}さんがグループにチケットを配りました（${r.ticket_number}）`,
};

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

/** 日本時間「11月23日（月）18:00」 */
export function jstLabel(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms + 9 * 3_600_000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAY[d.getUTCDay()]}）${hh}:${mm}`;
}

/** メールの件名と本文。知らない event は null */
export function handoverMail(row: MailRow, webBaseUrl: string): { subject: string; text: string } | null {
  const subject = SUBJECT[row.event];
  if (!subject) return null;
  const due = row.reply_due ? jstLabel(row.reply_due) : "";
  const lines = [
    `${row.to_name} さん`,
    "",
    `チケット：${row.ticket_number} ${row.ticket_title}`,
    ...(due ? [`返事の期限：${due}`] : []),
    "",
    "Kaname で開く：",
    `${webBaseUrl.replace(/\/+$/, "")}/tickets/${row.ticket_id}`,
  ];
  return { subject: subject(row), text: lines.join("\n") };
}
