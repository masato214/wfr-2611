// K-955 ログイン後の稼働状況と上の帯（getServiceStatusForMember・GET /api/v1/service-status）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1004 の「画面が使う答えの形」：{ components: { key, label, state }[], bands: { kind, notice_id?, title, state?, from?, to?, closable, more }[], maintenance_now }。
//   届け先の決め（誰に・出したか）は K-954 の app.notice_for_tenant を使う。止める日（stop）と中を見られている間（peek）の帯は K-970・K-969 が中身を入れる
//   （この葉の時点では空の関数 app.member_stop_band()・app.member_peek_band() が null を返す）。
//   共用の DB なので、帯と様子を見るときはこの回の行（題の頭が run）か、この回の会社だけに向けた行を使う。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { startNotices, type Notices, type World } from "./notice.harness.js";

let t: Notices;
const HOUR = 3600;

beforeAll(async () => {
  t = await startNotices("k955", ["notices-read", "service-status-member", "service-status"]);
});
afterAll(async () => {
  await t.close();
});

const status = async (w: World) => {
  const r = await t.call(w.member, "GET", "/service-status");
  const b = await t.json(r);
  return { r, b, d: (b.data ?? {}) as Record<string, unknown> };
};
const comp = (d: Record<string, unknown>) =>
  Object.fromEntries((d["components"] as Record<string, unknown>[]).map((c) => [c["key"], c["state"]]));
const bands = (d: Record<string, unknown>, kind: string) =>
  (d["bands"] as Record<string, unknown>[]).filter((b) => b["kind"] === kind);

describe("K-955 稼働状況：様子", () => {
  it("K955-API-001 形：3 つの欄・様子は 3 行（画面・分身の実行・PC とのつながり）で鍵は key・label・state", async () => {
    const w = await t.world("形");
    const { r, d } = await status(w);
    expect(r.status).toBe(200);
    expect(Object.keys(d).sort()).toEqual(["bands", "components", "maintenance_now"]);
    const cs = d["components"] as Record<string, unknown>[];
    expect(cs.map((c) => [c["key"], c["label"]])).toEqual([
      ["web", "画面"],
      ["runs", "分身の実行"],
      ["pc", "PC とのつながり"],
    ]);
    for (const c of cs) expect(Object.keys(c).sort()).toEqual(["key", "label", "state"]);
    expect(Array.isArray(d["bands"])).toBe(true);
  });

  it("K955-API-002 影響の印（affects）の無い障害しか無ければ、3 行とも normal", async () => {
    const w = await t.world("ふつう");
    const id = await t.notice({ title: "影響なし", kind: "incident", tenantIds: [w.tenantId] });
    await t.incident(id, "investigating");
    expect(comp((await status(w)).d)).toEqual({ web: "normal", runs: "normal", pc: "normal" });
  });

  it("K955-API-003 直っていない障害の affects：degraded は遅れている・down は止まっている・重なれば重い方。直った・ほかのワークスペース向けは効かない", async () => {
    const w = await t.world("遅れ");
    const far = await t.world("遠く");
    const a = await t.notice({
      title: "遅れ",
      kind: "incident",
      tenantIds: [w.tenantId],
      affects: { runs: "degraded" },
    });
    await t.incident(a, "identified");
    const b = await t.notice({
      title: "止まり",
      kind: "incident",
      tenantIds: [w.tenantId],
      affects: { runs: "down", pc: "degraded" },
    });
    await t.incident(b, "investigating");
    const c = await t.notice({ title: "直った", kind: "incident", tenantIds: [w.tenantId], affects: { web: "down" } });
    await t.incident(c, "resolved", { resolved: true });
    const d2 = await t.notice({
      title: "遠く向け",
      kind: "incident",
      tenantIds: [far.tenantId],
      affects: { web: "down" },
    });
    await t.incident(d2, "investigating");
    expect(comp((await status(w)).d)).toEqual({ web: "normal", runs: "down", pc: "degraded" });
    expect(comp((await status(far)).d)).toEqual({ web: "down", runs: "normal", pc: "normal" });
  });
});

describe("K-955 稼働状況：上の帯", () => {
  it("K955-API-004 障害の帯：出す場所に帯（banner）がある直っていない障害だけ。帯の鍵と値（closable true・more 0）・2 行目の字 note は最新の続報（無ければ本文の 1 行目）・障害の番号 ref は INC-<YYMM>-<2 けた>（D-156.45）", async () => {
    const w = await t.world("障害の帯");
    const id = await t.notice({
      title: "実行の遅れ",
      body: "送る順番を入れ替えています\n中身",
      kind: "incident",
      placements: ["banner", "list"],
      tenantIds: [w.tenantId],
    });
    await t.incident(id, "identified", { startedIn: -120 });
    const listOnly = await t.notice({ title: "一覧だけ", kind: "incident", tenantIds: [w.tenantId] });
    await t.incident(listOnly, "investigating");
    const got = bands((await status(w)).d, "incident");
    expect(got).toHaveLength(1);
    const b = got[0]!;
    expect(b["notice_id"]).toBe(id);
    expect(b["title"]).toBe(`${t.run} 実行の遅れ`);
    expect(b["state"]).toBe("identified");
    expect(typeof b["from"]).toBe("string");
    expect([b["closable"], b["more"]]).toEqual([true, 0]);
    expect(b["note"]).toBe("送る順番を入れ替えています");
    expect(String(b["ref"])).toMatch(/^INC-\d{4}-\d{2}$/);
    await t.update(id, "identified", "保存が遅くなっている所を直しています", -60);
    await t.update(id, "identified", "前の続報", -90);
    expect(bands((await status(w)).d, "incident")[0]!["note"]).toBe("保存が遅くなっている所を直しています");
  });

  it("K955-API-005 障害の帯が 2 つ：始まりの新しい 1 つと more 1・直ったら帯は消える", async () => {
    const w = await t.world("重なり");
    const old = await t.notice({
      title: "古い障害",
      kind: "incident",
      placements: ["banner"],
      tenantIds: [w.tenantId],
    });
    await t.incident(old, "investigating", { startedIn: -900 });
    const neu = await t.notice({
      title: "新しい障害",
      kind: "incident",
      placements: ["banner"],
      tenantIds: [w.tenantId],
    });
    await t.incident(neu, "investigating", { startedIn: -60 });
    const got = bands((await status(w)).d, "incident");
    expect(got.map((b) => [b["notice_id"], b["more"]])).toEqual([[neu, 1]]);
    await t.f.admin.query(
      "update status_incidents set state = 'resolved', resolved_at = now() where notice_id = any($1::uuid[])",
      [[old, neu]],
    );
    expect(bands((await status(w)).d, "incident")).toEqual([]);
  });

  it("K955-API-006 メンテの帯：帯のある予定・いま中のメンテの近い 1 つと more・終わった物は出ない・closable true・note は影響の字・ref は null", async () => {
    const w = await t.world("メンテの帯");
    const near = await t.notice({
      title: "近いメンテ",
      impact: "この間は画面が使えません",
      kind: "maintenance",
      placements: ["banner", "list"],
      tenantIds: [w.tenantId],
      maintenance: { fromIn: HOUR, toIn: 2 * HOUR },
    });
    await t.notice({
      title: "遠いメンテ",
      kind: "maintenance",
      placements: ["banner"],
      tenantIds: [w.tenantId],
      maintenance: { fromIn: 48 * HOUR, toIn: 49 * HOUR },
    });
    await t.notice({
      title: "終わった",
      kind: "maintenance",
      placements: ["banner"],
      tenantIds: [w.tenantId],
      maintenance: { fromIn: -2 * HOUR, toIn: -HOUR },
    });
    const got = bands((await status(w)).d, "maintenance");
    expect(got).toHaveLength(1);
    const b = got[0]!;
    expect([b["notice_id"], b["title"], b["closable"], b["more"]]).toEqual([near, `${t.run} 近いメンテ`, true, 1]);
    expect([b["note"], b["ref"]]).toEqual(["この間は画面が使えません", null]);
    expect(Date.parse(String(b["to"])) - Date.parse(String(b["from"]))).toBe(HOUR * 1000);
  });

  it("K955-API-007 いま中のメンテ：maintenance_now に from と to。予定（これから）だけのときは、その予定が入らない", async () => {
    const w = await t.world("中のメンテ");
    await t.notice({
      title: "予定だけ",
      kind: "maintenance",
      tenantIds: [w.tenantId],
      maintenance: { fromIn: HOUR, toIn: 2 * HOUR },
    });
    const before = (await status(w)).d["maintenance_now"] as Record<string, unknown> | null;
    const planned = new Date(Date.now() + 2 * HOUR * 1000).getTime();
    expect(before === null || Math.abs(Date.parse(String(before["to"])) - planned) > 60_000).toBe(true);
    await t.notice({
      title: "いま中",
      kind: "maintenance",
      tenantIds: [w.tenantId],
      // 終わりは 5 分後（台が混んで読むまでに時間がかかっても、まだ「いま中」のまま）
      maintenance: { fromIn: -60, toIn: 300 },
    });
    const now = (await status(w)).d["maintenance_now"] as Record<string, unknown>;
    expect(Object.keys(now).sort()).toEqual(["from", "to"]);
    expect(Math.abs(Date.parse(String(now["to"])) - (Date.now() + 300_000))).toBeLessThan(60_000);
  });

  it("K955-API-008 届け先：ほかのプラン・ほかのワークスペース向け・下書き・消した物は、帯にも様子にも効かない", async () => {
    const w = await t.world("届け先");
    const far = await t.world("届け先の外");
    const biz = await t.plan("business");
    const rows = [
      await t.notice({
        title: "別のプラン",
        kind: "incident",
        placements: ["banner"],
        planIds: [biz],
        affects: { web: "down" },
      }),
      await t.notice({
        title: "外向け",
        kind: "incident",
        placements: ["banner"],
        tenantIds: [far.tenantId],
        affects: { web: "down" },
      }),
      await t.notice({
        title: "下書き",
        kind: "incident",
        placements: ["banner"],
        state: "draft",
        tenantIds: [w.tenantId],
        affects: { web: "down" },
      }),
      await t.notice({
        title: "消した",
        kind: "incident",
        placements: ["banner"],
        deleted: true,
        tenantIds: [w.tenantId],
        affects: { web: "down" },
      }),
    ];
    for (const id of rows) await t.incident(id, "investigating");
    const { d } = await status(w);
    expect(comp(d)["web"]).toBe("normal");
    expect(bands(d, "incident").filter((b) => rows.includes(String(b["notice_id"])))).toEqual([]);
  });

  it("K955-API-009 止める日・中を見られている間の帯：この葉の時点の関数 app.member_stop_band()・app.member_peek_band() は null を返し、帯に stop・peek が無い", async () => {
    const w = await t.world("空の帯");
    const ctx = { tenantId: w.tenantId, userId: w.member.id, role: "member" as const, stepUpAt: null };
    const r = await withTenant(t.f.pool, ctx as never, (cl) =>
      cl.query<{ s: unknown; p: unknown }>("select app.member_stop_band() as s, app.member_peek_band() as p"),
    );
    expect(r.rows[0]).toEqual({ s: null, p: null });
    const { d } = await status(w);
    expect([...bands(d, "stop"), ...bands(d, "peek")]).toEqual([]);
  });
});

describe("K-955 稼働状況：入口と失敗", () => {
  it("K955-API-010 ログインしていない：401・data が無い", async () => {
    const r = await t.call(null, "GET", "/service-status");
    expect(r.status).toBe(401);
    expect((await t.json(r)).data).toBeUndefined();
  });

  it("K955-API-011 先方の権限の人（role client）：403", async () => {
    const w = await t.world("先方");
    expect((await t.call(w.guest, "GET", "/service-status")).status).toBe(403);
  });

  it("K955-API-012 上限を超える：429・retry_after_sec は 1〜60", async () => {
    const w = await t.world("上限");
    t.f.limits["getServiceStatusForMember"] = 1;
    try {
      await t.call(w.member, "GET", "/service-status");
      const r = await t.call(w.member, "GET", "/service-status");
      expect(r.status).toBe(429);
      const s = Number((await t.json(r))["retry_after_sec"]);
      expect(s >= 1 && s <= 60).toBe(true);
    } finally {
      delete t.f.limits["getServiceStatusForMember"];
    }
  });

  it("K955-API-013 貯めない：Cache-Control に private と no-store", async () => {
    const w = await t.world("貯めない");
    const cc = (await status(w)).r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("K955-API-014 DB が落ちた（帯の関数が呼べない）：503・E-PAGE-003・ふつう（空）を返さない", async () => {
    const w = await t.world("落ちた");
    await t.f.admin.query("alter function app.member_peek_band() rename to member_peek_band_k955_down");
    const got = await status(w).finally(() =>
      t.f.admin.query("alter function app.member_peek_band_k955_down() rename to member_peek_band"),
    );
    expect([got.r.status, got.b["code"]]).toEqual([503, "E-PAGE-003"]);
    expect(got.b.data).toBeUndefined();
    expect((await status(w)).r.status, "戻すと読める").toBe(200);
  });

  it("K955-API-015 ログイン前の口（getServiceStatus・K-307）の答えの形は incidents と maintenance のまま", async () => {
    const r = await t.call(null, "GET", "/auth/service-status");
    expect(r.status).toBe(200);
    expect(Object.keys((await t.json(r)).data as Record<string, unknown>).sort()).toEqual(["incidents", "maintenance"]);
  });
});

describe("K-955 DB の関数", () => {
  it("K955-DB-001 関数 4 つは security definer・kaname_app は呼べ、誰でも（PUBLIC）は呼べない", async () => {
    const r = await t.f.admin.query<{ name: string; definer: boolean; app: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer,
              has_function_privilege('kaname_app', p.oid, 'execute') as app,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as pub
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'app' and p.proname in ('member_service_status', 'member_status_ok', 'member_stop_band', 'member_peek_band')
        order by p.proname`,
    );
    expect(r.rows.map((x) => x.name)).toEqual([
      "member_peek_band",
      "member_service_status",
      "member_status_ok",
      "member_stop_band",
    ]);
    for (const x of r.rows) expect([x.definer, x.app, x.pub]).toEqual([true, true, false]);
  });

  it("K955-DB-002 2 層目：会社の人でない文脈（運営・会社なし）で app.member_service_status() を呼ぶと 42501", async () => {
    const ctx = { tenantId: null, userId: randomUUID(), role: "ops" as const, stepUpAt: null };
    await expect(
      withTenant(t.f.pool, ctx as never, (cl) => cl.query("select app.member_service_status()")),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
