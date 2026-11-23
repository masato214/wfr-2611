// K-761「PC の側：ブラウザの様子と仕事に付いたファイル（reportBrowserState・getFileForBridge）」の単体の試験（口・本物の DB・本物の PC の印・手元の置き場）。
//   名前の頭の行 ID（K761-API-…）は 11_tickets/K-761.md の行の表と 1 対 1。土台は F5/talk-pc.kit.ts（この葉が持ち込む）。
// 口：POST /api/v1/bridge/jobs/:id/browser ← { browser: "chrome"|"dedicated", state: "using"|"off" } → 201 { data: { ok: true } }
//     GET  /api/v1/bridge/files/:ref?job_id=<仕事の id> → 200 { data: { url, name, mime, size } }（:ref は資料の id・期限つきの署名 URL）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createRepository } from "@kaname/db/repository";
import { setupPcKit } from "./talk-pc.kit.js";

const k = setupPcKit();
const BASE = "http://localhost:3001";
const SECRET = "k761-test-files";
let objects: ObjectStore;

const ready = async () => {
  if (!objects) {
    const repo = await createRepository(k.f.pool);
    objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k761-obj-"))), { signingSecret: SECRET });
  }
  await k.load("bridge-job-extra", {
    ops: ["reportBrowserState", "getFileForBridge"],
    deps: { objects, config: { baseUrl: BASE } },
  });
};
const report = async (pc: { token: string } | null, job: string, body: unknown) => {
  await ready();
  return k.call(pc, "POST", `/bridge/jobs/${job}/browser`, body);
};
const events = (job: string) =>
  k.f.admin
    .query<{ payload: Record<string, unknown> }>(
      "select payload from bridge_job_events where job_id = $1 and kind = 'browser' order by created_at, id",
      [job],
    )
    .then((r) => r.rows.map((x) => x.payload));
const getFile = async (pc: { token: string } | null, ref: string, job: string | null) => {
  await ready();
  return k.call(pc, "GET", `/bridge/files/${ref}${job === null ? "" : `?job_id=${job}`}`);
};

/** 自分の PC・動いている仕事 */
async function setup(label: string, o: { attachmentIds?: string[] } = {}) {
  const w = await k.world(label);
  const pc = await k.pc(w.me);
  const conversation = await k.conversation(w.me);
  const job = await k.job(w, w.me, {
    conversation,
    takenBy: pc,
    ...(o.attachmentIds ? { attachmentIds: o.attachmentIds } : {}),
  });
  return { w, pc, conversation, job };
}
/** 置き場にファイルを置いて資料の行を作る（添付を作る口は無いので DB に直に） */
async function attachment(w: { tenantId: string; me: { id: string } }, name: string, text: string, deleted = false) {
  await ready();
  const bytes = new TextEncoder().encode(text);
  const put = await objects.put({ tenantId: w.tenantId, userId: w.me.id, role: "member" }, bytes, {
    contentType: "text/csv",
  });
  if (put.status !== "done") throw new Error("置き場に置けない");
  const id = (
    await k.f.admin.query<{ id: string }>("select app.agent_attachment_new($1, $2, $3, 'text/csv', $4) as id", [
      w.me.id,
      put.value.ref,
      name,
      bytes.byteLength,
    ])
  ).rows[0]!.id;
  if (deleted) await k.f.admin.query("update attachments set deleted_at = now() where id = $1", [id]);
  return { id, ref: put.value.ref, size: bytes.byteLength };
}

describe("K-761 ブラウザの様子を送る（reportBrowserState）", () => {
  it("K761-API-001 動いている仕事 × 様子を送る × その仕事を受け取った PC：201 { ok: true }・仕事の出来事に 1 行（kind browser・使うブラウザと様子だけ）。会話には出ない（画面の 1 行は別の知らせが持つ）", async () => {
    const s = await setup("様子");
    const msgs = await k.count("select count(*) as n from messages where conversation_id = $1", [s.conversation]);
    const r = await report(s.pc, s.job, { browser: "chrome", state: "using" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect((await k.json(r)).data).toEqual({ ok: true });
    const off = await report(s.pc, s.job, { browser: "chrome", state: "off" });
    expect(off.status).toBe(201);
    expect(await events(s.job)).toEqual([
      { browser: "chrome", state: "using" },
      { browser: "chrome", state: "off" },
    ]);
    expect(await k.count("select count(*) as n from messages where conversation_id = $1", [s.conversation])).toBe(msgs);
  });

  it("K761-API-002 同じ様子を 2 回送る（二重送信）：2 回目も 201 で、出来事は 1 行のまま。使うブラウザが違えば別の 1 行", async () => {
    const s = await setup("二重");
    for (let i = 0; i < 2; i++)
      expect((await report(s.pc, s.job, { browser: "dedicated", state: "off" })).status).toBe(201);
    expect(await events(s.job)).toEqual([{ browser: "dedicated", state: "off" }]);
    expect((await report(s.pc, s.job, { browser: "chrome", state: "off" })).status).toBe(201);
    expect(await events(s.job)).toHaveLength(2);
  });

  it("K761-API-003 入力の形の誤り：browser が chrome・dedicated 以外（off も）・state が using・off 以外・どちらかが無い・文字でない・知らない項目：どれも 422（欄名つき）で何も残らない", async () => {
    const s = await setup("形");
    const bad: [unknown, string][] = [
      [{ browser: "off", state: "using" }, "browser"],
      [{ browser: "firefox", state: "using" }, "browser"],
      [{ state: "using" }, "browser"],
      [{ browser: "chrome", state: "lost" }, "state"],
      [{ browser: "chrome" }, "state"],
      [{ browser: 1, state: "using" }, "browser"],
      [{ browser: "chrome", state: "using", extra: 1 }, ""],
    ];
    for (const [b, field] of bad) {
      const r = await report(s.pc, s.job, b);
      expect(r.status, JSON.stringify(b)).toBe(422);
      if (field) expect(JSON.stringify((await k.json(r))["details"]), JSON.stringify(b)).toContain(field);
    }
    expect(await events(s.job)).toEqual([]);
  });

  it("K761-API-004 守り：ほかの PC（同じ人の別の PC）・ほかの人の PC・無い仕事の id・終わった仕事・待っている仕事：どれも 404（NOT_FOUND）で何も残らない", async () => {
    const s = await setup("他の PC");
    const second = await k.pc(s.w.me);
    const others = await k.pc(s.w.other);
    const done = await k.job(s.w, s.w.me, { conversation: s.conversation, takenBy: s.pc, state: "done" });
    const queued = await k.job(s.w, s.w.me, { conversation: s.conversation, state: "queued" });
    for (const [label, pc, job] of [
      ["別の PC", second, s.job],
      ["他の人の PC", others, s.job],
      ["無い id", s.pc, randomUUID()],
      ["終わった", s.pc, done],
      ["待っている", s.pc, queued],
    ] as const) {
      const r = await report(pc, job, { browser: "chrome", state: "using" });
      expect(r.status, label).toBe(404);
      const b = await k.json(r);
      expect(b.code, label).toBe("NOT_FOUND");
      expect(Object.keys(b).sort(), label).toEqual(["code", "error"]);
      expect(b["field"], label).toBeUndefined();
    }
    expect(
      await k.count("select count(*) as n from bridge_job_events where kind = 'browser' and tenant_id = $1", [
        s.w.tenantId,
      ]),
    ).toBe(0);
  });

  it("K761-API-005 S1 の失敗：守り：PC の印なし・外した PC は 401。1 分に 61 回目は 429。DB の関数が使えなければ 503・E-PAGE-003（出来事は残らない）。関数は security definer・public から外し kaname_app だけ", async () => {
    const s = await setup("守り");
    expect((await report(null, s.job, { browser: "chrome", state: "using" })).status).toBe(401);
    const gone = await k.pc(s.w.me, { revoked: true });
    expect((await report(gone, s.job, { browser: "chrome", state: "using" })).status).toBe(401);
    const acl = await k.row<{ definer: boolean; pub: boolean; app: boolean }>(
      `select p.prosecdef as definer, has_function_privilege('public', p.oid, 'execute') as pub, has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'bridge_browser_report'`,
    );
    expect(acl).toEqual({ definer: true, pub: false, app: true });
    await k.f.admin.query(
      "alter function app.bridge_browser_report(uuid, uuid, text, text) rename to bridge_browser_report_x",
    );
    try {
      const r = await report(s.pc, s.job, { browser: "chrome", state: "using" });
      expect(r.status).toBe(503);
      expect((await k.json(r)).code).toBe("E-PAGE-003");
      expect(await events(s.job)).toEqual([]);
    } finally {
      await k.f.admin.query(
        "alter function app.bridge_browser_report_x(uuid, uuid, text, text) rename to bridge_browser_report",
      );
    }
    k.f.limits["reportBrowserState"] = 60;
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await report(s.pc, s.job, { browser: "chrome", state: "using" })).status;
    expect(last).toBe(429);
    k.f.limits["reportBrowserState"] = 100_000;
  });
});

describe("K-761 仕事に付いたファイルを受け取る（getFileForBridge）", () => {
  it("K761-API-006 仕事に付いた資料 × 受け取る × その仕事を受け取った PC：200 { url, name, mime, size }。url は会社の置き場の期限つき署名 URL（署名と期限が付き、署名は正しい）。置き場の鍵は答えに出ない。Cache-Control に private と no-store", async () => {
    const w0 = await k.world("資料");
    const a = await attachment(w0, "台帳 ＃1（9月）.csv", "日付,金額\n9/1,1000\n");
    const pc = await k.pc(w0.me);
    const job = await k.job(w0, w0.me, {
      conversation: await k.conversation(w0.me),
      takenBy: pc,
      attachmentIds: [a.id],
    });
    const r = await getFile(pc, a.id, job);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const d = (await k.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["mime", "name", "size", "url"]);
    expect(d).toMatchObject({ name: "台帳 ＃1（9月）.csv", mime: "text/csv", size: a.size });
    expect(JSON.stringify(d)).not.toContain("storage_ref");
    const u = new URL(String(d["url"]));
    expect(u.origin).toBe(BASE);
    expect(u.pathname.startsWith("/api/auth-ext/files/")).toBe(true);
    const ref = decodeURIComponent(u.pathname.slice("/api/auth-ext/files/".length));
    expect(ref).toBe(a.ref);
    expect(objects.verifySigned(ref, Number(u.searchParams.get("exp")), String(u.searchParams.get("sig")))).toBe(true);
    expect(objects.verifySigned(ref, Number(u.searchParams.get("exp")), "00")).toBe(false);
    expect(
      await k.count("select count(*) as n from audit_events where action = 'object.sign' and target_id = $1", [a.ref]),
    ).toBe(1);
  });

  it("K761-API-007 付いていない資料・ほかの仕事に付いた資料・消した資料・動いていない仕事・無い id：どれも 404（NOT_FOUND）で署名 URL を出さない", async () => {
    const w0 = await k.world("付いてない");
    const a = await attachment(w0, "付けた.csv", "a");
    const b = await attachment(w0, "付けない.csv", "b");
    const gone = await attachment(w0, "消した.csv", "c", true);
    const pc = await k.pc(w0.me);
    const conversation = await k.conversation(w0.me);
    const job = await k.job(w0, w0.me, { conversation, takenBy: pc, attachmentIds: [a.id, gone.id] });
    const other = await k.job(w0, w0.me, { conversation, takenBy: pc, attachmentIds: [b.id] });
    const finished = await k.job(w0, w0.me, { conversation, takenBy: pc, state: "done", attachmentIds: [a.id] });
    const before = await k.count("select count(*) as n from audit_events where action = 'object.sign'");
    for (const [label, ref, j] of [
      ["付いていない", b.id, job],
      ["ほかの仕事の資料", a.id, other],
      ["消した", gone.id, job],
      ["終わった仕事", a.id, finished],
      ["無い資料", randomUUID(), job],
      ["無い仕事", a.id, randomUUID()],
    ] as const) {
      const r = await getFile(pc, ref, j);
      expect(r.status, label).toBe(404);
      const body = await k.json(r);
      expect(body.code, label).toBe("NOT_FOUND");
      expect(body["field"], label).toBeUndefined();
    }
    expect(await k.count("select count(*) as n from audit_events where action = 'object.sign'")).toBe(before);
  });

  it("K761-API-008 守り：ほかの PC（同じ人の別の PC）・ほかの人の PC・ほかの会社の人の PC は 404。PC の印なし・外した PC は 401", async () => {
    const w0 = await k.world("ほかの PC");
    const a = await attachment(w0, "台帳.csv", "a");
    const pc = await k.pc(w0.me);
    const job = await k.job(w0, w0.me, {
      conversation: await k.conversation(w0.me),
      takenBy: pc,
      attachmentIds: [a.id],
    });
    for (const [label, who] of [
      ["別の PC", await k.pc(w0.me)],
      ["他の人", await k.pc(w0.other)],
      ["別の会社", await k.pc(w0.outsider)],
    ] as const) {
      const r = await getFile(who, a.id, job);
      expect(r.status, label).toBe(404);
      expect(JSON.stringify(await k.json(r)), label).not.toContain("url");
    }
    expect((await getFile(null, a.id, job)).status).toBe(401);
    expect((await getFile(await k.pc(w0.me, { revoked: true }), a.id, job)).status).toBe(401);
  });

  it("K761-API-009 入力の形の誤り：ref が uuid でない・job_id が無い・uuid でない：422（欄 ref か job_id）。名前は日本語・長い名前・同じ名前でも、そのまま返る", async () => {
    const w0 = await k.world("形");
    const pc = await k.pc(w0.me);
    const job = await k.job(w0, w0.me, { conversation: await k.conversation(w0.me), takenBy: pc });
    const r1 = await getFile(pc, "not-a-uuid", job);
    expect(r1.status).toBe(422);
    expect(JSON.stringify((await k.json(r1))["details"])).toContain("ref");
    const r2 = await getFile(pc, randomUUID(), null);
    expect(r2.status).toBe(422);
    expect(JSON.stringify((await k.json(r2))["details"])).toContain("job_id");
    expect((await getFile(pc, randomUUID(), "xyz")).status).toBe(422);
    const long = `${"長い名前".repeat(40)}.csv`;
    const a1 = await attachment(w0, long, "x");
    const a2 = await attachment(w0, long, "y");
    const j2 = await k.job(w0, w0.me, {
      conversation: await k.conversation(w0.me),
      takenBy: pc,
      attachmentIds: [a1.id, a2.id],
    });
    for (const a of [a1, a2])
      expect(((await k.json(await getFile(pc, a.id, j2))).data as { name: string }).name).toBe(long);
  });

  it("K761-API-010 S2 の失敗：失敗：置き場が署名 URL を出せない（denied・failed）：502・E-TALK-040（署名の鍵・置き場の鍵は答えにもログにも出さない）。DB の関数が使えなければ 503・E-PAGE-003。1 分に 121 回目は 429", async () => {
    const w0 = await k.world("失敗");
    const a = await attachment(w0, "台帳.csv", "a");
    const pc = await k.pc(w0.me);
    const job = await k.job(w0, w0.me, {
      conversation: await k.conversation(w0.me),
      takenBy: pc,
      attachmentIds: [a.id],
    });
    // 別の会社の置き場の ref を持つ資料の行（置き場の名前空間の外は署名できない）
    const foreign = await attachment({ tenantId: w0.tenantId, me: w0.me }, "外.csv", "z");
    await k.f.admin.query(
      "update attachments set storage_ref = 'tenants/' || $2 || '/' || gen_random_uuid() where id = $1",
      [foreign.id, randomUUID()],
    );
    const j2 = await k.job(w0, w0.me, {
      conversation: await k.conversation(w0.me),
      takenBy: pc,
      attachmentIds: [foreign.id],
    });
    const logs = await k.captureLogs(async () => {
      const r = await getFile(pc, foreign.id, j2);
      expect(r.status).toBe(502);
      expect((await k.json(r)).code).toBe("E-TALK-040");
      expect(JSON.stringify(await k.json(r))).not.toContain(SECRET);
    });
    expect(logs).not.toContain(SECRET);
    await k.f.admin.query("alter function app.bridge_job_file(uuid, uuid, uuid) rename to bridge_job_file_x");
    try {
      const r = await getFile(pc, a.id, job);
      expect(r.status).toBe(503);
      expect((await k.json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("alter function app.bridge_job_file_x(uuid, uuid, uuid) rename to bridge_job_file");
    }
    k.f.limits["getFileForBridge"] = 120;
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await getFile(pc, a.id, job)).status;
    expect(last).toBe(429);
    k.f.limits["getFileForBridge"] = 100_000;
  });
});
