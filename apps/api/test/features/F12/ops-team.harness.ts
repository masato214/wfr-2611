// 段 13「運営の人」の口（K-985 listOpsMembers・addOpsMember／K-1009 updateOpsMemberCaps・removeOpsMember）の単体の試験の土台（K-985 が持ち込む）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//   組み立ては K-944 の ops.harness.ts（本物の DB・本物のログインの部品・本番と同じ bootApi・仮の認証器でパスキーで入る）をそのまま使い、
//   運営の人の口に要る物だけを足す:
//     ・signedIn：運営の人を作り、パスキーを付けて入った印を返す（K-944 の ops-login.test.ts と同じ形）
//     ・stepUp：本人確認の取り直しの時刻を sessions に直に書く（K-944 の K944-API-004 と同じ形）
//     ・mailsTo：関門 C6 の送り出し（login.harness.ts の偽の送り出し mails）のうち、その宛先の物
//     ・breakWrites：表への書き込みのうち、この試験の行だけで例外にする引き金を付け、返す関数で外す（ops-ws.harness.ts と同じ形）
//   口が足した運営の人（メールの頭が run）は afterAll で運営の行・リンクを消す（記録は追記専用なので消さない・G-10）
import { afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { failMailTo, mails, type SentMail } from "../F1/login.harness.js";
import { ALL_CAPS, OPS_TENANT, setupOps, type Authenticator, type Ops, type OpsPerson } from "./ops.harness.js";

export { ALL_CAPS, OPS_TENANT, failMailTo };
export const MEMBERS = "/api/v1/ops/members";
/** listOpsMembers・addOpsMember の 1 行の 8 欄（K-985 の「画面が使う答えの形」） */
export const OPS_MEMBER_KEYS = [
  "caps",
  "email",
  "has_passkey",
  "is_self",
  "locked_caps",
  "member_id",
  "name",
  "setup_pending",
] as const;

export interface Signed {
  p: OpsPerson;
  a: Authenticator;
  token: string;
}
export type Json = Record<string, unknown> & { data?: unknown; meta?: Record<string, unknown> };
export interface Team {
  o: Ops;
  /** 運営の人を作り、パスキーで入る。caps を省くと 9 つ全部 */
  signedIn: (tag: string, caps?: readonly string[]) => Promise<Signed>;
  /** 本人確認を今取り直したことにする（その人の生きているセッション全部） */
  stepUp: (memberId: string) => Promise<void>;
  /** 運営の人の口を Bearer で呼ぶ */
  call: (token: string | null, method: string, path: string, body?: unknown) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  /** その宛先に届いたメール（届いた順） */
  mailsTo: (email: string) => SentMail[];
  /** メールの本文のリンクの印（#token= の後の 43 字）。無ければ null */
  tokenIn: (m: SentMail | undefined) => string | null;
  /** 数を数える（select count(*)::int as n …） */
  n: (sql: string, p?: unknown[]) => Promise<number>;
  row: <T = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<T | undefined>;
  /** そのメールの運営の会社の members と ops_members（無ければ undefined） */
  opsOf: (
    email: string,
  ) => Promise<{ member_id: string; ops_member_id: string; caps: string[]; revoked_at: Date | null } | undefined>;
  /** 運営の人を外したことにする（DB に直に） */
  revoke: (memberId: string) => Promise<void>;
  /** 表への書き込みのうち、only に当たる行（この試験の行）だけを例外にする引き金を付け、返す関数で外す。
   *  only は { 列: 値 }（どれも等しい）か、NEW を使う SQL の式。表全体を落とさない（同じ DB のほかの試験を巻き込まない） */
  breakWrites: (table: string, only: string | Record<string, string>) => Promise<() => Promise<void>>;
  /** 一覧の行のうち、この回の人（メールの頭が run）だけ */
  mine: (rows: unknown) => Record<string, unknown>[];
}

/** 各試験のファイルの頭で 1 回呼ぶ（中で K-944 の setupOps を呼ぶ） */
export function setupTeam(prefix: string): Team {
  const o = setupOps(prefix);
  const { h } = o;
  afterAll(async () => {
    const like = `${h.run}%`;
    const ids = (
      await h.admin.query<{ id: string }>(
        `select m.id from members m join kaname_auth."user" u on u.id = m.auth_user_id
          where m.tenant_id = $1 and u.email like $2`,
        [OPS_TENANT, like],
      )
    ).rows.map((r) => r.id);
    if (!ids.length) return;
    await h.admin.query(
      "delete from ops_setup_links where ops_member_id in (select id from ops_members where member_id = any($1::uuid[]))",
      [ids],
    );
    // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
    await h.admin.query("delete from ops_members where member_id = any($1::uuid[])", [ids]);
  });

  const signedIn: Team["signedIn"] = async (tag, caps) => {
    const p = await o.makeOps(tag, caps ? { caps } : {});
    const a = await o.addPasskey(p.userId);
    const r = await o.passkeySignIn(p.userId, a);
    if (r.status !== 200) throw new Error(`パスキーで入れなかった（${r.status}）: ${await r.text()}`);
    const token = o.tokenOf(r);
    if (!token) throw new Error("セッションの印が無い");
    return { p, a, token };
  };
  const stepUp: Team["stepUp"] = async (memberId) => {
    await h.admin.query("update sessions set step_up_at = now() where member_id = $1 and revoked_at is null", [
      memberId,
    ]);
  };
  const call: Team["call"] = (token, method, path, body) => o.api(method, path, token, body);
  const json: Team["json"] = async (r) => (await r.json()) as Json;
  const mailsTo: Team["mailsTo"] = (email) => mails.filter((m) => m.to === email);
  const tokenIn: Team["tokenIn"] = (m) =>
    /\/ops\/setup#token=([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(m?.text ?? "")?.[1] ?? null;
  const n: Team["n"] = async (sql, p = []) => Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
  const row: Team["row"] = async (sql, p = []) => (await h.admin.query(sql, p)).rows[0];
  const opsOf: Team["opsOf"] = async (email) =>
    row(
      `select m.id as member_id, om.id as ops_member_id, om.caps, om.revoked_at
         from members m join kaname_auth."user" u on u.id = m.auth_user_id
         join ops_members om on om.member_id = m.id
        where m.tenant_id = $1 and u.email = $2 and m.deleted_at is null`,
      [OPS_TENANT, email],
    );
  const revoke: Team["revoke"] = async (memberId) => {
    await h.admin.query("update ops_members set revoked_at = now() where member_id = $1", [memberId]);
  };
  const breakWrites: Team["breakWrites"] = async (table, only) => {
    const fn = `test_break_${randomUUID().slice(0, 8)}`;
    const when =
      typeof only === "string"
        ? only
        : Object.entries(only)
            .map(([k, v]) => {
              if (!/^[a-z_]+$/.test(k)) throw new Error(`列の名前が違う: ${k}`);
              return `new.${k}::text = '${v.replaceAll("'", "''")}'`;
            })
            .join(" and ");
    await h.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$ begin if ${when} then raise exception '試験で壊した' using errcode = 'XX000'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before insert or update on ${table} for each row execute function ${fn}()`,
    );
    return async () => {
      await h.admin.query(`drop trigger if exists ${fn} on ${table}`);
      await h.admin.query(`drop function if exists ${fn}()`);
    };
  };
  const mine: Team["mine"] = (rows) =>
    (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).filter((r) =>
      String(r["email"] ?? "").startsWith(h.run),
    );
  return { o, signedIn, stepUp, call, json, mailsTo, tokenIn, n, row, opsOf, revoke, breakWrites, mine };
}
