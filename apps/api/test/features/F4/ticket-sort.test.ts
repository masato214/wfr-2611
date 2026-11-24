// K-440「updateTicket の優先度（理由つき）・親の組」の単体の試験（口と DB・本物の Postgres）。
//   期限（理由つき）の組は段 8 の K-483 が持つ（PM の決め）。この葉は優先度と親だけ。
// テストの名前の頭の行 ID（K440-API-…）は 11_tickets/K-440.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（口と欄ごとの処理の表は段 7 の K-387 が作る。この葉が組 ticketSort を足す）:
//   updateTicket  PATCH /api/v1/tickets/:id   body：priority・priority_reason・parent_ticket_id（送った欄だけ変える）
//     200 { data: { ticket: { id, number, updated_at, + 送った組の列 }, changed, message_id } }（stage は段・実績・保留の組の鍵が送られたときだけ付く）
//     断る：404 E-PAGE-001（無い・見えない・消した・別の会社・親が見つからない）／403 FORBIDDEN／409 E-TKT-001（自分自身）・002（子孫）・003（3 段超）・004（親を決めるとき親の期限より後）／
//          422 理由の欠け・知らない優先度・E-VAL-018（組に無い欄）／503 E-PAGE-003（書く所の DB の失敗）
//   やり取りの変更の 1 行：ticket_messages の kind change。優先度＝「<名前> が優先度を 中 → 高 に変えた（理由：…）」・
//     親＝「<名前> が親を LA-1 に決めた」「親を LA-1 → LA-2 に変えた」「親を外した（LA-1）」。2 つは「・」
//     changes は [{field: "priority"|"parent", from, to, note?}]（この順）。証跡 audit_events の action は ticket.sort（payload は { fields: […] }）
//   担当者への知らせ：担当者でない人が変えたとき、担当者の受け箱に ticket.sort_changed の行を 1 つ（payload は { ticket_id, number, url, message_id, fields }・メールなし・D-150.32）
// DB の関数（packages/db/migrations/20261122094000_ticket_sort.sql）:
//   app.ticket_sort_set(p_ticket uuid, p jsonb) returns jsonb … 失敗は { error: not_member | not_found | not_writable | reason_required | … }
//
// 口の振る舞い（K-387 の apps/api/src/hooks/ticket-update.ts の register）は、試験の本体（it の中）の ready() で 1 回だけ読む。
//   実装の前（切る段の smoke）に、まだ無いファイルを準備で読んで準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
let loaded = false;
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HOOKS_DIR, "ticket-update.ts"))) as { register: HookModule };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
  loaded = true;
}

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown>;
const asJson = async (r: Response): Promise<Json> => (await r.json()) as Json;
const sorted = (o: object): string[] => Object.keys(o).sort();
/** 404・409 の答えは field・details・detail を付けない（在るかを漏らさない・控え帳 2026-11-21 01:15・20:50） */
const bare = (j: Json): void => {
  for (const k of ["field", "details", "detail"]) expect(Object.keys(j), `${k} を付けない`).not.toContain(k);
};
const NO_SUCH = "00000000-0000-4000-8000-0000000000aa";
const jst = (days = 0): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

/**
 * 契約（08_api/openapi.yaml）の updateTicket の入力の oneOf を読む小さな道具（K440-API-002）。
 * openapi.yaml は build_api.py が固定の形（2 スペース・列は鍵と同じ字下げ）で出すので、その形だけを読む。
 * 評価するのは required・properties の enum・not・anyOf・oneOf だけ（INPUT_RULES に書ける言葉）。
 */
type Y = string | number | boolean | null | Y[] | { [k: string]: Y };
function parseYamlBlock(text: string): Y {
  const lines = text.split("\n").filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  let i = 0;
  const indentOf = (l: string): number => l.length - l.trimStart().length;
  const scalar = (v: string): Y => {
    const t = v.trim();
    if (/^(["']).*\1$/.test(t)) return t.slice(1, -1);
    if (t === "true") return true;
    if (t === "false") return false;
    if (t === "null") return null;
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
  };
  const block = (ind: number): Y => (lines[i]!.trimStart().startsWith("- ") ? seq(ind) : map(ind));
  const seq = (ind: number): Y[] => {
    const out: Y[] = [];
    while (i < lines.length && indentOf(lines[i]!) === ind && lines[i]!.trimStart().startsWith("- ")) {
      const rest = lines[i]!.trimStart().slice(2);
      if (/^[^\s:][^:]*:(?: |$)/.test(rest)) {
        lines[i] = " ".repeat(ind + 2) + rest;
        out.push(block(ind + 2));
      } else {
        out.push(scalar(rest));
        i++;
      }
    }
    return out;
  };
  const map = (ind: number): { [k: string]: Y } => {
    const out: { [k: string]: Y } = {};
    while (i < lines.length && indentOf(lines[i]!) === ind && !lines[i]!.trimStart().startsWith("- ")) {
      const m = /^([^\s:][^:]*):(?: (.*))?$/.exec(lines[i]!.trimStart());
      if (!m) throw new Error(`読めない行: ${lines[i]}`);
      i++;
      const next = lines[i];
      if (m[2] !== undefined && m[2] !== "") out[m[1]!] = scalar(m[2]);
      else if (
        next !== undefined &&
        (indentOf(next) > ind || (indentOf(next) === ind && next.trimStart().startsWith("- ")))
      )
        out[m[1]!] = block(indentOf(next));
      else out[m[1]!] = null;
    }
    return out;
  };
  return block(indentOf(lines[0]!));
}
const isObj = (v: unknown): v is { [k: string]: unknown } => typeof v === "object" && v !== null && !Array.isArray(v);
function satisfies(schema: unknown, v: unknown): boolean {
  if (!isObj(schema)) return true;
  if (
    Array.isArray(schema["required"]) &&
    isObj(v) &&
    !schema["required"].every((k) => typeof k === "string" && k in v)
  )
    return false;
  if (isObj(schema["properties"]) && isObj(v))
    for (const [k, ps] of Object.entries(schema["properties"])) if (k in v && !satisfies(ps, v[k])) return false;
  if (Array.isArray(schema["enum"]) && !schema["enum"].includes(v)) return false;
  if ("not" in schema && satisfies(schema["not"], v)) return false;
  if (Array.isArray(schema["anyOf"]) && !schema["anyOf"].some((x) => satisfies(x, v))) return false;
  if (Array.isArray(schema["oneOf"]) && schema["oneOf"].filter((x) => satisfies(x, v)).length !== 1) return false;
  return true;
}
/** openapi.yaml の `x-operation: updateTicket` を持つ入力の形の、最上位の oneOf だけを取り出す */
function updateTicketOneOf(): Y[] {
  const lines = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "08_api", "openapi.yaml"),
    "utf8",
  ).split("\n");
  const at = lines.indexOf("      x-operation: updateTicket");
  expect(at, "openapi.yaml に x-operation: updateTicket の入力の形が在る").toBeGreaterThan(0);
  let from = at;
  while (from > 0 && !/^ {4}\S/.test(lines[from - 1]!)) from--;
  let to = at;
  while (to < lines.length && !/^ {0,4}\S/.test(lines[to + 1] ?? "x")) to++;
  const shape = parseYamlBlock(lines.slice(from, to + 1).join("\n")) as { oneOf?: Y[] };
  expect(Array.isArray(shape.oneOf), "updateTicket の入力に oneOf が在る").toBe(true);
  return shape.oneOf!;
}

interface World {
  tenantId: string;
  root: string;
  g1: string;
  g2: string;
  /** 全体に書ける（全部見える）。名前は「高本」 */
  boss: Person;
  /** g1 に書ける */
  e1: Person;
  /** g2 に書ける */
  e2: Person;
  /** g1 を読むだけ */
  viewer: Person;
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K440 の会社 ${Math.random().toString(36).slice(2, 7)}`, "LA");
  const grp = async (name: string, prefix: string): Promise<string> =>
    (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, $2, $3, $4) returning id",
        [c.tenantId, name, prefix, c.rootScope],
      )
    ).rows[0]!.id;
  const g1 = await grp("営業", "LA");
  const g2 = await grp("受託開発", "LB");
  const boss = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const e1 = await f.person(c.tenantId, g1, { name: "営業の人", ticketAbility: "edit" });
  const e2 = await f.person(c.tenantId, g2, { name: "開発の人", ticketAbility: "edit" });
  const viewer = await f.person(c.tenantId, g1, { name: "読むだけの人", ticketAbility: "view" });
  return { tenantId: c.tenantId, root: c.rootScope, g1, g2, boss, e1, e2, viewer };
}

interface Opts {
  title?: string;
  due?: string | null;
  parent?: string | null;
  assignee?: string | null;
  priority?: "mid" | "high";
  priorityReason?: string | null;
}
/** チケットを管理の接続で直に入れる（行の守りの外）。number は引き金が付ける */
async function mk(w: World, scope: string, o: Opts = {}): Promise<{ id: string; number: string }> {
  const r = await f.admin.query<{ id: string; number: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, due_on, parent_ticket_id, assignee_member_id, priority, priority_reason)
     select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
            (select id from ticket_stages where tenant_id = $1 and key = 'todo'), $3, $4::date, $5, $6, $7, $8
     returning id, number`,
    [
      w.tenantId,
      scope,
      o.title ?? "振り分けるチケット",
      o.due === undefined ? jst(3) : o.due,
      o.parent ?? null,
      o.assignee ?? null,
      o.priority ?? "mid",
      o.priorityReason ?? null,
    ],
  );
  return r.rows[0]!;
}
const row = async (id: string): Promise<Json> =>
  (await f.admin.query("select t.*, t.due_on::text as due_text from tickets t where t.id = $1", [id])).rows[0] as Json;
const lines = async (
  id: string,
): Promise<
  {
    body: string;
    changes: { field: string; from: unknown; to: unknown; note?: string }[];
    author_member_id: string | null;
  }[]
> =>
  (
    await f.admin.query(
      "select body, changes, author_member_id from ticket_messages where ticket_id = $1 and kind = 'change' order by created_at, id",
      [id],
    )
  ).rows;
const audits = async (tenantId: string): Promise<Json[]> =>
  (
    await f.admin.query(
      "select * from audit_events where tenant_id = $1 and action = 'ticket.sort' order by occurred_at",
      [tenantId],
    )
  ).rows as Json[];

const patch = (who: Person, id: string, body: unknown) => f.req("PATCH", `/tickets/${id}`, { headers: who.auth, body });
async function patchOk(who: Person, id: string, body: unknown): Promise<Json> {
  const r = await patch(who, id, body);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await asJson(r))["data"] ?? {}) as Json;
}
const field422 = async (r: Response, field: string, label: string): Promise<void> => {
  const text = await r.text();
  expect(r.status, `${label}: ${text}`).toBe(422);
  expect(text, label).toContain(field);
};

/** 指定した表への insert だけを、その条件のときに落とす引き金（ほかの会社・ほかの試験に当たらない） */
async function failingInsert(table: string, cond: string, body: () => Promise<void>): Promise<void> {
  const name = `k440_fail_${Math.random().toString(36).slice(2, 8)}`;
  await f.admin.query(
    `create function public.${name}() returns trigger language plpgsql as $$ begin raise exception 'K-440 の試験でわざと落とした'; end $$`,
  );
  await f.admin.query(
    `create trigger ${name} before insert on ${table} for each row when (${cond}) execute function public.${name}()`,
  );
  try {
    await body();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists public.${name}()`);
  }
}
/** 証跡を書く所（手順 S1）だけを、その会社の ticket.sort のときに落とす */
const failingAudit = (tenantId: string, body: () => Promise<void>): Promise<void> =>
  failingInsert("audit_events", `new.tenant_id = '${tenantId}' and new.action = 'ticket.sort'`, body);
/** 知らせの受け箱の行を書く所（手順 S2）だけを、その会社の ticket.sort_changed のときに落とす */
const failingNote = (tenantId: string, body: () => Promise<void>): Promise<void> =>
  failingInsert("notifications", `new.tenant_id = '${tenantId}' and new.event_kind_id = 'ticket.sort_changed'`, body);
const notesOf = async (ticketId: string): Promise<Json[]> =>
  (
    await f.admin.query(
      "select * from notifications where event_kind_id = 'ticket.sort_changed' and payload->>'ticket_id' = $1 order by created_at, id",
      [ticketId],
    )
  ).rows as Json[];
const sortSet = (who: { id: string; tenantId: string }, ticket: string, p: object): Promise<Json> =>
  withTenant(
    f.pool,
    { tenantId: who.tenantId, userId: who.id, role: "member", stepUpAt: null },
    async (cl) =>
      (await cl.query<{ v: Json }>("select app.ticket_sort_set($1::uuid, $2::jsonb) as v", [ticket, JSON.stringify(p)]))
        .rows[0]!.v,
  );

describe("K-440 優先度・親", () => {
  it("K440-API-001 優先度を高にする（理由つき）→ 200・列・変更の 1 行", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    const d = await patchOk(w.boss, t.id, { priority: "high", priority_reason: "取引先が急いでいる" });
    expect(d["changed"]).toBe(true);
    const tk = d["ticket"] as Json;
    expect(sorted(tk)).toEqual(["id", "number", "priority", "priority_reason", "updated_at"]);
    const r = await row(t.id);
    expect(r).toMatchObject({ priority: "high", priority_reason: "取引先が急いでいる" });
    const ls = await lines(t.id);
    expect(ls.length).toBe(1);
    expect(ls[0]!.body).toBe("高本 が優先度を 中 → 高 に変えた（理由：取引先が急いでいる）");
    expect(ls[0]!.changes).toEqual([{ field: "priority", from: "中", to: "高", note: "取引先が急いでいる" }]);
  });

  it("K440-API-002 優先度の理由の組み合わせ：高で理由なし・空白だけ・中で理由つき・理由だけ → 422・欄 priority_reason・何も変わらない", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    const cases: [string, unknown][] = [
      ["高で理由なし", { priority: "high" }],
      ["高で空白だけ", { priority: "high", priority_reason: "　" }],
      ["中で理由つき", { priority: "mid", priority_reason: "急ぎ" }],
      ["理由だけ", { priority_reason: "理由だけ" }],
    ];
    for (const [label, body] of cases) await field422(await patch(w.boss, t.id, body), "priority_reason", label);
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
    expect((await lines(t.id)).length).toBe(0);
    // 契約の oneOf を読んで、口と同じ答えを言うこと（高で理由なし・中で理由つき・理由だけは無効、何も無い・中だけ・高で理由つきは有効）
    const rule = { oneOf: updateTicketOneOf() };
    for (const bad of [
      { priority: "high" },
      { priority: "mid", priority_reason: "急ぎ" },
      { priority_reason: "理由だけ" },
    ])
      expect(satisfies(rule, bad), `契約は無効と言う ${JSON.stringify(bad)}`).toBe(false);
    for (const ok of [{}, { priority: "mid" }, { priority: "high", priority_reason: "急ぎ" }])
      expect(satisfies(rule, ok), `契約は有効と言う ${JSON.stringify(ok)}`).toBe(true);
  });

  it("K440-API-003 高 → 中は理由の列が空・知らない値は 422・高のまま理由だけ直すと 1 行", async () => {
    const w = await world();
    const t = await mk(w, w.g1, { priority: "high", priorityReason: "最初の理由" });
    for (const bad of ["urgent", "HIGH", "", null, 1]) {
      const r = await patch(w.boss, t.id, { priority: bad, priority_reason: "x" });
      const j = (await asJson(r)) as { details?: { field: string }[] };
      expect(r.status, String(bad)).toBe(422);
      expect((j.details ?? []).map((d) => d.field).filter((x) => x === "priority").length, String(bad)).toBe(1);
    }
    expect(await row(t.id)).toMatchObject({ priority: "high", priority_reason: "最初の理由" });
    const rewrite = await patchOk(w.boss, t.id, { priority: "high", priority_reason: "直した理由" });
    expect(rewrite["changed"]).toBe(true);
    expect(await row(t.id)).toMatchObject({ priority: "high", priority_reason: "直した理由" });
    const down = await patchOk(w.boss, t.id, { priority: "mid" });
    expect(down["changed"]).toBe(true);
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
    const ls = await lines(t.id);
    expect(ls.length).toBe(2);
    expect(ls[1]!.body).toBe("高本 が優先度を 高 → 中 に変えた");
  });

  it("K440-API-004 親を決める → 200・列が親の id・変更の 1 行「親を … に決めた」", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(8) });
    const t = await mk(w, w.g1);
    const d = await patchOk(w.boss, t.id, { parent_ticket_id: p.id });
    expect(d["changed"]).toBe(true);
    expect(sorted(d["ticket"] as object)).toEqual(["id", "number", "parent_ticket_id", "updated_at"]);
    expect((await row(t.id))["parent_ticket_id"]).toBe(p.id);
    const ls = await lines(t.id);
    expect(ls.length).toBe(1);
    expect(ls[0]!.body).toBe(`高本 が親を ${p.number} に決めた`);
    expect(ls[0]!.changes).toEqual([{ field: "parent", from: null, to: p.number }]);
  });

  it("K440-API-005 親を外す（null）→ 200・列は null・行「親を外した（…）」", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(8) });
    const t = await mk(w, w.g1, { parent: p.id });
    const d = await patchOk(w.boss, t.id, { parent_ticket_id: null });
    expect(d["changed"]).toBe(true);
    expect((await row(t.id))["parent_ticket_id"]).toBeNull();
    const ls = await lines(t.id);
    expect(ls[0]!.body).toBe(`高本 が親を外した（${p.number}）`);
    expect(ls[0]!.changes).toEqual([{ field: "parent", from: p.number, to: null }]);
  });

  it("K440-API-006 親を変える（A → B）→ 200・列が B・行「親を A → B に変えた」", async () => {
    const w = await world();
    const a = await mk(w, w.g1, { due: jst(8) });
    const b = await mk(w, w.g1, { due: jst(8) });
    const t = await mk(w, w.g1, { parent: a.id });
    await patchOk(w.boss, t.id, { parent_ticket_id: b.id });
    expect((await row(t.id))["parent_ticket_id"]).toBe(b.id);
    const ls = await lines(t.id);
    expect(ls[0]!.body).toBe(`高本 が親を ${a.number} → ${b.number} に変えた`);
  });

  it("K440-API-007 親が無い uuid・別の会社・消したチケット・自分に見えないチケット → 404・E-PAGE-001・欄 parent_ticket_id・親は変わらない", async () => {
    const w = await world();
    const other = await world();
    const t = await mk(w, w.g1);
    const foreign = await mk(other, other.g1);
    const deleted = await mk(w, w.g1);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [deleted.id]);
    const hidden = await mk(w, w.g2);
    const asks: [Person, string][] = [
      [w.boss, NO_SUCH],
      [w.boss, foreign.id],
      [w.boss, deleted.id],
      [w.e1, hidden.id],
    ];
    for (const [who, parent] of asks) {
      const r = await patch(who, t.id, { parent_ticket_id: parent });
      const j = await asJson(r);
      expect(r.status, parent).toBe(404);
      expect(j["code"]).toBe("E-PAGE-001");
      bare(j);
    }
    expect((await row(t.id))["parent_ticket_id"]).toBeNull();
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K440-API-008 親が自分自身 → 409・E-TKT-001・何も変わらない", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    const r = await patch(w.boss, t.id, { parent_ticket_id: t.id });
    expect(r.status).toBe(409);
    {
      const b = await asJson(r);
      expect(b["code"]).toBe("E-TKT-001");
      bare(b);
    }
    expect((await row(t.id))["parent_ticket_id"]).toBeNull();
  });

  it("K440-API-009 親が自分の子・孫 → 409・E-TKT-002・何も変わらない", async () => {
    const w = await world();
    const t = await mk(w, w.g1, { due: jst(9) });
    const c = await mk(w, w.g1, { due: jst(8), parent: t.id });
    const g = await mk(w, w.g1, { due: jst(7), parent: c.id });
    for (const parent of [c.id, g.id]) {
      const r = await patch(w.boss, t.id, { parent_ticket_id: parent });
      expect(r.status, parent).toBe(409);
      {
        const b = await asJson(r);
        expect(b["code"]).toBe("E-TKT-002");
        bare(b);
      }
    }
    expect((await row(t.id))["parent_ticket_id"]).toBeNull();
  });

  it("K440-API-010 親が 3 段目／自分に子がいて深くなる → 409・E-TKT-003／親が 2 段目なら 200（3 段まで）", async () => {
    const w = await world();
    const x1 = await mk(w, w.g1, { due: jst(9) });
    const x2 = await mk(w, w.g1, { due: jst(9), parent: x1.id });
    const x3 = await mk(w, w.g1, { due: jst(9), parent: x2.id });
    const t = await mk(w, w.g1, { due: jst(3) });
    const tooDeep = await patch(w.boss, t.id, { parent_ticket_id: x3.id });
    expect(tooDeep.status).toBe(409);
    {
      const b = await asJson(tooDeep);
      expect(b["code"]).toBe("E-TKT-003");
      bare(b);
    }
    const withChild = await mk(w, w.g1, { due: jst(3) });
    await mk(w, w.g1, { due: jst(3), parent: withChild.id });
    const deepenChild = await patch(w.boss, withChild.id, { parent_ticket_id: x2.id });
    expect(deepenChild.status).toBe(409);
    {
      const b = await asJson(deepenChild);
      expect(b["code"]).toBe("E-TKT-003");
      bare(b);
    }
    expect((await row(t.id))["parent_ticket_id"]).toBeNull();
    expect((await row(withChild.id))["parent_ticket_id"]).toBeNull();
    const ok = await patchOk(w.boss, t.id, { parent_ticket_id: x2.id });
    expect(ok["changed"]).toBe(true);
  });

  it("K440-API-011 親の期限：期限が親より後のチケットに親を決める → 409・E-TKT-004（欄 parent_ticket_id）・何も変わらない／親と同じ日・親の期限が空は 200", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(5) });
    const late = await mk(w, w.g1, { due: jst(9) });
    const r = await patch(w.boss, late.id, { parent_ticket_id: p.id });
    expect(r.status).toBe(409);
    const j = await asJson(r);
    expect(j["code"]).toBe("E-TKT-004");
    bare(j);
    expect((await row(late.id))["parent_ticket_id"]).toBeNull();
    expect((await lines(late.id)).length).toBe(0);
    const same = await mk(w, w.g1, { due: jst(5) });
    expect((await patchOk(w.boss, same.id, { parent_ticket_id: p.id }))["changed"]).toBe(true);
    const noDue = await mk(w, w.g1, { due: null });
    expect((await patchOk(w.boss, noDue.id, { parent_ticket_id: p.id }))["changed"]).toBe(true);
    expect(String((await row(late.id))["due_text"])).toBe(jst(9));
  });

  it("K440-API-012 詳細であとから親を決める → 親の担当者・グループがチェックを入れても、チケットの担当者・グループ・取引先は変わらない", async () => {
    const w = await world();
    const p = await mk(w, w.g2, { due: jst(8), assignee: w.e2.id });
    const t = await mk(w, w.g1, { assignee: w.e1.id });
    const before = await row(t.id);
    await patchOk(w.boss, t.id, { parent_ticket_id: p.id });
    const after = await row(t.id);
    for (const col of ["assignee_member_id", "scope_id", "client_id", "kind_id", "title"])
      expect(after[col], col).toEqual(before[col]);
    expect(after["parent_ticket_id"]).toBe(p.id);
    expect(after["assignee_member_id"]).toBe(w.e1.id);
  });

  it("K440-API-013 同じ値をもう一度（同じ優先度と理由・同じ親・親が無いのに外す）→ 200・changed false・message_id null・更新時刻も行も変わらない", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    expect((await patchOk(w.boss, t.id, { priority: "high", priority_reason: "一度目" }))["changed"]).toBe(true);
    const stamp = ((await row(t.id))["updated_at"] as Date).getTime();
    const again = await patchOk(w.boss, t.id, { priority: "high", priority_reason: "一度目" });
    expect(again["changed"]).toBe(false);
    expect(again["message_id"]).toBeNull();
    expect(((await row(t.id))["updated_at"] as Date).getTime()).toBe(stamp);
    expect((await lines(t.id)).length).toBe(1);
    const p = await mk(w, w.g1, { due: jst(8) });
    await patchOk(w.boss, t.id, { parent_ticket_id: p.id });
    const pstamp = ((await row(t.id))["updated_at"] as Date).getTime();
    const sameParent = await patchOk(w.boss, t.id, { parent_ticket_id: p.id });
    expect(sameParent["changed"]).toBe(false);
    expect(sameParent["message_id"]).toBeNull();
    const free = await mk(w, w.g1);
    expect((await patchOk(w.boss, free.id, { parent_ticket_id: null }))["changed"]).toBe(false);
    expect(((await row(t.id))["updated_at"] as Date).getTime()).toBe(pstamp);
    expect((await lines(t.id)).length).toBe(2);
    expect((await lines(free.id)).length).toBe(0);
  });

  it("K440-API-014 優先度と親を一緒に変える → 200・変更の 1 行は 1 つ（changes は priority・parent の順・「・」でつなぐ）・証跡 1 行（fields が 2 つ）", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(10) });
    const t = await mk(w, w.g1, { due: jst(3) });
    const d = await patchOk(w.boss, t.id, { priority: "high", priority_reason: "先方が急ぐ", parent_ticket_id: p.id });
    expect(d["changed"]).toBe(true);
    expect(sorted(d["ticket"] as object)).toEqual([
      "id",
      "number",
      "parent_ticket_id",
      "priority",
      "priority_reason",
      "updated_at",
    ]);
    const ls = await lines(t.id);
    expect(ls.length).toBe(1);
    expect(ls[0]!.changes.map((c) => c.field)).toEqual(["priority", "parent"]);
    expect(ls[0]!.body).toBe(`高本 が優先度を 中 → 高 に変えた（理由：先方が急ぐ）・親を ${p.number} に決めた`);
    const au = await audits(w.tenantId);
    expect(au.length).toBe(1);
    expect(((au[0]!["payload"] as { fields: string[] }).fields ?? []).length).toBe(2);
  });

  it("K440-API-015 段（K-387 の組）と優先度を一緒に送る：段が別の会社の段で断られたら優先度も書かない（取引ごと戻る）／両方正しければ両方書く", async () => {
    const w = await world();
    const other = await world();
    const t = await mk(w, w.g1);
    const foreignStage = (
      await f.admin.query<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [
        other.tenantId,
      ])
    ).rows[0]!.id;
    // 別の会社の段は K-387 の控え帳の決めで 404・E-PAGE-001（欄 stage_id）。ここで見るのは断りの種類でなく、組をまたいで戻ること
    const r = await patch(w.boss, t.id, { stage_id: foreignStage, priority: "high", priority_reason: "ついでに" });
    const rt = await r.text();
    expect(r.status, rt).toBe(404);
    expect(JSON.parse(rt).code).toBe("E-PAGE-001");
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
    const ok = await patchOk(w.boss, t.id, { stage_key: "doing", priority: "high", priority_reason: "一緒に" });
    expect(ok["changed"]).toBe(true);
    expect(await row(t.id)).toMatchObject({ priority: "high", priority_reason: "一緒に" });
    const stage = (
      await f.admin.query<{ key: string | null }>(
        "select s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
        [t.id],
      )
    ).rows[0]!.key;
    expect(stage).toBe("doing");
    expect((await lines(t.id)).length).toBe(2);
  });

  it("K440-API-016 担当者・番号・題名・完了の時刻など組に無い欄を一緒に送る → 422・E-VAL-018・欄ごと・優先度も変わらない", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    const r = await patch(w.boss, t.id, {
      priority: "high",
      priority_reason: "理由",
      assignee_member_id: w.e1.id,
      number: "ZZ-1",
      title: "別の題名",
      completed_at: "2026-01-01T00:00:00Z",
    });
    const text = await r.text();
    expect(r.status, text).toBe(422);
    expect((JSON.parse(text) as Json)["code"]).toBe("E-VAL-018");
    for (const k of ["assignee_member_id", "number", "title", "completed_at"]) expect(text, k).toContain(k);
    expect(text).not.toContain("priority_reason");
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null, assignee_member_id: null });
  });

  it("K440-API-017 読むだけの人・別の会社の人・消したチケット・見えないチケット → 403・404・404・404・何も変わらない", async () => {
    const w = await world();
    const other = await world();
    const t = await mk(w, w.g1, { due: jst(3) });
    const deleted = await mk(w, w.g1);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [deleted.id]);
    const hidden = await mk(w, w.g2);
    const body = { priority: "high", priority_reason: "理由" };
    expect((await patch(w.viewer, t.id, body)).status).toBe(403);
    expect((await patch(other.boss, t.id, body)).status).toBe(404);
    expect((await patch(w.boss, deleted.id, body)).status).toBe(404);
    expect((await patch(w.e1, hidden.id, body)).status).toBe(404);
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K440-API-018 親が自分に見えるが書けないグループ → 200（親にできる物は見えれば足りる）", async () => {
    const w = await world();
    const readOnly = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '閲覧グループ', 'LV', $2) returning id",
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [w.tenantId, w.e1.id, readOnly],
    );
    const p = await mk(w, readOnly, { due: jst(8) });
    const t = await mk(w, w.g1);
    const d = await patchOk(w.e1, t.id, { parent_ticket_id: p.id });
    expect(d["changed"]).toBe(true);
    expect((await row(t.id))["parent_ticket_id"]).toBe(p.id);
  });

  it("K440-API-019 2 人が同時に優先度の理由を変える → どちらも 200・変更の 1 行が 2 つ・2 つ目の from は 1 つ目の to・列は 2 つ目の理由", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    const rs = await Promise.all([
      patch(w.boss, t.id, { priority: "high", priority_reason: "A さんの理由" }),
      patch(w.e1, t.id, { priority: "high", priority_reason: "B さんの理由" }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const ls = await lines(t.id);
    expect(ls.length).toBe(2);
    const first = ls.map((l) => l.changes[0]!).find((c) => c.from === "中")!;
    const second = ls.map((l) => l.changes[0]!).find((c) => c.from === "高")!;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect((await row(t.id))["priority_reason"]).toBe(second.note);
    expect(first.note).not.toBe(second.note);
  });

  it("K440-API-020 A の親を B・B の親を A に同時に → 200 が 1 つと 409（E-TKT-002）が 1 つ・輪にならない", async () => {
    const w = await world();
    const a = await mk(w, w.g1, { due: jst(8) });
    const b = await mk(w, w.g1, { due: jst(8) });
    const rs = await Promise.all([
      patch(w.boss, a.id, { parent_ticket_id: b.id }),
      patch(w.e1, b.id, { parent_ticket_id: a.id }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const lost = rs.find((r) => r.status === 409)!;
    {
      const b = await asJson(lost);
      expect(b["code"]).toBe("E-TKT-002");
      bare(b);
    }
    const parents = [(await row(a.id))["parent_ticket_id"], (await row(b.id))["parent_ticket_id"]];
    expect(parents.filter((p) => p !== null).length).toBe(1);
  });

  it("K440-API-021 失敗（手順 S1・書く所）：証跡を書く所で DB が落ちる → 503・E-PAGE-003・優先度・親・変更の 1 行が前のまま", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(9) });
    const t = await mk(w, w.g1);
    await failingAudit(w.tenantId, async () => {
      const r = await patch(w.boss, t.id, {
        priority: "high",
        priority_reason: "急ぎ",
        parent_ticket_id: p.id,
      });
      const text = await r.text();
      expect(r.status).toBe(503);
      expect(JSON.parse(text).code).toBe("E-PAGE-003");
      expect(text).not.toContain("わざと落とした");
      expect(text).not.toContain("急ぎ");
    });
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null, parent_ticket_id: null });
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
  });

  it("K440-API-022 関数を直に叩く（読むだけの人・止められた人・別の会社の人・高で理由なし）→ not_writable・not_member・not_found・reason_required（欄 priority_reason）・何も変わらない", async () => {
    const w = await world();
    const other = await world();
    const t = await mk(w, w.g1);
    const stopped = await f.person(w.tenantId, w.g1, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    const p = { priority: "high", priority_reason: "理由" };
    expect(await sortSet(w.viewer, t.id, p)).toMatchObject({ error: "not_writable" });
    expect(await sortSet(stopped, t.id, p)).toMatchObject({ error: "not_member" });
    expect(await sortSet(other.boss, t.id, p)).toMatchObject({ error: "not_found" });
    expect(await sortSet(w.boss, t.id, { priority: "high" })).toMatchObject({
      error: "reason_required",
      field: "priority_reason",
    });
    expect(await sortSet(w.boss, t.id, { priority: "high", priority_reason: "  " })).toMatchObject({
      error: "reason_required",
    });
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
    expect((await lines(t.id)).length).toBe(0);
  });

  it("K440-API-023 変えた後に詳細（GET /tickets/:id）を開き直す → priority・priority_reason・parent_ticket_id が変えた値", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(10) });
    const t = await mk(w, w.g1, { due: jst(3) });
    await patchOk(w.boss, t.id, {
      priority: "high",
      priority_reason: "急ぎの理由",
      parent_ticket_id: p.id,
    });
    const r = await f.req("GET", `/tickets/${t.id}`, { headers: w.boss.auth });
    expect(r.status, await r.clone().text()).toBe(200);
    const tk = (((await asJson(r))["data"] ?? {}) as Json)["ticket"] as Json;
    expect(tk["priority"]).toBe("high");
    expect(tk["priority_reason"]).toBe("急ぎの理由");
    expect(tk["parent_ticket_id"]).toBe(p.id);
  });

  it("K440-API-024 知らせ：担当者でない人が優先度・親を変える → 担当者の受け箱に行が 1 つ（種類 ticket.sort_changed・理由と題名の字が無い・メールなし）・2 つ一緒でも 1 通", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(10) });
    const t = await mk(w, w.g1, { due: jst(3), assignee: w.e1.id });
    await patchOk(w.boss, t.id, { priority: "high", priority_reason: "秘密の理由その一" });
    const one = await notesOf(t.id);
    expect(one.length).toBe(1);
    expect(one[0]).toMatchObject({ member_id: w.e1.id, channel_id: "inapp", event_kind_id: "ticket.sort_changed" });
    const payload = one[0]!["payload"] as { fields: string[]; message_id: string } & Json;
    expect(sorted(payload)).toEqual(["fields", "message_id", "number", "ticket_id", "url"]);
    expect(payload.fields).toEqual(["priority"]);
    expect(one[0]!["dedupe_key"]).toBe(`ticket.sort_changed:${payload.message_id}`);
    expect(JSON.stringify(payload)).not.toContain("秘密の理由");
    expect(JSON.stringify(payload)).not.toContain("振り分けるチケット");
    await patchOk(w.boss, t.id, { parent_ticket_id: p.id });
    const two = await notesOf(t.id);
    expect(two.length).toBe(2);
    expect(two.map((n) => (n["payload"] as { fields: string[] }).fields)).toEqual([["priority"], ["parent"]]);
    const all = await mk(w, w.g1, { due: jst(3), assignee: w.e1.id });
    await patchOk(w.boss, all.id, { priority: "high", priority_reason: "急ぎ", parent_ticket_id: p.id });
    const batch = await notesOf(all.id);
    expect(batch.length).toBe(1);
    expect((batch[0]!["payload"] as { fields: string[] }).fields).toEqual(["priority", "parent"]);
    expect(
      (
        await f.admin.query(
          "select count(*)::int as n from notifications where tenant_id = $1 and channel_id <> 'inapp'",
          [w.tenantId],
        )
      ).rows[0].n,
    ).toBe(0);
  });

  it("K440-API-025 知らせない場合：本人（担当者）が変えた・担当者がいない・担当者が止められている・何も変わらなかった → 行が増えない", async () => {
    const w = await world();
    const stopped = await f.person(w.tenantId, w.g1, { name: "止められた人", ticketAbility: "edit" });
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.id]);
    const own = await mk(w, w.g1, { assignee: w.boss.id });
    const nobody = await mk(w, w.g1);
    const gone = await mk(w, w.g1, { assignee: stopped.id });
    const same = await mk(w, w.g1, { assignee: w.e1.id });
    for (const t of [own, nobody, gone]) await patchOk(w.boss, t.id, { priority: "high", priority_reason: "理由" });
    for (const t of [own, nobody, gone]) expect((await notesOf(t.id)).length, t.number).toBe(0);
    await patchOk(w.boss, same.id, { priority: "high", priority_reason: "一度目" });
    expect((await notesOf(same.id)).length).toBe(1);
    const again = await patchOk(w.boss, same.id, { priority: "high", priority_reason: "一度目" });
    expect(again["changed"]).toBe(false);
    expect((await notesOf(same.id)).length).toBe(1);
  });

  it("K440-API-026 失敗（手順 S2・知らせ）：担当者の受け箱の行を書く所で DB が落ちる → 503・E-PAGE-003・取引ごと戻る（優先度・変更の 1 行・証跡が前のまま）", async () => {
    const w = await world();
    const t = await mk(w, w.g1, { assignee: w.e1.id });
    await failingNote(w.tenantId, async () => {
      const r = await patch(w.boss, t.id, { priority: "high", priority_reason: "理由の字" });
      const text = await r.text();
      expect(r.status).toBe(503);
      expect(JSON.parse(text).code).toBe("E-PAGE-003");
      expect(text).not.toContain("わざと落とした");
      expect(text).not.toContain("理由の字");
    });
    expect(await row(t.id)).toMatchObject({ priority: "mid", priority_reason: null });
    expect((await lines(t.id)).length).toBe(0);
    expect((await audits(w.tenantId)).length).toBe(0);
    expect((await notesOf(t.id)).length).toBe(0);
  });

  it("K440-API-027 知らせは 1 回の要求で 1 人に 1 通：担当者でない人が段と優先度と親を一緒に変えても、担当者の受け箱の行は 1 つで、変えた欄の名前が全部入る（代表の答え ⑮7）", async () => {
    const w = await world();
    const p = await mk(w, w.g1, { due: jst(10) });
    const t = await mk(w, w.g1, { due: jst(3), assignee: w.e1.id });
    await patchOk(w.boss, t.id, {
      stage_key: "doing",
      priority: "high",
      priority_reason: "段と一緒",
      parent_ticket_id: p.id,
    });
    const all = (
      await f.admin.query(
        "select event_kind_id, payload from notifications where payload->>'ticket_id' = $1 and member_id = $2 order by created_at, id",
        [t.id, w.e1.id],
      )
    ).rows as { event_kind_id: string; payload: { fields?: string[] } }[];
    expect(all.length).toBe(1);
    expect(all[0]!.event_kind_id).toBe("ticket.stage_changed");
    expect(all[0]!.payload.fields).toEqual(["priority", "parent"]);
    expect(JSON.stringify(all[0]!.payload)).not.toContain("段と一緒");
  });

  it("K440-API-028 対にならないサロゲートを含む理由：段の組と同じく U+FFFD に置き換えて 200 で書く（欄によって答えを変えない）", async () => {
    const w = await world();
    const t = await mk(w, w.g1);
    const ok = await patchOk(w.boss, t.id, { priority: "high", priority_reason: "急ぎ\uD800の理由\uDC00" });
    expect(ok["changed"]).toBe(true);
    expect(await row(t.id)).toMatchObject({ priority: "high", priority_reason: "急ぎ\uFFFDの理由\uFFFD" });
  });

  it("K440-API-029 錠の順：段と親を一緒に送る要求と、親だけの要求が逆向きに同時に来ても、行き詰まらず 200 が 1 つと 409 が 1 つ（会社の錠を先に取る）", async () => {
    const w = await world();
    for (let n = 0; n < 6; n++) {
      const a = await mk(w, w.g1, { due: jst(8) });
      const b = await mk(w, w.g1, { due: jst(8) });
      const rs = await Promise.all([
        patch(w.boss, a.id, { stage_key: "doing", parent_ticket_id: b.id }),
        patch(w.e1, b.id, { parent_ticket_id: a.id }),
      ]);
      expect(rs.map((r) => r.status).sort(), `${n} 回目`).toEqual([200, 409]);
    }
  });
});
