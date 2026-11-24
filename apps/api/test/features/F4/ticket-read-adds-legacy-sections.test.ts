// K-560「詳細と一覧の読みの足し」のうち、前の答えの区画の並び（sections）を見る分（行 K560-API-019・021・027 の「sections の在る無し」の半分）。名前の頭の行 ID は 11_tickets/K-560.md の行の表の行 019 と同じ（ほかの半分は ticket-read-adds.test.ts の同じ行）。
//   K-560 が入ってから K-578 が答えから sections を外すまでの間の姿（詳細の答えに sections が前のまま付き鍵 body の行は並びに出ない・種別の一覧に sections が付く）を見る。
//   K-578 がこのファイルごと消す（その後は答えに sections が無いことを K578-API-002・004 が見る）。ほかの行は ticket-read-adds.test.ts（区画の在る無しを見ない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture } from "../fixture.js";

let f: Fixture;

type Row = Record<string, unknown>;

const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const asJson = async (r: Response) => (await r.json()) as Row & { data?: unknown };

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  f.limits["getTicket"] = 10_000;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-560 前の答えの区画の並び（K-578 が外すまで）", () => {
  it("K560-API-019 前の答えの区画の並び（021・027 の sections の半分も）：詳細の答えの sections は前のまま付く：本文の行（鍵 body）を足しても並びに鍵 body は出ず、種別の一覧の各種別に sections の並びが付く", async () => {
    const c = await f.company(`K560 前の区画 ${Math.random().toString(36).slice(2, 7)}`, "LG");
    const me = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
    const kinds = (await asJson(await f.req("GET", "/ticket_kinds", { headers: me.auth }))).data as Row[];
    const task = kinds.find((k) => k["name"] === "タスク")!;
    expect(Array.isArray(task["sections"])).toBe(true);
    const r = await f.req("POST", "/tickets", {
      body: {
        scope_id: c.rootScope,
        kind_id: task["id"],
        title: "請求書を送る",
        assignee_member_id: me.id,
        due_on: jst(3),
        body: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "書いた" }] }] } },
      },
      headers: me.auth,
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const id = ((await asJson(r)).data as { id: string }).id;
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "月末の請求を出す" }] }],
    };
    await f.admin.query(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by) values ($1, $2, 'body', 0, $3::jsonb, 3, $4, $4) on conflict (ticket_id, section_key) do update set body = excluded.body, version = excluded.version, deleted_at = null",
      [c.tenantId, id, JSON.stringify({ doc, text: "月末の請求を出す" }), me.id],
    );
    const d = (await asJson(await f.req("GET", `/tickets/${id}`, { headers: me.auth }))).data as Row;
    expect(Object.keys(d)).toContain("sections");
    expect((d["sections"] as { key: string }[]).map((s) => s.key)).not.toContain("body");
  });
});
