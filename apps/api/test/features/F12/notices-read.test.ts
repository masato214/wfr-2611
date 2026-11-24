// K-954 お知らせを読む（listNotices・GET /api/v1/notices）と読んだ印（markNoticeRead・POST /api/v1/notices/:id/read）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1004 の「画面が使う答えの形」：Notice の 9 欄（id・kind・title・body・state・published_at・unread・maintenance・updates）。
//   届け先の決め（app.member_notices・app.notice_for_tenant）・読んだ印（app.member_notice_read）は K-954 の migration。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { startNotices, isFlat, OPS_TENANT, type Notices, type World } from "./notice.harness.js";

let t: Notices;
let w: World;
let far: World;
const FIELDS = ["body", "id", "kind", "maintenance", "published_at", "state", "title", "unread", "updates"];

beforeAll(async () => {
  t = await startNotices("k954", ["notices-read"]);
  w = await t.world("山口商事");
  far = await t.world("遠くの会社");
});
afterAll(async () => {
  await t.close();
});

const list = async (q = "") => {
  const r = await t.call(w.member, "GET", `/notices${q}`);
  return { r, b: await t.json(r) };
};
const titles = (rows: Record<string, unknown>[]) => rows.map((x) => String(x["title"]).slice(t.run.length + 1));

describe("K-954 お知らせを読む：一覧", () => {
  it("K954-API-001 一覧の 1 行は 9 欄・出した時刻の新しい順", async () => {
    await t.notice({ title: "古い", publishIn: -300 });
    await t.notice({ title: "新しい", publishIn: -100 });
    const { r, b } = await list();
    expect(r.status).toBe(200);
    const rows = t.mine(b.data).filter((x) => ["古い", "新しい"].includes(titles([x])[0]!));
    expect(titles(rows)).toEqual(["新しい", "古い"]);
    for (const x of rows) expect(Object.keys(x).sort()).toEqual(FIELDS);
    expect(typeof rows[0]!["published_at"]).toBe("string");
  });

  it("K954-API-002 誰に：全部・自分のプラン・自分のワークスペース（新しい列と前の列）は出て、ほかのプラン・ほかのワークスペースは出ない", async () => {
    const team = await t.plan("team");
    const biz = await t.plan("business");
    await t.subscribe(w.tenantId, team);
    await t.notice({ title: "全部" });
    await t.notice({ title: "チームのプラン", planIds: [team] });
    await t.notice({ title: "ビジネスのプラン", planIds: [biz] });
    await t.notice({ title: "自分の会社", tenantIds: [w.tenantId] });
    await t.notice({ title: "前の列で自分の会社", tenantId: w.tenantId });
    await t.notice({ title: "遠くの会社だけ", tenantIds: [far.tenantId] });
    const got = titles(t.mine((await list()).b.data));
    expect(got).toEqual(expect.arrayContaining(["全部", "チームのプラン", "自分の会社", "前の列で自分の会社"]));
    expect(got).not.toContain("ビジネスのプラン");
    expect(got).not.toContain("遠くの会社だけ");
    const farGot = titles(t.mine((await t.json(await t.call(far.member, "GET", "/notices"))).data));
    expect(farGot).toContain("遠くの会社だけ");
    expect(farGot).not.toContain("自分の会社");
  });

  it("K954-API-003 出していない・予定の時刻の前・消した物は出ない。予定の時刻を過ぎた物は出る", async () => {
    await t.notice({ title: "下書き", state: "draft", tenantIds: [w.tenantId] });
    await t.notice({ title: "予定の前", state: "scheduled", publishIn: 3600, tenantIds: [w.tenantId] });
    await t.notice({ title: "予定を過ぎた", state: "scheduled", publishIn: -5, tenantIds: [w.tenantId] });
    await t.notice({ title: "消した", deleted: true, tenantIds: [w.tenantId] });
    const got = titles(t.mine((await list()).b.data));
    expect(got).toContain("予定を過ぎた");
    expect(got).not.toContain("下書き");
    expect(got).not.toContain("予定の前");
    expect(got).not.toContain("消した");
  });

  it("K954-API-004 出す場所に一覧（list）が無い物（上の帯だけ）は一覧に出ない", async () => {
    await t.notice({ title: "帯だけ", placements: ["banner"], tenantIds: [w.tenantId] });
    await t.notice({ title: "帯と一覧", placements: ["banner", "list"], tenantIds: [w.tenantId] });
    const got = titles(t.mine((await list()).b.data));
    expect(got).toContain("帯と一覧");
    expect(got).not.toContain("帯だけ");
  });

  it("K954-API-005 運営の会社でない行（顧客の会社の tenant_id のお知らせ）は出ない", async () => {
    await t.notice({ title: "顧客の会社の行", ownerTenant: w.tenantId });
    expect(titles(t.mine((await list()).b.data))).not.toContain("顧客の会社の行");
  });

  it("K954-API-006 まだ読んでいない：読む前は unread true・本人が読むと false・同じ会社の別の人が読んでも自分は true のまま", async () => {
    const id = await t.notice({ title: "既読の確かめ", tenantIds: [w.tenantId] });
    const one = async (p = w.member) =>
      t.mine((await t.json(await t.call(p, "GET", "/notices"))).data).find((x) => x["id"] === id)!;
    expect((await one())["unread"]).toBe(true);
    expect((await t.call(w.other, "POST", `/notices/${id}/read`, {})).status).toBe(200);
    expect((await one())["unread"]).toBe(true);
    expect((await one(w.other))["unread"]).toBe(false);
    expect((await t.call(w.member, "POST", `/notices/${id}/read`, {})).status).toBe(200);
    expect((await one())["unread"]).toBe(false);
  });

  it("K954-API-007 絞り込み：kind で種類だけ・unread=true でまだ読んでいない物だけ", async () => {
    await t.notice({ title: "障害の絞り", kind: "incident", tenantIds: [w.tenantId] });
    const read = await t.notice({ title: "読んだリリース", kind: "release", tenantIds: [w.tenantId] });
    await t.call(w.member, "POST", `/notices/${read}/read`, {});
    const inc = t.mine((await list("?kind=incident")).b.data);
    expect(inc.length).toBeGreaterThan(0);
    expect(inc.every((x) => x["kind"] === "incident")).toBe(true);
    const unread = t.mine((await list("?unread=true")).b.data);
    expect(unread.every((x) => x["unread"] === true)).toBe(true);
    expect(titles(unread)).not.toContain("読んだリリース");
    expect(titles(unread)).toContain("障害の絞り");
  });

  it("K954-API-008 中身：障害は今の状態と続報（古い順）・メンテは時間と影響・リリースは state も maintenance も null で続報は空", async () => {
    const inc = await t.notice({ title: "遅れ", kind: "incident", tenantIds: [w.tenantId] });
    await t.incident(inc, "identified");
    await t.update(inc, "investigating", "調べています", -300);
    await t.update(inc, "identified", "原因が分かりました", -100);
    const mt = await t.notice({
      title: "メンテ",
      kind: "maintenance",
      tenantIds: [w.tenantId],
      maintenance: { fromIn: 86400, toIn: 90000 },
      impact: "この間は使えません",
    });
    const rel = await t.notice({ title: "リリース", kind: "release", tenantIds: [w.tenantId] });
    const rows = t.mine((await list()).b.data);
    const by = (id: string) => rows.find((x) => x["id"] === id)!;
    expect(by(inc)["state"]).toBe("identified");
    expect((by(inc)["updates"] as Record<string, unknown>[]).map((u) => [u["state"], u["body"]])).toEqual([
      ["investigating", "調べています"],
      ["identified", "原因が分かりました"],
    ]);
    expect(Object.keys((by(inc)["updates"] as Record<string, unknown>[])[0]!).sort()).toEqual(["at", "body", "state"]);
    const m = by(mt)["maintenance"] as Record<string, unknown>;
    expect(Object.keys(m).sort()).toEqual(["from", "impact", "to"]);
    expect(m["impact"]).toBe("この間は使えません");
    expect(Date.parse(String(m["to"])) - Date.parse(String(m["from"]))).toBe(3600 * 1000);
    expect(by(rel)["state"]).toBeNull();
    expect(by(rel)["maintenance"]).toBeNull();
    expect(by(rel)["updates"]).toEqual([]);
  });

  it("K954-API-009 上限：見えるお知らせが 101 件以上なら新しい順の 100 件・ログに 1 行（題は出さない）", async () => {
    await t.f.admin.query(
      `insert into notices (tenant_id, kind_id, title, body, state, publish_at, placements, target_tenant_ids)
       select $1, 'release', $2 || ' 多い ' || g, '本文', 'published', now() - make_interval(secs => g), '{list}', array[$3::uuid]
         from generate_series(1, 101) g`,
      [OPS_TENANT, t.run, w.tenantId],
    );
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { r, b } = await list();
    const lines = spy.mock.calls.map((c) => c.join(" "));
    spy.mockRestore();
    await t.f.admin.query("delete from notices where title like $1", [`${t.run} 多い %`]);
    expect(r.status).toBe(200);
    expect((b.data as unknown[]).length).toBe(100);
    expect(lines.filter((l) => l.includes("[notices] 一覧を 100 件で切った"))).toHaveLength(1);
    expect(lines.join("\n")).not.toContain(t.run);
  });

  it("K954-API-010 ログインしていない：401・data が無い", async () => {
    const r = await t.call(null, "GET", "/notices");
    expect(r.status).toBe(401);
    expect((await t.json(r)).data).toBeUndefined();
  });

  it("K954-API-011 先方の権限の人（role client）：一覧も読んだ印も 403", async () => {
    const id = await t.notice({ title: "先方", tenantIds: [w.tenantId] });
    expect((await t.call(w.guest, "GET", "/notices")).status).toBe(403);
    expect((await t.call(w.guest, "POST", `/notices/${id}/read`, {})).status).toBe(403);
    expect(await t.n("select count(*) n from notice_deliveries where notice_id = $1", [id])).toBe(0);
  });

  it("K954-API-012 上限を超える：429・retry_after_sec は 1〜60", async () => {
    t.f.limits["listNotices"] = 1;
    try {
      const ip = "203.0.113.254";
      await t.f.req("GET", "/notices", { headers: w.other.auth, ip });
      const r = await t.f.req("GET", "/notices", { headers: w.other.auth, ip });
      expect(r.status).toBe(429);
      const s = Number((await t.json(r))["retry_after_sec"]);
      expect(s >= 1 && s <= 60).toBe(true);
    } finally {
      delete t.f.limits["listNotices"];
    }
  });

  it("K954-API-013 貯めない：一覧と読んだ印の答えの Cache-Control に private と no-store", async () => {
    const id = await t.notice({ title: "貯めない", tenantIds: [w.tenantId] });
    for (const r of [
      await t.call(w.member, "GET", "/notices"),
      await t.call(w.member, "POST", `/notices/${id}/read`, {}),
    ]) {
      const cc = r.headers.get("cache-control") ?? "";
      expect(cc).toContain("private");
      expect(cc).toContain("no-store");
    }
  });

  it("K954-API-014 知らない種類・unread が true でない：422（入口の値の形）", async () => {
    expect((await list("?kind=urgent")).r.status).toBe(422);
    expect((await list("?unread=yes")).r.status).toBe(422);
  });

  it("K954-API-015 DB が落ちた（続報の表が読めない）：503・E-PAGE-003・題を出さない", async () => {
    await t.notice({ title: "落ちた", tenantIds: [w.tenantId] });
    await t.f.admin.query("alter table notice_updates rename to notice_updates_k954_down");
    const got = await list().finally(() =>
      t.f.admin.query("alter table notice_updates_k954_down rename to notice_updates"),
    );
    expect(got.r.status).toBe(503);
    expect(got.b["code"]).toBe("E-PAGE-003");
    expect(JSON.stringify(got.b)).not.toContain(t.run);
    expect((await list()).r.status, "戻すと読める").toBe(200);
  });
});

describe("K-954 読んだ印", () => {
  it("K954-API-016 読んだ印：200 { id, read_at }・本人の行が 1 つ（会社と人はセッションから）", async () => {
    const id = await t.notice({ title: "読む", tenantIds: [w.tenantId] });
    const r = await t.call(w.member, "POST", `/notices/${id}/read`, {});
    expect(r.status).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["id", "read_at"]);
    expect(d["id"]).toBe(id);
    expect(Number.isNaN(Date.parse(String(d["read_at"])))).toBe(false);
    const rows = await t.f.admin.query<{ tenant_id: string; member_id: string }>(
      "select tenant_id, member_id from notice_deliveries where notice_id = $1 and deleted_at is null",
      [id],
    );
    expect(rows.rows).toEqual([{ tenant_id: w.tenantId, member_id: w.member.id }]);
  });

  it("K954-API-017 2 回目と同時の 2 回：答えの read_at は最初のまま・行は 1 つ", async () => {
    const id = await t.notice({ title: "二度押し", tenantIds: [w.tenantId] });
    const [a, b] = await Promise.all([
      t.call(w.member, "POST", `/notices/${id}/read`, {}),
      t.call(w.member, "POST", `/notices/${id}/read`, {}),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const first = ((await t.json(a)).data as Record<string, unknown>)["read_at"];
    expect(((await t.json(b)).data as Record<string, unknown>)["read_at"]).toBe(first);
    const again = await t.call(w.member, "POST", `/notices/${id}/read`, {});
    expect(((await t.json(again)).data as Record<string, unknown>)["read_at"]).toBe(first);
    expect(
      await t.n("select count(*) n from notice_deliveries where notice_id = $1 and member_id = $2", [id, w.member.id]),
    ).toBe(1);
  });

  it("K954-API-018 見えないお知らせ（ほかのワークスペース向け・下書き・消した・無い id）：404 E-PAGE-001・欄も details も無い・行を作らない", async () => {
    const ids = [
      await t.notice({ title: "遠く向け", tenantIds: [far.tenantId] }),
      await t.notice({ title: "下書き向け", state: "draft", tenantIds: [w.tenantId] }),
      await t.notice({ title: "消した向け", deleted: true, tenantIds: [w.tenantId] }),
      randomUUID(),
    ];
    for (const id of ids) {
      const r = await t.call(w.member, "POST", `/notices/${id}/read`, {});
      const b = await t.json(r);
      expect([r.status, b["code"]]).toEqual([404, "E-PAGE-001"]);
      expect(isFlat(b)).toBe(true);
    }
    expect(await t.n("select count(*) n from notice_deliveries where notice_id = any($1::uuid[])", [ids])).toBe(0);
  });

  it("K954-API-019 体に知らない鍵がある：422（入口の strict な形）・行を作らない", async () => {
    const id = await t.notice({ title: "余計な鍵", tenantIds: [w.tenantId] });
    const r = await t.call(w.member, "POST", `/notices/${id}/read`, { member_id: w.other.id });
    expect(r.status).toBe(422);
    expect(await t.n("select count(*) n from notice_deliveries where notice_id = $1", [id])).toBe(0);
  });

  it("K954-API-020 書けない（DB が落ちた）：503・E-PAGE-003・行は残らない・もう一度で書ける", async () => {
    const id = await t.notice({ title: "書けない", tenantIds: [w.tenantId] });
    const undo = await t.breakDeliveries(w.member.id);
    const r = await t.call(w.member, "POST", `/notices/${id}/read`, {}).finally(undo);
    expect([r.status, (await t.json(r))["code"]]).toEqual([503, "E-PAGE-003"]);
    expect(await t.n("select count(*) n from notice_deliveries where notice_id = $1", [id])).toBe(0);
    expect((await t.call(w.member, "POST", `/notices/${id}/read`, {})).status).toBe(200);
  });

  it("K954-API-021 運営のお知らせは鈴に出さない：一覧と読んだ印の後も、その人の知らせ（notifications）の行は増えない（D-156.28）", async () => {
    const before = await t.n("select count(*) n from notifications where member_id = $1", [w.member.id]);
    const id = await t.notice({
      title: "鈴",
      kind: "incident",
      placements: ["banner", "list"],
      tenantIds: [w.tenantId],
    });
    await list();
    await t.call(w.member, "POST", `/notices/${id}/read`, {});
    expect(await t.n("select count(*) n from notifications where member_id = $1", [w.member.id])).toBe(before);
  });
});

describe("K-954 DB の関数と表", () => {
  it("K954-DB-001 関数 3 つは security definer・kaname_app は呼べ、誰でも（PUBLIC）は呼べない", async () => {
    const r = await t.f.admin.query<{ name: string; definer: boolean; app: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer,
              has_function_privilege('kaname_app', p.oid, 'execute') as app,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as pub
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'app' and p.proname in ('member_notices', 'member_notice_read', 'notice_for_member', 'notice_for_tenant')
        order by p.proname`,
    );
    expect(r.rows.map((x) => x.name)).toEqual([
      "member_notice_read",
      "member_notices",
      "notice_for_member",
      "notice_for_tenant",
    ]);
    for (const x of r.rows) expect([x.definer, x.app, x.pub]).toEqual([true, true, false]);
  });

  it("K954-DB-002 2 層目：会社の人でない文脈（運営・会社なし）で呼ぶと 42501", async () => {
    const ctx = { tenantId: null, userId: randomUUID(), role: "ops" as const, stepUpAt: null };
    for (const sql of [
      "select app.member_notices(null, false, 10)",
      `select app.member_notice_read('${randomUUID()}')`,
    ]) {
      await expect(withTenant(t.f.pool, ctx as never, (cl) => cl.query(sql))).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("K954-DB-003 表：notices に target_tenant_ids と impact・続報の表 notice_updates は会社の人に見えない・既読は人ごとに 1 つ（一意の索引）", async () => {
    const cols = await t.f.admin.query<{ c: string }>(
      "select column_name c from information_schema.columns where table_name = 'notices' and column_name in ('target_tenant_ids', 'impact') order by 1",
    );
    expect(cols.rows.map((x) => x.c)).toEqual(["impact", "target_tenant_ids"]);
    const id = await t.notice({ title: "見えない続報", kind: "incident", tenantIds: [w.tenantId] });
    await t.update(id, "investigating", "続報", -10);
    const ctx = { tenantId: w.tenantId, userId: w.member.id, role: "member" as const, stepUpAt: null };
    const seen = await withTenant(t.f.pool, ctx as never, (cl) =>
      cl.query("select count(*)::int n from notice_updates where notice_id = $1", [id]),
    );
    expect(seen.rows[0]).toEqual({ n: 0 });
    await t.f.admin.query(
      "insert into notice_deliveries (tenant_id, notice_id, member_id, read_at) values ($1, $2, $3, now())",
      [w.tenantId, id, w.member.id],
    );
    await expect(
      t.f.admin.query(
        "insert into notice_deliveries (tenant_id, notice_id, member_id, read_at) values ($1, $2, $3, now())",
        [w.tenantId, id, w.member.id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });
});

describe("K-954 管理者だけのお知らせ（D-156.57）", () => {
  it("K954-API-022 管理者だけ：admins_only のお知らせは管理者の一覧に出て読んだ印が付き、管理者でない人の一覧に出ず読んだ印は 404 E-PAGE-001・行を作らない", async () => {
    const roles = await t.f.admin.query<{ member_id: string; role: string }>(
      "select member_id, role from tenant_memberships where tenant_id = $1 and member_id = any($2::uuid[])",
      [w.tenantId, [w.member.id, w.other.id]],
    );
    const setRole = (memberId: string, role: string) =>
      t.f.admin.query("update tenant_memberships set role = $3 where tenant_id = $1 and member_id = $2", [
        w.tenantId,
        memberId,
        role,
      ]);
    try {
      await setRole(w.member.id, "admin");
      await setRole(w.other.id, "member");
      const id = await t.notice({ title: "値段が変わります", tenantIds: [w.tenantId], adminsOnly: true });
      expect(titles(t.mine((await list()).b.data))).toContain("値段が変わります");
      expect((await t.call(w.member, "POST", `/notices/${id}/read`, {})).status).toBe(200);
      const otherList = titles(t.mine((await t.json(await t.call(w.other, "GET", "/notices"))).data));
      expect(otherList).not.toContain("値段が変わります");
      const r = await t.call(w.other, "POST", `/notices/${id}/read`, {});
      expect(r.status).toBe(404);
      expect((await t.json(r))["code"]).toBe("E-PAGE-001");
      expect(
        await t.n("select count(*)::int as n from notice_deliveries where notice_id = $1 and member_id = $2", [
          id,
          w.other.id,
        ]),
      ).toBe(0);
    } finally {
      for (const x of roles.rows) await setRole(x.member_id, x.role);
    }
  });
});
