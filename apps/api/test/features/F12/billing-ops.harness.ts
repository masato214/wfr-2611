// 段 13「運営の請求」の口（K-981 issueOpsInvoices／K-1013 請求書の PDF／K-982 recordPayment／K-983 listOpsInvoices と期限を過ぎた知らせ）の
//   単体の試験の土台（K-981 が持ち込む・K-982・K-983・K-1013・K-1107・K-1109 も使う。送ったメールを覗く mails・failMailTo は K-1109 が足した）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//   会社・人・契約・請求書・入金の行の作り方は billing.harness.ts（K-958）をそのまま使う（world・subscribe・invoice・pay・n・row）。
//   口の入口だけは、この土台が自分で組む：置き場（関門 C4）の実体を試験から覗けて、わざと落とせる物に差し替えるため（K-1013 の PDF）。
//     偽のログイン：Bearer fake:<role>:<tenant>:<member>:<取り直しからの秒|->（billing.harness.ts と同じ形）
//   運営の人は運営の会社の members と ops_members の行（ops-workspace-billing.test.ts の opsWho と同じ作り方）。
//   請求の月は試験ごとに昔の月（2019 年）を使う：共用の試験の DB にはほかの試験の会社と契約が残るので、昔の月の初日に効いていた契約は
//   この土台で作った物だけになる。答えの一覧は名前の頭（run）で自分の会社だけを見る。葉の hooks のファイルは最初の要求のときに 1 回だけ読む
import { afterAll } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectStore, type StorageDriver, type ObjectMeta } from "@kaname/storage";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { nextIp } from "../fixture.js";
import { startBilling, PAYEE, TERMS, type Billing, type Who, type World } from "./billing.harness.js";

export { jstDay, jstMonth, isFlat, type Json, type Who, type World } from "./billing.harness.js";
const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
export const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
/** 本人確認を 1 分前に取り直した（15 分の内） */
export const STEP = 60;
/** 試験の設定のインボイスの登録番号と出す人（K-1013・config.billing。本番は BILLING_INVOICE_NO・BILLING_ISSUER） */
export const INVOICE_NO = "T0000000000000";
export const ISSUER = "試験の運営";
/** listOpsInvoices の 1 行の 11 欄（K-1005 の「画面が使う答えの形」・payments は D-156.44） */
export const OPS_ROW_KEYS = [
  "amount_total",
  "can_record_payment",
  "difference",
  "due_on",
  "id",
  "month",
  "paid_total",
  "payments",
  "plan_name",
  "state",
  "workspace",
];
/** issueOpsInvoices の 4 欄と 1 行の 6 欄（K-1005） */
export const ISSUE_KEYS = ["count", "lines", "month", "total"];
export const LINE_KEYS = ["amount", "plan_name", "prorated", "tax", "total", "workspace"];

export interface PutCall {
  key: string;
  contentType: string;
  size: number;
}
export interface Store {
  /** 置いた物（鍵 → 中身）。消した物は抜ける */
  objects: Map<string, Uint8Array>;
  puts: PutCall[];
  deletes: string[];
  /** n 回目の置く（1 から数える）で例外にする。0 なら落とさない */
  failPutAt: number;
  /** 消すを例外にする */
  failDelete: boolean;
}
export interface BillingOps extends Omit<Billing, "call" | "mails"> {
  store: Store;
  /** 運営の人（運営の会社の members ＋ ops_members の caps） */
  opsWho: (name: string, caps: readonly string[]) => Promise<Who>;
  /** 口を叩く（stepUpAgoSec は本人確認の取り直しからの秒・省くと取り直していない） */
  call: (
    who: Who | null,
    method: string,
    path: string,
    body?: unknown,
    o?: { stepUpAgoSec?: number; ip?: string },
  ) => Promise<Response>;
  /** 昔の月の初日から効いている契約の行（startIso・endIso は YYYY-MM-DD・日本時間の 0 時） */
  contract: (w: World, key: string, startIso: string, endIso?: string | null) => Promise<string>;
  /** プランを変えた頼みの行（K-961 の plan_change_requests）を直に置く */
  planRequest: (
    w: World,
    o: {
      from: string;
      to: string;
      status: "applied" | "scheduled" | "cancelled";
      effectiveFrom: string;
      prorated: number;
    },
  ) => Promise<string>;
  /** その会社の、その月（YYYY-MM）の出した請求書の行 */
  invoiceOf: (w: World, month: string) => Promise<Record<string, unknown> | undefined>;
  /** 管理者・プランと支払いの人・ほかの人に届いた鈴の数（種類ごと） */
  bells: (w: World, kind: string) => Promise<{ admin: number; payer: number; staff: number }>;
  /** この回の会社の行だけに絞る（一覧の行の workspace.name か、下書きの行の workspace.name） */
  mine: (rows: unknown) => Record<string, unknown>[];
  /** 送出の 1 か所（deps.mailer）が送ったメール（K-1109 が足した・添付つき） */
  mails: SentMail[];
  /** この宛先へのメールだけ送出を落とす（K-1109）。空の集まりなら落とさない */
  failMailTo: Set<string>;
}
/** 送ったメール（K-1109） */
export interface SentMail {
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Uint8Array; contentType: string }[];
}

const memoryDriver = (s: Store): StorageDriver => {
  let n = 0;
  return {
    put: async (key: string, body: Uint8Array, meta: ObjectMeta) => {
      n += 1;
      if (s.failPutAt && n === s.failPutAt) throw new Error("試験で落とした置き場");
      s.objects.set(key, body);
      s.puts.push({ key, contentType: meta.contentType, size: meta.size });
    },
    get: async (key: string) => {
      const body = s.objects.get(key);
      return body ? { body, meta: { size: body.byteLength, contentType: "application/pdf" } } : null;
    },
    delete: async (key: string) => {
      if (s.failDelete) throw new Error("試験で落とした消す");
      s.deletes.push(key);
      return s.objects.delete(key);
    },
  };
};

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ops-invoices-issue"） */
export async function startBillingOps(prefix: string, hookFiles: readonly string[]): Promise<BillingOps> {
  const b = await startBilling(prefix, []);
  const f = b.f;
  const store: Store = { objects: new Map(), puts: [], deletes: [], failPutAt: 0, failDelete: false };
  const mails: SentMail[] = [];
  const failMailTo = new Set<string>();
  const repo = await createRepository(f.pool);
  const objects = new ObjectStore(repo, memoryDriver(store), { signingSecret: "k981-test-files" });
  const deps = {
    appPool: f.pool,
    repo,
    objects,
    mailer: async (m: Omit<SentMail, "attachments"> & { attachments?: SentMail["attachments"] }) => {
      if (failMailTo.has(m.to)) throw new Error("試験で落とした送出");
      mails.push({ to: m.to, subject: m.subject, text: m.text, attachments: m.attachments ?? [] });
    },
    config: {
      baseUrl: "http://api.k981.test",
      billing: { terms: TERMS, payeeLines: PAYEE, invoiceNo: INVOICE_NO, issuer: ISSUER },
    },
  } as unknown as HookDeps;
  const hooks: Record<string, Hook> = {};
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
    contract: { hooks, limits: b.limits },
  });
  const opsIds: string[] = [];
  // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
  afterAll(async () => {
    if (opsIds.length) await f.admin.query("delete from ops_members where member_id = any($1::uuid[])", [opsIds]);
  });
  const opsWho: BillingOps["opsWho"] = async (name, caps) => {
    const scope = (await b.row<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '') returning id",
      [OPS_TENANT, `${b.run} 運営 ${name}`],
    ))!.id;
    const p = await f.person(OPS_TENANT, scope, { name: `運営 ${name}`, role: "ops" });
    await f.admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, $3)", [
      OPS_TENANT,
      p.id,
      [...caps],
    ]);
    opsIds.push(p.id);
    return { id: p.id, tenantId: OPS_TENANT, role: "ops" };
  };
  const world: Billing["world"] = (label, o) => b.world(label, o);
  const call: BillingOps["call"] = async (who, method, path, body, o = {}) => {
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
  /** 終わりの日を渡さなければ、始まりの 3 年後の 1 月 1 日で終わる（ファイルごとに年を分けているので、ほかのファイル・後の回の「出す」に拾われない） */
  const contract: BillingOps["contract"] = async (
    w,
    key,
    startIso,
    endIso = `${Number(startIso.slice(0, 4)) + 3}-01-01`,
  ) =>
    (await b.row<{ id: string }>(
      `insert into subscriptions (tenant_id, plan_id, status_id, started_at, ended_at)
       values ($1, $2, 'active', ($3::date)::timestamp at time zone 'Asia/Tokyo',
               case when $4::date is null then null else ($4::date)::timestamp at time zone 'Asia/Tokyo' end)
       returning id`,
      [w.tenantId, await b.planId(key), startIso, endIso],
    ))!.id;
  const planRequest: BillingOps["planRequest"] = async (w, o) =>
    (await b.row<{ id: string }>(
      `insert into plan_change_requests (tenant_id, from_plan_id, to_plan_id, requested_by, status_id, effective_from, prorated_amount)
       values ($1, $2, $3, $4, $5, $6::date, $7) returning id`,
      [w.tenantId, await b.planId(o.from), await b.planId(o.to), w.admin.id, o.status, o.effectiveFrom, o.prorated],
    ))!.id;
  const invoiceOf: BillingOps["invoiceOf"] = (w, month) =>
    b.row(
      `select * from invoices where tenant_id = $1 and period_start = ($2 || '-01')::date
         and issued_at is not null and deleted_at is null`,
      [w.tenantId, month],
    );
  const bells: BillingOps["bells"] = async (w, kind) => {
    const c = (m: Who) =>
      b.n(
        "select count(*) as n from notifications where tenant_id = $1 and member_id = $2 and channel_id = 'inapp' and event_kind_id = $3",
        [w.tenantId, m.id, kind],
      );
    return { admin: await c(w.admin), payer: await c(w.payer), staff: await c(w.staff) };
  };
  const mine: BillingOps["mine"] = (rows) =>
    (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).filter((r) =>
      String((r["workspace"] as { name?: string } | undefined)?.name ?? "").startsWith(b.run),
    );
  return { ...b, world, store, opsWho, call, contract, planRequest, invoiceOf, bells, mine, mails, failMailTo };
}
