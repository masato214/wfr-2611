// 運営の最初の 1 人とパスキーを付けるリンク（K-945・関門 C2・C6・D-156.22・D-156.66・D-096）。
//   createFirstOps   … 命令 ops:first の中身。運営の人（パスワードなし・運営の会社の members・できること 9 つ）を 1 つの取引で作り、
//                      パスキーを付けるリンク（24 時間・1 回だけ）を取引を閉じてからメールで送る。
//                      ・ほかに「運営の人を持ち、パスキーのある」運営の人が居れば何もしない（"already"・その人が足し直す）
//                      ・同じメールの運営の人が居れば人を増やさず新しいリンクを送る（最後の 1 人がパスキーを無くしたとき・前のリンクは使えなくなる）
//                      ・メールを送れなければ "mail_failed"（送れたと言わない・G-15）
//   newOpsSetupToken  … リンクの印と sha256 の 16 進を作る（K-985 の運営の人を足す口も同じ物を使う）
//   opsSetupUrl       … リンクの住所（印は # の後）
//   issueOpsSetupLink … リンクの印を作り、その人の使っていないリンクを使えなくして新しい行を足す。DB には sha256 の 16 進だけ
//   cliMailer         … 台本の本物の送り出し。signedMail（署名と返信先）で包み、from は mailFrom。{ error } を見て落ちたら投げる
// 印も宛先も標準出力・ログに出さない（宛先は mailTag の印だけ）。
import { randomBytes } from "node:crypto";
import type pg from "pg";
import type { Config } from "@kaname/config";
import { uuidv7 } from "@kaname/db/id";
import { resendMail, signedMail, type MailLike } from "@kaname/notify";
import type { Auth, Mailer } from "./index.js";
import { hashToken } from "./invitations.js";
import { normalizeEmail } from "./signup.js";

/** リンクの効く時間（24 時間・D-156.22） */
export const OPS_SETUP_HOURS = 24;
/** 運営のできること 9 つ（0078 の ops_members_caps_ck）。最初の 1 人は全部を持つ */
export const OPS_ALL_CAPS = [
  "inquiry",
  "peek",
  "money",
  "stop",
  "notice",
  "distribute",
  "plan_propose",
  "plan_decide",
  "ops_people",
] as const;

export type FirstOpsStatus = "sent" | "already" | "mail_failed";

export interface FirstOpsInput {
  email: string;
  /** 最初の 1 人だけは命令で名前を付ける（D-156.66） */
  name: string;
  /** 画面の住所（リンクの頭） */
  webBaseURL: string;
  mailer: Mailer;
}

type Queryable = Pick<pg.PoolClient, "query">;

/** リンクの印（32 バイトの乱数の base64url・43 字）と、DB に残す sha256 の 16 進。印そのものは DB に残さない（K-945・K-985 が使う） */
export const newOpsSetupToken = (): { token: string; hash: string } => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
};

/** リンクの住所。印は # の後（問い合わせの値に載せない＝サーバーの記録に残らない） */
export const opsSetupUrl = (webBaseURL: string, token: string): string =>
  `${webBaseURL.replace(/\/+$/, "")}/ops/setup#token=${token}`;

/** その人の使っていないリンクを使えなくし、新しいリンクの行を足す。返すのは印（DB には残さない） */
export async function issueOpsSetupLink(
  db: Queryable,
  opsMemberId: string,
  createdBy?: string | null,
): Promise<string> {
  const { token, hash } = newOpsSetupToken();
  await db.query(
    "update ops_setup_links set expires_at = least(expires_at, now()) where ops_member_id = $1 and used_at is null",
    [opsMemberId],
  );
  await db.query(
    `insert into ops_setup_links (ops_member_id, token_hash, expires_at, created_by)
     values ($1, $2, now() + make_interval(hours => $3), $4)`,
    [opsMemberId, hash, OPS_SETUP_HOURS, createdBy ?? null],
  );
  return token;
}

/** 運営の会社の最初の層（members.scope_id）。無ければ作る */
async function opsScope(db: Queryable): Promise<string> {
  const r = await db.query<{ id: string }>(
    "select id from scopes where tenant_id = app.ops_tenant_id() and deleted_at is null order by created_at limit 1",
  );
  if (r.rows[0]) return r.rows[0].id;
  const ins = await db.query<{ id: string }>(
    "insert into scopes (tenant_id, name, ticket_prefix) values (app.ops_tenant_id(), '運営の全体', '') returning id",
  );
  return ins.rows[0]!.id;
}

/** 運営の人を持ち、パスキーのある運営の人が、このメールの人のほかに居るか */
async function otherKeeperExists(db: Queryable, email: string): Promise<boolean> {
  const r = await db.query(
    `select 1 from ops_members o
       join members m on m.id = o.member_id
       join kaname_auth."user" u on u.id = m.auth_user_id
      where m.tenant_id = app.ops_tenant_id() and m.deleted_at is null and o.revoked_at is null and o.deleted_at is null
        and 'ops_people' = any(o.caps) and u.email <> $1
        and exists (select 1 from kaname_auth.passkey p where p."userId" = u.id)
      limit 1`,
    [email],
  );
  return (r.rowCount ?? 0) > 0;
}

/** 同じメールの生きている運営の人（ops_members.id） */
async function sameEmailOps(db: Queryable, email: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `select o.id from ops_members o
       join members m on m.id = o.member_id
       join kaname_auth."user" u on u.id = m.auth_user_id
      where u.email = $1 and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
        and o.revoked_at is null and o.deleted_at is null
      limit 1`,
    [email],
  );
  return r.rows[0]?.id ?? null;
}

/** 運営の人を作る（認証の利用者はパスワードなし・確認済み／運営の会社の members／できること 9 つ）。返すのは ops_members.id */
async function makeOpsPerson(db: Queryable, email: string, name: string): Promise<string> {
  const userId = uuidv7();
  await db.query(
    `insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled")
     values ($1, $2, $3, true, now(), now(), false)`,
    [userId, name, email],
  );
  const scope = await opsScope(db);
  const m = await db.query<{ id: string }>(
    "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values (app.ops_tenant_id(), $1, 'human', $2, $3) returning id",
    [scope, name, userId],
  );
  const o = await db.query<{ id: string }>(
    "insert into ops_members (tenant_id, member_id, caps) values (app.ops_tenant_id(), $1, $2) returning id",
    [m.rows[0]!.id, [...OPS_ALL_CAPS]],
  );
  return o.rows[0]!.id;
}

/** 命令 ops:first の中身。管理者の接続で動く（auth は部品の形をそろえるために受ける・利用者は取引の中で直に作る） */
export async function createFirstOps(
  admin: pg.Pool,
  _auth: Auth,
  input: FirstOpsInput,
): Promise<{ status: FirstOpsStatus }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim() || "運営";
  const client = await admin.connect();
  let token: string;
  try {
    await client.query("begin");
    // 同時に 2 回流しても 1 人だけ作る（取引の間だけの錠）
    await client.query("select pg_advisory_xact_lock(hashtext('kaname.ops_first'))");
    if (await otherKeeperExists(client, email)) {
      await client.query("rollback");
      return { status: "already" };
    }
    const opsId = (await sameEmailOps(client, email)) ?? (await makeOpsPerson(client, email, name));
    token = await issueOpsSetupLink(client, opsId);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  // 取引を閉じてからメール（関門 C6）。送れなければ送れたと言わない（行は残るが 24 時間で使えなくなり、もう一度流すと前のリンクは使えなくなる）
  const url = opsSetupUrl(input.webBaseURL, token);
  try {
    await input.mailer({
      to: email,
      subject: "【Kaname】運営の場所のパスキーを付けてください",
      // 本文に印を書かない（印はリンク url にだけ。送り出しの 1 か所 cliMailer が本文の後ろにリンクを付ける）
      text: [
        "Kaname の運営の場所に入るためのパスキーを付けてください。",
        "下のリンクを開くと、この端末にパスキーを付けられます。リンクは 24 時間、1 回だけ使えます。",
        "心当たりが無い場合は、このメールを捨ててください。",
      ].join("\n"),
      url,
      kind: "ops_setup",
    });
  } catch {
    return { status: "mail_failed" };
  }
  return { status: "sent" };
}

type MailConfig = Pick<Config, "resendApiKey" | "mailFrom" | "mailReplyTo" | "operator">;

/** 台本の本物の送り出し（関門 C6 の 1 か所・apps/api の server.ts と同じ組み立て）。鍵が無ければ送らずに投げる */
export function cliMailer(config: MailConfig, inner?: MailLike): Mailer {
  const base = inner ?? (config.resendApiKey ? resendMail(config.resendApiKey) : null);
  const mail = base ? signedMail(base, config.operator, config.mailReplyTo) : null;
  return async (m) => {
    if (!mail) throw new Error("メールの送出先が設定されていない（RESEND_API_KEY）");
    // リンクは本文の後ろに付ける（署名はその後に signedMail が付ける）
    const text = m.url ? `${m.text}\n\n${m.url}` : m.text;
    const r = await mail.send({ from: config.mailFrom, to: m.to, subject: m.subject, text });
    if (r.error) throw new Error("メールを送れなかった");
  };
}
