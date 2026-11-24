// K-974 運営が受信箱の問い合わせの担当・状態・後でを変える（updateOpsInquiry・PATCH /api/v1/ops/inquiries/:id）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えは 1 行の 10 欄（K-948）。担当を取るのは自分だけ（人の id を受けず take・release の真偽）。ほかの人が担当の問い合わせは
//   取れない・状態を変えられない（取り合いは 409 E-OPS-005・D-156.25 の範囲）。変えたことは運営の記録と会社の記録に残す（record_ops_audit）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsInbox, ROW_KEYS, type OpsInbox } from "./ops-inbox.harness.js";
import { isFlat, type Json, type World } from "./inquiry.harness.js";
import type { Person } from "../fixture.js";

let t: OpsInbox;
let me: Person;
let other: Person;
let noInquiry: Person;
let w: World;

beforeAll(async () => {
  t = await startOpsInbox("k974", ["ops-inbox-update", "inquiry-read"]);
  me = await t.ops("高本");
  other = await t.ops("佐野");
  noInquiry = await t.ops("お金だけ", ["money"]);
  w = await t.world("ミナト企画");
});
afterAll(async () => {
  await t.close();
});

const patch = async (id: string, body: unknown, who: Person = me) => {
  const r = await t.call(who, "PATCH", `/ops/inquiries/${id}`, body);
  return { r, b: await t.json(r) };
};
const rowOf = (id: string) =>
  t.row<{ a: string | null; s: string; l: string | null }>(
    "select assignee_ops_member_id as a, state as s, later_until::text as l from inquiries where id = $1",
    [id],
  );
const logs = (id: string, action: string) =>
  t.n("select count(*) as n from ops_audit_events where action = $1 and target_id = $2", [action, id]);
const inHour = () => new Date(Date.now() + 3_600_000).toISOString();

describe("K-974 担当", () => {
  it("K974-API-001 取る：200・鍵はちょうど 10・owner は自分（member_id と名前）。運営の記録と会社の記録に inquiry.take が 1 行ずつ（target_label は題）", async () => {
    const id = await t.asked(w, "取る");
    const { r, b } = await patch(id, { take: true });
    expect(r.status, JSON.stringify(b)).toBe(200);
    const d = b.data as Json;
    expect(Object.keys(d).sort()).toEqual(ROW_KEYS);
    expect(d["owner"]).toEqual({ member_id: me.id, name: "運営 高本" });
    expect((await rowOf(id))!.a).toBe(me.id);
    expect(await logs(id, "inquiry.take")).toBe(1);
    expect(
      await t.n(
        "select count(*) as n from audit_events where tenant_id = $1 and action = 'inquiry.take' and actor_role = 'ops'",
        [w.tenantId],
      ),
    ).toBeGreaterThanOrEqual(1);
    expect(
      (await t.row<{ p: Json }>(
        "select payload as p from ops_audit_events where action = 'inquiry.take' and target_id = $1",
        [id],
      ))!.p["target_label"],
    ).toBe("取る");
  });

  it("K974-API-002 取り合い：ほかの人が担当なら取ると 409・E-OPS-005（欄なし）で担当が変わらない。担当なしを 2 人が同時に取ると片方だけ 200", async () => {
    const id = await t.asked(w, "取り合い");
    await t.assign(id, other);
    const x = await patch(id, { take: true });
    expect([x.r.status, x.b["code"]]).toEqual([409, "E-OPS-005"]);
    expect(isFlat(x.b)).toBe(true);
    expect((await rowOf(id))!.a).toBe(other.id);
    const free = await t.asked(w, "同時に取る");
    const both = await Promise.all([patch(free, { take: true }, me), patch(free, { take: true }, other)]);
    expect(both.map((y) => y.r.status).sort()).toEqual([200, 409]);
    expect(await logs(free, "inquiry.take")).toBe(1);
  });

  it("K974-API-003 自分の担当をもう一度取る：200 で何も変わらず、記録も増えない", async () => {
    const id = await t.asked(w, "取り直す");
    expect((await patch(id, { take: true })).r.status).toBe(200);
    expect((await patch(id, { take: true })).r.status).toBe(200);
    expect(await logs(id, "inquiry.take")).toBe(1);
  });

  it("K974-API-004 外す：自分の担当は外せて owner null・inquiry.release が 1 行。ほかの人の担当を外すと 409・E-OPS-005 で変わらない", async () => {
    const id = await t.asked(w, "外す");
    await t.assign(id, me);
    const x = await patch(id, { release: true });
    expect(x.r.status).toBe(200);
    expect((x.b.data as Json)["owner"]).toBeNull();
    expect(await logs(id, "inquiry.release")).toBe(1);
    const o = await t.asked(w, "人の担当を外す");
    await t.assign(o, other);
    const y = await patch(o, { release: true });
    expect([y.r.status, y.b["code"]]).toEqual([409, "E-OPS-005"]);
    expect((await rowOf(o))!.a).toBe(other.id);
  });
});

describe("K-974 状態と後で", () => {
  it("K974-API-005 済みにする・開き直す：自分の担当を state done で済み（later_until は空）。state open で開き直す。顧客の側の状態も 済み → 返事を待っている に変わる", async () => {
    const id = await t.asked(w, "済み");
    await t.assign(id, me);
    await t.f.admin.query(
      "update inquiries set state = 'later', later_until = now() + interval '1 day' where id = $1",
      [id],
    );
    const d = await patch(id, { state: "done" });
    expect(d.r.status).toBe(200);
    expect([(d.b.data as Json)["state"], (d.b.data as Json)["later_until"]]).toEqual(["done", null]);
    const mine = async () => ((await t.json(await t.call(w.asker, "GET", `/inquiries/${id}`))).data as Json)["state"];
    expect(await mine()).toBe("done");
    expect((await patch(id, { state: "open" })).r.status).toBe(200);
    expect((await rowOf(id))!.s).toBe("open");
    expect(await mine()).toBe("waiting");
  });

  it("K974-API-006 後で：今より後の日時で state later と later_until。null で後でを外して open。今より前の日時は 409・E-OPS-008（欄なし）で変わらない", async () => {
    const id = await t.asked(w, "後で");
    await t.assign(id, me);
    const until = inHour();
    const x = await patch(id, { later_until: until });
    expect(x.r.status).toBe(200);
    expect((x.b.data as Json)["state"]).toBe("later");
    expect(new Date(String((x.b.data as Json)["later_until"])).getTime()).toBe(new Date(until).getTime());
    expect((await patch(id, { later_until: null })).r.status).toBe(200);
    expect((await rowOf(id))!).toMatchObject({ s: "open", l: null });
    const past = await patch(id, { later_until: new Date(Date.now() - 60_000).toISOString() });
    expect([past.r.status, past.b["code"]]).toEqual([409, "E-OPS-008"]);
    expect(isFlat(past.b)).toBe(true);
    expect((await rowOf(id))!.s).toBe("open");
  });

  it("K974-API-007 担当でない人は状態を変えられない：ほかの人の担当・担当なしを済みにすると 409・E-OPS-005。担当なしは「取る」と一緒なら済みにできる", async () => {
    const o = await t.asked(w, "人の担当を済み");
    await t.assign(o, other);
    const free = await t.asked(w, "担当なしを済み");
    for (const id of [o, free]) {
      const x = await patch(id, { state: "done" });
      expect([x.r.status, x.b["code"]], id).toEqual([409, "E-OPS-005"]);
      expect((await rowOf(id))!.s).toBe("open");
    }
    const y = await patch(free, { take: true, state: "done" });
    expect(y.r.status).toBe(200);
    expect((await rowOf(free))!).toMatchObject({ a: me.id, s: "done" });
  });
});

describe("K-974 断る・失敗", () => {
  it("K974-API-008 無い・消した問い合わせは 404（欄なし）で何も書かない", async () => {
    const gone = await t.asked(w, "消した");
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    for (const id of [gone, randomUUID()]) {
      const x = await patch(id, { take: true });
      expect(x.r.status, id).toBe(404);
      expect(isFlat(x.b)).toBe(true);
    }
    expect((await rowOf(gone))!.a).toBeNull();
  });

  it("K974-API-009 入口：ログインなし 401・会社の人 403・問い合わせ（inquiry）を持たない運営の人 403。担当が変わらない", async () => {
    const id = await t.asked(w, "入口");
    expect((await t.call(null, "PATCH", `/ops/inquiries/${id}`, { take: true })).status).toBe(401);
    expect((await patch(id, { take: true }, w.admin)).r.status).toBe(403);
    expect((await patch(id, { take: true }, noInquiry)).r.status).toBe(403);
    expect((await rowOf(id))!.a).toBeNull();
  });

  it("K974-API-010 形の誤り（契約の決まり）：空の体・取ると外すを両方・state waiting／later・済みと後でを一緒・知らない欄（担当の人の id）・:id が uuid でないは 422 で変わらない", async () => {
    const id = await t.asked(w, "形");
    await t.assign(id, me);
    const bad: unknown[] = [
      {},
      { take: true, release: true },
      { state: "waiting" },
      { state: "later" },
      { state: "done", later_until: inHour() },
      { assignee_ops_member_id: other.id },
    ];
    for (const body of bad) expect((await patch(id, body)).r.status, JSON.stringify(body)).toBe(422);
    expect((await patch("abc", { take: true })).r.status).toBe(422);
    expect((await rowOf(id))!).toMatchObject({ a: me.id, s: "open" });
  });

  it("K974-API-011 顧客にお知らせを出さない：取る・済みにするで、その会社の notifications の行が増えない", async () => {
    const id = await t.asked(w, "お知らせなし");
    const n0 = await t.n("select count(*) as n from notifications where tenant_id = $1", [w.tenantId]);
    expect((await patch(id, { take: true, state: "done" })).r.status).toBe(200);
    expect(await t.n("select count(*) as n from notifications where tenant_id = $1", [w.tenantId])).toBe(n0);
  });

  it("K974-API-012 書けない（DB が落ちる）：記録が書けないと 503・E-PAGE-003 で担当も状態も戻る", async () => {
    const id = await t.asked(w, "落ちる");
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const x = await patch(id, { take: true, state: "done" });
      expect([x.r.status, x.b["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await restore();
    }
    expect((await rowOf(id))!).toMatchObject({ a: null, s: "open" });
  });

  it("K974-API-013 上限：updateOpsInquiry を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 では変えない", async () => {
    const a = await t.asked(w, "上限 1");
    const id = await t.asked(w, "上限 2");
    t.f.limits["updateOpsInquiry"] = 1;
    try {
      expect((await patch(a, { take: true })).r.status).toBe(200);
      const x = await patch(id, { take: true });
      expect(x.r.status).toBe(429);
      const s = x.b["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect((await rowOf(id))!.a).toBeNull();
    } finally {
      delete t.f.limits["updateOpsInquiry"];
    }
  });

  it("K974-DB-001 2 層目：会社の人の文脈で app.ops_inquiry_update を直に呼ぶと 42501。security definer で PUBLIC は呼べない", async () => {
    const id = await t.asked(w, "2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.asker.id],
      );
      await expect(
        c.query("select app.ops_inquiry_update($1, true, false, null, false, null)", [id]),
      ).rejects.toMatchObject({ code: "42501" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    const p = await t.row<{ d: boolean; pub: boolean }>(
      `select p.prosecdef as d, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ops_inquiry_update'`,
    );
    expect([p!.d, p!.pub]).toEqual([true, false]);
  });
});
