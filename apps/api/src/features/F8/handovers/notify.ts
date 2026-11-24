// 渡しの知らせとメールの送り方（関門 C6・K-401）。種類の葉の DB の関数は、知らせの行（notifications・channel 'inapp'・event_kind_id は
//   'handover.' で始まる名前・dedupe_key つき）を入れ、メールを出す宛てを MailRow の並びで返す。口はこの部品で 1 通ずつ送り、
//   送れた／送れなかった印を app.handover_mail_mark で知らせの行に書く（K-334 の送り直しと同じ形）。
//   ログに宛先・文を出さない（宛先は mailTag の印・例外は種類だけ・where は「<種類>:<渡しの id>」）。投げない
import { mailTag } from "@kaname/auth/signup";
import { withTenant } from "@kaname/db/context";
import type { HandoverDeps } from "./deps.js";
import { kindOf } from "./errors.js";
import { handoverMail } from "./mail.js";

export interface MailRow {
  notification_id: string;
  handover_id: string;
  email: string;
  event: string;
  ticket_id: string;
  ticket_number: string;
  ticket_title: string;
  actor_name: string;
  to_name: string;
  reply_due: string | null;
}

/** 1 通を送る。送れたら true（mailer が無い・知らない event・例外は false） */
async function sendOne(d: HandoverDeps, row: MailRow, where: string): Promise<boolean> {
  try {
    if (!d.mailer) throw new Error("メールの送出先が無い");
    const mail = handoverMail(row, d.config.webBaseUrl);
    if (!mail) throw new Error("知らない知らせの種類");
    await d.mailer({ to: row.email, ...mail });
    return true;
  } catch (e) {
    console.error(`[handover] ${where}：メールを送れなかった → ${mailTag(row.email)}: ${kindOf(e)}`);
    return false;
  }
}

/** 宛てごとに送り、送れた・送れなかったを知らせの行に書く。ctx は口が withTenant に渡したのと同じ会社と人 */
export async function sendHandoverMails(
  d: HandoverDeps,
  ctx: { tenantId: string; userId: string },
  mails: MailRow[],
  where: string,
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  for (const row of mails) ((await sendOne(d, row, where)) ? sent : failed).push(row.notification_id);
  if (sent.length + failed.length === 0) return { sent, failed };
  const mark = () =>
    withTenant(d.appPool, { tenantId: ctx.tenantId, userId: ctx.userId, role: "member" }, (c) =>
      c.query("select app.handover_mail_mark($1::uuid[], $2::uuid[])", [sent, failed]),
    );
  try {
    await mark().catch(() => mark());
  } catch (e) {
    console.error(`[handover] ${where}：印を書けなかった → ${kindOf(e)}`);
  }
  return { sent, failed };
}
