// K-6 取引先（0074）の行の守り。
//   ナレッジの行の守りは、段 10 の K-674 で棚（会社・グループ・自分）の決めに作り直し、試験は packages/db/test/knowledge_shelves.test.ts に移した。
//   取引先：社内は 全員／担当グループだけ・取引先の人は自分の取引先の中だけ・見せると決めたチケットだけ・依頼は依頼できる人だけ
//   柵：取引先の人・PC の文脈では、会社の人の守りを通れない（app.member_ok・ZT2）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let boss: TenantContext, staff: TenantContext, other: TenantContext;
let kindA: string, todoA: string;

const q = async <T = Record<string, unknown>>(ctx: TenantContext, sql: string, p: unknown[] = []) =>
  withTenant(app, ctx, async (c) => (await c.query(sql, p)).rows as T[]);
const fails = async (ctx: TenantContext, sql: string, p: unknown[] = []) => {
  try {
    await q(ctx, sql, p);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
const one = async (sql: string, p: unknown[] = []) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;
const rows = async (ctx: TenantContext, t: string, id: string) =>
  (await q(ctx, `select id from "${t}" where id = $1`, [id])).length;
const id1 = async (ctx: TenantContext, sql: string, p: unknown[]) => (await q<{ id: string }>(ctx, sql, p))[0]!.id;

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = new pg.Pool({ connectionString: APP_URL, max: 3 });
  boss = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
  staff = { tenantId: S.tenantA, userId: S.staffA, role: "member" };
  const bossB = await one("select id from members where tenant_id = $1 and display_name = '別会社'", [S.tenantB]);
  other = { tenantId: S.tenantB, userId: bossB, role: "member" };
  kindA = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [S.tenantA]);
  todoA = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [S.tenantA]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("取引先（D-128.53・D-128.54）と、取引先の人（D-125.121・D-125.122）", () => {
  let cli: string, cliMember: string, client: TenantContext, viewerMember: string, viewer: TenantContext;
  beforeAll(async () => {
    cli = await id1(boss, "insert into clients (tenant_id, name) values ($1, 'セイコー') returning id", [S.tenantA]);
    // 先方の人のアカウント（会社のメンバーの行を持ち、先方の人に結ぶ）
    const mk = async (name: string) =>
      one(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id",
        [S.tenantA, S.scopeRootA, name],
      );
    cliMember = await mk("山田（セイコー）");
    viewerMember = await mk("鈴木（セイコー）");
    await admin.query(
      "insert into client_contacts (tenant_id, client_id, name, member_id, role) values ($1, $2, '山田', $3, 'requester'), ($1, $2, '鈴木', $4, 'viewer')",
      [S.tenantA, cli, cliMember, viewerMember],
    );
    client = { tenantId: S.tenantA, userId: cliMember, role: "client" };
    viewer = { tenantId: S.tenantA, userId: viewerMember, role: "client" };
  });
  it("社内：全員に見える取引先は全員、担当グループだけにすると担当グループの人と担当だけ", async () => {
    expect(await rows(staff, "clients", cli)).toBe(1);
    await q(boss, "update clients set visibility = 'groups' where id = $1", [cli]);
    expect(await rows(staff, "clients", cli)).toBe(0);
    await q(boss, "insert into client_groups (tenant_id, client_id, scope_id) values ($1, $2, $3)", [
      S.tenantA,
      cli,
      S.scopeDeptA,
    ]);
    expect(await rows(staff, "clients", cli)).toBe(1);
    expect(await rows(other, "clients", cli)).toBe(0);
  });
  it("取引先の人は自分の取引先だけ。同じ取引先の人どうしは見える", async () => {
    const cli2 = await id1(boss, "insert into clients (tenant_id, name) values ($1, '京蟻') returning id", [S.tenantA]);
    expect(await rows(client, "clients", cli)).toBe(1);
    expect(await rows(client, "clients", cli2)).toBe(0);
    expect((await q(client, "select id from client_contacts where client_id = $1", [cli])).length).toBe(2);
  });
  it("依頼は依頼できる人が自分として出す。見るだけの人は出せない。同じ取引先の人は互いの依頼が見える", async () => {
    const contact = (
      await admin.query<{ id: string }>("select id from client_contacts where member_id = $1", [cliMember])
    ).rows[0]!.id;
    const vContact = (
      await admin.query<{ id: string }>("select id from client_contacts where member_id = $1", [viewerMember])
    ).rows[0]!.id;
    const r = await id1(
      client,
      "insert into client_requests (tenant_id, client_id, contact_id, title) values ($1, $2, $3, '11 月分の請求書') returning id",
      [S.tenantA, cli, contact],
    );
    expect(await rows(viewer, "client_requests", r)).toBe(1);
    expect(
      await fails(
        viewer,
        "insert into client_requests (tenant_id, client_id, contact_id, title) values ($1, $2, $3, 'x')",
        [S.tenantA, cli, vContact],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        viewer,
        "insert into client_requests (tenant_id, client_id, contact_id, title) values ($1, $2, $3, 'x')",
        [S.tenantA, cli, contact],
      ),
    ).toMatch(/row-level security/);
  });
  it("チケットは会社が見せると決めたものだけ（既定は社内だけ）", async () => {
    const t = await id1(
      boss,
      "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number, client_id) values ($1, $2, $3, $4, '請求書を送る', '', $5) returning id",
      [S.tenantA, S.scopeRootA, kindA, todoA, cli],
    );
    expect(await rows(client, "tickets", t)).toBe(0);
    await q(boss, `update tickets set client_share = '{"progress": true}'::jsonb where id = $1`, [t]);
    expect(await rows(client, "tickets", t)).toBe(1);
    expect((await q(client, "update tickets set title = 'x' where id = $1 returning id", [t])).length).toBe(0);
  });
  it("検収は頼まれた本人が返す。直してほしいなら何をかが要る", async () => {
    const t = await id1(
      boss,
      "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number, client_id) values ($1, $2, $3, $4, '見積', '', $5) returning id",
      [S.tenantA, S.scopeRootA, kindA, todoA, cli],
    );
    const contact = (
      await admin.query<{ id: string }>("select id from client_contacts where member_id = $1", [cliMember])
    ).rows[0]!.id;
    const a = await id1(
      boss,
      "insert into acceptances (tenant_id, ticket_id, contact_id) values ($1, $2, $3) returning id",
      [S.tenantA, t, contact],
    );
    expect(await rows(viewer, "acceptances", a)).toBe(1);
    expect(
      (await q(viewer, "update acceptances set result = 'ok', decided_at = now() where id = $1 returning id", [a]))
        .length,
    ).toBe(0);
    expect(await fails(client, "update acceptances set result = 'fix', decided_at = now() where id = $1", [a])).toMatch(
      /check/,
    );
    expect(
      (await q(client, "update acceptances set result = 'ok', decided_at = now() where id = $1 returning id", [a]))
        .length,
    ).toBe(1);
  });
  it("★柵：取引先の人は、会社の人の文脈（member）を名乗っても会社の人の守りを通れない", async () => {
    const asMember: TenantContext = { tenantId: S.tenantA, userId: cliMember, role: "member" };
    expect((await q(asMember, "select id from scopes")).length).toBe(0);
    expect((await q(asMember, "select id from ticket_kinds")).length).toBe(0);
    expect((await q(asMember, "select id from clients")).length).toBe(0);
  });
  it("★柵：会社の人が client・device の文脈になっても、会社の人の守りを通れない", async () => {
    for (const role of ["client", "device"] as const) {
      const ctx: TenantContext = { tenantId: S.tenantA, userId: S.bossA, role };
      expect((await q(ctx, "select id from ticket_kinds")).length, role).toBe(0);
      expect((await q(ctx, "select id from tickets")).length, role).toBe(0);
    }
  });
});
