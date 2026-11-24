// K-958 請求書を読む（getBilling・GET /api/v1/workspace/billing／downloadInvoicePdf・GET /api/v1/invoices/:id/pdf）。
//   テストの名前の頭の行 ID（K958-…）は 11_tickets/K-958.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1005：getBilling の 7 欄・請求書の 1 行（払われていない 6 欄・払われたら paid_on を足して 7 欄）・PDF は { url, expires_at }。
//   見られるのは「プランと支払い」の能力を持つ人（D-156.29）。状態は お支払い待ち（unpaid）／払われた（paid）／期限を過ぎた（overdue）の 3 つで、
//   入金の合計が請求の額と同じときだけ払われた（足りない・多いは unpaid のまま・D-156.32）。打ち消しの行は負の額
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  startBilling,
  isFlat,
  jstDay,
  jstMonth,
  API_BASE,
  BILLING_KEYS,
  INVOICE_KEYS,
  PAYEE,
  TERMS,
  type Billing,
  type World,
} from "./billing.harness.js";

let t: Billing;
let w: World;
let far: World;

beforeAll(async () => {
  t = await startBilling("k958", ["billing-read"]);
  w = await t.world("ENGINE BASE", { plan: "team" });
  far = await t.world("遠くの会社", { plan: "team" });
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const get = async (who = w.admin) => {
  const r = await t.call(who, "GET", "/workspace/billing");
  return { r, b: await t.json(r) };
};
const pdf = async (id: string, who = w.admin) => {
  const r = await t.call(who, "GET", `/invoices/${id}/pdf`);
  return { r, b: await t.json(r) };
};
const rowOf = (b: { data?: unknown }, id: string) => ((b.data as Row)["invoices"] as Row[]).find((x) => x["id"] === id);

describe("K-958 請求書の画面の中身（getBilling）", () => {
  it("K958-API-001 答えは 7 欄で、請求書の 1 行は払われていなければ 6 欄・払われたら paid_on を足して 7 欄", async () => {
    const me = await t.world("欄の数", { plan: "team" });
    const a = await t.invoice(me.tenantId, { month: jstMonth(-1), dueOn: jstDay(20) });
    const p = await t.invoice(me.tenantId, { month: jstMonth(-2), dueOn: jstDay(-10) });
    await t.pay(p, 16_500, jstDay(-12));
    const { r, b } = await get(me.admin);
    expect(r.status).toBe(200);
    expect(Object.keys(b.data as Row).sort()).toEqual(BILLING_KEYS);
    expect(Object.keys(rowOf(b, a)!).sort()).toEqual(INVOICE_KEYS);
    expect(Object.keys(rowOf(b, p)!).sort()).toEqual([...INVOICE_KEYS, "paid_on"].sort());
    expect(rowOf(b, a)).toMatchObject({ month: jstMonth(-1), amount_total: 16_500, due_on: jstDay(20) });
  });

  it("K958-API-002 状態：期限の前で入金なしは unpaid・期限を過ぎたら overdue・入金の合計が額と同じなら paid（paid_on は最後の入金の日）", async () => {
    const me = await t.world("状態", { plan: "team" });
    const unpaid = await t.invoice(me.tenantId, { month: jstMonth(-1), dueOn: jstDay(5) });
    const overdue = await t.invoice(me.tenantId, { month: jstMonth(-2), dueOn: jstDay(-1) });
    const paid = await t.invoice(me.tenantId, { month: jstMonth(-3), dueOn: jstDay(-30) });
    await t.pay(paid, 10_000, jstDay(-35));
    await t.pay(paid, 6_500, jstDay(-33));
    const { b } = await get(me.admin);
    expect(rowOf(b, unpaid)!["state"]).toBe("unpaid");
    expect(rowOf(b, overdue)!["state"]).toBe("overdue");
    expect(rowOf(b, paid)).toMatchObject({ state: "paid", paid_on: jstDay(-33) });
  });

  it("K958-API-003 入金の差：足りない・多いは払われたにしない。打ち消しの行（負の額）で合計が減ったら払われたから戻る", async () => {
    const me = await t.world("入金の差", { plan: "team" });
    const short = await t.invoice(me.tenantId, { month: jstMonth(-1), dueOn: jstDay(5) });
    await t.pay(short, 10_000, jstDay(-1));
    const over = await t.invoice(me.tenantId, { month: jstMonth(-2), dueOn: jstDay(5) });
    await t.pay(over, 17_000, jstDay(-1));
    const back = await t.invoice(me.tenantId, { month: jstMonth(-3), dueOn: jstDay(5) });
    await t.pay(back, 16_500, jstDay(-2));
    await t.pay(back, -16_500, jstDay(-1));
    const { b } = await get(me.admin);
    for (const id of [short, over, back]) {
      expect(rowOf(b, id)!["state"]).toBe("unpaid");
      expect("paid_on" in rowOf(b, id)!).toBe(false);
    }
  });

  it("K958-API-004 期限を過ぎた請求の数と額：overdue に { count, amount_total }。1 つも無ければ null", async () => {
    const me = await t.world("期限の注意", { plan: "team" });
    expect((await get(me.admin)).b.data as Row).toMatchObject({ overdue: null });
    await t.invoice(me.tenantId, { month: jstMonth(-2), dueOn: jstDay(-3), amount: 16_500 });
    await t.invoice(me.tenantId, { month: jstMonth(-3), dueOn: jstDay(-30), amount: 44_000 });
    await t.invoice(me.tenantId, { month: jstMonth(-1), dueOn: jstDay(3) });
    expect(((await get(me.admin)).b.data as Row)["overdue"]).toEqual({ count: 2, amount_total: 60_500 });
  });

  it("K958-API-005 並びは請求の月の新しい順。出していない下書き・消した請求書は出ない", async () => {
    const me = await t.world("並び", { plan: "team" });
    const older = await t.invoice(me.tenantId, { month: jstMonth(-3), dueOn: jstDay(-30) });
    const newer = await t.invoice(me.tenantId, { month: jstMonth(-1), dueOn: jstDay(10) });
    const mid = await t.invoice(me.tenantId, { month: jstMonth(-2), dueOn: jstDay(-1) });
    const draft = await t.invoice(me.tenantId, { month: jstMonth(0), dueOn: jstDay(40), issued: false });
    const gone = await t.invoice(me.tenantId, { month: jstMonth(-4), dueOn: jstDay(-60), deleted: true });
    const ids = (((await get(me.admin)).b.data as Row)["invoices"] as Row[]).map((x) => x["id"]);
    expect(ids).toEqual([newer, mid, older]);
    expect(ids).not.toContain(draft);
    expect(ids).not.toContain(gone);
  });

  it("K958-API-006 無料のプラン（契約の行が無い）は free が true・請求書は空。チームの契約があれば free は false", async () => {
    const free = await t.world("無料");
    const { b } = await get(free.admin);
    expect(b.data as Row).toMatchObject({ free: true, invoices: [], overdue: null });
    expect(((await get(w.admin)).b.data as Row)["free"]).toBe(false);
  });

  it("K958-API-007 請求先：まだ決めていなければ会社名はワークスペースの名前・宛名とメールは空の字。決めてあればその 3 つ", async () => {
    const me = await t.world("請求先", { plan: "team" });
    expect(((await get(me.admin)).b.data as Row)["contact"]).toEqual({ company: me.name, attn: "", email: "" });
    await t.f.admin.query("update tenants set billing_contact = $2 where id = $1", [
      me.tenantId,
      { company: "株式会社ENGINE BASE", attn: "経理 佐々木", email: "keiri@example.com" },
    ]);
    expect(((await get(me.admin)).b.data as Row)["contact"]).toEqual({
      company: "株式会社ENGINE BASE",
      attn: "経理 佐々木",
      email: "keiri@example.com",
    });
  });

  it("K958-API-008 支払い条件と振込先は設定の値（config.billing）をそのまま返す。請求先を変えられる印は true・答えは貯めない（private, no-store）", async () => {
    const { r, b } = await get();
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    expect(r.headers.get("cache-control") ?? "").toContain("private");
    const d = b.data as Row;
    expect(d["terms"]).toBe(TERMS);
    expect(d["payee"]).toEqual({ lines: PAYEE });
    expect(d["can_edit_contact"]).toBe(true);
  });

  it("K958-API-009 別の会社の請求書は混ざらない", async () => {
    const mine = await t.invoice(w.tenantId, { month: jstMonth(-1), dueOn: jstDay(10) });
    const theirs = await t.invoice(far.tenantId, { month: jstMonth(-1), dueOn: jstDay(10) });
    const ids = (((await get(w.admin)).b.data as Row)["invoices"] as Row[]).map((x) => x["id"]);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(theirs);
  });

  it("K958-API-010 見られる人：管理者と「プランと支払い」を付けた人は 200。能力の無い人・先方の権限の人は 403・ログインなしは 401", async () => {
    expect((await get(w.admin)).r.status).toBe(200);
    expect((await get(w.payer)).r.status).toBe(200);
    expect((await get(w.staff)).r.status).toBe(403);
    expect((await get(w.guest)).r.status).toBe(403);
    expect((await t.call(null, "GET", "/workspace/billing")).status).toBe(401);
  });

  it("K958-API-011 DB が落ちると 503 E-PAGE-003 で、中身を返さない", async () => {
    const restore = await t.breakFn("app.billing_get()");
    try {
      const { r, b } = await get();
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
      expect(b.data).toBeUndefined();
    } finally {
      await restore();
    }
  });

  it("K958-API-012 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    t.limits["getBilling"] = 1;
    try {
      const ip = "203.0.113.247";
      expect((await t.call(w.admin, "GET", "/workspace/billing", undefined, { ip })).status).toBe(200);
      const r = await t.call(w.admin, "GET", "/workspace/billing", undefined, { ip });
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.limits["getBilling"];
    }
  });
});

describe("K-958 請求書の PDF（downloadInvoicePdf）", () => {
  it("K958-API-013 出した請求書の PDF は 200 { url, expires_at }。url は口の住所の頭で始まる期限つきの署名 URL・期限は 10 分の内", async () => {
    // 共有の会社 w の出した請求書は、試験ごとに月を分ける（K-981 の一意の索引 invoices_tenant_period_uq：同じ会社・同じ月に出した請求書は 1 枚）
    const id = await t.invoice(w.tenantId, { month: jstMonth(-8), dueOn: jstDay(10) });
    const { r, b } = await pdf(id);
    expect(r.status).toBe(200);
    const d = b.data as Row;
    expect(Object.keys(d).sort()).toEqual(["expires_at", "url"]);
    expect(String(d["url"]).startsWith(`${API_BASE}/api/auth-ext/files/`)).toBe(true);
    expect(String(d["url"])).toContain("sig=");
    const left = new Date(String(d["expires_at"])).getTime() - Date.now();
    expect(left > 0 && left <= 600_000 + 5_000).toBe(true);
  });

  it("K958-API-014 別の会社の・無い・消した・出していない請求書は 404 E-PAGE-001 で、欄も details も付けない", async () => {
    const theirs = await t.invoice(far.tenantId, { month: jstMonth(-9), dueOn: jstDay(10) });
    const gone = await t.invoice(w.tenantId, { month: jstMonth(-5), dueOn: jstDay(-90), deleted: true });
    const draft = await t.invoice(w.tenantId, { month: jstMonth(0), dueOn: jstDay(40), issued: false });
    for (const id of [theirs, gone, draft, randomUUID()]) {
      const { r, b } = await pdf(id);
      expect(r.status).toBe(404);
      expect(b["code"]).toBe("E-PAGE-001");
      expect(isFlat(b)).toBe(true);
    }
  });

  it("K958-API-015 PDF がまだできていない請求書は 409 E-BILL-001 で、欄も details も付けない", async () => {
    const id = await t.invoice(w.tenantId, { month: jstMonth(-6), dueOn: jstDay(10), pdf: false });
    const { r, b } = await pdf(id);
    expect(r.status).toBe(409);
    expect(b["code"]).toBe("E-BILL-001");
    expect(isFlat(b)).toBe(true);
  });

  it("K958-API-016 PDF も能力の無い人・先方の権限の人は 403・ログインなしは 401", async () => {
    const id = await t.invoice(w.tenantId, { month: jstMonth(-7), dueOn: jstDay(10) });
    expect((await pdf(id, w.staff)).r.status).toBe(403);
    expect((await pdf(id, w.guest)).r.status).toBe(403);
    expect((await t.call(null, "GET", `/invoices/${id}/pdf`)).status).toBe(401);
  });
});

describe("K-958 DB の道", () => {
  it("K958-DB-001 運営の会社にプランが 3 つ（free・team・business／無料・チーム・ビジネス／月 0・15000・40000 円（税別）／人数 3・10・30）", async () => {
    const r = await t.f.admin.query<{ key: string; name: string; price: string; members: number }>(
      `select key, name, price_monthly::text as price, (limits->>'members')::int as members from plans
        where tenant_id = '00000000-0000-4000-8000-000000000001' and key in ('free', 'team', 'business') and deleted_at is null
        order by price_monthly`,
    );
    expect(r.rows.map((x) => [x.key, x.name, Number(x.price), x.members])).toEqual([
      ["free", "無料", 0, 3],
      ["team", "チーム", 15_000, 10],
      ["business", "ビジネス", 40_000, 30],
    ]);
  });

  it("K958-DB-002 関数の中の 2 層目：能力の無いメンバーの文脈で app.billing_get() を直に呼ぶと forbidden で中身を返さない", async () => {
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [w.tenantId, w.staff.id],
      );
      const v = (await c.query<{ v: Row }>("select app.billing_get() as v")).rows[0]!.v;
      expect(v).toEqual({ error: "forbidden" });
      await c.query("rollback");
    } finally {
      c.release();
    }
  });
});
