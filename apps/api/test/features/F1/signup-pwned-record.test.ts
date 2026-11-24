// K-1018 照合が使えなかった登録を、確定した会社の出来事として残す（登録の口 K-51・確定の口 K-52 の直し・本物の DB）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   代表の答え 2026-11-23（D-156.35）：運営の画面で「照合が使えなかった登録」を会社ごとに回収する（K-995 の一覧）。
//   登録の前は会社が無いので、落ちた出来事は今どおり運営の会社に残す（0086・落ち始めのメールの判定・K-51 のまま）。
//   加えて申し込みに「照合が使えなかった」の印（pending_signup.pwned_unchecked_at）を付け、確定したときに
//   その会社に pwned_check_unavailable を 1 行書く（member_id は確定した本人）。K-995 の一覧と K-963 の数はこの行を読む。
//   組み立ては本番と同じ bootApi。外に出るものは関門の差し込み口だけ差し替える（K-51 の sign-up.test.ts と同じ Seams）
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import type { Config } from "@kaname/config";
import type { MailLike } from "@kaname/notify";
import { bootApi, type BootOptions } from "../../../src/server.js";
import { TEST_AUTH_SECRET } from "../../_fake/secrets.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k1018@example.com";
const RUN = `k1018-${Date.now().toString(36)}`;
const PW = "correct-horse-battery-1";
const SIGN_UP = "/api/v1/auth/sign-up";
const VERIFY = "/api/v1/auth/sign-up/verify";
const UNAVAILABLE = "pwned_check_unavailable";

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
interface SentMail {
  to: string;
  subject: string;
  text: string;
}
const mails: SentMail[] = [];
const fakeMail: MailLike = {
  send: async (m) => {
    mails.push({ to: m.to, subject: m.subject, text: m.text });
    return { error: null };
  },
};
/** 照合の偽の外：down の間はつながらない。ok なら「どれも漏れていない」 */
let pwnedDown = false;
const fakeFetch: typeof fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/i.test(url))
    throw new Error(`試験の外への口は照合だけ: ${url}`);
  if (pwnedDown) throw new TypeError("fetch failed (ECONNREFUSED)");
  return new Response("0018A45C4D1DEF81644B54AB7F969B88D65:3", { status: 200 });
};

const config = {
  env: "test",
  databaseUrl: APP_URL,
  authDatabaseUrl: AUTH_URL,
  authSecret: TEST_AUTH_SECRET,
  baseUrl: "http://127.0.0.1:3001",
  webBaseUrl: "http://127.0.0.1:3123",
  webOrigins: [],
  storage: {
    endpoint: "http://127.0.0.1:9000",
    region: "ap-northeast-1",
    bucket: "kaname-dev",
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
    forcePathStyle: true,
  },
  secretsMasterKey: Buffer.alloc(32, 7).toString("base64"),
  resendApiKey: null,
  mailFrom: "Kaname <noreply@example.com>",
  opsEmail: OPS_EMAIL,
  mailReplyTo: OPS_EMAIL,
  operator: { service: "Kaname", company: "試験", representative: "試験", email: OPS_EMAIL, phone: "", address: null },
  mailSuppressPrefix: "",
  bridgeReleaseBase: "",
  bridgeReleaseDir: "",
  infisical: null,
  listenDatabaseUrl: null,
  port: 0,
} as Config;

let app: Awaited<ReturnType<typeof bootApi>>;
let admin: pg.Pool;
let ipSeq = 0;
const nextIp = () => `198.51.100.${(ipSeq = (ipSeq % 250) + 1)}`;
const email = (tag: string) => `${RUN}-${tag}@example.com`;
const req = (path: string, body: unknown) =>
  app.app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": nextIp() },
    body: JSON.stringify(body),
  });
const n = async (sql: string, p: unknown[] = []) => Number((await admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const flagOf = async (e: string) =>
  (
    await admin.query<{ f: Date | null }>(
      "select pwned_unchecked_at as f from kaname_auth.pending_signup where email = $1",
      [e],
    )
  ).rows[0]?.f ?? null;
/** 登録する（照合を落とすかを選ぶ）。201 を確かめ、確認のメールのリンクの手がかりを返す */
const signup = async (tag: string, down: boolean): Promise<string> => {
  pwnedDown = down;
  try {
    const from = mails.length;
    const r = await req(SIGN_UP, {
      email: email(tag),
      name: `本人 ${tag}`,
      company_name: `${RUN} 会社 ${tag}`,
      password: PW,
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const m = mails.slice(from).find((x) => x.to === email(tag));
    const u = /https?:\/\/\S+\/verify-email\?token=([^\s&]+)/.exec(m?.text ?? "");
    expect(u, "確認のメールにリンクがある").not.toBeNull();
    return decodeURIComponent(u![1]!);
  } finally {
    pwnedDown = false;
  }
};
const verify = (token: string) => req(VERIFY, { token });
/** 確定した本人の会社と members の id */
const memberOf = async (e: string) =>
  (
    await admin.query<{ id: string; tenant_id: string }>(
      'select m.id, m.tenant_id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
      [e],
    )
  ).rows[0];
const tenantEvents = (tenant: string) =>
  n("select count(*) as n from security_events where tenant_id = $1 and kind_id = $2", [tenant, UNAVAILABLE]);
const opsEvents = () =>
  n("select count(*) as n from security_events where tenant_id = app.ops_tenant_id() and kind_id = $1", [UNAVAILABLE]);

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const ops = (await admin.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
  for (const kind of ["terms", "privacy"])
    await admin.query(
      "insert into terms_versions (tenant_id, kind, version, url, published_at) values ($1, $2, $3, $4, now())",
      [ops, kind, RUN, `https://kaname.example/${kind}`],
    );
  const seams: Seams = { bucketExists: async () => true, mail: fakeMail, outboundFetch: fakeFetch };
  app = await bootApi(config, seams);
}, 60_000);

afterAll(async () => {
  await admin?.query("delete from kaname_auth.pending_signup where email like $1", [`${RUN}-%`]);
  await admin?.query(
    "delete from terms_consents where terms_version_id in (select id from terms_versions where version = $1)",
    [RUN],
  );
  await admin?.query("delete from terms_versions where version = $1", [RUN]);
  await app?.close();
  await admin?.end();
});

describe("K-1018 申し込みの印", () => {
  it("K1018-API-001 照合が使えなかった登録は、申し込みに印（pwned_unchecked_at）が付く。照合できた登録は印が空", async () => {
    await signup("down", true);
    await signup("ok", false);
    expect(await flagOf(email("down"))).not.toBeNull();
    expect(await flagOf(email("ok"))).toBeNull();
  });

  it("K1018-API-002 同じメールで登録し直すと印は最後の照合に従う（落ちた → 照合できた で消え、照合できた → 落ちた で付く）", async () => {
    await signup("again-a", true);
    await signup("again-a", false);
    expect(await flagOf(email("again-a"))).toBeNull();
    await signup("again-b", false);
    await signup("again-b", true);
    expect(await flagOf(email("again-b"))).not.toBeNull();
  });

  it("K1018-API-003 運営の会社の出来事（落ち始めのメールの判定）は今のまま：落ちた登録 1 回で運営の会社に 1 行。確定しても運営の会社の行は増えない", async () => {
    const o0 = await opsEvents();
    const t = await signup("ops-row", true);
    expect(await opsEvents()).toBe(o0 + 1);
    expect((await verify(t)).status).toBe(201);
    expect(await opsEvents()).toBe(o0 + 1);
  });
});

describe("K-1018 確定したときの会社の出来事", () => {
  it("K1018-API-004 印のある申し込みを確定すると、その会社に pwned_check_unavailable が 1 行。member_id は確定した本人・detail にメールもパスワードも無い", async () => {
    const t = await signup("record", true);
    const r = await verify(t);
    expect(r.status, await r.clone().text()).toBe(201);
    const m = (await memberOf(email("record")))!;
    expect(await tenantEvents(m.tenant_id)).toBe(1);
    const ev = (
      await admin.query<{ member_id: string; t: string }>(
        "select member_id, s::text as t from security_events s where tenant_id = $1 and kind_id = $2",
        [m.tenant_id, UNAVAILABLE],
      )
    ).rows[0]!;
    expect(ev.member_id).toBe(m.id);
    expect(ev.t).not.toContain(email("record"));
    expect(ev.t).not.toContain(PW);
  });

  it("K1018-API-005 照合できた登録を確定しても、その会社に出来事は書かない", async () => {
    const t = await signup("clean", false);
    expect((await verify(t)).status).toBe(201);
    const m = (await memberOf(email("clean")))!;
    expect(await tenantEvents(m.tenant_id)).toBe(0);
  });

  it("K1018-API-006 2 回押す（確定済み）：2 回目は 409 で、会社の出来事は 1 行のまま", async () => {
    const t = await signup("twice", true);
    expect((await verify(t)).status).toBe(201);
    const again = await verify(t);
    expect(again.status).toBe(409);
    const m = (await memberOf(email("twice")))!;
    expect(await tenantEvents(m.tenant_id)).toBe(1);
  });

  it("K1018-API-007 失敗：会社の出来事を書けないと確定は 500・E-PAGE-003 で、作りかけの本人を残さず印を戻す。もう一度押すと確定でき、出来事が 1 行", async () => {
    const e = email("write-fail");
    const t = await signup("write-fail", true);
    await admin.query(`create or replace function public.k1018_fail() returns trigger language plpgsql as $$
      begin if new.kind_id = 'pwned_check_unavailable' and new.tenant_id <> app.ops_tenant_id() then
        raise exception 'K-1018 の試験：出来事を書けない'; end if; return new; end $$`);
    await admin.query(
      "create trigger k1018_fail before insert on security_events for each row execute function public.k1018_fail()",
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      expect(r.status).toBe(500);
      const text = await r.text();
      expect((JSON.parse(text) as Record<string, unknown>)["code"]).toBe("E-PAGE-003");
      expect(text).not.toContain("K-1018 の試験");
      expect(await memberOf(e)).toBeUndefined();
      expect(
        await n("select count(*) as n from kaname_auth.pending_signup where email = $1 and consumed_at is null", [e]),
      ).toBe(1);
    } finally {
      spy.mockRestore();
      await admin.query("drop trigger if exists k1018_fail on security_events");
      await admin.query("drop function if exists public.k1018_fail()");
    }
    expect((await verify(t)).status).toBe(201);
    const m = (await memberOf(e))!;
    expect(await tenantEvents(m.tenant_id)).toBe(1);
  });

  it("K1018-API-008 会社の出来事は K-963 の数え方に入る：確定した会社は確かめた印が無いので「確かめていない会社」に数えられる（0086 と同じ見方の SQL で 1 社）", async () => {
    const t = await signup("count", true);
    expect((await verify(t)).status).toBe(201);
    const m = (await memberOf(email("count")))!;
    expect(
      await n(
        `select count(*) as n from security_events e where e.tenant_id = $1 and e.kind_id = $2
           and e.occurred_at > coalesce((select max(a.occurred_at) from security_events a
                                          where a.tenant_id = e.tenant_id and a.kind_id = 'pwned_check_acknowledged'), '-infinity')`,
        [m.tenant_id, UNAVAILABLE],
      ),
    ).toBe(1);
  });
});
