// K-973 運営の受信箱を読む（listOpsInquiries・GET /api/v1/ops/inquiries／getOpsInquiry・GET /api/v1/ops/inquiries/:id）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-948（1 行 10 欄・1 件 13 欄・やり取りは customer／reply／note）。箱の決めは K-963 の受信箱の数と同じ
//   （unassigned＝担当なし・済みでない／mine＝担当が自分・済みでない／waiting／later／done）。全社をまたぐ（D-125.129）。
//   顧客の側の問い合わせは口（createInquiry・K-949）で作り、運営の返事・社内メモ・状態・担当は DB に直に置く（K-974・K-975 の口を通さない）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsInbox, DETAIL_KEYS, OPS_MESSAGE, ROW_KEYS, type OpsInbox } from "./ops-inbox.harness.js";
import { isFlat, type Json, type World } from "./inquiry.harness.js";
import type { Person } from "../fixture.js";

let t: OpsInbox;
let me: Person;
let other: Person;
let noInquiry: Person;
let w: World;

beforeAll(async () => {
  t = await startOpsInbox("k973", ["ops-inbox-read"]);
  me = await t.ops("高本");
  other = await t.ops("佐野");
  noInquiry = await t.ops("お金だけ", ["money"]);
  w = await t.world("ミナト企画");
});
afterAll(async () => {
  await t.close();
});

const list = async (q = "", who: Person = me) => {
  const r = await t.call(who, "GET", `/ops/inquiries${q}`);
  return { r, b: await t.json(r) };
};
const rows = async (q = "", who: Person = me) => (await list(q, who)).b.data as Json[];
const ids = async (q = "", who: Person = me) => (await rows(q, who)).map((x) => x["id"]);
const one = async (id: string, who: Person = me) => {
  const r = await t.call(who, "GET", `/ops/inquiries/${id}`);
  return { r, b: await t.json(r) };
};

describe("K-973 受信箱の一覧", () => {
  it("K973-API-001 既定の箱（担当なし）：届いたばかりの問い合わせが 1 行。鍵はちょうど 10・workspace は id と名前・asker は名前だけ・owner null・state open・topic trouble", async () => {
    const id = await t.asked(w, "承認したのに動かない");
    const { r, b } = await list();
    expect(r.status, JSON.stringify(b)).toBe(200);
    const row = (b.data as Json[]).find((x) => x["id"] === id)!;
    expect(Object.keys(row).sort()).toEqual(ROW_KEYS);
    expect([row["title"], row["topic"], row["state"], row["owner"], row["later_until"]]).toEqual([
      "承認したのに動かない",
      "trouble",
      "open",
      null,
      null,
    ]);
    expect(row["workspace"]).toEqual({ id: w.tenantId, name: expect.stringContaining("ミナト企画") });
    expect(row["asker"]).toEqual({ name: "田中" });
  });

  it("K973-API-002 箱：担当なし・自分・返事待ち・後で・済みが、それぞれ決めた問い合わせだけ（済みは担当なしにも自分にも出ない・ほかの人の担当は自分に出ない）", async () => {
    const free = await t.asked(w, "箱 担当なし");
    const mine = await t.asked(w, "箱 自分");
    await t.assign(mine, me);
    const others = await t.asked(w, "箱 ほかの人");
    await t.assign(others, other);
    const waiting = await t.asked(w, "箱 返事待ち");
    await t.setState(waiting, "waiting");
    await t.assign(waiting, me);
    const later = await t.asked(w, "箱 後で");
    await t.setState(later, "later");
    const done = await t.asked(w, "箱 済み");
    await t.setState(done, "done");
    await t.assign(done, me);
    const un = await ids();
    expect(un).toContain(free);
    expect(un).toContain(later);
    expect(un).not.toContain(mine);
    expect(un).not.toContain(done);
    const my = await ids("?box=mine");
    expect(my).toEqual(expect.arrayContaining([mine, waiting]));
    expect(my).not.toContain(others);
    expect(my).not.toContain(done);
    expect(await ids("?box=waiting")).toContain(waiting);
    expect(await ids("?box=waiting")).not.toContain(mine);
    expect(await ids("?box=later")).toEqual(expect.arrayContaining([later]));
    expect(await ids("?box=later")).not.toContain(free);
    const d = await ids("?box=done");
    expect(d).toContain(done);
    expect(d).not.toContain(free);
  });

  it("K973-API-003 種類で絞る：topic=billing はお金・プランの問い合わせだけ。並びは最後のやり取りの新しい順", async () => {
    const a = await t.asked(w, "種類 お金 1", "billing");
    const c = await t.asked(w, "種類 使い方", "usage");
    const b2 = await t.asked(w, "種類 お金 2", "billing");
    const got = await rows("?topic=billing");
    const mineIds = got.map((x) => x["id"]);
    expect(mineIds).toEqual(expect.arrayContaining([a, b2]));
    expect(mineIds).not.toContain(c);
    expect(got.every((x) => x["topic"] === "billing")).toBe(true);
    expect(mineIds.indexOf(b2)).toBeLessThan(mineIds.indexOf(a));
  });

  it("K973-API-004 全社をまたぐ：別の会社の問い合わせも同じ箱に出る。消した問い合わせ・消した会社の問い合わせは出ない", async () => {
    const w2 = await t.world("ハル工房");
    const there = await t.asked(w2, "別の会社から");
    const gone = await t.asked(w, "消した");
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    const w3 = await t.world("消した会社");
    const deadWs = await t.asked(w3, "消した会社から");
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [w3.tenantId]);
    try {
      const un = await ids();
      expect(un).toContain(there);
      expect(un).not.toContain(gone);
      expect(un).not.toContain(deadWs);
    } finally {
      await t.f.admin.query("update tenants set deleted_at = null where id = $1", [w3.tenantId]);
    }
  });
});

describe("K-973 1 件", () => {
  it("K973-API-005 1 件：200・鍵はちょうど 13。やり取りは古い順に customer（顧客の内容）・reply（運営の返事）・note（社内メモ）で、どれも 6 欄・名前つき。画面の情報（context）はそのまま", async () => {
    const r0 = await t.call(w.asker, "POST", "/inquiries", {
      topic: "trouble",
      title: "1 件を開く",
      body: "最初の内容です",
      context: { path: "/tickets/EG-12", at: "2026-11-02T09:40:00+09:00", browser: "Chrome 142", pc: true },
    });
    expect(r0.status).toBe(201);
    const id = String(((await t.json(r0)).data as Json)["id"]);
    await t.opsReply(id, "確かめます", { afterSec: 1, name: "運営 高本" });
    await t.opsReply(id, "PC のログを見る", { note: true, afterSec: 2, name: "運営 高本" });
    const { r, b } = await one(id);
    expect(r.status, JSON.stringify(b)).toBe(200);
    const d = b.data as Json;
    expect(Object.keys(d).sort()).toEqual(DETAIL_KEYS);
    const msgs = d["messages"] as Json[];
    expect(msgs.map((m) => [m["kind"], m["body"], m["author_name"]])).toEqual([
      ["customer", "最初の内容です", "田中"],
      ["reply", "確かめます", "運営 高本"],
      ["note", "PC のログを見る", "運営 高本"],
    ]);
    for (const m of msgs) expect(Object.keys(m).sort()).toEqual(OPS_MESSAGE);
    expect(d["context"]).toEqual({
      path: "/tickets/EG-12",
      at: "2026-11-02T09:40:00+09:00",
      browser: "Chrome 142",
      pc: true,
    });
  });

  it("K973-API-006 右のワークスペースの様子：workspace_status はちょうど plan_name・members・pc・stuck_runs・overdue の 5 欄（数と種類だけ・チケットや会話の中身は無い）", async () => {
    const id = await t.asked(w, "様子");
    await t.f.admin.query(
      "insert into action_runs (tenant_id, scope_id, status_id, phase, started_at, finished_at, created_at) values ($1, $2, 'stopped', 'execute', now() - interval '1 day', now() - interval '1 day', now() - interval '1 day')",
      [w.tenantId, w.rootScope],
    );
    const s = ((await one(id)).b.data as Json)["workspace_status"] as Json;
    expect(Object.keys(s).sort()).toEqual(["members", "overdue", "pc", "plan_name", "stuck_runs"]);
    expect([typeof s["members"], s["pc"], s["stuck_runs"], s["overdue"]]).toEqual(["number", "never", 1, 0]);
    expect(JSON.stringify(s)).not.toContain("承認したのに動かない");
  });

  it("K973-API-007 無い・消した問い合わせは 404（欄なし）", async () => {
    const gone = await t.asked(w, "消した 1 件");
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    for (const id of [gone, randomUUID()]) {
      const x = await one(id);
      expect(x.r.status, id).toBe(404);
      expect(isFlat(x.b)).toBe(true);
    }
  });
});

describe("K-973 守りと失敗", () => {
  it("K973-API-008 入口：ログインなし 401・会社の人 403・問い合わせ（inquiry）を持たない運営の人 403（一覧・1 件とも）", async () => {
    const id = await t.asked(w, "入口");
    expect((await t.call(null, "GET", "/ops/inquiries")).status).toBe(401);
    expect((await list("", w.admin)).r.status).toBe(403);
    expect((await list("", noInquiry)).r.status).toBe(403);
    expect((await one(id, w.asker)).r.status).toBe(403);
    expect((await one(id, noInquiry)).r.status).toBe(403);
  });

  it("K973-API-009 形の誤り：知らない箱・知らない種類・limit 101・道の :id が uuid でないは 422", async () => {
    for (const q of ["?box=all", "?topic=bug", "?limit=101"]) expect((await list(q)).r.status, q).toBe(422);
    expect((await one("abc")).r.status).toBe(422);
  });

  it("K973-API-010 読むだけ：一覧と 1 件を開いても、問い合わせの状態・担当・顧客の読んだ印・運営の記録が変わらない", async () => {
    const id = await t.asked(w, "読むだけ");
    const snap = async () =>
      t.row<{ s: string; a: string | null; r: string | null; n: string }>(
        "select state as s, assignee_ops_member_id as a, asker_read_at::text as r, (select count(*) from ops_audit_events where target_tenant_id = i.tenant_id)::text as n from inquiries i where id = $1",
        [id],
      );
    const before = await snap();
    await list();
    await one(id);
    expect(await snap()).toEqual(before);
  });

  it("K973-API-011 読めない（DB が落ちる）：一覧の関数が呼べないと 503・E-PAGE-003 で data が無い（空の一覧を返さない・G-15）", async () => {
    await t.f.admin.query("revoke execute on function app.ops_inquiries(text, text, integer) from kaname_app");
    try {
      const x = await list();
      expect(x.r.status).toBe(503);
      expect(x.b["code"]).toBe("E-PAGE-003");
      expect("data" in x.b).toBe(false);
    } finally {
      await t.f.admin.query("grant execute on function app.ops_inquiries(text, text, integer) to kaname_app");
    }
  });

  it("K973-API-012 上限：listOpsInquiries を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数", async () => {
    t.f.limits["listOpsInquiries"] = 1;
    try {
      expect((await list()).r.status).toBe(200);
      const x = await list();
      expect(x.r.status).toBe(429);
      const s = x.b["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["listOpsInquiries"];
    }
  });

  it("K973-DB-001 2 層目：会社の人の文脈で app.ops_inquiries・app.ops_inquiry を直に呼ぶと 42501。どちらも security definer で PUBLIC は呼べない", async () => {
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.asker.id],
      );
      await expect(c.query("select app.ops_inquiries(null, null, 50)")).rejects.toMatchObject({ code: "42501" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    const fns = await t.f.admin.query<{ name: string; definer: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('ops_inquiries', 'ops_inquiry') order by 1`,
    );
    expect(fns.rows.map((x) => [x.name, x.definer, x.pub])).toEqual([
      ["ops_inquiries", true, false],
      ["ops_inquiry", true, false],
    ]);
  });
});
