// K-963 運営の外枠の数（getOpsShell・GET /api/v1/ops/shell）と全社の一覧（listOpsWorkspaces・GET /api/v1/ops/workspaces）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1006 の「画面が使う答えの形」。全社の一覧は数と種類だけで中身を返さない（D-156.3）。
//   気にかけるの目安と並びは代表の答え 2026-11-23（D-156.24 を D-156.72 で改めた）：止まった実行 3 件以上（直近 7 日）・請求の期限を過ぎた（1 日でも）・
//   登録から 7 日たっても PC がつながらない の 3 つ。上限に近い会社は出さない（D-156.72）。並びは 期限を過ぎた請求 → 止まった実行 → PC
//   全社の数は DB の全部の会社を数えるので「足す前と足した後の差」で見る（ops-ws.harness.ts の注）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsWs, OPS_TENANT, SHELL_KEYS, WS_ROW_KEYS, type Json, type OpsWs, type Ws } from "./ops-ws.harness.js";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Person } from "../fixture.js";

let t: OpsWs;
let opsAll: Person;
let opsInquiryOnly: Person;

beforeAll(async () => {
  t = await startOpsWs("k963", ["ops-workspaces"]);
  opsAll = await t.ops("全部");
  opsInquiryOnly = await t.ops("問い合わせだけ", ["inquiry"]);
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const shell = async (who: Person = opsAll) => {
  const r = await t.call(who, "GET", "/ops/shell");
  return { r, b: await t.json(r) };
};
const sh = async (who: Person = opsAll) => (await shell(who)).b.data as Row & Record<string, Row>;
const list = async (q: string, who: Person = opsAll) => {
  const r = await t.call(who, "GET", `/ops/workspaces?${q}`);
  return { r, b: await t.json(r) };
};
/** 自分が作った会社だけ（名前の頭 run で探す） */
const mine = async (extra = "", who: Person = opsAll) => {
  const { r, b } = await list(`q=${encodeURIComponent(t.run)}${extra ? `&${extra}` : ""}`, who);
  expect(r.status, JSON.stringify(b)).toBe(200);
  return b.data as Row[];
};
const rowOf = (rows: Row[], w: Ws) => rows.find((x) => x["id"] === w.tenantId);
const kinds = (r: Row | undefined) => ((r?.["attention"] ?? []) as Row[]).map((a) => a["kind"]);

describe("K-963 運営の外枠の数（getOpsShell）", () => {
  it("K963-API-001 答えは 6 欄。operator は自分の ops_members の member_id と caps（並びのまま）", async () => {
    const { r, b } = await shell(opsInquiryOnly);
    expect(r.status).toBe(200);
    const d = b.data as Row;
    expect(Object.keys(d).sort()).toEqual(SHELL_KEYS);
    expect(d["operator"]).toEqual({ member_id: opsInquiryOnly.id, caps: ["inquiry"] });
  });

  it("K963-API-002 受信箱の数：未担当（担当なし・済み以外）・自分（担当が自分・済み以外）・待ち（waiting）・後で（later）が、足した分だけ増える。済みは数えない", async () => {
    const before = (await sh()).inbox as Row;
    const w = await t.ws("受信箱");
    await t.inquiry(w, { state: "open" });
    await t.inquiry(w, { state: "open", assignee: opsAll });
    await t.inquiry(w, { state: "waiting", assignee: opsAll });
    await t.inquiry(w, { state: "later" });
    await t.inquiry(w, { state: "done" });
    const after = (await sh()).inbox as Record<string, number>;
    const d = (k: string) => after[k]! - Number(before[k]);
    expect([d("unassigned"), d("mine"), d("waiting"), d("later")]).toEqual([2, 2, 1, 1]);
  });

  it("K963-API-003 請求の数：お金（money）を持つ人には期限を過ぎた件数と税込の合計が増え、持たない人は invoices が null", async () => {
    const before = (await sh()).invoices as Row;
    const w = await t.ws("未入金");
    await t.invoice(w, { amount: 16500, dueDaysAgo: 1 });
    await t.invoice(w, { amount: 33000, dueDaysAgo: 3 });
    await t.invoice(w, { amount: 16500, dueDaysAgo: 0 });
    await t.invoice(w, { amount: 16500, dueDaysAgo: 5, paid: true });
    const after = (await sh()).invoices as Record<string, number>;
    expect(after["overdue_count"]! - Number(before["overdue_count"])).toBe(2);
    expect(after["overdue_amount"]! - Number(before["overdue_amount"])).toBe(49500);
    expect((await sh(opsInquiryOnly)).invoices).toBeNull();
  });

  it("K963-API-004 ワークスペースの数：顧客の会社だけ（運営の会社・作りかけ・消した会社は数えない）。止めている（止めた時刻があるか、止める日が今日以前・D-156.49）・やめる手続き中・プランごと・気にかけるが足した分だけ増える", async () => {
    const before = (await sh()).workspaces as Record<string, number> & { by_plan: Record<string, number> };
    const a = await t.ws("使う", { plan: "free" });
    const s = await t.ws("止めた", { plan: "business" });
    const c = await t.ws("やめる", { plan: "team" });
    const half = await t.ws("作りかけ", { plan: "team" });
    const gone = await t.ws("消した", { plan: "team" });
    const due = await t.ws("止める日が来た", { plan: "business" });
    const later = await t.ws("止める日はまだ", { plan: "free" });
    await t.f.admin.query("update tenants set stopped_at = now(), stop_reason_key = 'violation' where id = $1", [
      s.tenantId,
    ]);
    await t.f.admin.query(
      "update tenants set stop_on = (now() at time zone 'Asia/Tokyo')::date, stop_reason_key = 'unpaid' where id = $1",
      [due.tenantId],
    );
    await t.f.admin.query(
      "update tenants set stop_on = (now() at time zone 'Asia/Tokyo')::date + 1, stop_reason_key = 'unpaid' where id = $1",
      [later.tenantId],
    );
    await t.f.admin.query("update tenants set deletion_requested_at = now() where id = $1", [c.tenantId]);
    await t.f.admin.query("update tenants set half_made_at = now() where id = $1", [half.tenantId]);
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    await t.invoice(a, { amount: 1, dueDaysAgo: 2 });
    const after = (await sh()).workspaces as Record<string, number> & { by_plan: Record<string, number> };
    const d = (k: string) => after[k]! - before[k]!;
    expect([d("total"), d("active"), d("stopped"), d("closing"), d("attention")]).toEqual([5, 2, 2, 1, 1]);
    expect([
      after.by_plan["free"]! - before.by_plan["free"]!,
      after.by_plan["team"]! - before.by_plan["team"]!,
      after.by_plan["business"]! - before.by_plan["business"]!,
    ]).toEqual([2, 1, 2]);
    const all = await mine();
    expect(rowOf(all, half)).toBeUndefined();
    expect(rowOf(all, gone)).toBeUndefined();
    expect(all.some((x) => x["id"] === OPS_TENANT)).toBe(false);
  });

  it("K963-API-005 今月の実行：今月（日本時間）の実行の数が足した分だけ増え、prev_ratio は 今月 ÷ 先月（先月が 0 なら null）", async () => {
    const before = (await sh()).runs_month as Record<string, number | null>;
    const w = await t.ws("実行");
    await t.run_(w, { status: "done" });
    await t.run_(w, { status: "stopped" });
    await t.run_(w, { status: "done", daysAgo: 400 });
    const after = (await sh()).runs_month as Record<string, number | null>;
    expect(Number(after["count"]) - Number(before["count"])).toBe(2);
    const ratio = after["prev_ratio"];
    expect(ratio === null || (typeof ratio === "number" && ratio >= 0)).toBe(true);
  });

  it("K963-API-006 照合が使えなかった登録の数：確かめた印より後の出来事がある会社の数（D-156.35）。確かめた後は数えず、また落ちたら数える", async () => {
    const before = Number(((await sh()).pwned as Row)["unchecked"]);
    const w = await t.ws("照合");
    await t.pwned(w);
    await t.pwned(w);
    expect(Number(((await sh()).pwned as Row)["unchecked"]) - before).toBe(1);
    await t.pwned(w, { ack: true });
    expect(Number(((await sh()).pwned as Row)["unchecked"]) - before).toBe(0);
    await t.f.admin.query(
      "insert into security_events (tenant_id, kind_id, detail, occurred_at) values ($1, 'pwned_check_unavailable', '{}'::jsonb, now() + interval '1 second')",
      [w.tenantId],
    );
    expect(Number(((await sh()).pwned as Row)["unchecked"]) - before).toBe(1);
  });
});

describe("K-963 全社の一覧（listOpsWorkspaces）", () => {
  it("K963-API-007 1 行は 11 欄で、数と種類だけ。管理者の名前・プランの名前・人数（いま / 上限）・PC がつながる人（いま / 人数）・今月の実行", async () => {
    const w = await t.ws("ミナト企画", { plan: "team", members: 3 });
    await t.pc(w, w.admin, { alive: true });
    await t.run_(w, { status: "done" });
    const r = rowOf(await mine(), w)!;
    expect(Object.keys(r).sort()).toEqual(WS_ROW_KEYS);
    expect(r["name"]).toBe(w.name);
    expect(r["admin_name"]).toBe("管理者 ミナト企画");
    expect(r["plan_name"]).toBe("チーム");
    expect(r["members"]).toEqual({ count: 3, limit: 10 });
    expect(r["pc"]).toEqual({ connected: 1, total: 3 });
    expect(r["runs_month"]).toBe(1);
    expect(JSON.stringify(r)).not.toMatch(/実行待ちのまま|tickets|conversation/);
  });

  it("K963-API-008 気にかけるの目安（D-156.24・D-156.72）：止まった実行 3 件（直近 7 日）・期限を過ぎた 1 日・登録から 8 日で PC なしで入り、2 件・期限の当日・6 日では入らない。上限の 95% を使っていても入らない", async () => {
    const stuck = await t.ws("詰まり");
    for (let i = 0; i < 3; i++) await t.run_(stuck, { status: "stopped", daysAgo: 1 });
    const stuck2 = await t.ws("詰まり2件");
    for (let i = 0; i < 2; i++) await t.run_(stuck2, { status: "stopped", daysAgo: 1 });
    await t.run_(stuck2, { status: "stopped", daysAgo: 9 });
    const over = await t.ws("未入金1日");
    await t.invoice(over, { amount: 16500, dueDaysAgo: 1 });
    const today = await t.ws("期限の当日");
    await t.invoice(today, { amount: 16500, dueDaysAgo: 0 });
    const noPc = await t.ws("PCなし8日", { createdDaysAgo: 8 });
    const noPc6 = await t.ws("PCなし6日", { createdDaysAgo: 6 });
    const lim = await t.ws("上限95");
    await t.usage(lim, 95, 100);
    for (const w of [stuck2, today, noPc6]) {
      await t.pc(w, w.admin, { alive: true });
    }
    await t.pc(stuck, stuck.admin);
    await t.pc(over, over.admin);
    await t.pc(lim, lim.admin);
    const rows = await mine();
    expect(rowOf(rows, stuck)!["attention"]).toEqual([{ kind: "stuck", label_value: 3 }]);
    expect(rowOf(rows, over)!["attention"]).toEqual([{ kind: "overdue", label_value: 1 }]);
    expect(rowOf(rows, noPc)!["attention"]).toEqual([{ kind: "pc", label_value: 8 }]);
    for (const w of [stuck2, today, noPc6, lim]) expect(kinds(rowOf(rows, w))).toEqual([]);
  });

  it("K963-API-009 並びの既定（sort なし・attention）：気にかけるのある会社が上で、期限を過ぎた請求 → 止まった実行 → PC の順。1 社に 2 つあれば attention もその順。ほかは名前の順（上限の 95% の会社も、気にかけるの無い会社として名前の順）", async () => {
    const sub = `${t.run}-並び`;
    const make = (l: string, o: { createdDaysAgo?: number } = {}) => t.ws(`並び ${l}`, o);
    const z = await make("ん 何もない");
    await t.pc(z, z.admin);
    const pc = await make("い PC", { createdDaysAgo: 10 });
    const lim = await make("う 上限");
    await t.usage(lim, 95, 100);
    await t.pc(lim, lim.admin);
    const both = await make("え 両方");
    await t.invoice(both, { amount: 1, dueDaysAgo: 4 });
    for (let i = 0; i < 4; i++) await t.run_(both, { status: "stopped" });
    await t.pc(both, both.admin);
    const st = await make("お 詰まり");
    for (let i = 0; i < 3; i++) await t.run_(st, { status: "stopped" });
    await t.pc(st, st.admin);
    const { r, b } = await list(`q=${encodeURIComponent(sub)}`);
    expect(r.status).toBe(200);
    const ids = (b.data as Row[]).map((x) => x["id"]);
    expect(ids).toEqual([both.tenantId, st.tenantId, pc.tenantId, lim.tenantId, z.tenantId]);
    expect(kinds((b.data as Row[])[0])).toEqual(["overdue", "stuck"]);
  });

  it("K963-API-010 view：attention は気にかけるのある会社だけ・stopped は止めた会社だけ・closing はやめる手続き中だけ・all は全部", async () => {
    const sub = `${t.run}-見方`;
    const ok = await t.ws("見方 ふつう");
    await t.pc(ok, ok.admin);
    const care = await t.ws("見方 気にかける");
    await t.invoice(care, { amount: 1, dueDaysAgo: 2 });
    await t.pc(care, care.admin);
    const stop = await t.ws("見方 止めた");
    await t.pc(stop, stop.admin);
    await t.f.admin.query("update tenants set stopped_at = now(), stop_reason_key = 'unpaid' where id = $1", [
      stop.tenantId,
    ]);
    const bye = await t.ws("見方 やめる");
    await t.pc(bye, bye.admin);
    await t.f.admin.query("update tenants set deletion_requested_at = now() where id = $1", [bye.tenantId]);
    const ids = async (v: string) =>
      ((await list(`q=${encodeURIComponent(sub)}&view=${v}`)).b.data as Row[]).map((x) => x["id"]).sort();
    expect(await ids("attention")).toEqual([care.tenantId]);
    expect(await ids("stopped")).toEqual([stop.tenantId]);
    expect(await ids("closing")).toEqual([bye.tenantId]);
    expect(await ids("all")).toEqual([ok.tenantId, care.tenantId, stop.tenantId, bye.tenantId].sort());
  });

  it("K963-API-011 plan：free・team・business のどれかの会社だけ", async () => {
    const sub = `${t.run}-プラン`;
    const f = await t.ws("プラン 無料", { plan: "free" });
    const b = await t.ws("プラン ビジネス", { plan: "business" });
    const got = async (p: string) =>
      ((await list(`q=${encodeURIComponent(sub)}&plan=${p}`)).b.data as Row[]).map((x) => x["id"]);
    expect(await got("free")).toEqual([f.tenantId]);
    expect(await got("business")).toEqual([b.tenantId]);
    expect(await got("team")).toEqual([]);
  });

  it("K963-API-012 q：名前の一部か管理者のメールの一部で探す。全角半角・大文字小文字・前後の空白は同じ扱い。合わなければ 200 で空", async () => {
    const mail = `Boss-${randomUUID().slice(0, 6)}@Example.test`;
    const w = await t.ws("ＨＯＳＨＩＮＯ 商店");
    await t.member(w, "社長", { role: "admin", authEmail: mail });
    const byName = (await list(`q=${encodeURIComponent(` ${t.run} hoshino `)}`)).b.data as Row[];
    expect(byName.map((x) => x["id"])).toContain(w.tenantId);
    const byMail = (await list(`q=${encodeURIComponent(mail.toUpperCase())}`)).b.data as Row[];
    expect(byMail.map((x) => x["id"])).toEqual([w.tenantId]);
    const none = await list(`q=${encodeURIComponent(`${t.run}-合わない-${randomUUID()}`)}`);
    expect(none.r.status).toBe(200);
    expect(none.b.data).toEqual([]);
  });

  it("K963-API-013 sort：members は人数の多い順・runs は今月の実行の多い順（同じなら名前の順）", async () => {
    const sub = `${t.run}-順`;
    const a = await t.ws("順 あ", { members: 1 });
    const b = await t.ws("順 い", { members: 4 });
    const c = await t.ws("順 う", { members: 2 });
    for (let i = 0; i < 3; i++) await t.run_(a, { status: "done" });
    await t.run_(c, { status: "done" });
    const ids = async (s: string) =>
      ((await list(`q=${encodeURIComponent(sub)}&sort=${s}`)).b.data as Row[]).map((x) => x["id"]);
    expect(await ids("members")).toEqual([b.tenantId, c.tenantId, a.tenantId]);
    expect(await ids("runs")).toEqual([a.tenantId, c.tenantId, b.tenantId]);
  });

  it("K963-API-014 形の誤り（契約）：view・plan・sort の知らない値・101 字の q・知らない問い合わせの名前・NUL は 422。100 字の q は 200", async () => {
    for (const q of ["view=gone", "plan=gold", "sort=name", `q=${"あ".repeat(101)}`, "tenant=1", "q=%00"]) {
      const { r, b } = await list(q);
      expect(r.status, `${q} ${JSON.stringify(b)}`).toBe(422);
    }
    expect((await list(`q=${encodeURIComponent("あ".repeat(100))}`)).r.status).toBe(200);
  });

  it("K963-API-015 状態と state_since：止めた会社は stopped（止めた時刻）・やめる手続き中は closing（申し込んだ時刻）・ほかは active（作った時刻）", async () => {
    const a = await t.ws("状態 ふつう");
    const s = await t.ws("状態 止めた");
    const c = await t.ws("状態 やめる");
    await t.f.admin.query(
      "update tenants set stopped_at = '2026-11-20T03:00:00Z', stop_reason_key = 'danger' where id = $1",
      [s.tenantId],
    );
    await t.f.admin.query("update tenants set deletion_requested_at = '2026-11-21T03:00:00Z' where id = $1", [
      c.tenantId,
    ]);
    const rows = await mine();
    const created = (await t.row<{ c: Date }>("select created_at as c from tenants where id = $1", [a.tenantId]))!.c;
    expect([rowOf(rows, a)!["state"], rowOf(rows, s)!["state"], rowOf(rows, c)!["state"]]).toEqual([
      "active",
      "stopped",
      "closing",
    ]);
    expect(new Date(String(rowOf(rows, s)!["state_since"])).toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(new Date(String(rowOf(rows, c)!["state_since"])).toISOString()).toBe("2026-11-21T03:00:00.000Z");
    expect(new Date(String(rowOf(rows, a)!["state_since"])).getTime()).toBe(created.getTime());
  });

  it("K963-API-016 請求の状態：いちばん新しい請求書が 払われた＝paid・期限を過ぎた＝overdue・期限の前＝unpaid。請求書が無ければ null", async () => {
    const none = await t.ws("請求 なし");
    const paid = await t.ws("請求 払った");
    await t.invoice(paid, { amount: 1, dueDaysAgo: 3, paid: true });
    const late = await t.ws("請求 過ぎた");
    await t.invoice(late, { amount: 1, dueDaysAgo: 2 });
    const wait = await t.ws("請求 まだ");
    await t.invoice(wait, { amount: 1, dueDaysAgo: -5 });
    const rows = await mine();
    expect([none, paid, late, wait].map((w) => rowOf(rows, w)!["billing_state"])).toEqual([
      null,
      "paid",
      "overdue",
      "unpaid",
    ]);
  });
});

describe("K-963 守りと失敗", () => {
  it("K963-API-017 入口：ログインなしは 2 本とも 401・会社の人は 403・運営の会社の人でも ops_members が無ければ 403", async () => {
    const w = await t.ws("守り");
    const sc = (await t.row<{ id: string }>("select id from scopes where tenant_id = $1 limit 1", [OPS_TENANT]))!.id;
    const noRow = await t.f.person(OPS_TENANT, sc, { name: "運営 行なし", role: "ops" });
    for (const path of ["/ops/shell", "/ops/workspaces"]) {
      expect((await t.call(null, "GET", path)).status).toBe(401);
      expect((await t.call(w.admin, "GET", path)).status).toBe(403);
      expect((await t.call(noRow, "GET", path)).status).toBe(403);
    }
  });

  it("K963-API-018 関数の中の 2 層目（G-02）：app.ops_shell と app.ops_workspaces は、会社の人の文脈で直に呼ぶと 42501 で何も返さない", async () => {
    const w = await t.ws("二層目");
    const asMember: TenantContext = { tenantId: w.tenantId, userId: w.admin.id, role: "member" };
    for (const sql of ["select app.ops_shell()", "select app.ops_workspaces(null, 'all', null, 'attention', 50)"]) {
      const e = await withTenant(t.f.pool, asMember, (c) => c.query(sql)).then(
        () => null,
        (x: { code?: string }) => x,
      );
      expect(e?.code, sql).toBe("42501");
    }
  });

  it("K963-API-019 DB が落ちる（関数が無い）：2 本とも 503・E-PAGE-003 で、例外の文・関数の名前を出さない", async () => {
    await t.f.admin.query("alter function app.ops_shell() rename to ops_shell_k963_saved");
    await t.f.admin.query(
      "alter function app.ops_workspaces(text, text, text, text, integer) rename to ops_workspaces_k963_saved",
    );
    try {
      for (const path of ["/ops/shell", "/ops/workspaces"]) {
        const r = await t.call(opsAll, "GET", path);
        const b: Json = await t.json(r);
        expect(r.status, path).toBe(503);
        expect(b["code"]).toBe("E-PAGE-003");
        expect(JSON.stringify(b)).not.toMatch(/ops_shell|ops_workspaces|does not exist/);
      }
    } finally {
      await t.f.admin.query("alter function app.ops_shell_k963_saved() rename to ops_shell");
      await t.f.admin.query(
        "alter function app.ops_workspaces_k963_saved(text, text, text, text, integer) rename to ops_workspaces",
      );
    }
  });

  it("K963-API-020 上限：getOpsShell を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数", async () => {
    t.f.limits["getOpsShell"] = 1;
    try {
      const ip = "203.0.113.163";
      const get = () => t.f.req("GET", "/ops/shell", { headers: opsAll.auth, ip });
      expect((await get()).status).toBe(200);
      const r = await get();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["getOpsShell"];
    }
  });
});

describe("K-963 顧客の側と同じ決め（K-961・K-954）", () => {
  it("K963-API-021 人数とプランは顧客の側と同じ関数で決める：ゲスト（役割 requester）を足しても人数と PC の total は増えない。来月 1 日から下げる予定の契約を足しても、プランは今のチームのまま", async () => {
    const w = await t.ws("ゲストと予定", { plan: "team", members: 3 });
    const before = rowOf(await mine(), w)!;
    expect(before["members"]).toEqual({ count: 3, limit: 10 });
    await t.member(w, "先方の人", { role: "requester" });
    await t.f.admin.query(
      `insert into subscriptions (tenant_id, plan_id, status_id, started_at)
       values ($1, (select id from plans where tenant_id = $2 and key = 'free' and deleted_at is null), 'active',
               (date_trunc('month', (now() at time zone 'Asia/Tokyo')) + interval '1 month') at time zone 'Asia/Tokyo')`,
      [w.tenantId, OPS_TENANT],
    );
    const after = rowOf(await mine(), w)!;
    expect(after["members"]).toEqual({ count: 3, limit: 10 });
    expect((after["pc"] as Row)["total"]).toBe((before["pc"] as Row)["total"]);
    expect(after["plan_name"]).toBe("チーム");
  });
});
