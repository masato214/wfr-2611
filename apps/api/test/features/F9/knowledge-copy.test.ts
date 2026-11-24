// K-690「写して直す：自分の棚に写しを作る・元を残す（copyKnowledgePage）」の単体の試験（口・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K690-API-NNN（チケット 11_tickets/K-690.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   土台は knowledge.harness.ts（K-675）と knowledge.requests-kit.ts（K-687）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   共有された物を写す行（K690-API-003）は K-689 の共有の行（行の守りの外で入れる）を使う。帯・操作・木の印は前の葉の口（ページを読む・木）を通して見る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bodyOf, setupKnowledge, type Person } from "./knowledge.harness.js";
import {
  allAudits,
  audits,
  breakWrites,
  findNode,
  makeWorld,
  seedRequest,
  type Json,
  type World,
} from "./knowledge.requests-kit.js";

const h = setupKnowledge();
const world = (label: string): Promise<World> => makeWorld(h, label);

const call = async (p: Person | null, method: string, path: string, body?: unknown): Promise<Response> => {
  await h.ready();
  return h.req(method, path, { ...(p ? { headers: h.as(p) } : {}), ...(body === undefined ? {} : { body }) });
};
const copy = (p: Person | null, id: string, body: unknown = {}) => call(p, "POST", `/knowledge_pages/${id}/copy`, body);
const codeOf = async (r: Response): Promise<string> => ((await r.json()) as Json)["code"] as string;
const created = async (r: Response): Promise<string> => {
  expect(r.status).toBe(201);
  return ((await h.json(r)).data as Json)["id"] as string;
};
const readPage = async (p: Person, id: string): Promise<Json> => {
  const r = await call(p, "GET", `/knowledge_pages/${id}`);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const readTree = async (p: Person): Promise<Json> =>
  (await h.json(await call(p, "GET", "/knowledge/tree"))).data as Json;
const copiesOf = async (src: string): Promise<Record<string, unknown>[]> =>
  (await h.admin.query("select * from knowledge_pages where copied_from_page_id = $1 order by created_at, id", [src]))
    .rows;
const versionsOf = async (id: string): Promise<Record<string, unknown>[]> =>
  (await h.admin.query("select * from knowledge_page_versions where page_id = $1 order by version, created_at", [id]))
    .rows;
const grp = (
  scope: string,
  owner: Person,
  o: {
    title?: string;
    text?: string;
    must?: boolean;
    state?: "draft" | "published";
    summary?: string;
    folder?: string | null;
    position?: number;
  } = {},
) => h.page({ scope, owner, title: o.title ?? "元のページ", ...o });
const liveShare = async (w: World, page: string, group: string): Promise<void> => {
  const rid = await seedRequest(h, w, {
    kind: "share",
    page,
    fromScope: w.g1,
    toScope: group,
    by: w.mgr1,
    state: "approved",
    decidedBy: w.mgr2,
  });
  await h.admin.query(
    "insert into knowledge_shares (tenant_id, page_id, group_id, request_id, shared_by) values ($1, $2, $3, $4, $5)",
    [w.co.tenantId, page, group, rid, w.mgr1.id],
  );
};

describe("K-690 写して直す", () => {
  it("K690-API-001 会社の棚のページを写す：201・答えの鍵はちょうど 6（id・title・desc・state・must・place）・題名と説明は元のまま・公開済み・必ず守るなし・置き場は自分の棚（shelf me・shelf_name 自分・group_id null・folder_id null）。DB は自分の棚（本人の主のグループ・自分の棚の印）・持ち主は本人・版 1・写しの元つき・並びは 10。版 1 は元の公開の最新の本文そのまま（作った人・公開した人は本人）。元は何も変わらない", async () => {
    const w = await world("K690 写す");
    const src = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "経費の精算",
      summary: "精算の流れ",
      text: "元の本文",
    });
    const before = await h.row(src);
    const beforeVersions = await versionsOf(src);
    const r = await copy(w.mem1, src);
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["desc", "id", "must", "place", "state", "title"]);
    expect(d).toMatchObject({ title: "経費の精算", desc: "精算の流れ", state: "published", must: false });
    expect(d["place"]).toEqual({ shelf: "me", shelf_name: "自分", group_id: null, folder_id: null, folders: [] });
    const id = d["id"] as string;
    expect(id).not.toBe(src);
    expect(await h.row(id)).toMatchObject({
      scope_id: w.mem1.scopeId,
      is_personal: true,
      owner_member_id: w.mem1.id,
      state: "published",
      is_must: false,
      title: "経費の精算",
      summary: "精算の流れ",
      current_version: 1,
      copied_from_page_id: src,
      folder_id: null,
      position: 10,
    });
    const vs = await versionsOf(id);
    expect(vs.length).toBe(1);
    expect(vs[0]).toMatchObject({
      version: 1,
      kind: "published",
      author_member_id: w.mem1.id,
      published_by: w.mem1.id,
      deleted_at: null,
    });
    expect(vs[0]!["body"]).toEqual(bodyOf("元の本文"));
    expect(vs[0]!["published_at"]).not.toBeNull();
    expect(await h.row(src)).toEqual(before);
    expect(await versionsOf(src)).toEqual(beforeVersions);
  });

  it("K690-API-002 だれが写せるか：会社のページはどの役の人も（閲覧のみ・どこにも入っていない人・管理者も）自分の棚に写せる（置き場の棚は本人の主の所属）。グループのページはそのグループの人が写せる（マネージャーも）。元はグループのページのまま残る", async () => {
    const w = await world("K690 だれが");
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    for (const p of [w.mem1, w.view1, w.mgr1, w.mem2, w.none, w.boss, w.boss2]) {
      const id = await created(await copy(p, company));
      expect(await h.row(id), p.id).toMatchObject({
        scope_id: p.scopeId,
        is_personal: true,
        owner_member_id: p.id,
        copied_from_page_id: company,
      });
    }
    const gp = await grp(w.g1, w.mgr1, { title: "営業のページ" });
    for (const p of [w.mem1, w.view1, w.mgr1b, w.mgr1]) {
      const id = await created(await copy(p, gp));
      expect(await h.row(id), p.id).toMatchObject({ scope_id: p.scopeId, is_personal: true, copied_from_page_id: gp });
    }
    expect(await h.row(gp)).toMatchObject({ scope_id: w.g1, is_personal: false, owner_member_id: w.mgr1.id });
  });

  it("K690-API-003 共有された物も写せる：共有先のグループの人は、共有されたページ・共有されたフォルダの中のページを自分の棚に写せる。共有をやめた後は 404", async () => {
    const w = await world("K690 共有を写す");
    const p = await grp(w.g1, w.mgr1, { title: "個別に共有" });
    const f = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const inF = await grp(w.g1, w.mgr1, { title: "フォルダの中", folder: f });
    await liveShare(w, p, w.g2);
    await h.admin.query(
      "insert into knowledge_shares (tenant_id, folder_id, group_id, shared_by) values ($1, $2, $3, $4)",
      [w.co.tenantId, f, w.g2, w.mgr1.id],
    );
    for (const src of [p, inF]) {
      const id = await created(await copy(w.mem2, src));
      expect(await h.row(id), src).toMatchObject({
        scope_id: w.g2,
        is_personal: true,
        owner_member_id: w.mem2.id,
        copied_from_page_id: src,
      });
    }
    expect((await copy(w.mem3, p)).status).toBe(404);
    await h.admin.query("update knowledge_shares set ended_at = now() where page_id = $1", [p]);
    expect((await copy(w.mem2, p)).status).toBe(404);
  });

  it("K690-API-004 入れるフォルダ：自分の棚のフォルダなら写しがそのフォルダの最後（30 の次の 40）に入る（place に folder_id と folders）。会社・グループ・他人の自分のフォルダ・無い・消した・別の会社のフォルダは 404。どれも写しは増えない", async () => {
    const w = await world("K690 フォルダ");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    const mine = await h.folder({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, name: "メモ" });
    const gone = await h.folder({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, name: "消す" });
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [gone]);
    await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      title: "先に居る",
      folder: mine,
      position: 30,
    });
    const fCompany = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "全社" });
    const fGroup = await h.folder({ scope: w.g1, owner: w.mgr1, name: "営業の手順" });
    const fOther = await h.folder({ scope: w.mem2.scopeId, owner: w.mem2, personal: true, name: "他人のメモ" });
    const co2 = await h.company("K690 別の会社");
    const boss9 = await h.person(co2.tenantId, co2.rootScope, { name: "別の会社の管理者", role: "admin" });
    const fForeign = await h.folder({ scope: co2.rootScope, owner: boss9, name: "別の会社" });
    for (const f of [fCompany, fGroup, fOther, gone, fForeign, randomUUID()]) {
      const r = await copy(w.mem1, src, { folder_id: f });
      expect(r.status, f).toBe(404);
      expect(await codeOf(r), f).toBe("NOT_FOUND");
    }
    expect((await copiesOf(src)).length).toBe(0);
    const r = await copy(w.mem1, src, { folder_id: mine });
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Json;
    expect(d["place"]).toEqual({ shelf: "me", shelf_name: "自分", group_id: null, folder_id: mine, folders: ["メモ"] });
    expect(await h.row(d["id"] as string)).toMatchObject({ folder_id: mine, position: 40 });
  });

  it("K690-API-005 写せないページ：自分の棚のページは 409 E-KNW-080・まだ書き終えていないページ（グループの持ち主から見た下書き・自分の下書き）は 409 E-KNW-010（010 が先）。体は error と code だけで、写しは増えない", async () => {
    const w = await world("K690 写せない");
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true, title: "自分のページ" });
    const r1 = await copy(w.mem1, mine);
    expect(r1.status).toBe(409);
    expect(await codeOf(r1)).toBe("E-KNW-080");
    expect(Object.keys((await copy(w.mem1, mine).then((r) => r.json())) as Json).sort()).toEqual(["code", "error"]);
    const myDraft = await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      state: "draft",
      title: "自分の下書き",
    });
    const groupDraft = await grp(w.g1, w.mgr1, { state: "draft", title: "グループの下書き" });
    for (const [p, id] of [
      [w.mem1, myDraft],
      [w.mgr1, groupDraft],
    ] as [Person, string][]) {
      const r = await copy(p, id);
      expect(r.status, id).toBe(409);
      expect(await codeOf(r), id).toBe("E-KNW-010");
    }
    expect((await copiesOf(mine)).length + (await copiesOf(myDraft)).length + (await copiesOf(groupDraft)).length).toBe(
      0,
    );
  });

  it("K690-API-006 見えないページ：ほかのグループのページ・他人の自分のページ・他人の下書き・消したページ・無い id・別の会社の人は 404（体は error と code だけ）。写しは増えない", async () => {
    const w = await world("K690 見えない");
    const gp = await grp(w.g1, w.mgr1);
    const others = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true });
    const draft = await grp(w.g1, w.mgr1, { state: "draft" });
    const gone = await grp(w.g1, w.mgr1, { title: "消した" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const co2 = await h.company("K690 別の会社 2");
    const foreign = await h.person(co2.tenantId, co2.rootScope, { name: "別の会社の管理者", role: "admin" });
    const cases: [Person, string][] = [
      [w.mem2, gp],
      [w.mgr1, others],
      [w.mem1, draft],
      [w.mem1, gone],
      [w.mem1, randomUUID()],
      [foreign, gp],
    ];
    for (const [p, id] of cases) {
      const r = await copy(p, id);
      expect(r.status, id).toBe(404);
      expect(await r.json(), id).toEqual({ error: "not_found", code: "NOT_FOUND" });
    }
    expect((await copiesOf(gp)).length + (await copiesOf(others)).length + (await copiesOf(draft)).length).toBe(0);
  });

  it("K690-API-007 同じページを 2 回写せる：2 回写すと別のページが 2 つでき、題名は同じ・どちらも元を指す。片方を直しても、もう片方と元は変わらない", async () => {
    const w = await world("K690 2 回");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    const a = await created(await copy(w.mem1, src));
    const b = await created(await copy(w.mem1, src));
    expect(a).not.toBe(b);
    const rows = await copiesOf(src);
    expect(rows.map((x) => x["id"]).sort()).toEqual([a, b].sort());
    expect(rows.every((x) => x["title"] === "会社のページ" && x["copied_from_page_id"] === src)).toBe(true);
    expect(rows.map((x) => x["position"])).toEqual([10, 20]);
    await h.admin.query("update knowledge_pages set title = '直した' where id = $1", [a]);
    expect(await h.row(b)).toMatchObject({ title: "会社のページ" });
    expect(await h.row(src)).toMatchObject({ title: "会社のページ" });
  });

  it("K690-API-008 必ず守るは写さない：元が必ず守るでも写しは必ず守るなし（答えも DB も）。自分の棚の必ず守るの上限は使わない（写しに付けると used は 1）", async () => {
    const w = await world("K690 必ず守る");
    const src = await grp(w.g1, w.mgr1, { title: "必ず守る", must: true });
    const d = (await h.json(await copy(w.mem1, src))).data as Json;
    expect(d["must"]).toBe(false);
    expect(await h.row(d["id"] as string)).toMatchObject({ is_must: false });
    const on = await call(w.mem1, "PUT", `/knowledge_pages/${d["id"]}/must`, { must: true });
    expect(on.status).toBe(200);
    expect((await h.json(on)).data).toMatchObject({ must: true, used: 1, limit: 10 });
    expect(await h.row(src)).toMatchObject({ is_must: true });
  });

  it("K690-API-009 写すのは今の公開の版：元に公開の版 2 があれば版 2 の本文が写る（写しは版 1）。元の書いている途中の下書きの版は写さず、元の版は増えない", async () => {
    const w = await world("K690 版");
    const src = await grp(w.g1, w.mgr1, { title: "版が進んだ", text: "最初の本文" });
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, 2, 'published', $3::jsonb, $4, now(), $4)",
      [w.co.tenantId, src, JSON.stringify(bodyOf("二つ目の本文")), w.mgr1.id],
    );
    await h.admin.query("update knowledge_pages set current_version = 2 where id = $1", [src]);
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 3, 'draft', $3::jsonb, $4)",
      [w.co.tenantId, src, JSON.stringify(bodyOf("途中の下書き")), w.mgr1.id],
    );
    const id = await created(await copy(w.mem1, src));
    const vs = await versionsOf(id);
    expect(vs.length).toBe(1);
    expect(vs[0]!["body"]).toEqual(bodyOf("二つ目の本文"));
    expect((await versionsOf(src)).length).toBe(3);
    expect(await h.row(src)).toMatchObject({ current_version: 2 });
  });

  it("K690-API-010 入力の形：uuid でない folder_id・数・知らない欄・配列の体は 422（コード VALIDATION_ERROR）で写しは増えない。空の体は通る", async () => {
    const w = await world("K690 入力");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss });
    for (const b of [{ folder_id: "x" }, { folder_id: 5 }, { foo: 1 }, []] as unknown[]) {
      const r = await copy(w.mem1, src, b);
      expect(r.status, JSON.stringify(b)).toBe(422);
      expect(await codeOf(r)).toBe("VALIDATION_ERROR");
    }
    expect((await copiesOf(src)).length).toBe(0);
    expect((await copy(w.mem1, src, {})).status).toBe(201);
  });

  it("K690-API-011 証跡：写すと knowledge.page.copy が 1 行（操作した人・対象は新しい写し・種類 knowledge_pages・関門 C2・payload は空）。断った操作（404・409・422）には残らず、題名を入れない", async () => {
    const w = await world("K690 証跡");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "秘密の題名" });
    await copy(w.mem1, randomUUID());
    await copy(w.mem1, src, { folder_id: "x" });
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true });
    await copy(w.mem1, mine);
    expect(await allAudits(h, w)).toBe(0);
    const id = await created(await copy(w.mem1, src));
    const rows = await audits(h, w, "knowledge.page.copy");
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      actor_member_id: w.mem1.id,
      target_type: "knowledge_pages",
      target_id: id,
      choke_point_id: "C2",
    });
    expect(JSON.stringify(rows[0]!.payload ?? {})).toBe("{}");
    expect(JSON.stringify(rows[0])).not.toContain("秘密");
  });

  it("K690-API-012 失敗（手順 1）：写しのページを書く所で DB が落ちると 503 E-PAGE-003・写しは残らず、ログに題名を出さない。そのあとの写しは通る", async () => {
    const w = await world("K690 失敗 1");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "秘密の題名" });
    await h.ready();
    const fix = await breakWrites(h, "knowledge_pages", w.co.tenantId);
    let logs = "";
    try {
      logs = await h.captureLogs(async () => {
        const r = await copy(w.mem1, src);
        expect(r.status).toBe(503);
        expect(await codeOf(r)).toBe("E-PAGE-003");
      });
    } finally {
      await fix();
    }
    expect((await copiesOf(src)).length).toBe(0);
    expect(logs).not.toContain("秘密の");
    expect((await copy(w.mem1, src)).status).toBe(201);
  });

  it("K690-API-013 失敗（手順 2）：版を書いて公開にする所で DB が落ちると 503 E-PAGE-003・同じ取引なので写しのページも残らない。そのあとの写しは通る", async () => {
    const w = await world("K690 失敗 2");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss });
    await h.ready();
    const fix = await breakWrites(h, "knowledge_page_versions", w.co.tenantId);
    try {
      expect((await copy(w.mem1, src)).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await copiesOf(src)).length).toBe(0);
    expect((await copy(w.mem1, src)).status).toBe(201);
  });

  it("K690-API-014 失敗（手順 3）：証跡を書く所で DB が落ちると 503 E-PAGE-003・写しも版も残らず証跡も増えない。そのあとの写しは通る", async () => {
    const w = await world("K690 失敗 3");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss });
    await h.ready();
    const fix = await breakWrites(h, "audit_events", w.co.tenantId);
    try {
      expect((await copy(w.mem1, src)).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await copiesOf(src)).length).toBe(0);
    expect(await allAudits(h, w)).toBe(0);
    expect((await copy(w.mem1, src)).status).toBe(201);
  });

  it("K690-API-015 ログインしていない：401", async () => {
    expect((await copy(null, randomUUID())).status).toBe(401);
  });

  it("K690-API-016 上限を超えると 429（1 分 30 回の上限を 2 に差し替えた口の 3 回目）", async () => {
    const w = await world("K690 呼べる回数");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss });
    h.limits["copyKnowledgePage"] = 2;
    try {
      expect((await copy(w.mem1, src)).status).toBe(201);
      expect((await copy(w.mem1, src)).status).toBe(201);
      const r = await copy(w.mem1, src);
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["copyKnowledgePage"];
    }
  });

  it("K690-API-017 権限の波及：グループを抜けた人は次の写しから 404（会社のページは写せて置き場は今の主の所属）・共有先から抜けた人も 404。入り直しは要らない", async () => {
    const w = await world("K690 波及");
    const gp = await grp(w.g1, w.mgr1, { title: "営業のページ" });
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    expect((await copy(w.mem1, gp)).status).toBe(201);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.co.rootScope]);
    expect((await copy(w.mem1, gp)).status).toBe(404);
    const id = await created(await copy(w.mem1, company));
    expect(await h.row(id)).toMatchObject({ scope_id: w.co.rootScope, is_personal: true, owner_member_id: w.mem1.id });
    await liveShare(w, gp, w.g2);
    expect((await copy(w.mem2, gp)).status).toBe(201);
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem2.id, w.g2]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem2.id, w.co.rootScope]);
    expect((await copy(w.mem2, gp)).status).toBe(404);
  });

  it("K690-API-018 写しの帯：写しを読むと copied_from が { page_id 元・title・shelf_name 営業・folders（棚の直下なら空）・must（元が必ず守るなら true）・gone false }・acts に直す。元を消すと { page_id null・title 空・shelf_name 空・folders 空・must false・gone true }（元が見えなくなったときも同じ）", async () => {
    const w = await world("K690 帯");
    const src = await grp(w.g1, w.mgr1, { title: "元のページ", must: true });
    const id = await created(await copy(w.mem1, src));
    const d = await readPage(w.mem1, id);
    expect(d["copied_from"]).toEqual({
      page_id: src,
      title: "元のページ",
      shelf_name: "営業",
      folders: [],
      must: true,
      gone: false,
    });
    expect(d["acts"]).toContain("edit");
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [src]);
    expect((await readPage(w.mem1, id))["copied_from"]).toEqual({
      page_id: null,
      title: "",
      shelf_name: "",
      folders: [],
      must: false,
      gone: true,
    });
    const src2 = await grp(w.g1, w.mgr1, { title: "見えなくなる元" });
    const id2 = await created(await copy(w.mem1, src2));
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.co.rootScope]);
    expect((await readPage(w.mem1, id2))["copied_from"]).toEqual({
      page_id: null,
      title: "",
      shelf_name: "",
      folders: [],
      must: false,
      gone: true,
    });
  });

  it("K690-API-019 「写して直す」の操作：上の棚（会社・グループ・共有）の公開済みページを読むと acts に copy が入る（読むだけの人にも）。自分の棚のページ・自分の写し・書き終えていないページには入らない", async () => {
    const w = await world("K690 操作");
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社" });
    const gp = await grp(w.g1, w.mgr1, { title: "営業" });
    await liveShare(w, gp, w.g2);
    for (const [p, id] of [
      [w.mem1, company],
      [w.view1, company],
      [w.none, company],
      [w.mem1, gp],
      [w.view1, gp],
      [w.mgr1, gp],
      [w.mem2, gp],
    ] as [Person, string][])
      expect((await readPage(p, id))["acts"], `${p.id} ${id}`).toContain("copy");
    expect((await readPage(w.mem2, gp))["acts"]).not.toContain("edit");
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true });
    const mineCopy = await created(await copy(w.mem1, company));
    const draft = await grp(w.g1, w.mgr1, { state: "draft", title: "書きかけ" });
    expect((await readPage(w.mem1, mine))["acts"]).not.toContain("copy");
    expect((await readPage(w.mem1, mineCopy))["acts"]).not.toContain("copy");
    expect((await readPage(w.mgr1, draft))["acts"]).not.toContain("copy");
  });

  it("K690-API-020 木の印：写しは自分の木（自分の棚）に写しの印（mark copy）・必ず守るなしで出る。写しの元（上の棚）の木は変わらない", async () => {
    const w = await world("K690 木");
    const src = await grp(w.g1, w.mgr1, { title: "元のページ", must: true });
    const id = await created(await copy(w.mem1, src));
    const tree = await readTree(w.mem1);
    expect(findNode({ my_nodes: tree["my_nodes"] }, id)).toMatchObject({
      kind: "page",
      title: "元のページ",
      must: false,
      mark: "copy",
    });
    expect(findNode({ my_nodes: tree["my_nodes"] }, src)).toBeNull();
    const g = (tree["groups"] as Json[]).find((x) => x["id"] === w.g1)!;
    expect(findNode({ groups: [g] }, src)).toMatchObject({ must: true, mark: null });
  });

  it("K690-API-021 同時に写す：同じページを 2 人（同じ人の 2 つの画面）が同時に写すと、どちらも 201 で別の写しが 2 つできる（版は写しごとに 1 つ）", async () => {
    const w = await world("K690 同時");
    const src = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    await h.ready();
    const rs = await Promise.all([copy(w.mem1, src), copy(w.mem1, src)]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    const rows = await copiesOf(src);
    expect(rows.length).toBe(2);
    for (const row of rows) expect((await versionsOf(row["id"] as string)).length).toBe(1);
  });
});
