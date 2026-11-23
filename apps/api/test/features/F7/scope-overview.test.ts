// K-477「グループの概要を読む」の単体の試験（口・本物の DB）。名前の頭の行 ID（K477-API-…）は 11_tickets/K-477.md の行の表と 1 対 1。
// 口：GET /api/v1/scopes/:id/overview（getScopeOverview）。読むだけ。
//   答え：{ by_stage: [{ stage: { id, key, name }, count }], milestones: [], recent: [{ ticket: { id, number, title }, at, by: { id, display_name } | null, kind, text, count }], total }
//   見える範囲：そのグループとその下のグループのチケットのうち、呼んだ人に見える（行の守り）・消していない・他人の取り込みの下書きでない物。
//   見えないグループの 404 の code は 2 通り：入口の行の確かめ（op.ts・scopes は行の守りで見える物）が先に返す無い uuid・別の会社の人・別の会社のグループは NOT_FOUND、口が返す見えるが席の木の外・消したグループは E-PAGE-001。
//   最近の更新：直近 14 日のやり取り（書き込み・変更の 1 行・仕組みの 1 行）がある物を、チケットごとに最新の 1 行にまとめ、新しい順に 10 件まで。count は 14 日の中の件数。
// 口の振る舞いは apps/api/src/hooks/scope-overview.ts。口の振る舞いは準備では読まず、最初の要求の前に 1 回だけ読む（切る段の smoke の決まり）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import type { Hook } from "../../../src/contract/deps.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
interface World {
  tenantId: string;
  root: string;
  g1: string;
  g1a: string; // g1 の下
  g2: string;
  top: Person; // root の席（全部見える）
  a: Person; // g1 の席（g1 と g1a が見える）
  a2: Person; // g1a の席
  b: Person; // g2 の席
  outsider: Person;
  otherRoot: string; // 別の会社の root
}

type J = Record<string, unknown> & { data?: Record<string, unknown> };
const json = async (r: Response) => (await r.clone().json()) as J;
const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await f.admin.query(sql, p)).rows[0] as R;
const dataOf = async (r: Response) => (await json(r)).data as unknown as Overview;
interface Overview {
  by_stage: { stage: { id: string; key: string | null; name: string }; count: number }[];
  milestones: unknown[];
  recent: {
    ticket: { id: string; number: string; title: string };
    at: string;
    by: { id: string; display_name: string } | null;
    kind: string;
    text: string;
    count: number;
  }[];
  total: number;
}
const overview = (who: Person, scope: string) => f.req("GET", `/scopes/${scope}/overview`, { headers: who.auth });
const overviewOk = async (who: Person, scope: string): Promise<Overview> => {
  const r = await overview(who, scope);
  expect(r.status, await r.clone().text()).toBe(200);
  return dataOf(r);
};
const counts = (o: Overview) => Object.fromEntries(o.by_stage.map((x) => [x.stage.key ?? x.stage.name, x.count]));

/** 新しい会社を作り、その中にグループと人を置く（試験ごとの会社＝ほかの試験の物と混ぜない）。試験ごとに呼ぶ */
async function world(label: string): Promise<World> {
  const A = await f.company(`K477 ${label}`, "OA");
  const B = await f.company(`K477 ${label} の別の会社`, "OB");
  // チケットの番号は「グループの頭＋連番」で、会社の中で 1 つだけ（tickets_tenant_id_number_key）。頭を付けないと全部のグループが T-1 から始めて重なるので、グループごとに別の頭を付ける
  const scope = async (name: string, parent: string, prefix: string) =>
    (
      await one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
        [A.tenantId, parent, name, prefix],
      )
    ).id;
  const g1 = await scope("営業", A.rootScope, "G1");
  const g1a = await scope("営業の下", g1, "G1A");
  const g2 = await scope("開発", A.rootScope, "G2");
  return {
    tenantId: A.tenantId,
    root: A.rootScope,
    g1,
    g1a,
    g2,
    top: await f.person(A.tenantId, A.rootScope, { name: "全体を見る人", ticketAbility: "edit" }),
    a: await f.person(A.tenantId, g1, { name: "高本", ticketAbility: "edit" }),
    a2: await f.person(A.tenantId, g1a, { name: "山田", ticketAbility: "edit" }),
    b: await f.person(A.tenantId, g2, { name: "鈴木", ticketAbility: "edit" }),
    outsider: await f.person(B.tenantId, B.rootScope, { name: "別の会社の人", ticketAbility: "edit" }),
    otherRoot: B.rootScope,
  };
}

const stageId = async (tenant: string, key: string) =>
  (await one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [tenant, key])).id;
async function ticket(
  w: World,
  o: {
    scope: string;
    stage?: string;
    title?: string;
    assignee?: Person | null;
    deleted?: boolean;
    draftBy?: Person;
  } = {
    scope: "",
  },
): Promise<{ id: string; number: string }> {
  const kind = (
    await one<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [w.tenantId],
    )
  ).id;
  const t = await one<{ id: string; number: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, deleted_at)
     values ($1, $2, '', $3, $4, $5, $6, $7, case when $8::boolean then now() else null end) returning id, number`,
    [
      w.tenantId,
      o.scope,
      kind,
      await stageId(w.tenantId, o.stage ?? "todo"),
      o.title ?? "見積書を作って送る",
      o.assignee === undefined ? w.top.id : (o.assignee?.id ?? null),
      w.top.id,
      o.deleted === true,
    ],
  );
  if (o.draftBy) {
    const imp = await one<{ id: string }>(
      "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
      [w.tenantId, o.draftBy.id, o.scope],
    );
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [t.id, imp.id]);
  }
  return t;
}
/** やり取りの 1 行を置く。daysAgo 日前の時刻にする（並びと 14 日の窓を決めるため）。author が null なら仕組みの 1 行 */
async function message(
  w: World,
  t: { id: string },
  o: {
    by?: Person | null;
    kind?: "post" | "change" | "system";
    body?: string | null;
    daysAgo?: number;
    minutesAgo?: number;
    deleted?: boolean;
  } = {},
) {
  const by = o.by === undefined ? w.a : o.by;
  const kind = o.kind ?? (by ? "post" : "system");
  await f.admin.query(
    `insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, created_at, deleted_at)
     values ($1, $2, $3, $4, $5, now() - make_interval(days => $6::int, mins => $7::int), case when $8::boolean then now() else null end)`,
    [
      w.tenantId,
      t.id,
      by?.id ?? null,
      kind,
      o.body === undefined ? "進めました" : o.body,
      o.daysAgo ?? 0,
      o.minutesAgo ?? 0,
      o.deleted === true,
    ],
  );
}

beforeAll(async () => {
  f = await makeFixture([]);
  f.limits["getScopeOverview"] = 10_000;
  // 口の振る舞いは最初の要求の前に 1 回だけ読む（準備で読まない）
  let loading: Promise<void> | null = null;
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= (async () => {
      const m = (await import("../../../src/hooks/scope-overview.js")) as {
        scopeOverviewHooks: (p: pg.Pool) => Record<string, Hook>;
      };
      Object.assign(f.hooks, m.scopeOverviewHooks(f.pool));
    })());
    return base(method, path, o);
  };
});
afterAll(async () => {
  await f?.close();
});

describe("K-477 グループの概要を読む（getScopeOverview・本物の DB）", () => {
  it("K477-API-001 答えの形：鍵は by_stage・milestones・recent・total ちょうど／by_stage の 1 件は {stage:{id,key,name}, count}／recent の 1 件は {ticket:{id,number,title}, at, by, kind, text, count}／Cache-Control に private と no-store", async () => {
    const w = await world("形");
    const t = await ticket(w, { scope: w.g1, title: "形を見る" });
    await message(w, t, { by: w.a, body: "書いた" });
    const r = await overview(w.a, w.g1);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await dataOf(r);
    expect(Object.keys(d).sort()).toEqual(["by_stage", "milestones", "recent", "total"]);
    expect(Object.keys(d.by_stage[0]!).sort()).toEqual(["count", "stage"]);
    expect(Object.keys(d.by_stage[0]!.stage).sort()).toEqual(["id", "key", "name"]);
    expect(d.recent).toHaveLength(1);
    expect(Object.keys(d.recent[0]!).sort()).toEqual(["at", "by", "count", "kind", "text", "ticket"]);
    expect(Object.keys(d.recent[0]!.ticket).sort()).toEqual(["id", "number", "title"]);
    expect(Number.isNaN(Date.parse(d.recent[0]!.at))).toBe(false);
    expect(Number.isInteger(d.total)).toBe(true);
    const cc = r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("K477-API-002 状態の内訳は会社の状態を全部（消した状態は除く）位置の順に並べ、0 件の状態も出す。会社が足した状態（鍵が空）は key null", async () => {
    const w = await world("状態");
    const custom = (
      await one<{ id: string }>(
        "insert into ticket_stages (tenant_id, key, name, position) values ($1, null, '社内確認', 25) returning id",
        [w.tenantId],
      )
    ).id;
    await f.admin.query(
      "insert into ticket_stages (tenant_id, key, name, position, deleted_at) values ($1, null, '消した状態', 26, now())",
      [w.tenantId],
    );
    const d = await overviewOk(w.top, w.root);
    const expected = (
      await f.admin.query<{ id: string }>(
        "select id from ticket_stages where tenant_id = $1 and deleted_at is null order by position, name, id",
        [w.tenantId],
      )
    ).rows.map((r) => r.id);
    expect(d.by_stage.map((x) => x.stage.id)).toEqual(expected);
    expect(d.by_stage.every((x) => x.count === 0)).toBe(true);
    expect(d.by_stage.find((x) => x.stage.id === custom)).toMatchObject({
      stage: { key: null, name: "社内確認" },
      count: 0,
    });
    expect(d.by_stage.map((x) => x.stage.name)).not.toContain("消した状態");
  });

  it("K477-API-003 件数：状態ごとの数と total（total は内訳の合計・完了も数える）", async () => {
    const w = await world("件数");
    await ticket(w, { scope: w.g1, stage: "todo" });
    await ticket(w, { scope: w.g1, stage: "todo" });
    await ticket(w, { scope: w.g1, stage: "doing" });
    await ticket(w, { scope: w.g1, stage: "hold" });
    await ticket(w, { scope: w.g1, stage: "done" });
    const d = await overviewOk(w.a, w.g1);
    expect(counts(d)).toMatchObject({ todo: 2, doing: 1, hold: 1, done: 1 });
    expect(d.total).toBe(5);
    expect(d.by_stage.reduce((n, x) => n + x.count, 0)).toBe(d.total);
  });

  it("K477-API-004 下のグループも数える：g1 は g1a の物も数え、g2 の物は数えない。g1a だけを開けば g1a の物だけ。root の席は全部", async () => {
    const w = await world("下");
    await ticket(w, { scope: w.g1 });
    await ticket(w, { scope: w.g1a });
    await ticket(w, { scope: w.g1a });
    await ticket(w, { scope: w.g2 });
    expect((await overviewOk(w.a, w.g1)).total).toBe(3);
    expect((await overviewOk(w.a2, w.g1a)).total).toBe(2);
    expect((await overviewOk(w.top, w.root)).total).toBe(4);
    expect((await overviewOk(w.b, w.g2)).total).toBe(1);
  });

  it("K477-API-005 数えない物：消したチケット・他の人の取り込みの下書き（取り込んだ本人の概要には数える）", async () => {
    const w = await world("数えない");
    await ticket(w, { scope: w.g1 });
    await ticket(w, { scope: w.g1, deleted: true });
    await ticket(w, { scope: w.g1, draftBy: w.a });
    expect((await overviewOk(w.top, w.g1)).total).toBe(1); // root の席には下書きは見えない
    expect((await overviewOk(w.a, w.g1)).total).toBe(2); // 取り込んだ本人には下書きも数える
  });

  it("K477-API-006 見えないグループは 404（件数を返さない）：入口が先に止める 3 つ（別の会社の人・無い uuid・別の会社のグループ）は code NOT_FOUND、口が止める 3 つ（別のグループの席・席の木の外の上のグループ・消したグループ）は E-PAGE-001", async () => {
    const w = await world("見えない");
    await ticket(w, { scope: w.g1 });
    const gone = (
      await one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, deleted_at) values ($1, $2, '消したグループ', now()) returning id",
        [w.tenantId, w.root],
      )
    ).id;
    // 入口の行の確かめ（op.ts）が先に返す 404 の code は NOT_FOUND。口まで来た 404 は E-PAGE-001
    const cases: [Person, string, string][] = [
      [w.b, w.g1, "E-PAGE-001"], // g2 の席から g1（見えるが席の木の外）
      [w.a, w.root, "E-PAGE-001"], // g1 の席から上の root（席の木の外）
      [w.outsider, w.g1, "NOT_FOUND"], // 別の会社の人から会社 A のグループ
      [w.top, randomUUID(), "NOT_FOUND"], // 無い uuid
      [w.top, gone, "E-PAGE-001"], // 消したグループ
      [w.top, w.otherRoot, "NOT_FOUND"], // 会社 A の人から別の会社のグループ
    ];
    for (const [who, scope, code] of cases) {
      const r = await overview(who, scope);
      expect(r.status, scope).toBe(404);
      const j = await json(r);
      expect(j["code"], scope).toBe(code);
      expect(JSON.stringify(j)).not.toContain("by_stage");
    }
  });

  it("K477-API-007 節目は 0 件：milestones はいつも空の並び（節目の開始日・終わりの日の列が無い・D-151.10）", async () => {
    const w = await world("節目");
    await ticket(w, { scope: w.g1 });
    expect((await overviewOk(w.a, w.g1)).milestones).toEqual([]);
    expect((await overviewOk(w.top, w.root)).milestones).toEqual([]);
  });

  it("K477-API-008 最近の更新：同じチケットは 1 行にまとめ（最新の 1 行・count は件数）・新しい順・10 件まで（12 件あれば新しい 10 件）", async () => {
    const w = await world("最近");
    const many = await ticket(w, { scope: w.g1, title: "何回も更新" });
    await message(w, many, { minutesAgo: 30, body: "1 回目" });
    await message(w, many, { minutesAgo: 20, body: "2 回目" });
    await message(w, many, { minutesAgo: 1, body: "3 回目" });
    const older = await ticket(w, { scope: w.g1, title: "少し前" });
    await message(w, older, { minutesAgo: 10, body: "少し前の更新" });
    let d = await overviewOk(w.a, w.g1);
    expect(d.recent.map((x) => x.ticket.id)).toEqual([many.id, older.id]);
    expect(d.recent[0]).toMatchObject({
      count: 3,
      text: "3 回目",
      kind: "post",
      by: { id: w.a.id, display_name: "高本" },
    });
    expect(d.recent[1]!.count).toBe(1);
    // 12 件のチケットに 1 件ずつ → 新しい 10 件だけ
    const w2 = await world("最近 10 件");
    const ids: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const t = await ticket(w2, { scope: w2.g1, title: `チケット ${i}` });
      await message(w2, t, { minutesAgo: 100 - i, body: `更新 ${i}` });
      ids.push(t.id);
    }
    d = await overviewOk(w2.a, w2.g1);
    expect(d.recent).toHaveLength(10);
    expect(d.recent.map((x) => x.ticket.id)).toEqual(ids.slice(2).reverse());
  });

  it("K477-API-009 14 日の窓：15 日前のやり取りは入れない（それだけのチケットは出さない）。13 日前は入れる。count は窓の中の件数", async () => {
    const w = await world("窓");
    const onlyOld = await ticket(w, { scope: w.g1, title: "古いだけ" });
    await message(w, onlyOld, { daysAgo: 15 });
    const mixed = await ticket(w, { scope: w.g1, title: "古いのと新しいの" });
    await message(w, mixed, { daysAgo: 15, body: "古い" });
    await message(w, mixed, { daysAgo: 13, body: "13 日前" });
    await message(w, mixed, { daysAgo: 1, body: "昨日" });
    const d = await overviewOk(w.a, w.g1);
    expect(d.recent.map((x) => x.ticket.id)).toEqual([mixed.id]);
    expect(d.recent[0]).toMatchObject({ count: 2, text: "昨日" });
    expect(d.total).toBe(2); // 内訳はやり取りに関わらず数える
  });

  it("K477-API-010 やり取りの種類：書き込み（by は書いた人）・変更の 1 行（by は変えた人）・仕組みの 1 行（by は null）。kind はその種類のまま", async () => {
    const w = await world("種類");
    const tp = await ticket(w, { scope: w.g1, title: "書き込み" });
    const tc = await ticket(w, { scope: w.g1, title: "変更" });
    const ts = await ticket(w, { scope: w.g1, title: "仕組み" });
    await message(w, tp, { by: w.a, kind: "post", minutesAgo: 30, body: "書き込み" });
    await message(w, tc, { by: w.a2, kind: "change", minutesAgo: 20, body: "山田 が状態を 未着手 → 作業中 に変えた" });
    await message(w, ts, { by: null, kind: "system", minutesAgo: 10, body: "AI が完了した" });
    const d = await overviewOk(w.a, w.g1);
    const by = Object.fromEntries(d.recent.map((x) => [x.ticket.title, [x.kind, x.by?.display_name ?? null]]));
    expect(by).toEqual({ 書き込み: ["post", "高本"], 変更: ["change", "山田"], 仕組み: ["system", null] });
  });

  it("K477-API-011 text は先頭 80 文字：80 文字ちょうどはそのまま・81 文字以上は先頭 80 文字＋「…」（全角でも文字の数で数える）", async () => {
    const w = await world("字数");
    const exact = await ticket(w, { scope: w.g1, title: "80" });
    const over = await ticket(w, { scope: w.g1, title: "81" });
    await message(w, exact, { body: "あ".repeat(80), minutesAgo: 20 });
    await message(w, over, { body: "い".repeat(85), minutesAgo: 10 });
    const d = await overviewOk(w.a, w.g1);
    const text = Object.fromEntries(d.recent.map((x) => [x.ticket.title, x.text]));
    expect(text["80"]).toBe("あ".repeat(80));
    expect(text["81"]).toBe(`${"い".repeat(80)}…`);
    // 本文が無い（null）やり取り（本文を入れない仕組みの 1 行）は text が空の字・500 にしない
    const empty = await ticket(w, { scope: w.g1, title: "本文なし" });
    await message(w, empty, { by: null, kind: "system", body: null, minutesAgo: 5 });
    const d2 = await overviewOk(w.a, w.g1);
    expect(d2.recent.find((x) => x.ticket.title === "本文なし")!.text).toBe("");
  });

  it("K477-API-012 最近の更新に出さない物：消したやり取り・消したチケット・ほかのグループのチケット・他の人の取り込みの下書き", async () => {
    const w = await world("出さない");
    const keep = await ticket(w, { scope: w.g1, title: "出す" });
    await message(w, keep, { body: "出す" });
    const delMsg = await ticket(w, { scope: w.g1, title: "やり取りを消した" });
    await message(w, delMsg, { deleted: true });
    const delTicket = await ticket(w, { scope: w.g1, title: "チケットを消した", deleted: true });
    await message(w, delTicket, {});
    const other = await ticket(w, { scope: w.g2, title: "別のグループ" });
    await message(w, other, {});
    const draft = await ticket(w, { scope: w.g1, title: "下書き", draftBy: w.a });
    await message(w, draft, {});
    const d = await overviewOk(w.top, w.g1);
    expect(d.recent.map((x) => x.ticket.title)).toEqual(["出す"]);
  });

  it("K477-API-013 1 件も無いグループ：200・内訳は全部 0・recent は空・milestones は空・total 0", async () => {
    const w = await world("空");
    const d = await overviewOk(w.a2, w.g1a);
    expect(d.total).toBe(0);
    expect(d.recent).toEqual([]);
    expect(d.milestones).toEqual([]);
    expect(d.by_stage.length).toBeGreaterThan(0);
    expect(d.by_stage.every((x) => x.count === 0)).toBe(true);
  });

  it("K477-API-014 ログインしていない：401。1 分の上限を超えたら 429 と retry_after_sec（1〜60 の整数）", async () => {
    const w = await world("入口");
    const anon = await f.req("GET", `/scopes/${w.g1}/overview`);
    expect(anon.status).toBe(401);
    f.limits["getScopeOverview"] = 2;
    try {
      expect((await overview(w.a, w.g1)).status).toBe(200);
      expect((await overview(w.a, w.g1)).status).toBe(200);
      const r = await overview(w.a, w.g1);
      expect(r.status).toBe(429);
      const s = Number((await json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
    } finally {
      f.limits["getScopeOverview"] = 10_000;
    }
  });

  it("K477-API-015 同時に 5 回：どの答えも同じ（読むだけ・何も書かない）。証跡も増えない", async () => {
    const w = await world("同時");
    const t = await ticket(w, { scope: w.g1 });
    await message(w, t, {});
    const before = Number(
      (await one<{ n: string }>("select count(*) as n from audit_events where tenant_id = $1", [w.tenantId])).n,
    );
    const rs = await Promise.all(Array.from({ length: 5 }, () => overview(w.a, w.g1)));
    const bodies = await Promise.all(rs.map((r) => r.text()));
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(bodies).size).toBe(1);
    expect(
      Number((await one<{ n: string }>("select count(*) as n from audit_events where tenant_id = $1", [w.tenantId])).n),
    ).toBe(before);
  });

  it("K477-API-016 文の数：口が 1 つの取引（begin 1）で流す DB の文は、begin・文脈の設定・commit を含めて 12 以下（土台の外で、口の appPool に数え器を掛けて数える。Server-Timing の頭は本物のログインにだけ付き、偽のログインでは付かない）", async () => {
    const w = await world("文の数");
    const t = await ticket(w, { scope: w.g1 });
    await message(w, t, {});
    // 口に渡す接続の取り先（appPool）を数え器つきに替える：connect が貸す接続の query を包み、流れた文を hits に残す（元の接続は変えない）
    const hits: string[] = [];
    const counted = new Proxy(f.pool, {
      get(target, prop, recv) {
        if (prop !== "connect") return Reflect.get(target, prop, recv) as unknown;
        return async () => {
          const cl = await target.connect();
          return new Proxy(cl, {
            get(c, p) {
              if (p === "query")
                return (...a: unknown[]) => {
                  const q = a[0];
                  hits.push(typeof q === "string" ? q : String((q as { text?: string } | null)?.text ?? ""));
                  return (c.query as (...x: unknown[]) => unknown)(...a);
                };
              const v = Reflect.get(c, p) as unknown;
              return typeof v === "function" ? (v as (...x: unknown[]) => unknown).bind(c) : v;
            },
          });
        };
      },
    });
    const m = (await import("../../../src/hooks/scope-overview.js")) as {
      scopeOverviewHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    // 口の遅い読み込み（beforeAll の f.req の包み）をここで済ませてから、差し替えの前の口を取る（単独で流しても、先に読み込みが走って差し替えを上書きしない）
    expect((await overview(w.a, w.g1)).status).toBe(200);
    const saved = f.hooks["getScopeOverview"]!;
    f.hooks["getScopeOverview"] = m.scopeOverviewHooks(counted)["getScopeOverview"]!;
    try {
      const r = await overview(w.a, w.g1);
      expect(r.status, await r.clone().text()).toBe(200);
    } finally {
      f.hooks["getScopeOverview"] = saved;
    }
    // 取引は 1 つ。中身の文は 3 つ（グループが見えるか・内訳・最近の更新・合計は内訳から足す）と、取引の出入り（begin・文脈の設定・commit）
    expect(hits.filter((x) => /^\s*begin\b/i.test(x))).toHaveLength(1);
    expect(hits.length, hits.join("\n")).toBeGreaterThanOrEqual(1);
    expect(hits.length, hits.join("\n")).toBeLessThanOrEqual(12);
  });
});
