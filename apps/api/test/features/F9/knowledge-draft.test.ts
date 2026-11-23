// K-679「ページを作る・下書きを自動で保存する・やめる（createKnowledgePage・saveKnowledgeDraft・discardKnowledgeDraft）」の単体の試験（口・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K679-API-NNN（チケット 11_tickets/K-679.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   土台は knowledge.harness.ts（K-675 が運ぶ）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
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
const EMPTY = { doc: { type: "doc", content: [] }, text: "" };
const docOf = (text: string): unknown => bodyOf(text).doc;

const create = async (p: Person | null, body: unknown): Promise<Response> => {
  await h.ready();
  return h.req("POST", "/knowledge_pages", { ...(p ? { headers: h.as(p) } : {}), body });
};
const save = async (p: Person | null, id: string, body: unknown): Promise<Response> => {
  await h.ready();
  return h.req("PATCH", `/knowledge_pages/${id}/draft`, { ...(p ? { headers: h.as(p) } : {}), body });
};
const discard = async (p: Person | null, id: string): Promise<Response> => {
  await h.ready();
  return h.req("DELETE", `/knowledge_pages/${id}/draft`, p ? { headers: h.as(p) } : {});
};
const made = async (p: Person, body: Record<string, unknown>): Promise<string> => {
  const r = await create(p, body);
  expect(r.status).toBe(201);
  return ((await h.json(r)).data as { id: string }).id;
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

/** 公開済みのページの下書きの版を足す（行の守りの外） */
const addDraft = (w: World, page: string, version: number, text: string, by: Person) =>
  h.admin.query(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, $3, 'draft', $4::jsonb, $5)",
    [w.co.tenantId, page, version, JSON.stringify(bodyOf(text)), by.id],
  );

describe("K-679 ページを作る・下書きを保存する・やめる", () => {
  it("K679-API-001 作る：管理者は会社・マネージャーはグループ・誰でも自分の棚に 201。答えは { id, title, desc, state draft, must false, place }。DB は下書きのページ（版 0）と空の下書きの版 1", async () => {
    const w = await world("K679 作る");
    const r = await create(w.boss, { shelf: "company", title: "経費の精算" });
    expect(r.status).toBe(201);
    const c = (await h.json(r)).data as Json;
    expect(Object.keys(c).sort()).toEqual(["desc", "id", "must", "place", "state", "title"].sort());
    expect(c).toMatchObject({
      title: "経費の精算",
      desc: "",
      state: "draft",
      must: false,
      place: { shelf: "company", shelf_name: "会社", group_id: null, folder_id: null, folders: [] },
    });
    const id = c["id"] as string;
    expect(await prow(id)).toMatchObject({
      state: "draft",
      current_version: 0,
      is_must: false,
      is_personal: false,
      owner_member_id: w.boss.id,
      scope_id: w.co.rootScope,
      deleted_at: null,
    });
    const vs = await versions(id);
    expect(vs.length).toBe(1);
    expect(vs[0]).toMatchObject({ kind: "draft", version: 1, author_member_id: w.boss.id, deleted_at: null });
    expect(vs[0]!["body"]).toEqual(EMPTY);
    const g = (await h.json(await create(w.mgr1, { shelf: "group", group_id: w.g1, title: "営業のページ" })))
      .data as Json;
    expect(g["place"]).toMatchObject({ shelf: "group", shelf_name: "営業", group_id: w.g1 });
    const m = (await h.json(await create(w.view1, { shelf: "me", title: "自分のページ" }))).data as Json;
    expect(m["place"]).toMatchObject({ shelf: "me", shelf_name: "自分", group_id: null });
    expect(await prow(m["id"] as string)).toMatchObject({
      is_personal: true,
      owner_member_id: w.view1.id,
      scope_id: w.view1.scopeId,
    });
  });

  it("K679-API-002 作る：説明を省くと空・送ると 1 行の説明に入る。フォルダを選ぶと置き場の folders に出る。並びは同じフォルダの中で 10・20 と続き、別のフォルダでは 10 から", async () => {
    const w = await world("K679 置き場");
    const f1 = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const f2 = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "請求", parent: f1 });
    const a = (await h.json(await create(w.boss, { shelf: "company", title: "A", desc: "A の説明", folder_id: f2 })))
      .data as Json;
    const b = (await h.json(await create(w.boss, { shelf: "company", title: "B", folder_id: f2 }))).data as Json;
    const c = (await h.json(await create(w.boss, { shelf: "company", title: "C", folder_id: f1 }))).data as Json;
    expect(a["desc"]).toBe("A の説明");
    expect(b["desc"]).toBe("");
    expect(a["place"]).toMatchObject({ folder_id: f2, folders: ["経理", "請求"] });
    expect((await prow(a["id"] as string))!["summary"]).toBe("A の説明");
    expect([a, b, c].map((x) => x["id"] as string)).toHaveLength(3);
    expect(await Promise.all([a, b, c].map(async (x) => (await prow(x["id"] as string))!["position"]))).toEqual([
      10, 20, 10,
    ]);
  });

  it("K679-API-003 作る：書けない人は 403 で何も作らない（会社のメンバー・マネージャー・グループのメンバー・閲覧のみ）。見えないグループ（管理者・入っていない人・別のグループの人）は 404", async () => {
    const w = await world("K679 作れない");
    const cases: [Person, Json, number][] = [
      [w.mem1, { shelf: "company", title: "x" }, 403],
      [w.mgr1, { shelf: "company", title: "x" }, 403],
      [w.none, { shelf: "company", title: "x" }, 403],
      [w.mem1, { shelf: "group", group_id: w.g1, title: "x" }, 403],
      [w.view1, { shelf: "group", group_id: w.g1, title: "x" }, 403],
      [w.boss, { shelf: "group", group_id: w.g1, title: "x" }, 404],
      [w.none, { shelf: "group", group_id: w.g1, title: "x" }, 404],
      [w.mem2, { shelf: "group", group_id: w.g1, title: "x" }, 404],
    ];
    for (const [p, body, status] of cases) {
      expect((await create(p, body)).status, `${p.id} ${JSON.stringify(body)}`).toBe(status);
    }
    expect(await num("select count(*) as n from knowledge_pages where tenant_id = $1", [w.co.tenantId])).toBe(0);
    expect(await num("select count(*) as n from knowledge_page_versions where tenant_id = $1", [w.co.tenantId])).toBe(
      0,
    );
  });

  it("K679-API-004 作る：指した物が無い・見えない・その棚に無いは 404（体は { error, code } だけ）：グループ・フォルダの id が無い・会社のいちばん上・別の会社・消したフォルダ・他人の自分のフォルダ・別の棚のフォルダ", async () => {
    const w = await world("K679 404");
    const other = await world("K679 404（別の会社）");
    const dead = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "消した" });
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [dead]);
    const theirs = await h.folder({ scope: w.mem1.scopeId, owner: w.mem1, name: "自分", personal: true });
    const company = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "会社のフォルダ" });
    const cases: [Person, Json][] = [
      [w.mgr1, { shelf: "group", group_id: randomUUID(), title: "x" }],
      [w.mgr1, { shelf: "group", group_id: w.co.rootScope, title: "x" }],
      [w.mgr1, { shelf: "group", group_id: other.g1, title: "x" }],
      [w.boss, { shelf: "company", title: "x", folder_id: randomUUID() }],
      [w.boss, { shelf: "company", title: "x", folder_id: dead }],
      [w.boss, { shelf: "company", title: "x", folder_id: theirs }],
      [w.mgr1, { shelf: "group", group_id: w.g1, title: "x", folder_id: company }],
      [w.mem1, { shelf: "me", title: "x", folder_id: company }],
    ];
    for (const [p, body] of cases) {
      const r = await create(p, body);
      expect(r.status, JSON.stringify(body)).toBe(404);
      expect(Object.keys((await r.json()) as Json).sort()).toEqual(["code", "error"]);
    }
  });

  it("K679-API-005 題名の整え：前後の空白（全角を含む）は落ち・全角の空白は半角の空白になる。200 字は通る", async () => {
    const w = await world("K679 題名");
    const a = await made(w.boss, { shelf: "company", title: "  営業　手順 " });
    const b = await made(w.boss, { shelf: "company", title: "あ".repeat(200), desc: "い".repeat(200) });
    expect((await prow(a))!["title"]).toBe("営業 手順");
    expect(((await prow(b))!["title"] as string).length).toBe(200);
    expect(((await prow(b))!["summary"] as string).length).toBe(200);
  });

  it("K679-API-006 作った下書きのページは持ち主だけが読める：同じグループのマネージャー・管理者・ほかの人の接続では 0 行", async () => {
    const w = await world("K679 本人だけ");
    const id = await made(w.mgr1, { shelf: "group", group_id: w.g1, title: "書きかけ" });
    const seen = (p: Person) =>
      withTenant(h.pool, p.ctx, async (cl) =>
        Number(
          (await cl.query<{ n: number }>("select count(*)::int as n from knowledge_pages where id = $1", [id])).rows[0]!
            .n,
        ),
      );
    expect(await seen(w.mgr1)).toBe(1);
    for (const p of [w.mgr1b, w.mem1, w.boss, w.none]) expect(await seen(p), p.id).toBe(0);
  });

  it("K679-API-007 保存：本文を送ると 200 { saved_at, title, desc }・DB の下書きの版の body が { doc, text }（text は doc から口が作る）・題名は変わらない・まだ書き終えていないページは下書きのまま", async () => {
    const w = await world("K679 保存");
    const id = await made(w.mgr1, { shelf: "group", group_id: w.g1, title: "書きかけ", desc: "説明" });
    const r = await save(w.mgr1, id, { doc: docOf("本文 A") });
    expect(r.status).toBe(200);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["desc", "saved_at", "title"]);
    expect(d).toMatchObject({ title: "書きかけ", desc: "説明" });
    expect(new Date(d["saved_at"] as string).toISOString()).toBe(d["saved_at"]);
    const dr = await liveDrafts(id);
    expect(dr.length).toBe(1);
    expect(dr[0]!["body"]).toEqual(bodyOf("本文 A"));
    expect(await prow(id)).toMatchObject({ state: "draft", title: "書きかけ", current_version: 0 });
  });

  it("K679-API-008 保存：題名・説明だけを送ると、公開済みのページの題名・1 行の説明にその場で効く（空の説明も送れる）。下書きの版は作らず・公開の版も版の数も変わらない", async () => {
    const w = await world("K679 題名の保存");
    const pid = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "古い題名",
      summary: "古い説明",
      text: "公開の本文",
    });
    const r = await save(w.mgr1, pid, { title: "新しい題名", desc: "新しい説明" });
    expect(r.status).toBe(200);
    expect((await h.json(r)).data as Json).toMatchObject({ title: "新しい題名", desc: "新しい説明" });
    expect(await prow(pid)).toMatchObject({ title: "新しい題名", summary: "新しい説明", current_version: 1 });
    expect((await versions(pid)).length).toBe(1);
    expect((await versions(pid, "published"))[0]!["body"]).toEqual(bodyOf("公開の本文"));
    expect(((await h.json(await save(w.mgr1, pid, { desc: "" }))).data as Json)["desc"]).toBe("");
    expect((await prow(pid))!["summary"]).toBe("");
  });

  it("K679-API-009 保存：公開済みのページの最初の本文の保存で下書きの版が 1 つできる（番号は今の版の次・書いた人は自分）。公開の版とページの版の数は変わらない", async () => {
    const w = await world("K679 最初の保存");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中", text: "公開の本文" });
    expect((await save(w.mgr1, pid, { doc: docOf("直している本文") })).status).toBe(200);
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(dr[0]).toMatchObject({ kind: "draft", version: 2, author_member_id: w.mgr1.id });
    expect(dr[0]!["body"]).toEqual(bodyOf("直している本文"));
    expect((await versions(pid, "published"))[0]!["body"]).toEqual(bodyOf("公開の本文"));
    expect((await prow(pid))!["current_version"]).toBe(1);
    expect((await prow(pid))!["state"]).toBe("published");
  });

  it("K679-API-010 保存を続ける：2 回目からは同じ下書きの版を直す（行は 1 つのまま・本文が新しくなり・saved_at は進むか同じ）", async () => {
    const w = await world("K679 続けて保存");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中" });
    const a = (await h.json(await save(w.mgr1, pid, { doc: docOf("一回目") }))).data as Json;
    const first = (await liveDrafts(pid))[0]!["id"];
    const b = (await h.json(await save(w.mgr1, pid, { doc: docOf("二回目") }))).data as Json;
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(dr[0]!["id"]).toBe(first);
    expect(dr[0]!["body"]).toEqual(bodyOf("二回目"));
    expect(new Date(b["saved_at"] as string).getTime()).toBeGreaterThanOrEqual(
      new Date(a["saved_at"] as string).getTime(),
    );
  });

  it("K679-API-011 別の人が下書き中は 409 E-KNW-012（体は { error, code } だけ）：同じグループの別のマネージャーが保存すると断られ、題名も本文も変わらない", async () => {
    const w = await world("K679 別の人が書いている");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中" });
    await addDraft(w, pid, 2, "先に書いている本文", w.mgr1);
    const r = await save(w.mgr1b, pid, { title: "割り込みの題名", doc: docOf("割り込みの本文") });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "conflict", code: "E-KNW-012" });
    expect((await prow(pid))!["title"]).toBe("公開中");
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(dr[0]).toMatchObject({ author_member_id: w.mgr1.id });
    expect(dr[0]!["body"]).toEqual(bodyOf("先に書いている本文"));
  });

  it("K679-API-026 別の人が下書き中に題名・説明だけ（本文なし）を保存しても 409 E-KNW-012（体は { error, code } だけ）：題名・説明も先の人の下書きの版も変わらず、証跡も増えない", async () => {
    const w = await world("K679 別の人が書いている（題名だけ）");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中", summary: "公開の説明" });
    await addDraft(w, pid, 2, "先に書いている本文", w.mgr1);
    const before = await liveDrafts(pid);
    const audited = await allAudits(w);
    const r = await save(w.mgr1b, pid, { title: "割り込みの題名", desc: "割り込みの説明" });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "conflict", code: "E-KNW-012" });
    expect(await prow(pid)).toMatchObject({ title: "公開中", summary: "公開の説明" });
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(dr[0]).toMatchObject({ id: before[0]!["id"], author_member_id: w.mgr1.id });
    expect(dr[0]!["body"]).toEqual(bodyOf("先に書いている本文"));
    expect(await allAudits(w)).toBe(audited);
  });

  it("K679-API-012 保存：本文の形が合わない（知らない節・段落でない根）は 422（欄 doc）で何も保存しない（同じ要求の題名も変わらない）", async () => {
    const w = await world("K679 本文の形");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中" });
    for (const bad of [{ type: "doc", content: [{ type: "unknown_node" }] }, { type: "paragraph" }]) {
      const r = await save(w.mgr1, pid, { title: "変わらない", doc: bad });
      expect(r.status).toBe(422);
      const body = (await r.json()) as { details: { field: string }[] };
      expect(body.details.map((d) => d.field)).toContain("doc");
    }
    expect((await prow(pid))!["title"]).toBe("公開中");
    expect((await liveDrafts(pid)).length).toBe(0);
  });

  it("K679-API-013 保存：書けない人は 403・見えない人と無い・消した id は 404（体は { error, code } だけ）。何も変わらない", async () => {
    const w = await world("K679 保存できない");
    const other = await world("K679 保存できない（別の会社）");
    const g1p = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の下書き" });
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
      const r = await save(p, id, { title: "書き換え", doc: docOf("書き換え") });
      expect(r.status, `${p.id} ${id}`).toBe(status);
      if (status === 404) expect(Object.keys((await r.json()) as Json).sort()).toEqual(["code", "error"]);
    }
    expect((await prow(g1p))!["title"]).toBe("営業のページ");
    expect(
      await num("select count(*) as n from knowledge_page_versions where page_id = $1 and kind = 'draft'", [g1p]),
    ).toBe(0);
  });

  it("K679-API-014 必ず守るのページは、本文が 2,000 字を超えても下書きとして保存できる（書き終えるのを止めるのは K-680）。必ず守るの印は変わらない", async () => {
    const w = await world("K679 必ず守る");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "守るページ", must: true, text: "短い" });
    const r = await save(w.mgr1, pid, { doc: docOf("あ".repeat(2500)) });
    expect(r.status).toBe(200);
    expect(((await liveDrafts(pid))[0]!["body"] as { text: string }).text.length).toBe(2500);
    expect((await prow(pid))!["is_must"]).toBe(true);
  });

  it("K679-API-015 同じ人が 2 つの画面から同時に保存しても、下書きの版は 1 つのまま（後の保存が勝つ）：両方 200", async () => {
    const w = await world("K679 同時の保存");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中" });
    await h.ready();
    const rs = await Promise.all([
      save(w.mgr1, pid, { doc: docOf("画面 A") }),
      save(w.mgr1, pid, { doc: docOf("画面 B") }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(["画面 A", "画面 B"]).toContain((dr[0]!["body"] as { text: string }).text);
  });

  it("K679-API-016 上限を超えると 429（保存の 1 分 120 回の上限を 2 に差し替えた口の 3 回目）", async () => {
    const w = await world("K679 上限");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中" });
    h.limits["saveKnowledgeDraft"] = 2;
    try {
      expect((await save(w.mgr1, pid, { title: "1" })).status).toBe(200);
      expect((await save(w.mgr1, pid, { title: "2" })).status).toBe(200);
      const r = await save(w.mgr1, pid, { title: "3" });
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["saveKnowledgeDraft"];
    }
  });

  it("K679-API-017 やめる（公開済みのページ）：200 { id, page_deleted false }・下書きの版に消した印・ページと公開の版はそのまま。そのあと保存すると新しい下書きの版ができる", async () => {
    const w = await world("K679 やめる");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中", text: "公開の本文" });
    await save(w.mgr1, pid, { doc: docOf("捨てる本文") });
    const r = await discard(w.mgr1, pid);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ id: pid, page_deleted: false });
    expect(await liveDrafts(pid)).toEqual([]);
    expect((await versions(pid, "draft")).length).toBe(1);
    expect(await prow(pid)).toMatchObject({ deleted_at: null, state: "published", current_version: 1 });
    expect((await versions(pid, "published"))[0]!["body"]).toEqual(bodyOf("公開の本文"));
    expect((await save(w.mgr1, pid, { doc: docOf("書き直し") })).status).toBe(200);
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(dr[0]!["body"]).toEqual(bodyOf("書き直し"));
  });

  it("K679-API-018 やめる（まだ 1 度も書き終えていないページ）：ページごと消える（page_deleted true・ページと下書きの版に消した印）。もう一度やめる・保存するは 404", async () => {
    const w = await world("K679 ページごと消える");
    const id = await made(w.mgr1, { shelf: "group", group_id: w.g1, title: "書きかけ" });
    await save(w.mgr1, id, { doc: docOf("途中") });
    const r = await discard(w.mgr1, id);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ id, page_deleted: true });
    expect((await prow(id))!["deleted_at"]).not.toBeNull();
    expect(await liveDrafts(id)).toEqual([]);
    expect((await discard(w.mgr1, id)).status).toBe(404);
    expect((await save(w.mgr1, id, { title: "もう書けない" })).status).toBe(404);
  });

  it("K679-API-019 捨てる下書きが無いと 409 E-KNW-030（下書きの無い公開済みのページ・別の人の下書きだけがあるとき）。別の人の下書きは消えない", async () => {
    const w = await world("K679 捨てる物が無い");
    const plain = await h.page({ scope: w.g1, owner: w.mgr1, title: "下書き無し" });
    const theirs = await h.page({ scope: w.g1, owner: w.mgr1, title: "別の人が書いている" });
    await addDraft(w, theirs, 2, "先の人の本文", w.mgr1);
    for (const [p, id] of [
      [w.mgr1, plain],
      [w.mgr1b, theirs],
    ] as [Person, string][]) {
      const r = await discard(p, id);
      expect(r.status, id).toBe(409);
      expect(await r.json()).toEqual({ error: "conflict", code: "E-KNW-030" });
    }
    expect((await liveDrafts(theirs)).length).toBe(1);
  });

  it("K679-API-020 やめる：書けない人は 403・見えない人と無い id は 404。何も変わらない", async () => {
    const w = await world("K679 やめられない");
    const g1p = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    await addDraft(w, g1p, 2, "書いている", w.mgr1);
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の下書き" });
    const cases: [Person, string, number][] = [
      [w.mem1, g1p, 403],
      [w.view1, g1p, 403],
      [w.mem2, g1p, 404],
      [w.boss, g1p, 404],
      [w.mgr1b, draft, 404],
      [w.mgr1, randomUUID(), 404],
    ];
    for (const [p, id, status] of cases) expect((await discard(p, id)).status, `${p.id} ${id}`).toBe(status);
    expect((await liveDrafts(g1p)).length).toBe(1);
    expect((await prow(draft))!["deleted_at"]).toBeNull();
  });

  it("K679-API-021 ログインしていない要求は 3 本とも 401", async () => {
    const id = randomUUID();
    expect((await create(null, { shelf: "company", title: "x" })).status).toBe(401);
    expect((await save(null, id, { title: "x" })).status).toBe(401);
    expect((await discard(null, id)).status).toBe(401);
  });

  it("K679-API-022 権限を外した直後・付けた直後・グループを抜けた直後：入り直さなくても次の操作から効く", async () => {
    const w = await world("K679 波及");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    expect((await save(w.mgr1, pid, { title: "書ける" })).status).toBe(200);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    expect((await save(w.mgr1, pid, { title: "もう書けない" })).status).toBe(403);
    expect((await create(w.mgr1, { shelf: "group", group_id: w.g1, title: "もう作れない" })).status).toBe(403);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mgr1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mgr1.id, w.co.rootScope]);
    expect((await save(w.mgr1, pid, { title: "もう見えない" })).status).toBe(404);
    expect((await create(w.view1, { shelf: "group", group_id: w.g1, title: "まだ作れない" })).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.view1.id,
      w.g1,
    ]);
    expect((await create(w.view1, { shelf: "group", group_id: w.g1, title: "作れる" })).status).toBe(201);
    expect((await prow(pid))!["title"]).toBe("書ける");
  });

  it("K679-API-023 手順 2 の証跡：作る（knowledge.page.create）・やめる（knowledge.draft.discard）は 1 行・題名か説明を変えたときだけ knowledge.page.retitle が 1 行・本文だけの保存は増えない。題名を入れず、断った操作には残らない", async () => {
    const w = await world("K679 証跡");
    const id = await made(w.mgr1, { shelf: "group", group_id: w.g1, title: "秘密の題名" });
    await save(w.mgr1, id, { doc: docOf("本文だけ") });
    await save(w.mgr1, id, { doc: docOf("本文だけ 2") });
    expect((await audits(w, "knowledge.page.retitle")).length).toBe(0);
    await save(w.mgr1, id, { title: "秘密の新しい題名" });
    await save(w.mgr1, id, { title: "秘密の新しい題名" });
    await discard(w.mgr1, id);
    await create(w.mem1, { shelf: "company", title: "断られる" });
    await save(w.mem1, id, { title: "断られる" });
    for (const [action, n] of [
      ["knowledge.page.create", 1],
      ["knowledge.page.retitle", 1],
      ["knowledge.draft.discard", 1],
    ] as [string, number][]) {
      const rows = await audits(w, action);
      expect(rows.length, action).toBe(n);
      expect(rows[0]).toMatchObject({
        actor_member_id: w.mgr1.id,
        target_type: "knowledge_pages",
        target_id: id,
        choke_point_id: "C2",
      });
      expect(JSON.stringify(rows[0]!.payload), action).not.toContain("秘密の");
    }
  });

  it("K679-API-024 失敗（手順 1）：ページ・下書きの版を書く所で DB が落ちると 503 E-PAGE-003・何も増えず同じ要求の題名も変わらず・下書きは残り・ログに題名と本文を出さない", async () => {
    const w = await world("K679 失敗 1");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "壊す前" });
    await addDraft(w, pid, 2, "壊す前の下書き", w.mgr1);
    await h.ready();
    const fixPages = await breakWrites("knowledge_pages", w.co.tenantId);
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        const c = await create(w.mgr1, { shelf: "group", group_id: w.g1, title: "秘密の題名" });
        expect(c.status).toBe(503);
        expect(((await c.json()) as Json)["code"]).toBe("E-PAGE-003");
        const t = await save(w.mgr1, pid, { title: "秘密の題名だけ" });
        expect(t.status).toBe(503);
      });
    } finally {
      await fixPages();
    }
    expect(await num("select count(*) as n from knowledge_pages where tenant_id = $1", [w.co.tenantId])).toBe(1);
    const fixVersions = await breakWrites("knowledge_page_versions", w.co.tenantId);
    try {
      logs += await h.captureLogs(async () => {
        const s = await save(w.mgr1, pid, { doc: docOf("秘密の新しい本文") });
        expect(s.status).toBe(503);
        const d = await discard(w.mgr1, pid);
        expect(d.status).toBe(503);
      });
    } finally {
      await fixVersions();
    }
    expect((await prow(pid))!["title"]).toBe("壊す前");
    const dr = await liveDrafts(pid);
    expect(dr.length).toBe(1);
    expect(dr[0]!["body"]).toEqual(bodyOf("壊す前の下書き"));
    expect(logs).not.toContain("秘密の");
  });

  it("K679-API-025 失敗（手順 2）：証跡を書く所で DB が落ちると 503 E-PAGE-003・同じ取引なので作ったページも版も残らず、やめる下書きも残る", async () => {
    const w = await world("K679 失敗 2");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中" });
    await addDraft(w, pid, 2, "書いている", w.mgr1);
    const before = await allAudits(w);
    await h.ready();
    const fix = await breakWrites("audit_events", w.co.tenantId);
    try {
      expect((await create(w.mgr1, { shelf: "group", group_id: w.g1, title: "作れない" })).status).toBe(503);
      expect((await discard(w.mgr1, pid)).status).toBe(503);
      expect((await save(w.mgr1, pid, { title: "題名を変えられない" })).status).toBe(503);
    } finally {
      await fix();
    }
    expect(await num("select count(*) as n from knowledge_pages where tenant_id = $1", [w.co.tenantId])).toBe(1);
    expect(await num("select count(*) as n from knowledge_page_versions where tenant_id = $1", [w.co.tenantId])).toBe(
      2,
    );
    expect((await prow(pid))!["title"]).toBe("公開中");
    expect((await liveDrafts(pid)).length).toBe(1);
    expect(await allAudits(w)).toBe(before);
  });
});
