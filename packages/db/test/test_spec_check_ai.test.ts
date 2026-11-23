// K-435「機械・AI が確認項目にチェックを付ける・外す道（DB の関数 app.test_spec_check_by_ai）」の単体の試験（本物の DB）。
// 名前の頭の行 ID（K435-DB-…）は 11_tickets/K-435.md の表の行に 1 対 1 で結ぶ。呼ぶのは検査を流す段（段 6）。この葉は関数を用意して確かめるだけで、口は作らない。
//   app.test_spec_check_by_ai(p_spec uuid, p_checked boolean default true) returns jsonb
//     付ける（true）＝checked_at を入れ、checked_by_ai を true に・checked_by_member_id は空のまま。外す（false）＝3 つとも空に戻す
//     何かが変わったときだけ版 +1。同じ状態なら {ok: true, unchanged: true} で何も書かない
//     同じ取引でやり取りに 1 行（kind change・author_member_id は空・本文の名前は「AI」。app.test_spec_log の p_by_ai = true）と証跡 test_spec.check_ai
//     答えは {ok: true, row: SpecItem（id・title・checked・position・source）} か {error: "not_found" | "done"}
//     行が無い・消した・チケットが消された・別の会社の文脈 → not_found。チケットが完了 → done（完了後は付け外しできない・D-150.56）
//   テストはチケットを作る人が書き、実装する人は変えない。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let boss: TenantContext;
let other: TenantContext;
let kindA: string;

type Reply = {
  ok?: boolean;
  unchanged?: boolean;
  error?: string;
  row?: { id: string; title: string; checked: boolean; position: number; source: string };
};
const callAi = async (ctx: TenantContext, spec: string, checked?: boolean): Promise<Reply> =>
  withTenant(app, ctx, async (c) => {
    const r =
      checked === undefined
        ? await c.query("select app.test_spec_check_by_ai($1::uuid) as v", [spec])
        : await c.query("select app.test_spec_check_by_ai($1::uuid, $2::boolean) as v", [spec, checked]);
    return r.rows[0].v as Reply;
  });
const one = async (sql: string, p: unknown[] = []) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;
/** チケットを管理の接続で直に入れる（行の守りの外）。確認項目の行も直に入れる */
const ticketWithSpec = async (title = "宛名を確かめる"): Promise<{ ticket: string; spec: string }> => {
  const stage = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo' and deleted_at is null", [
    S.tenantA,
  ]);
  const ticket = await one(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, updated_by)
     values ($1, $2, '', $3, $4, '請求書を送る', $5, $5, $5) returning id`,
    [S.tenantA, S.scopeRootA, kindA, stage, S.bossA],
  );
  const spec = await one(
    "insert into test_specs (tenant_id, ticket_id, check_kind, title, created_by, updated_by) values ($1, $2, 'human', $3, $4, $4) returning id",
    [S.tenantA, ticket, title, S.bossA],
  );
  return { ticket, spec };
};
const specRow = async (id: string) =>
  (
    await admin.query<{
      version: number;
      checked_at: Date | null;
      checked_by_member_id: string | null;
      checked_by_ai: boolean;
    }>("select version, checked_at, checked_by_member_id, checked_by_ai from test_specs where id = $1", [id])
  ).rows[0]!;
const lines = async (ticket: string) =>
  (
    await admin.query<{
      author_member_id: string | null;
      body: string;
      changes: { field: string; from: unknown; to: unknown; note?: string }[];
    }>(
      "select author_member_id, body, changes from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at, id",
      [ticket],
    )
  ).rows;
const audits = async (spec: string) =>
  Number(
    (
      await admin.query<{ n: string }>(
        "select count(*) as n from audit_events where action = 'test_spec.check_ai' and target_id = $1",
        [spec],
      )
    ).rows[0]!.n,
  );

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
  const bossB = await one("select id from members where tenant_id = $1 and display_name = '別会社'", [S.tenantB]);
  other = { tenantId: S.tenantB, userId: bossB, role: "member" };
  kindA = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [S.tenantA]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("K-435 機械・AI がチェックを付ける・外す（app.test_spec_check_by_ai）", () => {
  it("K435-DB-001 AI が付ける：checked_by_ai が true・付けた人（member）は空・版 +1・やり取りに author が空の「AI が…にチェックを付けました」の 1 行・証跡 1。同じ状態をもう一度付けても何も動かない", async () => {
    const { ticket, spec } = await ticketWithSpec();
    const before = await specRow(spec);
    const r = await callAi(boss, spec, true);
    expect(r.ok).toBe(true);
    expect(r.row).toMatchObject({ id: spec, title: "宛名を確かめる", checked: true, position: 1, source: "manual" });
    expect(await specRow(spec)).toMatchObject({
      checked_by_member_id: null,
      checked_by_ai: true,
      version: before.version + 1,
    });
    expect((await specRow(spec)).checked_at).not.toBeNull();
    const ls = await lines(ticket);
    expect(ls).toEqual([
      {
        author_member_id: null,
        body: "AI が確認項目『宛名を確かめる』にチェックを付けました",
        changes: [{ field: "test_spec", from: false, to: true, note: "宛名を確かめる" }],
      },
    ]);
    expect(await audits(spec)).toBe(1);
    const again = await callAi(boss, spec);
    expect(again).toMatchObject({ ok: true, unchanged: true });
    expect((await specRow(spec)).version).toBe(before.version + 1);
    expect((await lines(ticket)).length).toBe(1);
    expect(await audits(spec)).toBe(1);
  });

  it("K435-DB-002 AI が外す（p_checked = false）：3 つの列が空に戻る・版 +1・やり取りに author が空の「AI が…のチェックを外しました」の 1 行", async () => {
    const { ticket, spec } = await ticketWithSpec("請求書の金額を確かめる");
    await callAi(boss, spec, true);
    const mid = await specRow(spec);
    const r = await callAi(boss, spec, false);
    expect(r.ok).toBe(true);
    expect(r.row!.checked).toBe(false);
    expect(await specRow(spec)).toMatchObject({
      checked_at: null,
      checked_by_member_id: null,
      checked_by_ai: false,
      version: mid.version + 1,
    });
    const ls = await lines(ticket);
    expect(ls.length).toBe(2);
    expect(ls[1]).toEqual({
      author_member_id: null,
      body: "AI が確認項目『請求書の金額を確かめる』のチェックを外しました",
      changes: [{ field: "test_spec", from: true, to: false, note: "請求書の金額を確かめる" }],
    });
  });

  it("K435-DB-003 付けられない場合：完了したチケット → done・消した行・無い id・別の会社の文脈 → not_found。どれも行・やり取り・証跡は変わらない", async () => {
    const done = await ticketWithSpec();
    await admin.query(
      `update tickets t set stage_id = s.id, completed_at = now(), completed_by = t.assignee_member_id
         from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = 'done'`,
      [done.ticket],
    );
    expect(await callAi(boss, done.spec, true)).toMatchObject({ error: "done" });
    const gone = await ticketWithSpec();
    await admin.query("update test_specs set deleted_at = now() where id = $1", [gone.spec]);
    expect(await callAi(boss, gone.spec, true)).toMatchObject({ error: "not_found" });
    expect(await callAi(boss, "00000000-0000-4000-8000-0000000000aa", true)).toMatchObject({ error: "not_found" });
    const mine = await ticketWithSpec();
    expect(await callAi(other, mine.spec, true)).toMatchObject({ error: "not_found" });
    for (const x of [done, gone, mine]) {
      expect((await specRow(x.spec)).checked_at, x.spec).toBeNull();
      expect((await lines(x.ticket)).length, x.spec).toBe(0);
      expect(await audits(x.spec), x.spec).toBe(0);
    }
  });
});
