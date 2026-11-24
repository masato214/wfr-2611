// K-981 運営が月の請求書をまとめて出す（issueOpsInvoices・POST /api/v1/ops/invoices/issue・お金を持つ運営の人・本人確認の取り直し）。
//   テストの名前の頭の行 ID（K981-…）は 11_tickets/K-981.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1005（{ month, count, total, lines }・1 行 6 欄）。dry_run が true なら下書きを返して何も書かない。
//   金額（D-156.31）：その月の初日に効いていた契約のプランの値段（税別）× 1.1（切り捨て）＋その月に上げた日割り（plan_change_requests の applied・税込）。
//   無料で日割りも無ければ出さない。期限は月の翌月の末日。共用の DB なので月は 2019 年の昔の月を試験ごとに分けて使い、行は名前の頭（run）で見る
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startBillingOps,
  isFlat,
  ISSUE_KEYS,
  LINE_KEYS,
  STEP,
  type BillingOps,
  type Who,
  type World,
} from "./billing-ops.harness.js";

let t: BillingOps;
let money: Who;
let noMoney: Who;

beforeAll(async () => {
  t = await startBillingOps("k981", ["ops-invoices-issue"]);
  money = await t.opsWho("佐野", ["money"]);
  noMoney = await t.opsWho("お知らせだけ", ["notice"]);
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const issue = async (body: unknown, who: Who | null = money, step: number | undefined = STEP, ip?: string) => {
  const r = await t.call(who, "POST", "/ops/invoices/issue", body, {
    ...(step === undefined ? {} : { stepUpAgoSec: step }),
    ...(ip ? { ip } : {}),
  });
  return { r, j: await t.json(r) };
};
/** その月の初日より前から、その月の後まで効いている契約のある会社 */
const paying = async (label: string, key: "team" | "business"): Promise<World> => {
  const w = await t.world(label);
  await t.contract(w, key, "2018-01-01");
  return w;
};
const lineOf = (j: { data?: unknown }, w: World): Row | undefined =>
  t.mine((j.data as Row)["lines"]).find((l) => (l["workspace"] as Row)["id"] === w.tenantId);
const issuedCount = (w: World) =>
  t.n("select count(*) as n from invoices where tenant_id = $1 and issued_at is not null and deleted_at is null", [
    w.tenantId,
  ]);

describe("K-981 下書き（dry_run）", () => {
  it("K981-API-001 下書き：201・鍵は month・count・total・lines の 4 つ・1 行は 6 欄（workspace は id と name）。請求書・記録・鈴は 1 つも書かない", async () => {
    const w = await paying("下書き", "team");
    const { r, j } = await issue({ month: "2019-01", dry_run: true });
    expect(r.status, JSON.stringify(j)).toBe(201);
    const d = j.data as Row;
    expect(Object.keys(d).sort()).toEqual(ISSUE_KEYS);
    const l = lineOf(j, w)!;
    expect(Object.keys(l).sort()).toEqual(LINE_KEYS);
    expect(l["workspace"]).toEqual({ id: w.tenantId, name: w.name });
    expect([d["month"], d["count"], (d["lines"] as Row[]).length]).toEqual([
      "2019-01",
      (d["lines"] as Row[]).length,
      d["count"],
    ]);
    expect(d["total"]).toBe((d["lines"] as Row[]).reduce((s, x) => s + Number(x["total"]), 0));
    expect(await issuedCount(w)).toBe(0);
    expect(await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1", [w.tenantId])).toBe(0);
    expect((await t.bells(w, "billing.invoice_issued")).admin).toBe(0);
  });

  it("K981-API-002 金額：チームは 15000＋税 1500＝16500・ビジネスは 40000＋4000＝44000・日割りが無ければ prorated 0・plan_name はプランの名前", async () => {
    const a = await paying("チームの値段", "team");
    const b = await paying("ビジネスの値段", "business");
    const { j } = await issue({ month: "2019-02", dry_run: true });
    const pick = (l: Row | undefined) => [l?.["plan_name"], l?.["amount"], l?.["tax"], l?.["prorated"], l?.["total"]];
    expect(pick(lineOf(j, a))).toEqual(["チーム", 15000, 1500, 0, 16500]);
    expect(pick(lineOf(j, b))).toEqual(["ビジネス", 40000, 4000, 0, 44000]);
  });

  it("K981-API-003 無料は出さない。無料でもその月に上げた日割りがあれば、その額だけの行（amount 0・tax 0・total は日割り）", async () => {
    const free = await t.world("無料のまま");
    const up = await t.world("無料から上げた");
    await t.planRequest(up, {
      from: "free",
      to: "team",
      status: "applied",
      effectiveFrom: "2019-03-20",
      prorated: 6600,
    });
    const { j } = await issue({ month: "2019-03", dry_run: true });
    expect(lineOf(j, free)).toBeUndefined();
    const l = lineOf(j, up)!;
    expect([l["amount"], l["tax"], l["prorated"], l["total"]]).toEqual([0, 0, 6600, 6600]);
  });

  it("K981-API-004 日割り：その月に上げた（applied）額を足す。下げる予定（scheduled）・取り消した・ほかの月の頼みは足さない", async () => {
    const w = await paying("月の途中で上げた", "team");
    await t.planRequest(w, {
      from: "team",
      to: "business",
      status: "applied",
      effectiveFrom: "2019-04-16",
      prorated: 13750,
    });
    await t.planRequest(w, {
      from: "business",
      to: "team",
      status: "scheduled",
      effectiveFrom: "2019-04-30",
      prorated: 0,
    });
    await t.planRequest(w, {
      from: "team",
      to: "business",
      status: "cancelled",
      effectiveFrom: "2019-04-10",
      prorated: 9999,
    });
    await t.planRequest(w, {
      from: "team",
      to: "business",
      status: "applied",
      effectiveFrom: "2019-05-02",
      prorated: 5000,
    });
    const l = lineOf((await issue({ month: "2019-04", dry_run: true })).j, w)!;
    expect([l["amount"], l["prorated"], l["total"]]).toEqual([15000, 13750, 16500 + 13750]);
  });

  it("K981-API-005 どの契約の値段か：月の初日に効いていた物。月の前に終わった契約は出さない。翌月 1 日から下げる契約は今の月を前の値段で", async () => {
    const ended = await t.world("先月で終わった");
    await t.contract(ended, "team", "2018-01-01", "2019-05-01");
    const down = await t.world("来月から下げる");
    await t.contract(down, "business", "2018-01-01", "2019-07-01");
    await t.contract(down, "team", "2019-07-01");
    const { j } = await issue({ month: "2019-06", dry_run: true });
    expect(lineOf(j, ended)).toBeUndefined();
    expect(lineOf(j, down)?.["total"]).toBe(44000);
  });
});

describe("K-981 出す", () => {
  it("K981-API-006 出す：201・会社ごとに請求書 1 枚（額は税込の合計・月の 1 日から末日・期限は翌月の末日・出した時刻・内訳の 4 列・PDF の参照はまだ空）。答えの count は出した数", async () => {
    const w = await paying("出す", "team");
    await t.planRequest(w, {
      from: "team",
      to: "business",
      status: "applied",
      effectiveFrom: "2019-07-21",
      prorated: 9900,
    });
    const { r, j } = await issue({ month: "2019-07" });
    expect(r.status, JSON.stringify(j)).toBe(201);
    expect(lineOf(j, w)?.["total"]).toBe(16500 + 9900);
    const v = (await t.invoiceOf(w, "2019-07"))!;
    expect([
      Number(v["amount"]),
      String(v["period_end"] instanceof Date ? v["period_end"].toISOString().slice(0, 10) : v["period_end"]),
      v["plan_name"],
      v["price_amount"],
      v["tax_amount"],
      v["prorated_amount"],
      v["status_id"],
      v["pdf_ref"],
    ]).toEqual([26400, "2019-07-31", "チーム", 15000, 1500, 9900, "issued", null]);
    const due = (await t.row<{ d: string }>("select due_on::text as d from invoices where id = $1", [v["id"]]))!.d;
    expect(due).toBe("2019-08-31");
    expect(v["issued_at"]).not.toBeNull();
    expect((j.data as Row)["count"]).toBe(((j.data as Row)["lines"] as Row[]).length);
  });

  it("K981-API-007 記録：会社ごとに運営の記録と会社の記録に invoice.issue が 1 行ずつ（対象は invoices とその id・target_label は「8 月分」）", async () => {
    const w = await paying("記録", "team");
    expect((await issue({ month: "2019-08" })).r.status).toBe(201);
    const id = String((await t.invoiceOf(w, "2019-08"))!["id"]);
    const e = await t.row<{ ty: string; tid: string; p: Row }>(
      "select target_type as ty, target_id as tid, payload as p from ops_audit_events where target_tenant_id = $1 and action = 'invoice.issue'",
      [w.tenantId],
    );
    expect([e?.ty, e?.tid, e?.p["target_label"]]).toEqual(["invoices", id, "8 月分"]);
    expect(
      await t.n("select count(*) as n from audit_events where tenant_id = $1 and action = 'invoice.issue'", [
        w.tenantId,
      ]),
    ).toBe(1);
  });

  it("K981-API-008 鈴：その会社の管理者にだけ billing.invoice_issued が 1 通（payload は invoice_id・month・amount_total・due_on）。種類の表に設定の札・行き先 /billing で在る", async () => {
    const w = await paying("鈴", "team");
    expect((await issue({ month: "2019-09" })).r.status).toBe(201);
    expect(await t.bells(w, "billing.invoice_issued")).toEqual({ admin: 1, payer: 0, staff: 0 });
    const p = (await t.row<{ p: Row }>(
      "select payload as p from notifications where tenant_id = $1 and event_kind_id = 'billing.invoice_issued'",
      [w.tenantId],
    ))!.p;
    expect(Object.keys(p).sort()).toEqual(["amount_total", "due_on", "invoice_id", "month"]);
    expect([p["month"], p["amount_total"], p["due_on"]]).toEqual(["2019-09", 16500, "2019-10-31"]);
    const { KINDS } = await import("../../../src/features/F7/notifications/kinds.js");
    expect(KINDS["billing.invoice_issued"]).toEqual({ tag: "setting", ticket: false, href: "/billing" });
  });

  it("K981-API-009 2 回目：同じ月をもう一度出すと、まだ出していない会社の分だけ出す。出す物が無ければ 409 E-BILL-003 で欄も details も無く、何も増えない", async () => {
    const a = await paying("先に出した", "team");
    expect((await issue({ month: "2019-10" })).r.status).toBe(201);
    const later = await paying("後から足した", "team");
    const second = await issue({ month: "2019-10" });
    expect(second.r.status, JSON.stringify(second.j)).toBe(201);
    expect(t.mine((second.j.data as Row)["lines"]).map((l) => (l["workspace"] as Row)["id"])).toEqual([later.tenantId]);
    expect([await issuedCount(a), await issuedCount(later)]).toEqual([1, 1]);
    const third = await issue({ month: "2019-10" });
    expect([third.r.status, third.j["code"], isFlat(third.j)]).toEqual([409, "E-BILL-003", true]);
    expect([await issuedCount(a), await issuedCount(later)]).toEqual([1, 1]);
  });

  it("K981-API-010 同時に 2 回：201 と 409 が 1 つずつで、請求書は会社ごとに 1 枚・記録も 1 行", async () => {
    const w = await paying("同時に", "team");
    const [x, y] = await Promise.all([issue({ month: "2019-11" }), issue({ month: "2019-11" })]);
    expect([x.r.status, y.r.status].sort()).toEqual([201, 409]);
    expect(await issuedCount(w)).toBe(1);
    expect(
      await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = 'invoice.issue'", [
        w.tenantId,
      ]),
    ).toBe(1);
  });

  it("K981-API-011 締めていない月：日本の今月と来月は、下書きも出すも 409 E-BILL-002 で欄も details も無く、何も書かない", async () => {
    const w = await paying("今月", "team");
    const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date()).slice(0, 7);
    const [y, m] = now.split("-").map(Number) as [number, number];
    const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
    for (const [month, dry] of [
      [now, true],
      [now, false],
      [next, false],
    ] as const) {
      const { r, j } = await issue({ month, dry_run: dry });
      expect([r.status, j["code"], isFlat(j)], `${month} ${dry}`).toEqual([409, "E-BILL-002", true]);
    }
    expect(await issuedCount(w)).toBe(0);
  });
});

describe("K-981 入口と守り", () => {
  it("K981-API-012 本人確認：取り直していない・16 分前は 403 STEP_UP_REQUIRED で書かない。14 分前なら出せる", async () => {
    const w = await paying("本人確認", "team");
    for (const step of [undefined, 16 * 60]) {
      const { r, j } = await issue({ month: "2019-12" }, money, step);
      expect([r.status, j["code"]], String(step)).toEqual([403, "STEP_UP_REQUIRED"]);
    }
    expect(await issuedCount(w)).toBe(0);
    expect((await issue({ month: "2019-12" }, money, 14 * 60)).r.status).toBe(201);
    expect(await issuedCount(w)).toBe(1);
  });

  it("K981-API-013 入口：ログインなし 401・会社の管理者 403・お金を持たない運営の人 403。どれも請求書を作らない", async () => {
    const w = await paying("入口", "team");
    expect((await issue({ month: "2018-02" }, null)).r.status).toBe(401);
    expect((await issue({ month: "2018-02" }, w.admin)).r.status).toBe(403);
    expect((await issue({ month: "2018-02" }, noMoney)).r.status).toBe(403);
    expect(await issuedCount(w)).toBe(0);
  });

  it('K981-API-014 形の誤り：month の 2019-13・2019-1・無い、dry_run の "yes"、知らない欄は 422 で何も書かない', async () => {
    const w = await paying("形", "team");
    for (const body of [
      { month: "2019-13" },
      { month: "2019-1" },
      {},
      { month: "2018-03", dry_run: "yes" },
      { month: "2018-03", tenant_id: w.tenantId },
    ]) {
      expect((await issue(body)).r.status, JSON.stringify(body)).toBe(422);
    }
    expect(await issuedCount(w)).toBe(0);
  });

  it("K981-API-015 DB が落ちる（記録が書けない）と 503 E-PAGE-003 で、請求書も鈴も 1 つも残らない。ログに会社の名前が出ない", async () => {
    const w = await paying("落ちる", "team");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const { r, j } = await issue({ month: "2018-04" });
      expect([r.status, j["code"]]).toEqual([503, "E-PAGE-003"]);
      expect(await issuedCount(w)).toBe(0);
      expect((await t.bells(w, "billing.invoice_issued")).admin).toBe(0);
      const logs = [...warn.mock.calls, ...err.mock.calls].flat().map(String).join("\n");
      expect(logs).not.toContain(w.name);
    } finally {
      await restore();
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K981-API-016 上限を超えると 429・retry_after_sec は 1〜60 の整数・429 では書かない", async () => {
    t.limits["issueOpsInvoices"] = 1;
    try {
      const ip = "203.0.113.181";
      expect((await issue({ month: "2018-05", dry_run: true }, money, STEP, ip)).r.status).toBe(201);
      const { r, j } = await issue({ month: "2018-05" }, money, STEP, ip);
      expect(r.status).toBe(429);
      const s = j["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.limits["issueOpsInvoices"];
    }
  });

  it("K981-DB-001 関数の中の 2 層目：会社の人の文脈で app.ops_invoices_issue を直に呼ぶと 42501。security definer で PUBLIC は呼べない", async () => {
    const w = await t.world("2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(c.query("select app.ops_invoices_issue('2018-06', true, '{}'::jsonb)")).rejects.toMatchObject({
        code: "42501",
      });
    } finally {
      await c.query("rollback");
      c.release();
    }
    const f = (await t.row<{ sd: boolean; pub: boolean }>(
      `select p.prosecdef as sd, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ops_invoices_issue'`,
    ))!;
    expect([f.sd, f.pub]).toEqual([true, false]);
  });
});
