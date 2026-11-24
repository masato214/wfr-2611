// K-581「作る口 createTicket に links（作るときにつなぐ相手）を足す」の単体の試験（口・本物の DB）。
// 名前の頭の行 ID（K581-API-…）は 11_tickets/K-581.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
// 形（2026-11-22・精査の決め）：入力 links ＝ [{ kind: related|derived_from, other_ticket_id }]（任意・0〜20 件・同じ組は重ねない）。
//   作る関数 app.ticket_create が、K-441 の app.ticket_link_add（見えるか → 書けるか → つなぐ → 証跡 ticket_link.create の 1 本）を新しいチケットに対して 1 件ずつ呼ぶ。
//   確かめと証跡を作る関数の中に別に持たない（app.ticket_link_put を直に呼ばない・L-002）。断りは 404（無い・消した・見えない・別の会社）・403（相手に書けない）で欄なし
//   本文・項目・確認項目の書き込みと断りの番号は K-437 の試験（create-ticket-defaults.test.ts）が持つ
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let writer: Person;
let mate: Person;
let outsider: Person;
let task: { id: string };
let otherTask: { id: string };

type J = Record<string, unknown> & { data?: Record<string, unknown> };
const json = async (r: Response) => (await r.json()) as J;
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const para = (...t: string[]) => ({
  type: "doc",
  content: t.map((x) => ({ type: "paragraph", content: [{ type: "text", text: x }] })),
});
const body = (extra: Record<string, unknown> = {}) => ({
  scope_id: T.rootScope,
  kind_id: task.id,
  title: "請求書を送る",
  assignee_member_id: mate.id,
  due_on: jst(3),
  ...extra,
});
const create = (who: Person, b: unknown = body(), headers: Record<string, string> = {}) =>
  f.req("POST", "/tickets", { body: b, headers: { ...who.auth, ...headers } });
const createOk = async (who: Person, b: unknown = body()) => {
  const r = await create(who, b);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as Record<string, unknown>;
};
const count = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const ticketsIn = (tenant: string) => count("select count(*) as n from tickets where tenant_id = $1", [tenant]);
const changeLines = (ticketId: unknown) =>
  count("select count(*) as n from ticket_messages where ticket_id = $1 and kind = 'change'", [ticketId]);
/** 404・409 の体は欄（field）・details・detail を付けない（在るかを漏らさない・控え帳 2026-11-21 01:15・20:50） */
const noFields = (j: Record<string, unknown>, label = "") => {
  for (const k of ["field", "details", "detail"]) expect(k in j, `${label} ${k}`).toBe(false);
};
const gone = (status: number, j: Record<string, unknown>, label = "") => {
  expect(status, label).toBe(404);
  expect(j["code"], label).toBe("E-PAGE-001");
  noFields(j, label);
};
const fieldsOf = (j: Record<string, unknown>) =>
  ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  T = await f.company("K581 の会社", "LN");
  O = await f.company("K581 の別の会社", "LO");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
  const mine = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  task = mine.find((k) => k.name === "タスク")!;
  const theirs = (await json(await f.req("GET", "/ticket_kinds", { headers: outsider.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  otherTask = theirs.find((k) => k.name === "タスク")!;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-581 作るときにつなぐ links（K-580 の作る面が送る・K-441 の app.ticket_link_add を同じ取引で呼ぶ）", () => {
  const linkRows = (ticketId: unknown) =>
    f.admin
      .query<{ from_ticket_id: string; to_ticket_id: string; kind: string }>(
        "select from_ticket_id, to_ticket_id, kind from ticket_links where tenant_id = $1 and deleted_at is null and (from_ticket_id = $2 or to_ticket_id = $2) order by kind",
        [T.tenantId, ticketId],
      )
      .then((x) => x.rows);
  const allLinks = () => count("select count(*) as n from ticket_links where tenant_id = $1", [T.tenantId]);
  const linkAudits = () =>
    count("select count(*) as n from audit_events where tenant_id = $1 and action = 'ticket_link.create'", [
      T.tenantId,
    ]);

  it("K581-API-001 links を 2 件付けて作る：201・つながりの行は派生元 1（向きは新しいチケット→相手）と関連 1・証跡 ticket_link.create が 2 行・やり取りの更新の行と知らせは足さない（担当者への 1 通のまま）", async () => {
    const origin = await createOk(writer, body({ title: "派生元の相手" }));
    const peer = await createOk(writer, body({ title: "関連の相手" }));
    const audits = await linkAudits();
    const made = await createOk(
      writer,
      body({
        title: "つないで作る",
        links: [
          { kind: "derived_from", other_ticket_id: origin["id"] },
          { kind: "related", other_ticket_id: peer["id"] },
        ],
      }),
    );
    const rows = await linkRows(made["id"]);
    expect(rows).toHaveLength(2);
    expect(rows.find((x) => x.kind === "derived_from")).toMatchObject({
      from_ticket_id: made["id"],
      to_ticket_id: origin["id"],
    });
    const rel = rows.filter((x) => x.kind === "related");
    expect(rel).toHaveLength(1);
    expect([rel[0]!.from_ticket_id, rel[0]!.to_ticket_id].sort()).toEqual(
      [String(made["id"]), String(peer["id"])].sort(),
    );
    expect(await linkAudits()).toBe(audits + 2);
    // 証跡の中身は K-441 の app.ticket_link_add が書く物と同じ鍵だけ（題名・本文は入れない）
    const payloads = (
      await f.admin.query<{ payload: Record<string, unknown> }>(
        "select payload from audit_events where tenant_id = $1 and action = 'ticket_link.create' and payload->>'ticket_id' = $2",
        [T.tenantId, String(made["id"])],
      )
    ).rows.map((x) => x.payload);
    expect(payloads).toHaveLength(2);
    for (const pl of payloads) expect(Object.keys(pl).sort()).toEqual(["kind", "other_ticket_id", "ticket_id"]);
    expect(await changeLines(made["id"])).toBe(0);
    expect(
      await count(
        "select count(*) as n from notifications where tenant_id = $1 and payload->>'title' = 'つないで作る'",
        [T.tenantId],
      ),
    ).toBe(1);
  });

  it("K581-API-002 相手が選べない・書けない：無い・消した・別の会社の相手は 404・E-PAGE-001（欄なし・相手の名前を返さない）、相手が見えるが書けない（読むだけの別グループ）は 403（欄なし）。どれもチケット・本文・確認項目・つながりが増えない", async () => {
    const ok = await createOk(writer, body({ title: "消す相手" }));
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [ok["id"]]);
    const outsiderTicket = (
      await createOk(outsider, {
        scope_id: O.rootScope,
        kind_id: otherTask.id,
        title: "相手の会社のチケット",
        assignee_member_id: outsider.id,
        due_on: jst(3),
      })
    )["id"];
    const before = {
      t: await ticketsIn(T.tenantId),
      sp: await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId]),
      l: await allLinks(),
    };
    for (const other of [randomUUID(), ok["id"], outsiderTicket]) {
      const r = await create(
        writer,
        body({
          body: { doc: para("戻る") },
          specs: ["戻る確認"],
          links: [{ kind: "related", other_ticket_id: other }],
        }),
      );
      const j = await json(r);
      gone(r.status, j, String(other));
      expect(JSON.stringify(j)).not.toContain("相手の会社のチケット");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before.t);
    expect(await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId])).toBe(before.sp);
    expect(await allLinks()).toBe(before.l);
    // 読むだけの別グループ：つなぐ人 e は g1 に書けて、g2 は読むだけ。g2 のチケットを相手にすると 403
    const g1 = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, 'K581 つなぐ組', 'LK', $2) returning id",
        [T.tenantId, T.rootScope],
      )
    ).rows[0]!.id;
    const g2 = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, 'K581 読むだけの組', 'LR', $2) returning id",
        [T.tenantId, T.rootScope],
      )
    ).rows[0]!.id;
    const e = await f.person(T.tenantId, g1, { name: "K581 つなぐ人", ticketAbility: "edit" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [T.tenantId, e.id, g2],
    );
    const readOnly = await createOk(writer, body({ scope_id: g2, title: "読むだけの相手" }));
    const sp0 = await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId]);
    const t0 = await ticketsIn(T.tenantId);
    const l0 = await allLinks();
    const r403 = await create(
      e,
      body({ scope_id: g1, specs: ["戻る確認"], links: [{ kind: "related", other_ticket_id: readOnly["id"] }] }),
    );
    expect(r403.status, await r403.clone().text()).toBe(403);
    noFields(await json(r403), "403");
    expect(await ticketsIn(T.tenantId)).toBe(t0);
    expect(await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId])).toBe(sp0);
    expect(await allLinks()).toBe(l0);
  });

  it("K581-API-003 失敗（つなぐ所で DB が落ちる）：links を付けた作成は 503・E-PAGE-003・チケット・本文・確認項目・項目の値・つながりが全部前のまま（1 つの取引）", async () => {
    const peer = await createOk(writer, body({ title: "落ちる相手" }));
    await f.admin.query(`create or replace function app.k581_fail3() returns trigger language plpgsql as $$ begin
      raise exception 'k581 試験の失敗 3'; end $$`);
    await f.admin.query(
      "create trigger k581_fail3 before insert on ticket_links for each row execute function app.k581_fail3()",
    );
    const before = {
      t: await ticketsIn(T.tenantId),
      sp: await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId]),
      s: await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId]),
      l: await allLinks(),
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await create(
        writer,
        body({
          body: { doc: para("戻る") },
          specs: ["戻る確認"],
          links: [{ kind: "related", other_ticket_id: peer["id"] }],
        }),
      );
      expect(r.status).toBe(503);
      expect(((await r.json()) as { code?: string }).code).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await f.admin.query("drop trigger k581_fail3 on ticket_links");
      await f.admin.query("drop function app.k581_fail3()");
    }
    expect(await ticketsIn(T.tenantId)).toBe(before.t);
    expect(await count("select count(*) as n from test_specs where tenant_id = $1", [T.tenantId])).toBe(before.sp);
    expect(await count("select count(*) as n from ticket_sections where tenant_id = $1", [T.tenantId])).toBe(before.s);
    expect(await allLinks()).toBe(before.l);
  });

  it("K581-API-004 links の形：無い・空の並びは今までどおり 201（つながり 0）。21 件・同じ組を 2 回・知らない鍵・種類が related・derived_from でない・相手が uuid でないは 422（欄 links…）で何も作られない。20 件ちょうどは契約を通る", async () => {
    const none = await createOk(writer, body({ title: "links 無し" }));
    const empty = await createOk(writer, body({ title: "links 空", links: [] }));
    expect(await linkRows(none["id"])).toHaveLength(0);
    expect(await linkRows(empty["id"])).toHaveLength(0);
    const before = { t: await ticketsIn(T.tenantId), l: await allLinks() };
    const other = randomUUID();
    const many = Array.from({ length: 21 }, () => ({ kind: "related", other_ticket_id: randomUUID() }));
    for (const links of [
      many,
      [
        { kind: "related", other_ticket_id: other },
        { kind: "related", other_ticket_id: other },
      ],
      [{ kind: "related", other_ticket_id: other, note: "x" }],
      [{ kind: "child", other_ticket_id: other }],
      [{ kind: "related", other_ticket_id: "not-a-uuid" }],
    ]) {
      const r = await create(writer, body({ links }));
      expect(r.status, JSON.stringify(links).slice(0, 80)).toBe(422);
      expect(fieldsOf(await json(r)).some((x) => x.startsWith("links"))).toBe(true);
    }
    expect(await ticketsIn(T.tenantId)).toBe(before.t);
    expect(await allLinks()).toBe(before.l);
    const twenty = Array.from({ length: 20 }, () => ({ kind: "related", other_ticket_id: randomUUID() }));
    const r20 = await create(writer, body({ links: twenty }));
    expect(r20.status, "20 件は契約を通り、相手が無いので 404").toBe(404);
  });
});

describe("K-581 確かめを 1 か所に・二度押し", () => {
  it("K581-API-005 二度押し（同じ冪等キー）：links を付けた作成を 2 回送ると 2 回とも 201・同じ id・つながりは 1 本・証跡 ticket_link.create は 1 行だけ", async () => {
    const peer = await createOk(writer, body({ title: "二度押しの相手" }));
    const key = { "idempotency-key": randomUUID() };
    const b = body({ title: "二度押しでつなぐ", links: [{ kind: "related", other_ticket_id: peer["id"] }] });
    const r1 = await create(writer, b, key);
    const r2 = await create(writer, b, key);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const id1 = ((await json(r1)).data as Record<string, unknown>)["id"];
    const id2 = ((await json(r2)).data as Record<string, unknown>)["id"];
    expect(id2).toBe(id1);
    expect(
      await count(
        "select count(*) as n from ticket_links where tenant_id = $1 and deleted_at is null and (from_ticket_id = $2 or to_ticket_id = $2)",
        [T.tenantId, id1],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from audit_events where tenant_id = $1 and action = 'ticket_link.create' and payload->>'ticket_id' = $2",
        [T.tenantId, String(id1)],
      ),
    ).toBe(1);
  });

  it("K581-API-006 見える・書けるの確かめと証跡を 2 つ持たない：作る関数 app.ticket_create の定義（コメントを除く）が app.ticket_link_add を呼び、app.ticket_link_put を直に呼ばない。アプリの役が実行できる関数は増えない", async () => {
    const def = (
      await f.admin.query<{ d: string }>("select pg_get_functiondef('app.ticket_create(jsonb)'::regprocedure) as d")
    ).rows[0]!.d;
    const code = def.replace(/--[^\n]*/g, "");
    expect(code).toContain("app.ticket_link_add");
    expect(code).not.toContain("ticket_link_put");
    const can = async (sig: string) =>
      (await f.admin.query<{ ok: boolean }>("select has_function_privilege('kaname_app', $1, 'execute') as ok", [sig]))
        .rows[0]!.ok;
    expect(await can("app.ticket_create(jsonb)")).toBe(true);
    expect(await can("app.ticket_link_put(uuid, uuid, text)")).toBe(false);
  });
});
