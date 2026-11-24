// K-685「「必ず守る」を付ける・外す（上限の設定の表・届いたら今付いている一覧を返す）（setKnowledgeMust）」の単体の試験（口・DB の関数・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K685-API-NNN・K685-DB-NNN（チケット 11_tickets/K-685.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   土台は knowledge.harness.ts（K-675 が運ぶ）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   帯の操作の行（K685-API-018）だけ K-677 の読む口を呼ぶ。承認待ちの頼みの行は K-687 の表に頼むのでここには無い（K-687 が受ける）。
//   製品共通の設定の行 knowledge_limits を書き換えるのは K685-API-006 だけで、finally で元（group 20）に戻す。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { bodyOf, setupKnowledge, type Person } from "./knowledge.harness.js";

const h = setupKnowledge();

interface World {
  co: { tenantId: string; rootScope: string };
  g1: string;
  g2: string;
  boss: Person;
  mgr1: Person;
  mgr1b: Person;
  mgr2: Person;
  mem1: Person;
  view1: Person;
  mem2: Person;
  none: Person;
}

const world = async (label: string): Promise<World> => {
  const co = await h.company(label);
  const g1 = await h.group(co.tenantId, co.rootScope, "営業");
  const g2 = await h.group(co.tenantId, co.rootScope, "受託開発");
  const boss = await h.person(co.tenantId, co.rootScope, { name: "管理者", role: "admin" });
  const mgr1 = await h.person(co.tenantId, g1, { name: "営業マネージャー", role: "manager" });
  const mgr1b = await h.person(co.tenantId, g1, { name: "営業のもう 1 人のマネージャー", role: "manager" });
  const mgr2 = await h.person(co.tenantId, g2, { name: "開発マネージャー", role: "manager" });
  const mem1 = await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" });
  const view1 = await h.person(co.tenantId, g1, { name: "営業閲覧", role: "viewer" });
  const mem2 = await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" });
  const none = await h.person(co.tenantId, co.rootScope, { name: "どこにも入っていない人", role: "member" });
  return { co, g1, g2, boss, mgr1, mgr1b, mgr2, mem1, view1, mem2, none };
};

type Json = Record<string, unknown>;

const setMust = async (p: Person | null, id: string, body: unknown): Promise<Response> => {
  await h.ready();
  return h.req("PUT", `/knowledge_pages/${id}/must`, { ...(p ? { headers: h.as(p) } : {}), body });
};
const on = (p: Person, id: string) => setMust(p, id, { must: true });
const off = (p: Person, id: string) => setMust(p, id, { must: false });
const readPage = async (p: Person, id: string): Promise<Json> => {
  await h.ready();
  const r = await h.req("GET", `/knowledge_pages/${id}`, { headers: h.as(p) });
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const prow = async (id: string): Promise<Record<string, unknown> | undefined> => h.row(id);
const num = async (sql: string, p: unknown[]): Promise<number> =>
  Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const audits = async (w: World, action: string) =>
  (
    await h.admin.query(
      "select actor_member_id, target_type, target_id, choke_point_id, payload from audit_events where tenant_id = $1 and action = $2 order by occurred_at",
      [w.co.tenantId, action],
    )
  ).rows as {
    actor_member_id: string;
    target_type: string;
    target_id: string;
    choke_point_id: string;
    payload: unknown;
  }[];
const allAudits = (w: World) => num("select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId]);
const mustCount = (w: World, scope: string, personal = false, owner?: Person) =>
  num(
    "select count(*) as n from knowledge_pages where tenant_id = $1 and scope_id = $2 and is_personal = $3 and is_must and deleted_at is null and ($4::uuid is null or owner_member_id = $4)",
    [w.co.tenantId, scope, personal, owner?.id ?? null],
  );

/** 必ず守るが付いた公開済みページを n 個入れる（行の守りの外）。題名は「<prefix> 01」… */
const seedMust = async (
  scope: string,
  owner: Person,
  n: number,
  o: { personal?: boolean; prefix?: string; folder?: string | null } = {},
): Promise<string[]> => {
  const ids: string[] = [];
  for (let i = 1; i <= n; i++)
    ids.push(
      await h.page({
        scope,
        owner,
        personal: o.personal ?? false,
        must: true,
        title: `${o.prefix ?? "必須"} ${String(i).padStart(2, "0")}`,
        folder: o.folder ?? null,
      }),
    );
  return ids;
};
const fresh = (scope: string, owner: Person, o: { personal?: boolean; text?: string; title?: string } = {}) =>
  h.page({
    scope,
    owner,
    personal: o.personal ?? false,
    title: o.title ?? "付ける前",
    ...(o.text === undefined ? {} : { text: o.text }),
  });

const breakWrites = async (table: string, tenantId: string): Promise<() => Promise<void>> => {
  const fn = `test_break_${randomUUID().slice(0, 8)}`;
  await h.admin.query(
    `create function ${fn}() returns trigger language plpgsql as $$ begin raise exception '試験で壊した' using errcode = 'XX000'; end $$`,
  );
  await h.admin.query(
    `create trigger ${fn} before insert or update on ${table} for each row when (new.tenant_id = '${tenantId}') execute function ${fn}()`,
  );
  return async () => {
    await h.admin.query(`drop trigger if exists ${fn} on ${table}`);
    await h.admin.query(`drop function if exists ${fn}()`);
  };
};

describe("K-685 必ず守るを付ける・外す", () => {
  it("K685-API-001 付ける（3 つの棚）：200 { id, must true, used, limit }（鍵はちょうど 4・上限は会社 30・グループ 20・自分 10）。DB の is_must が true で、題名・本文・版の数・フォルダ・並びは変わらない", async () => {
    const w = await world("K685 付ける");
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const shelves: [string, Person, string, boolean, number][] = [
      ["company", w.boss, w.co.rootScope, false, 30],
      ["group", w.mgr1, w.g1, false, 20],
      ["me", w.view1, w.view1.scopeId, true, 10],
    ];
    for (const [shelf, who, scope, personal, limit] of shelves) {
      const id = await h.page({
        scope,
        owner: who,
        personal,
        title: "付ける",
        summary: "説明",
        text: "本文",
        folder: shelf === "group" ? folder : null,
        position: 30,
      });
      const before = await prow(id);
      const r = await on(who, id);
      expect(r.status, shelf).toBe(200);
      const d = (await h.json(r)).data as Json;
      expect(Object.keys(d).sort(), shelf).toEqual(["id", "limit", "must", "used"]);
      expect(d, shelf).toEqual({ id, must: true, used: 1, limit });
      const after = await prow(id);
      expect(after, shelf).toMatchObject({ is_must: true, title: "付ける", summary: "説明", position: 30 });
      for (const k of ["current_version", "folder_id", "state", "scope_id"])
        expect(after![k], `${shelf} ${k}`).toEqual(before![k]);
    }
  });

  it("K685-API-002 外す・同じ印：外すと 200・must false・used が 1 減る。すでに同じ印の呼びは 200 で何も変えない（上限に届いた棚でも付いているページへの付けるは 200）", async () => {
    const w = await world("K685 外す");
    const a = await fresh(w.g1, w.mgr1, { title: "A" });
    const b = await fresh(w.g1, w.mgr1, { title: "B" });
    expect(((await h.json(await on(w.mgr1, a))).data as Json)["used"]).toBe(1);
    expect(((await h.json(await on(w.mgr1, b))).data as Json)["used"]).toBe(2);
    const r = await off(w.mgr1, a);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ id: a, must: false, used: 1, limit: 20 });
    expect((await prow(a))!["is_must"]).toBe(false);
    const before = await allAudits(w);
    const again = await off(w.mgr1, a);
    expect(again.status).toBe(200);
    expect(((await h.json(again)).data as Json)["must"]).toBe(false);
    const same = await on(w.mgr1, b);
    expect(same.status).toBe(200);
    expect((await h.json(same)).data).toEqual({ id: b, must: true, used: 1, limit: 20 });
    expect(await allAudits(w)).toBe(before);
    expect(await prow(b)).toMatchObject({ is_must: true });
  });

  it("K685-API-003 数え方：会社 2・営業 3・受託開発 1・管理者の自分 1 が付いているとき、新しく付けた used は会社 3・営業 4・受託開発 2・自分 2。消したページは数えない", async () => {
    const w = await world("K685 数え方");
    await seedMust(w.co.rootScope, w.boss, 2, { prefix: "会社" });
    const g1ids = await seedMust(w.g1, w.mgr1, 3, { prefix: "営業" });
    await seedMust(w.g2, w.mem2, 1, { prefix: "開発" });
    await seedMust(w.boss.scopeId, w.boss, 1, { personal: true, prefix: "自分" });
    const used = async (p: Person, scope: string, personal = false) => {
      const id = await fresh(scope, p, { personal });
      const r = await on(p, id);
      expect(r.status).toBe(200);
      return ((await h.json(r)).data as Json)["used"];
    };
    expect(await used(w.boss, w.co.rootScope)).toBe(3);
    expect(await used(w.mgr1, w.g1)).toBe(4);
    expect(await used(w.mgr2, w.g2)).toBe(2);
    expect(await used(w.boss, w.boss.scopeId, true)).toBe(2);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [g1ids[0]]);
    expect(await used(w.mgr1, w.g1)).toBe(4);
  });

  it("K685-API-004 上限に届いた（グループ）：20 件付いている営業の 21 件目は 409 E-KNW-060・体は error・code・detail の 3 欄・detail は shelf_name・limit・pages（20 件・題名の順・各 id・title・folder）。印は付かず証跡も増えない。1 件外すと付けられる", async () => {
    const w = await world("K685 上限");
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "経理" });
    const seeded = await seedMust(w.g1, w.mgr1, 17);
    const inFolder = await seedMust(w.g1, w.mgr1, 3, { prefix: "必須 経理", folder });
    const target = await fresh(w.g1, w.mgr1, { title: "21 件目" });
    const before = await allAudits(w);
    const r = await on(w.mgr1, target);
    expect(r.status).toBe(409);
    const body = (await r.json()) as { error: string; code: string; detail: Json };
    expect(Object.keys(body).sort()).toEqual(["code", "detail", "error"]);
    expect(body).toMatchObject({ error: "conflict", code: "E-KNW-060" });
    expect(Object.keys(body.detail).sort()).toEqual(["limit", "pages", "shelf_name"]);
    expect(body.detail).toMatchObject({ shelf_name: "営業", limit: 20 });
    const pages = body.detail["pages"] as { id: string; title: string; folder: string }[];
    expect(pages.length).toBe(20);
    expect(pages.map((x) => x.id).sort()).toEqual([...seeded, ...inFolder].sort());
    expect(pages.map((x) => x.title)).toEqual([...pages.map((x) => x.title)].sort());
    for (const x of pages) {
      expect(Object.keys(x).sort()).toEqual(["folder", "id", "title"]);
      expect(x.folder).toBe(inFolder.includes(x.id) ? "経理" : "");
    }
    expect((await prow(target))!["is_must"]).toBe(false);
    expect(await allAudits(w)).toBe(before);
    expect((await off(w.mgr1, seeded[0]!)).status).toBe(200);
    const ok = await on(w.mgr1, target);
    expect(ok.status).toBe(200);
    expect(((await h.json(ok)).data as Json)["used"]).toBe(20);
  });

  it("K685-API-005 上限は棚ごと・グループごと・本人ごと：営業が満杯でも受託開発は付けられる。会社は 31 件目・自分の棚は 11 件目が 409（shelf_name・limit つき・pages は本人の物だけ）。別の人の自分の棚は影響しない", async () => {
    const w = await world("K685 棚ごと");
    await seedMust(w.g1, w.mgr1, 20);
    const dev = await fresh(w.g2, w.mgr2);
    expect(((await h.json(await on(w.mgr2, dev))).data as Json)["used"]).toBe(1);
    const companyIds = await seedMust(w.co.rootScope, w.boss, 30, { prefix: "会社" });
    const c31 = await fresh(w.co.rootScope, w.boss);
    const rc = await on(w.boss, c31);
    expect(rc.status).toBe(409);
    const bc = (await rc.json()) as { code: string; detail: { shelf_name: string; limit: number; pages: unknown[] } };
    expect(bc.code).toBe("E-KNW-060");
    expect(bc.detail).toMatchObject({ shelf_name: "会社", limit: 30 });
    expect(bc.detail.pages.length).toBe(30);
    expect(companyIds.length).toBe(30);
    const mine = await seedMust(w.boss.scopeId, w.boss, 10, { personal: true, prefix: "自分" });
    const m11 = await fresh(w.boss.scopeId, w.boss, { personal: true });
    const rm = await on(w.boss, m11);
    expect(rm.status).toBe(409);
    const bm = (await rm.json()) as { detail: { shelf_name: string; limit: number; pages: { id: string }[] } };
    expect(bm.detail).toMatchObject({ shelf_name: "自分", limit: 10 });
    expect(bm.detail.pages.map((x) => x.id).sort()).toEqual([...mine].sort());
    const theirs = await fresh(w.mem1.scopeId, w.mem1, { personal: true });
    const rt = await on(w.mem1, theirs);
    expect(rt.status).toBe(200);
    expect(((await h.json(rt)).data as Json)["used"]).toBe(1);
  });

  it("K685-API-006 設定の行を直すと次の呼びから効く：group の行を 2 に直すと 3 件目が 409（limit 2）・戻すと付けられる。5 件付いている棚で 2 に下げても、付いているページは外れず・外すは通り・新しく付けるだけ 409", async () => {
    const w = await world("K685 設定を直す");
    try {
      await h.admin.query("update knowledge_limits set must_max = 2 where shelf = 'group'");
      await seedMust(w.g1, w.mgr1, 2);
      const third = await fresh(w.g1, w.mgr1);
      const r = await on(w.mgr1, third);
      expect(r.status).toBe(409);
      expect(((await r.json()) as { detail: Json }).detail).toMatchObject({ limit: 2 });
      await h.admin.query("update knowledge_limits set must_max = 20 where shelf = 'group'");
      expect((await on(w.mgr1, third)).status).toBe(200);
      await seedMust(w.g1, w.mgr1, 2, { prefix: "追加" });
      expect(await mustCount(w, w.g1)).toBe(5);
      await h.admin.query("update knowledge_limits set must_max = 2 where shelf = 'group'");
      expect(await mustCount(w, w.g1)).toBe(5);
      const down = await off(w.mgr1, third);
      expect(down.status).toBe(200);
      expect(((await h.json(down)).data as Json)["limit"]).toBe(2);
      const fresh2 = await fresh(w.g1, w.mgr1);
      expect((await on(w.mgr1, fresh2)).status).toBe(409);
      expect(await mustCount(w, w.g1)).toBe(4);
    } finally {
      await h.admin.query("update knowledge_limits set must_max = 20 where shelf = 'group'");
    }
  });

  it("K685-API-007 本文が長いと付けられない：公開済みの最新の版が 2,001 字は 409 E-KNW-061（体は error と code だけ）。2,000 字・絵文字 2,000 字は 200・絵文字 2,001 字は 409。下書きの版が長くても公開の本文が短ければ 200。字数の判定が上限の判定より先", async () => {
    const w = await world("K685 字数");
    const run = async (text: string) => on(w.mgr1, await fresh(w.g1, w.mgr1, { text }));
    const long = await run("あ".repeat(2001));
    expect(long.status).toBe(409);
    expect(await long.json()).toEqual({ error: "conflict", code: "E-KNW-061" });
    expect((await run("あ".repeat(2000))).status).toBe(200);
    expect((await run("😀".repeat(2000))).status).toBe(200);
    expect((await run("😀".repeat(2001))).status).toBe(409);
    const withDraft = await fresh(w.g1, w.mgr1, { text: "短い公開の本文" });
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 2, 'draft', $3::jsonb, $4)",
      [w.co.tenantId, withDraft, JSON.stringify(bodyOf("あ".repeat(3000))), w.mgr1.id],
    );
    expect((await on(w.mgr1, withDraft)).status).toBe(200);
    await seedMust(w.boss.scopeId, w.boss, 10, { personal: true, prefix: "自分" });
    const both = await on(w.boss, await fresh(w.boss.scopeId, w.boss, { personal: true, text: "あ".repeat(2001) }));
    expect(both.status).toBe(409);
    expect(await both.json()).toEqual({ error: "conflict", code: "E-KNW-061" });
  });

  it("K685-API-008 まだ書き終えていないページ：持ち主でも付ける・外すとも 409 E-KNW-010（体は error と code だけ）・何も変わらない", async () => {
    const w = await world("K685 書きかけ");
    const id = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "書きかけ" });
    for (const must of [true, false]) {
      const r = await setMust(w.mgr1, id, { must });
      expect(r.status, String(must)).toBe(409);
      expect(await r.json()).toEqual({ error: "conflict", code: "E-KNW-010" });
    }
    expect((await prow(id))!["is_must"]).toBe(false);
  });

  it('K685-API-009 入力の形が合わない：must が無い・文字の "true"・null・数・知らない欄が付いた体は 422 で何も変わらない', async () => {
    const w = await world("K685 入力");
    const id = await fresh(w.g1, w.mgr1);
    for (const bad of [{}, { must: "true" }, { must: null }, { must: 1 }, { must: true, extra: 1 }]) {
      expect((await setMust(w.mgr1, id, bad)).status, JSON.stringify(bad)).toBe(422);
    }
    expect((await prow(id))!["is_must"]).toBe(false);
  });

  it("K685-API-010 付け外し：書けない人は 403・見えない人と無い・消した id は 404（体は error と code だけ）。印は変わらない", async () => {
    const w = await world("K685 付けられない");
    const other = await world("K685 付けられない（別の会社）");
    const g1p = await fresh(w.g1, w.mgr1);
    const companyP = await fresh(w.co.rootScope, w.boss);
    const mine = await fresh(w.mem1.scopeId, w.mem1, { personal: true });
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "書きかけ" });
    const gone = await fresh(w.g1, w.mgr1);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const cases: [Person, string, number][] = [
      [w.mem1, g1p, 403],
      [w.view1, g1p, 403],
      [w.mgr1, companyP, 403],
      [w.mem1, companyP, 403],
      [w.mem2, g1p, 404],
      [w.boss, g1p, 404],
      [w.none, g1p, 404],
      [w.boss, mine, 404],
      [w.mgr1, mine, 404],
      [w.mgr1b, draft, 404],
      [w.mgr1, gone, 404],
      [w.mgr1, randomUUID(), 404],
      [other.boss, g1p, 404],
    ];
    for (const [p, id, status] of cases) {
      for (const must of [true, false]) {
        const r = await setMust(p, id, { must });
        expect(r.status, `${p.id} ${id} ${must}`).toBe(status);
        if (status === 404) expect(Object.keys((await r.json()) as Json).sort()).toEqual(["code", "error"]);
      }
    }
    for (const id of [g1p, companyP, mine, draft]) expect((await prow(id))!["is_must"], id).toBe(false);
  });

  it("K685-API-011 ログインしていない要求は 401", async () => {
    expect((await setMust(null, randomUUID(), { must: true })).status).toBe(401);
  });

  it("K685-API-012 上限を超えると 429（1 分 60 回の上限を 2 に差し替えた口の 3 回目）", async () => {
    const w = await world("K685 呼べる回数");
    const id = await fresh(w.g1, w.mgr1);
    h.limits["setKnowledgeMust"] = 2;
    try {
      expect((await on(w.mgr1, id)).status).toBe(200);
      expect((await off(w.mgr1, id)).status).toBe(200);
      const r = await on(w.mgr1, id);
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["setKnowledgeMust"];
    }
  });

  it("K685-API-013 権限を外した直後・抜けた直後・付けた直後：入り直さなくても次の操作から効く。書けた間に付けた印は残る", async () => {
    const w = await world("K685 波及");
    const a = await fresh(w.g1, w.mgr1, { title: "A" });
    const b = await fresh(w.g1, w.mgr1, { title: "B" });
    expect((await on(w.mgr1, a)).status).toBe(200);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    expect((await on(w.mgr1, b)).status).toBe(403);
    expect((await off(w.mgr1, a)).status).toBe(403);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mgr1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mgr1.id, w.co.rootScope]);
    expect((await on(w.mgr1, b)).status).toBe(404);
    expect((await on(w.view1, b)).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.view1.id,
      w.g1,
    ]);
    expect((await on(w.view1, b)).status).toBe(200);
    expect((await prow(a))!["is_must"]).toBe(true);
  });

  it("K685-API-014 同時に付ける：営業に 19 件付いているとき、別々のページに同時に付けると 1 つが 200・もう 1 つが 409 E-KNW-060・付いている数は 20 のまま。同じページに同時に付けると両方 200・証跡は 1 行", async () => {
    const w = await world("K685 同時");
    await seedMust(w.g1, w.mgr1, 19);
    const p1 = await fresh(w.g1, w.mgr1, { title: "同時 1" });
    const p2 = await fresh(w.g1, w.mgr1b, { title: "同時 2" });
    await h.ready();
    const rs = await Promise.all([on(w.mgr1, p1), on(w.mgr1b, p2)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const lost = rs.find((r) => r.status === 409)!;
    expect(((await lost.json()) as { code: string }).code).toBe("E-KNW-060");
    expect(await mustCount(w, w.g1)).toBe(20);
    const q = await fresh(w.g2, w.mgr2, { title: "同じページ" });
    const same = await Promise.all([on(w.mgr2, q), on(w.mgr2, q)]);
    expect(same.map((r) => r.status)).toEqual([200, 200]);
    expect((await audits(w, "knowledge.must.on")).filter((x) => x.target_id === q).length).toBe(1);
  });

  it("K685-API-015 証跡：付けると knowledge.must.on・外すと knowledge.must.off が 1 行ずつ（操作した人・対象のページ・種類 knowledge_pages・関門 C2・payload は空）。同じ印の呼び・上限や字数で断った操作・403・404 には残らず、題名を入れない", async () => {
    const w = await world("K685 証跡");
    const id = await fresh(w.g1, w.mgr1, { title: "秘密の題名" });
    await off(w.mgr1, id);
    await on(w.mem1, id);
    await on(w.mgr1, randomUUID());
    const long = await fresh(w.g1, w.mgr1, { text: "あ".repeat(2001) });
    await on(w.mgr1, long);
    expect((await audits(w, "knowledge.must.on")).length).toBe(0);
    expect((await on(w.mgr1, id)).status).toBe(200);
    await on(w.mgr1, id);
    expect((await off(w.mgr1, id)).status).toBe(200);
    for (const action of ["knowledge.must.on", "knowledge.must.off"]) {
      const rows = await audits(w, action);
      expect(rows.length, action).toBe(1);
      expect(rows[0], action).toMatchObject({
        actor_member_id: w.mgr1.id,
        target_type: "knowledge_pages",
        target_id: id,
        choke_point_id: "C2",
      });
      expect(rows[0]!.payload, action).toEqual({});
      expect(JSON.stringify(rows[0]!.payload), action).not.toContain("秘密の");
    }
  });

  it("K685-API-016 失敗（手順 1）：ページを書く所で DB が落ちると 503 E-PAGE-003・印は前のまま・ログに題名を出さない", async () => {
    const w = await world("K685 失敗 1");
    const id = await fresh(w.g1, w.mgr1, { title: "秘密の題名" });
    await h.ready();
    const fix = await breakWrites("knowledge_pages", w.co.tenantId);
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        const r = await on(w.mgr1, id);
        expect(r.status).toBe(503);
        expect(((await r.json()) as Json)["code"]).toBe("E-PAGE-003");
      });
    } finally {
      await fix();
    }
    expect((await prow(id))!["is_must"]).toBe(false);
    expect(logs).not.toContain("秘密の");
  });

  it("K685-API-017 失敗（手順 2）：証跡を書く所で DB が落ちると 503 E-PAGE-003・同じ取引なので印も戻り・証跡の数も変わらない。そのあとの付ける呼びは通る（錠が残らない）", async () => {
    const w = await world("K685 失敗 2");
    const id = await fresh(w.g1, w.mgr1);
    const before = await allAudits(w);
    await h.ready();
    const fix = await breakWrites("audit_events", w.co.tenantId);
    try {
      expect((await on(w.mgr1, id)).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await prow(id))!["is_must"]).toBe(false);
    expect(await allAudits(w)).toBe(before);
    expect((await on(w.mgr1, id)).status).toBe(200);
  });

  it("K685-API-018 ページを読むと操作が出る：書ける人の acts に must-on（印が無いとき）・must-off（付いているとき）が入り、読むだけの人・まだ書き終えていない持ち主のページには入らない。2,001 字で付けられないページは must_blocked が too_long のまま must-on が入る", async () => {
    const w = await world("K685 帯の操作");
    const plain = await fresh(w.g1, w.mgr1, { title: "印なし" });
    const marked = await h.page({ scope: w.g1, owner: w.mgr1, title: "印あり", must: true });
    const company = await fresh(w.co.rootScope, w.boss);
    const mine = await fresh(w.mem1.scopeId, w.mem1, { personal: true });
    const draft = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      state: "draft",
      title: "下書き",
    });
    const long = await fresh(w.g1, w.mgr1, { text: "あ".repeat(2001), title: "長い" });
    const acts = async (p: Person, id: string) => (await readPage(p, id))["acts"] as string[];
    for (const p of [w.mgr1, w.mgr1b]) {
      expect(await acts(p, plain), p.id).toContain("must-on");
      expect(await acts(p, plain), p.id).not.toContain("must-off");
      expect(await acts(p, marked), p.id).toContain("must-off");
      expect(await acts(p, marked), p.id).not.toContain("must-on");
    }
    expect(await acts(w.boss, company)).toContain("must-on");
    expect(await acts(w.mem1, mine)).toContain("must-on");
    for (const p of [w.mem1, w.view1]) {
      for (const id of [plain, marked]) {
        const a = await acts(p, id);
        expect(a, `${p.id} ${id}`).not.toContain("must-on");
        expect(a, `${p.id} ${id}`).not.toContain("must-off");
      }
    }
    expect(await acts(w.mem1, draft)).not.toContain("must-on");
    const blocked = await readPage(w.mgr1, long);
    expect(blocked["must_blocked"]).toBe("too_long");
    expect(blocked["acts"]).toContain("must-on");
  });

  it("K685-DB-001 設定の表と 3 行・権限：knowledge_limits は company 30・group 20・me 10 の 3 行だけ。ログイン済みの接続は読め、書こうとする（insert・update・delete）は断られる。棚の名前が違う行・must_max が負の行は check で入らず、同じ棚の行は一意で重ねられない", async () => {
    const w = await world("K685 設定の表");
    const rows = (await h.admin.query("select shelf, must_max from knowledge_limits order by shelf")).rows;
    expect(rows).toEqual([
      { shelf: "company", must_max: 30 },
      { shelf: "group", must_max: 20 },
      { shelf: "me", must_max: 10 },
    ]);
    const read = await withTenant(
      h.pool,
      w.mem1.ctx,
      async (cl) => (await cl.query("select shelf, must_max from knowledge_limits order by shelf")).rows,
    );
    expect(read).toEqual(rows);
    for (const sql of [
      "insert into knowledge_limits (shelf, must_max) values ('company', 1)",
      "update knowledge_limits set must_max = 1",
      "delete from knowledge_limits",
    ]) {
      await expect(
        withTenant(h.pool, w.boss.ctx, (cl) => cl.query(sql)),
        sql,
      ).rejects.toThrow();
    }
    for (const [sql, code] of [
      ["insert into knowledge_limits (shelf, must_max) values ('team', 1)", "23514"],
      ["insert into knowledge_limits (shelf, must_max) values ('me', -1)", "23514"],
      ["insert into knowledge_limits (shelf, must_max) values ('me', 5)", "23505"],
    ] as [string, string][]) {
      await expect(h.admin.query(sql), sql).rejects.toMatchObject({ code });
    }
    expect((await h.admin.query("select count(*)::int as n from knowledge_limits")).rows[0]!["n"]).toBe(3);
  });

  it("K685-DB-002 関数 kn_must_set：書ける人は付ける→ ok・changed true・used・limit／同じ印→ changed false／長い本文→ too_long／書き終えていない→ draft／満杯の棚→ full（limit・shelf_name・pages つき）。書けない人は denied で印は変わらない", async () => {
    const w = await world("K685 関数");
    const call = (p: Person, id: string, must: boolean) =>
      withTenant(
        h.pool,
        p.ctx,
        async (cl) => ((await cl.query("select app.kn_must_set($1, $2) as r", [id, must])).rows[0] as { r: Json }).r,
      );
    const ok = await fresh(w.co.rootScope, w.boss);
    expect(await call(w.boss, ok, true)).toMatchObject({ ok: true, changed: true, must: true, used: 1, limit: 30 });
    expect(await call(w.boss, ok, true)).toMatchObject({ ok: true, changed: false, must: true, used: 1 });
    expect(await call(w.boss, ok, false)).toMatchObject({ ok: true, changed: true, must: false, used: 0 });
    const long = await fresh(w.co.rootScope, w.boss, { text: "あ".repeat(2001) });
    expect(await call(w.boss, long, true)).toMatchObject({ ok: false, reason: "too_long" });
    const draft = await h.page({ scope: w.co.rootScope, owner: w.boss, state: "draft", title: "書きかけ" });
    expect(await call(w.boss, draft, true)).toMatchObject({ ok: false, reason: "draft" });
    const mine = await seedMust(w.boss.scopeId, w.boss, 10, { personal: true, prefix: "自分" });
    const eleventh = await fresh(w.boss.scopeId, w.boss, { personal: true });
    const full = await call(w.boss, eleventh, true);
    expect(full).toMatchObject({ ok: false, reason: "full", limit: 10, shelf_name: "自分" });
    expect((full["pages"] as { id: string }[]).map((x) => x.id).sort()).toEqual([...mine].sort());
    const g1p = await fresh(w.g1, w.mgr1);
    expect(await call(w.mem1, g1p, true)).toMatchObject({ ok: false, reason: "denied" });
    expect((await prow(g1p))!["is_must"]).toBe(false);
  });

  it("K685-DB-003 関数 kn_must_limit：company は 30・group は 20・me は 10・知らない棚の種類は null", async () => {
    const got = (
      await h.admin.query(
        "select app.kn_must_limit('company') as c, app.kn_must_limit('group') as g, app.kn_must_limit('me') as m, app.kn_must_limit('team') as t",
      )
    ).rows[0];
    expect(got).toEqual({ c: 30, g: 20, m: 10, t: null });
  });
});
