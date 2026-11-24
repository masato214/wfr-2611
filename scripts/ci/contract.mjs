// 契約（OpenAPI）と実装の整合。API ↦ UI の依存方向を固定する（T-F-15／T-A-*）。
//   gen        08_api/openapi.yaml＋endpoints.json → packages/contracts/src/{types,registry,schemas}.ts ＋ apps/api/src/routes/<table>.ts（route の登録だけ・振る舞いは contract/op.ts と hooks）
//   check      G11：生成物が最新か（hash）／main の openapi.yaml と比べて破壊的変更（path・method の削除、必須の追加、レスポンス項目の削除）が無いか
//              意図して消す API は 08_api/retired-endpoints.json に 1 本ずつ根拠の決定（決定ログにある ID）と理由を書いたものだけ通す（D-128.77）
//   endpoints  endpoint 実在性：apps/api/src/routes/*.ts の登録が契約に無い → 赤。契約の endpoint のうち担当（backend 層）が done なのに未登録 → 赤
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { rowOf, rulesSource } from "./row_rules.mjs";

const ROOT = process.cwd();
const OPENAPI = "08_api/openapi.yaml";
const ENDPOINTS_JSON = "08_api/endpoints.json";
const OUT = "packages/contracts/src";
const ROUTES = "apps/api/src/routes";
const RETIRED = "08_api/retired-endpoints.json";
const DECISION_LOG = "01_hearing/決定ログ_進行中.md";

/** 意図して消す API の一覧。根拠の決定が決定ログに無い行・理由が空の行は使わない（返すのは使える行と、使えない理由） */
export function loadRetired(root = ROOT) {
  const p = join(root, RETIRED);
  if (!existsSync(p)) return { rows: [], invalid: [] };
  const log = existsSync(join(root, DECISION_LOG)) ? readFileSync(join(root, DECISION_LOG), "utf8") : "";
  const rows = [], invalid = [];
  for (const r of JSON.parse(readFileSync(p, "utf8")).retired ?? []) {
    const id = String(r.decision ?? "");
    const known = /^D-\d{3}(\.\d+)?$/.test(id) && log.includes(`| ${id} |`) || /^D-\d{3}$/.test(id) && log.includes(`decision: ${id}`);
    if (!r.path || !known || !String(r.reason ?? "").trim()) invalid.push(`${RETIRED}: ${r.method ?? "*"} ${r.path ?? "?"} は根拠の決定（${id || "なし"}）が決定ログに無いか、理由が空`);
    else rows.push({ path: r.path, method: (r.method ?? "*").toUpperCase(), field: r.field ?? null });
  }
  return { rows, invalid };
}
function retiredHit(rows, path, method = "*", field = null) {
  return rows.some((r) => r.path === path && (r.method === "*" || r.method === method) && (r.field === null || r.field === field));
}

/** 最小の YAML 読み（openapi.yaml は build_api.py が固定の形で出す：2 スペース・引用文字列） */
export function parsePaths(yaml) {
  const out = {}; // path → { method: { required, responseFields, operationId, tag, input, success } }
  const lines = yaml.split("\n");
  let i = lines.findIndex((l) => l === "paths:");
  let path = null, method = null, section = null, resCode = 0, lastParam = null, lastIn = null;
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l)) break;
    let m;
    if ((m = /^  (\/[^:]+):$/.exec(l))) { path = m[1]; out[path] = {}; continue; }
    if ((m = /^    (get|post|put|patch|delete):$/.exec(l))) { method = m[1].toUpperCase(); out[path][method] = { required: [], responseFields: [], operationId: "", tag: "", input: null, success: 200, output: null, outputList: false, query: [], uuidParams: [] }; section = null; resCode = 0; lastIn = null; continue; }
    if (!path || !method) continue;
    const cur = out[path][method];
    if ((m = /^      operationId: (\S+)/.exec(l))) cur.operationId = m[1];
    if (section === "tags" && (m = /^      - (\S+)/.exec(l)) && !cur.tag) cur.tag = m[1];
    if (/^      tags:/.test(l)) section = "tags";
    if (/^      requestBody:/.test(l)) section = "req";
    if (/^      responses:/.test(l)) section = "res";
    if (/^      parameters:/.test(l)) { section = "params"; continue; }
    if (/^      (security|x-)/.test(l)) section = null;
    // 問い合わせの名前（in: query のもの）。口ごとの型（ops.ts）の query に出す
    if (section === "params" && (m = /^      - name: (\S+)/.exec(l))) lastParam = m[1];
    if (section === "params" && /^        in: query/.test(l) && lastParam) cur.query.push(lastParam);
    if (section === "params" && (m = /^        in: (\w+)/.exec(l))) lastIn = m[1];
    // 契約で正式な uuid の道の値と問い合わせ（並びなら中身が uuid）。入口（apps/api/src/contract/op.ts）が確かめる（D-129.42・K-144）
    if (section === "params" && lastParam && (lastIn === "path" || lastIn === "query") && /^ {10}( {2})?format: uuid$/.test(l) && !cur.uuidParams.includes(lastParam)) cur.uuidParams.push(lastParam);
    if (section === "req" && (m = /\$ref: '#\/components\/schemas\/(\w+)'/.exec(l))) cur.input = m[1];
    if ((m = /^\s+required: \[(.*)\]/.exec(l)) && section === "req") cur.required.push(...m[1].split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean));
    if ((m = /^\s+- (\w+)$/.exec(l)) && section === "req" && lines[i - 1] && /required:$/.test(lines[i - 1].trim())) cur.required.push(m[1]);
    if (section === "res" && (m = /^        '(\d\d\d)':/.exec(l))) { resCode = Number(m[1]); if (resCode >= 200 && resCode < 300) cur.success = resCode; }
    // 成功の答えの data の形（名前と、配列か）。口ごとの型（ops.ts）の data に出す
    if (section === "res" && resCode >= 200 && resCode < 300 && !cur.output) {
      if (/^                    type: array$/.test(l)) cur.outputList = true;
      if ((m = /\$ref: '#\/components\/schemas\/(\w+)'/.exec(l))) cur.output = m[1];
    }
    if (section === "res" && (m = /^\s{16,}(\w+):$/.exec(l))) cur.responseFields.push(m[1]);
  }
  return out;
}
/** components.schemas → { Name: { props: {name: {type, format}}, required: [], table } }（&id／*id の別名を解く） */
export function parseComponents(yaml) {
  const lines = yaml.split("\n");
  let i = lines.findIndex((l) => l === "components:");
  const out = {}; const anchors = {};
  let name = null, prop = null, sec = null, propAnchor = null, inSchemas = false;
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i]; let m;
    if (/^\S/.test(l)) break;
    if (/^  \w+:$/.test(l)) { inSchemas = l === "  schemas:"; name = null; continue; }
    if (!inSchemas) continue;
    if ((m = /^    (\w+):$/.exec(l))) { name = m[1]; out[name] = { props: {}, required: [], table: null, requiredBy: null }; sec = null; prop = null; continue; }
    if (!name) continue;
    if (/^      properties:/.test(l)) { sec = "props"; continue; }
    if (/^      required:/.test(l)) { sec = "req"; continue; }
    if ((m = /^      x-table: (\S+)/.exec(l))) { out[name].table = m[1]; continue; }
    // 必須の欄の無いときの答えを口の振る舞いが持つ形（K-144 ⑱）：zod ではその欄を .optional() のままにする
    if ((m = /^      x-required-by: (\S+)/.exec(l))) { out[name].requiredBy = m[1]; sec = null; continue; }
    if (/^      [\w-]+:/.test(l) && !/^      (properties|required):/.test(l)) { sec = null; continue; }
    if (sec === "req" && (m = /^      - (\w+)/.exec(l))) { out[name].required.push(m[1]); continue; }
    if (sec === "props" && (m = /^        (\w+):(?: &(\w+))?$/.exec(l))) { prop = m[1]; propAnchor = m[2] ?? null; out[name].props[prop] = {}; if (propAnchor) anchors[propAnchor] = out[name].props[prop]; continue; }
    if (sec === "props" && (m = /^        (\w+):(?: &(\w+))? \{\}$/.exec(l))) { out[name].props[m[1]] = {}; if (m[2]) anchors[m[2]] = out[name].props[m[1]]; prop = null; continue; } // 形を問わない欄（z.unknown()・K-57）。別名つき（payload: &id324 {}）も落とさない（K-144）
    if (sec === "props" && (m = /^        (\w+): \*(\w+)$/.exec(l))) { out[name].props[m[1]] = anchors[m[2]] ?? {}; prop = null; continue; }
    if (sec === "props" && prop && (m = /^          (type|format): (\S+)/.exec(l))) { out[name].props[prop][m[1]] = m[2]; continue; }
    if (sec === "props" && prop && /^          nullable: true/.test(l)) { out[name].props[prop].nullable = true; continue; }
    if (sec === "props" && prop && (m = /^          maxLength: (\d+)/.exec(l))) { out[name].props[prop].maxLength = Number(m[1]); continue; } // 長い文（K-62・string:N）
    if (sec === "props" && prop && (m = /^            type: (\S+)/.exec(l))) { out[name].props[prop].items = m[1]; continue; }
    if (sec === "props" && prop && (m = /^            format: (\S+)/.exec(l))) { out[name].props[prop].itemsFormat = m[1]; continue; } // 並びの中身の形（uuid の並び・K-144）
  }
  return out;
}
/** 行の確かめの元（row_rules.mjs と、write の条件に使う entities.json）。変われば生成物も作り直す */
const rowSources = (root) => rulesSource(root) + (existsSync(join(root, "07_functional/entities.json")) ? readFileSync(join(root, "07_functional/entities.json"), "utf8") : "");
// 元の中身の hash。作った日付（created_at・decided_at など）は伏せる：日付だけ変わっても生成物を作り直さない（D-128.123・K-38）
const hashOf = (s) =>
  createHash("sha256")
    .update(s.replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?/g, "D"))
    .digest("hex")
    .slice(0, 16);
const slug = (s) => s.replace(/^\/api\/v1\//, "").replace(/[{}:]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/_+$/, "");
const kindOf = (method, path) => (method === "GET" ? (path.includes("{") ? "get" : "list") : method === "POST" ? "create" : method === "DELETE" ? "delete" : "update");

function zodOf(p) {
  // null を許す列（DB で null 可・K-35）は、入力でも null を受ける（PATCH で空に戻す）
  if (p.nullable) return `${zodOf({ ...p, nullable: false })}.nullable()`;
  if (p.type === "string" && p.format === "uuid") return "z.uuid()";
  if (p.type === "string" && p.format === "date-time") return "z.iso.datetime({ offset: true })";
  if (p.type === "string" && p.format === "date") return "z.iso.date()";
  if (p.type === "string") return "z.string()"; // 自由に書く欄に一律の上限を置かない（D-130.1）。守りは入口の送る量 1MB（op.ts）。欄の上限（maxLength）は契約の側に書き、口が断る（K-144 ㉓・K-62）
  if (p.type === "integer") return "z.number().int()";
  if (p.type === "number") return "z.number()";
  if (p.type === "boolean") return "z.boolean()";
  if (p.type === "array" && p.items === "string" && p.itemsFormat === "uuid") return "z.array(z.uuid())";
  if (p.type === "array") return p.items === "string" ? "z.array(z.string())" : "z.array(z.unknown())";
  if (p.type === "object") return "z.record(z.string(), z.unknown())";
  return "z.unknown()";
}

// 「誰が呼べるか」（08_api の permission）を、入口で確かめる形にする（K-14）。
//   word：言葉（admin・ops:<できること>・self など）／ target・ability：admin の能力（表と能力）／ scope：workspace（会社全体の権限）か any（どこかのグループで持てばよい）。運営の口は ops_all（全社）か ops_tenant（1 社を指す・K-1001）
//   adminOnly：管理者の役割だけ（権限を個別に付けた人でも通さない）／ stepUp：always（いつも）・それ以外は条件つき（hooks が requireStepUp で確かめる）
export function permOf(e, table, method) {
  const p = e.permission ?? {};
  const word = String(p.who ?? (e.auth?.role === "public" ? "public" : "read"));
  const path = e.path ?? "";
  const out = { word, target: null, ability: null, scope: "workspace", adminOnly: false, cap: null, stepUp: p.step_up === true ? "always" : p.step_up ? String(p.step_up) : null };
  // 運営の口（K-1001・D-156.2）：道が /api/v1/ops/workspaces/:id で始まれば 1 社を指す口（ops_tenant）、ほかは全社（ops_all）。道の形が正本
  if (word.startsWith("ops:")) {
    out.cap = word.slice(4);
    out.scope = path.startsWith("/api/v1/ops/workspaces/:id") ? "ops_tenant" : "ops_all";
  }
  if (word !== "admin") return out;
  if (/\/exports\b/.test(path)) Object.assign(out, { target: "tenants", ability: "export", scope: "any" });
  else if (/\/invitations\b/.test(path)) Object.assign(out, { target: "members", ability: "invite" });
  else if (/\/workspace\/deletion\b/.test(path)) Object.assign(out, { target: "tenants", ability: "delete_workspace" });
  else if (/\/workspace\/(billing|plan|plans|billing-contact)\b|\/invoices\b/.test(path)) Object.assign(out, { target: "tenants", ability: "billing" });
  else if (/\/members\/:id\//.test(path)) Object.assign(out, { target: "members", ability: "edit" }); // 人のこと（2 段階のリセット など）は人の表の能力
  else if (/\/workspace\/permissions\b/.test(path)) Object.assign(out, { target: "permissions", ability: "edit", adminOnly: true });
  else if (/\/workspace\/rules\b/.test(path)) Object.assign(out, { target: table, ability: method === "GET" ? "view" : "edit", scope: "any" });
  else Object.assign(out, { target: table, ability: method === "GET" ? "view" : "edit" });
  return out;
}

export function gen(root = ROOT) {
  const yaml = readFileSync(join(root, OPENAPI), "utf8");
  const epJson = readFileSync(join(root, ENDPOINTS_JSON), "utf8");
  const h = hashOf(yaml + epJson + rowSources(root));
  const types = readFileSync(join(root, "08_api/types.ts"), "utf8");
  mkdirSync(join(root, OUT), { recursive: true });
  writeFileSync(join(root, OUT, "types.ts"), `// 生成物（scripts/ci/contract.mjs gen ← 08_api/types.ts ← openapi.yaml）。手で直さない。openapi:${h}\n` + types.replace(/^\/\/.*\n/, ""));
  const paths = parsePaths(yaml);
  const meta = new Map(JSON.parse(epJson).endpoints.map((e) => [`${e.method} ${e.path}`, e]));
  const eps = [];
  const rowErrors = [];
  const GENERIC_OK = new Set(existsSync(join(root, "08_api/generic-ok.json")) ? JSON.parse(readFileSync(join(root, "08_api/generic-ok.json"), "utf8")).ok.filter((x) => String(x.reason ?? "").trim()).map((x) => x.op) : []);
  for (const [p, ms] of Object.entries(paths)) for (const [m, d] of Object.entries(ms)) {
    const hono = p.replace(/\{(\w+)\}/g, ":$1");
    const e = meta.get(`${m} ${hono}`) ?? {};
    const rl = /^(\d+)\/min\/(user|ip)$/.exec(e.rate_limit ?? "60/min/user");
    eps.push({
      method: m, path: hono, operationId: d.operationId, table: d.tag || slug(p).split("_")[0], kind: kindOf(m, p), input: d.input, success: d.success, output: d.output, outputList: d.outputList,
      // 表の素の読み書き（/表 と /表/:id）だけが共通の処理で動いてよい。それ以外（/表/:id/approve など）は hooks に振る舞いを書くまで 501（D-128.113）
      generic: GENERIC_OK.has(`${m} ${hono}`),
      auth: e.auth?.role ?? "member", rateLimit: { perMinute: Number(rl?.[1] ?? 60), key: rl?.[2] ?? "user" },
      uuidParams: d.uuidParams,
      chokePoints: e.choke_points ?? [], errors: (e.outputs_4xx ?? []).map((x) => x.status), acts: e.acts ?? [], screens: e.screens ?? [],
      perm: permOf({ ...e, path: hono }, d.tag || slug(p).split("_")[0], m),
      termsOpen: e.terms_open === true,
      mfaOpen: e.mfa_open === true,
      ignoresScope: e.list_ignores_scope === true,
    });
    const last = eps[eps.length - 1];
    const row = rowOf(root, last, last.perm.word);
    if (row?.error) rowErrors.push(row.error);
    last.perm.row = row && !row.error ? row : null;
  }
  // 行に結ぶ口は全部、どの表のどの列で確かめるかを持つ（K-15）。無ければ生成を止める
  if (rowErrors.length) throw new Error(`行の確かめが無い口 ${rowErrors.length} 本:\n  ${rowErrors.join("\n  ")}`);
  const body = `// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml＋endpoints.json）。手で直さない。openapi:${h}
export type EndpointKind = "list" | "get" | "create" | "update" | "delete";
export interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  operationId: string;
  table: string;
  kind: EndpointKind;
  /** true：表の素の読み書き（共通の処理で動く）。false：hooks に振る舞いを書くまで 501 */
  generic: boolean;
  input: string | null;
  success: number;
  /** 成功の答えの data の形（components の名前）。outputList なら配列 */
  output: string | null;
  outputList: boolean;
  auth: "member" | "ops" | "client" | "device" | "public";
  rateLimit: { perMinute: number; key: "user" | "ip" };
  /** 契約で format: uuid の道の値と問い合わせの名前（入口が正式な uuid か確かめる・D-129.42・K-144） */
  uuidParams: string[];
  chokePoints: string[];
  errors: number[];
  acts: string[];
  screens: string[];
  /** 誰が呼べるか（08_api の permission・K-14）。入口が言葉ごとに確かめる（apps/api/src/contract/permissions.ts） */
  perm: {
    word: string;
    target: string | null;
    ability: string | null;
    scope: "workspace" | "any" | "ops_all" | "ops_tenant";
    adminOnly: boolean;
    cap: string | null;
    stepUp: string | null;
    /** 行に結ぶ言葉の確かめ（K-15・scripts/ci/row_rules.mjs）。:id の行を RLS の中で読み、見えなければ 404・sql が偽なら 403 */
    row: { table: string; sql: string } | null;
  };
  /** 同意し直し（K-53）の間も止めない口（規約の 2 つ・ログアウト・自分の取得）。正本は 05_flow/screen_api.py の TERMS_OPEN_OPS */
  termsOpen: boolean;
  /** 付けるまで進めない（K-321・D-128.141）の間も止めない口。正本は 05_flow/screen_api.py の MFA_OPEN_OPS */
  mfaOpen: boolean;
  /** 一覧の scope_id（グループで絞る）を形だけ確かめて無視する口。正本は 05_flow/screen_api.py の LIST_OPS */
  ignoresScope: boolean;
}
export const ENDPOINTS: readonly EndpointDef[] = ${JSON.stringify(eps, null, 2)};
export const OPENAPI_HASH = "${h}";
`;
  writeFileSync(join(root, OUT, "registry.ts"), body);
  // 口ごとの型（画面の呼び手 apps/web/lib/api/call.ts が使う・K-27）。手で書かない
  const typeNames = new Set([...types.matchAll(/^export type (\w+) =/gm)].map((x) => x[1]));
  const ty = (n) => (n && typeNames.has(n) ? `T.${n}` : "unknown");
  const opsSrc = [`// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。openapi:${h}`, `import type * as T from "./types.js";`, "",
    "/** 口ごとの型：path の値・問い合わせ・入力・成功の答えの data */", "export interface Ops {"];
  for (const p of Object.keys(paths)) for (const [m, d] of Object.entries(paths[p])) {
    const params = [...p.matchAll(/\{(\w+)\}/g)].map((x) => x[1]);
    const q = (d.query ?? []).map((n) => `${JSON.stringify(n)}?: string | number`).join("; ");
    // 値が無いものは never（{} にしない：何でも通ってしまう）
    const pt = params.length ? `{ ${params.map((n) => `${n}: string`).join("; ")} }` : "never";
    const qt = q ? `{ ${q} }` : "never";
    opsSrc.push(`  ${d.operationId}: { params: ${pt}; query: ${qt}; body: ${d.input ? ty(d.input) : "never"}; data: ${ty(d.output)}${d.outputList ? "[]" : ""} };`);
  }
  opsSrc.push("}", "export type OpName = keyof Ops;", "");
  writeFileSync(join(root, OUT, "ops.ts"), opsSrc.join("\n"));
  // zod（入力の検証・表記ゆらぎの正規化は apps/api/src/contract/op.ts）
  const comps = parseComponents(yaml);
  const zl = [`// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml components）。手で直さない。openapi:${h}`, `import { z } from "zod";`, ""];
  for (const [name, c] of Object.entries(comps)) {
    if (name === "Error") continue;
    const props = Object.entries(c.props).map(([k, p]) => `  ${k}: ${zodOf(p)}${c.required.includes(k) && c.requiredBy !== "hooks" ? "" : ".optional()"},`);
    zl.push(`export const ${name} = z.strictObject({\n${props.join("\n")}\n});`);
  }
  zl.push("", `export const SCHEMAS: Record<string, z.ZodType> = { ${Object.keys(comps).filter((n) => n !== "Error").join(", ")} };`, "");
  writeFileSync(join(root, OUT, "schemas.ts"), zl.join("\n"));
  // routes（登録だけ。振る舞いは contract/op.ts・個別は hooks）
  mkdirSync(join(root, ROUTES), { recursive: true });
  const byTable = new Map();
  const segCmp = (a, b) => {
    const x = a.path.split("/"), y = b.path.split("/");
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const px = x[i].startsWith(":"), py = y[i].startsWith(":");
      if (px !== py) return px ? 1 : -1;
      if (x[i] !== y[i]) return 0;
    }
    return 0;
  };
  const ordered = [...eps];
  for (let i = 1; i < ordered.length; i++) for (let j = i; j > 0 && segCmp(ordered[j - 1], ordered[j]) > 0; j--) [ordered[j - 1], ordered[j]] = [ordered[j], ordered[j - 1]];
  // ファイルは道すじの最初の段（/api/v1/<ここ>）ごと。表ごとに分けると、別の表のファイルの /clients/:id が /clients/link-candidates を先に取ってしまう
  for (const e of ordered) { const k = e.path.split("/")[3].replace(/[^a-z0-9_]/g, "_"); byTable.set(k, [...(byTable.get(k) ?? []), e]); }
  for (const [t, list] of byTable) {
    const lines = [
      `// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）`,
      `import type { Hono } from "hono";`, `import type { Vars } from "../middleware/tenant.js";`, `import { op, type ContractDeps } from "../contract/op.js";`, "",
      `export function register(app: Hono<Vars>, deps: ContractDeps): void {`,
      ...list.map((e) => `  app.${e.method.toLowerCase()}("${e.path}", op(deps, "${e.operationId}"));`),
      `}`, "",
    ];
    writeFileSync(join(root, ROUTES, `${t}.ts`), lines.join("\n"));
  }
  const idx = [`// 生成物（scripts/ci/contract.mjs gen）。手で直さない`, `import type { Hono } from "hono";`, `import type { Vars } from "../middleware/tenant.js";`, `import type { ContractDeps } from "../contract/op.js";`,
    ...[...byTable.keys()].map((t) => `import { register as ${t} } from "./${t}.js";`), "",
    `export function registerAll(app: Hono<Vars>, deps: ContractDeps): void {`, ...[...byTable.keys()].map((t) => `  ${t}(app, deps);`), `}`, ""];
  writeFileSync(join(root, ROUTES, "index.ts"), idx.join("\n"));
  // 契約から外れた表の道すじ（生成物の印があるものだけ）は消す。手で書いたファイルには触れない（D-128.112）
  for (const f of readdirSync(join(root, ROUTES)).filter((x) => x.endsWith(".ts") && x !== "index.ts" && !x.endsWith(".test.ts"))) {
    if (byTable.has(f.replace(/\.ts$/, ""))) continue;
    const body = readFileSync(join(root, ROUTES, f), "utf8");
    if (body.startsWith("// 生成物（scripts/ci/contract.mjs gen")) unlinkSync(join(root, ROUTES, f));
  }
  return { hash: h, endpoints: eps.length, tables: byTable.size, schemas: Object.keys(comps).length - 1 };
}
export function check(root = ROOT, base = "main") {
  const yaml = readFileSync(join(root, OPENAPI), "utf8");
  const epJson = existsSync(join(root, ENDPOINTS_JSON)) ? readFileSync(join(root, ENDPOINTS_JSON), "utf8") : "";
  const h = hashOf(yaml + epJson + rowSources(root));
  const bad = [];
  for (const f of ["types.ts", "registry.ts", "schemas.ts", "ops.ts"]) {
    const p = join(root, OUT, f);
    if (!existsSync(p) || !readFileSync(p, "utf8").includes(`openapi:${h}`)) bad.push(`${OUT}/${f} が openapi.yaml と合っていない（pnpm ci:contract:gen）`);
  }
  let prev = "";
  try { prev = execSync(`git show ${base}:${OPENAPI}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { prev = ""; }
  const { rows: retired, invalid } = loadRetired(root);
  bad.push(...invalid);
  let allowed = 0;
  if (prev) {
    const a = parsePaths(prev), b = parsePaths(yaml);
    for (const [p, ms] of Object.entries(a)) {
      if (!b[p]) { const gone = Object.keys(ms).filter((m) => !retiredHit(retired, p, m)); if (!gone.length) allowed++; else bad.push(`破壊的変更: ${p} が消えた（${gone.join("・")}）`); continue; }
      for (const [m, d] of Object.entries(ms)) {
        const n = b[p][m];
        if (!n) { if (retiredHit(retired, p, m)) allowed++; else bad.push(`破壊的変更: ${m} ${p} が消えた`); continue; }
        for (const r of n.required) if (!d.required.includes(r)) bad.push(`破壊的変更: ${m} ${p} に必須の入力 ${r} が増えた`);
        for (const f of d.responseFields) if (!n.responseFields.includes(f)) { if (retiredHit(retired, p, m, f)) allowed++; else bad.push(`破壊的変更: ${m} ${p} の応答から ${f} が消えた`); }
      }
    }
  }
  return { hash: h, base: prev ? base : "(比較元なし)", bad, allowed };
}
export function endpoints(root = ROOT) {
  const contract = parsePaths(readFileSync(join(root, OPENAPI), "utf8"));
  const inContract = new Set(); for (const [p, ms] of Object.entries(contract)) for (const m of Object.keys(ms)) inContract.add(`${m} ${p.replace(/\{(\w+)\}/g, ":$1")}`);
  const routesDir = join(root, ROUTES);
  const registered = new Set();
  if (existsSync(routesDir)) for (const f of readdirSync(routesDir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
    const s = readFileSync(join(routesDir, f), "utf8");
    for (const m of s.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) registered.add(`${m[1].toUpperCase()} ${m[2]}`);
  }
  const extra = [...registered].filter((r) => !inContract.has(r));
  const feats = JSON.parse(readFileSync(join(root, "09_features/features.json"), "utf8")).items;
  const eps = JSON.parse(readFileSync(join(root, ENDPOINTS_JSON), "utf8")); const epList = eps.endpoints ?? eps.items;
  const tasks = JSON.parse(readFileSync(join(root, "07_tasks/tickets.json"), "utf8")).tasks;
  const doneFeatures = new Set(tasks.filter((t) => t.status === "done" && t.deliverable_layer === "backend").flatMap((t) => t.feature_ids ?? [])); // endpoint の担当は backend 層のタスク
  const missingDone = [];
  for (const f of feats) if (doneFeatures.has(f.id)) for (const eid of f.api_endpoints ?? []) {
    const e = epList.find((x) => x.id === eid); if (!e) continue;
    const key = `${e.method} ${e.path}`;
    if (!registered.has(key)) missingDone.push(`${key}（${f.id} は done なのに未登録）`);
  }
  return { contract: inContract.size, registered: registered.size, extra, missingDone };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  if (cmd === "gen") { const r = gen(); console.log(`[contract gen] endpoints ${r.endpoints}・routes ${r.tables} 表・schemas ${r.schemas}・openapi:${r.hash} → ${OUT}／${ROUTES}`); process.exit(0); }
  if (cmd === "check") { const r = check(undefined, process.argv[3] ?? "main"); console.log(r.bad.length ? `[G11 openapi-diff] NG（比較元 ${r.base}）:\n  ${r.bad.join("\n  ")}` : `[G11 openapi-diff] OK（openapi:${r.hash}・比較元 ${r.base}・破壊的変更なし${r.allowed ? `（決定にもとづいて消した ${r.allowed} 件は ${RETIRED}）` : ""}・生成物は最新）`); process.exit(r.bad.length ? 1 : 0); }
  if (cmd === "endpoints") { const r = endpoints(); const bad = [...r.extra.map((x) => `契約に無い登録: ${x}`), ...r.missingDone]; console.log(bad.length ? `[endpoint 実在性] NG:\n  ${bad.join("\n  ")}` : `[endpoint 実在性] OK（契約 ${r.contract}・登録 ${r.registered}・done なのに未登録 0）`); process.exit(bad.length ? 1 : 0); }
  console.error("usage: contract.mjs gen | check [base] | endpoints"); process.exit(1);
}
