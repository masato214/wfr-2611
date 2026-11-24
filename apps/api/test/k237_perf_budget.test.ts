// K-237「速さの検査：口ごとの DB の文の数」の単体の試験（口・本物の DB・本物の Better Auth のログイン）。
//   行 ID（K237-API-…）は 11_tickets/K-237.md の表と 1 対 1。上限は台帳 scripts/ci/perf_budget.json の api（台帳の形と緩めないことは
//   scripts/ci/k237_perf_ledger_test.py が見る）。段 1 の画面が最初の読み込みで呼ぶ口を、本物のログインで 1 本ずつ呼び、
//   試験が作った 2 つのプール（アプリと認証）の接続が流した問い合わせと begin を数えて、台帳の上限と比べる。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Auth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { countQueries, createPool, withDbCount, type DbCount } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { ticketHooks } from "../src/hooks/tickets.js";
import { delegateHooks } from "../src/hooks/delegate.js";
import { approveHooks } from "../src/hooks/approve-complete.js";
import { bridgeHooks } from "../src/hooks/bridge.js";
import { setupTaskHooks } from "../src/hooks/setup-tasks.js";
import { ticketTimelineHooks } from "../src/hooks/ticket-timeline.js";
import { ticketDecisionHooks } from "../src/hooks/ticket-decisions.js";
import { keepAuth, verifiedUser } from "./_pending.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const DB_PKG = join(ROOT, "packages", "db");
const LEDGER = join(ROOT, "scripts", "ci", "perf_budget.json");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "correct-horse-battery-1";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

interface ApiBudget {
  name: string;
  method: "GET";
  path: string;
  max_statements: number;
  max_begins: number;
}
const ledger = JSON.parse(readFileSync(LEDGER, "utf8")) as { api: ApiBudget[] };

let admin: pg.Pool;
let appPool: pg.Pool;
let authPool: pg.Pool;
let auth: Auth;
let app: ReturnType<typeof createApp>;
let token = "";
let ticketId = "";
let email = "";

// ---------------------------------------------------------------- 数える（接続を取る所を包み、その接続の query を記録する）
const hits: string[] = [];
function tap(pool: pg.Pool): void {
  const orig = pool.connect.bind(pool) as unknown as (cb?: unknown) => unknown;
  const wrap = (cl: pg.PoolClient): pg.PoolClient => {
    const c = cl as pg.PoolClient & { __k237?: boolean };
    if (!c.__k237) {
      const q = c.query.bind(c) as (...a: unknown[]) => unknown;
      (c as unknown as { query: (...a: unknown[]) => unknown }).query = (...a: unknown[]) => {
        const t = a[0];
        hits.push(typeof t === "string" ? t : String((t as { text?: string } | null)?.text ?? ""));
        return q(...a);
      };
      c.__k237 = true;
    }
    return cl;
  };
  (
    pool as unknown as { connect: (cb?: (e: Error | undefined, c?: pg.PoolClient, d?: unknown) => void) => unknown }
  ).connect = (cb) =>
    cb
      ? orig((e: Error | undefined, c?: pg.PoolClient, d?: unknown) => cb(e, c ? wrap(c) : c, d))
      : (orig() as Promise<pg.PoolClient>).then(wrap);
}
const headers = () => ({ authorization: `Bearer ${token}`, "user-agent": UA, "x-screen-id": "tickets" });
async function measure(b: ApiBudget): Promise<{ status: number; statements: number; begins: number; sql: string[] }> {
  const url = `http://localhost${b.path.replace(":id", ticketId)}`;
  hits.length = 0;
  const r = await app.request(url, { method: b.method, headers: headers() });
  const sql = [...hits];
  return {
    status: r.status,
    statements: sql.length,
    begins: sql.filter((s) => /^\s*begin\b/i.test(s)).length,
    sql,
  };
}

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 4 });
  const repo = await createRepository(appPool);
  const made = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  auth = made.auth;
  authPool = made.pool;
  // 本番（server.ts）と同じ口の振る舞いの並び（段 1 の画面が呼ぶ口のぶん）
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 1 }),
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      mailer: async () => undefined,
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
    contract: {
      hooks: {
        ...bridgeHooks({
          appPool,
          release: { dir: "", base: "" },
          objects: new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k237-obj-"))), {
            signingSecret: "k237-test-files",
          }),
        }),
        ...ticketHooks(appPool),
        ...delegateHooks(appPool),
        ...approveHooks(appPool),
        ...setupTaskHooks(appPool),
        ...ticketTimelineHooks(appPool),
        ...ticketDecisionHooks(appPool),
      },
      limits: {},
    },
  });
  email = `k237-${Date.now().toString(36)}@example.com`;
  const v = await verifiedUser(AUTH_URL, {
    email,
    password: PW,
    companyName: "K237 の会社",
  });
  token = v.token;
  const m = (
    await admin.query<{ id: string; tenant_id: string; scope_id: string }>(
      "select id, tenant_id, scope_id from members where auth_user_id = $1 and deleted_at is null",
      [v.userId],
    )
  ).rows[0]!;
  const kinds = (await (await app.request("http://localhost/api/v1/ticket_kinds", { headers: headers() })).json()) as {
    data: { id: string; name: string }[];
  };
  const due = new Date(Date.now() + 3 * 86400_000 + 9 * 3600_000).toISOString().slice(0, 10);
  const made2 = await app.request("http://localhost/api/v1/tickets", {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({
      scope_id: m.scope_id,
      kind_id: kinds.data.find((k) => k.name === "タスク")!.id,
      title: "数えるためのチケット",
      assignee_member_id: m.id,
      due_on: due,
      body: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "数える" }] }] } },
    }),
  });
  expect(made2.status, await made2.clone().text()).toBe(201);
  ticketId = ((await made2.json()) as { data: { id: string } }).data.id;
  tap(appPool);
  tap(authPool);
  // 見張りの最初の書き込み（端末と国を決める）を数えないよう、1 回呼んでおく
  await app.request("http://localhost/api/auth-ext/me", { headers: headers() });
}, 60_000);
afterAll(async () => {
  await authPool.end();
  await appPool.end();
  await admin.end();
});

describe("K-237 口ごとの DB の文の数（台帳の上限）", () => {
  it("K237-API-001 台帳の全部の口：本物のログインで 200・文の数と begin の数が台帳の上限以下", async () => {
    expect(ledger.api.length).toBeGreaterThan(0);
    const over: string[] = [];
    for (const b of ledger.api) {
      const m = await measure(b);
      expect(m.status, `${b.name} ${b.path}`).toBe(200);
      if (m.statements > b.max_statements || m.begins > b.max_begins)
        over.push(
          `${b.name} ${b.path}：文 ${m.statements}（上限 ${b.max_statements}）・begin ${m.begins}（上限 ${b.max_begins}）\n  ${m.sql.join("\n  ")}`,
        );
    }
    expect(over, over.join("\n")).toEqual([]);
  });

  it('K237-API-002 台帳の全部の口：答えに Server-Timing の db（時間・ms）と q（desc="statements"・dur＝その要求が流した文の数）があり、q の数は試験が 2 つのプールで数えた文の数と同じ', async () => {
    const bad: string[] = [];
    for (const b of ledger.api) {
      const url = `http://localhost${b.path.replace(":id", ticketId)}`;
      hits.length = 0;
      const r = await app.request(url, { method: b.method, headers: headers() });
      const counted = hits.length;
      const st = r.headers.get("server-timing") ?? "";
      const db = /(?:^|,)\s*db;dur=(\d+(?:\.\d+)?)/.exec(st);
      const q = /(?:^|,)\s*q;desc="statements";dur=(\d+)/.exec(st);
      if (!db || !q) bad.push(`${b.name} ${b.path}：Server-Timing が無い・形が違う「${st}」`);
      else if (Number(q[1]) !== counted) bad.push(`${b.name} ${b.path}：q ${q[1]}・数えた文 ${counted}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("K237-API-003 認証の要る口の答え（台帳の全部の口・200）に Cache-Control: private, no-store（配り先や途中に貯めさせない・付けるのは K-262）", async () => {
    for (const b of ledger.api) {
      const r = await app.request(`http://localhost${b.path.replace(":id", ticketId)}`, {
        method: b.method,
        headers: headers(),
      });
      expect(r.headers.get("cache-control"), `${b.name} ${b.path}`).toBe("private, no-store");
    }
  });

  it("K237-API-004 /health と規約の今の版の口（誰が呼んでも同じ道）の答えには Server-Timing の db と q があり、/health の q は 0。ログインしていない契約の口（401）と、解けない鍵の 401 の答えには Server-Timing が無い", async () => {
    const st = (r: Response) => r.headers.get("server-timing") ?? "";
    const health = await app.request("http://localhost/health");
    const h = st(health);
    expect(h).toMatch(/(?:^|,)\s*db;dur=\d+(?:\.\d+)?/);
    expect(/(?:^|,)\s*q;desc="statements";dur=(\d+)/.exec(h)?.[1]).toBe("0");
    const terms = await app.request("http://localhost/api/v1/auth/terms/current", { headers: { "user-agent": UA } });
    expect(st(terms)).toMatch(/(?:^|,)\s*q;desc="statements";dur=\d+/);
    const anon = await app.request("http://localhost/api/v1/scopes", { headers: { "user-agent": UA } });
    expect(anon.status).toBe(401);
    expect(anon.headers.get("server-timing")).toBeNull();
    const bogus = await app.request("http://localhost/api/v1/scopes", {
      headers: { "user-agent": UA, authorization: "Bearer k237-not-a-session" },
    });
    expect(bogus.status).toBe(401);
    expect(bogus.headers.get("server-timing")).toBeNull();
  });

  it("K237-API-005 登録の申し込みの答えには（ログインと再設定の申し込みは K301-API-027・K313-API-018 が見る）、登録の有無・ログイン中かどうか・成功か失敗かにかかわらず Server-Timing が無い（文の数で登録の有無を漏らさない・PM の決め）", async () => {
    const ghost = `k237-none-${Date.now().toString(36)}@example.com`;
    const post = (path: string, body: unknown, bearer: boolean) =>
      app.request(`http://localhost${path}`, {
        method: "POST",
        headers: {
          "user-agent": UA,
          "content-type": "application/json",
          origin: "http://localhost:3123",
          ...(bearer ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    // [道, 中身, 待つ答えの番号]（口の手前で断られて緑にならないよう、番号も見る。契約の /api/v1/auth/sign-up は口の振る舞いがまだ無い 501）
    // 段 2（K-50）で振る舞いが入る口・閉じる道は、ここに置くと入った時点で番号がずれて落ちるので、その口のチケットの試験が同じことを見る：
    //   ログイン（契約の口・成功と失敗・在るメールと無いメール）→ K301-API-027／再設定の申し込み（契約の口・在るメールと無いメール）→ K313-API-018。
    //   部品のログインの道は K-301 が、部品の再設定の申し込みの道は K-320 が、前の道すじのログインは K-316 が閉じる。
    //   「再設定の申し込みは在るメールと無いメールで流す文の数が違う（だから頭に出してはいけない）」の確かめも、部品の道が閉じるので外した
    const cases: [string, unknown, number][] = [];
    for (const who of [email, ghost])
      cases.push(["/api/v1/auth/sign-up", { email: who, password: PW, company_name: "K237 の会社" }, 501]);
    const leaked: string[] = [];
    const check = async (path: string, body: unknown, want: number, bearer: boolean) => {
      const r = await post(path, body, bearer);
      const st = r.headers.get("server-timing");
      if (r.status !== want)
        leaked.push(`${path}${bearer ? "（ログイン中）" : ""}：答え ${r.status}（待つのは ${want}）`);
      if (st !== null) leaked.push(`${path}${bearer ? "（ログイン中）" : ""}（${r.status}）：${st}`);
    };
    for (const bearer of [false, true]) for (const [path, body, want] of cases) await check(path, body, want, bearer);
    // 登録の成功の答えにも無い
    await check(
      "/api/auth/sign-up/email",
      { email: `k237-new-${Date.now().toString(36)}@example.com`, password: PW, name: "K237" },
      200,
      false,
    );
    expect(leaked, leaked.join("\n")).toEqual([]);
  });

  it("K237-API-006 同時の 2 つの要求の数は混ざらない：接続が 1 本のプールで、2 つの数え器の中から pool.query を 3 回と 5 回同時に流すと、それぞれ 3 と 5", async () => {
    const pool = countQueries(new pg.Pool({ connectionString: AUTH_URL, max: 1 }));
    try {
      const run = (n: number): Promise<DbCount> => {
        const c: DbCount = { statements: 0, ms: 0 };
        return withDbCount(c, async () => {
          for (let i = 0; i < n; i += 1) await pool.query("select 1");
          return c;
        });
      };
      const [a, b] = await Promise.all([run(3), run(5)]);
      expect([a.statements, b.statements]).toEqual([3, 5]);
    } finally {
      await pool.end();
    }
  });
});
