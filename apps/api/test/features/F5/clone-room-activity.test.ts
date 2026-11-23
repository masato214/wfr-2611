// K-754「やったことと育ち具合を読む口（listCloneActivity・getCloneGrowth）」の単体の試験（口・本物の DB）。名前の頭の行 ID（K754-API-…）は 11_tickets/K-754.md の表と 1 対 1。
//   土台は K-753 の clone-room.harness.ts（carry）。実行・承認・成果物の版は DB に直に置く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { setupCloneRoom, type RunRow, type World } from "./clone-room.harness.js";

const h = setupCloneRoom();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const ROW_KEYS = ["at", "detail", "id", "kind", "result", "ticket_id", "ticket_number", "title"];
const SUMMARY_KEYS = ["fixed", "passed", "stopped", "total", "waiting"];
const GROWTH_KEYS = ["assigned", "pass_rate", "pass_rate_last_week", "work_seconds"];
const MIN = 60_000;

interface Row {
  id: string;
  at: string;
  kind: string;
  ticket_id: string;
  ticket_number: string;
  title: string;
  result: string;
  detail: Record<string, unknown>;
}
interface Page {
  data: Row[];
  meta: { limit: number; cursor?: string; summary: Record<string, number> };
}
const iso = (ms: number) => new Date(ms).toISOString();
const jstDate = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
/** 今週（日本時間の月曜 0 時）の始まり（ミリ秒） */
const weekStart = (): number => {
  const j = new Date(Date.now() + 9 * 3600_000);
  const day = (j.getUTCDay() + 6) % 7; // 月曜＝0
  return Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() - day) - 9 * 3600_000;
};

const list = async (w: World, q = "", who = w.me): Promise<Page> => {
  const r = await h.call(who, "GET", `/clones/me/activity${q}`);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await h.json(r)) as unknown as Page;
};
const growth = async (w: World, who = w.me): Promise<Record<string, unknown>> => {
  const r = await h.call(who, "GET", "/clones/me/growth");
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await h.json(r)).data ?? {}) as Record<string, unknown>;
};

/** 承認を決めた形で入れる（取り消せる操作なので本人確認の取り直しは要らない） */
async function decided(
  w: World,
  ticketId: string,
  run: RunRow | null,
  decision: "approve" | "return" | "self_edit" | "stop" | null,
  o: { atMs?: number; reason?: string; approver?: World["me"] } = {},
): Promise<string> {
  const approver = o.approver ?? w.me;
  const rows = await h.f.admin.query<{ id: string }>(
    `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks,
                            decision, decided_at, return_reason, created_by)
     values ($1, $2, 'artifact', $3, $4, $5, $6, $7, false, '[]'::jsonb, $8, $9, $10, $6) returning id`,
    [
      w.tenantId,
      w.scopeA,
      ticketId,
      run?.id ?? null,
      approver.id,
      w.me.id,
      decision ? "approved" : "pending",
      decision,
      decision ? iso(o.atMs ?? Date.now()) : null,
      decision === "return" ? (o.reason ?? "結論が先に見えない") : null,
    ],
  );
  return rows.rows[0]!.id;
}
/** 成果物（区画 artifacts）の版を入れる。edited は人が直した版（edited_by_clone が偽） */
async function version(
  w: World,
  ticketId: string,
  v: number,
  atMs: number,
  by: "ai" | "human",
  human = w.me,
): Promise<void> {
  const s = await h.f.admin.query<{ id: string }>(
    `insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'artifacts', 70, '{"text":"成果物"}', $3)
     on conflict (ticket_id, section_key) do update set version = excluded.version returning id`,
    [w.tenantId, ticketId, v],
  );
  await h.f.admin.query(
    `insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_at, edited_by_clone, created_at)
     values ($1, $2, $3, $4, '{"text":"成果物"}', $5, $6, $7, $6)`,
    [w.tenantId, ticketId, s.rows[0]!.id, v, by === "human" ? human.id : null, iso(atMs), by === "ai"],
  );
}
/** 作る段が終わった実行（done）を、承認と成果物の版つきで入れる。min は終わった時刻（いまから n 分前） */
async function made(w: World, o: { title?: string; min?: number } = {}) {
  const t = await h.ticket(w, { title: o.title ?? "請求書を作る" });
  const finished = Date.now() - (o.min ?? 30) * MIN;
  const run = await h.run(w, t.id, {
    phase: "make",
    status: "done",
    createdMinAgo: (o.min ?? 30) + 2,
    finishedAt: iso(finished),
  });
  await version(w, t.id, 1, finished, "ai");
  return { t, run, finished };
}

describe("K-754 やったことと育ち具合を読む", () => {
  it("K754-API-001 やったことの 1 行は鍵ちょうど 8（id・at・kind・ticket_id・ticket_number・title・result・detail）。新しい順（終わった時刻・同じなら id の降順）。meta は limit と summary", async () => {
    const w = await h.world("k754-001");
    const a = await made(w, { title: "古い物", min: 50 });
    const b = await made(w, { title: "新しい物", min: 10 });
    const v = await list(w);
    expect(v.data.map((r) => r.title)).toEqual(["新しい物", "古い物"]);
    expect(Object.keys(v.data[0]!).sort()).toEqual(ROW_KEYS);
    expect(v.data[0]).toMatchObject({ id: b.run.id, kind: "made", ticket_id: b.t.id, ticket_number: b.t.number });
    expect(v.data[1]!.id).toBe(a.run.id);
    expect(Number.isNaN(Date.parse(v.data[0]!.at))).toBe(false);
    expect(Object.keys(v.meta).sort()).toEqual(["limit", "summary"]);
    expect(v.meta.limit).toBe(50);
    expect(Object.keys(v.meta.summary).sort()).toEqual(SUMMARY_KEYS);
  });

  it("K754-API-002 作った（承認待ち）：result は awaiting・detail.checks は今の確認項目の数（AI がチェックを付けた数と全部の数）", async () => {
    const w = await h.world("k754-002");
    const { t, run } = await made(w);
    await decided(w, t.id, run, null);
    await h.spec(t.id, { checked: "ai" });
    await h.spec(t.id, { checked: "ai" });
    await h.spec(t.id, { checked: "member" });
    await h.spec(t.id);
    await h.spec(t.id, { deleted: true, checked: "ai" });
    const r = (await list(w)).data[0]!;
    expect(r).toMatchObject({ kind: "made", result: "awaiting" });
    expect(r.detail).toEqual({ checks: { ai: 2, total: 4 } });
  });

  it("K754-API-003 作った（承認されて、人が直さなかった）：result は passed", async () => {
    const w = await h.world("k754-003");
    const { t, run } = await made(w);
    await decided(w, t.id, run, "approve", { atMs: Date.now() - 5 * MIN });
    const r = (await list(w)).data[0]!;
    expect(r).toMatchObject({ kind: "made", result: "passed" });
    expect(Object.keys(r.detail).sort()).toEqual(["checks"]);
  });

  it("K754-API-004 作った（承認までに人が直した・自分で直すを選んだ）：result は fixed・detail.edited は { by（直した人の名前）, version }。AI が作った版は直したに数えない", async () => {
    const w = await h.world("k754-004");
    const { t, run, finished } = await made(w);
    await version(w, t.id, 2, finished + 2 * MIN, "ai");
    await version(w, t.id, 3, finished + 4 * MIN, "human");
    await decided(w, t.id, run, "approve", { atMs: finished + 6 * MIN });
    const r = (await list(w)).data[0]!;
    expect(r).toMatchObject({ result: "fixed" });
    expect(r.detail["edited"]).toEqual({ by: "高本 聖斗", version: 3 });
    const m2 = await made(w, { min: 5 });
    await decided(w, m2.t.id, m2.run, "self_edit", { atMs: Date.now() - 2 * MIN });
    expect((await list(w)).data.find((x) => x.ticket_id === m2.t.id)!.result).toBe("fixed");
  });

  it("K754-API-005 作った（差し戻された・止められた）：差し戻しは result returned・detail.returned は { by, reason }。止める決め（stop）は result stopped", async () => {
    const w = await h.world("k754-005");
    const a = await made(w, { min: 40 });
    await decided(w, a.t.id, a.run, "return", { reason: "結論が先に見えない", approver: w.other });
    const b = await made(w, { min: 20 });
    await decided(w, b.t.id, b.run, "stop");
    const rows = (await list(w)).data;
    const ra = rows.find((x) => x.ticket_id === a.t.id)!;
    expect(ra.result).toBe("returned");
    expect(ra.detail["returned"]).toEqual({ by: "佐藤 花子", reason: "結論が先に見えない" });
    expect(rows.find((x) => x.ticket_id === b.t.id)!.result).toBe("stopped");
  });

  it("K754-API-006 実行した（承認の後の実行が終わった）：kind は ran・result は done・detail.approved は { by（承認した人）, at（承認した時刻）}", async () => {
    const w = await h.world("k754-006");
    const { t, run } = await made(w, { min: 60 });
    const at = Date.now() - 30 * MIN;
    const appr = await decided(w, t.id, run, "approve", { atMs: at });
    await h.run(w, t.id, { phase: "execute", status: "done", approvalId: appr, createdMinAgo: 29, finishedMinAgo: 25 });
    const r = (await list(w)).data[0]!;
    expect(r).toMatchObject({ kind: "ran", result: "done" });
    const ap = r.detail["approved"] as { by: string; at: string };
    expect(ap.by).toBe("高本 聖斗");
    expect(Math.abs(Date.parse(ap.at) - at)).toBeLessThan(2000);
  });

  it("K754-API-007 止まった：kind は stopped・result は stopped・detail.stopped_reason は実行の止まった理由（無ければ仕事の止まった理由）。作る段でも実行でも同じ", async () => {
    const w = await h.world("k754-007");
    const a = await h.ticket(w);
    await h.run(w, a.id, {
      phase: "make",
      status: "stopped",
      finishedMinAgo: 10,
      errorSummary: "領収書の日付が読めませんでした",
      stoppedReason: "別の文",
    });
    const b = await h.ticket(w);
    await h.run(w, b.id, {
      phase: "execute",
      status: "stopped",
      finishedMinAgo: 20,
      errorSummary: null,
      stoppedReason: "PC が閉じました",
    });
    const rows = (await list(w)).data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "stopped", result: "stopped", ticket_id: a.id });
    expect(rows[0]!.detail).toEqual({ stopped_reason: "領収書の日付が読めませんでした" });
    expect(rows[1]!.detail).toEqual({ stopped_reason: "PC が閉じました" });
  });

  it("K754-API-008 終わっていない実行（queued・running・asking）・取り下げでやめた（cancelled）実行・実行でない行（phase が空）は出ない", async () => {
    const w = await h.world("k754-008");
    for (const status of ["queued", "running", "asking"] as const) await h.run(w, (await h.ticket(w)).id, { status });
    await h.run(w, (await h.ticket(w)).id, { status: "cancelled", phase: "execute", finishedMinAgo: 5 });
    const t = await h.ticket(w);
    await h.f.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, status_id, finished_at, created_by) values ($1, $2, $3, 'done', now(), $4)",
      [w.tenantId, w.scopeA, t.id, w.me.id],
    );
    expect((await list(w)).data).toEqual([]);
  });

  it("K754-API-009 札（kind）：ran・made・stopped で絞れる。知らない値は 422（欄 kind）", async () => {
    const w = await h.world("k754-009");
    const m = await made(w, { min: 30 });
    const { t, run } = await made(w, { min: 20 });
    const appr = await decided(w, t.id, run, "approve");
    await h.run(w, t.id, { phase: "execute", status: "done", approvalId: appr, createdMinAgo: 9, finishedMinAgo: 8 });
    await h.run(w, (await h.ticket(w)).id, { status: "stopped", finishedMinAgo: 3 });
    const kinds = async (q: string) => (await list(w, q)).data.map((r) => r.kind);
    expect(await kinds("")).toHaveLength(4);
    expect(await kinds("?kind=ran")).toEqual(["ran"]);
    expect(await kinds("?kind=made")).toEqual(["made", "made"]);
    expect(await kinds("?kind=stopped")).toEqual(["stopped"]);
    expect(m.t.id).toBeTruthy();
    const bad = await h.call(w.me, "GET", "/clones/me/activity?kind=memory");
    expect(bad.status).toBe(422);
    expect(JSON.stringify(await h.json(bad))).toContain("kind");
  });

  it("K754-API-010 期間：何も付けないときは今日を入れた直近 7 日（日本の日付）。from・to は日本の日付で両端を入れる", async () => {
    const w = await h.world("k754-010");
    const old = await made(w, { title: "8 日前", min: 8 * 24 * 60 });
    const edge = await made(w, { title: "6 日前", min: 6 * 24 * 60 });
    const today = await made(w, { title: "今日", min: 5 });
    expect(old.t.id && edge.t.id && today.t.id).toBeTruthy();
    expect((await list(w)).data.map((r) => r.title)).toEqual(["今日", "6 日前"]);
    const day6 = jstDate(Date.now() - 6 * 24 * 3600_000);
    expect((await list(w, `?from=${day6}&to=${day6}`)).data.map((r) => r.title)).toEqual(["6 日前"]);
    const day8 = jstDate(Date.now() - 8 * 24 * 3600_000);
    expect((await list(w, `?from=${day8}&to=${day8}`)).data.map((r) => r.title)).toEqual(["8 日前"]);
  });

  it("K754-API-011 日付の境目（G-12）：日本時間の 23:59:59 は前の日・0:00:00 は次の日に入る", async () => {
    const w = await h.world("k754-011");
    const day = jstDate(Date.now() - 2 * 24 * 3600_000);
    const startUtc = Date.parse(`${day}T00:00:00+09:00`);
    for (const [title, ms] of [
      ["前の日の終わり", startUtc - 1000],
      ["その日の始まり", startUtc],
    ] as const) {
      const t = await h.ticket(w, { title });
      await h.run(w, t.id, { status: "stopped", finishedAt: iso(ms), createdMinAgo: 3000 });
    }
    expect((await list(w, `?from=${day}&to=${day}`)).data.map((r) => r.title)).toEqual(["その日の始まり"]);
  });

  it("K754-API-012 続き（cursor）：limit 2 で 5 件を 3 回で読むと重複も飛びも無い。同じ時刻の行も揺れない。終わりに cursor は無い。壊れた cursor は 422", async () => {
    const w = await h.world("k754-012");
    const at = iso(Date.now() - 20 * MIN);
    for (let i = 0; i < 3; i += 1)
      await h.run(w, (await h.ticket(w)).id, { status: "stopped", finishedAt: at, createdMinAgo: 30 });
    for (let i = 0; i < 2; i += 1)
      await h.run(w, (await h.ticket(w)).id, { status: "stopped", finishedMinAgo: 5 + i, createdMinAgo: 30 });
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      const v = await list(w, `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      seen.push(...v.data.map((r) => r.id));
      cursor = v.meta.cursor;
      if (page < 2) expect(cursor).toBeTruthy();
    }
    expect(cursor).toBeUndefined();
    expect(new Set(seen).size).toBe(5);
    expect(seen).toHaveLength(5);
    expect((await h.call(w.me, "GET", "/clones/me/activity?cursor=%%%")).status).toBeGreaterThanOrEqual(400);
    expect((await h.call(w.me, "GET", "/clones/me/activity?cursor=bm90LWEta2V5")).status).toBe(422);
  });

  it("K754-API-013 数（summary）：期間の全部の数。札・続きで変わらない。total は passed・fixed・stopped・waiting の合計（passed は passed と done・fixed は fixed と returned）", async () => {
    const w = await h.world("k754-013");
    const p = await made(w, { min: 90 });
    await decided(w, p.t.id, p.run, "approve");
    const f = await made(w, { min: 80 });
    await version(w, f.t.id, 2, f.finished + MIN, "human");
    await decided(w, f.t.id, f.run, "approve");
    const r = await made(w, { min: 70 });
    await decided(w, r.t.id, r.run, "return");
    const aw = await made(w, { min: 60 });
    await decided(w, aw.t.id, aw.run, null);
    const x = await made(w, { min: 50 });
    const ap = await decided(w, x.t.id, x.run, "approve");
    await h.run(w, x.t.id, { phase: "execute", status: "done", approvalId: ap, createdMinAgo: 9, finishedMinAgo: 8 });
    await h.run(w, (await h.ticket(w)).id, { status: "stopped", finishedMinAgo: 2 });
    const all = (await list(w)).meta.summary;
    expect(all).toEqual({ total: 7, passed: 3, fixed: 2, stopped: 1, waiting: 1 });
    const filtered = await list(w, "?kind=stopped&limit=1");
    expect(filtered.meta.summary).toEqual(all);
  });

  it("K754-API-014 自分の分身の物だけ：ほかの人が作った実行は出ない。自分が作った実行は、あとでほかの人に任せ直されても履歴に残る（やったこと）", async () => {
    const w = await h.world("k754-014");
    await made({ ...w, me: w.other } as World, { title: "佐藤の物" });
    const t = await h.ticket(w, { title: "任せ直された" });
    await h.run(w, t.id, { status: "stopped", finishedMinAgo: 20, createdMinAgo: 30 });
    await h.run(w, t.id, { status: "stopped", finishedMinAgo: 5, createdMinAgo: 10, by: w.other });
    expect((await list(w)).data.map((r) => r.title)).toEqual(["任せ直された"]);
    expect((await list(w, "", w.other)).data.map((r) => r.title)).toEqual(["任せ直された", "佐藤の物"]);
  });

  it("K754-API-015 見えないチケット（権限の無いグループ B）・消したチケットの実行は出ず、数にも入らない", async () => {
    const w = await h.world("k754-015");
    const hidden = await h.ticket(w, { scope: w.scopeB, assignee: w.outsider });
    await h.run(w, hidden.id, { status: "stopped", finishedMinAgo: 3 });
    const gone = await h.ticket(w, { deleted: true });
    await h.run(w, gone.id, { status: "stopped", finishedMinAgo: 3 });
    const v = await list(w);
    expect(v.data).toEqual([]);
    expect(v.meta.summary).toEqual({ total: 0, passed: 0, fixed: 0, stopped: 0, waiting: 0 });
  });

  it("K754-API-016 まだ何もしていない：data は空・summary は全部 0・育ち具合は assigned 0・割合は null・時間は 0（鍵ちょうど 4）", async () => {
    const w = await h.world("k754-016");
    const v = await list(w);
    expect(v.data).toEqual([]);
    expect(v.meta.summary).toEqual({ total: 0, passed: 0, fixed: 0, stopped: 0, waiting: 0 });
    const g = await growth(w);
    expect(Object.keys(g).sort()).toEqual(GROWTH_KEYS);
    expect(g).toEqual({ assigned: 0, pass_rate: null, pass_rate_last_week: null, work_seconds: 0 });
  });

  it("K754-API-017 読むだけ：何度読んでも実行・承認・成果物の版・やり取り・証跡の行が増えも変わりもしない", async () => {
    const w = await h.world("k754-017");
    const { t, run } = await made(w);
    await decided(w, t.id, run, "approve");
    const snap = () =>
      h.count(
        `select (select count(*) from action_runs where tenant_id = $1) + (select count(*) from approvals where tenant_id = $1)
              + (select count(*) from ticket_section_versions where tenant_id = $1) + (select count(*) from ticket_messages where tenant_id = $1)
              + (select count(*) from audit_events where tenant_id = $1) as n`,
        [w.tenantId],
      );
    const before = await snap();
    await list(w);
    await growth(w);
    await list(w, "?kind=made");
    expect(await snap()).toBe(before);
  });

  it("K754-API-018 ログインしていない・止められた人：どちらの口も 401・403（403 は題名を返さない）", async () => {
    const w = await h.world("k754-018");
    const { t } = await made(w, { title: "漏らしてはいけない題名" });
    expect(t.id).toBeTruthy();
    for (const path of ["/clones/me/activity", "/clones/me/growth"])
      expect((await h.call(null, "GET", path)).status, path).toBe(401);
    await h.f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [w.me.id]);
    for (const path of ["/clones/me/activity", "/clones/me/growth"]) {
      const r = await h.call(w.me, "GET", path);
      expect(r.status, path).toBe(403);
      expect(await r.text()).not.toContain("漏らしてはいけない題名");
    }
  });

  it("K754-API-019 問い合わせの形：from の形が日付でない・存在しない日付・from が to より後・limit が範囲の外は 422（欄の名前つき）。答えの頭は private・no-store", async () => {
    const w = await h.world("k754-019");
    for (const [q, field] of [
      ["?from=2026/11/01", "from"],
      ["?to=2026-02-30", "to"],
      ["?from=2026-11-05&to=2026-11-01", "from"],
    ] as const) {
      const r = await h.call(w.me, "GET", `/clones/me/activity${q}`);
      expect(r.status, q).toBe(422);
      expect(JSON.stringify(await h.json(r)), q).toContain(field);
    }
    expect((await h.call(w.me, "GET", "/clones/me/activity?limit=0")).status).toBe(422);
    expect((await h.call(w.me, "GET", "/clones/me/activity?limit=201")).status).toBe(422);
    for (const path of ["/clones/me/activity", "/clones/me/growth"]) {
      const cc = (await h.call(w.me, "GET", path)).headers.get("cache-control") ?? "";
      expect(cc, path).toMatch(/private/);
      expect(cc, path).toMatch(/no-store/);
    }
  });

  it("K754-API-020 育ち具合の任せた数：今週（日本時間の月曜 0 時から）に作る段を始めたチケットの数（同じチケットを 2 回任せても 1）。先週の分・ほかの人の分は入らない", async () => {
    const w = await h.world("k754-020");
    const ws = weekStart();
    const a = await h.ticket(w);
    await h.run(w, a.id, {
      phase: "make",
      status: "done",
      createdMinAgo: Math.max(0, (Date.now() - ws) / MIN - 1),
      finishedMinAgo: 0,
    });
    await h.run(w, a.id, { phase: "make", status: "stopped", createdMinAgo: 0, finishedMinAgo: 0 });
    const b = await h.ticket(w);
    await h.run(w, b.id, { phase: "make", status: "queued", createdMinAgo: 0 });
    const old = await h.ticket(w);
    await h.run(w, old.id, {
      phase: "make",
      status: "done",
      createdMinAgo: (Date.now() - ws) / MIN + 120,
      finishedMinAgo: (Date.now() - ws) / MIN + 100,
    });
    const theirs = await h.ticket(w, { assignee: w.other });
    await h.run(w, theirs.id, { phase: "make", status: "done", by: w.other, createdMinAgo: 0, finishedMinAgo: 0 });
    const exec = await h.ticket(w);
    await h.run(w, exec.id, { phase: "execute", status: "done", createdMinAgo: 0, finishedMinAgo: 0 });
    expect((await growth(w))["assigned"]).toBe(2);
  });

  it("K754-API-021 直さずに通った割合：今週決めた承認のうち、承認されて人が直さなかった物の割合（四捨五入の整数）。先週の割合も同じ式。決めた承認が無ければ null", async () => {
    const w = await h.world("k754-021");
    const ws = weekStart();
    const thisWeek = ws + 60_000;
    const lastWeek = ws - 24 * 3600_000;
    const mk = async (decision: "approve" | "return", edited: boolean, atMs: number) => {
      const t = await h.ticket(w);
      const run = await h.run(w, t.id, {
        phase: "make",
        status: "done",
        createdMinAgo: 9000,
        finishedAt: iso(atMs - 10 * MIN),
      });
      await version(w, t.id, 1, atMs - 10 * MIN, "ai");
      if (edited) await version(w, t.id, 2, atMs - 5 * MIN, "human");
      await decided(w, t.id, run, decision, { atMs });
    };
    await mk("approve", false, thisWeek);
    await mk("approve", false, thisWeek);
    await mk("approve", true, thisWeek);
    await mk("return", false, thisWeek);
    await mk("approve", false, lastWeek);
    const g = await growth(w);
    expect(g["pass_rate"]).toBe(50);
    expect(g["pass_rate_last_week"]).toBe(100);
    const w2 = await h.world("k754-021b");
    expect(await growth(w2)).toMatchObject({ pass_rate: null, pass_rate_last_week: null });
  });

  it("K754-API-022 AI が動いた時間：今週終わった実行（done・stopped）の始まりから終わりまでの秒の合計。動いている実行・始まりが無い実行・先週の実行は入らない", async () => {
    const w = await h.world("k754-022");
    const ws = weekStart();
    const base = ws + 60_000;
    for (const [status, secs] of [
      ["done", 600],
      ["stopped", 1800],
    ] as const) {
      const t = await h.ticket(w);
      await h.f.admin.query(
        `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, started_at, finished_at, created_by)
         values ($1, $2, $3, 'make', $4, $5, $6, $7)`,
        [w.tenantId, w.scopeA, t.id, status, iso(base), iso(base + secs * 1000), w.me.id],
      );
    }
    await h.run(w, (await h.ticket(w)).id, { status: "running", createdMinAgo: 3 });
    const t3 = await h.ticket(w);
    await h.f.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, finished_at, created_by) values ($1, $2, $3, 'make', 'stopped', $4, $5)",
      [w.tenantId, w.scopeA, t3.id, iso(base + 1000), w.me.id],
    );
    const t4 = await h.ticket(w);
    await h.f.admin.query(
      `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, started_at, finished_at, created_by)
       values ($1, $2, $3, 'make', 'done', $4, $5, $6)`,
      [w.tenantId, w.scopeA, t4.id, iso(ws - 7200_000), iso(ws - 3600_000), w.me.id],
    );
    expect((await growth(w))["work_seconds"]).toBe(2400);
  });

  it("K754-API-023 週の境目（G-12）：日本時間の月曜 0 時の 1 秒前に終わった実行は先週、0 時ちょうどは今週に入る", async () => {
    const w = await h.world("k754-023");
    const ws = weekStart();
    for (const [startMs, endMs] of [
      [ws - 120_000, ws - 1000],
      [ws, ws + 30_000],
    ] as const) {
      const t = await h.ticket(w);
      await h.f.admin.query(
        `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, started_at, finished_at, created_at, created_by)
         values ($1, $2, $3, 'make', 'done', $4, $5, $4, $6)`,
        [w.tenantId, w.scopeA, t.id, iso(startMs), iso(endMs), w.me.id],
      );
    }
    const g = await growth(w);
    expect(g["assigned"]).toBe(1);
    expect(g["work_seconds"]).toBe(30);
  });

  it("K754-API-024 契約と登録：RESPONSES の listCloneActivity・getCloneGrowth の鍵が決めたとおり（used・trend・often_fixed・saved_hours が無い）・hooks のファイルに 2 つの口が足されている", () => {
    const api =
      readFileSync(join(ROOT, "05_flow", "screen_api.py"), "utf8") +
      readFileSync(join(ROOT, "05_flow", "screen_api.d", "K-754.py"), "utf8");
    expect(api).toMatch(
      /"listCloneActivity": \("CloneActivity", \{[^}]*"kind": "string"[^}]*"result": "string"[^}]*"detail": "object"/,
    );
    expect(api).toMatch(
      /"getCloneGrowth": \("CloneGrowth", \{[^}]*"assigned": "integer"[^}]*"pass_rate": "integer\?"[^}]*"pass_rate_last_week": "integer\?"[^}]*"work_seconds": "integer"/,
    );
    expect(api).not.toMatch(/"often_fixed"|"saved_hours"|"trend"/);
    const hooks = readFileSync(join(ROOT, "apps", "api", "src", "hooks", "clone-room.ts"), "utf8");
    expect(hooks).toContain("listCloneActivity");
    expect(hooks).toContain("getCloneGrowth");
  });
});
