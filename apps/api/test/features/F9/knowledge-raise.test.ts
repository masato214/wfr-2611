// K-687「上の棚に上げる：頼みの置き場（DB）・頼む・取り下げる・断りのお知らせを消す（requestKnowledgeRaise・withdrawKnowledgeRequest・dismissKnowledgeRequest）」の単体の試験（口・DB の関数・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K687-API-NNN・K687-DB-NNN（チケット 11_tickets/K-687.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   土台は knowledge.harness.ts（K-675 が運ぶ）と、K-687 が運ぶ knowledge.requests-kit.ts。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   承認する・断る（K-688）は別の葉。この試験は頼みの行を行の守りの外で入れて、取り下げる・帯を消す・承認待ちの間の守りを見る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { bodyOf, setupKnowledge, type Person } from "./knowledge.harness.js";
import {
  allAudits,
  allNotices,
  audits,
  breakWrites,
  findNode,
  makeWorld,
  notices,
  num,
  requestRow,
  requestRows,
  seedRequest,
  type Json,
  type World,
} from "./knowledge.requests-kit.js";

const h = setupKnowledge();
const world = (label: string): Promise<World> => makeWorld(h, label);

const raise = async (p: Person | null, id: string, body: unknown = {}): Promise<Response> => {
  await h.ready();
  return h.req("POST", `/knowledge_pages/${id}/raise`, { ...(p ? { headers: h.as(p) } : {}), body });
};
const withdraw = async (p: Person | null, id: string): Promise<Response> => {
  await h.ready();
  return h.req("DELETE", `/knowledge/requests/${id}`, p ? { headers: h.as(p) } : {});
};
const dismiss = async (p: Person | null, id: string): Promise<Response> => {
  await h.ready();
  return h.req("POST", `/knowledge/requests/${id}/dismiss`, { ...(p ? { headers: h.as(p) } : {}), body: {} });
};
const call = async (p: Person, method: string, path: string, body?: unknown): Promise<Response> => {
  await h.ready();
  return h.req(method, path, { headers: h.as(p), ...(body === undefined ? {} : { body }) });
};
const readPage = async (p: Person, id: string): Promise<Json> => {
  const r = await call(p, "GET", `/knowledge_pages/${id}`);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const readTree = async (p: Person): Promise<Json> => {
  const r = await call(p, "GET", "/knowledge/tree");
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const codeOf = async (r: Response): Promise<string> => ((await r.json()) as Json)["code"] as string;
const fieldsOf = async (r: Response): Promise<string[]> =>
  (((await r.json()) as Json)["details"] as { field: string }[] | undefined)?.map((x) => x.field) ?? [];

/** 自分の棚の公開済みページ */
const mine = (p: Person, o: { title?: string; must?: boolean; state?: "draft" | "published"; summary?: string } = {}) =>
  h.page({ scope: p.scopeId, owner: p, personal: true, title: o.title ?? "自分のページ", ...o });
const grp = (scope: string, owner: Person, o: { title?: string; position?: number; folder?: string | null } = {}) =>
  h.page({ scope, owner, title: o.title ?? "グループのページ", ...o });

describe("K-687 上の棚に上げる", () => {
  it("K687-API-001 頼む（自分 → グループ）：201 { id, kind raise, state pending, page_id, to_name 営業, at }（鍵はちょうど 6）。頼みの行ができ、ページは自分の棚のまま。そのグループのマネージャー全員（頼んだ人を除く）に受け箱の行が 1 つずつ", async () => {
    const w = await world("K687 頼む 1");
    const p = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      title: "値引きの返し方",
      summary: "返してよい範囲",
    });
    const r = await raise(w.mem1, p, { group_id: w.g1, message: "お願いします" });
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["at", "id", "kind", "page_id", "state", "to_name"]);
    expect(d).toMatchObject({ kind: "raise", state: "pending", page_id: p, to_name: "営業" });
    expect(d["at"]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);
    expect(await requestRow(h, d["id"] as string)).toMatchObject({
      kind: "raise",
      state: "pending",
      page_id: p,
      folder_id: null,
      from_scope_id: w.g1,
      from_is_personal: true,
      to_scope_id: w.g1,
      to_folder_id: null,
      requested_by: w.mem1.id,
      message: "お願いします",
      decided_by: null,
      dismissed_at: null,
    });
    expect(await h.row(p)).toMatchObject({ scope_id: w.g1, is_personal: true, owner_member_id: w.mem1.id });
    const ns = await notices(h, w, "knowledge.raise_requested");
    expect(ns.map((n) => n.member_id).sort()).toEqual([w.mgr1.id, w.mgr1b.id].sort());
    for (const n of ns) {
      expect(n.channel_id).toBe("inapp");
      expect(Object.keys(n.payload).sort()).toEqual(["from_name", "page_id", "request_id", "title"]);
      expect(n.payload).toMatchObject({
        title: "値引きの返し方",
        page_id: p,
        request_id: d["id"],
        from_name: "営業メンバー",
      });
      expect(n.dedupe_key).toBe(`knowledge.raise_requested:${d["id"]}`);
      expect(n.read_at).toBeNull();
    }
  });

  it("K687-API-002 頼む（グループ → 会社）：マネージャーが頼むと to_name は会社・頼みの行の先は会社のいちばん上。会社の管理者全員に受け箱の行（頼んだ人が管理者でも自分には出ない）。グループのページに group_id を付けても無視する", async () => {
    const w = await world("K687 頼む 2");
    const p = await grp(w.g2, w.mgr2, { title: "納品の前の確かめ" });
    const r = await raise(w.mgr2, p, {});
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Json;
    expect(d).toMatchObject({ kind: "raise", state: "pending", page_id: p, to_name: "会社" });
    expect(await requestRow(h, d["id"] as string)).toMatchObject({
      from_scope_id: w.g2,
      from_is_personal: false,
      to_scope_id: w.co.rootScope,
      requested_by: w.mgr2.id,
    });
    const ns = await notices(h, w, "knowledge.raise_requested");
    expect(ns.map((n) => n.member_id).sort()).toEqual([w.boss.id, w.boss2.id].sort());
    expect(ns[0]!.payload).toMatchObject({ title: "納品の前の確かめ", from_name: "開発マネージャー" });
    const q = await grp(w.g2, w.mgr2, { title: "group_id つき" });
    const r2 = await raise(w.mgr2, q, { group_id: w.g1 });
    expect(r2.status).toBe(201);
    expect(await requestRow(h, ((await h.json(r2)).data as Json)["id"] as string)).toMatchObject({
      to_scope_id: w.co.rootScope,
    });
  });

  it("K687-API-003 書ける棚へはすぐ移る：自分のページをマネージャー自身がそのグループへ上げると、頼みを作らずその場で移る（201・state approved）。必ず守るは外れ・並びは移した先の最後・お知らせは出ない・証跡は knowledge.raise.apply", async () => {
    const w = await world("K687 すぐ移る");
    await grp(w.g1, w.mgr1, { title: "既にある", position: 30 });
    const p = await h.page({
      scope: w.mgr1.scopeId,
      owner: w.mgr1,
      personal: true,
      must: true,
      title: "自分のやり方",
      position: 5,
    });
    const r = await raise(w.mgr1, p, { group_id: w.g1 });
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Json;
    expect(d).toMatchObject({ kind: "raise", state: "approved", page_id: p, to_name: "営業" });
    expect(await h.row(p)).toMatchObject({
      scope_id: w.g1,
      is_personal: false,
      is_must: false,
      folder_id: null,
      position: 40,
      owner_member_id: w.mgr1.id,
      state: "published",
      current_version: 1,
    });
    expect(await requestRow(h, d["id"] as string)).toMatchObject({ state: "approved", decided_by: w.mgr1.id });
    expect((await notices(h, w, "knowledge.raise_requested")).length).toBe(0);
    expect((await audits(h, w, "knowledge.raise.apply")).length).toBe(1);
    expect((await audits(h, w, "knowledge.raise.request")).length).toBe(0);
    expect((await readPage(w.mem1, p))["id"]).toBe(p);
  });

  it("K687-API-004 入れるフォルダ：上げ先の棚のフォルダなら頼みに残る。見えるが別の棚のフォルダ（会社・自分）は 409 E-KNW-103、見えない・無い・消した・別の会社のフォルダは 404。どれも頼みもお知らせも増えない", async () => {
    const w = await world("K687 フォルダ");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const fCompany = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "全社" });
    const fMine = await h.folder({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, name: "個人" });
    const fOther = await h.folder({ scope: w.g2, owner: w.mgr2, name: "開発のフォルダ" });
    const fGone = await h.folder({ scope: w.g1, owner: w.mgr1, name: "古い" });
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [fGone]);
    const co2 = await h.company("K687 別の会社");
    const boss2 = await h.person(co2.tenantId, co2.rootScope, { name: "別の会社の管理者", role: "admin" });
    const fForeign = await h.folder({ scope: co2.rootScope, owner: boss2, name: "別の会社" });
    const ok = await mine(w.mem1, { title: "入れる" });
    const r = await raise(w.mem1, ok, { group_id: w.g1, folder_id: f1 });
    expect(r.status).toBe(201);
    expect(await requestRow(h, ((await h.json(r)).data as Json)["id"] as string)).toMatchObject({ to_folder_id: f1 });
    const rows = (await requestRows(h, w)).length;
    const ns = await allNotices(h, w);
    for (const f of [fCompany, fMine]) {
      const r2 = await raise(w.mem1, await mine(w.mem1), { group_id: w.g1, folder_id: f });
      expect(r2.status, f).toBe(409);
      expect(await codeOf(r2), f).toBe("E-KNW-103");
    }
    for (const f of [fOther, randomUUID(), fForeign, fGone]) {
      const r2 = await raise(w.mem1, await mine(w.mem1), { group_id: w.g1, folder_id: f });
      expect(r2.status, f).toBe(404);
      expect(((await r2.json()) as Json)["code"], f).toBe("NOT_FOUND");
    }
    expect((await requestRows(h, w)).length).toBe(rows);
    expect(await allNotices(h, w)).toBe(ns);
  });

  it("K687-API-005 上げ先の棚：自分のページは group_id が要る（無ければ 409 E-KNW-101）。入っていないグループ・会社のいちばん上・無い id・別の会社のグループは 404、uuid でない値は 422。会社の棚のページは 409 E-KNW-100", async () => {
    const w = await world("K687 上げ先");
    const co2 = await h.company("K687 別の会社 2");
    const g9 = await h.group(co2.tenantId, co2.rootScope, "別の会社のグループ");
    const r0 = await raise(w.mem1, await mine(w.mem1), {});
    expect(r0.status).toBe(409);
    expect(await codeOf(r0)).toBe("E-KNW-101");
    for (const g of [w.co.rootScope, w.g2, w.g3, g9, randomUUID()]) {
      const r = await raise(w.mem1, await mine(w.mem1), { group_id: g });
      expect(r.status, g).toBe(404);
      expect(await codeOf(r), g).toBe("NOT_FOUND");
    }
    const r422 = await raise(w.mem1, await mine(w.mem1), { group_id: "x" });
    expect(r422.status).toBe(422);
    expect(await fieldsOf(r422)).toContain("group_id");
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    const rc = await raise(w.boss, company, {});
    expect(rc.status).toBe(409);
    expect(await codeOf(rc)).toBe("E-KNW-100");
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
  });

  it("K687-API-006 ページの状態：まだ書き終えていないページは 409 E-KNW-010。承認待ちの頼みがあれば同じ人の 2 度目も 409 E-KNW-011。断られた・取り下げた・承認済みの頼みがあっても新しく頼める", async () => {
    const w = await world("K687 状態");
    const draft = await mine(w.mem1, { state: "draft", title: "書きかけ" });
    const r1 = await raise(w.mem1, draft, { group_id: w.g1 });
    expect(r1.status).toBe(409);
    expect(await codeOf(r1)).toBe("E-KNW-010");
    const p = await mine(w.mem1, { title: "1 度目" });
    expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(201);
    const again = await raise(w.mem1, p, { group_id: w.g1 });
    expect(again.status).toBe(409);
    expect(await codeOf(again)).toBe("E-KNW-011");
    const gp = await grp(w.g2, w.mgr2, { title: "グループの 1 度目" });
    expect((await raise(w.mgr2, gp, {})).status).toBe(201);
    expect(await codeOf(await raise(w.mgr2, gp, {}))).toBe("E-KNW-011");
    expect((await requestRows(h, w)).length).toBe(2);
    for (const state of ["declined", "withdrawn", "approved"] as const) {
      const q = await mine(w.mem1, { title: `前に ${state}` });
      await seedRequest(h, w, {
        page: q,
        fromScope: w.g1,
        fromPersonal: true,
        toScope: w.g1,
        by: w.mem1,
        state,
        decidedBy: w.mgr1,
        reason: state === "declined" ? "理由" : null,
      });
      const r = await raise(w.mem1, q, { group_id: w.g1 });
      expect(r.status, state).toBe(201);
    }
  });

  it("K687-API-007 承認する人がいない：マネージャーのいないグループ（企画）へ上げるのは 409 E-KNW-102。頼みもお知らせも残らない", async () => {
    const w = await world("K687 承認する人なし");
    const p = await mine(w.mem3, { title: "企画のやり方" });
    const r = await raise(w.mem3, p, { group_id: w.g3 });
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-102");
    expect(((await r.json()) as Json)["detail"]).toBeUndefined();
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    expect(await h.row(p)).toMatchObject({ scope_id: w.g3, is_personal: true });
  });

  it("K687-API-008 誰が頼めるか：グループのページはそのグループのマネージャーだけ（メンバー・閲覧のみは 403）。自分のページは本人だけ（閲覧のみの人も頼める）。見えない・他人の自分のページ・消したページ・無い id・別の会社の管理者は 404", async () => {
    const w = await world("K687 誰が");
    const gp = await grp(w.g1, w.mgr1, { title: "営業のページ" });
    for (const p of [w.mem1, w.view1]) expect((await raise(p, gp, {})).status, p.id).toBe(403);
    for (const p of [w.mgr2, w.none, w.boss]) expect((await raise(p, gp, {})).status, p.id).toBe(404);
    const memberPage = await mine(w.mem1, { title: "メンバーのページ" });
    expect((await raise(w.mgr1, memberPage, { group_id: w.g1 })).status).toBe(404);
    const viewerPage = await mine(w.view1, { title: "閲覧のみの人のページ" });
    expect((await raise(w.view1, viewerPage, { group_id: w.g1 })).status).toBe(201);
    const gone = await grp(w.g1, w.mgr1, { title: "消した" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    for (const id of [gone, randomUUID()]) expect((await raise(w.mgr1, id, {})).status, id).toBe(404);
    const co2 = await h.company("K687 別の会社 3");
    const foreign = await h.person(co2.tenantId, co2.rootScope, { name: "別の会社の管理者", role: "admin" });
    expect((await raise(foreign, gp, {})).status).toBe(404);
    expect((await requestRows(h, w)).length).toBe(1);
  });

  it("K687-API-009 入力の形：message は 1,000 字まで（1,001 字・文字でない値は 422）・前後の空白だけなら頼みには残らない（null）。知らない欄・配列の体・uuid でない folder_id・NUL を含む文字は 422。422 のとき何も増えない", async () => {
    const w = await world("K687 入力");
    const bad: unknown[] = [
      { group_id: w.g1, message: "あ".repeat(1001) },
      { group_id: w.g1, message: 5 },
      { group_id: w.g1, foo: 1 },
      { group_id: w.g1, folder_id: "x" },
      { group_id: 5 },
      { group_id: w.g1, message: "a\u0000b" },
      [],
    ];
    for (const b of bad) {
      const r = await raise(w.mem1, await mine(w.mem1), b);
      expect(r.status, JSON.stringify(b).slice(0, 40)).toBe(422);
      expect(await codeOf(r)).toBe("VALIDATION_ERROR");
    }
    expect((await requestRows(h, w)).length).toBe(0);
    const dismissBad = await call(w.mem1, "POST", `/knowledge/requests/${randomUUID()}/dismiss`, { foo: 1 });
    expect(dismissBad.status).toBe(422);
    expect(await codeOf(dismissBad)).toBe("VALIDATION_ERROR");
    const long = await raise(w.mem1, await mine(w.mem1), { group_id: w.g1, message: "あ".repeat(1000) });
    expect(long.status).toBe(201);
    expect(
      ((await requestRow(h, ((await h.json(long)).data as Json)["id"] as string))!["message"] as string).length,
    ).toBe(1000);
    for (const blank of ["   ", ""]) {
      const r = await raise(w.mem1, await mine(w.mem1), { group_id: w.g1, message: blank });
      expect(r.status, blank).toBe(201);
      expect((await requestRow(h, ((await h.json(r)).data as Json)["id"] as string))!["message"], blank).toBeNull();
    }
  });

  it("K687-API-010 取り下げる：頼んだ人が承認待ちの頼みを取り下げると 200 { id, state withdrawn }。承認する人に出したお知らせは（読んだ後でも）消え、ページはまた動かせて、もう 1 度頼める", async () => {
    const w = await world("K687 取り下げ");
    const p = await mine(w.mem1, { title: "取り下げる" });
    const id = ((await h.json(await raise(w.mem1, p, { group_id: w.g1 }))).data as Json)["id"] as string;
    await h.admin.query(
      "update notifications set read_at = now() where member_id = $1 and event_kind_id = 'knowledge.raise_requested'",
      [w.mgr1.id],
    );
    const r = await withdraw(w.mem1, id);
    expect(r.status).toBe(200);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["id", "state"]);
    expect(d).toEqual({ id, state: "withdrawn" });
    expect(await requestRow(h, id)).toMatchObject({ state: "withdrawn" });
    expect((await notices(h, w, "knowledge.raise_requested")).length).toBe(0);
    const all = await notices(h, w, "knowledge.raise_requested", { live: false });
    expect(all.length).toBe(2);
    for (const n of all) expect(n.deleted_at).not.toBeNull();
    expect((await call(w.mem1, "PATCH", `/knowledge_pages/${p}`, { position: 7 })).status).toBe(200);
    expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(201);
  });

  it("K687-API-011 取り下げの守り：承認する人は 403・頼んだ人でも承認する人でもなく頼みが見えない人は 404・見える人（グループのページを読める人）は 403。決まった頼み（承認・断り・取り下げ済み）は 409 E-KNW-104", async () => {
    const w = await world("K687 取り下げの守り");
    const p = await mine(w.mem1, { title: "守り" });
    const id = ((await h.json(await raise(w.mem1, p, { group_id: w.g1 }))).data as Json)["id"] as string;
    expect((await withdraw(w.mgr1, id)).status).toBe(403);
    for (const who of [w.view1, w.mem2, w.none, w.boss]) expect((await withdraw(who, id)).status, who.id).toBe(404);
    expect((await withdraw(w.mem1, randomUUID())).status).toBe(404);
    const gp = await grp(w.g2, w.mgr2, { title: "グループの頼み" });
    const gid = ((await h.json(await raise(w.mgr2, gp, {}))).data as Json)["id"] as string;
    expect((await withdraw(w.mem2, gid)).status).toBe(403);
    expect((await withdraw(w.boss, gid)).status).toBe(403);
    expect((await withdraw(w.view1, gid)).status).toBe(404);
    expect(await requestRow(h, id)).toMatchObject({ state: "pending" });
    expect(await requestRow(h, gid)).toMatchObject({ state: "pending" });
    for (const state of ["declined", "approved", "withdrawn"] as const) {
      const q = await mine(w.mem1, { title: `決まった ${state}` });
      const rid = await seedRequest(h, w, {
        page: q,
        fromScope: w.g1,
        fromPersonal: true,
        toScope: w.g1,
        by: w.mem1,
        state,
        decidedBy: w.mgr1,
      });
      const r = await withdraw(w.mem1, rid);
      expect(r.status, state).toBe(409);
      expect(await codeOf(r), state).toBe("E-KNW-104");
    }
  });

  it("K687-API-012 断りの帯を消す：断られた頼みを頼んだ人が消すと 200 { id, state declined }・帯を消した印が付き、断りのお知らせも消え、木の印も外れる。2 度目・承認待ち・承認済み・取り下げ済みは 409 E-KNW-105。承認する人は 403・見えない人は 404", async () => {
    const w = await world("K687 帯を消す");
    const p = await mine(w.mem1, { title: "断られた" });
    const id = await seedRequest(h, w, {
      page: p,
      fromScope: w.g1,
      fromPersonal: true,
      toScope: w.g1,
      by: w.mem1,
      state: "declined",
      decidedBy: w.mgr1,
      reason: "既にあります",
    });
    await h.admin.query(
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key) values ($1, $2, 'inapp', 'knowledge.raise_declined', '{}'::jsonb, $3)",
      [w.co.tenantId, w.mem1.id, `knowledge.raise_declined:${id}`],
    );
    expect(findNode(await readTree(w.mem1), p)).toMatchObject({ mark: "declined" });
    expect((await dismiss(w.mgr1, id)).status).toBe(403);
    expect((await dismiss(w.view1, id)).status).toBe(404);
    expect((await dismiss(w.mem1, randomUUID())).status).toBe(404);
    const r = await dismiss(w.mem1, id);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ id, state: "declined" });
    expect((await requestRow(h, id))!["dismissed_at"]).not.toBeNull();
    expect((await notices(h, w, "knowledge.raise_declined")).length).toBe(0);
    expect(findNode(await readTree(w.mem1), p)).toMatchObject({ mark: null });
    const second = await dismiss(w.mem1, id);
    expect(second.status).toBe(409);
    expect(await codeOf(second)).toBe("E-KNW-105");
    const q = await mine(w.mem1, { title: "承認待ち" });
    const pend = ((await h.json(await raise(w.mem1, q, { group_id: w.g1 }))).data as Json)["id"] as string;
    expect(await codeOf(await dismiss(w.mem1, pend))).toBe("E-KNW-105");
    for (const state of ["approved", "withdrawn"] as const) {
      const s = await mine(w.mem1, { title: state });
      const rid = await seedRequest(h, w, {
        page: s,
        fromScope: w.g1,
        fromPersonal: true,
        toScope: w.g1,
        by: w.mem1,
        state,
        decidedBy: w.mgr1,
      });
      expect(await codeOf(await dismiss(w.mem1, rid)), state).toBe("E-KNW-105");
    }
  });

  it("K687-API-013 承認待ちの間は動かせない・消せない・必ず守るを変えられない：動かす・消す・必ず守るを外す／付けるはどれも 409 E-KNW-011（すでに同じ印の呼びは 200）。ページは変わらない（前の葉の口に効く）", async () => {
    const w = await world("K687 待ちの間");
    const q = await mine(w.mem1, { title: "必須で上げる", must: true });
    expect((await raise(w.mem1, q, { group_id: w.g1 })).status).toBe(201);
    const before = await h.row(q);
    for (const [method, path, body] of [
      ["PATCH", `/knowledge_pages/${q}`, { position: 5 }],
      ["DELETE", `/knowledge_pages/${q}`, undefined],
      ["PUT", `/knowledge_pages/${q}/must`, { must: false }],
    ] as [string, string, unknown][]) {
      const r = await call(w.mem1, method, path, body);
      expect(r.status, method).toBe(409);
      expect(await codeOf(r), method).toBe("E-KNW-011");
    }
    expect((await call(w.mem1, "PUT", `/knowledge_pages/${q}/must`, { must: true })).status).toBe(200);
    const gp = await grp(w.g2, w.mgr2, { title: "グループの待ち" });
    expect((await raise(w.mgr2, gp, {})).status).toBe(201);
    expect(await codeOf(await call(w.mgr2, "PUT", `/knowledge_pages/${gp}/must`, { must: true }))).toBe("E-KNW-011");
    expect(await codeOf(await call(w.mgr2, "DELETE", `/knowledge_pages/${gp}`))).toBe("E-KNW-011");
    expect(await h.row(q)).toEqual(before);
  });

  it("K687-API-014 承認待ちの間も直せる：下書きを保存して書き終える（版が進む）ことはできる。頼みは承認待ちのまま（承認されるのはその時点の公開の版）", async () => {
    const w = await world("K687 待ちの間に直す");
    const q = await mine(w.mem1, { title: "直しながら待つ" });
    const id = ((await h.json(await raise(w.mem1, q, { group_id: w.g1 }))).data as Json)["id"] as string;
    const save = await call(w.mem1, "PATCH", `/knowledge_pages/${q}/draft`, {
      title: "新しい題名",
      doc: bodyOf("新しい本文").doc,
    });
    expect(save.status).toBe(200);
    const pub = await call(w.mem1, "POST", `/knowledge_pages/${q}/publish`, {});
    expect(pub.status).toBe(200);
    expect(((await h.json(pub)).data as Json)["version"]).toBe(2);
    expect(await requestRow(h, id)).toMatchObject({ state: "pending" });
    expect(await h.row(q)).toMatchObject({ current_version: 2 });
  });

  it("K687-API-015 ページを読むと帯・操作・上げる先が出る：承認待ちは request（waiting・頼んだ人・can_withdraw は頼んだ人だけ true）で操作の raise は無く raise_to は null。断られた帯は頼んだ人だけ。頼める人には raise と raise_to（先・承認する人の名前）が出る", async () => {
    const w = await world("K687 帯");
    const p = await mine(w.mem1, { title: "自分のページ" });
    const open = await readPage(w.mem1, p);
    expect(open["acts"]).toContain("raise");
    expect(open["request"]).toBeNull();
    expect(open["raise_to"]).toEqual({
      shelf: "group",
      shelf_name: "営業",
      group_id: w.g1,
      approver_names: ["営業のもう 1 人のマネージャー", "営業マネージャー"],
    });
    const gp = await grp(w.g2, w.mgr2, { title: "開発のページ" });
    const gOpen = await readPage(w.mgr2, gp);
    expect(gOpen["raise_to"]).toEqual({
      shelf: "company",
      shelf_name: "会社",
      group_id: null,
      approver_names: ["管理者", "管理者 2"],
    });
    const own = await mine(w.mgr1, { title: "マネージャーの自分のページ" });
    expect((await readPage(w.mgr1, own))["raise_to"]).toMatchObject({
      group_id: w.g1,
      approver_names: ["営業のもう 1 人のマネージャー"],
    });
    const id = ((await h.json(await raise(w.mem1, p, { group_id: w.g1 }))).data as Json)["id"] as string;
    const waiting = await readPage(w.mem1, p);
    expect(waiting["request"]).toMatchObject({
      id,
      kind: "raise",
      state: "waiting",
      to_name: "営業",
      who_name: "営業のもう 1 人のマネージャー", // 相手の名前＝承認する人（approver_names の先頭）。頼んだ人（営業メンバー）ではない
      reason: null,
      can_withdraw: true,
    });
    expect((waiting["request"] as Json)["at"]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);
    expect(waiting["acts"]).not.toContain("raise");
    // 承認待ちの間は、書ける人（頼んだ本人）が読んでも帯に must-on・must-off が出ない（K-685 の頼み）
    expect(waiting["acts"]).not.toContain("must-on");
    expect(waiting["acts"]).not.toContain("must-off");
    expect(waiting["raise_to"]).toBeNull();
    const gid = ((await h.json(await raise(w.mgr2, gp, {}))).data as Json)["id"] as string;
    expect((await readPage(w.mgr2, gp))["request"]).toMatchObject({ id: gid, state: "waiting", can_withdraw: true });
    expect((await readPage(w.mem2, gp))["request"]).toMatchObject({ id: gid, state: "waiting", can_withdraw: false });
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss });
    const c = await readPage(w.boss, company);
    expect(c["acts"]).not.toContain("raise");
    expect(c["raise_to"]).toBeNull();
    const memberView = await readPage(w.mem1, await grp(w.g1, w.mgr1, { title: "営業のページ" }));
    expect(memberView["acts"]).not.toContain("raise");
    expect(memberView["raise_to"]).toBeNull();
    const draft = await mine(w.mem1, { state: "draft", title: "書きかけ" });
    expect((await readPage(w.mem1, draft))["raise_to"]).toBeNull();
    const dp = await grp(w.g1, w.mgr1, { title: "断られた" });
    await seedRequest(h, w, {
      page: dp,
      fromScope: w.g1,
      toScope: w.co.rootScope,
      by: w.mgr1,
      state: "declined",
      decidedBy: w.boss,
      reason: "足りません",
    });
    expect((await readPage(w.mgr1, dp))["request"]).toMatchObject({
      state: "declined",
      who_name: "管理者", // 断った人
      reason: "足りません",
      can_withdraw: false,
    });
    expect((await readPage(w.mgr1b, dp))["request"]).toBeNull();
  });

  it("K687-API-016 木の印：承認待ちの頼みがあるページは読める人みんなに waiting。断られた印は頼んだ人だけで、帯を消すと外れる", async () => {
    const w = await world("K687 木の印");
    const gp = await grp(w.g2, w.mgr2, { title: "待ち" });
    expect((await raise(w.mgr2, gp, {})).status).toBe(201);
    for (const p of [w.mgr2, w.mem2]) expect(findNode(await readTree(p), gp), p.id).toMatchObject({ mark: "waiting" });
    const dp = await grp(w.g2, w.mgr2, { title: "断られ" });
    const id = await seedRequest(h, w, {
      page: dp,
      fromScope: w.g2,
      toScope: w.co.rootScope,
      by: w.mgr2,
      state: "declined",
      decidedBy: w.boss,
      reason: "理由",
    });
    expect(findNode(await readTree(w.mgr2), dp)).toMatchObject({ mark: "declined" });
    expect(findNode(await readTree(w.mem2), dp)).toMatchObject({ mark: null });
    expect((await dismiss(w.mgr2, id)).status).toBe(200);
    expect(findNode(await readTree(w.mgr2), dp)).toMatchObject({ mark: null });
  });

  it("K687-API-017 権限の波及：マネージャーの役を外された人は次の頼みから 403・マネージャーにされた人が自分のページを上げると頼みを作らずすぐ移る・グループを抜けた人が自分のページを上げると 404。入り直しは要らない", async () => {
    const w = await world("K687 波及");
    const a = await grp(w.g1, w.mgr1, { title: "A" });
    const b = await grp(w.g1, w.mgr1, { title: "B" });
    expect((await raise(w.mgr1, a, {})).status).toBe(201);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    expect((await raise(w.mgr1, b, {})).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.mem1.id,
      w.g1,
    ]);
    const mine1 = await mine(w.mem1, { title: "昇格のあと" });
    const r = await raise(w.mem1, mine1, { group_id: w.g1 });
    expect(r.status).toBe(201);
    expect(((await h.json(r)).data as Json)["state"]).toBe("approved");
    // 自分の棚のページは持ち主の主の所属に置く（K-674 の引き金）。抜ける前に作り、抜けた後に上げる
    const mine2 = await mine(w.view1, { title: "抜けたあと" });
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.view1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.view1.id, w.co.rootScope]);
    expect((await raise(w.view1, mine2, { group_id: w.g1 })).status).toBe(404);
  });

  it("K687-API-018 同時に頼む：同じページを同時に 2 回頼むと 1 つが 201・もう 1 つが 409 E-KNW-011。頼みの行は 1 つ・承認する人のお知らせも 1 人 1 つ", async () => {
    const w = await world("K687 同時");
    const p = await mine(w.mem1, { title: "同時" });
    await h.ready();
    const rs = await Promise.all([raise(w.mem1, p, { group_id: w.g1 }), raise(w.mem1, p, { group_id: w.g1 })]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await codeOf(rs.find((r) => r.status === 409)!)).toBe("E-KNW-011");
    expect((await requestRows(h, w)).length).toBe(1);
    expect((await notices(h, w, "knowledge.raise_requested", { member: w.mgr1 })).length).toBe(1);
  });

  it("K687-API-019 お知らせは承認待ちの画面とは別：頼んでも承認の行（チケットの承認待ち）は増えず、お知らせは受け箱の行（inapp）だけ。頼んだ人・読めない人には出ない", async () => {
    const w = await world("K687 お知らせ");
    const p = await mine(w.mem1, { title: "別の道" });
    expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(201);
    expect(await num(h, "select count(*) as n from approvals where tenant_id = $1", [w.co.tenantId])).toBe(0);
    const rows = (
      await h.admin.query(
        "select member_id, channel_id from notifications where tenant_id = $1 and event_kind_id like 'knowledge.%'",
        [w.co.tenantId],
      )
    ).rows as { member_id: string; channel_id: string }[];
    expect(rows.every((x) => x.channel_id === "inapp")).toBe(true);
    const ids = rows.map((x) => x.member_id);
    for (const who of [w.mem1, w.view1, w.mem2, w.boss, w.none]) expect(ids, who.id).not.toContain(who.id);
  });

  it("K687-API-020 証跡：頼む＝knowledge.raise.request・すぐ移る＝knowledge.raise.apply・取り下げ＝knowledge.raise.withdraw・帯を消す＝knowledge.raise.dismiss が 1 行ずつ（操作した人・対象は頼み・種類 knowledge_requests・関門 C2・payload は空）。断った操作には残らず、題名を入れない", async () => {
    const w = await world("K687 証跡");
    const p = await mine(w.mem1, { title: "秘密の題名" });
    await raise(w.mem1, p, { group_id: w.g2 });
    await raise(w.mem1, randomUUID(), {});
    expect(await allAudits(h, w)).toBe(0);
    const id = ((await h.json(await raise(w.mem1, p, { group_id: w.g1 }))).data as Json)["id"] as string;
    await withdraw(w.mgr1, id);
    expect((await withdraw(w.mem1, id)).status).toBe(200);
    const q = await mine(w.mgr1, { title: "すぐ" });
    await raise(w.mgr1, q, { group_id: w.g1 });
    const dp = await mine(w.mem1, { title: "断られ" });
    const did = await seedRequest(h, w, {
      page: dp,
      fromScope: w.g1,
      fromPersonal: true,
      toScope: w.g1,
      by: w.mem1,
      state: "declined",
      decidedBy: w.mgr1,
      reason: "理由",
    });
    expect((await dismiss(w.mem1, did)).status).toBe(200);
    for (const action of [
      "knowledge.raise.request",
      "knowledge.raise.apply",
      "knowledge.raise.withdraw",
      "knowledge.raise.dismiss",
    ]) {
      const rows = await audits(h, w, action);
      expect(rows.length, action).toBe(1);
      expect(rows[0], action).toMatchObject({ target_type: "knowledge_requests", choke_point_id: "C2" });
      expect(JSON.stringify(rows[0]!.payload ?? {}), action).toBe("{}");
      expect(JSON.stringify(rows[0]), action).not.toContain("秘密");
    }
    expect((await audits(h, w, "knowledge.raise.request"))[0]).toMatchObject({
      actor_member_id: w.mem1.id,
      target_id: id,
    });
  });

  it("K687-API-021 失敗（手順 1）：頼みの行を書く所で DB が落ちると 503 E-PAGE-003・頼みもお知らせも残らず、ログに題名を出さない", async () => {
    const w = await world("K687 失敗 1");
    const p = await mine(w.mem1, { title: "秘密の題名" });
    await h.ready();
    const fix = await breakWrites(h, "knowledge_requests", w.co.tenantId);
    let logs = "";
    try {
      logs = await h.captureLogs(async () => {
        const r = await raise(w.mem1, p, { group_id: w.g1 });
        expect(r.status).toBe(503);
        expect(await codeOf(r)).toBe("E-PAGE-003");
      });
    } finally {
      await fix();
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    expect(logs).not.toContain("秘密の");
    expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(201);
  });

  it("K687-API-022 失敗（手順 2）：お知らせを書く所で DB が落ちると 503 E-PAGE-003・同じ取引なので頼みも戻る。そのあとの頼みは通る", async () => {
    const w = await world("K687 失敗 2");
    const p = await mine(w.mem1, { title: "お知らせで落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "notifications", w.co.tenantId);
    try {
      expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(201);
  });

  it("K687-API-023 失敗（手順 3）：証跡を書く所で DB が落ちると 503 E-PAGE-003・頼みもお知らせも戻る。取り下げの途中で落ちても頼みは承認待ちのままお知らせも残る", async () => {
    const w = await world("K687 失敗 3");
    const p = await mine(w.mem1, { title: "証跡で落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "audit_events", w.co.tenantId);
    try {
      expect((await raise(w.mem1, p, { group_id: w.g1 })).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    const id = ((await h.json(await raise(w.mem1, p, { group_id: w.g1 }))).data as Json)["id"] as string;
    const fix2 = await breakWrites(h, "audit_events", w.co.tenantId);
    try {
      expect((await withdraw(w.mem1, id)).status).toBe(503);
    } finally {
      await fix2();
    }
    expect(await requestRow(h, id)).toMatchObject({ state: "pending" });
    expect((await notices(h, w, "knowledge.raise_requested")).length).toBe(2);
  });

  it("K687-API-024 ログインしていない：3 つの口とも 401", async () => {
    const p = randomUUID();
    expect((await raise(null, p, {})).status).toBe(401);
    expect((await withdraw(null, p)).status).toBe(401);
    expect((await dismiss(null, p)).status).toBe(401);
  });

  it("K687-API-025 上限を超えると 429（1 分 60 回の上限を 2 に差し替えた requestKnowledgeRaise の 3 回目）", async () => {
    const w = await world("K687 呼べる回数");
    h.limits["requestKnowledgeRaise"] = 2;
    try {
      expect((await raise(w.mem1, await mine(w.mem1), { group_id: w.g1 })).status).toBe(201);
      expect((await raise(w.mem1, await mine(w.mem1), { group_id: w.g1 })).status).toBe(201);
      const r = await raise(w.mem1, await mine(w.mem1), { group_id: w.g1 });
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["requestKnowledgeRaise"];
    }
  });

  it("K687-API-026 お知らせの種類の表：上げる・共有の 7 つの種類（頼まれた 2 つは札 approval・ほかは write）が一覧の種類の表（K-461）にあり、チケットに結ばず行き先は（頼まれた 2 つは /knowledge?view=admin&list=approvals・ほかは /knowledge）・取り消し系の印は付かない。params の欄の集まりは増えない", async () => {
    const { KINDS, KNOWN_KINDS, PARAM_KEYS } = await import("../../../src/features/F7/notifications/kinds.js");
    const kinds = [
      ["knowledge.raise_requested", "approval"],
      ["knowledge.share_requested", "approval"],
      ["knowledge.raise_approved", "write"],
      ["knowledge.raise_declined", "write"],
      ["knowledge.share_approved", "write"],
      ["knowledge.share_declined", "write"],
      ["knowledge.share_ended", "write"],
    ] as const;
    for (const [kind, tag] of kinds) {
      // 頼まれた 2 つ（札 approval）は管理の承認待ちを直接開く（K-694 の道）。ほかはページの画面
      const href = tag === "approval" ? "/knowledge?view=admin&list=approvals" : "/knowledge";
      expect(KINDS[kind], kind).toMatchObject({ tag, ticket: false, href });
      expect((KINDS[kind] as { afterDelete?: boolean }).afterDelete, kind).toBeUndefined();
      expect([...KNOWN_KINDS], kind).toContain(kind);
    }
    expect([...PARAM_KEYS].length).toBe(11);
  });

  it("K687-DB-001 頼みの表：種類・状態は決めた値だけ・上げるにはページが要る・共有はページかフォルダのどちらか 1 つ・同じ（ページ・種類・先）の承認待ちは 1 つだけ（決まった後は入れ直せる）。アプリの役は書けない。読めるのは頼んだ人・承認する人・承認待ちはページが読める人", async () => {
    const w = await world("K687 表");
    const p = await mine(w.mem1, { title: "表の試験" });
    const ins = (kind: string, state: string, page: string | null, folder: string | null) =>
      h.admin.query(
        "insert into knowledge_requests (tenant_id, kind, page_id, folder_id, from_scope_id, from_is_personal, to_scope_id, requested_by, state) values ($1, $2, $3, $4, $5, true, $6, $7, $8)",
        [w.co.tenantId, kind, page, folder, w.g1, w.g1, w.mem1.id, state],
      );
    await expect(ins("x", "pending", p, null)).rejects.toMatchObject({ code: "23514" });
    await expect(ins("raise", "x", p, null)).rejects.toMatchObject({ code: "23514" });
    await expect(ins("raise", "pending", null, null)).rejects.toMatchObject({ code: "23514" });
    await expect(ins("share", "pending", null, null)).rejects.toMatchObject({ code: "23514" });
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    await expect(ins("share", "pending", p, f)).rejects.toMatchObject({ code: "23514" });
    await ins("raise", "pending", p, null);
    await expect(ins("raise", "pending", p, null)).rejects.toMatchObject({ code: "23505" });
    await h.admin.query("update knowledge_requests set state = 'withdrawn' where page_id = $1", [p]);
    await ins("raise", "pending", p, null);
    const as = (who: Person, sql: string, params: unknown[] = []) =>
      withTenant(h.pool, who.ctx, async (cl) => (await cl.query(sql, params)).rows);
    const own = "select id from knowledge_requests where page_id = $1";
    expect((await as(w.mem1, own, [p])).length).toBe(2);
    expect((await as(w.mgr1, own, [p])).length).toBe(2);
    for (const who of [w.mem2, w.view1, w.boss, w.none]) expect((await as(who, own, [p])).length, who.id).toBe(0);
    const gp = await grp(w.g2, w.mgr2, { title: "グループの頼み" });
    await seedRequest(h, w, { page: gp, fromScope: w.g2, toScope: w.co.rootScope, by: w.mgr2 });
    expect((await as(w.mem2, own, [gp])).length).toBe(1);
    expect((await as(w.boss, own, [gp])).length).toBe(1);
    expect((await as(w.mem1, own, [gp])).length).toBe(0);
    const dp = await grp(w.g2, w.mgr2, { title: "断られた頼み" });
    await seedRequest(h, w, {
      page: dp,
      fromScope: w.g2,
      toScope: w.co.rootScope,
      by: w.mgr2,
      state: "declined",
      decidedBy: w.boss,
      reason: "理由",
    });
    expect((await as(w.mgr2, own, [dp])).length).toBe(1);
    expect((await as(w.mem2, own, [dp])).length).toBe(0);
    await expect(as(w.mgr1, "delete from knowledge_requests")).rejects.toMatchObject({ code: "42501" });
    await expect(as(w.mgr1, "update knowledge_requests set message = 'x'")).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(
        w.mgr1,
        "insert into knowledge_requests (tenant_id, kind, page_id, from_scope_id, to_scope_id, requested_by) values ($1, 'raise', $2, $3, $3, $4)",
        [w.co.tenantId, p, w.g1, w.mgr1.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("K687-DB-002 関数 kn_apply_raise：ページを頼みの先の棚へ移す（先がグループ＝自分の棚の印が外れ・会社＝グループでない）。必ず守るは外れ・並びは先の最後・入れるフォルダに入る・書いている途中の下書きの版は捨て・公開の版はそのまま・頼みの状態は変えない", async () => {
    const w = await world("K687 移す関数");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    await grp(w.g1, w.mgr1, { title: "先に居る", position: 30, folder: f });
    const p = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      must: true,
      title: "移る",
      position: 3,
    });
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 2, 'draft', $3::jsonb, $4)",
      [w.co.tenantId, p, JSON.stringify(bodyOf("途中の下書き")), w.mem1.id],
    );
    const rid = await seedRequest(h, w, {
      page: p,
      fromScope: w.g1,
      fromPersonal: true,
      toScope: w.g1,
      toFolder: f,
      by: w.mem1,
    });
    await h.admin.query("select app.kn_apply_raise($1, $2)", [rid, w.mgr1.id]);
    expect(await h.row(p)).toMatchObject({
      scope_id: w.g1,
      is_personal: false,
      is_must: false,
      folder_id: f,
      position: 40,
      owner_member_id: w.mem1.id,
      current_version: 1,
      updated_by: w.mgr1.id,
    });
    const vs = (
      await h.admin.query("select kind, deleted_at from knowledge_page_versions where page_id = $1 order by version", [
        p,
      ])
    ).rows as { kind: string; deleted_at: string | null }[];
    expect(vs[0]).toMatchObject({ kind: "published", deleted_at: null });
    expect(vs[1]!.deleted_at).not.toBeNull();
    expect(await requestRow(h, rid)).toMatchObject({ state: "pending" });
    const gp = await grp(w.g2, w.mgr2, { title: "会社へ" });
    const rid2 = await seedRequest(h, w, { page: gp, fromScope: w.g2, toScope: w.co.rootScope, by: w.mgr2 });
    await h.admin.query("select app.kn_apply_raise($1, $2)", [rid2, w.boss.id]);
    expect(await h.row(gp)).toMatchObject({ scope_id: w.co.rootScope, is_personal: false, folder_id: null });
  });

  it("K687-DB-003 関数 kn_raise_request：頼める人は ok（state pending か approved）・書けない人は denied・書き終えていない draft・承認待ちが有る pending・会社のページ company・自分のページで先が無い group_required・先のグループが見えない no_group・承認する人がいない no_approver・見えるが別の棚のフォルダ folder_shelf・見えないフォルダ no_folder", async () => {
    const w = await world("K687 頼む関数");
    const run = (who: Person, page: string, group: string | null, folder: string | null) =>
      withTenant(
        h.pool,
        who.ctx,
        async (cl) =>
          (
            (await cl.query("select app.kn_raise_request($1, $2, $3, $4) as r", [page, group, folder, null]))
              .rows[0] as { r: Json }
          ).r,
      );
    const p = await mine(w.mem1, { title: "関数" });
    expect(await run(w.mem1, await mine(w.mem1), null, null)).toMatchObject({ ok: false, reason: "group_required" });
    expect(await run(w.mem1, await mine(w.mem1), w.g2, null)).toMatchObject({ ok: false, reason: "no_group" });
    expect(await run(w.mem3, await mine(w.mem3), w.g3, null)).toMatchObject({ ok: false, reason: "no_approver" });
    const fCompany = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "全社" });
    const fOther = await h.folder({ scope: w.g2, owner: w.mgr2, name: "開発" });
    expect(await run(w.mem1, await mine(w.mem1), w.g1, fCompany)).toMatchObject({ ok: false, reason: "folder_shelf" });
    expect(await run(w.mem1, await mine(w.mem1), w.g1, fOther)).toMatchObject({ ok: false, reason: "no_folder" });
    expect(await run(w.mem1, await mine(w.mem1, { state: "draft" }), w.g1, null)).toMatchObject({
      ok: false,
      reason: "draft",
    });
    expect(await run(w.mem1, await grp(w.g1, w.mgr1), null, null)).toMatchObject({ ok: false, reason: "denied" });
    expect(await run(w.boss, await h.page({ scope: w.co.rootScope, owner: w.boss }), null, null)).toMatchObject({
      ok: false,
      reason: "company",
    });
    const ok = await run(w.mem1, p, w.g1, null);
    expect(ok).toMatchObject({ ok: true, state: "pending", to_name: "営業" });
    expect(await run(w.mem1, p, w.g1, null)).toMatchObject({ ok: false, reason: "pending" });
    expect(await run(w.mgr1, await mine(w.mgr1), w.g1, null)).toMatchObject({ ok: true, state: "approved" });
  });
});
