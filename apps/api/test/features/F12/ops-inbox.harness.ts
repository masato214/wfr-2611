// 段 13「運営の受信箱」の口（K-973 listOpsInquiries・getOpsInquiry／K-974 updateOpsInquiry／K-975 replyOpsInquiry・addOpsInquiryNote）の
//   単体の試験の土台（K-973 が持ち込む・K-974・K-975 も使う）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   実装の前に流して赤を確かめない（D-128.143）。顧客の側（問い合わせを作る・返事を読む）は inquiry.harness.ts（K-949）をそのまま使い、
//   運営の人（運営の会社の members ＋ ops_members の caps）と、運営の記録の後片付けだけをこの土台が足す
import { afterAll } from "vitest";
import { startInquiries, type Inquiries, type World } from "./inquiry.harness.js";
import type { Person } from "../fixture.js";

/** 運営の会社（0003 の app.ops_tenant_id()） */
export const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
/** getOpsInquiry の 1 件の 13 欄・listOpsInquiries の 1 行の 10 欄（K-948 の「画面が使う答えの形」） */
export const ROW_KEYS = [
  "asker",
  "created_at",
  "id",
  "last_message_at",
  "later_until",
  "owner",
  "state",
  "title",
  "topic",
  "workspace",
];
export const DETAIL_KEYS = [...ROW_KEYS, "context", "messages", "workspace_status"].sort();
/** OpsInquiryMessage の 6 欄 */
export const OPS_MESSAGE = ["attachments", "author_name", "body", "created_at", "id", "kind"];

export interface OpsInbox extends Inquiries {
  /** 運営の人（caps を省くと inquiry だけ） */
  ops: (name: string, caps?: readonly string[]) => Promise<Person>;
  /** 顧客の会社を 1 つ作り、問い合わせを 1 つ口で作る（題を省くと「<label> の問い合わせ」）。問い合わせの id を返す */
  asked: (w: World, title?: string, topic?: string) => Promise<string>;
  /** 担当を DB に直に置く（K-974 の口を通さない準備） */
  assign: (inquiryId: string, who: Person | null) => Promise<void>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。顧客の側の inquiry-create は必ず足す） */
export async function startOpsInbox(prefix: string, hookFiles: readonly string[]): Promise<OpsInbox> {
  const t = await startInquiries(prefix, ["inquiry-create", ...hookFiles]);
  const opsMembers: string[] = [];
  let scope: string | null = null;
  afterAll(async () => {
    // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
    if (opsMembers.length)
      await t.f.admin.query("delete from ops_members where member_id = any($1::uuid[])", [opsMembers]);
  });
  const ops: OpsInbox["ops"] = async (name, caps = ["inquiry"]) => {
    scope ??= (await t.row<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '') returning id",
      [OPS_TENANT, `${t.run} 運営`],
    ))!.id;
    const p = await t.f.person(OPS_TENANT, scope, { name: `運営 ${name}`, role: "ops" });
    await t.f.admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, $3)", [
      OPS_TENANT,
      p.id,
      [...caps],
    ]);
    opsMembers.push(p.id);
    return p;
  };
  const asked: OpsInbox["asked"] = async (w, title, topic = "trouble") =>
    String(((await t.ask(w.asker, { title: title ?? "承認したのに動かない", topic })) as { id?: unknown }).id);
  const assign: OpsInbox["assign"] = async (inquiryId, who) => {
    await t.f.admin.query("update inquiries set assignee_ops_member_id = $2 where id = $1", [
      inquiryId,
      who ? who.id : null,
    ]);
  };
  return { ...t, ops, asked, assign };
}
