// 段 13「顧客がお知らせと稼働状況を読む」口（K-954 listNotices・markNoticeRead／K-955 getServiceStatusForMember）の単体の試験の土台（K-954 が持ち込む・K-955 も使う）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//   組み立ては段 1 の土台 fixture.ts（本物の DB・偽の画面のログイン）と、葉の hooks のファイルを最初の要求のときに読む leaf-hooks.ts（K-364）。
//   お知らせは運営の会社（app.ops_tenant_id()）の行。共用の試験の DB なので、ほかの試験の「全部向け」のお知らせも見える。
//   だから答えを見るときは、この回の題の頭（run）が付いた行だけを見る。終わったらこの回の行を消す（G-10）。
import { afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import { leafHooks } from "../F3/leaf-hooks.js";

/** 運営の会社（0003 の app.ops_tenant_id()） */
export const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
export type Json = Record<string, unknown> & { data?: unknown };

export interface World {
  tenantId: string;
  rootScope: string;
  /** ワークスペースの人（R1〜R3 の側・偽のログインの role member） */
  member: Person;
  /** 同じワークスペースの別の人 */
  other: Person;
  /** 先方の権限の人（偽のログインの role client・D-156.16） */
  guest: Person;
}
export interface NoticeRow {
  kind?: "incident" | "maintenance" | "release";
  title?: string;
  body?: string;
  state?: "draft" | "scheduled" | "published";
  /** 出す時刻（秒・今からの差。負は過去） */
  publishIn?: number | null;
  placements?: readonly string[];
  planIds?: readonly string[] | null;
  tenantId?: string | null;
  tenantIds?: readonly string[] | null;
  /** メンテの時間（秒・今からの差） */
  maintenance?: { fromIn: number; toIn: number } | null;
  impact?: string | null;
  affects?: Record<string, string>;
  deleted?: boolean;
  /** 管理者だけ（notices.admins_only・D-156.57） */
  adminsOnly?: boolean;
  /** 運営の会社でない行にする（入ってはいけない行の確かめ） */
  ownerTenant?: string;
}

export interface Notices {
  f: Fixture;
  /** この回の題の頭 */
  run: string;
  world: (label: string) => Promise<World>;
  call: (who: Person | null, method: string, path: string, body?: unknown) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  n: (sql: string, p?: unknown[]) => Promise<number>;
  /** お知らせを 1 つ置く（題の頭に run が付く）。id を返す */
  notice: (o?: NoticeRow) => Promise<string>;
  /** 障害の今の状態（status_incidents の行）を置く */
  incident: (noticeId: string, state: string, o?: { resolved?: boolean; startedIn?: number }) => Promise<void>;
  /** 障害の続報（notice_updates の行）を置く */
  update: (noticeId: string, state: string, body: string, atIn: number) => Promise<void>;
  /** 運営の会社のプラン（鍵は run を付けて重ならない形）。id を返す */
  plan: (key: string) => Promise<string>;
  /** その会社の契約のプランを決める */
  subscribe: (tenantId: string, planId: string) => Promise<void>;
  /** この回の行だけに絞る */
  mine: (rows: unknown) => Record<string, unknown>[];
  /** 書く口が落ちる準備：notice_deliveries への書き込みのうち、その人の行だけ例外にする。返す関数で外す */
  breakDeliveries: (memberId: string) => Promise<() => Promise<void>>;
  close: () => Promise<void>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "notices-read"） */
export async function startNotices(prefix: string, hookFiles: readonly string[]): Promise<Notices> {
  const f = await makeFixture();
  leafHooks(f, hookFiles);
  const run = `${prefix}-${Date.now().toString(36)}`;
  const made: string[] = [];
  const plans: string[] = [];
  afterAll(async () => {
    if (made.length) {
      await f.admin.query("delete from notice_updates where notice_id = any($1::uuid[])", [made]);
      await f.admin.query("delete from status_incidents where notice_id = any($1::uuid[])", [made]);
      await f.admin.query("delete from notice_deliveries where notice_id = any($1::uuid[])", [made]);
      await f.admin.query("delete from notices where id = any($1::uuid[])", [made]);
    }
    if (plans.length) {
      await f.admin.query("delete from subscriptions where plan_id = any($1::uuid[])", [plans]);
      await f.admin.query("delete from plans where id = any($1::uuid[])", [plans]);
    }
  });
  const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
  const n: Notices["n"] = async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
  const world: Notices["world"] = async (label) => {
    const c = await f.company(`${run} ${label}`);
    const member = await f.person(c.tenantId, c.rootScope, { name: "田中" });
    const other = await f.person(c.tenantId, c.rootScope, { name: "山口" });
    const guest = await f.person(c.tenantId, c.rootScope, { name: "先方の人", role: "client" });
    return { ...c, member, other, guest };
  };
  const call: Notices["call"] = (who, method, path, body) =>
    f.req(method, path, { headers: who ? who.auth : {}, ...(body === undefined ? {} : { body }) });
  const ago = (sec: number | null | undefined) =>
    sec === null || sec === undefined ? null : new Date(Date.now() + sec * 1000).toISOString();
  const notice: Notices["notice"] = async (o = {}) => {
    const id = randomUUID();
    await f.admin.query(
      `insert into notices (id, tenant_id, kind_id, title, body, state, publish_at, placements, target_plan_ids,
                            target_tenant_id, target_tenant_ids, maintenance_from, maintenance_to, impact, affects, deleted_at, admins_only)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id,
        o.ownerTenant ?? OPS_TENANT,
        o.kind ?? "release",
        `${run} ${o.title ?? "お知らせ"}`,
        o.body ?? "本文",
        o.state ?? "published",
        ago(o.publishIn === undefined ? -60 : o.publishIn),
        [...(o.placements ?? ["list"])],
        o.planIds ? [...o.planIds] : null,
        o.tenantId ?? null,
        o.tenantIds ? [...o.tenantIds] : null,
        o.maintenance ? ago(o.maintenance.fromIn) : null,
        o.maintenance ? ago(o.maintenance.toIn) : null,
        o.impact ?? null,
        JSON.stringify(o.affects ?? {}),
        o.deleted ? new Date().toISOString() : null,
        o.adminsOnly ?? false,
      ],
    );
    made.push(id);
    return id;
  };
  const incident: Notices["incident"] = async (noticeId, state, o = {}) => {
    await f.admin.query(
      `insert into status_incidents (tenant_id, notice_id, state, started_at, resolved_at)
       values ($1, $2, $3, now() + make_interval(secs => $4), $5)`,
      [OPS_TENANT, noticeId, state, o.startedIn ?? -600, o.resolved ? new Date().toISOString() : null],
    );
  };
  const update: Notices["update"] = async (noticeId, state, body, atIn) => {
    await f.admin.query(
      `insert into notice_updates (notice_id, state, body, created_at) values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [noticeId, state, body, atIn],
    );
  };
  const plan: Notices["plan"] = async (key) => {
    const r = await f.admin.query<{ id: string }>(
      "insert into plans (tenant_id, key, name) values ($1, $2, $3) returning id",
      [OPS_TENANT, `${run}-${key}`, key],
    );
    plans.push(r.rows[0]!.id);
    return r.rows[0]!.id;
  };
  const subscribe: Notices["subscribe"] = async (tenantId, planId) => {
    await f.admin.query("insert into subscriptions (tenant_id, plan_id, started_at) values ($1, $2, now())", [
      tenantId,
      planId,
    ]);
  };
  const mine: Notices["mine"] = (rows) =>
    (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).filter((r) =>
      String(r["title"] ?? "").startsWith(run),
    );
  const breakDeliveries: Notices["breakDeliveries"] = async (memberId) => {
    const fn = `test_break_${randomUUID().slice(0, 8)}`;
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$
       begin if new.member_id = '${memberId}'::uuid then raise exception '試験で壊した' using errcode = 'XX000'; end if; return new; end $$`,
    );
    await f.admin.query(
      `create trigger ${fn} before insert or update on notice_deliveries for each row execute function ${fn}()`,
    );
    return async () => {
      await f.admin.query(`drop trigger if exists ${fn} on notice_deliveries`);
      await f.admin.query(`drop function if exists ${fn}()`);
    };
  };
  return {
    f,
    run,
    world,
    call,
    json,
    n,
    notice,
    incident,
    update,
    plan,
    subscribe,
    mine,
    breakDeliveries,
    close: () => f.close(),
  };
}

/** 404 の体に、欄（field）と details を付けない（在るかを漏らさない・控え帳） */
export const isFlat = (b: Json): boolean => !("field" in b) && !("details" in b) && !("detail" in b);
