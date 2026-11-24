// K-437「作る口の前の道（区画 sections）」の試験（口・本物の DB）。名前の頭の行 ID（K437-API-027〜029）は 11_tickets/K-437.md の表に 1 対 1。
// 口は K-578 が契約と口から区画 sections を外すまで、前の作る面・AI の準備のために sections を今までどおり受ける。
//   body があれば body だけを書き sections は捨てる／body が無く sections だけなら前の区画の道（必須の区画が空なら 422・E-VAL-013）／どちらも無ければ空の本文（K437-API-002）。
// このファイルは K-578 が消す（口と契約から sections を外し、E-VAL-013 を正本から外す。K-578 は自分の試験 sections-retire.test.ts で「sections を送ると 422」を見る）。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let writer: Person;
let mate: Person;
let task: { id: string };

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
const fieldsOf = (j: Record<string, unknown>) =>
  ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  T = await f.company("K437 前の道の会社", "SL");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  const mine = (await json(await f.req("GET", "/ticket_kinds", { headers: writer.auth }))).data as unknown as {
    id: string;
    name: string;
  }[];
  task = mine.find((k) => k.name === "タスク")!;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const bodyRow = async (ticketId: unknown) =>
  (
    await f.admin.query<{ body: { doc: unknown; text: string }; version: number; position: number }>(
      "select body, version, position from ticket_sections where ticket_id = $1 and section_key = 'body' and deleted_at is null",
      [ticketId],
    )
  ).rows;

describe("K-437 作る口の前の道（sections）：K-578 が外すまで", () => {
  it("K437-API-027 前の道（sections だけ）：body を送らず sections だけで作ると今までどおり区画の行が書かれる（必須の区画が揃えば 201・鍵 body の行は無い）。必須の区画が空なら 422・E-VAL-013・欄 sections.done・sections.todo・何も作られない", async () => {
    const before = await ticketsIn(T.tenantId);
    const r = await create(writer, body({ sections: { purpose: "目的だけ" } }));
    const j = await json(r);
    expect(r.status).toBe(422);
    expect(j["code"]).toBe("E-VAL-013");
    expect(fieldsOf(j)).toEqual(["sections.done", "sections.todo"]);
    expect(await ticketsIn(T.tenantId)).toBe(before);
    const ok = await createOk(
      writer,
      body({
        title: "区画で作る",
        sections: { purpose: "区画の目的", done: "区画の完了の条件", todo: "区画の実施事項" },
      }),
    );
    expect(
      await count(
        "select count(*) as n from ticket_sections where ticket_id = $1 and section_key in ('purpose', 'done', 'todo')",
        [ok["id"]],
      ),
    ).toBe(3);
    expect(await bodyRow(ok["id"])).toHaveLength(0);
  });

  it("K437-API-028 body と sections が両方：201・鍵 body の行だけが書かれ（text は body の doc から口が作る）、区画の行は 0・sections の字はどこにも残らない・必須の区画が空でも止めない（body の道が先）", async () => {
    const t = await createOk(
      writer,
      body({ title: "両方送る", body: { doc: para("本文の字") }, sections: { purpose: "捨てられる目的" } }),
    );
    const rows = await bodyRow(t["id"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body.text).toBe("本文の字");
    expect(
      await count("select count(*) as n from ticket_sections where ticket_id = $1 and section_key <> 'body'", [
        t["id"],
      ]),
    ).toBe(0);
    expect(
      await count(
        "select count(*) as n from ticket_sections where tenant_id = $1 and body::text like '%捨てられる目的%'",
        [T.tenantId],
      ),
    ).toBe(0);
  });

  it("K437-API-029 契約と正本：createTicket の入力に sections が残り（K-578 が外す）、4xx に E-VAL-013 が残る。正本（errors.json）にも E-VAL-013 が残る", async () => {
    const root = fileURLToPath(new URL("../../../../../", import.meta.url));
    const ep = JSON.parse(readFileSync(`${root}08_api/endpoints.json`, "utf8")) as unknown;
    const op = (JSON.stringify(ep).match(/"createTicket"[\s\S]{0,40000}/) ?? [""])[0];
    expect(op).toContain("E-VAL-013");
    const yaml = readFileSync(`${root}08_api/openapi.yaml`, "utf8");
    const m = /TicketCreateInput:[\s\S]*?(?=\n {4}[A-Z][A-Za-z]*:)/.exec(yaml)?.[0] ?? "";
    expect(m).toContain("sections:");
    expect(readFileSync(`${root}07_qa/test-specs/errors.json`, "utf8")).toContain('"E-VAL-013"');
  });
});
