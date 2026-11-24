// K-560「詳細と一覧の読みの足し」の単体の試験（口・本物の DB）。名前の頭の行 ID（K560-API-…）は 11_tickets/K-560.md の行の表と 1 対 1。
// 段 5 の作り直し（本文 1 枚・会社が足す項目・確認項目は文とチェックだけ）後の形。足す物（どれも読むだけ・口の数も getTicket の文の数も増やさない）：
//   ① 一覧 listTickets の行に scope（チケットを置いたグループ { id, name, code }・code は頭文字＝ticket_prefix か null）
//   ② 詳細 getTicket の答えに parent・child_count・link_count（前のまま）
//   ③ 詳細の答えに body { doc, text, version }・fields（その種別で出す会社の項目と値）・spec_count・spec_unchecked・no_spec_reason・results（成果物・決定ログ・申し送りが在るときだけ）
//      区画の並び sections は、この試験では在る無しを見ない（K-560 の後・K-578 の前は前のまま残り、K-578 の後は無い。K-560 の間の姿は ticket-read-adds-legacy-sections.test.ts の K560-API-028・K-578 の後は K578-API-002）。kind の中に sections は足さない
//   ④ listTicketKinds の各種別に body_template（ひな形）と fields（その種別で出す会社の項目のマスタ・値なし。作る面が項目のために口を足さない）。sections（区画）の在る無しは見ない（同上）
// 試験ごとに別の会社を作り、ほかの試験のチケットを混ぜない。チケットは作る口（K-437 の新しい形・body で）で作り、並びの値・親・段・消した印は管理の接続で直す。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;

type Row = Record<string, unknown>;
type KindInfo = { id: string; name: string };
interface World {
  tenantId: string;
  root: string;
  me: Person;
  mate: Person;
  kinds: Record<string, KindInfo>;
}
interface Made {
  id: string;
  number: string;
}

const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const asJson = async (r: Response) => (await r.json()) as Row & { data?: unknown };
const keysOf = (o: unknown) => Object.keys(o as object).sort();
const ids = (rows: Row[]) => rows.map((x) => String(x["id"]));

async function world(prefix = "EG"): Promise<World> {
  const c = await f.company(`K560 の会社 ${Math.random().toString(36).slice(2, 7)}`, prefix);
  const me = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const mate = await f.person(c.tenantId, c.rootScope, { name: "山田", ticketAbility: "edit" });
  const list = (await asJson(await f.req("GET", "/ticket_kinds", { headers: me.auth }))).data as KindInfo[];
  return { tenantId: c.tenantId, root: c.rootScope, me, mate, kinds: Object.fromEntries(list.map((k) => [k.name, k])) };
}

/** 根の下に見えるグループを足す（名前・頭文字つき。頭文字は null も空も作れる）。高本と山田に書く権限を付ける */
async function group(w: World, name: string, prefix: string | null): Promise<string> {
  const id = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
      [w.tenantId, w.root, name, prefix],
    )
  ).rows[0]!.id;
  for (const p of [w.me, w.mate])
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
      [w.tenantId, p.id, id],
    );
  return id;
}
/** 根の下に置かないグループ（根の権限で見えない・K-92 と同じ作り方）。住人を 1 人つける */
async function hiddenGroup(w: World, name: string, prefix: string): Promise<{ id: string; member: Person }> {
  const id = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, $3) returning id",
      [w.tenantId, name, prefix],
    )
  ).rows[0]!.id;
  return { id, member: await f.person(w.tenantId, id, { name: "経理の人", ticketAbility: "edit" }) };
}

/** 作る口でチケットを 1 件作る。種別は名前で選ぶ（本文は「書いた」の 1 段落） */
async function make(
  w: World,
  o: { title?: string; kind?: string; by?: Person; assignee?: Person; scope?: string; parent?: string } = {},
): Promise<Made> {
  const kind = w.kinds[o.kind ?? "タスク"]!;
  const r = await f.req("POST", "/tickets", {
    body: {
      scope_id: o.scope ?? w.root,
      kind_id: kind.id,
      title: o.title ?? "請求書を送る",
      assignee_member_id: (o.assignee ?? w.me).id,
      due_on: jst(3),
      body: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "書いた" }] }] } },
      ...(o.parent ? { parent_ticket_id: o.parent } : {}),
    },
    headers: (o.by ?? w.me).auth,
  });
  expect(r.status, await r.clone().text()).toBe(201);
  const d = (await asJson(r)).data as Made;
  return { id: d.id, number: d.number };
}

/** 管理の接続でチケットの列を直す（引き金を止めた 1 つのトランザクション・K-92 と同じ） */
async function setCols(id: string, cols: Record<string, unknown>) {
  const keys = Object.keys(cols);
  const c = await f.admin.connect();
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    await c.query(`update tickets set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`, [
      id,
      ...keys.map((k) => cols[k]),
    ]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
async function setStage(id: string, key: string) {
  await f.admin.query(
    "update tickets t set stage_id = s.id from ticket_stages s where t.id = $1 and s.tenant_id = t.tenant_id and s.key = $2",
    [id, key],
  );
}

const list = (who: Person, q = "") => f.req("GET", `/tickets${q ? `?${q}` : ""}`, { headers: who.auth });
type Page = { data: Row[]; meta: { next_cursor: string | null } };
async function listOk(who: Person, q = ""): Promise<Page> {
  const r = await list(who, q);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await r.json()) as Page;
}
const detail = (who: Person, id: string) => f.req("GET", `/tickets/${id}`, { headers: who.auth });
async function detailOk(who: Person, id: string): Promise<Row> {
  const r = await detail(who, id);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await asJson(r)).data as Row;
}
/** DB の関数を口を通さずに、その人の文脈で呼ぶ（2 層目） */
const familyOf = (tenantId: string, who: Person, id: string) =>
  withTenant(
    f.pool,
    { tenantId, userId: who.id, role: "member" as const, stepUpAt: null },
    async (c) => (await c.query<{ v: Row | null }>("select app.ticket_read_adds($1) as v", [id])).rows[0]!.v,
  );

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  f.limits["listTickets"] = 10_000;
  f.limits["getTicket"] = 10_000;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-560 一覧の行の scope（チケットを置いたグループ）", () => {
  it("K560-API-001 グループ「営業」（頭文字 EM）に置いたチケットの行に scope が付く：{ id, name, code } の 3 つだけ", async () => {
    const w = await world();
    const g = await group(w, "営業", "EM");
    const t = await make(w, { scope: g });
    const row = (await listOk(w.me, "view=all")).data.find((x) => x["id"] === t.id)!;
    expect(row["scope"]).toEqual({ id: g, name: "営業", code: "EM" });
    expect(keysOf(row["scope"])).toEqual(["code", "id", "name"]);
  });

  it("K560-API-002 頭文字が無い（null）・空文字のグループは code が null（name と id は出る）", async () => {
    const w = await world();
    // 番号の頭に頭文字が要るので、頭文字ありで作ってから頭文字を null・空に直す（作った後に頭文字を外したグループ）
    const gNull = await group(w, "総務", "SM");
    const gEmpty = await group(w, "法務", "HM");
    const a = await make(w, { scope: gNull });
    const b = await make(w, { scope: gEmpty });
    await f.admin.query("update scopes set ticket_prefix = null where id = $1", [gNull]);
    await f.admin.query("update scopes set ticket_prefix = '' where id = $1", [gEmpty]);
    const rows = (await listOk(w.me, "view=all")).data;
    expect(rows.find((x) => x["id"] === a.id)!["scope"]).toEqual({ id: gNull, name: "総務", code: null });
    expect(rows.find((x) => x["id"] === b.id)!["scope"]).toEqual({ id: gEmpty, name: "法務", code: null });
  });

  it("K560-API-003 mine にも all にも出る・親（根）と子（営業）は行ごとに自分のグループを返す（親のグループを子に写さない）", async () => {
    const w = await world();
    const g = await group(w, "営業", "EM");
    const parent = await make(w, { title: "親の仕事" });
    const child = await make(w, { title: "子の仕事", scope: g, parent: parent.id });
    const rootName = (await f.admin.query<{ name: string }>("select name from scopes where id = $1", [w.root])).rows[0]!
      .name;
    for (const view of ["view=mine", "view=all"]) {
      const rows = (await listOk(w.me, view)).data;
      expect(rows.find((x) => x["id"] === parent.id)!["scope"], view).toEqual({
        id: w.root,
        name: rootName,
        code: "EG",
      });
      expect(rows.find((x) => x["id"] === child.id)!["scope"], view).toEqual({ id: g, name: "営業", code: "EM" });
    }
  });

  it("K560-API-004 行の鍵はちょうど 13（前の 12 ＋ scope）・meta は next_cursor だけ", async () => {
    const w = await world();
    await make(w);
    const p = await listOk(w.me, "view=all");
    expect(p.data.length).toBe(1);
    expect(keysOf(p.data[0])).toEqual(
      [
        "assignee",
        "delegated_to_clone",
        "depth",
        "due_on",
        "id",
        "kind",
        "number",
        "overdue",
        "parent_ticket_id",
        "scope",
        "stage",
        "title",
        "updated_at",
      ].sort(),
    );
    expect(Object.keys(p.meta)).toEqual(["next_cursor"]);
  });

  it("K560-API-005 次の分（2 ページ目）の行にも scope が付く（3 件を 2 件ずつ）", async () => {
    const w = await world();
    const g = await group(w, "営業", "EM");
    for (let i = 0; i < 3; i += 1) await make(w, { scope: g, title: `営業の仕事 ${i}` });
    const p1 = await listOk(w.me, "view=all&limit=2");
    expect(p1.data.length).toBe(2);
    expect(p1.meta.next_cursor).not.toBeNull();
    const p2 = await listOk(w.me, `view=all&limit=2&cursor=${encodeURIComponent(p1.meta.next_cursor!)}`);
    expect(p2.data.length).toBe(1);
    for (const x of [...p1.data, ...p2.data]) expect(x["scope"]).toEqual({ id: g, name: "営業", code: "EM" });
  });

  it("K560-API-006 見えないグループのチケットは行ごと出ず、そのグループの名前も頭文字も答えのどこにも出ない", async () => {
    const w = await world();
    const hid = await hiddenGroup(w, "極秘の経理室", "KRX");
    await make({ ...w, me: hid.member }, { scope: hid.id, assignee: hid.member });
    const open = await make(w);
    const outsider = await f.person(w.tenantId, w.root, { name: "外の人", ticketAbility: "view" });
    const p = await listOk(outsider, "view=all");
    expect(ids(p.data)).toEqual([open.id]);
    const text = JSON.stringify(p);
    expect(text).not.toContain("極秘の経理室");
    expect(text).not.toContain("KRX");
  });

  it("K560-API-007 グループの名前を直した直後に読むと、新しい名前が出る（写しを持たない）", async () => {
    const w = await world();
    const g = await group(w, "営業", "EM");
    const t = await make(w, { scope: g });
    const before = (await listOk(w.me, "view=all")).data.find((x) => x["id"] === t.id)!;
    expect((before["scope"] as Row)["name"]).toBe("営業");
    await f.admin.query("update scopes set name = '営業企画' where id = $1", [g]);
    const after = (await listOk(w.me, "view=all")).data.find((x) => x["id"] === t.id)!;
    expect(after["scope"]).toEqual({ id: g, name: "営業企画", code: "EM" });
  });

  it("K560-API-008 グループを消した後も、担当者本人の一覧の行には scope が名前つきで出る（チケットは消えていない）", async () => {
    const w = await world();
    const g = await group(w, "旧営業", "OS");
    const t = await make(w, { scope: g });
    await f.admin.query("update scopes set deleted_at = now() where id = $1", [g]);
    const row = (await listOk(w.me, "view=all")).data.find((x) => x["id"] === t.id)!;
    expect(row["scope"]).toEqual({ id: g, name: "旧営業", code: "OS" });
  });

  it("K560-API-009 題名で絞る・グループで絞る・番号で絞る、どの絞り込みの行にも scope が付く", async () => {
    const w = await world();
    const g = await group(w, "営業", "EM");
    const t = await make(w, { scope: g, title: "見積の送付" });
    await make(w, { title: "別件" });
    for (const q of [
      `view=all&scope_id=${g}`,
      `view=all&q=${encodeURIComponent("見積")}`,
      `view=all&q=${encodeURIComponent(t.number)}`,
    ]) {
      const p = await listOk(w.me, q);
      expect(ids(p.data), q).toEqual([t.id]);
      expect(p.data[0]!["scope"], q).toEqual({ id: g, name: "営業", code: "EM" });
    }
  });
});

describe("K-560 詳細の答えの parent と child_count", () => {
  it("K560-API-010 親も子も無いチケット：parent は null・child_count は 0（鍵はどちらも在る）", async () => {
    const w = await world();
    const t = await make(w);
    const d = await detailOk(w.me, t.id);
    expect(Object.keys(d)).toContain("parent");
    expect(Object.keys(d)).toContain("child_count");
    expect(d["parent"]).toBeNull();
    expect(d["child_count"]).toBe(0);
    expect(d["spec_count"]).toBe(0);
    expect(d["link_count"]).toBe(0);
  });

  it("K560-API-011 見える親がある：parent は { id, number, title, due_on, stage: { id, key, name }, visible: true }（鍵ちょうど 6・stage は 3）", async () => {
    const w = await world();
    const g = await group(w, "営業", "EM");
    const parent = await make(w, { title: "親の仕事" });
    const child = await make(w, { title: "子の仕事", scope: g, parent: parent.id });
    const parentStage = (await detailOk(w.me, parent.id))["stage"] as Row;
    const p = (await detailOk(w.me, child.id))["parent"] as Row;
    expect(keysOf(p)).toEqual(["due_on", "id", "number", "stage", "title", "visible"]);
    expect(p).toMatchObject({ id: parent.id, number: parent.number, title: "親の仕事", due_on: jst(3), visible: true });
    expect(keysOf(p["stage"])).toEqual(["id", "key", "name"]);
    expect(p["stage"]).toEqual({ id: parentStage["id"], key: parentStage["key"], name: parentStage["name"] });
  });

  it("K560-API-012 3 段（祖父母・親・子）：parent は直接の親だけ（祖父母は入れ子にしない）・child_count は直接の子だけ", async () => {
    const w = await world();
    const gp = await make(w, { title: "祖父母" });
    const p = await make(w, { title: "親", parent: gp.id });
    const c = await make(w, { title: "子", parent: p.id });
    const dc = await detailOk(w.me, c.id);
    expect((dc["parent"] as Row)["id"]).toBe(p.id);
    expect(keysOf(dc["parent"])).toEqual(["due_on", "id", "number", "stage", "title", "visible"]);
    expect(dc["child_count"]).toBe(0);
    const dp = await detailOk(w.me, p.id);
    expect((dp["parent"] as Row)["id"]).toBe(gp.id);
    expect(dp["child_count"]).toBe(1);
    const dg = await detailOk(w.me, gp.id);
    expect(dg["parent"]).toBeNull();
    expect(dg["child_count"]).toBe(1);
  });

  it("K560-API-013 child_count は直接の子で消していない物だけ（消した子・孫は数えない）", async () => {
    const w = await world();
    const parent = await make(w, { title: "親" });
    const live1 = await make(w, { title: "子 1", parent: parent.id });
    await make(w, { title: "子 2", parent: parent.id });
    const gone = await make(w, { title: "消した子", parent: parent.id });
    await make(w, { title: "孫", parent: live1.id });
    await setCols(gone.id, { deleted_at: new Date().toISOString() });
    expect((await detailOk(w.me, parent.id))["child_count"]).toBe(2);
  });

  it("K560-API-014 見えない子（別グループで、見る権限も担当でもない）は child_count に数えない（見えない物の数を推し量らせない）", async () => {
    const w = await world();
    const hid = await hiddenGroup(w, "経理室", "KR");
    const parent = await make(w, { title: "親" });
    await make(w, { title: "見える子", parent: parent.id });
    const secret = await make(w, { title: "見えなくなる子", parent: parent.id });
    await setCols(secret.id, { scope_id: hid.id, assignee_member_id: hid.member.id });
    expect((await detailOk(w.me, parent.id))["child_count"]).toBe(1);
    expect((await detailOk(w.mate, parent.id))["child_count"]).toBe(1);
  });

  it("K560-API-015 親が見えない（別グループ）：parent は番号だけ { id: null, number, title: null, due_on: null, stage: null, visible: false }。題名・期限・段・グループ名は答えのどこにも出ない", async () => {
    const w = await world();
    const hid = await hiddenGroup(w, "極秘の経理室", "KRX");
    const parent = await make(w, { title: "秘密の親の題名" });
    const child = await make(w, { title: "見える子", parent: parent.id });
    await setCols(parent.id, { scope_id: hid.id, assignee_member_id: hid.member.id, due_on: jst(8) });
    const r = await detail(w.me, child.id);
    expect(r.status).toBe(200);
    const body = await r.clone().text();
    const d = (await asJson(r)).data as Row;
    expect(d["parent"]).toEqual({
      id: null,
      number: parent.number,
      title: null,
      due_on: null,
      stage: null,
      visible: false,
    });
    expect(body).not.toContain("秘密の親の題名");
    expect(body).not.toContain("極秘の経理室");
    expect(body).not.toContain(jst(8));
  });

  it("K560-API-016 親を消した後は parent が null（消した物は選べない・出さない）", async () => {
    const w = await world();
    const parent = await make(w, { title: "親" });
    const child = await make(w, { title: "子", parent: parent.id });
    expect(((await detailOk(w.me, child.id))["parent"] as Row)["id"]).toBe(parent.id);
    await setCols(parent.id, { deleted_at: new Date().toISOString() });
    expect((await detailOk(w.me, child.id))["parent"]).toBeNull();
  });

  it("K560-API-017 親の題名・期限・段を直した直後に子の詳細を読むと、新しい値が出る（写しを持たない）", async () => {
    const w = await world();
    const parent = await make(w, { title: "親の仕事" });
    const child = await make(w, { title: "子", parent: parent.id });
    expect(((await detailOk(w.me, child.id))["parent"] as Row)["title"]).toBe("親の仕事");
    await setCols(parent.id, { title: "親の仕事（直した）", due_on: jst(9) });
    await setStage(parent.id, "doing");
    const p = (await detailOk(w.me, child.id))["parent"] as Row;
    expect(p["title"]).toBe("親の仕事（直した）");
    expect(p["due_on"]).toBe(jst(9));
    expect((p["stage"] as Row)["key"]).toBe("doing");
  });

  it("K560-API-018 DB の関数 app.ticket_read_adds を口を通さずに呼ぶ（2 層目）：見える人は { parent, child_count }・別の会社の人と見えない人は null・読んでも行は変わらない", async () => {
    const w = await world();
    const other = await world("OT");
    const hid = await hiddenGroup(w, "経理室", "KR");
    const parent = await make(w, { title: "親" });
    const child = await make(w, { title: "子", parent: parent.id });
    const secret = await make({ ...w, me: hid.member }, { scope: hid.id, assignee: hid.member });
    const outsider = await f.person(w.tenantId, w.root, { name: "外の人", ticketAbility: "view" });
    const before = (await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [child.id]))
      .rows[0]!.u;
    const mine = await familyOf(w.tenantId, w.me, child.id);
    expect(keysOf(mine)).toEqual([
      "body",
      "child_count",
      "fields",
      "link_count",
      "no_spec_reason",
      "parent",
      "results",
      "spec_count",
      "spec_unchecked",
    ]);
    expect((mine!["parent"] as Row)["id"]).toBe(parent.id);
    expect(mine!["child_count"]).toBe(0);
    expect(await familyOf(other.tenantId, other.me, child.id)).toBeNull();
    expect(await familyOf(w.tenantId, outsider, secret.id)).toBeNull();
    const after = (await f.admin.query<{ u: Date }>("select updated_at as u from tickets where id = $1", [child.id]))
      .rows[0]!.u;
    expect(after.toISOString()).toBe(before.toISOString());
  });

  it("K560-API-019 前からの鍵はそのまま（ticket・kind・stage・assignee・can・approval・completed）に parent・child_count・body・fields・spec_count などが足され、kind の中身は color・id・name だけ（sections の在る無しは見ない）", async () => {
    const w = await world();
    const t = await make(w);
    const d = await detailOk(w.me, t.id);
    for (const k of [
      "ticket",
      "body",
      "fields",
      "results",
      "kind",
      "stage",
      "assignee",
      "can",
      "approval",
      "completed",
      "parent",
      "child_count",
      "spec_count",
      "spec_unchecked",
      "no_spec_reason",
      "link_count",
    ])
      expect(Object.keys(d), k).toContain(k);
    expect(d["ticket"]).toMatchObject({ id: t.id, number: t.number });
    expect(keysOf(d["kind"])).toEqual(["color", "id", "name"]);
  });

  it("K560-API-020 別の会社の人は 404（parent・child_count・本文・項目を返さない）・ログインなしは 401", async () => {
    const w = await world();
    const other = await world("OT");
    const parent = await make(w, { title: "親" });
    const child = await make(w, { title: "子", parent: parent.id });
    const r = await detail(other.me, child.id);
    expect(r.status).toBe(404);
    const body = await r.clone().text();
    expect(body).not.toContain("child_count");
    expect(body).not.toContain("body");
    expect(body).not.toContain("fields");
    expect((await f.req("GET", `/tickets/${child.id}`)).status).toBe(401);
  });

  it("K560-API-029 link_count は消していないつながり（関連・派生元の合計・向きは問わない・見えない相手も数える）。外したつながりと消した相手のつながりは数えない・相手の番号や題名は返さない", async () => {
    const w = await world();
    const hid = await hiddenGroup(w, "極秘の経理室", "KRX");
    const a = await make(w, { title: "つながりを持つ" });
    const b = await make(w, { title: "関連の相手" });
    const c = await make(w, { title: "派生元を持つ側" });
    const gone = await make(w, { title: "消した相手" });
    const removed = await make(w, { title: "外した相手" });
    const hidden = await make({ ...w, me: hid.member }, { title: "見えない相手", scope: hid.id, assignee: hid.member });
    const link = (from: string, to: string, kind: string, deletedAt: string | null = null) =>
      f.admin.query(
        "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind, deleted_at) values ($1, $2, $3, $4, $5)",
        [w.tenantId, from, to, kind, deletedAt],
      );
    await link(a.id, b.id, "related");
    await link(c.id, a.id, "derived_from");
    await link(a.id, gone.id, "related");
    await link(a.id, removed.id, "related", new Date().toISOString());
    await link(a.id, hidden.id, "related");
    await setCols(gone.id, { deleted_at: new Date().toISOString() });
    const r = await detail(w.me, a.id);
    const text = await r.clone().text();
    expect(((await asJson(r)).data as Row)["link_count"]).toBe(3);
    expect(text).not.toContain(hidden.number);
    expect(text).not.toContain("見えない相手");
    expect((await detailOk(w.me, b.id))["link_count"]).toBe(1);
    expect((await detailOk(w.me, c.id))["link_count"]).toBe(1);
  });
});

// ---------------------------------------------------------------- 新しい形（段 5 の作り直し）：本文・項目・確認項目の数・結果の場所・種別のひな形
const emptyDoc = { type: "doc", content: [] };
const docOf = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
});
/** 本文の行（ticket_sections の鍵 body）を DB に直に書く（口を通さない・準備）。作る口が本文の行と版 1 を書くので、
 *  同じ行（ticket_id・鍵 body は 1 つだけ）を中身と版で置き換える（消した印も外す） */
const putBody = (w: World, ticketId: string, doc: unknown, text: string, version = 1) =>
  f.admin.query(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by) values ($1, $2, 'body', 0, $3::jsonb, $4, $5, $5) on conflict (ticket_id, section_key) do update set body = excluded.body, version = excluded.version, deleted_at = null",
    [w.tenantId, ticketId, JSON.stringify({ doc, text }), version, w.me.id],
  );
/** 本文の行を消した印にする（本文の行が無いチケット＝前の道で作った物と同じに読ませる・準備） */
const dropBody = (ticketId: string) =>
  f.admin.query("update ticket_sections set deleted_at = now() where ticket_id = $1 and section_key = 'body'", [
    ticketId,
  ]);
/** 会社の項目を入れる（kinds＝出す種別。空なら全部の種別）。返すのは項目の id */
async function putField(
  w: World,
  o: {
    name: string;
    type: string;
    position: number;
    required?: boolean;
    description?: string;
    options?: unknown[];
    kinds?: string[];
    gone?: boolean;
  },
): Promise<string> {
  const id = (
    await f.admin.query<{ id: string }>(
      "insert into custom_fields (tenant_id, name, field_type, required, description, options, position, deleted_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) returning id",
      [
        w.tenantId,
        o.name,
        o.type,
        o.required ?? false,
        o.description ?? null,
        JSON.stringify(o.options ?? []),
        o.position,
        o.gone ? new Date().toISOString() : null,
      ],
    )
  ).rows[0]!.id;
  for (const k of o.kinds ?? [])
    await f.admin.query("insert into custom_field_kinds (tenant_id, field_id, kind_id) values ($1, $2, $3)", [
      w.tenantId,
      id,
      k,
    ]);
  return id;
}
const putValue = (w: World, ticketId: string, fieldId: string, value: unknown, gone = false) =>
  f.admin.query(
    "insert into ticket_field_values (tenant_id, ticket_id, field_id, value, deleted_at) values ($1, $2, $3, $4::jsonb, $5)",
    [w.tenantId, ticketId, fieldId, JSON.stringify(value), gone ? new Date().toISOString() : null],
  );
const FIELD_KEYS = ["description", "field_type", "id", "name", "options", "position", "required", "value"];

describe("K-560 詳細の答えの本文・項目・確認項目の数・結果の場所と、種別のひな形", () => {
  it("K560-API-021 body は { doc, text, version }：本文の行（鍵 body）がある物はその中身と版・無いチケット（消した行も）は空の本文（doc が空・text が空・version 0）", async () => {
    const w = await world();
    const t = await make(w);
    // 作る口が書いた本文の行（版 1）がそのまま出る
    const made = await detailOk(w.me, t.id);
    expect(keysOf(made["body"])).toEqual(["doc", "text", "version"]);
    expect(made["body"]).toMatchObject({ doc: docOf("書いた"), version: 1 });
    await dropBody(t.id);
    const d0 = await detailOk(w.me, t.id);
    expect(keysOf(d0["body"])).toEqual(["doc", "text", "version"]);
    expect(d0["body"]).toMatchObject({ doc: emptyDoc, text: "", version: 0 });
    const doc = docOf("月末の請求を出す", "先方に送る");
    await putBody(w, t.id, doc, "月末の請求を出す\n先方に送る", 3);
    const d = await detailOk(w.me, t.id);
    expect(d["body"]).toEqual({ doc, text: "月末の請求を出す\n先方に送る", version: 3 });
  });

  it("K560-API-022 fields は、その種別で出す項目を並びの順に { id, name, field_type, required, description, options, position, value }（鍵ちょうど 8）で返す。値が無い項目は value が null・選ぶ型の options は { id, name, position }", async () => {
    const w = await world();
    const t = await make(w);
    const opt = [
      { id: randomUUID(), name: "A 社", position: 1 },
      { id: randomUUID(), name: "B 社", position: 2 },
    ];
    const a = await putField(w, {
      name: "支払期日",
      type: "date",
      position: 2,
      required: true,
      description: "先方の締めに合わせる",
    });
    const b = await putField(w, { name: "契約区分", type: "select", position: 1, options: opt });
    const c = await putField(w, { name: "金額", type: "number", position: 3 });
    await putValue(w, t.id, a, "2026-12-15");
    await putValue(w, t.id, b, opt[1]!.id);
    const fields = (await detailOk(w.me, t.id))["fields"] as Row[];
    expect(fields.map((x) => x["id"])).toEqual([b, a, c]);
    for (const x of fields) expect(keysOf(x)).toEqual(FIELD_KEYS);
    expect(fields[0]).toMatchObject({
      field_type: "select",
      required: false,
      description: null,
      value: opt[1]!.id,
      options: opt,
    });
    expect(fields[1]).toMatchObject({
      field_type: "date",
      required: true,
      description: "先方の締めに合わせる",
      value: "2026-12-15",
      options: [],
    });
    expect(fields[2]).toMatchObject({ field_type: "number", value: null, options: [] });
  });

  it("K560-API-023 fields の絞り込み：その種別の行がある項目はその種別だけ・種別の行が 1 つも無い項目は全部の種別・唯一の種別の行を消した項目（消した行しか無い）はどの種別にも出ない・消した項目と消した値と別の会社の項目は出ない。項目が無い会社は空の並び", async () => {
    const w = await world();
    const other = await world("OT");
    const task = w.kinds["タスク"]!.id;
    const issue = w.kinds["課題"]!.id;
    const only = await putField(w, { name: "タスクだけ", type: "short_text", position: 1, kinds: [task] });
    const never = await putField(w, { name: "課題だけ", type: "short_text", position: 2, kinds: [issue] });
    const all = await putField(w, { name: "全部", type: "check", position: 3 });
    await putField(w, { name: "消した項目", type: "short_text", position: 4, gone: true });
    await putField(other, { name: "別の会社の項目", type: "short_text", position: 1 });
    // 消した種別の行しか無い項目：行が 1 つも無い項目（全部の種別）とは別で、どの種別にも出ない
    const dropped = await putField(w, { name: "種別から外した", type: "short_text", position: 5, kinds: [task] });
    await f.admin.query("update custom_field_kinds set deleted_at = now() where field_id = $1", [dropped]);
    const t = await make(w);
    await putValue(w, t.id, all, true, true);
    const fields = (await detailOk(w.me, t.id))["fields"] as Row[];
    expect(fields.map((x) => x["id"])).toEqual([only, all]);
    expect(fields.find((x) => x["id"] === all)!["value"]).toBeNull();
    expect(JSON.stringify(fields)).not.toContain(never);
    expect(JSON.stringify(fields)).not.toContain(dropped);
    expect(JSON.stringify(fields)).not.toContain("別の会社の項目");
    const kinds = (await asJson(await f.req("GET", "/ticket_kinds", { headers: w.me.auth }))).data as Row[];
    for (const k of kinds)
      expect(JSON.stringify(k["fields"]), `種別 ${String(k["name"])} のマスタ`).not.toContain(dropped);
    const empty = await world();
    expect((await detailOk(empty.me, (await make(empty)).id))["fields"]).toEqual([]);
  });

  it("K560-API-024 spec_count は消していない確認項目の数・spec_unchecked は未チェックの数（消した物と別のチケットの物は数えない・完了後も同じ）。件数だけで文は返さない", async () => {
    const w = await world();
    const t = await make(w, { title: "確認を持つ" });
    const other = await make(w, { title: "別のチケット" });
    const spec = (ticket: string, title: string, o: { checked?: boolean; gone?: boolean } = {}) =>
      f.admin.query(
        "insert into test_specs (tenant_id, ticket_id, check_kind, title, checked_at, checked_by_member_id, deleted_at) values ($1, $2, 'human', $3, $4, $5, $6)",
        [
          w.tenantId,
          ticket,
          title,
          o.checked ? new Date().toISOString() : null,
          o.checked ? w.me.id : null,
          o.gone ? new Date().toISOString() : null,
        ],
      );
    expect(await detailOk(w.me, t.id)).toMatchObject({ spec_count: 0, spec_unchecked: 0 });
    await spec(t.id, "金額が一致する", { checked: true });
    await spec(t.id, "宛名が正しい");
    await spec(t.id, "送付先を確かめる");
    await spec(t.id, "消した確認", { gone: true });
    await spec(other.id, "別のチケットの確認");
    const r = await detail(w.me, t.id);
    expect(await r.clone().text()).not.toContain("金額が一致する");
    expect((await asJson(r)).data).toMatchObject({ spec_count: 3, spec_unchecked: 2 });
    await setStage(t.id, "done");
    expect(await detailOk(w.me, t.id)).toMatchObject({ spec_count: 3, spec_unchecked: 2 });
    expect(await detailOk(w.me, other.id)).toMatchObject({ spec_count: 1, spec_unchecked: 1 });
  });

  it("K560-API-025 no_spec_reason は使わない理由の文（無ければ null）。空白だけは保存できないので null と同じ扱いは要らず、書いた文がそのまま返る", async () => {
    const w = await world();
    const t = await make(w);
    expect((await detailOk(w.me, t.id))["no_spec_reason"]).toBeNull();
    await f.admin.query("update tickets set no_spec_reason = '今回は人が目で確かめるので要らない' where id = $1", [
      t.id,
    ]);
    expect((await detailOk(w.me, t.id))["no_spec_reason"]).toBe("今回は人が目で確かめるので要らない");
  });

  it("K560-API-026 results は成果物・決定ログ・申し送りが在るときだけ鍵が出る（無ければ空の入れ物 {}）。成果物は区画 artifacts の行・決定ログは ticket_decisions（改めた物と消した物を除く）・申し送りは ticket_handovers の理由か頼みごとの文", async () => {
    const w = await world();
    const t = await make(w);
    expect((await detailOk(w.me, t.id))["results"]).toEqual({});
    await f.admin.query(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by) values ($1, $2, 'artifacts', 70, $3::jsonb, 1, $4, $4)",
      [w.tenantId, t.id, JSON.stringify({ text: "請求書.pdf を作りました" }), w.me.id],
    );
    const d1 = (await detailOk(w.me, t.id))["results"] as Row;
    expect(Object.keys(d1)).toEqual(["artifacts"]);
    expect(d1["artifacts"]).toMatchObject({ text: "請求書.pdf を作りました", version: 1 });
    const old = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by) values ($1, $2, '支払期日は 12/01', $3) returning id",
        [w.tenantId, t.id, w.me.id],
      )
    ).rows[0]!.id;
    const now = (
      await f.admin.query<{ id: string }>(
        "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by) values ($1, $2, '支払期日は 12/15 にする', null) returning id",
        [w.tenantId, t.id],
      )
    ).rows[0]!.id;
    await f.admin.query("update ticket_decisions set superseded_by_id = $2 where id = $1", [old, now]);
    await f.admin.query(
      "insert into ticket_decisions (tenant_id, ticket_id, text, deleted_at) values ($1, $2, '消した決定', now())",
      [w.tenantId, t.id],
    );
    await f.admin.query(
      "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, reason, ask) values ($1, $2, 'pass', $3, $4, '宛先が変わっていないか見てください', null)",
      [w.tenantId, t.id, w.me.id, w.mate.id],
    );
    const r = (await detailOk(w.me, t.id))["results"] as Row;
    expect(Object.keys(r).sort()).toEqual(["artifacts", "decisions", "handoff"]);
    const dec = r["decisions"] as Row[];
    expect(dec.map((x) => x["text"])).toEqual(["支払期日は 12/15 にする"]);
    expect(dec[0]!["decided_by_name"]).toBeNull();
    expect(r["handoff"]).toMatchObject({ text: "宛先が変わっていないか見てください" });
    expect(JSON.stringify(r)).not.toContain("消した決定");
    expect(JSON.stringify(r)).not.toContain("12/01");
  });

  it("K560-API-027 listTicketKinds の各種別に body_template（ひな形の文書の木・無ければ null）が付く。別の会社のひな形は混じらない", async () => {
    const w = await world();
    const other = await world("OT");
    const tpl = docOf("目的");
    await f.admin.query("update ticket_kinds set body_template = $2::jsonb where id = $1", [
      w.kinds["タスク"]!.id,
      JSON.stringify(tpl),
    ]);
    await f.admin.query("update ticket_kinds set body_template = null where id = $1", [w.kinds["課題"]!.id]);
    await f.admin.query("update ticket_kinds set body_template = $2::jsonb where id = $1", [
      other.kinds["タスク"]!.id,
      JSON.stringify(docOf("相手のひな形")),
    ]);
    const kinds = (await asJson(await f.req("GET", "/ticket_kinds", { headers: w.me.auth }))).data as Row[];
    const task = kinds.find((k) => k["name"] === "タスク")!;
    const issue = kinds.find((k) => k["name"] === "課題")!;
    expect(task["body_template"]).toEqual(tpl);
    expect(issue["body_template"]).toBeNull();
    for (const key of ["body_template", "color", "id", "is_builtin", "name", "position"])
      expect(Object.keys(task), key).toContain(key);
    expect(JSON.stringify(kinds)).not.toContain("相手のひな形");
  });

  it("K560-API-030 listTicketKinds の各種別に fields（その種別で出す会社の項目のマスタ・値は持たない）が並び位置の順に付く：種別の行が無い項目は全部の種別・タスクだけの項目はタスクだけ・消した項目と別の会社の項目は出ない・鍵はちょうど 7（TicketField と同じ）。詳細の fields（値つき）と同じ項目・同じ並び。口は種別の 1 本のまま（項目のために口を足さない）", async () => {
    const w = await world();
    const other = await world("OT");
    const taskId = w.kinds["タスク"]!.id;
    const issueId = w.kinds["課題"]!.id;
    const all = await putField(w, { name: "全部の種別の項目", type: "short_text", position: 2 });
    const onlyTask = await putField(w, { name: "タスクだけの項目", type: "number", position: 1, kinds: [taskId] });
    const pick = await putField(w, {
      name: "課題の選ぶ項目",
      type: "select",
      position: 3,
      required: true,
      description: "選んでください",
      options: [{ id: randomUUID(), name: "A 社", position: 1 }],
      kinds: [issueId],
    });
    await putField(w, { name: "消した項目", type: "short_text", position: 4, gone: true });
    await putField(other, { name: "相手の会社の項目", type: "short_text", position: 1 });
    const kinds = (await asJson(await f.req("GET", "/ticket_kinds", { headers: w.me.auth }))).data as Row[];
    const fieldsOfKind = (name: string) => kinds.find((k) => k["name"] === name)!["fields"] as Row[];
    expect(fieldsOfKind("タスク").map((x) => x["id"])).toEqual([onlyTask, all]);
    expect(fieldsOfKind("課題").map((x) => x["id"])).toEqual([all, pick]);
    expect(fieldsOfKind("QA").map((x) => x["id"])).toEqual([all]);
    for (const k of kinds)
      for (const fl of k["fields"] as Row[])
        expect(keysOf(fl), `${String(k["name"])} の項目の鍵`).toEqual([
          "description",
          "field_type",
          "id",
          "name",
          "options",
          "position",
          "required",
        ]);
    const sel = fieldsOfKind("課題").find((x) => x["id"] === pick)!;
    expect(sel).toMatchObject({ field_type: "select", required: true, description: "選んでください" });
    expect(sel["options"] as Row[]).toHaveLength(1);
    expect(JSON.stringify(kinds)).not.toContain("消した項目");
    expect(JSON.stringify(kinds)).not.toContain("相手の会社の項目");
    // 詳細の fields（値つき）と同じ項目・同じ並び（マスタの規則を 2 つ持たない）
    const t = await make(w, { title: "項目を読む" });
    const d = await detailOk(w.me, t.id);
    expect((d["fields"] as Row[]).map((x) => x["id"])).toEqual(fieldsOfKind("タスク").map((x) => x["id"]));
  });
});

describe("K-560 読むだけ", () => {
  it("K560-API-028 詳細と一覧を読んでも、チケットの更新時刻・区画の行の数は変わらない（読む口の中で書かない）", async () => {
    const w = await world();
    const parent = await make(w, { title: "親" });
    const child = await make(w, { title: "子", parent: parent.id });
    const snap = async () => ({
      tickets: (
        await f.admin.query<{ id: string; u: string }>(
          "select id, updated_at::text as u from tickets where tenant_id = $1 order by id",
          [w.tenantId],
        )
      ).rows,
      sections: (
        await f.admin.query<{ n: string }>("select count(*) as n from ticket_sections where tenant_id = $1", [
          w.tenantId,
        ])
      ).rows[0]!.n,
    });
    const before = await snap();
    await detailOk(w.me, child.id);
    await detailOk(w.me, parent.id);
    await listOk(w.me, "view=all");
    expect(await snap()).toEqual(before);
  });
});
