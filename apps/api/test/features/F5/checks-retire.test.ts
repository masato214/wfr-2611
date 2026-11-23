// K-741「使わない口と表を片付ける（markHumanCheck・listChecks を契約から外す・checks の表に凍結の印）」の単体の試験
//   （契約と生成物と文書のファイル・口の道は本物の入口で 404 を見る・目録の検査は python を直に動かす）。
// テストの名前の頭の行 ID（K741-API-…）は 11_tickets/K-741.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-150.39・D-150.40：確認項目は文とチェックだけ。機械・AI・人の種類と判定の型は持たない。だれが付けたかはやり取りに載る）:
//   markHumanCheck（POST /checks/:id/human）・listChecks（GET /tickets/:id/checks）。表 checks は消さずに凍結する（書くコードが 1 行も無い）
// 外さないもの：表 checks と行（凍結のまま残す）・確認項目の口（listTestSpecs ほか・K-434・K-435）・承認の口（getApproval ほか）
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");
const GONE = /\b(markHumanCheck|listChecks)\b/;
const UUID = "0193c5a0-0000-7000-8000-00000000e001";
const apisOf = (md: string): string[] => {
  const m = /^apis:\s*\[(.*)\]\s*$/m.exec(read("11_tickets", `${md}.md`));
  return m
    ? m[1]!
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
};
const testsOf = (md: string): string[] => {
  const m = /^tests:\s*\[(.*)\]\s*$/m.exec(read("11_tickets", `${md}.md`));
  return m
    ? m[1]!
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
};

let f: Fixture;
let writer: Person;
beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`K741 の会社 ${Math.random().toString(36).slice(2, 7)}`, "CK");
  writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-741 使わない確認の口と表を片付ける", () => {
  it("K741-API-001 外した 2 つの道は道ごと無い：POST /checks/:id/human・GET /tickets/:id/checks は 404（501 でない）", async () => {
    const a = await f.req("POST", `/checks/${UUID}/human`, { headers: writer.auth, body: {} });
    expect(a.status, await a.clone().text()).toBe(404);
    const b = await f.req("GET", `/tickets/${UUID}/checks`, { headers: writer.auth });
    expect(b.status, await b.clone().text()).toBe(404);
  });

  it("K741-API-002 契約と目録：2 つの操作 ID が screen_api.py・endpoints.json・openapi.yaml・types.ts・lint-mapping.json・registry.ts・ops.ts・catalog.json・catalog.md のどこにも無い（読めていないファイルは赤）", () => {
    for (const p of [
      ["05_flow", "screen_api.py"],
      ["08_api", "endpoints.json"],
      ["08_api", "openapi.yaml"],
      ["08_api", "types.ts"],
      ["08_api", "lint-mapping.json"],
      ["packages", "contracts", "src", "registry.ts"],
      ["packages", "contracts", "src", "ops.ts"],
      ["03_architecture", "catalog.json"],
      ["03_architecture", "catalog.md"],
    ]) {
      const s = read(...p);
      expect(s.length, `${p.join("/")} を読めた`).toBeGreaterThan(1000);
      expect(s, p.join("/")).not.toMatch(GONE);
    }
    expect(read("08_api", "phase1", "01_チケット.md"), "文書の 2 つの道の行").not.toMatch(
      /\/checks\/[{:]id\}?\/human|\/tickets\/[{:]id\}?\/checks/,
    );
    expect(read("08_api", "endpoints.json"), "確認項目の口は残る").toContain('"listTestSpecs"');
    expect(read("05_flow", "screen_api.py"), "承認の口は残る").toContain('"getApproval"');
  });

  it("K741-API-003 口の道の登録：routes/checks.ts が無く、routes/index.ts がそれを読まず、routes/tickets.ts に listChecks が無い", () => {
    expect(existsSync(join(ROOT, "apps/api/src/routes/checks.ts")), "checks.ts は消える").toBe(false);
    expect(read("apps", "api", "src", "routes", "index.ts")).not.toMatch(/\.\/checks\.js|\bchecks\(app/);
    expect(read("apps", "api", "src", "routes", "tickets.ts")).not.toMatch(GONE);
  });

  it("K741-API-004 生成の試験 2 本が消えている（it.todo だけで本物の試験を持たない物）", () => {
    for (const name of ["get_tickets_id_checks.test.ts", "post_checks_id_human.test.ts"])
      expect(existsSync(join(ROOT, "apps", "api", "test", "generated", name)), name).toBe(false);
  });

  it("K741-API-005 外す口の記録：retired-endpoints.json に 2 本が 1 行ずつ・根拠の決定 D-150.39 か D-150.40・理由つき", () => {
    const rows = (
      JSON.parse(read("08_api", "retired-endpoints.json")) as {
        retired: { method: string; path: string; decision: string; reason?: string }[];
      }
    ).retired;
    const hit = (method: string, path: string) => rows.filter((r) => r.method === method && r.path === path);
    for (const [method, path] of [
      ["GET", "/api/v1/tickets/{id}/checks"],
      ["POST", "/api/v1/checks/{id}/human"],
    ] as const) {
      const r = hit(method, path);
      expect(r, `${method} ${path}`).toHaveLength(1);
      expect(["D-150.39", "D-150.40"]).toContain(r[0]!.decision);
      expect((r[0]!.reason ?? "").length, "理由は 1 行以上").toBeGreaterThan(15);
    }
  });

  it("K741-API-006 口の表の欄：screen_api.py の口の行（SCREEN_API）が、使う表として checks を 1 つも挙げていない（確認項目は test_specs で読む）。応答の欄の名前 checks（承認の詳細・実行の 1 件）は残る", () => {
    const s = read("05_flow", "screen_api.py");
    const rows = s.split("\n").filter((l) => /^\s*\("(GET|POST|PUT|PATCH|DELETE)",/.test(l));
    expect(rows.length, "口の行を読めた").toBeGreaterThan(100);
    expect(
      rows.filter((l) => /"checks"\s*[\],]/.test(l) && !/"(checks)"\s*:/.test(l)),
      "checks を表として挙げた口の行",
    ).toEqual([]);
    expect(s).toMatch(/"getApproval": \("ApprovalDetail", \{[^}]*"checks": "array"/);
  });

  it("K741-API-007 凍結の印：db-catalog.json で checks が frozen・理由に D-150.39 の字が在り、流れの線 flow-lines.json に checks を書く・読む流れが無い。目録の検査 flow_db_gate.py が緑", () => {
    const cat = JSON.parse(read("03_architecture", "db-catalog.json")) as {
      tables: Record<string, { class: string; why: string }>;
    };
    expect(cat.tables["checks"]!.class).toBe("frozen");
    expect(cat.tables["checks"]!.why).toContain("D-150.39");
    expect(cat.tables["test_specs"]!.class, "確認項目の表は骨格のまま").toBe("skeleton");
    const lines = JSON.parse(read("03_architecture", "flow-lines.json")) as {
      boundary_tables: string[];
      tables: Record<string, { writes?: string[]; reads?: string[] }>;
    };
    expect(lines.boundary_tables).not.toContain("checks");
    const t = lines.tables["checks"];
    expect([...(t?.writes ?? []), ...(t?.reads ?? [])]).toEqual([]);
    const gate = spawnSync("python3", ["scripts/ci/flow_db_gate.py"], { cwd: ROOT, encoding: "utf-8" });
    expect(gate.status, gate.stdout + gate.stderr).toBe(0);
  });

  it("K741-API-008 コードが checks の表を使わない：apps/*/src・packages/*/src に from・into・update・join の checks が無い（凍結の表を使い始めると FD3 で赤）", () => {
    const r = spawnSync(
      "git",
      [
        "grep",
        "-n",
        "-i",
        "-E",
        "\\b(from|into|update|join)\\s+(public\\.|app\\.)?checks\\b",
        "--",
        "apps/*/src",
        "packages/*/src",
      ],
      { cwd: ROOT, encoding: "utf-8" },
    );
    expect(r.stdout.split("\n").filter(Boolean)).toEqual([]);
  });

  it("K741-API-009 表と行は消さない：checks の表が在り・列は前のまま・アプリの接続は更新・削除できない（追記だけ）", async () => {
    const t = await f.admin.query<{ n: string | null }>("select to_regclass('public.checks')::text as n");
    expect(t.rows[0]!.n).not.toBeNull();
    const cols = (
      await f.admin.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'checks' order by ordinal_position",
      )
    ).rows.map((x) => x.column_name);
    expect(cols).toEqual(expect.arrayContaining(["id", "tenant_id", "ticket_id", "test_spec_id", "result", "runner"]));
    const priv = await f.admin.query<{ u: boolean; d: boolean; i: boolean }>(
      "select has_table_privilege('kaname_app', 'public.checks', 'update') as u, has_table_privilege('kaname_app', 'public.checks', 'delete') as d, has_table_privilege('kaname_app', 'public.checks', 'insert') as i",
    );
    expect(priv.rows[0]).toMatchObject({ u: false, d: false });
  });

  it("K741-API-010 親の md：K-59.md の apis から listChecks・tests から get_tickets_id_checks が、K-61.md の apis から markHumanCheck・tests から post_checks_id_human が外れ、ほかの口と試験は残る", () => {
    expect(apisOf("K-59")).not.toContain("listChecks");
    expect(apisOf("K-59")).toContain("createTestSpec");
    expect(apisOf("K-435")).toContain("deleteTestSpec"); // 本線の形：確認項目を外す口の持ち主は K-435（K-59 には無い）
    expect(testsOf("K-59").some((x) => x.endsWith("get_tickets_id_checks.test.ts"))).toBe(false);
    expect(testsOf("K-59").length).toBeGreaterThan(3);
    expect(apisOf("K-61")).not.toContain("markHumanCheck");
    expect(testsOf("K-61").some((x) => x.endsWith("post_checks_id_human.test.ts"))).toBe(false);
  });
  it("K741-API-011 書き出しは作らない（D-153.33）：POST /clones/me/activity/export は 404・契約と目録と生成物と phase1 の 03 に exportCloneActivity が無く、生成の試験も無く、外す口の記録に 1 行（ほかの書き出しの口 createExport は残る）", async () => {
    const r = await f.req("POST", "/clones/me/activity/export", { headers: writer.auth, body: {} });
    expect(r.status, await r.clone().text()).toBe(404);
    for (const p of [
      ["05_flow", "screen_api.py"],
      ["08_api", "endpoints.json"],
      ["08_api", "openapi.yaml"],
      ["packages", "contracts", "src", "registry.ts"],
      ["03_architecture", "catalog.json"],
      ["08_api", "phase1", "03_分身の部屋.md"],
    ])
      expect(read(...p), p.join("/")).not.toContain("exportCloneActivity");
    expect(read("08_api", "phase1", "03_分身の部屋.md")).not.toContain("/clones/me/activity/export");
    expect(existsSync(join(ROOT, "apps", "api", "test", "generated", "post_clones_me_activity_export.test.ts"))).toBe(
      false,
    );
    const rows = (
      JSON.parse(read("08_api", "retired-endpoints.json")) as {
        retired: { method: string; path: string; decision: string; reason?: string }[];
      }
    ).retired;
    const hit = rows.filter((x) => x.method === "POST" && x.path === "/api/v1/clones/me/activity/export");
    expect(hit).toHaveLength(1);
    expect(hit[0]!.decision).toBe("D-153.33");
    expect((hit[0]!.reason ?? "").length).toBeGreaterThan(15);
    expect(read("08_api", "endpoints.json"), "ほかの書き出しの口は残る").toContain('"createExport"');
  });

  it("K741-API-012 export_jobs の表は凍結しない（ほかの口が使う・skeleton のまま）。親 K-61.md の apis から exportCloneActivity・tests から post_clones_me_activity_export.test.ts が外れる", () => {
    const cat = JSON.parse(read("03_architecture", "db-catalog.json")) as { tables: Record<string, { class: string }> };
    expect(cat.tables["export_jobs"]!.class).toBe("skeleton");
    expect(apisOf("K-61")).not.toContain("exportCloneActivity");
    expect(testsOf("K-61").some((x) => x.endsWith("post_clones_me_activity_export.test.ts"))).toBe(false);
  });
});
