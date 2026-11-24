// K-582「業務の型を口と契約から外す（段 5 の F4 が持つ分）」の単体の試験（口と契約と DB・本物の Postgres・目録と契約のファイル）。
// テストの名前の頭の行 ID（K582-API-…）は 11_tickets/K-582.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-150.60・業務の型は物として無くす。種別の本文のひな形 ticket_kinds.body_template とナレッジのページで受ける）:
//   契約の口 listWorkTypeCandidates（GET /api/v1/tickets/:id/work-type-candidates）と、その生成の試験・道・目録の行
//   作る口 createTicket・直す口 updateTicket・読む口 getTicket は work_type_id・work_type_version を受けない・出さない
//   列 tickets.work_type_id・work_type_version は消さず凍結（行の値は残る・コードは読まない・書かない・列の注に「凍結」）
// 触らないもの（段 10 の持ち物）: 業務の型を作る側の口（listWorkTypes ほか 9 つ）と運営の口（listOpsWorkTypes ほか 6 つ）は段 10 の K-711 が外す。
//   この試験はそれらが在るか無いかを見ない（K-711 の前でも後でも同じに緑）。skills の表と kind の check（work_type）は残る
// 外した口の記録（D-128.77）: 08_api/retired-endpoints.json に、この葉の口と、K-563 が外した listClassAxes（GET /class_axes）を 1 本ずつ
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");
const CAND = /listWorkTypeCandidates|work-type-candidates|work_type_candidates/;
const COLS = /work_type_id|work_type_version/;

let f: Fixture;
let loaded = false;
/** 口の振る舞い（K-387 の hooks のファイル）は最初の要求の前に 1 回だけ読む（準備で読まない・answer=8f745003d023） */
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HERE, "..", "..", "..", "src", "hooks", "ticket-update.ts"))) as {
    register: HookModule;
  };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
  loaded = true;
}
beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown> & { data?: Record<string, unknown> };
const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
const jst = (days = 0): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const para = (t: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
const fieldsOf = (j: Json): string[] => ((j["details"] as { field: string }[] | undefined) ?? []).map((d) => d.field);

interface World {
  tenantId: string;
  root: string;
  kindId: string;
  writer: Person;
  mate: Person;
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K582 の会社 ${Math.random().toString(36).slice(2, 7)}`, "WT");
  const kindId = (
    await f.admin.query<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [c.tenantId],
    )
  ).rows[0]!.id;
  const writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const mate = await f.person(c.tenantId, c.rootScope, { name: "営業の人", ticketAbility: "edit" });
  return { tenantId: c.tenantId, root: c.rootScope, kindId, writer, mate };
}
/** チケットを管理の接続で直に置く（work_type_version に値を入れた形も作れる。work_type_id は skills への参照なので null のまま） */
async function mk(w: World, o: { version?: number | null } = {}): Promise<{ id: string; number: string }> {
  return (
    await f.admin.query<{ id: string; number: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, due_on, assignee_member_id, work_type_version)
       select $1, $2, 'pending', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '業務の型を持っていたチケット', $4::date, $5, $6
       returning id, number`,
      [w.tenantId, w.root, w.kindId, jst(3), w.mate.id, o.version ?? null],
    )
  ).rows[0]!;
}
const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const walk = (d: string, ext: RegExp): string[] =>
  readdirSync(d).flatMap((x) =>
    x === "node_modules" || x === ".next"
      ? []
      : statSync(join(d, x)).isDirectory()
        ? walk(join(d, x), ext)
        : ext.test(x)
          ? [join(d, x)]
          : [],
  );
const createBody = (w: World, extra: Record<string, unknown> = {}) => ({
  scope_id: w.root,
  kind_id: w.kindId,
  title: "請求書を送る",
  assignee_member_id: w.mate.id,
  due_on: jst(3),
  body: { doc: para("月末の請求を出す") },
  ...extra,
});

describe("K-582 業務の型を口と契約から外す", () => {
  it("K582-API-001 外した道 GET /tickets/:id/work-type-candidates は道ごと無い（404・501 でない）。同じチケットの詳細は 200", async () => {
    const w = await world();
    const t = await mk(w);
    const r = await f.req("GET", `/tickets/${t.id}/work-type-candidates`, { headers: w.writer.auth });
    expect(r.status, await r.clone().text()).toBe(404);
    const d = await f.req("GET", `/tickets/${t.id}`, { headers: w.writer.auth });
    expect(d.status).toBe(200);
  });

  it("K582-API-002 作る口は work_type_id・work_type_version を受けない：どちらを付けても 422・チケットが増えない。付けなければ 201", async () => {
    const w = await world();
    const before = await count("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
    for (const extra of [{ work_type_id: randomUUID() }, { work_type_version: 2 }, { work_type_id: null }]) {
      const r = await f.req("POST", "/tickets", { body: createBody(w, extra), headers: w.writer.auth });
      expect(r.status, `${JSON.stringify(extra)}: ${await r.clone().text()}`).toBe(422);
      expect(fieldsOf(await json(r)).length, "欄つきの 422").toBeGreaterThan(0);
    }
    expect(await count("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]), "何も作られない").toBe(
      before,
    );
    const ok = await f.req("POST", "/tickets", { body: createBody(w), headers: w.writer.auth });
    expect(ok.status, await ok.clone().text()).toBe(201);
    const row = (
      await f.admin.query<{ work_type_id: string | null; work_type_version: number | null }>(
        "select work_type_id, work_type_version from tickets where tenant_id = $1 and title = '請求書を送る'",
        [w.tenantId],
      )
    ).rows[0]!;
    expect(row, "作ったチケットは業務の型を持たない").toEqual({ work_type_id: null, work_type_version: null });
  });

  it("K582-API-003 直す口 updateTicket も受けない：work_type_id・work_type_version は 422 E-VAL-018（この欄はまだ変えられません）・何も変わらない", async () => {
    const w = await world();
    const t = await mk(w, { version: 3 });
    for (const body of [
      { work_type_id: randomUUID() },
      { work_type_version: 4 },
      { work_type_id: null, work_type_version: null },
    ]) {
      const r = await f.req("PATCH", `/tickets/${t.id}`, { body, headers: w.writer.auth });
      expect(r.status, `${JSON.stringify(body)}: ${await r.clone().text()}`).toBe(422);
      expect((await json(r))["code"]).toBe("E-VAL-018");
    }
    const row = (
      await f.admin.query<{ work_type_version: number | null }>("select work_type_version from tickets where id = $1", [
        t.id,
      ])
    ).rows[0]!;
    expect(row.work_type_version, "値は前のまま").toBe(3);
    expect(
      await count("select count(*) as n from ticket_messages where ticket_id = $1 and kind = 'change'", [t.id]),
    ).toBe(0);
  });

  it("K582-API-004 読む口 getTicket の答えは業務の型を出さない：鍵 work_type・work_type_id・work_type_version が無く、列に値があるチケットでも出ない", async () => {
    const w = await world();
    const t = await mk(w, { version: 5 });
    const r = await f.req("GET", `/tickets/${t.id}`, { headers: w.writer.auth });
    expect(r.status).toBe(200);
    const text = JSON.stringify(await json(r));
    expect(text, "答えのどこにも業務の型の字が無い").not.toMatch(/work_type|業務の型/);
  });

  it("K582-API-005 凍結：ほかの組を直しても work_type_version は前のまま・消えない（優先度を直す口と作る口のあとも）", async () => {
    const w = await world();
    const t = await mk(w, { version: 7 });
    const r = await f.req("PATCH", `/tickets/${t.id}`, {
      body: { priority: "high", priority_reason: "先方が急ぐ" },
      headers: w.writer.auth,
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const row = (
      await f.admin.query<{ work_type_id: string | null; work_type_version: number | null; priority: string }>(
        "select work_type_id, work_type_version, priority from tickets where id = $1",
        [t.id],
      )
    ).rows[0]!;
    expect(row).toEqual({ work_type_id: null, work_type_version: 7, priority: "high" });
  });

  it("K582-API-006 列は残り、注が凍結を言う：tickets.work_type_id（uuid・null 可）・work_type_version（整数・null 可）が在り、列の注が「凍結」と K-582 を含む。migration が一覧に在る", async () => {
    const cols = (
      await f.admin.query<{ column_name: string; data_type: string; is_nullable: string; note: string | null }>(
        `select a.attname as column_name, format_type(a.atttypid, a.atttypmod) as data_type,
                case when a.attnotnull then 'NO' else 'YES' end as is_nullable, col_description(a.attrelid, a.attnum) as note
           from pg_attribute a where a.attrelid = 'public.tickets'::regclass and a.attname in ('work_type_id', 'work_type_version') and not a.attisdropped
          order by a.attname`,
      )
    ).rows;
    expect(cols.map((c) => [c.column_name, c.data_type, c.is_nullable])).toEqual([
      ["work_type_id", "uuid", "YES"],
      ["work_type_version", "integer", "YES"],
    ]);
    for (const c of cols) {
      expect(c.note ?? "", `${c.column_name} の注`).toContain("凍結");
      expect(c.note ?? "", `${c.column_name} の注`).toContain("K-582");
    }
    expect(read("packages", "db", "src", "migrations.generated.ts")).toContain(
      "20261122101200_ticket_work_type_frozen",
    );
  });

  it("K582-API-007 コードは業務の型の列も外した口の名前も使わない：apps/api/src・apps/web・apps/bridge・packages/db/src の .ts/.tsx に work_type_id・work_type_version・listWorkTypeCandidates・work-type-candidates が無い", () => {
    const dirs = ["apps/api/src", "apps/web", "apps/bridge", "packages/db/src"].filter((d) =>
      existsSync(join(ROOT, d)),
    );
    const files = dirs.flatMap((d) => walk(join(ROOT, d), /\.tsx?$/));
    expect(files.length, "探す物が在る").toBeGreaterThan(50);
    for (const file of files) {
      const s = readFileSync(file, "utf-8");
      // 契約の登録（routes/tickets.ts・生成物）は外した後の姿を K582-API-008 が見る。ここはコードの字だけ
      expect(s, file).not.toMatch(COLS);
      expect(s, file).not.toMatch(CAND);
    }
  });

  it("K582-API-008 契約：listWorkTypeCandidates と /work-type-candidates が openapi・endpoints・registry・口の道・生成の試験・目録に無く、外した口の記録（retired-endpoints.json）にこの口と listClassAxes が根拠の決定つきで在る", () => {
    for (const p of [
      ["08_api", "openapi.yaml"],
      ["08_api", "endpoints.json"],
      ["08_api", "types.ts"],
      ["packages", "contracts", "src", "registry.ts"],
      ["packages", "contracts", "src", "ops.ts"],
      ["apps", "api", "src", "routes", "tickets.ts"],
      ["05_flow", "screen_api.py"],
      ["03_architecture", "catalog.json"],
      ["03_architecture", "catalog.md"],
    ])
      expect(read(...p), p.join("/")).not.toMatch(CAND);
    expect(
      existsSync(join(ROOT, "apps", "api", "test", "generated", "get_tickets_id_work_type_candidates.test.ts")),
      "生成の試験は消える",
    ).toBe(false);
    const retired = (
      JSON.parse(read("08_api", "retired-endpoints.json")) as {
        retired: { method: string; path: string; decision: string; reason: string }[];
      }
    ).retired;
    for (const [path, decision] of [
      ["/api/v1/tickets/{id}/work-type-candidates", "D-150.60"],
      ["/api/v1/class_axes", "D-150.46"],
    ]) {
      const hit = retired.filter((r) => r.method === "GET" && r.path === path);
      expect(hit.length, `${path} は外した口の記録に 1 本だけ`).toBe(1);
      expect(hit[0]!.decision, `${path} の根拠の決定`).toBe(decision);
      expect(hit[0]!.reason.trim().length, `${path} の理由`).toBeGreaterThan(0);
    }
  });

  it("K582-API-009 文書：01_チケット.md に work-type-candidates が無く、K-59.md の apis と tests に外した口と生成の試験が無い。ER 図は凍結の列を言う", () => {
    expect(read("08_api", "phase1", "01_チケット.md")).not.toMatch(CAND);
    const k59 = read("11_tickets", "K-59.md");
    expect(k59).not.toMatch(/listWorkTypeCandidates|get_tickets_id_work_type_candidates/);
    const er = read("03_architecture", "ER図.md");
    expect(er).toMatch(/work_type_id[^\n]*凍結|凍結[^\n]*work_type_id/);
  });

  it("K582-API-010 段 10 の表は触らない：表 skills と列 kind_id（業務の型を kind で持つ所）が DB に残る（/work_types の道は段 10 の K-711 の持ち物なので見ない・kind_id は text で check を持たない）", async () => {
    const reg = (await f.admin.query<{ t: string | null }>("select to_regclass('public.skills')::text as t")).rows[0]!;
    expect(reg.t, "表 skills が在る").toBe("skills");
    const col = (
      await f.admin.query<{ data_type: string }>(
        "select data_type from information_schema.columns where table_schema = 'public' and table_name = 'skills' and column_name = 'kind_id'",
      )
    ).rows;
    expect(
      col.map((c) => c.data_type),
      "列 kind_id が在る",
    ).toEqual(["text"]);
  });
});
