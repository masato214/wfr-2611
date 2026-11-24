// K-961 選べるプラン（listWorkspacePlans・GET /api/v1/workspace/plans）とプランを変える（changePlan・POST /api/v1/workspace/plan）。
//   テストの名前の頭の行 ID（K961-…）は 11_tickets/K-961.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1005：選べるプランの 1 行 12 欄・meta { members, member_limit }・changePlan の入力 plan_key・答え 4 欄。
//   上げるとすぐ・下げると次の請求日（来月 1 日）から・人数が上限を超えるときは下げられない（D-128.65）。上げた月は日割りを次の請求書に足す（D-156.31）。
//   人数は消していない人のメンバー（D-156.36）。changePlan は本人確認の取り直し（15 分）が要る（契約の step_up always）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startBilling,
  isFlat,
  jstDay,
  nextFirst,
  prorate,
  PLAN_KEYS,
  type Billing,
  type Who,
  type World,
} from "./billing.harness.js";

let t: Billing;
let w: World;

beforeAll(async () => {
  t = await startBilling("k961", ["plans", "billing-read"]);
  w = await t.world("ENGINE BASE", { plan: "team" });
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const STEP = 60; // 本人確認を 1 分前に取り直した
const list = async (who: Who = w.admin) => {
  const r = await t.call(who, "GET", "/workspace/plans");
  return { r, b: await t.json(r) };
};
const change = async (who: Who, body: unknown, stepUpAgoSec: number | undefined = STEP) => {
  const r = await t.call(who, "POST", "/workspace/plan", body, stepUpAgoSec === undefined ? {} : { stepUpAgoSec });
  return { r, b: await t.json(r) };
};
const byKey = (b: { data?: unknown }, key: string) => (b.data as Row[]).find((x) => x["plan_key"] === key)!;
/** 今の時刻に効いている契約の行（消していない・始まっている・終わっていない） */
const live = (tenantId: string) =>
  t.f.admin.query<{ key: string; ended: string | null }>(
    `select p.key, s.ended_at::text as ended from subscriptions s join plans p on p.id = s.plan_id
      where s.tenant_id = $1 and s.deleted_at is null and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())`,
    [tenantId],
  );
const requests = (tenantId: string) =>
  t.n("select count(*) as n from plan_change_requests where tenant_id = $1 and deleted_at is null", [tenantId]);
/** 来月 1 日の 0 時（日本） */
const nextFirstAt = () => new Date(`${nextFirst()}T00:00:00+09:00`).getTime();

describe("K-961 選べるプラン", () => {
  it("K961-API-001 3 行が値段の安い順（free・team・business）で 1 行 8 欄。meta は今の人数と今のプランの上限", async () => {
    const { r, b } = await list();
    expect(r.status).toBe(200);
    const rows = b.data as Row[];
    expect(rows.map((x) => x["plan_key"])).toEqual(["free", "team", "business"]);
    for (const x of rows) expect(Object.keys(x).sort()).toEqual(PLAN_KEYS);
    expect(rows.map((x) => [x["name"], x["price_monthly"], x["member_limit"]])).toEqual([
      ["無料", 0, 3],
      ["チーム", 15_000, 10],
      ["ビジネス", 40_000, 30],
    ]);
    // 人数 4 の内訳（土台 billing.harness.ts の world）：高本（管理者）・経理の佐々木・田中・先方の人。
    // 先方の人は所属の行（tenant_memberships の requester）を持たないので社内の人として数える（ゲストにするのは K961-API-020）
    expect(b.meta).toEqual({ members: 4, member_limit: 10 });
  });

  it("K961-API-002 今のプランは current true・選べない（理由「いまのプランです」）・effective_from は契約の始まった日。契約が無ければ無料が今のプラン", async () => {
    const team = byKey((await list()).b, "team");
    expect(team).toMatchObject({
      current: true,
      can_choose: false,
      reason: "いまのプランです",
      effective_from: jstDay(-40),
    });
    const free = await t.world("無料のまま");
    const b = (await list(free.admin)).b;
    expect(byKey(b, "free")).toMatchObject({ current: true, can_choose: false });
    expect(b.meta).toEqual({ members: 4, member_limit: 3 });
  });

  it("K961-API-003 上げる先は effective_from が今日・下げる先は来月 1 日。選べる行の reason は null", async () => {
    const b = (await list()).b;
    expect(byKey(b, "business")).toMatchObject({
      current: false,
      effective_from: jstDay(),
      can_choose: true,
      reason: null,
    });
    expect(byKey(b, "free")["effective_from"]).toBe(nextFirst());
  });

  it("K961-API-004 人数が上限を超えるプランは選べない（理由「いま 4 人なので、3 人までのプランには下げられません」）", async () => {
    expect(byKey((await list()).b, "free")).toMatchObject({
      can_choose: false,
      reason: "いま 4 人なので、3 人までのプランには下げられません",
    });
  });

  it("K961-API-005 人数は消していない人のメンバーだけ（消した人・AI 社員は数えない）", async () => {
    const me = await t.world("数え方", { plan: "team" });
    await t.f.admin.query(
      "insert into members (tenant_id, scope_id, kind_id, display_name, deleted_at) values ($1, $2, 'human', '抜けた人', now())",
      [me.tenantId, me.rootScope],
    );
    await t.f.admin.query(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'ai_employee', 'AI 社員')",
      [me.tenantId, me.rootScope],
    );
    expect((await list(me.admin)).b.meta).toEqual({ members: 4, member_limit: 10 });
  });
  it("K961-API-020 ゲスト（役割 requester の人）は人数に数えない（D-156.51）：4 人の 1 人をゲストにし、ゲストを 2 人足すと members は 3・無料を選べて下げられる", async () => {
    const me = await t.world("ゲストは数えない", { plan: "team" });
    const guestRole = (memberId: string) =>
      t.f.admin.query(
        "insert into tenant_memberships (tenant_id, member_id, role, status) values ($1, $2, 'requester', 'active')",
        [me.tenantId, memberId],
      );
    await guestRole(me.guest.id);
    for (const name of ["先方の山口", "先方の佐藤"]) {
      const g = (await t.row<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id",
        [me.tenantId, me.rootScope, name],
      ))!;
      await guestRole(g.id);
    }
    const b = (await list(me.admin)).b;
    expect(b.meta).toEqual({ members: 3, member_limit: 10 });
    expect(byKey(b, "free")).toMatchObject({ can_choose: true, reason: null, effective_from: nextFirst() });
    const { r, b: c } = await change(me.admin, { plan_key: "free" });
    expect(r.status).toBe(200);
    expect(c.data).toMatchObject({ plan_key: "free", effective_from: nextFirst() });
  });
});

describe("K-961 プランを変える", () => {
  it("K961-API-006 本人確認を取り直していない・16 分前は 403 STEP_UP_REQUIRED で何も変えない。14 分前なら通る", async () => {
    const me = await t.world("本人確認", { plan: "team" });
    for (const ago of [undefined, 16 * 60]) {
      const { r, b } = await change(me.admin, { plan_key: "business" }, ago);
      expect(r.status).toBe(403);
      expect(b["code"]).toBe("STEP_UP_REQUIRED");
    }
    expect(await requests(me.tenantId)).toBe(0);
    expect((await change(me.admin, { plan_key: "business" }, 14 * 60)).r.status).toBe(200);
  });

  it("K961-API-007 上げる（チーム → ビジネス）：200 で 4 欄・今日から・日割りは月の差 25000 円の残りの日の分に消費税・次の請求は来月 1 日", async () => {
    const me = await t.world("上げる", { plan: "team" });
    const { r, b } = await change(me.admin, { plan_key: "business" });
    expect(r.status).toBe(200);
    expect(b.data).toEqual({
      plan_key: "business",
      effective_from: jstDay(),
      prorated_amount: prorate(25_000),
      next_invoice_on: nextFirst(),
    });
    expect((await live(me.tenantId)).rows.map((x) => x.key)).toEqual(["business"]);
    const req = (await t.row<{ s: string; p: number; e: string }>(
      "select status_id as s, prorated_amount as p, effective_from::text as e from plan_change_requests where tenant_id = $1",
      [me.tenantId],
    ))!;
    expect(req).toEqual({ s: "applied", p: prorate(25_000), e: jstDay() });
  });

  it("K961-API-008 無料（契約なし）から上げると契約の行ができ、日割りは 15000 円の分", async () => {
    const me = await t.world("無料から");
    const { r, b } = await change(me.admin, { plan_key: "team" });
    expect(r.status).toBe(200);
    expect((b.data as Row)["prorated_amount"]).toBe(prorate(15_000));
    expect((await live(me.tenantId)).rows.map((x) => x.key)).toEqual(["team"]);
  });

  it("K961-API-009 下げる（ビジネス → チーム）：200・来月 1 日から・日割り 0。来月 1 日まではビジネスのまま（一覧も今のプランの決めも）", async () => {
    const me = await t.world("下げる", { plan: "business" });
    const { r, b } = await change(me.admin, { plan_key: "team" });
    expect(r.status).toBe(200);
    expect(b.data).toEqual({
      plan_key: "team",
      effective_from: nextFirst(),
      prorated_amount: 0,
      next_invoice_on: nextFirst(),
    });
    const now = (await live(me.tenantId)).rows;
    expect(now.map((x) => x.key)).toEqual(["business"]);
    expect(new Date(now[0]!.ended!).getTime()).toBe(nextFirstAt());
    const next = (await t.row<{ s: string }>(
      "select s.started_at::text as s from subscriptions s join plans p on p.id = s.plan_id where s.tenant_id = $1 and p.key = 'team' and s.deleted_at is null",
      [me.tenantId],
    ))!;
    expect(new Date(next.s).getTime()).toBe(nextFirstAt());
    expect(byKey((await list(me.admin)).b, "business")["current"]).toBe(true);
  });

  it("K961-API-010 人数が上限を超えるプランに下げると 409 E-PLAN-002（detail に人数と上限・欄と details は付けない）で何も変えない", async () => {
    const me = await t.world("下げられない", { plan: "team" });
    const { r, b } = await change(me.admin, { plan_key: "free" });
    expect(r.status).toBe(409);
    expect(b["code"]).toBe("E-PLAN-002");
    expect(isFlat(b)).toBe(true);
    expect(b["detail"]).toEqual({ members: 4, member_limit: 3 });
    expect(await requests(me.tenantId)).toBe(0);
    expect((await live(me.tenantId)).rows.map((x) => x.key)).toEqual(["team"]);
  });

  it("K961-API-011 今のプランを選ぶと 409 E-PLAN-001（欄なし）。無い・消したプランの鍵は 404 E-PAGE-001（欄なし）", async () => {
    const me = await t.world("選べない鍵", { plan: "team" });
    const same = await change(me.admin, { plan_key: "team" });
    expect([same.r.status, same.b["code"], isFlat(same.b)]).toEqual([409, "E-PLAN-001", true]);
    const none = await change(me.admin, { plan_key: "enterprise" });
    expect([none.r.status, none.b["code"], isFlat(none.b)]).toEqual([404, "E-PAGE-001", true]);
    expect(await requests(me.tenantId)).toBe(0);
  });

  it("K961-API-012 形の誤り（plan_key が無い・知らない欄 plan_id・NUL）は 422 で何も変えない", async () => {
    const me = await t.world("形の誤り", { plan: "team" });
    for (const bad of [{}, { plan_key: "business", plan_id: me.tenantId }, { plan_key: "busi\u0000ness" }]) {
      expect((await change(me.admin, bad)).r.status, JSON.stringify(bad)).toBe(422);
    }
    expect(await requests(me.tenantId)).toBe(0);
  });

  it("K961-API-013 下げる予定の後に選び直す：別のプランなら予定を置き換え、今のプランを選ぶと予定を取り消す（どちらも 200）", async () => {
    const me = await t.world("選び直す", { plan: "business" });
    await change(me.admin, { plan_key: "team" });
    const again = await change(me.admin, { plan_key: "business" });
    expect(again.r.status).toBe(200);
    expect(again.b.data).toMatchObject({ plan_key: "business", prorated_amount: 0 });
    const rows = (await live(me.tenantId)).rows;
    expect(rows.map((x) => [x.key, x.ended])).toEqual([["business", null]]);
    expect(
      await t.n(
        "select count(*) as n from subscriptions where tenant_id = $1 and deleted_at is null and started_at > now()",
        [me.tenantId],
      ),
    ).toBe(0);
    expect(
      await t.n("select count(*) as n from plan_change_requests where tenant_id = $1 and status_id = 'cancelled'", [
        me.tenantId,
      ]),
    ).toBe(1);
  });

  it("K961-API-014 記録：plan.change が 1 回に 1 行・関門 C2・payload は from・to・effective_from", async () => {
    const me = await t.world("記録", { plan: "team" });
    await change(me.admin, { plan_key: "business" });
    const r = (
      await t.f.admin.query<{ c: string; p: Row }>(
        "select choke_point_id as c, payload as p from audit_events where tenant_id = $1 and action = 'plan.change'",
        [me.tenantId],
      )
    ).rows;
    expect(r).toEqual([{ c: "C2", p: { from: "team", to: "business", effective_from: jstDay() } }]);
  });

  it("K961-API-015 同時に 2 人が上げると、片方は 200・もう片方は 409 E-PLAN-001。効いている契約は 1 つだけ", async () => {
    const me = await t.world("同時", { plan: "team" });
    const [a, b] = await Promise.all([
      change(me.admin, { plan_key: "business" }),
      change(me.payer, { plan_key: "business" }),
    ]);
    expect([a.r.status, b.r.status].sort()).toEqual([200, 409]);
    expect((await live(me.tenantId)).rows.map((x) => x.key)).toEqual(["business"]);
  });

  it("K961-API-016 能力の無い人・先方の権限の人は一覧も変えるも 403・ログインなしは 401 で何も変えない", async () => {
    const me = await t.world("見られない", { plan: "team" });
    for (const who of [me.staff, me.guest]) {
      expect((await list(who)).r.status).toBe(403);
      expect((await change(who, { plan_key: "business" })).r.status).toBe(403);
    }
    expect((await t.call(null, "GET", "/workspace/plans")).status).toBe(401);
    expect((await t.call(null, "POST", "/workspace/plan", { plan_key: "business" })).status).toBe(401);
    expect(await requests(me.tenantId)).toBe(0);
  });

  it("K961-API-017 DB が落ちると 503 E-PAGE-003 で、契約も頼みの行も記録も変わらない", async () => {
    const me = await t.world("落ちる", { plan: "team" });
    const restore = await t.breakWrites("subscriptions", { tenant_id: me.tenantId });
    try {
      const { r, b } = await change(me.admin, { plan_key: "business" });
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(await requests(me.tenantId)).toBe(0);
    expect((await live(me.tenantId)).rows.map((x) => x.key)).toEqual(["team"]);
    expect(
      await t.n("select count(*) as n from audit_events where tenant_id = $1 and action = 'plan.change'", [
        me.tenantId,
      ]),
    ).toBe(0);
  });

  it("K961-API-018 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    t.limits["listWorkspacePlans"] = 1;
    try {
      const ip = "203.0.113.245";
      expect((await t.call(w.admin, "GET", "/workspace/plans", undefined, { ip })).status).toBe(200);
      const r = await t.call(w.admin, "GET", "/workspace/plans", undefined, { ip });
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.limits["listWorkspacePlans"];
    }
  });
});

describe("K-961 DB の道", () => {
  it("K961-DB-001 今のプランの決め app.tenant_plan_id は、まだ始まっていない契約と終わった契約を見ない（下げる予定の間は今のプラン）", async () => {
    const me = await t.world("今のプラン", { plan: "business" });
    await change(me.admin, { plan_key: "team" });
    const r = (await t.row<{ key: string }>("select p.key from plans p where p.id = app.tenant_plan_id($1)", [
      me.tenantId,
    ]))!;
    expect(r.key).toBe("business");
  });

  it("K961-DB-002 関数の中の 2 層目：能力の無いメンバーの文脈で app.plan_change を直に呼ぶと forbidden で何も書かない", async () => {
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [w.tenantId, w.staff.id],
      );
      const v = (await c.query<{ v: Row }>("select app.plan_change('business') as v")).rows[0]!.v;
      expect(v).toEqual({ error: "forbidden" });
      await c.query("rollback");
    } finally {
      c.release();
    }
  });
});

describe("K-961 下絵の字の 4 欄", () => {
  it("K961-API-019 summary はプランの 1 行の説明・recommended は運営が付けた印のある選べるプランだけ（D-156.68）・upgrade は上げる先の行だけ（今月の残りの日・日割り・来月 1 日）・upcoming はこの葉では null（D-156.43）", async () => {
    const b = (await list()).b;
    const rows = b.data as Row[];
    expect(rows.map((x) => [x["plan_key"], x["summary"]])).toEqual([
      ["free", "チケット・承認・ナレッジ"],
      ["team", "＋ ゲストを招く"],
      ["business", "＋ ゲストのグループ"],
    ]);
    expect(rows.map((x) => x["recommended"])).toEqual([false, false, true]);
    // おすすめは運営が付けた印（D-156.68）：印を無料に付け替えると、今より安い無料だけが true
    const mark = (key: string, on: boolean) =>
      t.f.admin.query(
        "update plans set limits = case when $2 then coalesce(limits, '{}'::jsonb) || '{\"recommended\": true}'::jsonb else coalesce(limits, '{}'::jsonb) - 'recommended' end where tenant_id = app.ops_tenant_id() and key = $1 and deleted_at is null",
        [key, on],
      );
    await mark("business", false);
    await mark("free", true);
    try {
      expect(((await list()).b.data as Row[]).map((x) => x["recommended"])).toEqual([true, false, false]);
    } finally {
      await mark("free", false);
      await mark("business", true);
    }
    const [y, m, d] = jstDay().split("-").map(Number) as [number, number, number];
    const rest = new Date(Date.UTC(y, m, 0)).getUTCDate() - d + 1;
    expect(byKey(b, "business")["upgrade"]).toEqual({ days: rest, amount: prorate(25_000), invoice_on: nextFirst() });
    expect([byKey(b, "free")["upgrade"], byKey(b, "team")["upgrade"]]).toEqual([null, null]);
    expect(rows.map((x) => x["upcoming"])).toEqual([null, null, null]);
  });
});
