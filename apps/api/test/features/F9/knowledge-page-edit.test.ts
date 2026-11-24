// K-681「ページを別のフォルダへ動かす・消す（updateKnowledgePage・deleteKnowledgePage）」の単体の試験（口・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K681-API-NNN（チケット 11_tickets/K-681.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   土台は knowledge.harness.ts（K-675 が運ぶ）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   頼み・共有の表は後ろの葉（K-687・K-689）が作るので、承認待ち・共有中の行はここでは作れない（その葉が自分の試験で受ける）。
//   書いた結果は別の読み（DB の行・見える人の接続）で確かめる（この葉は読む口 K-677 に頼らない）。
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
  const mem1 = await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" });
  const view1 = await h.person(co.tenantId, g1, { name: "営業閲覧", role: "viewer" });
  const mem2 = await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" });
  const none = await h.person(co.tenantId, co.rootScope, { name: "どこにも入っていない人", role: "member" });
  return { co, g1, g2, boss, mgr1, mgr1b, mem1, view1, mem2, none };
};

type Json = Record<string, unknown>;

const move = async (p: Person | null, id: string, body: unknown): Promise<Response> => {
  await h.ready();
  return h.req("PATCH", `/knowledge_pages/${id}`, { ...(p ? { headers: h.as(p) } : {}), body });
};
const del = async (p: Person | null, id: string): Promise<Response> => {
  await h.ready();
  return h.req("DELETE", `/knowledge_pages/${id}`, p ? { headers: h.as(p) } : {});
};
const prow = async (id: string): Promise<Record<string, unknown> | undefined> => h.row(id);
const versions = async (id: string, kind?: string): Promise<Record<string, unknown>[]> =>
  (
    await h.admin.query(
      "select * from knowledge_page_versions where page_id = $1 and ($2::text is null or kind = $2) order by version, created_at",
      [id, kind ?? null],
    )
  ).rows;
const liveDrafts = async (id: string) => (await versions(id, "draft")).filter((v) => v["deleted_at"] === null);
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
const visibleTo = (p: Person, id: string) =>
  withTenant(h.pool, p.ctx, async (cl) =>
    Number(
      (await cl.query<{ n: number }>("select count(*)::int as n from knowledge_pages where id = $1", [id])).rows[0]!.n,
    ),
  );

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

const addDraft = (w: World, page: string, version: number, text: string, by: Person) =>
  h.admin.query(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, $3, 'draft', $4::jsonb, $5)",
    [w.co.tenantId, page, version, JSON.stringify(bodyOf(text)), by.id],
  );

describe("K-681 ページを動かす・消す", () => {
  it("K681-API-001 動かす（3 つの棚）：同じ棚のフォルダへ動かして 200。答えの鍵はちょうど 6・place が動かした先。DB は folder_id が変わり、並びは動かした先の最後。題名・説明・必ず守る・版の数・本文は変わらない", async () => {
    const w = await world("K681 動かす");
    const shelves: [string, Person, string, boolean][] = [
      ["company", w.boss, w.co.rootScope, false],
      ["group", w.mgr1, w.g1, false],
      ["me", w.view1, w.view1.scopeId, true],
    ];
    for (const [shelf, who, scope, personal] of shelves) {
      const f1 = await h.folder({ scope, owner: who, name: "経理", personal });
      const f2 = await h.folder({ scope, owner: who, name: "請求", parent: f1, personal });
      await h.page({ scope, owner: who, personal, title: "先にいる", folder: f2, position: 10 });
      const id = await h.page({ scope, owner: who, personal, title: "動かす", summary: "説明", text: "本文" });
      const before = await prow(id);
      const r = await move(who, id, { folder_id: f2 });
      expect(r.status, shelf).toBe(200);
      const d = (await h.json(r)).data as Json;
      expect(Object.keys(d).sort(), shelf).toEqual(["desc", "id", "must", "place", "state", "title"]);
      expect(d["place"], shelf).toMatchObject({ shelf, folder_id: f2, folders: ["経理", "請求"] });
      const after = await prow(id);
      expect(after, shelf).toMatchObject({ folder_id: f2, position: 20, title: "動かす", summary: "説明" });
      for (const k of ["current_version", "is_must", "state", "scope_id", "owner_member_id"])
        expect(after![k], `${shelf} ${k}`).toEqual(before![k]);
      expect((await versions(id, "published"))[0]!["body"], shelf).toEqual(bodyOf("本文"));
    }
  });

  it("K681-API-002 棚の直下へ・並びだけを変える：null で棚の直下（folders が空）・position だけならフォルダは変わらない（0 も通る）・両方送れば position はその値のまま", async () => {
    const w = await world("K681 直下と並び");
    const f = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const g = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "請求" });
    const id = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "ページ", folder: f, position: 10 });
    const up = await move(w.boss, id, { folder_id: null });
    expect(up.status).toBe(200);
    expect(((await h.json(up)).data as Json)["place"]).toMatchObject({ folder_id: null, folders: [] });
    expect((await prow(id))!["folder_id"]).toBeNull();
    await move(w.boss, id, { folder_id: f });
    const only = await move(w.boss, id, { position: 0 });
    expect(only.status).toBe(200);
    expect(await prow(id)).toMatchObject({ folder_id: f, position: 0 });
    expect((await move(w.boss, id, { position: 75 })).status).toBe(200);
    expect(await prow(id)).toMatchObject({ folder_id: f, position: 75 });
    expect((await move(w.boss, id, { folder_id: g, position: 5 })).status).toBe(200);
    expect(await prow(id)).toMatchObject({ folder_id: g, position: 5 });
  });

  it("K681-API-003 動かした先の並び：10・20 の先へは 30・空のフォルダへは 10。消したページは最大に数えない", async () => {
    const w = await world("K681 並び");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const empty = await h.folder({ scope: w.g1, owner: w.mgr1, name: "空" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "A", folder: f, position: 10 });
    const b = await h.page({ scope: w.g1, owner: w.mgr1, title: "B", folder: f, position: 20 });
    const mover = await h.page({ scope: w.g1, owner: w.mgr1, title: "動かす", position: 40 });
    const mover2 = await h.page({ scope: w.g1, owner: w.mgr1, title: "動かす 2", position: 50 });
    await move(w.mgr1, mover, { folder_id: f });
    expect((await prow(mover))!["position"]).toBe(30);
    await move(w.mgr1, mover2, { folder_id: empty });
    expect((await prow(mover2))!["position"]).toBe(10);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id in ($1, $2)", [b, mover]);
    const mover3 = await h.page({ scope: w.g1, owner: w.mgr1, title: "動かす 3", position: 60 });
    await move(w.mgr1, mover3, { folder_id: f });
    expect((await prow(mover3))!["position"]).toBe(20);
  });

  it("K681-API-004 何も変わらない動かし：今と同じフォルダ・今と同じ並びを送ると 200・DB は変わらず・証跡も増えない", async () => {
    const w = await world("K681 同じ");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "そのまま", folder: f, position: 10 });
    const before = await allAudits(w);
    const rowBefore = await prow(id);
    for (const body of [{ folder_id: f }, { position: 10 }, { folder_id: f, position: 10 }]) {
      expect((await move(w.mgr1, id, body)).status, JSON.stringify(body)).toBe(200);
    }
    expect(await allAudits(w)).toBe(before);
    expect(await prow(id)).toEqual(rowBefore);
  });

  it("K681-API-005 動かしても動かない物：題名・説明・本文・版の数・必ず守る・写しの元・持ち主・公開の版・下書きの版は書く前のまま。下書き中のページも動かせて下書きの版は残る", async () => {
    const w = await world("K681 動かない物");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const origin = await h.page({ scope: w.g1, owner: w.mgr1, title: "元" });
    const id = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "守るページ",
      summary: "1 行の説明",
      must: true,
      copiedFrom: origin,
      text: "公開の本文",
    });
    await addDraft(w, id, 2, "書いている", w.mgr1b);
    const before = await prow(id);
    expect((await move(w.mgr1, id, { folder_id: f })).status).toBe(200);
    const after = await prow(id);
    for (const k of [
      "title",
      "summary",
      "is_must",
      "copied_from_page_id",
      "owner_member_id",
      "current_version",
      "state",
      "scope_id",
    ])
      expect(after![k], k).toEqual(before![k]);
    expect((await versions(id, "published"))[0]!["body"]).toEqual(bodyOf("公開の本文"));
    const dr = await liveDrafts(id);
    expect(dr.length).toBe(1);
    expect(dr[0]!["body"]).toEqual(bodyOf("書いている"));
  });

  it("K681-API-006 入力の形が合わない：体が空・folder_id が uuid でない・position が負・小数・文字・知らない欄は 422 で何も変わらない", async () => {
    const w = await world("K681 入力");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "ページ", folder: f, position: 10 });
    const before = await prow(id);
    for (const bad of [
      {},
      { folder_id: "uuid ではない" },
      { position: -1 },
      { position: 1.5 },
      { position: "10" },
      { title: "題名は動かす口で変えない" },
      { folder_id: f, extra: true },
    ]) {
      expect((await move(w.mgr1, id, bad)).status, JSON.stringify(bad)).toBe(422);
    }
    expect(await prow(id)).toEqual(before);
  });

  it("K681-API-007 見えるが別の棚のフォルダは 409 E-KNW-052（体は { error, code } だけ）：グループのページに会社のフォルダ・自分のページに会社のフォルダ・会社のページに自分のフォルダ。何も変わらない", async () => {
    const w = await world("K681 別の棚");
    const companyFolder = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "会社" });
    const g1Folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "営業" });
    const mine = await h.folder({ scope: w.boss.scopeId, owner: w.boss, name: "自分", personal: true });
    const groupPage = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const myPage = await h.page({ scope: w.mgr1.scopeId, owner: w.mgr1, personal: true, title: "自分のページ" });
    const companyPage = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    const cases: [Person, string, string][] = [
      [w.mgr1, groupPage, companyFolder],
      [w.mgr1, myPage, companyFolder],
      [w.mgr1, myPage, g1Folder],
      [w.boss, companyPage, mine],
    ];
    for (const [p, id, folder] of cases) {
      const r = await move(p, id, { folder_id: folder });
      expect(r.status, `${id} ${folder}`).toBe(409);
      expect(await r.json()).toEqual({ error: "conflict", code: "E-KNW-052" });
    }
    expect((await prow(groupPage))!["folder_id"]).toBeNull();
    expect((await prow(myPage))!["folder_id"]).toBeNull();
    expect((await prow(companyPage))!["folder_id"]).toBeNull();
  });

  it("K681-API-008 指したフォルダが無い・見えないは 404（体は { error, code } だけ）：無い id・消した・他人の自分のフォルダ・別の会社のフォルダ。何も変わらない", async () => {
    const w = await world("K681 フォルダ 404");
    const other = await world("K681 フォルダ 404（別の会社）");
    const dead = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "消した" });
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [dead]);
    const theirs = await h.folder({ scope: w.mem1.scopeId, owner: w.mem1, name: "他人", personal: true });
    const foreign = await h.folder({ scope: other.co.rootScope, owner: other.boss, name: "別の会社" });
    const id = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    for (const folder of [randomUUID(), dead, theirs, foreign]) {
      const r = await move(w.boss, id, { folder_id: folder });
      expect(r.status, folder).toBe(404);
      expect(Object.keys((await r.json()) as Json).sort()).toEqual(["code", "error"]);
    }
    expect((await prow(id))!["folder_id"]).toBeNull();
  });

  it("K681-API-009 動かす：書けない人は 403・見えない人と無い・消した id は 404（体は { error, code } だけ）。何も変わらない", async () => {
    const w = await world("K681 動かせない");
    const other = await world("K681 動かせない（別の会社）");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const g1p = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の書きかけ" });
    const gone = await h.page({ scope: w.g1, owner: w.mgr1, title: "消した" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const cases: [Person, string, number][] = [
      [w.mem1, g1p, 403],
      [w.view1, g1p, 403],
      [w.mem2, g1p, 404],
      [w.boss, g1p, 404],
      [w.boss, mine, 404],
      [w.mgr1, mine, 404],
      [w.mgr1b, draft, 404],
      [w.mgr1, gone, 404],
      [w.mgr1, randomUUID(), 404],
      [other.boss, g1p, 404],
    ];
    for (const [p, id, status] of cases) {
      const r = await move(p, id, { folder_id: f, position: 99 });
      expect(r.status, `${p.id} ${id}`).toBe(status);
      if (status === 404) expect(Object.keys((await r.json()) as Json).sort()).toEqual(["code", "error"]);
    }
    for (const id of [g1p, mine, draft]) expect(await prow(id), id).toMatchObject({ folder_id: null });
  });

  it("K681-API-010 消す：書けない人は 403・見えない人と無い・消した id は 404（体は { error, code } だけ）。ページも版も変わらない", async () => {
    const w = await world("K681 消せない");
    const other = await world("K681 消せない（別の会社）");
    const g1p = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の書きかけ" });
    const gone = await h.page({ scope: w.g1, owner: w.mgr1, title: "消した" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const cases: [Person, string, number][] = [
      [w.mem1, g1p, 403],
      [w.view1, g1p, 403],
      [w.mem2, g1p, 404],
      [w.boss, g1p, 404],
      [w.boss, mine, 404],
      [w.mgr1b, draft, 404],
      [w.mgr1, gone, 404],
      [w.mgr1, randomUUID(), 404],
      [other.boss, g1p, 404],
    ];
    for (const [p, id, status] of cases) {
      const r = await del(p, id);
      expect(r.status, `${p.id} ${id}`).toBe(status);
      if (status === 404) expect(Object.keys((await r.json()) as Json).sort()).toEqual(["code", "error"]);
    }
    for (const id of [g1p, mine, draft]) expect((await prow(id))!["deleted_at"], id).toBeNull();
    expect((await versions(g1p, "published")).length).toBe(1);
  });

  it("K681-API-011 消す（公開済み）：200 { id }・ページに消した印・見る人の接続では 0 行・公開の版は残る・同じ棚の別のページの並びは詰めない。以後の動かす・消すは 404", async () => {
    const w = await world("K681 消す");
    const keep = await h.page({ scope: w.g1, owner: w.mgr1, title: "残す", position: 20 });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "消す", position: 10, text: "公開の本文" });
    expect(await visibleTo(w.mem1, id)).toBe(1);
    const r = await del(w.mgr1, id);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ id });
    expect((await prow(id))!["deleted_at"]).not.toBeNull();
    for (const p of [w.mgr1, w.mem1, w.mgr1b]) expect(await visibleTo(p, id), p.id).toBe(0);
    const pub = await versions(id, "published");
    expect(pub.length).toBe(1);
    expect(pub[0]!["body"]).toEqual(bodyOf("公開の本文"));
    expect((await prow(keep))!["position"]).toBe(20);
    expect((await move(w.mgr1, id, { position: 1 })).status).toBe(404);
    expect((await del(w.mgr1, id)).status).toBe(404);
  });

  it("K681-API-012 必ず守るが付いていると 409 E-KNW-050（体は { error, code } だけ）で何も消えない。必ず守るを外した後は消せる", async () => {
    const w = await world("K681 必ず守る");
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "守るページ", must: true });
    const r = await del(w.mgr1, id);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "conflict", code: "E-KNW-050" });
    expect((await prow(id))!["deleted_at"]).toBeNull();
    expect((await move(w.mgr1, id, { position: 5 })).status).toBe(200);
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [id]);
    expect((await del(w.mgr1, id)).status).toBe(200);
    expect((await prow(id))!["deleted_at"]).not.toBeNull();
  });

  it("K681-API-013 消す前の守りの置き場（page-guards）：頼みも共有も無いページは、どの確かめも「当たらない」を返す。必ず守るが付いているページだけ deleteBlocker が E-KNW-050 を返し、moveBlocker は返さない", async () => {
    const w = await world("K681 守りの置き場");
    const plain = await h.page({ scope: w.g1, owner: w.mgr1, title: "ふつう" });
    const must = await h.page({ scope: w.g1, owner: w.mgr1, title: "守る", must: true });
    const guards = await import("../../../src/features/F9/knowledge/page-guards/index.js");
    const pending = await import("../../../src/features/F9/knowledge/page-guards/pending-request.js");
    const shared = await import("../../../src/features/F9/knowledge/page-guards/shared.js");
    const out = await withTenant(h.pool, w.mgr1.ctx, async (cl) => ({
      pending: await pending.hasPendingRequest(cl, plain),
      shared: await shared.isSharedOut(cl, plain),
      movePlain: await guards.moveBlocker(cl, { id: plain, is_must: false }),
      deletePlain: await guards.deleteBlocker(cl, { id: plain, is_must: false }),
      moveMust: await guards.moveBlocker(cl, { id: must, is_must: true }),
      deleteMust: await guards.deleteBlocker(cl, { id: must, is_must: true }),
    }));
    expect(out).toEqual({
      pending: false,
      shared: false,
      movePlain: null,
      deletePlain: null,
      moveMust: null,
      deleteMust: "E-KNW-050",
    });
  });

  it("K681-API-014 下書きのあるページを消す：生きている下書きの版（自分の物・ほかの人の物）にも消した印が付き、公開の版の行は本文ごと残る", async () => {
    const w = await world("K681 下書きつき");
    const own = await h.page({ scope: w.g1, owner: w.mgr1, title: "自分の下書き", text: "公開 A" });
    await addDraft(w, own, 2, "自分の下書きの本文", w.mgr1);
    const theirs = await h.page({ scope: w.g1, owner: w.mgr1, title: "ほかの人の下書き", text: "公開 B" });
    await addDraft(w, theirs, 2, "ほかの人の下書きの本文", w.mgr1b);
    expect((await del(w.mgr1, own)).status).toBe(200);
    expect((await del(w.mgr1, theirs)).status).toBe(200);
    for (const [id, text] of [
      [own, "公開 A"],
      [theirs, "公開 B"],
    ] as [string, string][]) {
      expect(await liveDrafts(id), id).toEqual([]);
      expect((await versions(id, "draft")).length, id).toBe(1);
      const pub = await versions(id, "published");
      expect(pub.length, id).toBe(1);
      expect(pub[0]!["deleted_at"], id).toBeNull();
      expect(pub[0]!["body"], id).toEqual(bodyOf(text));
    }
  });

  it("K681-API-015 まだ書き終えていないページ（持ち主の下書きだけ）：持ち主は動かせて消せる（消すと下書きの版にも消した印）。同じグループのマネージャー・管理者・メンバーは 404", async () => {
    const w = await world("K681 書きかけ");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "書きかけ" });
    await addDraft(w, id, 1, "途中", w.mgr1);
    for (const p of [w.mgr1b, w.boss, w.mem1]) {
      expect((await move(p, id, { folder_id: f })).status, p.id).toBe(404);
      expect((await del(p, id)).status, p.id).toBe(404);
    }
    expect((await move(w.mgr1, id, { folder_id: f })).status).toBe(200);
    expect(await prow(id)).toMatchObject({ folder_id: f, state: "draft" });
    expect((await del(w.mgr1, id)).status).toBe(200);
    expect((await prow(id))!["deleted_at"]).not.toBeNull();
    expect(await liveDrafts(id)).toEqual([]);
  });

  it("K681-API-016 元になっている写しがある：元のページを消しても写し（自分の棚のページ）は残り、copied_from_page_id は消えた元の id を指したまま・写しの本文は変わらない", async () => {
    const w = await world("K681 写し");
    const origin = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社の手順", text: "元の本文" });
    const copy = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      title: "会社の手順",
      text: "直した本文",
      copiedFrom: origin,
    });
    expect((await del(w.boss, origin)).status).toBe(200);
    expect(await prow(copy)).toMatchObject({ deleted_at: null, copied_from_page_id: origin, state: "published" });
    expect((await versions(copy, "published"))[0]!["body"]).toEqual(bodyOf("直した本文"));
    expect(await visibleTo(w.mem1, copy)).toBe(1);
    expect(await visibleTo(w.mem1, origin)).toBe(0);
  });

  it("K681-API-017 グループの棚は誰が書いても同じ：営業のもう 1 人のマネージャーも、ほかのマネージャーが作ったページを動かせて消せる。メンバー・閲覧のみは 403。自分の棚のページは本人以外 404（管理者でも）", async () => {
    const w = await world("K681 だれでも");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    expect((await move(w.mgr1b, id, { folder_id: f })).status).toBe(200);
    expect((await prow(id))!["folder_id"]).toBe(f);
    expect((await move(w.mem1, id, { position: 1 })).status).toBe(403);
    expect((await del(w.view1, id)).status).toBe(403);
    expect((await del(w.mgr1b, id)).status).toBe(200);
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    expect((await move(w.boss, mine, { position: 1 })).status).toBe(404);
    expect((await del(w.boss, mine)).status).toBe(404);
    expect((await del(w.mem1, mine)).status).toBe(200);
  });

  it("K681-API-018 ログインしていない要求は動かす・消すとも 401", async () => {
    const id = randomUUID();
    expect((await move(null, id, { position: 1 })).status).toBe(401);
    expect((await del(null, id)).status).toBe(401);
  });

  it("K681-API-019 上限を超えると 429（1 分 60 回の上限を 2 に差し替えた動かす・消すそれぞれの 3 回目）", async () => {
    const w = await world("K681 上限");
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "ページ", position: 10 });
    h.limits["updateKnowledgePage"] = 2;
    h.limits["deleteKnowledgePage"] = 2;
    try {
      expect((await move(w.mgr1, id, { position: 20 })).status).toBe(200);
      expect((await move(w.mgr1, id, { position: 30 })).status).toBe(200);
      const m = await move(w.mgr1, id, { position: 40 });
      expect(m.status).toBe(429);
      const sec = (await h.json(m))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
      expect((await del(w.mgr1, randomUUID())).status).toBe(404);
      expect((await del(w.mgr1, randomUUID())).status).toBe(404);
      expect((await del(w.mgr1, id)).status).toBe(429);
    } finally {
      delete h.limits["updateKnowledgePage"];
      delete h.limits["deleteKnowledgePage"];
    }
  });

  it("K681-API-020 権限を外した直後・抜けた直後・付けた直後：入り直さなくても次の操作から効く。書けた間に動かした結果は残る", async () => {
    const w = await world("K681 波及");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    expect((await move(w.mgr1, id, { folder_id: f })).status).toBe(200);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    expect((await move(w.mgr1, id, { folder_id: null })).status).toBe(403);
    expect((await del(w.mgr1, id)).status).toBe(403);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mgr1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mgr1.id, w.co.rootScope]);
    expect((await move(w.mgr1, id, { folder_id: null })).status).toBe(404);
    expect((await del(w.mgr1, id)).status).toBe(404);
    expect((await move(w.view1, id, { position: 1 })).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.view1.id,
      w.g1,
    ]);
    expect((await move(w.view1, id, { position: 1 })).status).toBe(200);
    expect((await prow(id))!["folder_id"]).toBe(f);
  });

  it("K681-API-021 二度押し・同時：消す 2 回目は 404。動かすと消すを同時に押しても壊れた形が残らない（消えたページは動かしの結果が何であれ消えたまま）。同じページを 2 つの画面から同時に動かすと両方 200", async () => {
    const w = await world("K681 同時");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "A" });
    const f2 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "B" });
    const a = await h.page({ scope: w.g1, owner: w.mgr1, title: "二度押し" });
    expect((await del(w.mgr1, a)).status).toBe(200);
    expect((await del(w.mgr1, a)).status).toBe(404);
    const b = await h.page({ scope: w.g1, owner: w.mgr1, title: "動かすと消す" });
    await h.ready();
    const [m, d] = await Promise.all([move(w.mgr1, b, { folder_id: f1 }), del(w.mgr1, b)]);
    expect(d.status).toBe(200);
    expect([200, 404]).toContain(m.status);
    expect((await prow(b))!["deleted_at"]).not.toBeNull();
    expect((await prow(b))!["folder_id"]).toBe(m.status === 200 ? f1 : null);
    const c = await h.page({ scope: w.g1, owner: w.mgr1, title: "同時に動かす" });
    const rs = await Promise.all([move(w.mgr1, c, { folder_id: f1 }), move(w.mgr1, c, { folder_id: f2 })]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect([f1, f2]).toContain((await prow(c))!["folder_id"]);
  });

  it("K681-API-022 失敗（手順 1）：ページ・下書きの版を書く所で DB が落ちると 503 E-PAGE-003・フォルダ・並び・消した印とも前のまま・ログに題名を出さない", async () => {
    const w = await world("K681 失敗 1");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "秘密の題名", position: 10 });
    await addDraft(w, id, 2, "秘密の下書き", w.mgr1);
    await h.ready();
    let logs = "";
    const fixPages = await breakWrites("knowledge_pages", w.co.tenantId);
    try {
      logs += await h.captureLogs(async () => {
        const m = await move(w.mgr1, id, { folder_id: f });
        expect(m.status).toBe(503);
        expect(((await m.json()) as Json)["code"]).toBe("E-PAGE-003");
        expect((await del(w.mgr1, id)).status).toBe(503);
      });
    } finally {
      await fixPages();
    }
    expect(await prow(id)).toMatchObject({ folder_id: null, position: 10, deleted_at: null });
    const fixVersions = await breakWrites("knowledge_page_versions", w.co.tenantId);
    try {
      logs += await h.captureLogs(async () => {
        expect((await del(w.mgr1, id)).status).toBe(503);
      });
    } finally {
      await fixVersions();
    }
    expect((await prow(id))!["deleted_at"]).toBeNull();
    expect((await liveDrafts(id)).length).toBe(1);
    expect(logs).not.toContain("秘密の");
  });

  it("K681-API-023 失敗（手順 2）：証跡を書く所で DB が落ちると 503 E-PAGE-003・同じ取引なので動かしも消しも戻り、証跡の数も変わらない", async () => {
    const w = await world("K681 失敗 2");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "ページ", position: 10 });
    await addDraft(w, id, 2, "書いている", w.mgr1);
    const before = await allAudits(w);
    await h.ready();
    const fix = await breakWrites("audit_events", w.co.tenantId);
    try {
      expect((await move(w.mgr1, id, { folder_id: f })).status).toBe(503);
      expect((await del(w.mgr1, id)).status).toBe(503);
    } finally {
      await fix();
    }
    expect(await prow(id)).toMatchObject({ folder_id: null, position: 10, deleted_at: null });
    expect((await liveDrafts(id)).length).toBe(1);
    expect(await allAudits(w)).toBe(before);
  });

  it("K681-API-024 証跡：動かして変わったとき knowledge.page.move が 1 行・消すと knowledge.page.delete が 1 行（操作した人・対象のページ・種類 knowledge_pages・関門 C2・payload は空）。変わらない動かし・断った操作には残らず、題名を入れない", async () => {
    const w = await world("K681 証跡");
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const id = await h.page({ scope: w.g1, owner: w.mgr1, title: "秘密の題名", position: 10 });
    await move(w.mgr1, id, { position: 10 });
    await move(w.mem1, id, { folder_id: f });
    await move(w.mgr1, id, { folder_id: randomUUID() });
    await del(w.mem1, id);
    expect((await audits(w, "knowledge.page.move")).length).toBe(0);
    expect((await audits(w, "knowledge.page.delete")).length).toBe(0);
    expect((await move(w.mgr1, id, { folder_id: f })).status).toBe(200);
    expect((await del(w.mgr1, id)).status).toBe(200);
    for (const action of ["knowledge.page.move", "knowledge.page.delete"]) {
      const rows = await audits(w, action);
      expect(rows.length, action).toBe(1);
      expect(rows[0], action).toMatchObject({
        actor_member_id: w.mgr1.id,
        target_type: "knowledge_pages",
        target_id: id,
        choke_point_id: "C2",
      });
      expect(JSON.stringify(rows[0]!.payload), action).not.toContain("秘密の");
      expect(rows[0]!.payload, action).toEqual({});
    }
  });
});
