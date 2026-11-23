// K-475「検索条件を保存する・開く」の単体の試験（口・本物の DB）。名前の頭の行 ID（K475-API-…）は 11_tickets/K-475.md の行の表と 1 対 1。
// 口：GET /api/v1/saved_views（listSavedViews・問い合わせ share・scope_id）／POST /api/v1/saved_views（createSavedView）。
//   答えの 1 件：{ id, name, share, scope_id, filters, columns, density, member_id, member_name, mine, can_edit, created_at, updated_at }（13 個ちょうど）。
// 土台 saved-views.harness.ts（会社 A：グループ 2 つ・人 5 人／会社 B：人 1 人）。口の振る舞いは apps/api/src/hooks/saved-views.ts。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import {
  LIST_MAX,
  MAX_PER_PERSON,
  TEXT,
  VIEW_KEYS,
  VWS_BAD_SHAPE,
  VWS_CONTROL,
  VWS_FULL,
  VWS_NAME_LONG,
  VWS_NEED_SCOPE,
  VWS_NO_NAME,
  VWS_NO_SCOPE,
  VWS_SAME_NAME,
  W,
  asMember,
  captureLogs,
  createView,
  f,
  failsAs,
  fields,
  freshPerson,
  freshScope,
  json,
  listViews,
  num,
  one,
  rowOf,
  rowsOf,
  seedView,
  setupSavedViews,
  viewRow,
  viewsOf,
} from "./saved-views.harness.js";

setupSavedViews(["saved-views"]);

const names = async (r: Response) => rowsOf(await json(r)).map((x) => String(x["name"]));
const codeOf = async (r: Response) => String((await json(r))["code"]);

describe("K-475 検索条件を開く（listSavedViews・本物の DB）", () => {
  it("K475-API-001 一覧の形と並び：13 個の鍵ちょうど・表の列（tenant_id など）は出ない・名前の昇順・同じ名前は作った順", async () => {
    const s = await freshScope();
    const p = await freshPerson("並びの人", s);
    const mate = await freshPerson("並びの同僚", s);
    await seedView({ by: p, name: "C3", minutesAgo: 30 });
    await seedView({ by: p, name: "A1", minutesAgo: 20 });
    await seedView({ by: p, name: "B2", minutesAgo: 10 });
    // 同じ名前（人が違えば作れる）：自分の A1 と、同僚がグループに見せた A1。古い方が先
    await seedView({ by: mate, name: "A1", share: "group", scope: s, minutesAgo: 5 });
    const r = await listViews(p);
    expect(r.status).toBe(200);
    const rows = rowsOf(await json(r));
    expect(rows.map((x) => x["name"])).toEqual(["A1", "A1", "B2", "C3"]);
    expect(rows[0]!["member_id"]).toBe(p.id); // 古い A1（自分の）が先
    expect(rows[1]!["member_id"]).toBe(mate.id);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual([...VIEW_KEYS]);
    const text = JSON.stringify(rows);
    for (const k of ["tenant_id", "created_by", "deleted_at", "updated_by"]) expect(text).not.toContain(`"${k}"`);
  });

  it("K475-API-002 自分だけの条件：作った人の一覧に出る。同じグループの同僚・管理の人にも出ない", async () => {
    const p = await freshPerson("自分だけの人");
    const id = await seedView({ by: p, name: "SELF-ONLY", share: "self", scope: null });
    expect((await names(await listViews(p))).includes("SELF-ONLY")).toBe(true);
    for (const who of [W.mate, W.manager, W.top, W.other]) {
      const rows = rowsOf(await json(await listViews(who)));
      expect(rows.map((x) => x["id"])).not.toContain(id);
    }
  });

  it("K475-API-003 グループの全員に見せた条件：そのグループが見える人（席がそのグループ・その上のグループ）に出る。見えない人（別のグループの席・別の会社）には出ない", async () => {
    const p = await freshPerson("見せる人");
    const id = await seedView({ by: p, name: "SHARED-G1", share: "group", scope: W.g1 });
    const seen = async (who: typeof p) => rowsOf(await json(await listViews(who))).map((x) => x["id"]);
    expect(await seen(W.mate)).toContain(id);
    expect(await seen(W.manager)).toContain(id);
    expect(await seen(W.top)).toContain(id); // root の席は下のグループも見える
    expect(await seen(W.other)).not.toContain(id); // g2 の席
    expect(await seen(W.outsider)).not.toContain(id); // 別の会社
  });

  it("K475-API-004 mine と can_edit：作った人は true・true。同僚は false・false。マネージャー（edit を持つ）は mine false・can_edit true。自分だけの条件は作った人だけ", async () => {
    const p = await freshPerson("フラグの人");
    const id = await seedView({ by: p, name: "FLAGS", share: "group", scope: W.g1 });
    const pick = async (who: typeof p) =>
      rowsOf(await json(await listViews(who))).find((x) => x["id"] === id) as Record<string, unknown>;
    const mine = await pick(p);
    expect([mine["mine"], mine["can_edit"], mine["member_name"]]).toEqual([true, true, "フラグの人"]);
    const mate = await pick(W.mate);
    expect([mate["mine"], mate["can_edit"]]).toEqual([false, false]);
    const mgr = await pick(W.manager);
    expect([mgr["mine"], mgr["can_edit"]]).toEqual([false, true]);
  });

  it("K475-API-005 消した条件は出ない", async () => {
    const p = await freshPerson("消した人");
    await seedView({ by: p, name: "GONE", deleted: true });
    await seedView({ by: p, name: "ALIVE" });
    expect(await names(await listViews(p))).toEqual(["ALIVE"]);
  });

  it("K475-API-006 別の会社：会社 B の人の一覧に会社 A の条件（自分だけ・グループ）は 1 つも出ない。会社 A の人にも会社 B の条件は出ない", async () => {
    await seedView({ by: W.owner, name: "A-COMPANY-GROUP", share: "group", scope: W.g1 });
    const b = await seedView({ by: W.outsider, name: "B-COMPANY-SELF", share: "self", scope: null });
    const bRows = rowsOf(await json(await listViews(W.outsider)));
    expect(bRows.map((x) => x["name"])).toEqual(["B-COMPANY-SELF"]);
    const aRows = rowsOf(await json(await listViews(W.mate)));
    expect(aRows.map((x) => x["id"])).not.toContain(b);
  });

  it("K475-API-007 share で絞る：self は share が self の物（自分の）だけ・group は share が group の物（見える物）だけ。self と group 以外は 422（欄 share）", async () => {
    const s = await freshScope();
    const p = await freshPerson("絞る人", s);
    const mate = await freshPerson("絞る同僚", s);
    await seedView({ by: p, name: "S-ONE", share: "self", scope: null });
    await seedView({ by: p, name: "G-ONE", share: "group", scope: s });
    await seedView({ by: mate, name: "G-TWO", share: "group", scope: s });
    expect(await names(await listViews(p, "share=self"))).toEqual(["S-ONE"]);
    expect(await names(await listViews(p, "share=group"))).toEqual(["G-ONE", "G-TWO"]);
    const bad = await listViews(p, "share=everyone");
    expect(bad.status).toBe(422);
    expect(fields(await json(bad))).toEqual(["share"]);
  });

  it("K475-API-008 scope_id で絞る：そのグループに結んだ条件（自分だけでもグループでも）だけ。別のグループの物は出ない。uuid でない値は 422（欄 scope_id）", async () => {
    const p = await freshPerson("グループで絞る人");
    await seedView({ by: p, name: "IN-G1-SELF", share: "self", scope: W.g1 });
    await seedView({ by: p, name: "IN-G1-GROUP", share: "group", scope: W.g1 });
    await seedView({ by: p, name: "IN-G2-SELF", share: "self", scope: W.g2 });
    await seedView({ by: p, name: "NO-SCOPE", share: "self", scope: null });
    expect(await names(await listViews(p, `scope_id=${W.g1}`))).toEqual(["IN-G1-GROUP", "IN-G1-SELF"]);
    expect(await names(await listViews(p, `scope_id=${W.g2}`))).toEqual(["IN-G2-SELF"]);
    const bad = await listViews(p, "scope_id=not-a-uuid");
    expect(bad.status).toBe(422);
    expect(fields(await json(bad))).toContain("scope_id");
  });

  it("K475-API-009 知らない問い合わせ（sort など）は黙って無視せず 422（欄はその名前）", async () => {
    const p = await freshPerson("知らない問い合わせ");
    const r = await listViews(p, "sort=name");
    expect(r.status).toBe(422);
    expect(fields(await json(r))).toEqual(["sort"]);
    const r2 = await listViews(p, "colour=red");
    expect(r2.status).toBe(422);
    expect(fields(await json(r2))).toEqual(["colour"]);
  });

  it("K475-API-010 1 件も無い：200・空の並び", async () => {
    const p = await freshPerson("空の人");
    const r = await listViews(p);
    expect(r.status).toBe(200);
    expect(rowsOf(await json(r))).toEqual([]);
  });

  it("K475-API-011 上限：見える条件が 501 件ある人の一覧は名前の順の先頭 500 件で切り、ログに「一覧を 500 行で切った」が 1 行（名前は出ない）。500 件ちょうどなら切らずログも出ない", async () => {
    // 新しいグループの席に読む人と作者 11 人を置き、そのグループに見せた条件だけが見える形にする（同じ名前は 1 人 1 つ・作るときは 1 人 50 件までなので、人を分けて管理の接続で置く）
    const s = await freshScope();
    const reader = await freshPerson("読む人", s);
    const authors = await Promise.all(Array.from({ length: 11 }, (_, i) => freshPerson(`作者 ${i}`, s)));
    for (const [i, by] of authors.entries()) {
      await f.admin.query(
        `insert into saved_views (tenant_id, member_id, name, share, scope_id)
         select $1, $2, 'P' || lpad($5::text, 2, '0') || '_' || lpad(g::text, 4, '0'), 'group', $3 from generate_series(1, $4) g`,
        [W.tenantId, by.id, s, i < 10 ? 50 : 1, i],
      );
    }
    expect(await num("select count(*) as n from saved_views where scope_id = $1", [s])).toBe(501);
    let body: Record<string, unknown>[] = [];
    const logs = await captureLogs(async () => {
      body = rowsOf(await json(await listViews(reader)));
    });
    expect(body).toHaveLength(LIST_MAX);
    expect(body[0]!["name"]).toBe("P00_0001");
    expect(body[499]!["name"]).toBe("P09_0050");
    expect(logs.match(/一覧を 500 行で切った/g) ?? []).toHaveLength(1);
    expect(logs).not.toContain("P00_");
    // 1 件消して 500 件ちょうどにする
    await f.admin.query("update saved_views set deleted_at = now() where scope_id = $1 and name = 'P10_0001'", [s]);
    let justBody: Record<string, unknown>[] = [];
    const quiet = await captureLogs(async () => {
      justBody = rowsOf(await json(await listViews(reader)));
    });
    expect(justBody).toHaveLength(LIST_MAX);
    expect(quiet).not.toContain("一覧を 500 行で切った");
  });
});

describe("K-475 検索条件を保存する（createSavedView・本物の DB）", () => {
  it("K475-API-012 自分だけで保存（名前だけ送る）：201・既定の値（share self・scope_id null・filters {}・columns []・density normal）・mine と can_edit が true・別の読み（一覧）と DB に同じ値が出る", async () => {
    const p = await freshPerson("保存する人");
    const r = await createView(p, { name: "期限切れだけ" });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = rowOf(await json(r));
    expect(Object.keys(d).sort()).toEqual([...VIEW_KEYS]);
    expect(d["name"]).toBe("期限切れだけ");
    expect([d["share"], d["scope_id"], d["density"], d["mine"], d["can_edit"], d["member_id"]]).toEqual([
      "self",
      null,
      "normal",
      true,
      true,
      p.id,
    ]);
    expect(d["filters"]).toEqual({});
    expect(d["columns"]).toEqual([]);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const row = await viewRow(String(d["id"]));
    expect([row["member_id"], row["tenant_id"], row["name"], row["share"], row["created_by"]]).toEqual([
      p.id,
      p.tenantId,
      "期限切れだけ",
      "self",
      p.id,
    ]);
    const again = rowsOf(await json(await listViews(p))).find((x) => x["id"] === d["id"]);
    expect(again).toEqual(d);
  });

  it("K475-API-013 グループの全員に見せて保存：201・同じグループの同僚の一覧に出る・別のグループの席の人には出ない。並び・まとめ方・列は filters・columns の中身のまま返る", async () => {
    // 見せるグループ g1 が見える席（g1 の席）の人が保存する。filters の値は文字・数・真偽か 1 段の入れ物（配列は値に使えない・K475-API-019）
    const p = await freshPerson("見せて保存する人", W.g1);
    const filters = { view: "mine", sort: "due", group_by: "assignee", stage: "todo,doing" };
    const columns = ["title", "due_on", "assignee"];
    const r = await createView(p, {
      name: "営業の今週",
      share: "group",
      scope_id: W.g1,
      filters,
      columns,
      density: "compact",
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const d = rowOf(await json(r));
    expect([d["share"], d["scope_id"], d["density"]]).toEqual(["group", W.g1, "compact"]);
    expect(d["filters"]).toEqual(filters);
    expect(d["columns"]).toEqual(columns);
    const mateSees = rowsOf(await json(await listViews(W.mate))).find((x) => x["id"] === d["id"]);
    expect(mateSees).toBeTruthy();
    expect([mateSees!["mine"], mateSees!["can_edit"]]).toEqual([false, false]);
    expect(rowsOf(await json(await listViews(W.other))).map((x) => x["id"])).not.toContain(d["id"]);
  });

  it("K475-API-014 作った人は呼んだ人に決まる：本文に member_id・tenant_id・created_by などの知らない欄を付けると 422（何も書かない）", async () => {
    const p = await freshPerson("なりすます人");
    const before = await viewsOf(p);
    for (const extra of [{ member_id: W.mate.id }, { tenant_id: W.tenantB }, { created_by: W.mate.id }]) {
      const r = await createView(p, { name: "なりすまし", ...extra });
      expect(r.status).toBe(422);
    }
    expect(await viewsOf(p)).toBe(before);
    expect(await num("select count(*) as n from saved_views where name = 'なりすまし'")).toBe(0);
  });

  it("K475-API-015 名前が足りない・長い・制御文字：空・空白だけ（全角も）は 422 E-VWS-001／61 文字は 422 E-VWS-002／途中に改行・タブ・BEL は 422 E-VWS-008（欄は name・文は決めた文）。何も書かない", async () => {
    const p = await freshPerson("名前を間違える人");
    const cases: [string, string][] = [
      ["", VWS_NO_NAME],
      ["   ", VWS_NO_NAME],
      ["　　", VWS_NO_NAME],
      ["あ".repeat(61), VWS_NAME_LONG],
      ["前\n後", VWS_CONTROL],
      ["前\t後", VWS_CONTROL],
      ["前\u0007後", VWS_CONTROL],
    ];
    for (const [name, code] of cases) {
      const r = await createView(p, { name });
      expect(r.status, JSON.stringify(name)).toBe(422);
      const j = await json(r);
      expect(j["code"], JSON.stringify(name)).toBe(code);
      expect(j["message"]).toBe(TEXT[code]);
      expect(fields(j)).toEqual(["name"]);
    }
    const missing = await createView(p, {});
    expect(missing.status).toBe(422);
    expect(fields(await json(missing))).toContain("name");
    expect(await viewsOf(p)).toBe(0);
  });

  it("K475-API-016 名前の境目と表記ゆらぎ：60 文字は通る（全角 60 文字も）・前後の空白（全角も）は除かれる・全角英数は半角にそろう", async () => {
    const p = await freshPerson("境目の人");
    const ok60 = await createView(p, { name: "あ".repeat(60) });
    expect(ok60.status).toBe(201);
    expect([...String(rowOf(await json(ok60))["name"])]).toHaveLength(60);
    const trimmed = await createView(p, { name: "　 期限切れ　 " });
    expect(trimmed.status).toBe(201);
    expect(rowOf(await json(trimmed))["name"]).toBe("期限切れ");
    const wide = await createView(p, { name: "ＡＢＣ　１２３" });
    expect(wide.status).toBe(201);
    expect(rowOf(await json(wide))["name"]).toBe("ABC 123");
  });

  it("K475-API-017 share と density は決めた言葉だけ：share が self・group 以外／density が normal・compact 以外は 422（欄はその名前）。group で scope_id が無いのは 422 E-VWS-003（欄 scope_id）", async () => {
    const p = await freshPerson("言葉を間違える人");
    for (const [body, field] of [
      [{ name: "x", share: "everyone" }, "share"],
      [{ name: "x", density: "wide" }, "density"],
    ] as const) {
      const r = await createView(p, body);
      expect(r.status).toBe(422);
      expect(fields(await json(r))).toContain(field);
    }
    const noScope = await createView(p, { name: "x", share: "group" });
    expect(noScope.status).toBe(422);
    const j = await json(noScope);
    expect([j["code"], j["message"]]).toEqual([VWS_NEED_SCOPE, TEXT[VWS_NEED_SCOPE]]);
    expect(fields(j)).toEqual(["scope_id"]);
    const nullScope = await createView(p, { name: "x", share: "group", scope_id: null });
    expect(nullScope.status).toBe(422);
    expect(await codeOf(nullScope)).toBe(VWS_NEED_SCOPE);
    expect(await viewsOf(p)).toBe(0);
  });

  it("K475-API-018 見せるグループが見えない・無い：別のグループの席の人／別の会社のグループ／無い uuid／消したグループは 404 E-VWS-004（欄なし・scope_id・自分だけの保存に付けた scope_id も同じ）。何も書かない", async () => {
    const p = await freshPerson("g2 の席の人", W.g2);
    const gone = (
      await one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix, deleted_at) values ($1, $2, '消したグループ', 'VX', now()) returning id",
        [W.tenantId, W.root],
      )
    ).id;
    const targets = [W.g1, W.rootB, "11111111-1111-4111-8111-111111111111", gone];
    for (const scope_id of targets) {
      for (const share of ["group", "self"]) {
        const r = await createView(p, { name: "見えない所", share, scope_id });
        expect(r.status, `${share} ${scope_id}`).toBe(404);
        const j = await json(r);
        expect([j["code"], j["message"]]).toEqual([VWS_NO_SCOPE, TEXT[VWS_NO_SCOPE]]);
        // 404 は欄なし（在るかを漏らさない・控え帳 2026-11-20 20:50・2026-11-21 01:15）
        expect(fields(j)).toEqual([]);
        expect(j["details"]).toBeUndefined();
        expect(j["field"]).toBeUndefined();
      }
    }
    const bad = await createView(p, { name: "形違い", scope_id: "not-a-uuid" });
    expect(bad.status).toBe(422);
    expect(await viewsOf(p)).toBe(0);
  });

  it("K475-API-019 条件と列の形：filters が入れ物でない・欄が 9 個以上・欄の名前が決まりの外・値が配列か null・文字が 501 字以上・入れ物の中が 33 欄以上か入れ物の入れ物、columns が文字の並びでない・51 個以上・名前が 41 文字以上は 422 E-VWS-007（欄は filters か columns）。境目（欄 8 個・名前 40 字・文字 500 字・入れ物の中 32 欄・列 50 個・列の名前 40 文字）は通る", async () => {
    const p = await freshPerson("形を間違える人");
    const pairs = (n: number, value: unknown = "v") =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, value]));
    const bad: [Record<string, unknown>, string][] = [
      [{ filters: [] }, "filters"],
      [{ filters: "view=mine" }, "filters"],
      [{ filters: null }, "filters"],
      [{ filters: pairs(9) }, "filters"],
      [{ filters: { "a-b": "x" } }, "filters"],
      [{ filters: { ["k".repeat(41)]: "x" } }, "filters"],
      [{ filters: { memo: ["x"] } }, "filters"],
      [{ filters: { memo: null } }, "filters"],
      [{ filters: { memo: "x".repeat(501) } }, "filters"],
      [{ filters: { params: pairs(33) } }, "filters"],
      [{ filters: { params: { inner: { deep: "x" } } } }, "filters"],
      [{ filters: { params: { memo: "x".repeat(501) } } }, "filters"],
      [{ columns: { a: 1 } }, "columns"],
      [{ columns: ["title", 1] }, "columns"],
      [{ columns: Array.from({ length: 51 }, (_, i) => `c${i}`) }, "columns"],
      [{ columns: ["あ".repeat(41)] }, "columns"],
    ];
    for (const [extra, field] of bad) {
      const r = await createView(p, { name: `形 ${Math.random().toString(36).slice(2, 8)}`, ...extra });
      expect(r.status, JSON.stringify(extra).slice(0, 60)).toBe(422);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([VWS_BAD_SHAPE, TEXT[VWS_BAD_SHAPE]]);
      expect(fields(j)).toEqual([field]);
    }
    expect(await viewsOf(p)).toBe(0);
    const edge = await createView(p, {
      name: "境目",
      columns: Array.from({ length: 50 }, (_, i) => `c${i}`),
    });
    expect(edge.status).toBe(201);
    const longCol = await createView(p, { name: "境目 2", columns: ["あ".repeat(40)] });
    expect(longCol.status).toBe(201);
    const fullTop = await createView(p, {
      name: "境目 3",
      filters: { ...pairs(4), v: 1, view: "all", q: "x".repeat(500), params: pairs(32, "y".repeat(500)) },
    });
    expect(fullTop.status, await fullTop.clone().text()).toBe(201);
    const longKey = await createView(p, { name: "境目 4", filters: { ["k".repeat(40)]: true, n: 1.5 } });
    expect(longKey.status, await longKey.clone().text()).toBe(201);
  });

  it("K475-API-020 同じ名前は 1 人 1 つ：大文字小文字・全角半角の違いも同じ名前として 409 E-VWS-005（欄 name）。別の人は同じ名前で作れる。消したあとは同じ名前で作り直せる", async () => {
    const p = await freshPerson("同じ名前の人");
    expect((await createView(p, { name: "Abc" })).status).toBe(201);
    for (const name of ["Abc", "abc", "ＡＢＣ", "ａｂｃ　"]) {
      const r = await createView(p, { name });
      expect(r.status, name).toBe(409);
      const j = await json(r);
      expect([j["code"], j["message"]]).toEqual([VWS_SAME_NAME, TEXT[VWS_SAME_NAME]]);
      expect(fields(j)).toEqual(["name"]);
    }
    expect(await viewsOf(p)).toBe(1);
    const mate = await freshPerson("同じ名前の同僚");
    expect((await createView(mate, { name: "Abc" })).status).toBe(201);
    await f.admin.query("update saved_views set deleted_at = now() where member_id = $1", [p.id]);
    expect((await createView(p, { name: "Abc" })).status).toBe(201);
  });

  it("K475-API-021 1 人 50 件まで：50 件ある人の 51 件目は 409 E-VWS-006。消した物は数えない（1 件消せば作れる）・ほかの人の条件は数えない", async () => {
    const p = await freshPerson("たくさん持つ人");
    await f.admin.query(
      `insert into saved_views (tenant_id, member_id, name) select $1, $2, 'FULL_' || g from generate_series(1, $3) g`,
      [W.tenantId, p.id, MAX_PER_PERSON],
    );
    await seedView({ by: p, name: "DELETED", deleted: true });
    await freshPerson("ほかの人").then((o) => seedView({ by: o, name: "OTHERS", share: "group", scope: W.g1 }));
    expect(await viewsOf(p)).toBe(MAX_PER_PERSON);
    const r = await createView(p, { name: "51 件目" });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect([j["code"], j["message"]]).toEqual([VWS_FULL, TEXT[VWS_FULL]]);
    expect(await viewsOf(p)).toBe(MAX_PER_PERSON);
    await f.admin.query("update saved_views set deleted_at = now() where member_id = $1 and name = 'FULL_1'", [p.id]);
    expect((await createView(p, { name: "51 件目" })).status).toBe(201);
  });

  it("K475-API-022 同時に 2 回：49 件ある人が別の名前で同時に 2 件保存すると 1 件だけ入り、もう 1 件は 409 E-VWS-006。同じ名前を同時に 2 回なら 1 件だけ入り、もう 1 件は 409 E-VWS-005", async () => {
    const p = await freshPerson("同時に押す人");
    await f.admin.query(
      `insert into saved_views (tenant_id, member_id, name) select $1, $2, 'RACE_' || g from generate_series(1, $3) g`,
      [W.tenantId, p.id, MAX_PER_PERSON - 1],
    );
    const two = await Promise.all([createView(p, { name: "同時 A" }), createView(p, { name: "同時 B" })]);
    expect(two.map((r) => r.status).sort()).toEqual([201, 409]);
    const lost = two.find((r) => r.status === 409)!;
    expect(await codeOf(lost)).toBe(VWS_FULL);
    expect(await viewsOf(p)).toBe(MAX_PER_PERSON);
    const q = await freshPerson("同じ名前を同時に押す人");
    const same = await Promise.all([createView(q, { name: "同名" }), createView(q, { name: "同名" })]);
    expect(same.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await codeOf(same.find((r) => r.status === 409)!)).toBe(VWS_SAME_NAME);
    expect(await viewsOf(q)).toBe(1);
  });

  it("K475-API-023 DB の守り（口を通さない 2 層目）：他人の名前で入れる・見えないグループに見せる・同じ名前の 2 件目は DB が断る。人の名前・会社は後から書き換えられない（K-476 の引き金とは別。ここは入れるときだけ）", async () => {
    const p = await freshPerson("直に入れる人", W.g2);
    expect(
      await failsAs(p, "insert into saved_views (tenant_id, member_id, name) values ($1, $2, 'x')", [
        W.tenantId,
        W.mate.id,
      ]),
    ).toMatch(/row-level security/);
    expect(
      await failsAs(
        p,
        "insert into saved_views (tenant_id, member_id, name, share, scope_id) values ($1, $2, 'x', 'group', $3)",
        [W.tenantId, p.id, W.g1],
      ),
    ).toMatch(/row-level security/);
    await asMember(p, "insert into saved_views (tenant_id, member_id, name) values ($1, $2, 'Dup')", [
      W.tenantId,
      p.id,
    ]);
    const dup = await failsAs(p, "insert into saved_views (tenant_id, member_id, name) values ($1, $2, 'dup')", [
      W.tenantId,
      p.id,
    ]);
    expect(dup).toMatch(/duplicate key|saved_views_name_uq/);
    // 消した物は名前をふさがない
    await f.admin.query("update saved_views set deleted_at = now() where member_id = $1", [p.id]);
    expect(
      await failsAs(p, "insert into saved_views (tenant_id, member_id, name) values ($1, $2, 'dup')", [
        W.tenantId,
        p.id,
      ]),
    ).toBeNull();
  });

  it("K475-API-024 ログインしていない：一覧も保存も 401（何も書かない）", async () => {
    const before = await num("select count(*) as n from saved_views");
    const l = await f.req("GET", "/saved_views");
    const c = await f.req("POST", "/saved_views", { body: { name: "誰でもない" } });
    expect([l.status, c.status]).toEqual([401, 401]);
    expect(await num("select count(*) as n from saved_views")).toBe(before);
  });

  it("K475-API-025 上限：同じ人が 1 分の上限を超えたら一覧も保存も 429 と retry_after_sec（1〜60 の整数）", async () => {
    for (const [op, call] of [
      ["listSavedViews", (p: Awaited<ReturnType<typeof freshPerson>>) => listViews(p)],
      [
        "createSavedView",
        (p: Awaited<ReturnType<typeof freshPerson>>) => createView(p, { name: `上限 ${Math.random()}` }),
      ],
    ] as const) {
      const p = await freshPerson("上限の人");
      f.limits[op] = 2;
      try {
        await call(p);
        await call(p);
        const r = await call(p);
        expect(r.status, op).toBe(429);
        const s = Number((await json(r))["retry_after_sec"]);
        expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      } finally {
        f.limits[op] = 10_000;
      }
    }
  });

  it("K475-API-026 貯めない：一覧も保存も答えの Cache-Control に private と no-store", async () => {
    const p = await freshPerson("貯めない人");
    const l = await listViews(p);
    const c = await createView(p, { name: "貯めない" });
    for (const r of [l, c]) {
      const cc = r.headers.get("cache-control") ?? "";
      expect(cc).toContain("private");
      expect(cc).toContain("no-store");
    }
  });

  it("K475-API-027 証跡：保存すると証跡 saved_views.create（関門 C2）が 1 つ残り、中身は share だけで名前・条件は入らない。一覧を開いても証跡は増えない", async () => {
    const p = await freshPerson("証跡の人", W.g1); // g1 が見える席（見えないグループは 404・K475-API-018）
    const before = await num("select count(*) as n from audit_events where actor_member_id = $1", [p.id]);
    const r = await createView(p, {
      name: "証跡に名前を残さない",
      share: "group",
      scope_id: W.g1,
      filters: { q: "秘密" },
    });
    expect(r.status).toBe(201);
    await listViews(p);
    const rows = (
      await f.admin.query(
        "select action, target_type, target_id, choke_point_id, payload from audit_events where actor_member_id = $1 and action like 'saved_views.%'",
        [p.id],
      )
    ).rows as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!["action"]).toBe("saved_views.create");
    expect([rows[0]!["target_type"], rows[0]!["target_id"], rows[0]!["choke_point_id"]]).toEqual([
      "saved_views",
      rowOf(await json(r))["id"],
      "C2",
    ]);
    expect(rows[0]!["payload"]).toEqual({ share: "group" });
    expect(await num("select count(*) as n from audit_events where actor_member_id = $1", [p.id])).toBe(before + 1);
  });

  it("K475-API-028 失敗（手順 S2：証跡を書く）：証跡を書く所で DB が落ちると 503。条件の行は 1 つも残らない（1 つの取引）。戻れば同じ名前でもう一度保存できる", async () => {
    const p = await freshPerson("壊れる人");
    await f.admin.query(`create or replace function public.k475_boom() returns trigger language plpgsql as $$
      begin
        if new.action = 'saved_views.create' and new.actor_member_id = '${p.id}'::uuid then
          raise exception 'K475 の試験で壊した';
        end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k475_boom before insert on audit_events for each row execute function public.k475_boom()",
    );
    try {
      let status = 0;
      const logs = await captureLogs(async () => {
        status = (await createView(p, { name: "壊れる", filters: { q: "秘密の言葉" } })).status;
      });
      expect(status).toBe(503);
      expect(logs).not.toContain("秘密の言葉");
      expect(await viewsOf(p)).toBe(0);
    } finally {
      await f.admin.query("drop trigger if exists k475_boom on audit_events");
      await f.admin.query("drop function if exists public.k475_boom()");
    }
    expect((await createView(p, { name: "壊れる" })).status).toBe(201);
  });

  it("K475-API-029 失敗（手順 S1：DB に書く）：条件の行を入れる所で DB が落ちると 503。行も証跡も 1 つも残らない。戻れば同じ名前でもう一度保存できる", async () => {
    const p = await freshPerson("入れる所が壊れる人");
    await f.admin.query(`create or replace function public.k475_boom_row() returns trigger language plpgsql as $$
      begin
        if new.member_id = '${p.id}'::uuid then raise exception 'K475 の試験で行を壊した'; end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k475_boom_row before insert on saved_views for each row execute function public.k475_boom_row()",
    );
    try {
      let status = 0;
      await captureLogs(async () => {
        status = (await createView(p, { name: "入らない" })).status;
      });
      expect(status).toBe(503);
      expect(await viewsOf(p)).toBe(0);
      expect(await num("select count(*) as n from audit_events where actor_member_id = $1", [p.id])).toBe(0);
    } finally {
      await f.admin.query("drop trigger if exists k475_boom_row on saved_views");
      await f.admin.query("drop function if exists public.k475_boom_row()");
    }
    expect((await createView(p, { name: "入らない" })).status).toBe(201);
  });

  it("K475-API-030 失敗（一覧を読む所）：一覧を読む所で DB が落ちると 503・E-PAGE-003。ログに名前の字が無い。戻れば 200", async () => {
    const p = await freshPerson("一覧が壊れる人");
    expect((await createView(p, { name: "壊れる前の秘密の名前" })).status).toBe(201);
    await f.admin.query(`create or replace function public.k475_list_boom() returns boolean language plpgsql as $$
      begin
        if current_setting('app.user_id', true) = '${p.id}' then raise exception 'K475 の試験で一覧を壊した'; end if;
        return true;
      end $$`);
    await f.admin.query(
      "create policy k475_list_boom on saved_views as restrictive for select using (public.k475_list_boom())",
    );
    try {
      let status = 0;
      let code = "";
      const logs = await captureLogs(async () => {
        const r = await listViews(p);
        status = r.status;
        code = String((await json(r))["code"]);
      });
      expect(status).toBe(503);
      expect(code).toBe("E-PAGE-003");
      expect(logs).not.toContain("壊れる前の秘密の名前");
    } finally {
      await f.admin.query("drop policy if exists k475_list_boom on saved_views");
      await f.admin.query("drop function if exists public.k475_list_boom()");
    }
    expect((await listViews(p)).status).toBe(200);
  });
});
