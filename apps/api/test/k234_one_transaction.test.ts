// K-234「速さ：1 要求を 1 トランザクションに」の単体の試験（口・本物の DB・偽の画面のログイン）。
//   行 ID（K234-API-…）は 11_tickets/K-234.md の表と 1 対 1。
//   数は、試験の土台のアプリの接続（f.pool）が流した問い合わせ・begin の数・使った接続の数・同時に借りていた接続の最大を数える。
//   ログインの解決は偽（DB を引かない）なので、ここの数は解決の分（K-233）を含まない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { ticketHooks } from "../src/hooks/tickets.js";
import { delegateHooks } from "../src/hooks/delegate.js";
import { approveHooks } from "../src/hooks/approve-complete.js";
import type { Hook } from "../src/contract/deps.js";
import { makeFixture, type Fixture, type Person } from "./features/fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let writer: Person;
let mate: Person;
let outsider: Person;
let ticketId: string;
let otherTicketId: string;

// ---------------------------------------------------------------- 数える（接続を借りる所と返す所を包む）
const hits: string[] = [];
let borrows = 0;
let out = 0;
let peak = 0;
function tap(pool: pg.Pool): void {
  const orig = pool.connect.bind(pool) as unknown as (cb?: unknown) => unknown;
  const wrap = (cl: pg.PoolClient): pg.PoolClient => {
    borrows += 1;
    out += 1;
    peak = Math.max(peak, out);
    const c = cl as pg.PoolClient & { __k234?: boolean };
    if (!c.__k234) {
      const q = c.query.bind(c) as (...a: unknown[]) => unknown;
      (c as unknown as { query: (...a: unknown[]) => unknown }).query = (...a: unknown[]) => {
        const t = a[0];
        hits.push(typeof t === "string" ? t : String((t as { text?: string } | null)?.text ?? ""));
        return q(...a);
      };
      c.__k234 = true;
    }
    const rel = c.release;
    c.release = ((err?: Error | boolean) => {
      out -= 1;
      c.release = rel;
      return rel.call(c, err);
    }) as pg.PoolClient["release"];
    return cl;
  };
  (
    pool as unknown as { connect: (cb?: (e: Error | undefined, c?: pg.PoolClient, d?: unknown) => void) => unknown }
  ).connect = (cb) =>
    cb
      ? orig((e: Error | undefined, c?: pg.PoolClient) =>
          cb(e, c ? wrap(c) : c, (r?: unknown) => c?.release(r as Error | undefined)),
        )
      : (orig() as Promise<pg.PoolClient>).then(wrap);
}
interface Measure {
  res: Response;
  sql: string[];
  begins: number;
  /** 接続を借りた回数（借りて返して借り直しても 2 と数える） */
  borrows: number;
  /** 同時に借りていた接続の最大 */
  peak: number;
}
async function measure(path: string, who: Person, headers: Record<string, string> = {}): Promise<Measure> {
  hits.length = 0;
  borrows = 0;
  peak = out;
  const res = await f.req("GET", path, { headers: { ...who.auth, ...headers } });
  const sql = [...hits];
  return { res, sql, begins: sql.filter((x) => /^\s*begin\b/i.test(x)).length, borrows, peak };
}
const checkedOut = () => f.pool.totalCount - f.pool.idleCount;
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

async function newTicket(who: Person, scope: string, assignee: Person): Promise<string> {
  const kinds = (
    (await (await f.req("GET", "/ticket_kinds", { headers: who.auth })).json()) as {
      data: { id: string; name: string }[];
    }
  ).data;
  const r = await f.req("POST", "/tickets", {
    headers: { ...who.auth, "idempotency-key": crypto.randomUUID() },
    body: {
      scope_id: scope,
      kind_id: kinds.find((k) => k.name === "タスク")!.id,
      title: "1 つの取引で読む",
      assignee_member_id: assignee.id,
      due_on: jst(3),
      body: { doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "数える" }] }] } },
    },
  });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await r.json()) as { data: { id: string } }).data.id;
}

beforeAll(async () => {
  f = await makeFixture([ticketHooks, delegateHooks, approveHooks]);
  f.limits["createTicket"] = 10_000;
  T = await f.company("K234 の会社", "EG");
  O = await f.company("K234 の別の会社", "OT");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  mate = await f.person(T.tenantId, T.rootScope, { name: "担当の人", ticketAbility: "edit" });
  outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
  ticketId = await newTicket(writer, T.rootScope, mate);
  otherTicketId = await newTicket(outsider, O.rootScope, outsider);
  tap(f.pool);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const one = (m: Measure, max: number) => {
  expect(m.begins, m.sql.join("\n")).toBe(1);
  expect(m.borrows, m.sql.join("\n")).toBe(1);
  expect(m.sql.length, m.sql.join("\n")).toBeLessThanOrEqual(max);
};
/** hooks を試験の中だけ差し替える（終わったら戻す） */
async function withHook<T>(op: string, h: Hook, body: () => Promise<T>): Promise<T> {
  const keep: Hook | undefined = f.hooks[op];
  f.hooks[op] = h;
  try {
    return await body();
  } finally {
    if (keep) f.hooks[op] = keep;
    else delete f.hooks[op];
  }
}

describe("K-234 読む口は 1 要求 1 トランザクション（数）", () => {
  it("K234-API-001 GET /scopes：200・begin 1・借りた接続 1・文 6 以下", async () => {
    const m = await measure("/scopes", writer);
    expect(m.res.status, await m.res.clone().text()).toBe(200);
    one(m, 6);
  });

  it("K234-API-002 GET /ticket_kinds：200・begin 1・借りた接続 1・文 6 以下", async () => {
    const m = await measure("/ticket_kinds", writer);
    expect(m.res.status).toBe(200);
    one(m, 6);
  });

  it("K234-API-003 GET /members?limit=200：200・begin 1・借りた接続 1・文 5 以下", async () => {
    const m = await measure("/members?limit=200", writer);
    expect(m.res.status).toBe(200);
    one(m, 5);
  });

  it("K234-API-004 GET /tickets/:id：200・題名と can.delegate が今のまま（区画の並びの在る無しは見ない）・begin 1・借りた接続 1・文 16 以下", async () => {
    const m = await measure(`/tickets/${ticketId}`, writer);
    expect(m.res.status, await m.res.clone().text()).toBe(200);
    const d = ((await m.res.json()) as { data: Record<string, unknown> }).data;
    expect(d["ticket"]).toMatchObject({ id: ticketId, title: "1 つの取引で読む" });
    expect(d["stage"]).toMatchObject({ key: "todo" });
    expect((d["can"] as Record<string, unknown>)["delegate"]).toBe(true);
    one(m, 16);
  });

  it("K234-API-005 GET /approvals/queue：200・begin 1・借りた接続 1・文 9 以下", async () => {
    const m = await measure("/approvals/queue", mate);
    expect(m.res.status, await m.res.clone().text()).toBe(200);
    one(m, 9);
  });

  it("K234-API-006 GET /tickets/:id/runs：200・begin 1・借りた接続 1・文 6 以下", async () => {
    const m = await measure(`/tickets/${ticketId}/runs`, writer);
    expect(m.res.status, await m.res.clone().text()).toBe(200);
    one(m, 6);
  });

  it("K234-API-007 詳細 1 本の間に同時に借りる接続は 1 つ（G-16）", async () => {
    const m = await measure(`/tickets/${ticketId}`, writer);
    expect(m.res.status).toBe(200);
    expect(m.peak).toBe(1);
  });
});

describe("K-234 振る舞いは今のまま", () => {
  it("K234-API-008 書く口（POST /tickets）は 201・作ったチケットを別の GET で読める", async () => {
    const id = await newTicket(writer, T.rootScope, mate);
    const r = await f.req("GET", `/tickets/${id}`, { headers: writer.auth });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { ticket: { id: string } } }).data.ticket.id).toBe(id);
  });

  it("K234-API-009 別の会社のチケットの id：404・区画と帯を読む文が流れない・借りたままの接続 0", async () => {
    const m = await measure(`/tickets/${otherTicketId}`, writer);
    expect(m.res.status).toBe(404);
    expect(m.sql.filter((x) => /ticket_sections|ticket_band/.test(x)).length, m.sql.join("\n")).toBe(0);
    expect(checkedOut()).toBe(0);
  });

  it("K234-API-010 会社から抜けた人：GET /scopes も GET /tickets/:id も 403・借りたままの接続 0", async () => {
    const gone = await f.person(T.tenantId, T.rootScope, { name: "抜けた人", ticketAbility: "edit" });
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    expect((await f.req("GET", "/scopes", { headers: gone.auth })).status).toBe(403);
    expect((await f.req("GET", `/tickets/${ticketId}`, { headers: gone.auth })).status).toBe(403);
    expect(checkedOut()).toBe(0);
  });

  it("K234-API-011 同意し直しの印が立った人の GET /scopes：403・E-AUTH-010・DB の文 0・借りた接続 0", async () => {
    hits.length = 0;
    borrows = 0;
    const r = await f.req("GET", "/scopes", { headers: f.pending(writer) });
    expect(r.status).toBe(403);
    expect(((await r.json()) as { code: string }).code).toBe("E-AUTH-010");
    expect(hits).toEqual([]);
    expect(borrows).toBe(0);
  });

  it("K234-API-012 読む口の中の問い合わせが例外：答えの番号は今と同じ 500・借りたままの接続 0・次の GET /scopes は 200 で begin 1", async () => {
    await withHook(
      "listTicketKinds",
      { before: async (a) => withTenant(f.pool, a.ctx, async (c) => (await c.query("select 1 / 0 as v")).rows[0]) },
      async () => {
        const r = await f.req("GET", "/ticket_kinds", { headers: writer.auth });
        expect(r.status).toBe(500);
      },
    );
    expect(checkedOut()).toBe(0);
    const m = await measure("/scopes", writer);
    expect(m.res.status).toBe(200);
    expect(m.begins).toBe(1);
  });

  it("K234-API-013 プールの上限（6 本）より多い 8 本の GET /tickets/:id を同時：8 本とも 200・同じ題名・20 秒以内・借りたままの接続 0", async () => {
    const t0 = Date.now();
    const rs = await Promise.all(
      Array.from({ length: 8 }, () => f.req("GET", `/tickets/${ticketId}`, { headers: writer.auth })),
    );
    expect(Date.now() - t0).toBeLessThan(20_000);
    expect(rs.map((r) => r.status)).toEqual(Array(8).fill(200));
    const titles = await Promise.all(
      rs.map(async (r) => ((await r.json()) as { data: { ticket: { title: string } } }).data.ticket.title),
    );
    expect(new Set(titles)).toEqual(new Set(["1 つの取引で読む"]));
    expect(checkedOut()).toBe(0);
  }, 30_000);

  it("K234-API-014 上限で断られた GET /scopes（1 分 1 回にした 2 回目）：429・DB の文 0・借りた接続 0", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "上限の人", ticketAbility: "edit" });
    f.limits["listScopes"] = 1;
    try {
      expect((await f.req("GET", "/scopes", { headers: who.auth })).status).toBe(200);
      const m = await measure("/scopes", who);
      expect(m.res.status).toBe(429);
      expect(m.sql).toEqual([]);
      expect(m.borrows).toBe(0);
    } finally {
      delete f.limits["listScopes"];
    }
  });

  it("K234-API-015 取引に入る口の中で、文脈の違う withTenant（別の人）は自分の取引で流れる：begin 2", async () => {
    const m = await withHook(
      "listTicketKinds",
      {
        before: async (a) => {
          await withTenant(f.pool, a.ctx, (c) => c.query("select 1"));
          await withTenant(f.pool, { ...a.ctx, userId: mate.id }, (c) => c.query("select 2"));
          return { status: 200, body: { data: [], meta: { limit: 0 } } };
        },
      },
      () => measure("/ticket_kinds", writer),
    );
    expect(m.res.status).toBe(200);
    expect(m.begins, m.sql.join("\n")).toBe(2);
  });

  it("K234-API-016 取引に入れない口（外へ出す getLatestBridgeRelease）は今のまま：中の withTenant 2 つが別々の取引（抜けた人の確かめの後の begin 2）", async () => {
    const m = await withHook(
      "getLatestBridgeRelease",
      {
        before: async (a) => {
          await withTenant(f.pool, a.ctx, (c) => c.query("select 1"));
          await withTenant(f.pool, a.ctx, (c) => c.query("select 2"));
          return { status: 200, body: { data: { released: false } } };
        },
      },
      () => measure("/bridge/releases/latest", writer),
    );
    expect(m.res.status).toBe(200);
    // 入口の抜けた人の確かめ（試験の土台は偽のログインなので DB で引く）の取引の後の begin を数える
    const rest = m.sql.slice(m.sql.findIndex((x) => /member_left/.test(x)) + 1);
    expect(rest.filter((x) => /^\s*begin\b/i.test(x)).length, m.sql.join("\n")).toBe(2);
  });

  it("K234-API-017 答えを返した後に流れる withTenant は、要求の取引でなく自分の取引で流れ、接続は残らない", async () => {
    let after: Promise<unknown> = Promise.resolve();
    const m = await withHook(
      "listTicketKinds",
      {
        before: async (a) => {
          await withTenant(f.pool, a.ctx, (c) => c.query("select 1"));
          after = new Promise((done) =>
            setTimeout(() => void withTenant(f.pool, a.ctx, (c) => c.query("select 3")).then(done, done), 50),
          );
          return { status: 200, body: { data: [], meta: { limit: 0 } } };
        },
      },
      () => measure("/ticket_kinds", writer),
    );
    expect(m.res.status).toBe(200);
    hits.length = 0;
    await after;
    expect(hits.filter((x) => /^\s*begin\b/i.test(x))).toHaveLength(1);
    expect(hits.some((x) => /select 3/.test(x))).toBe(true);
    expect(checkedOut()).toBe(0);
  });
});
