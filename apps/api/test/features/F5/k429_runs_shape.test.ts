// K-429「実行の 1 件・一覧（getActionRun・listTicketRuns）の答えと問い合わせを、契約の形に合わせる」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K429-API-…）は 11_tickets/K-429.md の表の行に 1 対 1 で結ぶ。土台は K-62 の delegate-kit.ts（本物の Postgres・本物の口）。
//   契約の fuzz（Schemathesis）の揺れに頼らず、決めた形の入力と答えを直に確かめる。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
//   決め（控え帳 answer=f0f290e785a9）：422 は契約に書ける形の誤りだけ・検査の例外は足さない。
//     ① phase・status が空の行は「AI に任せた実行」ではない（実行を作る 4 つの道はどれも両方を入れる）ので、読む関数が返さない（1 件は 404・一覧は外す）。契約の形（phase・status は文字）は変えない
//     ② 一覧の問い合わせ（limit・cursor・sort）は、契約に書いた形（limit 1〜200・cursor は数 1〜9 桁・sort は表の列名 27 個）だけを受け、外れたら 422・欄の名前つき
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { data, delegateOk, json, makeKit, type Device, type Kit } from "./delegate-kit.js";

let k: Kit;
let owner: Person;
let outsider: Person;
let ownerPc: Device;

beforeAll(async () => {
  k = await makeKit();
  owner = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "K429 の担当者", ticketAbility: "edit" });
  outsider = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "K429 の別の会社の人", ticketAbility: "edit" });
  ownerPc = await k.device(owner);
}, 90_000);
afterAll(async () => {
  await k?.close();
});

type Run = Record<string, unknown> & { id: string; phase: unknown; status: unknown };
/** 種（生の行）の形：チケットに結んだ実行の行で、phase か status_id が空のもの（実行を作る道は通らない） */
async function emptyRun(ticketId: string, phase: string | null, status: string | null): Promise<string> {
  const r = await k.q<{ id: string }>(
    "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id) values ($1, $2, $3, $4, $5) returning id",
    [k.T.tenantId, k.T.rootScope, ticketId, phase, status],
  );
  return r[0]!.id;
}
const runs = async (p: Person, t: string, qs = "") => k.f.req("GET", `/tickets/${t}/runs${qs}`, { headers: p.auth });
const details = (b: Record<string, unknown>) => (b["details"] ?? []) as { field: string; message: string }[];

/** 契約（08_api/openapi.yaml）の listTicketRuns の sort の enum（文字をそのまま読む。契約と口がずれたら赤） */
function contractSortEnum(): string[] {
  const text = readFileSync(new URL("../../../../../08_api/openapi.yaml", import.meta.url), "utf8");
  const from = text.indexOf("operationId: listTicketRuns");
  const block = text.slice(from, text.indexOf("responses:", from));
  const sort = block.slice(block.indexOf("name: sort"));
  const enumPart = sort.slice(sort.indexOf("enum:") + 5);
  return [...enumPart.matchAll(/^\s+- (\w+)\s*$/gm)].map((m) => m[1]!);
}

describe("K-429 実行の 1 件・一覧の答えは契約の形（phase・status は文字）", () => {
  it("K429-API-001 入力 × 実行の 1 件を読む × phase が空の行：404（空の phase を返さない）。本物の実行は 200 で phase・status が文字", async () => {
    const t = await k.ticket(owner);
    const real = await delegateOk(k, owner, t);
    const noPhase = await emptyRun(t, null, "queued");
    const bad = await k.run(owner, noPhase);
    expect(bad.status, await bad.clone().text()).toBe(404);
    expect((await json(bad))["data"]).toBeUndefined();
    const ok = await k.run(owner, real.run_id);
    expect(ok.status).toBe(200);
    const got = await data<Run>(ok);
    expect(typeof got.phase).toBe("string");
    expect(typeof got.status).toBe("string");
    expect(got).toMatchObject({ id: real.run_id, phase: "make", status: "queued" });
  });

  it("K429-API-002 入力 × 実行の 1 件を読む × status が空の行（phase はある）・両方空の行：404", async () => {
    const t = await k.ticket(owner);
    const noStatus = await emptyRun(t, "make", null);
    const neither = await emptyRun(t, null, null);
    for (const id of [noStatus, neither]) {
      const r = await k.run(owner, id);
      expect(r.status, id).toBe(404);
      expect((await json(r))["data"], id).toBeUndefined();
    }
  });

  it("K429-API-003 入力 × 一覧：本物の実行 1 件と、phase が空・status が空・両方空の行が混ざる：本物の 1 件だけが出る。どの項目の phase・status も文字。meta.total は 1", async () => {
    const t = await k.ticket(owner);
    const real = await delegateOk(k, owner, t);
    await emptyRun(t, null, "queued");
    await emptyRun(t, "make", null);
    await emptyRun(t, null, null);
    const r = await runs(owner, t);
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await json(r);
    const list = body.data as Run[];
    expect(list.map((x) => x.id)).toEqual([real.run_id]);
    for (const x of list) {
      expect(typeof x.phase).toBe("string");
      expect(typeof x.status).toBe("string");
    }
    expect((body["meta"] as { total: number }).total).toBe(1);
  });

  it("K429-API-004 状態 × 空の行しか無いチケットの一覧：200・空の配列・total 0（チケットは見えるので 404 にしない）", async () => {
    const t = await k.ticket(owner);
    await emptyRun(t, null, null);
    await emptyRun(t, "make", null);
    const r = await runs(owner, t);
    expect(r.status).toBe(200);
    const body = await json(r);
    expect(body.data).toEqual([]);
    expect((body["meta"] as { total: number }).total).toBe(0);
  });

  it("K429-API-005 操作の揺れ × 空の行が新しい側に 55 件（50 件の枠より多い）：本物の実行は枠から押し出されず出る（空の行を数える前に外す）。total は本物の数", async () => {
    const t = await k.ticket(owner);
    const real = await delegateOk(k, owner, t);
    await k.q(
      `insert into action_runs (tenant_id, scope_id, ticket_id, created_at)
       select $1, $2, $3, now() + make_interval(secs => g) from generate_series(1, 55) g`,
      [k.T.tenantId, k.T.rootScope, t],
    );
    expect(await k.n("select count(*) as n from action_runs where ticket_id = $1", [t])).toBe(56);
    const body = await json(await runs(owner, t));
    expect((body.data as Run[]).map((x) => x.id)).toEqual([real.run_id]);
    expect((body["meta"] as { total: number }).total).toBe(1);
  });
});

describe("K-429 一覧の問い合わせは契約の形だけを受ける（limit・cursor・sort）", () => {
  it("K429-API-006 入力 × sort が契約の列名でない（-58800・nope・大文字・空白や記号つき・64 字・逆順の印）：422・VALIDATION_ERROR・欄 sort。何も書かない", async () => {
    const t = await k.ticket(owner);
    await delegateOk(k, owner, t);
    const before = await k.n("select count(*) as n from action_runs");
    for (const bad of [
      "-58800",
      "nope",
      "ID",
      "created_at%20desc",
      "id%3Bdrop",
      "-created_at",
      "a".repeat(64),
      "1",
      "%E5%85%A8%E8%A7%92",
    ]) {
      const r = await runs(owner, t, `?sort=${bad}`);
      expect(r.status, `sort=${bad}`).toBe(422);
      const b = await json(r);
      expect(b.code, `sort=${bad}`).toBe("VALIDATION_ERROR");
      expect(
        details(b).map((d) => d.field),
        `sort=${bad}`,
      ).toContain("sort");
      expect(b.data).toBeUndefined();
    }
    expect(await k.n("select count(*) as n from action_runs")).toBe(before);
  });

  it("K429-API-007 入力 × sort が契約の enum の列名（28 個・契約の文字から読む・K-485 が taken_over_at を足した）と、空の sort：どれも 200（契約が許す形を断らない）", async () => {
    const t = await k.ticket(owner);
    await delegateOk(k, owner, t);
    const names = contractSortEnum();
    expect(names.length, "契約の enum を読めた").toBe(28);
    expect(names).toContain("created_at");
    for (const name of names) {
      const r = await runs(owner, t, `?sort=${name}`);
      expect(r.status, `sort=${name}`).toBe(200);
    }
    expect((await runs(owner, t, "?sort=")).status).toBe(200); // 空は指定なしと同じ（K-35）
  });

  it("K429-API-008 入力 × limit・cursor が契約の形でない（0・201・abc・-1・小数・cursor が abc・負・10 桁）：422・欄 limit か cursor。契約の形（1〜200・数 1〜9 桁）は 200", async () => {
    const t = await k.ticket(owner);
    await delegateOk(k, owner, t);
    const cases: [string, string][] = [
      ["?limit=0", "limit"],
      ["?limit=201", "limit"],
      ["?limit=abc", "limit"],
      ["?limit=-1", "limit"],
      ["?limit=1.5", "limit"],
      ["?cursor=abc", "cursor"],
      ["?cursor=-1", "cursor"],
      ["?cursor=1234567890", "cursor"],
    ];
    for (const [qs, field] of cases) {
      const r = await runs(owner, t, qs);
      expect(r.status, qs).toBe(422);
      expect(
        details(await json(r)).map((d) => d.field),
        qs,
      ).toContain(field);
    }
    for (const qs of ["?limit=1", "?limit=200", "?cursor=0", "?cursor=123456789", "?limit=&cursor=&sort="]) {
      expect((await runs(owner, t, qs)).status, qs).toBe(200);
    }
  });

  it("K429-API-009 守り × 順番（権限 → 見えない物 → 形の誤り）：セッション無しは形の違う sort でも 401・PC の印は 403・別の会社の人は形の違う sort でも 404（存在を漏らさない・422 を先に返さない）。別の会社の人が契約の形で呼んでも 404。どれも体に data が無い", async () => {
    const t = await k.ticket(owner);
    await delegateOk(k, owner, t);
    const none = await k.f.req("GET", `/tickets/${t}/runs?sort=-58800`);
    expect(none.status).toBe(401);
    const asPc = await k.f.req("GET", `/tickets/${t}/runs?sort=-58800`, {
      headers: { "x-bridge-session": ownerPc.token },
    });
    expect(asPc.status).toBe(403);
    const hidden = await runs(outsider, t, "?sort=-58800");
    expect(hidden.status).toBe(404);
    for (const r of [none, asPc, hidden]) expect((await json(r))["data"]).toBeUndefined();
    expect((await runs(outsider, t, "?sort=created_at")).status).toBe(404);
  });

  it("K429-API-010 操作の揺れ × 形の違う問い合わせの直後に、同じ人が契約の形で呼ぶ：200（断った 1 回が次を巻き込まない）。返す件数の上限（meta.limit）は今までどおり 50", async () => {
    const t = await k.ticket(owner);
    const real = await delegateOk(k, owner, t);
    expect((await runs(owner, t, "?sort=-58800")).status).toBe(422);
    const r = await runs(owner, t, "?sort=created_at");
    expect(r.status).toBe(200);
    const body = await json(r);
    expect((body.data as Run[]).map((x) => x.id)).toEqual([real.run_id]);
    expect((body["meta"] as { limit: number }).limit).toBe(50);
  });
});

describe("K-429 読む関数の守り（作り直した関数の権限と、中身を書き換えない）", () => {
  it("K429-DB-001 守り：作り直した app.action_run_view・app.ticket_runs_view は security definer・search_path に pg_temp・public から外し kaname_app だけ。読むだけで行を書き換えない（更新の時刻が動かない）", async () => {
    const fns = await k.q<{ proname: string; definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
      `select p.proname, p.prosecdef as definer, p.proconfig as cfg,
              has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('action_run_view', 'ticket_runs_view')`,
    );
    expect(fns.map((x) => x.proname).sort()).toEqual(["action_run_view", "ticket_runs_view"]);
    for (const fn of fns) {
      expect(fn.definer, `${fn.proname} は security definer`).toBe(true);
      expect(fn.cfg?.join(",") ?? "", fn.proname).toMatch(/search_path=.*pg_temp/);
      expect(fn.pub, `${fn.proname} を public から外す`).toBe(false);
      expect(fn.app, `${fn.proname} は kaname_app に渡す`).toBe(true);
    }
    const t = await k.ticket(owner);
    const real = await delegateOk(k, owner, t);
    const stamp = () =>
      k
        .q<{ t: string }>("select max(updated_at)::text as t from action_runs where ticket_id = $1", [t])
        .then((r) => r[0]!.t);
    const before = await stamp();
    expect((await k.run(owner, real.run_id)).status).toBe(200);
    expect((await runs(owner, t)).status).toBe(200);
    expect(await stamp()).toBe(before);
  });
});
