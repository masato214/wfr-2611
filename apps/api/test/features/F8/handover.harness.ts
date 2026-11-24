// 段 9「渡す・配る」の口の試験の共通の土台（K-401 が切る段で書き、carry で運ぶ。K-402 渡す・K-403 受ける／断る・K-404 一緒に切り替えるも使う）。
//   行（it）は葉ごとのファイル handover-base.test.ts（K-401）・handover-pass.test.ts（K-402）・handover-answer-pass.test.ts（K-403）・
//   handover-switch.test.ts（K-404）にある。土台は各ファイルの頭で setupHandover() を 1 回呼ぶ（ファイルごとに本物の DB を立てる）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては K-57・K-60 の土台（../fixture.ts）と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口（createApp と契約の op）・
//   本物の口の振る舞い（apps/api/src/hooks/handovers.ts の register・K-326）。画面のログインだけは偽（Bearer fake:<役>:<会社>:<人>）。
//   メールの送出（関門 C6）だけは試験の偽（貯める・failMailTo の宛ては送れなかったことにする）。
//
// 口の振る舞いの読み込みは、試験の本体（it の中）の h.ready() で 1 回だけする。実装の前（切る段の smoke）に、
//   まだ無いファイルを土台の頭で読みに行って準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
//
// 試験が前提にする形（11_tickets/K-401.md の「口の型」「振り分け」「DB の列と関数」）:
//   previewTicketHandover GET   /tickets/:id/handover-preview → 200 { data: HandoverPreview（鍵 10） }
//   createTicketHandover  POST  /tickets/:id/handovers ← { kind, to_member_id?, to_scope_id?, reason?, ask?, reply_due?, switch?, notify_managers? }
//   answerTicketHandover  PATCH /ticket_handovers/:id  ← { decision: "accept" | "decline", decline_reason?, switch? }
//   listHandoverRules     GET   /handover_rules → 200 { data: [{ id, target, axis_id, axis_name, mode }] }
//   DB：ticket_handovers の列（0072 と K-401 が足す notify_managers・reminded_at・overdue_notified_at・switch_applied・answered_by）・
//       app.handover_answerer・app.handover_kinds・app.handover_blocked・app.handover_default_due・app.handover_mail_mark ほか（K-401）
//   会社とグループ：会社のいちばん上のグループ「営業」（番号の頭 EG）と、その子のグループ「受託開発」（JD）。
//     マネージャーはグループの役割 manager（scope_memberships）で作る（app.manages_scope と同じ決め方・K-409 の土台と同じ）
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";
import type pg from "pg";
import { createRepository } from "@kaname/db/repository";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
/** 段 9 の口の hooks のファイル（K-401）。試験の本体で 1 回だけ読む */
const HOOKS_FILE = join(HERE, "..", "..", "..", "src", "hooks", "handovers.ts");
/** メールのリンクの頭（config.webBaseUrl） */
export const WEB = "https://app.kaname.test";

const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** errors.json の文（code が無ければ目立つ字を返す） */
export const msg = (code: unknown): string =>
  ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${String(code)} が無い）`;

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}
export type J = Record<string, unknown> & {
  data?: Record<string, unknown>;
  code?: string;
  field?: string;
  detail?: Record<string, unknown>;
  details?: { field: string; message: string }[];
};
export interface P extends Person {
  name: string;
  email: string | null;
}
export interface Co {
  tenantId: string;
  /** 営業（いちばん上・EG） */
  eg: string;
  /** 受託開発（営業の子・JD） */
  jd: string;
}
export interface World {
  co: Co;
  /** 担当者（営業・書ける） */
  boss: P;
  /** 営業の書ける人（渡す相手） */
  sato: P;
  /** 営業の書ける人（もう 1 人） */
  suzuki: P;
  /** 営業のマネージャー（グループの役割 manager・書ける） */
  mgr: P;
  /** 営業の閲覧のみの人 */
  viewer: P;
  /** 営業の止まっている人（members.suspended_at） */
  stopped: P;
  /** 営業の招待中の人（所属の status invited） */
  invited: P;
  /** 営業の抜けた人（所属の status left） */
  left: P;
  /** 受託開発の書ける人 */
  jdMember: P;
  /** 受託開発のマネージャー */
  jdMgr: P;
  /** 別の会社とその人 */
  other: Co;
  outsider: P;
}
export interface TicketRef {
  id: string;
  number: string;
}

export interface HandoverHarness {
  f: Fixture;
  /** 口の振る舞いを読み込む（各 it の頭で呼ぶ。2 回目からは何もしない） */
  ready: () => Promise<void>;
  limits: Record<string, number>;
  mails: SentMail[];
  /** この宛てへのメールは送れなかったことにする */
  failMailTo: Set<string>;
  /** 試験ごとに新しい会社と人を作る（試験どうしで人を使い回さない・順番に頼らない） */
  world: () => Promise<World>;
  req: (method: string, path: string, o?: { body?: unknown; headers?: Record<string, string> }) => Promise<Response>;
  json: (r: Response) => Promise<J>;
  /** 渡す前の下見 */
  preview: (p: Person, ticketId: string) => Promise<Response>;
  /** 渡す（体はそのまま送る） */
  create: (p: Person, ticketId: string, body: unknown, o?: { key?: string }) => Promise<Response>;
  /** 答える（体はそのまま送る） */
  answer: (p: Person, handoverId: string, body: unknown, o?: { key?: string }) => Promise<Response>;
  rules: (p: Person) => Promise<Response>;
  /** 引き継いでもらうの正しい体（理由・相手。ほかは o で足す・上書きする） */
  passBody: (to: Person, o?: Record<string, unknown>) => Record<string, unknown>;
  ticket: (
    w: World,
    o?: {
      assignee?: P;
      scope?: string;
      title?: string;
      due?: string | null;
      parent?: string;
      stage?: string;
      completed?: boolean;
      deleted?: boolean;
      draft?: P;
    },
  ) => Promise<TicketRef>;
  /** つながり（関連・派生元）を置く */
  link: (w: World, from: string, to: string, kind: "related" | "derived_from") => Promise<void>;
  /** 渡しの行を DB に直に置く（既定は待っている・引き継いでもらう・相手は sato・渡した人は boss） */
  waiting: (
    w: World,
    o: {
      ticketId: string;
      kind?: string;
      from?: P;
      to?: P | null;
      toScope?: string;
      state?: "waiting" | "accepted" | "declined" | "withdrawn";
      reason?: string;
      replyDue?: string | null;
      switch?: Record<string, unknown>;
    },
  ) => Promise<string>;
  /** そのチケットで AI の実行が動いている形を置く（action_runs running） */
  aiRunning: (w: World, ticketId: string, by: P) => Promise<void>;
  /** そのチケットに決めていない承認の行を置く */
  approvalWaiting: (w: World, ticketId: string, by: P) => Promise<void>;
  handover: (id: string) => Promise<Record<string, unknown> | undefined>;
  handoversOf: (ticketId: string) => Promise<Record<string, unknown>[]>;
  assigneeOf: (ticketId: string) => Promise<string>;
  ticketRow: (ticketId: string) => Promise<Record<string, unknown>>;
  /** その人の受け箱の行（種類で絞る） */
  notes: (memberId: string, kind: string) => Promise<Record<string, unknown>[]>;
  /** その会社の渡しの知らせの行の数（handover. で始まる） */
  handoverNotes: (tenantId: string) => Promise<number>;
  /** その渡しの証跡の数（action で絞る） */
  audits: (handoverOrTicketId: string, action: string) => Promise<number>;
  num: (sql: string, p?: unknown[]) => Promise<number>;
  one: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R>;
  /** その人の会社の文脈（kaname_app・行の守りの中）で SQL を流す */
  asMember: <R = Record<string, unknown>>(p: Person, sql: string, params?: unknown[]) => Promise<R[]>;
  /** その会社の文脈（持ち主の接続・行の守りの外）で SQL を流す。渡していない DB の関数を直に試すとき */
  asOwner: <R = Record<string, unknown>>(p: Person, sql: string, params?: unknown[]) => Promise<R[]>;
  /** asOwner と同じ文脈で 1 つの文を流して確定する（渡していない DB の関数の書いた結果を、後から読んで確かめるとき） */
  asOwnerCommit: <R = Record<string, unknown>>(p: Person, sql: string, params?: unknown[]) => Promise<R[]>;
  /** fn の間だけ、その会社の行を書く所で DB の例外を起こす（その会社の行だけ・ほかの試験に効かせない） */
  breakOn: (table: string, tenantId: string, op: "insert" | "update", fn: () => Promise<void>) => Promise<void>;
  /** console の出力を貯めて返す（fn の間だけ） */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
  /** 日本時間の今日から n 日の日付（YYYY-MM-DD） */
  jstDay: (n: number) => string;
  /** 日本時間の今週の月曜（YYYY-MM-DD） */
  jstMonday: () => string;
}

const DAY = 86_400_000;
const jstOf = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);

export function setupHandover(prefix = "K401"): HandoverHarness {
  const h = {} as HandoverHarness;
  const hooks: Record<string, Hook> = {};
  const limits: Record<string, number> = {};
  const mails: SentMail[] = [];
  const failMailTo = new Set<string>();
  let app: ReturnType<typeof createApp>;
  let loading: Promise<void> | null = null;
  let seq = 0;

  beforeAll(async () => {
    const f = await makeFixture();
    h.f = f;
    const web = async (hd: Headers) => {
      const m = /^Bearer fake:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(hd.get("authorization") ?? "");
      if (!m) return null;
      const ctx: TenantContext = {
        tenantId: m[2]!,
        userId: m[3]!,
        role: m[1] as TenantContext["role"],
        stepUpAt: null,
      };
      return { ctx, termsPending: false, sessionId: "", authUserId: "" };
    };
    Object.assign(hooks, f.hooks);
    app = createApp({
      version: "test",
      repo: await createRepository(f.pool),
      resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
      contract: { hooks, limits },
    });
    // この試験は 1 人で何度も呼ぶ。上限は上限の行だけで確かめ、ほかでは上げておく
    for (const op of [
      "previewTicketHandover",
      "createTicketHandover",
      "answerTicketHandover",
      "listHandoverRules",
      "getTicket",
    ])
      limits[op] = 10_000;
  }, 120_000);

  afterAll(async () => {
    await h.f?.close();
  });

  const admin = () => h.f.admin;
  const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    (await admin().query(sql, p)).rows[0] as R;
  const idOf = async (sql: string, p: unknown[]) => (await one<{ id: string }>(sql, p)).id;

  const person = async (
    tenantId: string,
    scopeId: string,
    name: string,
    o: { ability?: "edit" | "view" | null; email?: boolean } = {},
  ): Promise<P> => {
    let email: string | null = null;
    let authUserId: string | null = null;
    if (o.email !== false) {
      email = `${prefix.toLowerCase()}-${++seq}-${randomUUID().slice(0, 8)}@kaname.test`;
      authUserId = randomUUID();
      await admin().query(
        'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
        [authUserId, name, email],
      );
    }
    const p = await h.f.person(tenantId, scopeId, {
      name,
      ticketAbility: o.ability === undefined ? "edit" : o.ability,
      authUserId,
    });
    return { ...p, name, email };
  };
  const company = async (name: string): Promise<Co> => {
    const c = await h.f.company(name, "EG");
    await admin().query("update scopes set name = '営業' where id = $1", [c.rootScope]);
    const jd = await idOf(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '受託開発', 'JD', $2) returning id",
      [c.tenantId, c.rootScope],
    );
    return { tenantId: c.tenantId, eg: c.rootScope, jd };
  };
  const manager = async (p: P, scope: string) => {
    await admin().query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role, is_primary) values ($1, $2, $3, 'manager', true)",
      [p.tenantId, scope, p.id],
    );
  };

  h.ready = async () => {
    await (loading ??= (async () => {
      const d = {
        appPool: h.f.pool,
        mailer: async (m: SentMail) => {
          if (failMailTo.has(m.to)) throw new Error("送れない（試験）");
          mails.push(m);
        },
        config: { webBaseUrl: WEB, env: "test" },
      } as unknown as HookDeps;
      const m = (await import(HOOKS_FILE)) as { register: HookModule };
      Object.assign(hooks, m.register.make(d));
    })());
  };
  h.limits = limits;
  h.mails = mails;
  h.failMailTo = failMailTo;

  h.world = async () => {
    const co = await company(`${prefix} の会社 ${++seq}`);
    const boss = await person(co.tenantId, co.eg, "高本 聖斗");
    const sato = await person(co.tenantId, co.eg, "佐藤 花子");
    const suzuki = await person(co.tenantId, co.eg, "鈴木 一郎");
    const mgr = await person(co.tenantId, co.eg, "山口 部長");
    await manager(mgr, co.eg);
    const viewer = await person(co.tenantId, co.eg, "閲覧 太郎", { ability: "view" });
    const stopped = await person(co.tenantId, co.eg, "田中 美咲");
    await admin().query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    const invited = await person(co.tenantId, co.eg, "木村 誠");
    await admin().query(
      "insert into tenant_memberships (tenant_id, member_id, role, status) values ($1, $2, 'member', 'invited')",
      [co.tenantId, invited.id],
    );
    const left = await person(co.tenantId, co.eg, "抜けた 人");
    await admin().query(
      "insert into tenant_memberships (tenant_id, member_id, role, status) values ($1, $2, 'member', 'left')",
      [co.tenantId, left.id],
    );
    const jdMember = await person(co.tenantId, co.jd, "受託 次郎");
    const jdMgr = await person(co.tenantId, co.jd, "受託 部長");
    await manager(jdMgr, co.jd);
    const other = await company(`${prefix} の別の会社 ${seq}`);
    const outsider = await person(other.tenantId, other.eg, "別の会社の人");
    return { co, boss, sato, suzuki, mgr, viewer, stopped, invited, left, jdMember, jdMgr, other, outsider };
  };

  h.req = (method, path, o = {}) =>
    Promise.resolve(
      app.request(`http://localhost/api/v1${path}`, {
        method,
        headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...(o.headers ?? {}) },
        ...(o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) }),
      }),
    );
  h.json = async (r) => (await r.clone().json()) as J;
  const keyed = (p: Person, key?: string) => ({ ...p.auth, ...(key ? { "idempotency-key": key } : {}) });
  h.preview = (p, t) => h.req("GET", `/tickets/${t}/handover-preview`, { headers: p.auth });
  h.create = (p, t, body, o = {}) => h.req("POST", `/tickets/${t}/handovers`, { headers: keyed(p, o.key), body });
  h.answer = (p, id, body, o = {}) => h.req("PATCH", `/ticket_handovers/${id}`, { headers: keyed(p, o.key), body });
  h.rules = (p) => h.req("GET", "/handover_rules", { headers: p.auth });
  h.passBody = (to, o = {}) => ({
    kind: "pass",
    to_member_id: to.id,
    reason: "先方と面識があるので、佐藤さんから返したほうが早い",
    ...o,
  });

  h.ticket = async (w, o = {}) => {
    const assignee = o.assignee ?? w.boss;
    const scope = o.scope ?? w.co.eg;
    const kind = await idOf(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [w.co.tenantId],
    );
    const stage = await idOf("select id from ticket_stages where tenant_id = $1 and key = $2", [
      w.co.tenantId,
      o.stage ?? "doing",
    ]);
    let draft: string | null = null;
    if (o.draft)
      draft = await idOf(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
        [w.co.tenantId, o.draft.id, scope],
      );
    const t = await one<TicketRef>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, parent_ticket_id, due_on,
                            completed_at, completed_by, deleted_at, draft_import_id)
       values ($1, $2, '', $3, $4, $5, $6, $6, $7, $8,
               case when $9 then now() end, case when $9 then $6::uuid end, case when $10 then now() end, $11) returning id, number`,
      [
        w.co.tenantId,
        scope,
        kind,
        stage,
        o.title ?? "問い合わせ（山田様）に一次返信する",
        assignee.id,
        o.parent ?? null,
        o.due === undefined ? h.jstDay(7) : o.due,
        o.completed ?? false,
        o.deleted ?? false,
        draft,
      ],
    );
    return t;
  };
  h.link = async (w, from, to, kind) => {
    await admin().query(
      "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $3, $4)",
      [w.co.tenantId, from, to, kind],
    );
  };
  h.waiting = async (w, o) => {
    const state = o.state ?? "waiting";
    const to = o.to === undefined ? (o.toScope ? null : w.sato) : o.to;
    return idOf(
      `insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, to_scope_id, reason, reply_due, switch,
                                     state, decline_reason, decided_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, case when $10 = 'waiting' then null else now() end) returning id`,
      [
        w.co.tenantId,
        o.ticketId,
        o.kind ?? "pass",
        (o.from ?? w.boss).id,
        to?.id ?? null,
        o.toScope ?? null,
        o.reason ?? "先方と面識があるので",
        o.replyDue === undefined ? new Date(Date.now() + 2 * DAY).toISOString() : o.replyDue,
        JSON.stringify(o.switch ?? {}),
        state,
        state === "declined" ? "今週は月次の締めで手が空きません" : null,
      ],
    );
  };
  h.aiRunning = async (w, ticketId, by) => {
    const t = await one<{ scope_id: string }>("select scope_id from tickets where id = $1", [ticketId]);
    await admin().query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, started_at, created_by) values ($1, $2, $3, 'make', 'running', now(), $4)",
      [w.co.tenantId, t.scope_id, ticketId, by.id],
    );
  };
  h.approvalWaiting = async (w, ticketId, by) => {
    const t = await one<{ scope_id: string; assignee_member_id: string }>(
      "select scope_id, assignee_member_id from tickets where id = $1",
      [ticketId],
    );
    const run = await idOf(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, started_at, finished_at, created_by) values ($1, $2, $3, 'make', 'done', now(), now(), $4) returning id",
      [w.co.tenantId, t.scope_id, ticketId, by.id],
    );
    await admin().query(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
       values ($1, $2, 'artifact', $3, $4, $5, $6, 'pending', false, '[]', $6)`,
      [w.co.tenantId, t.scope_id, ticketId, run, t.assignee_member_id, by.id],
    );
  };
  h.handover = async (id) => (await admin().query("select * from ticket_handovers where id = $1", [id])).rows[0];
  h.handoversOf = async (ticketId) =>
    (await admin().query("select * from ticket_handovers where ticket_id = $1 order by created_at", [ticketId])).rows;
  h.assigneeOf = async (ticketId) =>
    (await one<{ a: string }>("select assignee_member_id as a from tickets where id = $1", [ticketId])).a;
  h.ticketRow = async (ticketId) => one("select * from tickets where id = $1", [ticketId]);
  h.notes = async (memberId, kind) =>
    (
      await admin().query(
        "select * from notifications where member_id = $1 and event_kind_id = $2 and deleted_at is null order by created_at",
        [memberId, kind],
      )
    ).rows;
  h.handoverNotes = async (tenantId) =>
    h.num("select count(*) as n from notifications where tenant_id = $1 and event_kind_id like 'handover.%'", [
      tenantId,
    ]);
  h.audits = async (id, action) =>
    h.num(
      "select count(*) as n from audit_events where action = $2 and (target_id = $1 or payload->>'ticket_id' = $1::text)",
      [id, action],
    );
  h.num = async (sql, p = []) => Number((await one<{ n: string }>(sql, p)).n);
  h.one = one;
  h.asMember = async <R = Record<string, unknown>>(p: Person, sql: string, params: unknown[] = []) =>
    withTenant(
      h.f.pool,
      { tenantId: p.tenantId, userId: p.id, role: "member" },
      async (cl) => (await cl.query(sql, params)).rows as R[],
    );
  const ownerRun = async <R>(p: Person, sql: string, params: unknown[], end: "commit" | "rollback"): Promise<R[]> => {
    const cl: pg.PoolClient = await admin().connect();
    try {
      await cl.query("begin");
      await cl.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [p.tenantId, p.id],
      );
      const r = await cl.query(sql, params);
      await cl.query(end);
      return r.rows as R[];
    } catch (e) {
      await cl.query("rollback");
      throw e;
    } finally {
      cl.release();
    }
  };
  h.asOwner = async <R = Record<string, unknown>>(p: Person, sql: string, params: unknown[] = []) =>
    ownerRun<R>(p, sql, params, "rollback");
  h.asOwnerCommit = async <R = Record<string, unknown>>(p: Person, sql: string, params: unknown[] = []) =>
    ownerRun<R>(p, sql, params, "commit");
  h.breakOn = async (table, tenantId, op, fn) => {
    const name = `k401_boom_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    await admin().query(
      `create function app.${name}() returns trigger language plpgsql as $$ begin raise exception '試験で起こした DB の失敗' using errcode = 'XX000'; end $$`,
    );
    await admin().query(
      `create trigger ${name} before ${op} on "${table}" for each row when (new.tenant_id = '${tenantId}'::uuid) execute function app.${name}()`,
    );
    try {
      await fn();
    } finally {
      await admin().query(`drop trigger if exists ${name} on "${table}"`);
      await admin().query(`drop function if exists app.${name}()`);
    }
  };
  h.captureLogs = async (fn) => {
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    try {
      await fn();
    } finally {
      for (const s of spies) s.mockRestore();
    }
    return out.join("\n");
  };
  h.jstDay = (n) => jstOf(Date.now() + n * DAY);
  h.jstMonday = () => {
    const today = new Date(`${jstOf(Date.now())}T00:00:00Z`);
    const dow = (today.getUTCDay() + 6) % 7; // 月曜 0 … 日曜 6
    return new Date(today.getTime() - dow * DAY).toISOString().slice(0, 10);
  };
  return h;
}
