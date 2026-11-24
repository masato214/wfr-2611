// 段 13「請求とプラン（利用者の側）」の口（K-958 getBilling・downloadInvoicePdf／K-959 updateBillingContact／
//   K-961 listWorkspacePlans・changePlan）の単体の試験の土台（K-958 が持ち込む・K-959・K-961 も使う）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//   DB と会社・人の作り方は段 1 の土台 fixture.ts（本物の DB）。口の入口だけは、この土台が自分で組む：
//     本人確認の取り直し（changePlan は契約の step_up が always）の時刻を偽のログインに書けるようにするため（F3/credentials.harness.ts と同じ形）。
//     偽のログイン：Bearer fake:<role>:<tenant>:<member>:<取り直しからの秒|->
//   葉の hooks のファイルは最初の要求のときに 1 回だけ読む（準備で読まない・answer=8f745003d023）。
//   hooks の材料は appPool・repo・objects・config（baseUrl と billing）。請求書・入金・契約の行は、運営の葉（K-981・K-982）が入るまで DB に直に置く。
//   作った会社・行は名前の頭（run）で見分け、afterAll で消す
import { afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
const OPS_TENANT = "00000000-0000-4000-8000-000000000001";

/** 試験の口の住所の頭（config.baseUrl）。PDF の署名 URL はこの頭で始まる */
export const API_BASE = "http://api.k958.test";
/** 試験の設定の支払い条件と振込先（config.billing。本番は BILLING_TERMS・BILLING_PAYEE） */
export const TERMS = "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い";
export const PAYEE = ["試験銀行 本店 普通 0000000", "カ）シケン"];

export type Json = Record<string, unknown> & { data?: unknown; meta?: unknown };
export interface Who {
  id: string;
  tenantId: string;
  role: TenantContext["role"];
}
export interface World {
  tenantId: string;
  rootScope: string;
  name: string;
  /** 管理者（tenant_memberships の admin ＋ tenants の billing の能力） */
  admin: Who;
  /** 「プランと支払い」を付けたメンバー（管理者ではない） */
  payer: Who;
  /** 能力の無いメンバー */
  staff: Who;
  /** 先方の権限の人（偽のログインの role client・D-156.16） */
  guest: Who;
}
export interface InvoiceRow {
  /** 請求の月（YYYY-MM）。period_start はその月の 1 日 */
  month: string;
  /** 税込の円 */
  amount?: number;
  /** 期限（YYYY-MM-DD） */
  dueOn: string;
  /** false なら出していない（issued_at が空＝下書き） */
  issued?: boolean;
  deleted?: boolean;
  /** PDF の置き場の参照を付ける（false で空） */
  pdf?: boolean;
}
export interface Billing {
  f: Fixture;
  run: string;
  limits: Record<string, number>;
  /** メールを送った回（送らないことを確かめる） */
  mails: { to: string; subject: string }[];
  world: (label: string, o?: { plan?: "free" | "team" | "business"; extraMembers?: number }) => Promise<World>;
  /** 口を叩く。stepUpAgoSec は本人確認の取り直しからの秒（省くと取り直していない） */
  call: (
    who: Who | null,
    method: string,
    path: string,
    body?: unknown,
    o?: { stepUpAgoSec?: number; ip?: string },
  ) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  n: (sql: string, p?: unknown[]) => Promise<number>;
  row: <T = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<T | undefined>;
  /** 運営の会社のプランの id（K-958 の migration が置く free・team・business） */
  planId: (key: string) => Promise<string>;
  /** 契約の行を DB に直に置く（started は今からの秒・負なら前。ended も同じ・省くと空） */
  subscribe: (tenantId: string, key: string, o?: { startedSec?: number; endedSec?: number }) => Promise<string>;
  /** 請求書の行を DB に直に置く（K-981 の口を通さない） */
  invoice: (tenantId: string, o: InvoiceRow) => Promise<string>;
  /** 入金の行を DB に直に置く（K-982 の口を通さない。打ち消しは負の額） */
  pay: (invoiceId: string, amount: number, paidOn: string) => Promise<string>;
  /** 書く口が落ちる準備：表への挿入か更新で例外にする引き金を付け、返す関数で外す */
  /** 表への書き込みのうち、only に当たる行（この試験の行）だけを例外にする引き金を付け、返す関数で外す。
   *  only は { 列: 値 }（どれも等しい）か、NEW を使う SQL の式。表全体を落とさない（同じ DB のほかの試験を巻き込まない） */
  breakWrites: (table: string, only: string | Record<string, string>) => Promise<() => Promise<void>>;
  /** 読む口が落ちる準備：アプリの接続から関数を呼べなくし、返す関数で戻す（例 "app.billing_get()"） */
  breakFn: (signature: string) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
}

/** 日本の暦の日（YYYY-MM-DD）。offsetDays だけずらす */
export const jstDay = (offsetDays = 0): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + offsetDays * 86_400_000));
/** 日本の暦の今月（YYYY-MM）から months だけずらした月 */
export const jstMonth = (months = 0): string => {
  const [y, m] = jstDay().split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
/** 日本の暦の来月の 1 日（YYYY-MM-DD） */
export const nextFirst = (): string => `${jstMonth(1)}-01`;
/** 日割り（D-156.31）：月の値段の差（税別）× 今日を含む残りの日 ÷ その月の日数（切り捨て）に、消費税 10%（切り捨て） */
export const prorate = (diff: number): number => {
  const [y, m, d] = jstDay().split("-").map(Number) as [number, number, number];
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const base = Math.floor((diff * (dim - d + 1)) / dim);
  return Math.floor((base * 110) / 100);
};

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "billing-read"） */
export async function startBilling(prefix: string, hookFiles: readonly string[]): Promise<Billing> {
  const f = await makeFixture();
  const run = `${prefix}-${Date.now().toString(36)}`;
  const repo = await createRepository(f.pool);
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k958-obj-"))), {
    signingSecret: "k958-test-files",
  });
  const mails: Billing["mails"] = [];
  const deps = {
    appPool: f.pool,
    repo,
    objects,
    mailer: async (m: { to: string; subject: string }) => {
      mails.push({ to: m.to, subject: m.subject });
    },
    config: { baseUrl: API_BASE, billing: { terms: TERMS, payeeLines: PAYEE } },
  } as unknown as HookDeps;
  const hooks: Record<string, Hook> = {};
  const limits: Record<string, number> = {};
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of hookFiles) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(hooks, m.register.make(deps));
    }
  };
  const web = async (h: Headers) => {
    const m = /^Bearer fake:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36}):(-|\d+)$/.exec(
      h.get("authorization") ?? "",
    );
    if (!m) return null;
    const ctx: TenantContext = {
      tenantId: m[2]!,
      userId: m[3]!,
      role: m[1] as TenantContext["role"],
      stepUpAt: m[4] === "-" ? null : new Date(Date.now() - Number(m[4]) * 1000),
    };
    return { ctx, sessionId: "", authUserId: "", termsPending: false };
  };
  const app = createApp({
    version: "test",
    repo,
    resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
    contract: { hooks, limits },
  });
  const tenants: string[] = [];
  afterAll(async () => {
    if (!tenants.length) return;
    const t = [tenants];
    await f.admin.query("delete from notifications where tenant_id = any($1::uuid[])", t);
    await f.admin.query("delete from payments where tenant_id = any($1::uuid[])", t);
    await f.admin.query("delete from invoices where tenant_id = any($1::uuid[])", t);
    await f.admin.query("delete from plan_change_requests where tenant_id = any($1::uuid[])", t);
    await f.admin.query("delete from subscriptions where tenant_id = any($1::uuid[])", t);
  });
  const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
  const n: Billing["n"] = async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
  const row: Billing["row"] = async (sql, p = []) => (await f.admin.query(sql, p)).rows[0];
  const planId: Billing["planId"] = async (key) =>
    (await row<{ id: string }>("select id from plans where tenant_id = $1 and key = $2 and deleted_at is null", [
      OPS_TENANT,
      key,
    ]))!.id;
  const subscribe: Billing["subscribe"] = async (tenantId, key, o = {}) =>
    (await row<{ id: string }>(
      `insert into subscriptions (tenant_id, plan_id, status_id, started_at, ended_at)
       values ($1, $2, 'active', now() + make_interval(secs => $3), case when $4::int is null then null else now() + make_interval(secs => $4::int) end)
       returning id`,
      [tenantId, await planId(key), o.startedSec ?? -86_400 * 40, o.endedSec ?? null],
    ))!.id;
  const member = async (tenantId: string, scope: string, name: string): Promise<string> =>
    (await row<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id",
      [tenantId, scope, name],
    ))!.id;
  const canPay = async (tenantId: string, id: string) =>
    f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tenants', null, 'billing')",
      [tenantId, id],
    );
  const world: Billing["world"] = async (label, o = {}) => {
    const name = `${run} ${label}`;
    const c = await f.company(name);
    tenants.push(c.tenantId);
    const adminId = await member(c.tenantId, c.rootScope, "高本（管理者）");
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, role, status) values ($1, $2, 'admin', 'active')",
      [c.tenantId, adminId],
    );
    await canPay(c.tenantId, adminId);
    const payerId = await member(c.tenantId, c.rootScope, "経理の佐々木");
    await canPay(c.tenantId, payerId);
    const staffId = await member(c.tenantId, c.rootScope, "田中");
    const guestId = await member(c.tenantId, c.rootScope, "先方の人");
    for (let i = 0; i < (o.extraMembers ?? 0); i++) await member(c.tenantId, c.rootScope, `足した人 ${i + 1}`);
    if (o.plan && o.plan !== "free") await subscribe(c.tenantId, o.plan);
    const who = (id: string, role: TenantContext["role"] = "member"): Who => ({ id, tenantId: c.tenantId, role });
    return {
      ...c,
      name,
      admin: who(adminId),
      payer: who(payerId),
      staff: who(staffId),
      guest: who(guestId, "client"),
    };
  };
  const call: Billing["call"] = async (who, method, path, body, o = {}) => {
    await (loading ??= load());
    const step = o.stepUpAgoSec === undefined ? "-" : String(o.stepUpAgoSec);
    const auth = who ? { authorization: `Bearer fake:${who.role}:${who.tenantId}:${who.id}:${step}` } : {};
    return Promise.resolve(
      app.request(`http://localhost/api/v1${path}`, {
        method,
        headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp(), ...auth },
        ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      }),
    );
  };
  const invoice: Billing["invoice"] = async (tenantId, o) => {
    const id = randomUUID();
    await f.admin.query(
      `insert into invoices (id, tenant_id, period_start, period_end, amount, issued_at, due_on, status_id, pdf_ref, deleted_at)
       values ($1, $2, ($3 || '-01')::date, (($3 || '-01')::date + interval '1 month' - interval '1 day')::date, $4,
               case when $5 then (($3 || '-01')::date + interval '1 month')::timestamptz end, $6::date, 'issued', $7,
               case when $8 then now() end)`,
      [
        id,
        tenantId,
        o.month,
        o.amount ?? 16_500,
        o.issued ?? true,
        o.dueOn,
        o.pdf === false ? null : `tenants/${tenantId}/${randomUUID()}`, // 置き場の関門 objects.put が作る鍵の形（parseRef は tenants/<会社>/<uuid> だけ署名する）
        o.deleted ?? false,
      ],
    );
    return id;
  };
  const pay: Billing["pay"] = async (invoiceId, amount, paidOn) =>
    (await row<{ id: string }>(
      "insert into payments (tenant_id, invoice_id, paid_on, amount, method_id) select tenant_id, id, $2::date, $3, 'transfer' from invoices where id = $1 returning id",
      [invoiceId, paidOn, amount],
    ))!.id;
  const breakWrites: Billing["breakWrites"] = async (table, only) => {
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
  const breakFn: Billing["breakFn"] = async (signature) => {
    await f.admin.query(`revoke execute on function ${signature} from kaname_app`);
    await f.admin.query(`revoke execute on function ${signature} from public`);
    return async () => {
      await f.admin.query(`grant execute on function ${signature} to kaname_app`);
    };
  };
  return {
    f,
    run,
    limits,
    mails,
    world,
    call,
    json,
    n,
    row,
    planId,
    subscribe,
    invoice,
    pay,
    breakWrites,
    breakFn,
    close: () => f.close(),
  };
}

/** 404・409 の体に、欄（field）と details を付けない（在るかを漏らさない・控え帳） */
export const isFlat = (b: Json): boolean => !("field" in b) && !("details" in b);
/** getBilling の 7 欄（K-1005 の「画面が使う答えの形」） */
export const BILLING_KEYS = ["can_edit_contact", "contact", "free", "invoices", "overdue", "payee", "terms"];
/** 請求書の 1 行（払われていない 6 欄・払われたら paid_on を足して 7 欄） */
export const INVOICE_KEYS = ["amount_total", "due_on", "id", "issued_on", "month", "state"];
/** 選べるプランの 1 行の 12 欄（K-1005・summary・recommended・upgrade・upcoming は D-156.43） */
export const PLAN_KEYS = [
  "can_choose",
  "current",
  "effective_from",
  "member_limit",
  "name",
  "plan_key",
  "price_monthly",
  "reason",
  "recommended",
  "summary",
  "upcoming",
  "upgrade",
];
