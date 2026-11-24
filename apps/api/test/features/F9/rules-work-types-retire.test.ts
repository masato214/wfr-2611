// K-711「決まり・業務の型の口 29 本を契約から外す」の単体の試験（契約と作り手の出力と文書のファイル・口の道は本物の入口で 404 を見る）。
// テストの名前の頭の行 ID（K711-API-…）は 11_tickets/K-711.md の行の表に 1 対 1 で結ぶ。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 外すもの（D-152.8・D-152.20：決まり・上に回す決まり・業務の型は物として無くす）:
//   決まり 14：listRules・getRule・checkRule・createRule・updateRule・deleteRule（/rules 系）・getWorkspaceRules・createWorkspaceRule・
//             updateWorkspaceRule・deleteWorkspaceRule（/workspace/rules 系）・previewEscalationRule・createEscalationRule・
//             updateEscalationRule・deleteEscalationRule（/workspace/escalation-rules 系）
//   業務の型 15：作る側 9（listWorkTypes ほか）と運営 6（listOpsWorkTypes ほか）。段 5 の K-582 が外した listWorkTypeCandidates は数えない
// 外さないもの：運営ひな形の 3 口（makeKindTemplateFromTicket・listKindTemplateUpdates・applyKindTemplateUpdate）・運営のひな形の口
//   （/ops/templates 系）・listHandoverRules・記憶・覚えたいこと・チケットの形・ナレッジの前の口（K-721・K-722 が外す）
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const read = (...p: string[]): string => readFileSync(join(ROOT, ...p), "utf-8");

/** 決まりの口 14（操作 ID・方法・道）。K-711 が契約から外す */
const RULE_OPS: readonly [string, string, string][] = [
  ["listRules", "GET", "/rules"],
  ["getRule", "GET", "/rules/{id}"],
  ["checkRule", "POST", "/rules/check"],
  ["createRule", "POST", "/rules"],
  ["updateRule", "PATCH", "/rules/{id}"],
  ["deleteRule", "DELETE", "/rules/{id}"],
  ["getWorkspaceRules", "GET", "/workspace/rules"],
  ["createWorkspaceRule", "POST", "/workspace/rules"],
  ["updateWorkspaceRule", "PATCH", "/workspace/rules/{id}"],
  ["deleteWorkspaceRule", "DELETE", "/workspace/rules/{id}"],
  ["previewEscalationRule", "POST", "/workspace/escalation-rules/preview"],
  ["createEscalationRule", "POST", "/workspace/escalation-rules"],
  ["updateEscalationRule", "PATCH", "/workspace/escalation-rules/{id}"],
  ["deleteEscalationRule", "DELETE", "/workspace/escalation-rules/{id}"],
];
/** 業務の型の口 15（作る側 9・運営 6） */
const WORK_TYPE_OPS: readonly [string, string, string][] = [
  ["listWorkTypes", "GET", "/work_types"],
  ["getWorkType", "GET", "/work_types/{id}"],
  ["createWorkType", "POST", "/work_types"],
  ["copyWorkType", "POST", "/work_types/{id}/copy"],
  ["updateWorkTypeDraft", "PATCH", "/work_types/{id}/draft"],
  ["listWorkTypeVersions", "GET", "/work_types/{id}/versions"],
  ["tryWorkType", "POST", "/work_types/{id}/try"],
  ["releaseWorkType", "POST", "/work_types/{id}/release"],
  ["requestWorkTypeSpread", "POST", "/work_types/{id}/spread-requests"],
  ["listOpsWorkTypes", "GET", "/ops/work_types"],
  ["getOpsWorkType", "GET", "/ops/work_types/{id}"],
  ["uploadWorkTypePackage", "POST", "/ops/work_type_uploads"],
  ["getWorkTypeUpload", "GET", "/ops/work_type_uploads/{id}"],
  ["releaseOpsWorkType", "POST", "/ops/work_types/{id}/versions"],
  ["rollbackOpsWorkType", "POST", "/ops/work_types/{id}/versions/{v}/rollback"],
];
interface FlowDoc {
  backbone: { acts: { id: string; release: string }[] }[];
  screens: { id: string; release: string }[];
  deferred: Record<string, string>;
  act_to_screen: Record<string, string[]>;
  blueprint: Record<string, { screen?: string }>;
}
interface RetiredRow {
  method: string;
  path: string;
  decision: string;
  reason?: string;
}
const GONE = [...RULE_OPS, ...WORK_TYPE_OPS];
const GONE_IDS = GONE.map(([op]) => op);
const GONE_RX = new RegExp(`\\b(${GONE_IDS.join("|")})\\b`);
/** 生成の試験のファイル名（作り手が道から付ける名前）。道の `{x}` は名前の中で `x`、`-` は `_` になる */
const testFile = (method: string, path: string): string =>
  `${method.toLowerCase()}_${path
    .replace(/\{(\w+)\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .join("_")
    .replace(/-/g, "_")}.test.ts`;
/** git grep の一致したファイル（1 件も無いと git は 1 で終わるので、終わり方でなく出た字だけを見る） */
const gitGrepFiles = (args: string[]): string[] =>
  spawnSync("git", ["grep", "-l", ...args], { cwd: ROOT, encoding: "utf-8" })
    .stdout.split("\n")
    .filter(Boolean);
const asked = (method: string): { body?: object } => (method === "GET" || method === "DELETE" ? {} : { body: {} });
const concrete = (path: string): string =>
  path.replace("{id}", "0193c5a0-0000-7000-8000-00000000d001").replace("{v}", "1");

/** 残す口：運営ひな形の 3 口と運営のひな形の口・渡すときの読む口 */
const KEPT_OPS = [
  "makeKindTemplateFromTicket",
  "listKindTemplateUpdates",
  "applyKindTemplateUpdate",
  "listOpsTemplates",
  "getOpsTemplate",
  "releaseOpsTemplate",
  "listHandoverRules",
];

let f: Fixture;
let writer: Person;
beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`K711 の会社 ${Math.random().toString(36).slice(2, 7)}`, "RW");
  writer = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-711 決まり・業務の型の口を契約から外す", () => {
  it("K711-API-001 決まりの口 14 の道は道ごと無い：404（501 でない）。直に呼んでも何も起きない", async () => {
    for (const [op, method, path] of RULE_OPS) {
      const r = await f.req(method, concrete(path), { headers: writer.auth, ...asked(method) });
      expect(r.status, `${op} ${method} ${path}：${await r.clone().text()}`).toBe(404);
    }
  });

  it("K711-API-002 業務の型の口 15 の道は道ごと無い：作る側 9 は 404・運営 6 は 404 か入口の断り（401・403）で、200 でも 501 でもない", async () => {
    for (const [op, method, path] of WORK_TYPE_OPS) {
      const r = await f.req(method, concrete(path), { headers: writer.auth, ...asked(method) });
      const ok = path.startsWith("/ops/") ? [401, 403, 404] : [404];
      expect(ok, `${op} ${method} ${path}：${r.status} ${await r.clone().text()}`).toContain(r.status);
    }
  });

  it("K711-API-003 契約と目録：外した 29 の操作 ID が screen_api.py・endpoints.json・openapi.yaml・types.ts・registry.ts・ops.ts・lint-mapping.json・catalog.json・catalog.md のどこにも無い", () => {
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
    ])
      expect(read(...p), p.join("/")).not.toMatch(GONE_RX);
  });

  it("K711-API-004 口の道の登録：routes/rules.ts・routes/work_types.ts が無く、routes/index.ts がそれを読まない。ops.ts と workspace.ts に外した道が無い", () => {
    expect(existsSync(join(ROOT, "apps/api/src/routes/rules.ts")), "rules.ts は消える").toBe(false);
    expect(existsSync(join(ROOT, "apps/api/src/routes/work_types.ts")), "work_types.ts は消える").toBe(false);
    const index = read("apps", "api", "src", "routes", "index.ts");
    expect(index).not.toMatch(/\.\/rules\.js|\.\/work_types\.js|\brules\(app|\bwork_types\(app/);
    for (const file of ["ops.ts", "workspace.ts"]) {
      const s = read("apps", "api", "src", "routes", file);
      expect(s, file).not.toMatch(GONE_RX);
      expect(s, file).not.toMatch(/work_types|work_type_uploads|workspace\/rules|escalation-rules/);
    }
  });

  it("K711-API-005 生成の試験 29 本が消えている（口ごとの it.todo だけで本物の試験を持たない物）", () => {
    for (const [op, method, path] of GONE) {
      const name = testFile(method, path);
      expect(existsSync(join(ROOT, "apps", "api", "test", "generated", name)), `${op} の ${name}`).toBe(false);
    }
  });

  it("K711-API-006 残す物は触らない：運営ひな形の 3 口・運営のひな形の口・渡すときの読む口が endpoints.json に在る", () => {
    const e = read("08_api", "endpoints.json");
    for (const op of KEPT_OPS) expect(e, `${op} は残る`).toContain(`"${op}"`);
    expect(read("05_flow", "screen_api.py")).toContain('"makeKindTemplateFromTicket"');
  });

  it("K711-API-007 親の md：K-69.md の apis に決まり・業務の型の口が無く、K-71.md の apis から listRules・createRule が、K-72.md の apis から運営の業務の型の 6 つが外れ、ほかの口は残る", () => {
    const apis = (k: string): string[] => {
      const m = /^apis:\s*\[(.*)\]\s*$/m.exec(read("11_tickets", `${k}.md`));
      return m
        ? m[1]!
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    };
    for (const k of ["K-69", "K-71", "K-72"])
      expect(
        apis(k).filter((x) => GONE_IDS.includes(x)),
        k,
      ).toEqual([]);
    expect(apis("K-71")).toEqual(expect.arrayContaining(["requestAcceptance", "updateTicketClientShare"]));
    expect(apis("K-72")).toEqual(
      expect.arrayContaining(["createPlanProposal", "listOpsTemplates", "releaseOpsTemplate"]),
    );
  });

  it("K711-API-008 文書：03・06・07・08 の phase1 の md に、外した道（/rules・/work_types・/workspace/rules・/workspace/escalation-rules・/ops/work_types・/ops/work_type_uploads）の行が無い", () => {
    const rx =
      /`(GET|POST|PATCH|DELETE) (\/rules|\/work_types|\/workspace\/rules|\/workspace\/escalation-rules|\/ops\/work_types|\/ops\/work_type_uploads)/;
    for (const n of ["03_分身の部屋", "06_運営の配るもの", "07_ワークスペースの管理", "08_取引先とクライアントの場所"])
      expect(read("08_api", "phase1", `${n}.md`), n).not.toMatch(rx);
    expect(read("08_api", "phase1", "06_運営の配るもの.md"), "運営のひな形の行は残る").toContain("/ops/templates");
  });

  it("K711-API-009 コードと検査の字：apps/api/src に外した 29 の操作 ID が無く、zt_gate.py の本人確認の表から releaseOpsWorkType・rollbackOpsWorkType が外れ、row_rules.mjs から copyWorkType と /work_types・/rules の行が外れる", () => {
    const hit = gitGrepFiles([
      "-w",
      "-E",
      GONE_IDS.join("|"),
      "--",
      "apps/api/src",
      "apps/web",
      "apps/bridge",
      ":!apps/api/src/routes/*",
    ]);
    expect(hit, "外した操作 ID を書いているコード").toEqual([]);
    expect(read("scripts", "ci", "zt_gate.py")).not.toMatch(/releaseOpsWorkType|rollbackOpsWorkType/);
    const rr = read("scripts", "ci", "row_rules.mjs");
    expect(rr).not.toMatch(/copyWorkType|"\/api\/v1\/work_types"|"\/api\/v1\/rules"/);
  });

  it("K711-API-010 前からの試験は外した操作 ID を使わない：apps・packages の手で書いた試験と scripts/ci の python の試験に 29 の操作 ID が出てこない（生成の試験を除く）", () => {
    const out = gitGrepFiles([
      "-w",
      "-E",
      GONE_IDS.join("|"),
      "--",
      "apps/*/test/*.ts",
      "apps/*/test/**/*.ts",
      "apps/*/tests/**/*.ts",
      "packages/*/test/*.ts",
      "scripts/ci/*_test.py",
      ":!apps/api/test/generated/*",
      ":!apps/api/test/features/F9/rules-work-types-retire.test.ts",
      // 説明の文が listRules を挙げているだけ（コードの検査ではない）。同じファイルの記憶の口の分を替える K-712 が説明も直す
      ":!scripts/ci/contract_shape_test.py",
      // 消したことを確かめる側の字（外した操作 ID を並べて「無い」を見る）。外す口を使う試験ではない
      ":!scripts/ci/k722_flow_test.py",
      ":!apps/api/test/features/F4/work-type-retire.test.ts",
    ]);
    expect(out, "外した操作 ID を使う前からの試験").toEqual([]);
  });

  it("K711-API-011 契約の形の検査が残る：道の値・問い合わせの uuid の拾い方（K144_SHAPE_015）が必ず拾う 9 つの名前が、外した後の契約にまだ在る", () => {
    const spec = read("08_api", "openapi.yaml");
    for (const name of [
      "qid",
      "pid",
      "mid",
      "client_id",
      "layer_id",
      "actor_member_id",
      "tenant_id",
      "plan_id",
      "parent_id",
    ])
      expect(spec, `${name}`).toMatch(new RegExp(`name: ${name}\\b`));
  });

  it("K711-API-012 凍結の前の確かめ：外した後も、決まり・業務の型の表（policies・skills・skill_versions・skill_test_runs）は DB に在り、行は消えていない", async () => {
    for (const t of ["policies", "skills", "skill_versions", "skill_test_runs"]) {
      const r = await f.admin.query<{ ok: boolean }>("select to_regclass($1) is not null as ok", [`public.${t}`]);
      expect(r.rows[0]!.ok, `${t} の表`).toBe(true);
    }
  });

  it("K711-API-013 外した後も、ほかの口は動く：チケットの一覧の道は 404 でない（外す作業が別の道を巻き込んでいない）", async () => {
    const r = await f.req("GET", "/tickets", { headers: writer.auth });
    expect(r.status, await r.clone().text()).not.toBe(404);
  });

  it("K711-API-014 外す口の記録：08_api/retired-endpoints.json に 29 の口がそれぞれ（方法・道）1 行ずつ在り、根拠の決定が D-152.20・理由が空でない（契約の破壊的変更の検査 G11 が通る条件）", () => {
    const rows = (JSON.parse(read("08_api", "retired-endpoints.json")) as { retired: RetiredRow[] }).retired;
    for (const [op, method, path] of GONE) {
      const hit = rows.filter((r) => r.method === method && r.path === `/api/v1${path}`);
      expect(hit.length, `${op} ${method} ${path} の行`).toBe(1);
      expect(hit[0]!.decision, `${op} の根拠`).toBe("D-152.20");
      expect((hit[0]!.reason ?? "").trim().length, `${op} の理由`).toBeGreaterThan(0);
    }
    expect(read("01_hearing", "決定ログ_進行中.md"), "根拠の決定が決定ログに在る").toContain("| D-152.20 |");
  });

  it("K711-API-015 行為 A119（業務の型を作る・広げる）は後のフェーズへ送った：release v2・流れ F9 に無い・DEFERRED に理由（D-152.20）", () => {
    const flow = JSON.parse(read("05_flow", "flow.json")) as FlowDoc;
    const act = flow.backbone.flatMap((p) => p.acts).find((a) => a.id === "A119");
    expect(act?.release, "A119 の release").toBe("v2");
    const f9 = (JSON.parse(read("05_flow", "flows.json")) as { flows: { id: string; acts: string[] }[] }).flows.find(
      (x) => x.id === "F9",
    );
    expect(f9?.acts, "流れ F9 の行為").not.toContain("A119");
    expect(flow.deferred["A119"] ?? "", "A119 の送った理由").toContain("D-152.20");
  });

  it("K711-API-016 行為 A131（ルールを置く）は第 1 フェーズに残る：release v1・act_to_screen と裏側の表の画面が clone-chat", () => {
    const flow = JSON.parse(read("05_flow", "flow.json")) as FlowDoc;
    const act = flow.backbone.flatMap((p) => p.acts).find((a) => a.id === "A131");
    expect(act?.release, "A131 の release").toBe("v1");
    expect(flow.act_to_screen["A131"], "A131 の画面").toContain("clone-chat");
    expect(flow.blueprint["A131"]?.screen, "裏側の表の A131 の画面").toBe("clone-chat");
  });

  it("K711-API-017 第 1 フェーズの画面は 35：rules・work-types は v2 で DEFERRED に理由・spec-dependencies の screen_count_v1 も 35", () => {
    const flow = JSON.parse(read("05_flow", "flow.json")) as FlowDoc;
    expect(flow.screens.filter((x) => x.release === "v1").length, "第 1 フェーズの画面の数").toBe(35);
    for (const sid of ["rules", "work-types"]) {
      expect(flow.screens.find((x) => x.id === sid)?.release, sid).toBe("v2");
      expect(flow.deferred[sid] ?? "", `${sid} の送った理由`).toContain("D-152.20");
    }
    expect(read("spec-dependencies.yaml")).toMatch(/- id: screen_count_v1\n(?: {2}.*\n)*? {2}expected_value: 35\n/);
  });

  it("K711-API-018 キャンバスの対応表の later（canvas_gate.py の CV4）：第 1 フェーズの画面・flow に無い画面・空の並びは 2 で終わり、今の対応表は 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "k711-canvas-"));
    try {
      for (const p of [
        "04_design/canvas",
        "04_design/canvas-screens.json",
        "05_flow/flow.json",
        "apps/web/app/(dev)/dev/mock/f1/mocks.tsx",
      ])
        cpSync(join(ROOT, p), join(dir, p), { recursive: true });
      const map = JSON.parse(read("04_design", "canvas-screens.json")) as { later: Record<string, unknown> };
      const gate = (later: Record<string, unknown>) => {
        writeFileSync(join(dir, "04_design/canvas-screens.json"), JSON.stringify({ ...map, later }));
        return spawnSync("python3", [join(ROOT, "scripts/ci/canvas_gate.py")], { cwd: dir, encoding: "utf-8" });
      };
      const ok = gate(map.later);
      expect(ok.status, ok.stdout + ok.stderr).toBe(0);
      const v1 = gate({ ...map.later, tickets: ["Main"] });
      expect(v1.status).toBe(2);
      expect(v1.stdout).toContain("later の画面が flow の第1フェーズにある");
      const none = gate({ ...map.later, "k711-no-screen": ["Main"] });
      expect(none.status).toBe(2);
      expect(none.stdout).toContain("later の画面が flow に無い");
      const empty = gate({ ...map.later, today: [] });
      expect(empty.status).toBe(2);
      expect(empty.stdout).toContain("later の絵の並びが空");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
