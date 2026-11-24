// K-677「ページを読む（getKnowledgePage）と前の版を読む（listKnowledgeVersions・getKnowledgePageVersion）」の単体の試験（口・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K677-API-NNN・K677-DB-NNN（チケット 11_tickets/K-677.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md（3.1）。
//   土台は knowledge.harness.ts（K-675 が運ぶ）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
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
interface Detail {
  id: string;
  title: string;
  desc: string;
  state: string;
  must: boolean;
  must_blocked: string | null;
  place: { shelf: string; shelf_name: string; group_id: string | null; folder_id: string | null; folders: string[] };
  acts: string[];
  body: { doc: unknown; text: string } | null;
  draft: { title: string; desc: string; doc: unknown; saved_at: string } | null;
  request: unknown;
  copied_from: {
    page_id: string | null;
    title: string;
    shelf_name: string;
    folders: string[];
    must: boolean;
    gone: boolean;
  } | null;
  shared_from: unknown; // 共有された側の帯 { group_name, manager_names, writable }（K-719 が埋める）
  raise_to: unknown;
  foot: { last_editor_name: string | null; last_edited_at: string; version: number; ai_opened_30d: number };
}
const ACTS = ["must-on", "must-off", "raise", "share", "copy", "edit"];

const call = async (p: Person | null, path: string): Promise<Response> => {
  await h.ready();
  return h.req("GET", path, p ? { headers: h.as(p) } : {});
};
const detail = async (p: Person, id: string): Promise<Detail> => {
  const r = await call(p, `/knowledge_pages/${id}`);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Detail;
};

/** 公開の版を足す（行の守りの外） */
const addPublished = async (w: World, page: string, version: number, text: string, by: Person, at?: string) => {
  await h.admin.query(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, $3, 'published', $4::jsonb, $5, coalesce($6::timestamptz, now()), $5)",
    [w.co.tenantId, page, version, JSON.stringify(bodyOf(text)), by.id, at ?? null],
  );
  await h.admin.query("update knowledge_pages set current_version = $2 where id = $1", [page, version]);
};
/** 下書きの版を足す（行の守りの外） */
const addDraft = async (w: World, page: string, version: number, text: string, by: Person) => {
  await h.admin.query(
    "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, $3, 'draft', $4::jsonb, $5)",
    [w.co.tenantId, page, version, JSON.stringify(bodyOf(text)), by.id],
  );
};
const ticketOf = async (w: World): Promise<string> =>
  (
    await h.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, updated_by)
       values ($1, $2, '', (select id from ticket_kinds where tenant_id = $1 and deleted_at is null order by position limit 1),
               (select id from ticket_stages where tenant_id = $1 and key = 'todo' and deleted_at is null), '請求書を送る', $3, $3, $3) returning id`,
      [w.co.tenantId, w.co.rootScope, w.boss.id],
    )
  ).rows[0]!.id;
const opened = (w: World, ticket: string, page: string, daysAgo: number, type = "page") =>
  h.admin.query(
    "insert into reference_logs (tenant_id, ticket_id, ref_type, ref_id, seen_at) values ($1, $2, $3, $4, now() - ($5 || ' days')::interval)",
    [w.co.tenantId, ticket, type, page, String(daysAgo)],
  );

describe("K-677 ページを読む", () => {
  it("K677-API-001 答えの鍵が決めたとおり（15 個）・place は 5 鍵・foot は 4 鍵", async () => {
    const w = await world("K677 鍵");
    const pid = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "経費の精算" });
    const r = await call(w.mem1, `/knowledge_pages/${pid}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Detail;
    expect(Object.keys(d).sort()).toEqual(
      [
        "acts",
        "body",
        "copied_from",
        "desc",
        "draft",
        "foot",
        "id",
        "must",
        "must_blocked",
        "place",
        "raise_to",
        "request",
        "shared_from",
        "state",
        "title",
      ].sort(),
    );
    expect(Object.keys(d.place).sort()).toEqual(["folder_id", "folders", "group_id", "shelf", "shelf_name"]);
    expect(Object.keys(d.foot).sort()).toEqual(["ai_opened_30d", "last_edited_at", "last_editor_name", "version"]);
  });

  it("K677-API-002 会社の棚の公開済みページ：題名・1 行の説明・本文（保存したまま）・置き場（棚の名前は「会社」・フォルダの並びは棚の直下から）。説明が空なら空の文字", async () => {
    const w = await world("K677 会社のページ");
    const f1 = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const f2 = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "請求", parent: f1 });
    const pid = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "請求書の送り方",
      summary: "請求書を送る手順",
      folder: f2,
      text: "毎月 25 日に送る",
    });
    const d = await detail(w.mem1, pid);
    expect(d).toMatchObject({
      id: pid,
      title: "請求書の送り方",
      desc: "請求書を送る手順",
      state: "published",
      must: false,
      must_blocked: null,
      draft: null,
    });
    expect(d.body).toEqual(bodyOf("毎月 25 日に送る"));
    expect(d.place).toEqual({
      shelf: "company",
      shelf_name: "会社",
      group_id: null,
      folder_id: f2,
      folders: ["経理", "請求"],
    });
    const plain = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "説明なし" });
    expect((await detail(w.none, plain)).desc).toBe("");
  });

  it("K677-API-003 グループの棚・自分の棚のページ：置き場の棚の種類・名前・group_id（自分の棚は「自分」・group_id は null）", async () => {
    const w = await world("K677 棚の置き場");
    const gp = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const mp = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    expect((await detail(w.mem1, gp)).place).toEqual({
      shelf: "group",
      shelf_name: "営業",
      group_id: w.g1,
      folder_id: null,
      folders: [],
    });
    expect((await detail(w.mem1, mp)).place).toEqual({
      shelf: "me",
      shelf_name: "自分",
      group_id: null,
      folder_id: null,
      folders: [],
    });
  });

  it("K677-API-004 まだ 1 度も書き終えていないページ（持ち主）：state draft・body と draft は自分の下書き・足元の版は 0", async () => {
    const w = await world("K677 下書きだけ");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "書きかけ" });
    await addDraft(w, pid, 1, "書きかけの本文", w.mgr1);
    const d = await detail(w.mgr1, pid);
    expect(d.state).toBe("draft");
    expect(d.body).toEqual(bodyOf("書きかけの本文"));
    expect(d.draft).not.toBeNull();
    expect(d.draft!.doc).toEqual(bodyOf("書きかけの本文").doc);
    // 題名と説明は版でなくページの今の値（保存のたびにすぐ効く）
    expect(d.draft!.title).toBe("書きかけ");
    expect(typeof d.draft!.desc).toBe("string");
    expect(Object.keys(d.draft!).sort()).toEqual(["desc", "doc", "saved_at", "title"]);
    expect(new Date(d.draft!.saved_at).toISOString()).toBe(d.draft!.saved_at);
    expect(d.foot.version).toBe(0);
    expect(d.foot.last_editor_name).toBeNull();
    expect(typeof d.foot.last_edited_at).toBe("string");
  });

  it("K677-API-005 公開済みを直している下書き：書いている本人には body は公開の版・draft に下書き。ほかの書ける人・メンバーには draft は null（下書きは書いている人だけ）", async () => {
    const w = await world("K677 直している");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "公開中", text: "公開の本文" });
    await addDraft(w, pid, 2, "直している本文", w.mgr1);
    const mine = await detail(w.mgr1, pid);
    expect(mine.body).toEqual(bodyOf("公開の本文"));
    expect(mine.draft!.doc).toEqual(bodyOf("直している本文").doc);
    expect(mine.draft!.title).toBe("公開中");
    for (const p of [w.mgr1b, w.mem1, w.view1]) {
      const d = await detail(p, pid);
      expect(d.draft, p.id).toBeNull();
      expect(d.body, p.id).toEqual(bodyOf("公開の本文"));
    }
  });

  it("K677-API-006 付けられない訳（must_blocked）：必ず守るが付いていない公開済みで本文が 2,000 字を超えると too_long・2,000 字ちょうどは null・必ず守るが付いていれば null・下書きのページは null", async () => {
    const w = await world("K677 字数");
    const long = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "長い", text: "あ".repeat(2001) });
    const just = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "ちょうど", text: "あ".repeat(2000) });
    const must = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "守る", must: true, text: "短い" });
    const draft = await h.page({ scope: w.co.rootScope, owner: w.boss, state: "draft", title: "下書き" });
    await addDraft(w, draft, 1, "あ".repeat(2500), w.boss);
    expect((await detail(w.boss, long)).must_blocked).toBe("too_long");
    expect((await detail(w.boss, just)).must_blocked).toBeNull();
    const m = await detail(w.boss, must);
    expect(m.must).toBe(true);
    expect(m.must_blocked).toBeNull();
    expect((await detail(w.boss, draft)).must_blocked).toBeNull();
  });

  it("K677-API-007 帯の操作（acts）：書ける人には edit が入り、読むだけの人には入らない。値は決めた 6 つのどれか（後の葉が足す操作は数えない）", async () => {
    const w = await world("K677 操作");
    const gp = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const cp = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    const mp = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    const dp = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の下書き" });
    await addDraft(w, dp, 1, "下書き", w.mgr1);
    const cases: [Person, string, boolean][] = [
      [w.mgr1, gp, true],
      [w.mgr1b, gp, true],
      [w.mem1, gp, false],
      [w.view1, gp, false],
      [w.boss, cp, true],
      [w.mem1, cp, false],
      [w.mem1, mp, true],
      [w.mgr1, dp, true],
    ];
    for (const [p, id, edit] of cases) {
      const acts = (await detail(p, id)).acts;
      expect(acts.includes("edit"), `${p.id} ${id}`).toBe(edit);
      for (const a of acts) expect(ACTS).toContain(a);
    }
  });

  it("K677-API-008 頼み・共有・上げる先：会社の棚のページは、頼みが無く共有もされていなければ request・shared_from・raise_to が null（上の棚が無い）", async () => {
    const w = await world("K677 頼みなし");
    const cp = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    for (const p of [w.boss, w.mem1, w.none]) {
      const d = await detail(p, cp);
      expect(d.request, p.id).toBeNull();
      expect(d.shared_from, p.id).toBeNull();
      expect(d.raise_to, p.id).toBeNull();
    }
  });

  it("K677-API-009 写しの帯（copied_from）：元が見えれば { page_id, title, shelf_name, folders（棚の直下から）, must, gone false }。元が消えた・元が見えない（入っていないグループ）は gone true・page_id null・ほかは空（在るかを漏らさない）", async () => {
    const w = await world("K677 写し");
    const fin = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "経費の精算", must: true, folder: fin });
    const dead = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "消える元" });
    const hidden = await h.page({ scope: w.g2, owner: w.mem2, title: "開発の元" });
    const c1 = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "写し 1", copiedFrom: src });
    const c2 = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      title: "写し 2",
      copiedFrom: dead,
    });
    const c3 = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      title: "写し 3",
      copiedFrom: hidden,
    });
    const plain = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "写しでない" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [dead]);
    expect((await detail(w.mem1, c1)).copied_from).toEqual({
      page_id: src,
      title: "経費の精算",
      shelf_name: "会社",
      folders: ["経理"],
      must: true,
      gone: false,
    });
    const gone = { page_id: null, title: "", shelf_name: "", folders: [], must: false, gone: true };
    expect((await detail(w.mem1, c2)).copied_from).toEqual(gone);
    expect((await detail(w.mem1, c3)).copied_from).toEqual(gone);
    expect((await detail(w.mem1, plain)).copied_from).toBeNull();
  });

  it("K677-API-010 足元（foot）：最後に書き終えた版の人・時刻・版の番号。下書きだけのページは人が null・版は 0", async () => {
    const w = await world("K677 足元");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "二度書き終えたページ", text: "最初" });
    await addPublished(w, pid, 2, "二度目", w.mgr1b, "2026-11-20T01:02:03Z");
    const d = await detail(w.mem1, pid);
    expect(d.body).toEqual(bodyOf("二度目"));
    expect(d.foot.version).toBe(2);
    expect(d.foot.last_editor_name).toBe("営業のもう 1 人のマネージャー");
    expect(d.foot.last_edited_at).toBe("2026-11-20T01:02:03.000Z");
  });

  it("K677-API-011 AI がこの 30 日に開いた数（ai_opened_30d）：30 日以内の記録の数・31 日前・ページでない記録・別のページの記録は数えない。見えないチケットの分も数え、読み手によらず同じ", async () => {
    const w = await world("K677 AI が開いた数");
    const pid = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "よく開かれるページ" });
    const other = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "別のページ" });
    const t1 = await ticketOf(w);
    const t2 = await ticketOf(w);
    await opened(w, t1, pid, 1);
    await opened(w, t2, pid, 29);
    await opened(w, t1, pid, 31);
    await opened(w, t1, pid, 2, "memory");
    await opened(w, t1, other, 1);
    expect((await detail(w.boss, pid)).foot.ai_opened_30d).toBe(2);
    expect((await detail(w.mem1, pid)).foot.ai_opened_30d).toBe(2);
    expect((await detail(w.none, other)).foot.ai_opened_30d).toBe(1);
    expect(
      (await detail(w.boss, await h.page({ scope: w.co.rootScope, owner: w.boss, title: "未読" }))).foot.ai_opened_30d,
    ).toBe(0);
  });

  it("K677-API-012 見られないページは 404（在るかを漏らさない）：入っていないグループ・他人の自分のページ（管理者・マネージャーでも）・他人の下書き・消した・しまった・無い id・別の会社。体は { error, code } だけで、どれも無い id の答えと同じ", async () => {
    const w = await world("K677 見えない");
    const other = await world("K677 見えない（別の会社）");
    const g1p = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "営業の下書き" });
    const gone = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "消したページ" });
    const old = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "しまったページ" });
    const comp = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    await h.admin.query("update knowledge_pages set state = 'archived', archived_at = now() where id = $1", [old]);
    const nobody = await (await call(w.mem1, `/knowledge_pages/${randomUUID()}`)).json();
    expect(Object.keys(nobody as Json).sort()).toEqual(["code", "error"]);
    const cases: [Person, string][] = [
      [w.mem2, g1p],
      [w.none, g1p],
      [w.boss, g1p],
      [w.boss, mine],
      [w.mgr1, mine],
      [w.view1, mine],
      [w.mem1, draft],
      [w.boss, draft],
      [w.mem1, gone],
      [w.mem1, old],
      [other.boss, comp],
      [other.mem1, g1p],
    ];
    for (const [p, id] of cases) {
      const r = await call(p, `/knowledge_pages/${id}`);
      expect(r.status, `${p.id} ${id}`).toBe(404);
      expect(await r.json(), `${p.id} ${id}`).toEqual(nobody);
    }
  });

  it("K677-API-013 グループから抜けた直後：入り直さなくても次の読みから 404", async () => {
    const w = await world("K677 抜けた");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    expect((await call(w.mem1, `/knowledge_pages/${pid}`)).status).toBe(200);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.co.rootScope]);
    expect((await call(w.mem1, `/knowledge_pages/${pid}`)).status).toBe(404);
    expect((await call(w.mem1, `/knowledge_pages/${pid}/versions`)).status).toBe(404);
    expect((await call(w.mem1, `/knowledge_pages/${pid}/versions/1`)).status).toBe(404);
  });

  it("K677-API-014 版の一覧：公開した版だけを新しい順に { version, published_at, by_name } で。下書きの版は出ない。meta.count は返した数", async () => {
    const w = await world("K677 版の一覧");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "三度書き終えたページ", text: "一版" });
    await addPublished(w, pid, 2, "二版", w.mgr1b, "2026-11-21T00:00:00Z");
    await addPublished(w, pid, 3, "三版", w.mgr1, "2026-11-22T00:00:00Z");
    await addDraft(w, pid, 4, "下書き", w.mgr1);
    const r = await call(w.mem1, `/knowledge_pages/${pid}/versions`);
    expect(r.status).toBe(200);
    const j = await h.json(r);
    const rows = j.data as { version: number; published_at: string; by_name: string | null }[];
    expect(rows.map((x) => x.version)).toEqual([3, 2, 1]);
    expect(Object.keys(rows[0]!).sort()).toEqual(["by_name", "published_at", "version"]);
    expect(rows[0]).toMatchObject({ by_name: "営業マネージャー", published_at: "2026-11-22T00:00:00.000Z" });
    expect(rows[1]!.by_name).toBe("営業のもう 1 人のマネージャー");
    expect((j["meta"] as { count: number }).count).toBe(3);
  });

  it("K677-API-015 版の一覧の 0 件と 1 件：一度も書き終えていないページは空・count 0。1 回だけ書き終えたページは 1 件", async () => {
    const w = await world("K677 版の 0 と 1");
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "下書きだけ" });
    await addDraft(w, draft, 1, "下書き", w.mgr1);
    const once = await h.page({ scope: w.g1, owner: w.mgr1, title: "一度だけ" });
    const a = await h.json(await call(w.mgr1, `/knowledge_pages/${draft}/versions`));
    expect(a.data).toEqual([]);
    expect((a["meta"] as { count: number }).count).toBe(0);
    const b = await h.json(await call(w.mem1, `/knowledge_pages/${once}/versions`));
    expect((b.data as unknown[]).length).toBe(1);
    expect((b["meta"] as { count: number }).count).toBe(1);
  });

  it("K677-API-016 版の一覧は 200 行で切る：201 版あると新しい 200 版（201〜2）・count 200・ログに 1 行（題名は出さない）", async () => {
    const w = await world("K677 版 200");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "版の多いページ" });
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) select $1, $2, g, 'published', $3::jsonb, $4, now() - ((300 - g) || ' minutes')::interval, $4 from generate_series(2, 201) g",
      [w.co.tenantId, pid, JSON.stringify(bodyOf("版")), w.mgr1.id],
    );
    let j: Json = {};
    const logs = await h.captureLogs(async () => {
      j = await h.json(await call(w.mem1, `/knowledge_pages/${pid}/versions`));
    });
    const rows = j.data as { version: number }[];
    expect(rows.length).toBe(200);
    expect(rows[0]!.version).toBe(201);
    expect(rows[199]!.version).toBe(2);
    expect((j["meta"] as { count: number }).count).toBe(200);
    expect(logs.split("\n").filter((l) => l.includes("[knowledge] 版の一覧を 200 行で切った")).length).toBe(1);
    expect(logs).not.toContain("版の多いページ");
  });

  it("K677-API-017 版の並びは揺れない：書き終えた時刻が同じ版が並んでも、版の番号の大きい順", async () => {
    const w = await world("K677 版の並び");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "同じ時刻" });
    for (const v of [2, 3, 4]) await addPublished(w, pid, v, `版 ${v}`, w.mgr1, "2026-11-20T00:00:00Z");
    await h.admin.query("update knowledge_page_versions set published_at = '2026-11-20T00:00:00Z' where page_id = $1", [
      pid,
    ]);
    const rows = (await h.json(await call(w.mem1, `/knowledge_pages/${pid}/versions`))).data as { version: number }[];
    expect(rows.map((x) => x.version)).toEqual([4, 3, 2, 1]);
  });

  it("K677-API-018 版の一覧・前の版は、見えないページ・消したページ・他人の下書きのページ・無い id なら 404", async () => {
    const w = await world("K677 版の 404");
    const g1p = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const gone = await h.page({ scope: w.g1, owner: w.mgr1, title: "消した" });
    const draft = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "下書き" });
    await addDraft(w, draft, 1, "下書き", w.mgr1);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const cases: [Person, string][] = [
      [w.mem2, g1p],
      [w.boss, g1p],
      [w.mem1, gone],
      [w.mem1, draft],
      [w.mem1, randomUUID()],
    ];
    for (const [p, id] of cases) {
      expect((await call(p, `/knowledge_pages/${id}/versions`)).status, `${p.id} ${id}`).toBe(404);
      expect((await call(p, `/knowledge_pages/${id}/versions/1`)).status, `${p.id} ${id}`).toBe(404);
    }
  });

  it("K677-API-019 前の版を読む：版の番号で本文（保存したまま）・書き終えた時刻・書いた人。鍵は 4 つ", async () => {
    const w = await world("K677 前の版");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "二版のページ", text: "最初の本文" });
    await addPublished(w, pid, 2, "二度目の本文", w.mgr1b, "2026-11-22T03:04:05Z");
    const first = await call(w.mem1, `/knowledge_pages/${pid}/versions/1`);
    expect(first.status).toBe(200);
    const a = (await h.json(first)).data as Json;
    expect(Object.keys(a).sort()).toEqual(["body", "by_name", "published_at", "version"]);
    expect(a).toMatchObject({ version: 1, by_name: "営業マネージャー", body: bodyOf("最初の本文") });
    const b = (await h.json(await call(w.view1, `/knowledge_pages/${pid}/versions/2`))).data as Json;
    expect(b).toMatchObject({
      version: 2,
      by_name: "営業のもう 1 人のマネージャー",
      published_at: "2026-11-22T03:04:05.000Z",
      body: bodyOf("二度目の本文"),
    });
  });

  it("K677-API-020 前の版は公開した版だけ：無い番号・下書きの版の番号（書いている本人でも）・一度も書き終えていないページの番号 1 は 404", async () => {
    const w = await world("K677 前の版の 404");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "直している" });
    await addDraft(w, pid, 2, "下書き", w.mgr1);
    const draftOnly = await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "下書きだけ" });
    await addDraft(w, draftOnly, 1, "下書き", w.mgr1);
    expect((await call(w.mgr1, `/knowledge_pages/${pid}/versions/99`)).status).toBe(404);
    expect((await call(w.mgr1, `/knowledge_pages/${pid}/versions/2`)).status).toBe(404);
    expect((await call(w.mgr1, `/knowledge_pages/${draftOnly}/versions/1`)).status).toBe(404);
    expect((await call(w.mgr1, `/knowledge_pages/${pid}/versions/1`)).status).toBe(200);
  });

  it("K677-API-021 ログインしていない要求は 3 本とも 401", async () => {
    const pid = randomUUID();
    for (const path of [
      `/knowledge_pages/${pid}`,
      `/knowledge_pages/${pid}/versions`,
      `/knowledge_pages/${pid}/versions/1`,
    ]) {
      expect((await call(null, path)).status, path).toBe(401);
    }
  });

  it("K677-API-022 読むだけで何も書かない：3 本の口を読んでも、ページ・版・証跡の行は増えず、更新の時刻も変わらない", async () => {
    const w = await world("K677 読むだけ");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "ページ" });
    await addDraft(w, pid, 2, "下書き", w.mgr1);
    const snap = async () => ({
      pages: Number(
        (await h.admin.query("select count(*) as n from knowledge_pages where tenant_id = $1", [w.co.tenantId]))
          .rows[0]!["n"],
      ),
      versions: Number(
        (await h.admin.query("select count(*) as n from knowledge_page_versions where tenant_id = $1", [w.co.tenantId]))
          .rows[0]!["n"],
      ),
      audits: Number(
        (await h.admin.query("select count(*) as n from audit_events where tenant_id = $1", [w.co.tenantId])).rows[0]![
          "n"
        ],
      ),
      updated: String((await h.row(pid))!["updated_at"]),
    });
    const before = await snap();
    await detail(w.mgr1, pid);
    await call(w.mem1, `/knowledge_pages/${pid}/versions`);
    await call(w.mem1, `/knowledge_pages/${pid}/versions/1`);
    expect(await snap()).toEqual(before);
  });

  it("K677-API-023 上限を超えると 429（1 分 120 回の上限を 2 に差し替えた口の 3 回目）", async () => {
    const w = await world("K677 上限");
    const pid = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "ページ" });
    h.limits["getKnowledgePage"] = 2;
    try {
      expect((await call(w.mem1, `/knowledge_pages/${pid}`)).status).toBe(200);
      expect((await call(w.mem1, `/knowledge_pages/${pid}`)).status).toBe(200);
      const r = await call(w.mem1, `/knowledge_pages/${pid}`);
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["getKnowledgePage"];
    }
  });

  it("K677-DB-001 DB の関数 app.kn_page_ai_opened_30d：見える人には 30 日以内の数・見えない人（別のグループ・別の会社）には 0・消した記録は数えない", async () => {
    const w = await world("K677 DB の関数");
    const other = await world("K677 DB の関数（別の会社）");
    const pid = await h.page({ scope: w.g1, owner: w.mgr1, title: "営業のページ" });
    const t = await ticketOf(w);
    await opened(w, t, pid, 3);
    await opened(w, t, pid, 4);
    await opened(w, t, pid, 5);
    await h.admin.query(
      "update reference_logs set deleted_at = now() where ref_id = $1 and seen_at < now() - interval '4.5 days'",
      [pid],
    );
    const n = (p: Person) =>
      withTenant(h.pool, p.ctx, async (cl) =>
        Number((await cl.query<{ n: number }>("select app.kn_page_ai_opened_30d($1) as n", [pid])).rows[0]!.n),
      );
    expect(await n(w.mem1)).toBe(2);
    expect(await n(w.mem2)).toBe(0);
    expect(await n(other.boss)).toBe(0);
  });
});
