// 段 13「運営がワークスペースを見る」口（K-963 getOpsShell・listOpsWorkspaces／K-966 getOpsWorkspace・listOpsWorkspaceMembers／
//   K-1011 listOpsWorkspaceInquiries・listOpsWorkspaceAudit／K-967 resendOpsVerification）の単体の試験の土台（K-963 が持ち込む）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//   組み立ては段 1 の土台 fixture.ts（本物の DB・本物の契約の入口・偽の画面のログイン fake:ops）。運営の人は ops-entry.test.ts（K-1001）と同じ作り方
//   （運営の会社 app.ops_tenant_id() の members の行＋ops_members の caps）。葉の hooks のファイルは最初の要求のときに 1 回だけ読む（準備で読まない・answer=8f745003d023）。
//   hooks の材料は appPool・repo・auth（本人確認のメールを送る部品の口だけの偽物・送った宛先を数える）・config。
//   全社の数（getOpsShell）は DB の全部の会社を数えるので、試験は「足す前と足した後の差」で見る（試験のファイルは直列・vitest の fileParallelism false）。
//   一覧（listOpsWorkspaces）は名前の頭（run）で探して、自分が作った会社だけを見る。作った会社の行・運営の人の行は afterAll で消す
import { afterAll } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createRepository } from "@kaname/db/repository";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
/** 運営の会社（0003 の app.ops_tenant_id()） */
export const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
export const ALL_CAPS = [
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
/** 値段は仮（D-125.125）。人数の上限は plans.limits.members */
export const PLANS = [
  { key: "free", name: "無料", price: 0, members: 3 },
  { key: "team", name: "チーム", price: 15000, members: 10 },
  { key: "business", name: "ビジネス", price: 40000, members: 30 },
] as const;
export type PlanKey = (typeof PLANS)[number]["key"];
export type Json = Record<string, unknown> & { data?: unknown; meta?: unknown };

export interface Ws {
  tenantId: string;
  rootScope: string;
  name: string;
  /** 管理者（tenant_memberships の role admin） */
  admin: Person;
}
export interface MailCall {
  email: string;
}
export interface OpsWs {
  f: Fixture;
  run: string;
  /** 運営の人（caps を省くと 9 つ全部） */
  ops: (name: string, caps?: readonly string[]) => Promise<Person>;
  /** 顧客のワークスペースを 1 つ作る（名前の頭に run が付く）。plan を省くと team */
  ws: (label: string, o?: { plan?: PlanKey; members?: number; createdDaysAgo?: number }) => Promise<Ws>;
  /** 同じワークスペースにメンバーを足す（tenant_memberships の active） */
  member: (
    w: Ws,
    name: string,
    o?: { role?: string; authEmail?: string | null; verified?: boolean },
  ) => Promise<Person>;
  /** PC（Bridge のセッション）を置く。alive＝いま生きている知らせが届いている */
  pc: (w: Ws, who: Person, o?: { alive?: boolean }) => Promise<void>;
  /** 実行（action_runs）を置く。status と何日前か */
  run_: (w: Ws, o: { status: string; daysAgo?: number }) => Promise<void>;
  /** 請求書を置く。dueDaysAgo が正なら期限を過ぎている。paid なら払われた */
  invoice: (w: Ws, o: { amount: number; dueDaysAgo: number; paid?: boolean }) => Promise<string>;
  /** 今月の上限の使い方（usage_meters）を置く */
  usage: (w: Ws, value: number, limit: number) => Promise<void>;
  /** 問い合わせ（inquiries）を DB に直に置く（運営の受信箱の葉が入るまでの準備） */
  inquiry: (
    w: Ws,
    o: { state: "open" | "waiting" | "later" | "done"; asker?: Person; assignee?: Person | null; title?: string },
  ) => Promise<string>;
  /** 照合が使えなかった登録（security_events）を置く。ack なら確かめた印 */
  pwned: (w: Ws, o?: { ack?: boolean }) => Promise<void>;
  call: (who: Person | null, method: string, path: string, body?: unknown) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  n: (sql: string, p?: unknown[]) => Promise<number>;
  row: <T = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<T | undefined>;
  /** 本人確認のメールを送る部品の口が呼ばれた記録（K-967）。fail を真にすると次の呼び出しから例外にする */
  mail: { calls: MailCall[]; fail: boolean };
  /** 書く口が落ちる準備：表（table）への挿入か更新で例外にする引き金を付け、返す関数で外す */
  /** 表への書き込みのうち、only に当たる行（この試験の行）だけを例外にする引き金を付け、返す関数で外す。
   *  only は { 列: 値 }（どれも等しい）か、NEW を使う SQL の式。表全体を落とさない（同じ DB のほかの試験を巻き込まない） */
  breakWrites: (table: string, only: string | Record<string, string>) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ops-workspaces"） */
export async function startOpsWs(prefix: string, hookFiles: readonly string[]): Promise<OpsWs> {
  const f = await makeFixture();
  const run = `${prefix}-${Date.now().toString(36)}`;
  const repo = await createRepository(f.pool);
  const mail: OpsWs["mail"] = { calls: [], fail: false };
  const auth = {
    api: {
      sendVerificationEmail: async (a: { body: { email: string } }) => {
        if (mail.fail) throw new Error("試験で落とした送り出し");
        mail.calls.push({ email: a.body.email });
        return { status: true };
      },
    },
  };
  const deps = {
    appPool: f.pool,
    authPool: f.pool,
    repo,
    auth,
    config: { webBaseUrl: "http://127.0.0.1:3123", baseUrl: "http://api.k963.test" },
  } as unknown as HookDeps;
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of hookFiles) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(f.hooks, m.register.make(deps));
    }
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };

  const tenants: string[] = [];
  const opsMembers: string[] = [];
  let opsScope: string | null = null;
  afterAll(async () => {
    const t = [tenants];
    if (tenants.length) {
      // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
      await f.admin.query("delete from notifications where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from inquiries where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from payments where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from invoices where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from usage_meters where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from action_runs where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from sessions where tenant_id = any($1::uuid[])", t);
      await f.admin.query("delete from subscriptions where tenant_id = any($1::uuid[])", t);
    }
    if (opsMembers.length)
      await f.admin.query("delete from ops_members where member_id = any($1::uuid[])", [opsMembers]);
  });

  const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
  const n: OpsWs["n"] = async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
  const row: OpsWs["row"] = async (sql, p = []) => (await f.admin.query(sql, p)).rows[0];
  const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;

  const planId = async (key: PlanKey): Promise<string> => {
    const p = PLANS.find((x) => x.key === key)!;
    await f.admin.query(
      `insert into plans (tenant_id, key, name, price_monthly, limits) values ($1, $2, $3, $4, $5)
       on conflict (tenant_id, key) do nothing`,
      [OPS_TENANT, p.key, p.name, p.price, { members: p.members }],
    );
    return one("select id from plans where tenant_id = $1 and key = $2", [OPS_TENANT, key]);
  };

  const ops: OpsWs["ops"] = async (name, caps = ALL_CAPS) => {
    opsScope ??= await one("insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '') returning id", [
      OPS_TENANT,
      `${run} 運営`,
    ]);
    const p = await f.person(OPS_TENANT, opsScope, { name: `運営 ${name}`, role: "ops" });
    await f.admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, $3)", [
      OPS_TENANT,
      p.id,
      [...caps],
    ]);
    opsMembers.push(p.id);
    return p;
  };

  const member: OpsWs["member"] = async (w, name, o = {}) => {
    let authUserId: string | null = null;
    if (o.authEmail !== null) {
      authUserId = randomUUID();
      await f.admin.query(
        `insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, $4, now(), now())`,
        [authUserId, name, o.authEmail ?? `${run}-${randomUUID().slice(0, 8)}@example.test`, o.verified ?? true],
      );
    }
    const p = await f.person(w.tenantId, w.rootScope, { name, authUserId });
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at) values ($1, $2, $3, $4, 'active', now())",
      [w.tenantId, p.id, authUserId, o.role ?? "member"],
    );
    return p;
  };

  const ws: OpsWs["ws"] = async (label, o = {}) => {
    const name = `${run} ${label}`;
    const c = await f.company(name);
    tenants.push(c.tenantId);
    if (o.createdDaysAgo)
      await f.admin.query("update tenants set created_at = now() - make_interval(days => $2) where id = $1", [
        c.tenantId,
        o.createdDaysAgo,
      ]);
    await f.admin.query(
      "insert into subscriptions (tenant_id, plan_id, status_id, started_at) values ($1, $2, 'active', now() - interval '40 days')",
      [c.tenantId, await planId(o.plan ?? "team")],
    );
    const w = { ...c, name, admin: null as unknown as Person };
    w.admin = await member(w, `管理者 ${label}`, { role: "admin" });
    for (let i = 1; i < (o.members ?? 1); i++) await member(w, `メンバー ${i}`);
    return w;
  };

  const pc: OpsWs["pc"] = async (w, who, o = {}) => {
    await f.admin.query(
      `insert into sessions (tenant_id, member_id, kind_id, device_label, last_seen_at, alive_at)
       values ($1, $2, 'bridge', 'k963 の PC', case when $3 then now() else now() - interval '2 days' end, now() - interval '2 days')`,
      [w.tenantId, who.id, o.alive ?? true],
    );
  };

  const run_: OpsWs["run_"] = async (w, o) => {
    await f.admin.query(
      `insert into action_runs (tenant_id, scope_id, status_id, phase, started_at, finished_at, created_at)
       values ($1, $2, $3, 'execute', now() - make_interval(days => $4), now() - make_interval(days => $4), now() - make_interval(days => $4))`,
      [w.tenantId, w.rootScope, o.status, o.daysAgo ?? 0],
    );
  };

  const invoice: OpsWs["invoice"] = async (w, o) => {
    const id = await one(
      `insert into invoices (tenant_id, period_start, period_end, amount, issued_at, due_on, status_id)
       values ($1, date_trunc('month', now() - interval '1 month')::date, (date_trunc('month', now()) - interval '1 day')::date, $2,
               now() - interval '20 days', (now() - make_interval(days => $3))::date, $4) returning id`,
      [w.tenantId, o.amount, o.dueDaysAgo, o.paid ? "paid" : "unpaid"],
    );
    return id;
  };

  const usage: OpsWs["usage"] = async (w, value, limit) => {
    await f.admin.query(
      "insert into usage_meters (tenant_id, meter_key, period_start, value, limit_value) values ($1, 'runs', date_trunc('month', now())::date, $2, $3)",
      [w.tenantId, value, limit],
    );
  };

  const inquiry: OpsWs["inquiry"] = async (w, o) =>
    one(
      `insert into inquiries (tenant_id, opened_by_member_id, assignee_ops_member_id, title, topic_key, state, last_message_at)
       values ($1, $2, $3, $4, 'trouble', $5, now()) returning id`,
      [w.tenantId, (o.asker ?? w.admin).id, o.assignee ? o.assignee.id : null, o.title ?? "実行待ちのまま", o.state],
    );

  const pwned: OpsWs["pwned"] = async (w, o = {}) => {
    await f.admin.query(
      "insert into security_events (tenant_id, kind_id, member_id, detail) values ($1, $2, $3, '{}'::jsonb)",
      [w.tenantId, o.ack ? "pwned_check_acknowledged" : "pwned_check_unavailable", w.admin.id],
    );
  };

  const call: OpsWs["call"] = (who, method, path, body) =>
    f.req(method, path, { headers: who ? who.auth : {}, ...(body === undefined ? {} : { body }) });

  const breakWrites: OpsWs["breakWrites"] = async (table, only) => {
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
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$ begin if ${when} then raise exception '試験で壊した' using errcode = 'XX000'; end if; return new; end $$`,
    );
    await f.admin.query(
      `create trigger ${fn} before insert or update on ${table} for each row execute function ${fn}()`,
    );
    return async () => {
      await f.admin.query(`drop trigger if exists ${fn} on ${table}`);
      await f.admin.query(`drop function if exists ${fn}()`);
    };
  };

  return {
    f,
    run,
    ops,
    ws,
    member,
    pc,
    run_,
    invoice,
    usage,
    inquiry,
    pwned,
    call,
    json,
    n,
    row,
    mail,
    breakWrites,
    close: () => f.close(),
  };
}

/** 404・409 の体に、欄（field）と details を付けない（在るかを漏らさない・控え帳） */
export const isFlat = (b: Json): boolean => !("field" in b) && !("details" in b) && !("detail" in b);
/** getOpsShell の 6 欄（K-1006 の「画面が使う答えの形」） */
export const SHELL_KEYS = ["inbox", "invoices", "operator", "pwned", "runs_month", "workspaces"];
/** listOpsWorkspaces の 1 行の 11 欄（K-1006） */
export const WS_ROW_KEYS = [
  "admin_name",
  "attention",
  "billing_state",
  "id",
  "members",
  "name",
  "pc",
  "plan_name",
  "runs_month",
  "state",
  "state_since",
];
/** getOpsWorkspace の 12 欄（K-1006） */
export const WS_KEYS = [
  "admin",
  "files",
  "id",
  "name",
  "pc",
  "peek",
  "plan_name",
  "recent",
  "runs_month",
  "state",
  "stop",
  "stuck_runs",
];
/** listOpsWorkspaceMembers の 1 行の 8 欄（K-1006） */
export const MEMBER_KEYS = [
  "email",
  "last_seen_at",
  "login_methods",
  "member_id",
  "name",
  "pc",
  "role_label",
  "verified",
];
/** listOpsWorkspaceInquiries の 1 行の 7 欄・listOpsWorkspaceAudit の 1 行の 7 欄（K-1006） */
export const INQ_KEYS = ["asker_name", "created_at", "id", "owner_name", "state", "title", "topic"];
export const AUDIT_KEYS = ["action", "action_label", "actor_name", "at", "id", "reason", "target_label"];
