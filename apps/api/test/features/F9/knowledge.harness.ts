// 段 10「ナレッジの口」（K-675 の置き場・K-676〜K-690・K-695 の口）の試験の共通の土台。
//   行（it）は葉ごとのファイル apps/api/test/features/F9/knowledge-<名前>.test.ts にある。土台は各ファイルの頭で setupKnowledge() を 1 回呼ぶ。
//   名前の決めは 07_functional/段10-F9/土台-knowledge.md。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては段 4 の credentials.harness.ts と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口（createApp と契約の op）・
//   本物の口の振る舞い（葉ごとの hooks のファイル apps/api/src/hooks/f9-knowledge-*.ts の register・K-326）。画面のログインだけは偽（Bearer に会社・人・ログインの時刻を書く）。
//   ナレッジの口は秘密の関門を使わないので、材料 HookDeps には appPool・repo・config だけを渡す。
//
// 口の振る舞いの読み込みは、試験の本体（it の中）の h.ready() で 1 回だけする。実装の前（切る段の smoke）に、
//   まだ無いファイルを土台の頭で読みに行って準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
//   h.ready() を呼ばない試験は、口の振る舞いが 1 つも無い入口だけを見る（K-675 の 401・501・429 の行）。
import pg from "pg";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, vi } from "vitest";
import { migrate } from "@kaname/db/migrate";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Fixture } from "../fixture.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
/** 口の振る舞いの在りか（試験の本体で読む）。葉ごとのファイル f9-knowledge-*.ts（まだ入っていない葉の物は無い） */
export const HOOKS_DIR = join(HERE, "..", "..", "..", "src", "hooks");
const HOOK_FILE = /^f9-knowledge-[a-z-]+\.ts$/;

export type Role = "admin" | "manager" | "member" | "viewer";
export interface Person {
  id: string;
  tenantId: string;
  /** 主の所属（自分の棚の scope_id になる） */
  scopeId: string;
  ctx: TenantContext;
}
export interface SessionOpts {
  /** ログインから何秒たったか（null＝ログインの時刻が無い）。既定 60 秒 */
  loginAgoSec?: number | null;
  /** 同意し直しが要るセッション（K-53） */
  termsPending?: boolean;
}
export interface PageSeed {
  scope: string;
  owner: Person;
  personal?: boolean;
  state?: "draft" | "published";
  title?: string;
  summary?: string;
  must?: boolean;
  folder?: string | null;
  position?: number;
  /** 本文（{doc, text}）。公開済みなら最初の公開の版を 1 つ入れる */
  text?: string;
  copiedFrom?: string | null;
}
export interface KnowledgeHarness {
  admin: pg.Pool;
  pool: pg.Pool;
  repo: Repository;
  /** 口の振る舞いに渡す差し込み口（env を試験が変える） */
  deps: { env: string };
  /** 上限の差し替え（operationId → 1 分あたり） */
  limits: Record<string, number>;
  /** 口の振る舞いを読み込む（各 it の頭で呼ぶ。2 回目からは何もしない） */
  ready: () => Promise<void>;
  /** 契約の口を叩く。path は /api/v1 から */
  req: (
    method: string,
    path: string,
    o?: { body?: unknown; headers?: Record<string, string>; ip?: string },
  ) => Promise<Response>;
  json: (r: Response) => Promise<Record<string, unknown> & { data?: unknown }>;
  /** 会社（いちばん上のグループつき） */
  company: (name: string) => Promise<{ tenantId: string; rootScope: string }>;
  /** グループ（いちばん上のグループの下） */
  group: (tenantId: string, rootScope: string, name: string) => Promise<string>;
  /** 会社の人。admin は会社の役割が管理者（所属はいちばん上）。manager・member・viewer は group の中での役割（主の所属） */
  person: (tenantId: string, scopeId: string, o?: { name?: string; role?: Role }) => Promise<Person>;
  /** 画面のログインの頭（偽のセッション） */
  as: (p: Person, o?: SessionOpts) => Record<string, string>;
  /** ページを行の守りの外で入れる（本文は {doc, text}・公開済みなら公開の版も 1 つ） */
  page: (o: PageSeed) => Promise<string>;
  /** フォルダを行の守りの外で入れる */
  folder: (o: {
    scope: string;
    owner: Person;
    name: string;
    personal?: boolean;
    parent?: string | null;
  }) => Promise<string>;
  /** ページの行をそのまま読む（行の守りの外・admin） */
  row: (id: string) => Promise<Record<string, unknown> | undefined>;
  /** console の出力を貯めて返す（fn の間だけ） */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

let ipSeq = 0;
const nextIp = (): string => `203.0.113.${(ipSeq = (ipSeq % 250) + 1)}`;

/** 本文の見本（段 5 の {doc, text}・段落 1 つ） */
export const bodyOf = (text: string): { doc: unknown; text: string } => ({
  doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  text,
});

/** 共有の試験 k144-contract.test.ts の土台（fixture.ts の Fixture）に、葉の hooks のファイル（apps/api/src/hooks/<file>.ts の register・K-326）を足す。
 *  葉ごとのファイル（contract/k144.d/K-<番号>.ts の setup）が自分のファイルの名前で 1 回ずつ呼ぶ。
 *  ファイルは最初の要求の前に 1 回だけ読む（準備で読まない：実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023） */
export function addKnowledgeLeafHooks(f: Pick<Fixture, "pool" | "hooks" | "req">, file: string): void {
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    const repo = await createRepository(f.pool);
    const d = { appPool: f.pool, repo, config: { env: "test" } } as unknown as HookDeps;
    const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
    Object.assign(f.hooks, m.register.make(d));
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
}

/** 各試験のファイルの頭で 1 回呼ぶ。beforeAll で組み立て、afterAll で閉じる */
export function setupKnowledge(): KnowledgeHarness {
  const limits: Record<string, number> = {};
  const hooks: Record<string, Hook> = {};
  const deps = { env: "test" };
  let admin: pg.Pool;
  let pool: pg.Pool;
  let repo: Repository;
  let app: ReturnType<typeof createApp>;
  let loaded = false;

  beforeAll(async () => {
    await migrate(DB_URL, DB_PKG);
    admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
    pool = createPool({ databaseUrl: APP_URL, max: 6 });
    repo = await createRepository(pool);
    // 偽の画面のログイン：Bearer fake:<role>:<tenant>:<member>:<ログインからの秒|->:<取り直しからの秒|->[:terms]
    const web = async (h: Headers) => {
      const m = /^Bearer fake:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36}):(-|\d+):(-|\d+)(:terms)?$/.exec(
        h.get("authorization") ?? "",
      );
      if (!m) return null;
      const ago = (s: string) => (s === "-" ? null : new Date(Date.now() - Number(s) * 1000));
      const ctx: TenantContext = {
        tenantId: m[2]!,
        userId: m[3]!,
        role: m[1] as TenantContext["role"],
        loginAt: ago(m[4]!),
        stepUpAt: ago(m[5]!),
      };
      return { ctx, sessionId: "", authUserId: "", termsPending: m[6] === ":terms" };
    };
    app = createApp({
      version: "test",
      repo,
      resolve: withDevice(web, createDeviceResolver(pool)) as never,
      contract: { hooks, limits },
    });
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
    await admin?.end();
  });

  const one = async (sql: string, p: unknown[]) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;

  const h: KnowledgeHarness = {
    get admin() {
      return admin;
    },
    get pool() {
      return pool;
    },
    get repo() {
      return repo;
    },
    deps,
    limits,
    ready: async () => {
      if (loaded) return;
      const files = readdirSync(HOOKS_DIR)
        .filter((n) => HOOK_FILE.test(n))
        .sort();
      const d = { appPool: pool, repo, config: deps } as unknown as HookDeps;
      for (const n of files) {
        const m = (await import(join(HOOKS_DIR, n))) as { register: HookModule };
        Object.assign(hooks, m.register.make(d));
      }
      loaded = true;
    },
    req: (method, path, o = {}) =>
      Promise.resolve(
        app.request(`http://localhost/api/v1${path}`, {
          method,
          headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp(), ...(o.headers ?? {}) },
          ...(o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) }),
        }),
      ),
    json: async (r) => (await r.json()) as Record<string, unknown> & { data?: unknown },
    company: async (name) => {
      const tenantId = await one(
        "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
        [name],
      );
      const rootScope = await one("insert into scopes (tenant_id, name) values ($1, $2) returning id", [
        tenantId,
        `${name} の全体`,
      ]);
      return { tenantId, rootScope };
    },
    group: (tenantId, rootScope, name) =>
      one("insert into scopes (tenant_id, parent_id, name) values ($1, $2, $3) returning id", [
        tenantId,
        rootScope,
        name,
      ]),
    person: async (tenantId, scopeId, o = {}) => {
      const role = o.role ?? "member";
      const id = await one(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id",
        [tenantId, scopeId, o.name ?? "人"],
      );
      await admin.query("insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, $3)", [
        tenantId,
        id,
        role === "admin" ? "admin" : "member",
      ]);
      if (role !== "admin")
        await admin.query(
          "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, $4)",
          [tenantId, id, scopeId, role],
        );
      return { id, tenantId, scopeId, ctx: { tenantId, userId: id, role: "member" } };
    },
    as: (p, o = {}) => {
      const login = o.loginAgoSec === undefined ? "60" : o.loginAgoSec === null ? "-" : String(o.loginAgoSec);
      return { authorization: `Bearer fake:member:${p.tenantId}:${p.id}:${login}:-${o.termsPending ? ":terms" : ""}` };
    },
    page: async (o) => {
      const state = o.state ?? "published";
      const id = await one(
        "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, is_must, title, summary, folder_id, position, current_version, copied_from_page_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id",
        [
          o.owner.tenantId,
          o.scope,
          o.personal ?? false,
          o.owner.id,
          state,
          o.must ?? false,
          o.title ?? "ページ",
          o.summary ?? "",
          o.folder ?? null,
          o.position ?? 0,
          state === "published" ? 1 : 0,
          o.copiedFrom ?? null,
        ],
      );
      const body = JSON.stringify(bodyOf(o.text ?? "本文"));
      if (state === "published")
        await admin.query(
          "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, 1, 'published', $3::jsonb, $4, now(), $4)",
          [o.owner.tenantId, id, body, o.owner.id],
        );
      return id;
    },
    folder: (o) =>
      one(
        "insert into knowledge_folders (tenant_id, scope_id, is_personal, owner_member_id, parent_folder_id, name) values ($1, $2, $3, $4, $5, $6) returning id",
        [o.owner.tenantId, o.scope, o.personal ?? false, o.owner.id, o.parent ?? null, o.name],
      ),
    row: async (id) => (await admin.query("select * from knowledge_pages where id = $1", [id])).rows[0],
    captureLogs: async (fn) => {
      const out: string[] = [];
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
        vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
      );
      try {
        await fn();
      } finally {
        for (const s of spies) s.mockRestore();
      }
      return out.join("\n");
    },
  };
  return h;
}
