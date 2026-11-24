// K-53「規約に同意する」の単体の試験（口・本物の DB）。テストの名前の頭の行 ID（K53-API-…）は 11_tickets/K-53.md の表のマスと分岐に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。
//
// 組み立ては本番と同じ bootApi（apps/api/src/server.ts）。外に出るものは関門の差し込み口だけを差し替える（K-51 と同じ Seams）。
// 本人とログインは、ログインの部品で直に作る（signUp・signInWithLock。ログインでセッションができたときの hook はどちらも同じ packages/auth）。
// 規約の版を出す操作（運営の画面・流れ F12）はまだ無いので、版は DB に直に入れる。時刻は眠らずに published_at を DB の now() からずらす（D-128.130）。
//
// 試験が決める口の形:
//   getCurrentTerms（GET /api/v1/auth/terms/current・誰でも）→ 200 { data: [{ id, kind, version, url, published_at }, …] }
//     kind ごとに今の版 1 つ（terms・privacy は必ず・tokushoho はあれば）。ほかの列（tenant_id・created_by など）は返さない
//   consentToTerms（POST /api/v1/auth/terms/consent・本人）→ 体 { agree: true, terms_version_id, privacy_version_id }
//     201：版ごとに terms_consents に 1 行（同じ人・同じ版は 1 行だけ）。印（sessions.terms_pending）を下ろす
//     契約の形（TermsConsentsInput・getCurrentTerms の答えの配列・403・409 の current）は K-53 の「契約を直す」の行で直す
//   同意し直しが要る間（ログインしたときに今の版に同意していない）は、規約の 2 つの口・ログアウト・自分の取得のほかは 403
//   足すエラー（K-53 が errors.json に足す・文は D-128.146）
//     NEW_TERMS_REQUIRED … E-AUTH-010 同意し直しが要る（403）
//     NEW_TERMS_STALE    … E-CONF-012 同意する版が古い（409・今の版を current で出し直す）
//     NEW_TERMS_NO_AGREE … E-VAL-019 同意の印（チェック）が無い（422・欄は agree）。E-VAL-012〜015 は hold/k57-k60 の K-60、017・018 は K-92 が使う
//   人の作り方：signUp はログインの印も返す（セッションが 1 つできる）。この試験の person() は、その登録のときのセッションを閉じてから
//     ログインさせる（sessions を数える試験が、ログインでできたセッションだけを見るように）
// 試験が前提にする DB の形（このチケットの migration）：app.current_terms()・app.terms_pending(text)・sessions.terms_pending・
//   terms_consents の（auth_user_id, terms_version_id）の重ならない索引・利用規約とプライバシーポリシーの第 1 版の種（D-128.137）
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { signInWithLock, signUp } from "@kaname/auth/signup";
import { enableTotp, signIn, verifyTotp } from "@kaname/auth/two_factor";
import { putPending } from "@kaname/auth/pending";
import { createInvitation } from "@kaname/auth/invitations";
import { createRepository } from "@kaname/db/repository";
import { createPool } from "@kaname/db/pool";
import type { Config } from "@kaname/config";
import type { MailLike } from "@kaname/notify";
import { bootApi, type BootOptions } from "../../../src/server.js";
import { addTestEntry } from "../../_pending.js";
import { assertion as passkeyAssertion, makeAuthenticator, type Authenticator } from "../F12/ops.harness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
const FEATURE_DIR = join(HERE, "..", "..", "..", "src", "features", "F1", "consent-terms");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k53@example.com";
const RUN = `k53-${Date.now().toString(36)}`; // この回が作るものの印（終わったら消す・G-10）
const PW = "correct-horse-battery-1";
const CURRENT = "/api/v1/auth/terms/current";
const CONSENT = "/api/v1/auth/terms/consent";
const OTHER_API = "/api/v1/conversations"; // 同意し直しの間に止まるべき、ふつうの口（素の一覧）
const NEW_TERMS_REQUIRED = "E-AUTH-010"; // 足すエラー（同意し直しが要る・D-128.146）
const NEW_TERMS_STALE = "E-CONF-012"; // 足すエラー（同意する版が古い・D-128.146）
const NEW_TERMS_NO_AGREE = "E-VAL-019"; // 足すエラー（同意の印が無い・D-128.146）。E-VAL-012〜018 は他のチケットが使う
const MSG_REQUIRED = "利用規約とプライバシーポリシーが新しくなりました。同意してから続けてください"; // E-AUTH-010 の文（D-128.146）
const SIGNUP = "/api/v1/auth/sign-up";
const WEB_UA = "Mozilla/5.0 (K-53 test) Chrome/140"; // 頭（header）の値は ASCII だけ（new Headers が投げる）

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
const mails: { to: string; subject: string; text: string }[] = [];
const fakeMail: MailLike = {
  send: async (m) => {
    mails.push({ to: m.to, subject: m.subject, text: m.text });
    return { error: null };
  },
};
const fakeFetch: typeof fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  // 版が無いと登録を通さない試験（K53-API-010）だけが K-51 の登録の口を通る：漏れたパスワードの照合に「漏れていない」と答える
  if (/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/i.test(url))
    return new Response("0018A45C4D1DEF81644B54AB7F969B88D65:3", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  throw new Error(`K-53 は外に出ない: ${url}`);
};
const MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
const config = {
  env: "test",
  databaseUrl: APP_URL,
  authDatabaseUrl: AUTH_URL,
  authSecret: "test-secret-0123456789-abcdefghijklmnop",
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
  secretsMasterKey: MASTER_KEY,
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
let appRole: pg.Pool;
let authFixture: ReturnType<typeof createAuth>;
let fixturePool: pg.Pool;
let opsTenant = "";
/** この回の基準の版（beforeAll で出す・どの本人もはじめに同意済みにする） */
const base = { terms: "", privacy: "" };
let ipSeq = 0;
const nextIp = () => `198.18.0.${(ipSeq = (ipSeq % 250) + 1)}`;
const email = (tag: string) => `${RUN}-${tag}@example.com`;
const req = (method: string, path: string, body?: unknown, o: { ip?: string; headers?: Record<string, string> } = {}) =>
  app.app.request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": o.ip ?? nextIp(),
      "user-agent": WEB_UA,
      ...(o.headers ?? {}),
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: unknown };

/** 版を出す（published_at は SQL の式）。返すのは id */
const publish = async (kind: "terms" | "privacy" | "tokushoho", tag: string, at = "now()") =>
  (
    await admin.query<{ id: string }>(
      `insert into terms_versions (tenant_id, kind, version, url, published_at) values ($1, $2, $3, $4, ${at}) returning id`,
      [opsTenant, kind, `${RUN}-${tag}`, `https://kaname.example/${kind}/${RUN}-${tag}`],
    )
  ).rows[0]!.id;
/** 版を取り下げる（deleted_at）。試験の終わりに必ず呼んで、基準の版を今の版に戻す */
const withdraw = (...ids: string[]) =>
  admin.query("update terms_versions set deleted_at = now() where id = any($1::uuid[])", [ids]);
/** 利用規約とプライバシーポリシーの新しい版を出す */
const publishBoth = async (tag: string, at = "now()") => ({
  terms: await publish("terms", tag, at),
  privacy: await publish("privacy", tag, at),
});
interface Person {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
/** 本人を作り、基準の版に同意済みにする */
const person = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, { email: e, password: PW, name: "同意 する人", companyName: `${RUN}-社` });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>("select id, tenant_id from members where auth_user_id = $1", [
      r.userId,
    ])
  ).rows[0]!;
  // 登録のとき（signUp）にできたセッションは閉じる。ここからの試験は login() でできたセッションだけを見る
  await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [m.id]);
  for (const v of [base.terms, base.privacy])
    await admin.query(
      "insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at) values ($1, $2, $3, $4, now())",
      [m.tenant_id, m.id, r.userId, v],
    );
  await addTestEntry(r.userId); // 入り方を 1 つ持つ人にする（付けるまで進めないの止め・K-321 に当てない）
  return { email: e, userId: r.userId, memberId: m.id, tenantId: m.tenant_id };
};
/** 運営の人（運営のテナント app.ops_tenant_id() の人・D-128.172）を作り、基準の版に同意済みにする。
 *  会社を作らない登録（signUp に companyName を渡さない）で認証の人だけを作り、運営のテナントの member と運営の人の表（ops_members）に入れる。
 *  運営の人はパスキーだけで入る（K-944・D-128.70）ので、仮の認証器のパスキーを 1 本付ける（入るのは下の loginOps） */
const OPS_KEYS = new Map<string, { a: Authenticator; n: number }>();
const opsPerson = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, { email: e, password: PW, name: "運営 の人" });
  const scope = (
    await admin.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, $2) returning id", [
      opsTenant,
      `${RUN}-運営-${tag}`,
    ])
  ).rows[0]!.id;
  const memberId = (
    await admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values ($1, $2, 'human', '運営 の人', $3) returning id",
      [opsTenant, scope, r.userId],
    )
  ).rows[0]!.id;
  await admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, '{inquiry}')", [
    opsTenant,
    memberId,
  ]);
  await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [memberId]);
  for (const v of [base.terms, base.privacy])
    await admin.query(
      "insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at) values ($1, $2, $3, $4, now())",
      [opsTenant, memberId, r.userId, v],
    );
  const a = makeAuthenticator();
  await admin.query(
    `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
     values (gen_random_uuid()::text, $1, $2, $3, $4, 0, 'singleDevice', false, 'internal', now())`,
    [`${RUN}-鍵`, a.cose.toString("base64"), r.userId, a.credentialId.toString("base64url")],
  );
  OPS_KEYS.set(r.userId, { a, n: 0 });
  return { email: e, userId: r.userId, memberId, tenantId: opsTenant };
};
const OPS_API = "/api/v1/ops/members"; // 運営の口（auth ops・listOpsMembers）
/** 同意し直しで止まっていない（E-AUTH-010 でない）ことを確かめる。役で止まる 403・作りかけの 501 はこのチケットの外 */
const expectNotTermsBlocked = async (r: Response, what: string) => {
  const code = r.status === 403 ? (await json(r))["code"] : null;
  expect(code, `${what} は同意し直しで止めない（D-128.172）`).not.toBe(NEW_TERMS_REQUIRED);
};
/** 運営のセッション（role ops・会社なし・K-944）で呼んだ口：印は解けていて（401 でない）、同意し直し（E-AUTH-010）では止まらない。
 *  入口は同意し直しを役より先に見るので、印が立っていれば E-AUTH-010 になる。役の段の答え（403・501）は F12 の葉（K-1001 など）の持ち分 */
const expectOpsNotTermsBlocked = async (r: Response, what: string) => {
  expect(r.status, `${what}：運営の印が解けている（${await r.clone().text()}）`).not.toBe(401);
  await expectNotTermsBlocked(r, what);
};
/** ログインする（パスワード）。ログインでセッションができたときに、同意し直しが要るかを決める */
const login = async (p: Person, ua = WEB_UA) => {
  const r = await signInWithLock(authFixture.auth, fixturePool, p.email, PW, ua);
  expect(r.ok, "ログインできる").toBe(true);
  return r.token!;
};
/** 運営の人がパスキーで入る（K-944：運営の人のパスワードの道は 403・E-AUTH-022。部品の口でチャレンジ → 応答）。返すのはセッションの印 */
const loginOps = async (p: Person) => {
  const key = OPS_KEYS.get(p.userId)!;
  const o = { ip: nextIp(), headers: { origin: config.webBaseUrl } };
  const opt = await req("GET", "/api/auth/passkey/generate-authenticate-options", undefined, o);
  expect(opt.status, await opt.clone().text()).toBe(200);
  const j = await json(opt);
  key.n += 1;
  const r = await req(
    "POST",
    "/api/auth/passkey/verify-authentication",
    { response: passkeyAssertion(key.a, p.userId, String(j["challenge"]), key.n) },
    { ip: o.ip, headers: { ...o.headers, "x-passkey-challenge": String(j["challenge_token"]) } },
  );
  expect(r.status, await r.clone().text()).toBe(200);
  const t = r.headers.get("set-auth-token");
  expect(t, "運営の人のセッションの印").toBeTruthy();
  return t!;
};
const other = (token: string) => req("GET", OTHER_API, undefined, { headers: bearer(token) });
const consent = (token: string | null, body: unknown) =>
  req("POST", CONSENT, body, { headers: token ? bearer(token) : {} });
const agreeTo = (v: { terms: string; privacy: string }) => ({
  agree: true,
  terms_version_id: v.terms,
  privacy_version_id: v.privacy,
});
const consentsOf = async (userId: string) =>
  (
    await admin.query<{
      terms_version_id: string;
      agreed_at: Date;
      ip: string | null;
      tenant_id: string;
      member_id: string;
    }>(
      "select terms_version_id, agreed_at, host(ip) as ip, tenant_id, member_id from terms_consents where auth_user_id = $1 and deleted_at is null",
      [userId],
    )
  ).rows;
/** 止まっていることを確かめる（403・同意し直しが要る） */
const expectBlocked = async (token: string) => {
  const r = await other(token);
  expect(r.status, await r.clone().text()).toBe(403);
  const j = await json(r);
  expect(j["code"]).toBe(NEW_TERMS_REQUIRED);
  expect(j["message"]).toBe(MSG_REQUIRED);
};
const expectOpen = async (token: string) => {
  const r = await other(token);
  expect(r.status, await r.clone().text()).toBe(200);
};
type Item = { id: string; kind: string; version: string; url: string; published_at: string };
const current = async () => {
  const r = await req("GET", CURRENT);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await json(r)).data as Item[];
};

/** 本人の PC を 1 台つなぐ（K-57 の契約の口：画面のログインでコードを出し、Bridge がそのコードを引き取る）。返す token は PC の印（x-bridge-session に載せる） */
const pairPc = async (web: string, label: string) => {
  const code = await req("POST", "/api/v1/bridge/pairing-codes", {}, { headers: bearer(web) });
  expect(code.status, await code.clone().text()).toBe(201);
  const c = ((await json(code)).data as { code: string }).code;
  const claim = await req("POST", "/api/v1/bridge/claim", { code: c, device_label: label });
  expect(claim.status, await claim.clone().text()).toBe(201);
  const d = (await json(claim)).data as { device_token: string; device_id: string };
  return { token: d.device_token, deviceId: d.device_id };
};

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 3 });
  appRole = new pg.Pool({ connectionString: APP_URL, max: 1 });
  opsTenant = (await admin.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
  base.terms = await publish("terms", "base");
  base.privacy = await publish("privacy", "base");
  const seams: Seams = { bucketExists: async () => true, mail: fakeMail, outboundFetch: fakeFetch };
  app = await bootApi(config, seams);
  fixturePool = createPool({ databaseUrl: APP_URL, max: 2 });
  authFixture = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool: fixturePool,
    secret: config.authSecret,
    baseURL: config.baseUrl,
  });
}, 60_000);

afterAll(async () => {
  const mine = "select id from terms_versions where version like $1";
  await admin?.query(`delete from terms_consents where terms_version_id in (${mine})`, [`${RUN}-%`]);
  await admin?.query("delete from kaname_auth.pending_signup where email like $1", [`${RUN}-%`]);
  await admin?.query("delete from terms_versions where version like $1", [`${RUN}-%`]);
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await appRole?.end();
  await admin?.end();
});

describe("K-53 規約に同意する：同意の状態 × 入口 × 利用者の状態", () => {
  it("K53-API-001 今の版に同意済み × ログインする：印は立たず、そのまま入る（同意し直しの画面を出さない）", async () => {
    const p = await person("agreed");
    const t = await login(p);
    await expectOpen(t);
    const s = await admin.query<{ terms_pending: boolean }>(
      "select terms_pending from sessions where member_id = $1 and revoked_at is null",
      [p.memberId],
    );
    expect(s.rows.map((x) => x.terms_pending)).toEqual([false]);
  });

  it(`K53-API-002 古い版だけ（新しい版が出た）× ログインする：セッションに印が立ち、ふつうの口は 403・${NEW_TERMS_REQUIRED}`, async () => {
    const p = await person("old-login");
    const v = await publishBoth("v2-login");
    try {
      const t = await login(p);
      const s = await admin.query<{ terms_pending: boolean }>(
        "select terms_pending from sessions where member_id = $1 and revoked_at is null",
        [p.memberId],
      );
      expect(s.rows.map((x) => x.terms_pending)).toEqual([true]);
      await expectBlocked(t);
      const pend = await admin.query<{ id: string }>("select * from app.terms_pending($1)", [p.userId]);
      expect(pend.rows.map((x) => x.id).sort()).toEqual([v.terms, v.privacy].sort());
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-003 古い版だけ × 版が出る前から開いていた画面で操作を続ける：そのまま使える。次のログインで聞く（D-125.162）", async () => {
    const p = await person("open-before");
    const before = await login(p);
    const v = await publishBoth("v2-open");
    try {
      await expectOpen(before);
      const next = await login(p);
      await expectBlocked(next);
      await expectOpen(before);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-004 古い版だけ（印が立っている）× 同意する：版ごとに同意の行（版・時刻・IP）が足され、印が下り、ふつうの口が通る。同意の行はアプリから直せない・消せない", async () => {
    const p = await person("consent");
    const v = await publishBoth("v2-consent");
    try {
      const t = await login(p);
      await expectBlocked(t);
      const r = await req("POST", CONSENT, agreeTo(v), { ip: "192.0.2.53", headers: bearer(t) });
      expect(r.status, await r.clone().text()).toBe(201);
      const rows = (await consentsOf(p.userId)).filter((x) => [v.terms, v.privacy].includes(x.terms_version_id));
      expect(rows).toHaveLength(2);
      for (const x of rows) {
        expect(x.ip).toBe("192.0.2.53");
        expect(x.member_id).toBe(p.memberId);
        expect(Math.abs(new Date(x.agreed_at).getTime() - Date.now())).toBeLessThan(60_000);
      }
      await expectOpen(t);
      await expect(
        appRole.query("update terms_consents set agreed_at = now() where auth_user_id = $1", [p.userId]),
      ).rejects.toThrow(/permission denied/);
      await expect(appRole.query("delete from terms_consents where auth_user_id = $1", [p.userId])).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-005 古い版だけ（印が立っている）× 他の口を直に呼ぶ：403 で副作用は起きない。規約の 2 つの口・ログアウト・自分の取得は止めない（契約の口・前の道すじ・認証の部品の口 /api/auth/* の 3 か所の入口）", async () => {
    const p = await person("gate");
    const v = await publishBoth("v2-gate");
    try {
      const t = await login(p);
      const auditBefore = Number(
        (await admin.query<{ n: string }>("select count(*) as n from audit_events where tenant_id = $1", [p.tenantId]))
          .rows[0]!.n,
      );
      // 契約の口
      await expectBlocked(t);
      const w = await req("POST", "/api/v1/conversations", { title: "止まるはず" }, { headers: bearer(t) });
      expect(w.status).toBe(403);
      expect((await json(w))["code"]).toBe(NEW_TERMS_REQUIRED);
      // 前の道すじ（apps/api/src/auth/ext.ts の resolve）
      const ext = await req("GET", "/api/auth-ext/setup-state", undefined, { headers: bearer(t) });
      expect(ext.status).toBe(403);
      expect((await json(ext))["code"]).toBe(NEW_TERMS_REQUIRED);
      // 認証の部品の口（Better Auth の /api/auth/*）も止める：パスワードの変更・ほかのセッションの取り消し・2 段階を入れる
      for (const [path, body] of [
        [
          "/api/auth/change-password",
          { currentPassword: PW, newPassword: "changed-horse-battery-2", revokeOtherSessions: true },
        ],
        ["/api/auth/revoke-other-sessions", {}],
        ["/api/auth/two-factor/enable", { password: PW }],
      ] as const) {
        const r = await req("POST", path, body, { headers: bearer(t) });
        expect(r.status, `${path}: ${await r.clone().text()}`).toBe(403);
        expect((await json(r))["code"], path).toBe(NEW_TERMS_REQUIRED);
      }
      const sameSession = await admin.query<{ n: string }>(
        "select count(*) as n from sessions where member_id = $1 and revoked_at is null",
        [p.memberId],
      );
      expect(Number(sameSession.rows[0]!.n), "取り消しは起きていない").toBe(1);
      expect(
        (await signInWithLock(authFixture.auth, fixturePool, p.email, PW, WEB_UA)).ok,
        "パスワードは変わっていない",
      ).toBe(true);
      // 認証の部品の口のうち、同意し直しの画面に行くまでに要るもの（許可の一覧・K-53 の実装の詳細）は止めない
      const gs = await req("GET", "/api/auth/get-session", undefined, { headers: bearer(t) });
      await expectNotTermsBlocked(gs, "/api/auth/get-session");
      // 止めない口
      expect((await req("GET", CURRENT, undefined, { headers: bearer(t) })).status).toBe(200);
      for (const [method, path] of [
        ["GET", "/api/v1/me"],
        ["GET", "/api/auth-ext/me"],
      ] as const) {
        const r = await req(method, path, undefined, { headers: bearer(t) });
        const code = r.status === 403 ? (await json(r))["code"] : null;
        expect(code, `${path} は同意し直しで止めない`).not.toBe(NEW_TERMS_REQUIRED);
      }
      const after = Number(
        (await admin.query<{ n: string }>("select count(*) as n from audit_events where tenant_id = $1", [p.tenantId]))
          .rows[0]!.n,
      );
      expect(after, "止めた口は何も書かない").toBe(auditBefore);
      const out = await req("POST", "/api/v1/auth/sign-out", {}, { headers: bearer(t) });
      expect(out.status === 403 ? (await json(out))["code"] : null, "ログアウトは止めない").not.toBe(
        NEW_TERMS_REQUIRED,
      );
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-006 古い版だけ × Bridge のセッション（PC の常駐）：印を立てず止めない（D-128.137）。画面のセッションだけ止める", async () => {
    const p = await person("bridge");
    const web = await login(p);
    const pc = await pairPc(web, "K-53 の PC");
    const v = await publishBoth("v2-bridge");
    try {
      const again = await login(p);
      await expectBlocked(again);
      const beat = await req(
        "POST",
        "/api/v1/bridge/heartbeat",
        { health: [], protocol: 4 },
        { headers: { "x-bridge-session": pc.token } },
      );
      expect(beat.status, await beat.clone().text()).toBe(201);
      const s = await admin.query<{ terms_pending: boolean }>("select terms_pending from sessions where id = $1", [
        pc.deviceId,
      ]);
      expect(s.rows[0]?.terms_pending).toBe(false);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K57-API-049 同意し直しが要るセッション × /api/auth/*（認証の部品の口）に PC の印の頭（x-bridge-session）を付ける：PC の印の解決に回らず、画面のログインで解いて 403・E-AUTH-010。パスワードは変わらない（K-57 の withDevice で止めを抜けない）", async () => {
    const p = await person("auth-bridge-header");
    const pc = await pairPc(await login(p), "K-57 の PC（頭）");
    const v = await publishBoth("v2-auth-bridge-header");
    try {
      const t = await login(p);
      await expectBlocked(t);
      // 本人の本物の PC の印・形だけ合う印・形の違う値の 3 つ。どれでも止めを抜けない
      for (const head of [pc.token, `kpc_${"A".repeat(43)}`, "not-a-device-token"]) {
        const r = await req(
          "POST",
          "/api/auth/change-password",
          { currentPassword: PW, newPassword: "changed-horse-battery-9", revokeOtherSessions: true },
          { headers: { ...bearer(t), "x-bridge-session": head } },
        );
        expect(r.status, `${head.slice(0, 8)}: ${await r.clone().text()}`).toBe(403);
        expect((await json(r))["code"], head.slice(0, 8)).toBe(NEW_TERMS_REQUIRED);
      }
      expect(
        (await signInWithLock(authFixture.auth, fixturePool, p.email, PW, WEB_UA)).ok,
        "パスワードは変わっていない（認証の部品に渡していない）",
      ).toBe(true);
      // PC の印そのものは同意し直しの印を見ない（Bridge は止めない・D-128.137）
      const beat = await req(
        "POST",
        "/api/v1/bridge/heartbeat",
        { health: [], protocol: 4 },
        { headers: { "x-bridge-session": pc.token } },
      );
      expect(beat.status, await beat.clone().text()).toBe(201);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-007 同意は人ごとに 1 回（D-128.137）：同意の行は auth_user_id で引き、テナント・member の列では引かない（今の DB は 1 人が 2 つの会社に入れないので、2 つ目の会社は作らずに直に確かめる）", async () => {
    const p = await person("by-user");
    const q = await person("by-user-other"); // 別の会社の人（同意の行を「別の会社の行」として置く先）
    const v = await publishBoth("v2-by-user");
    try {
      // ① 本人の会社・本人の member の行でも、auth_user_id が空なら数えない（テナント・member で引いていない）
      for (const id of [v.terms, v.privacy])
        await admin.query(
          "insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at) values ($1, $2, null, $3, now())",
          [p.tenantId, p.memberId, id],
        );
      const byTenant = await admin.query("select * from app.terms_pending($1)", [p.userId]);
      expect(byTenant.rowCount, "テナント・member の行は数えない").toBe(2);
      await expectBlocked(await login(p));
      // ② 本人の会社の行が無くても、本人の auth_user_id の行があれば聞かない（別の会社の行として入っていても同じ）
      for (const id of [v.terms, v.privacy])
        await admin.query(
          "insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at) values ($1, $2, $3, $4, now())",
          [q.tenantId, q.memberId, p.userId, id],
        );
      const pend = await admin.query("select * from app.terms_pending($1)", [p.userId]);
      expect(pend.rowCount, "人で引く（テナントで引かない）").toBe(0);
      await expectOpen(await login(p));
      // 別の会社の人 q は、自分の auth_user_id の行が無いので聞かれる（行の tenant_id・member_id が q でも数えない）
      expect((await admin.query("select * from app.terms_pending($1)", [q.userId])).rowCount).toBe(2);
      // ③ 本体にテナントの列が出てこない（人で引く形のまま）
      const def = (
        await admin.query<{ d: string }>("select pg_get_functiondef('app.terms_pending(text)'::regprocedure) as d")
      ).rows[0]!.d;
      expect(def).toMatch(/auth_user_id\s*=\s*p_auth_user_id/);
      expect(def, "テナント・member の列で引かない").not.toMatch(/\b(tenant_id|member_id)\b/);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-008 登録のときの版が今の版 × 確認のメールで確定した直後：印は立たず、ふつうの口が通る", async () => {
    const e = email("verify-same");
    const { token } = await putPending(authFixture.pool, MASTER_KEY, {
      email: e,
      name: "確定 する人",
      companyName: `${RUN}-確定社`,
      password: PW,
    });
    await admin.query(
      "update kaname_auth.pending_signup set terms_version_id = $2, privacy_version_id = $3, consented_at = now() where email = $1",
      [e, base.terms, base.privacy],
    );
    const r = await req("POST", "/api/v1/auth/sign-up/verify", { token });
    expect(r.status, await r.clone().text()).toBe(201);
    // 入り方を 1 つ持つ人にする（確定の直後の人には付けるまで進めないの印が立つ・K-321 の止めに当てない。ここで見るのは同意し直しの印）
    const uid = (await admin.query<{ id: string }>('select id from kaname_auth."user" where email = $1', [e])).rows[0]!
      .id;
    await addTestEntry(uid);
    await expectOpen(String((((await json(r)).data ?? {}) as Record<string, unknown>)["token"]));
  });

  it("K53-API-009 登録のときの版が古い（登録と確定の間に新しい版が出た）× 確定した直後：印が立ち、同意し直しが要る", async () => {
    const e = email("verify-stale");
    const { token } = await putPending(authFixture.pool, MASTER_KEY, {
      email: e,
      name: "確定 する人",
      companyName: `${RUN}-確定社`,
      password: PW,
    });
    await admin.query(
      "update kaname_auth.pending_signup set terms_version_id = $2, privacy_version_id = $3, consented_at = now() where email = $1",
      [e, base.terms, base.privacy],
    );
    const v = await publishBoth("v2-verify");
    try {
      const r = await req("POST", "/api/v1/auth/sign-up/verify", { token });
      expect(r.status, await r.clone().text()).toBe(201);
      await expectBlocked(String((((await json(r)).data ?? {}) as Record<string, unknown>)["token"]));
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-010 版が 1 つも出ていない状態を作らない（D-128.137）：運営の版を全部取り下げても、migration の種の第 1 版（利用規約・プライバシーポリシー）が今の版として残る", async () => {
    const seeds = await admin.query<{ kind: string }>(
      "select kind from terms_versions where tenant_id = $1 and deleted_at is null and version not like 'k5%' and published_at <= now() and kind in ('terms','privacy') group by kind",
      [opsTenant],
    );
    expect(seeds.rows.map((x) => x.kind).sort(), "種の第 1 版").toEqual(["privacy", "terms"]);
    const rows = await admin.query<{ kind: string }>("select kind from app.current_terms()");
    expect(rows.rows.map((x) => x.kind)).toEqual(expect.arrayContaining(["terms", "privacy"]));
    // 版が無いときは登録を通さない（D-128.146・同意の記録が空の人を作らない）。運営の版を全部取り下げて確かめ、終わったら戻す
    const live = (
      await admin.query<{ id: string }>(
        "update terms_versions set deleted_at = now() where tenant_id = $1 and deleted_at is null and kind in ('terms','privacy') returning id",
        [opsTenant],
      )
    ).rows.map((x) => x.id);
    const e = email("no-version");
    try {
      expect((await admin.query("select * from app.current_terms() where kind in ('terms','privacy')")).rowCount).toBe(
        0,
      );
      const out: string[] = [];
      const spies = (["log", "info", "warn", "error"] as const).map((k) =>
        vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
      );
      let r: Response;
      try {
        r = await req("POST", SIGNUP, { email: e, name: "版 無し", company_name: "", password: PW });
      } finally {
        for (const s of spies) s.mockRestore();
      }
      expect(r.status, await r.clone().text()).toBeGreaterThanOrEqual(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      const log = out.join("\n");
      expect(log, "運営が気づけるように「規約の版が無い」をログに出す").toContain("規約の版が無い");
      expect(log, "ログにメールアドレスを出さない").not.toContain(e);
      expect(log).not.toContain(e.split("@")[0]!);
      expect(
        (await admin.query("select 1 from kaname_auth.pending_signup where email = $1", [e])).rowCount,
        "申し込みを置かない",
      ).toBe(0);
      expect(
        mails.filter((m) => m.to === e),
        "確認のメールを送らない",
      ).toHaveLength(0);
    } finally {
      await admin.query("update terms_versions set deleted_at = null where id = any($1::uuid[])", [live]);
    }
  });

  it("K53-API-011 公開の時刻を先にした版（公開前）：まだ今の版にならない。時刻を過ぎると今の版になる", async () => {
    const id = await publish("terms", "future", "now() + interval '1 hour'");
    try {
      expect((await current()).find((x) => x.kind === "terms")!.id).toBe(base.terms);
      await admin.query("update terms_versions set published_at = now() - interval '1 second' where id = $1", [id]);
      expect((await current()).find((x) => x.kind === "terms")!.id).toBe(id);
    } finally {
      await withdraw(id);
    }
  });

  it("K53-API-012 取り下げた版（deleted_at）：1 つ前の版が今の版に戻る。その版に同意済みなら聞き直さない。取り下げた版への同意の行は残る", async () => {
    const p = await person("withdrawn");
    const v = await publishBoth("v2-withdrawn");
    const t = await login(p);
    expect((await consent(t, agreeTo(v))).status).toBe(201);
    await withdraw(v.terms, v.privacy);
    const now = await current();
    expect(now.find((x) => x.kind === "terms")!.id).toBe(base.terms);
    expect(now.find((x) => x.kind === "privacy")!.id).toBe(base.privacy);
    await expectOpen(await login(p));
    const kept = (await consentsOf(p.userId)).map((x) => x.terms_version_id);
    expect(kept).toEqual(expect.arrayContaining([v.terms, v.privacy]));
  });

  it(`K53-API-013 取り下げた版 × その版を出していた画面で同意する：409・${NEW_TERMS_STALE}。今の版を出し直す`, async () => {
    const p = await person("stale-withdrawn");
    const v = await publishBoth("v2-stale-w");
    const t = await login(p);
    await withdraw(v.terms, v.privacy);
    const r = await consent(t, agreeTo(v));
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(NEW_TERMS_STALE);
    const cur = (j["current"] as Item[] | undefined) ?? [];
    expect(cur.map((x) => x.id).sort()).toEqual([base.terms, base.privacy].sort());
    expect((await consentsOf(p.userId)).map((x) => x.terms_version_id)).not.toContain(v.terms);
  });

  it(`K53-API-014 同意し直しの画面を開いた後に、さらに新しい版が出た × 古い版のまま押す：409・${NEW_TERMS_STALE}。新しい版を出し直す`, async () => {
    const p = await person("stale-newer");
    const v2 = await publishBoth("v2-stale-n");
    const t = await login(p);
    const v3 = await publishBoth("v3-stale-n");
    try {
      const r = await consent(t, agreeTo(v2));
      expect(r.status).toBe(409);
      const j = await json(r);
      expect(j["code"]).toBe(NEW_TERMS_STALE);
      expect(((j["current"] as Item[] | undefined) ?? []).map((x) => x.id).sort()).toEqual(
        [v3.terms, v3.privacy].sort(),
      );
      await expectBlocked(t);
    } finally {
      await withdraw(v2.terms, v2.privacy, v3.terms, v3.privacy);
    }
  });

  it("K53-API-015 今の版に同意済み × 古いタブに残った同意し直しの画面で同意を押す：2 行目を作らず、そのまま通す（2xx）", async () => {
    const p = await person("old-tab");
    const v = await publishBoth("v2-old-tab");
    try {
      const t = await login(p);
      expect((await consent(t, agreeTo(v))).status).toBe(201);
      const r = await consent(t, agreeTo(v));
      expect(r.status).toBeLessThan(300);
      const rows = (await consentsOf(p.userId)).filter((x) => [v.terms, v.privacy].includes(x.terms_version_id));
      expect(rows).toHaveLength(2);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-016 どれでも × 今の版を読む（登録の画面のリンク）× ログインしていない：読める。kind・版・url・公開の時刻・id だけを返す（作った人・運営のテナントの ID を返さない）", async () => {
    const tk = await publish("tokushoho", "tokushoho");
    try {
      const items = await current();
      const kinds = items.map((x) => x.kind).sort();
      expect(kinds).toEqual(["privacy", "terms", "tokushoho"]);
      for (const x of items) expect(Object.keys(x).sort()).toEqual(["id", "kind", "published_at", "url", "version"]);
      const t = items.find((x) => x.kind === "terms")!;
      expect(t).toMatchObject({
        id: base.terms,
        version: `${RUN}-base`,
        url: `https://kaname.example/terms/${RUN}-base`,
      });
      const text = JSON.stringify(items);
      expect(text).not.toContain(opsTenant);
    } finally {
      await withdraw(tk);
    }
  });

  it("K53-API-017 同意の口 × ログインしていない・退会や停止の後：401・入り直しの案内。何も書かない", async () => {
    const p = await person("no-session");
    const t = await login(p);
    const before = (await consentsOf(p.userId)).length;
    const anon = await consent(null, agreeTo(base));
    expect(anon.status).toBe(401);
    await admin.query("select app.revoke_all_sessions($1, 'suspended')", [p.memberId]);
    const gone = await consent(t, agreeTo(base));
    expect(gone.status).toBe(401);
    expect((await consentsOf(p.userId)).length).toBe(before);
  });
});

describe("K-53 入力", () => {
  it(`K53-API-018 同意の印（チェック）が無い：422・${NEW_TERMS_NO_AGREE}・欄は agree。何も書かない`, async () => {
    const p = await person("no-agree");
    const v = await publishBoth("v2-no-agree");
    try {
      const t = await login(p);
      for (const agree of [undefined, false, "yes"]) {
        const body: Record<string, unknown> = { ...agreeTo(v), agree };
        if (agree === undefined) delete body["agree"];
        const r = await consent(t, body);
        expect(r.status, String(agree)).toBe(422);
        const j = await json(r);
        expect(j["code"]).toBe(NEW_TERMS_NO_AGREE);
        const fields = ((j["details"] as { field?: string }[] | undefined) ?? []).map((x) => x.field);
        expect(fields).toContain("agree");
      }
      expect((await consentsOf(p.userId)).map((x) => x.terms_version_id)).not.toContain(v.terms);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-019 版の ID が空・形が違う・無い版の ID：422・項目ごとの理由", async () => {
    const p = await person("bad-id");
    const t = await login(p);
    for (const [why, body, field] of [
      ["空", { agree: true, terms_version_id: "", privacy_version_id: base.privacy }, "terms_version_id"],
      [
        "形が違う",
        { agree: true, terms_version_id: base.terms, privacy_version_id: "not-a-uuid" },
        "privacy_version_id",
      ],
      [
        "無い版",
        { agree: true, terms_version_id: "0193c5a0-0000-7000-8000-000000000000", privacy_version_id: base.privacy },
        "terms_version_id",
      ],
    ] as const) {
      const r = await consent(t, body);
      expect(r.status, why).toBe(422);
      const fields = (((await json(r))["details"] as { field?: string }[] | undefined) ?? []).map((x) => x.field);
      expect(fields, why).toContain(field);
    }
  });

  it("K53-API-020 利用規約だけ・プライバシーポリシーだけの ID を送る：422。同意が要る今の版が全部揃っていないと受けない（特商法の表示は要らない）", async () => {
    const p = await person("half");
    const v = await publishBoth("v2-half");
    try {
      const t = await login(p);
      expect((await consent(t, { agree: true, terms_version_id: v.terms })).status).toBe(422);
      expect((await consent(t, { agree: true, privacy_version_id: v.privacy })).status).toBe(422);
      expect((await consent(t, { agree: true, terms_version_id: v.terms, privacy_version_id: v.terms })).status).toBe(
        422,
      );
      expect((await consentsOf(p.userId)).map((x) => x.terms_version_id)).not.toContain(v.terms);
      await expectBlocked(t);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-021 他のテナント・他の人の ID を体に入れる：知らない項目なので 422（入力の形は契約で知らない項目を許さない・D-129.42・K-144）。同意の行はどちらにも書かない", async () => {
    const me = await person("me");
    const them = await person("them");
    const v = await publishBoth("v2-ids");
    try {
      const t = await login(me);
      for (const extra of [{ tenant_id: them.tenantId }, { member_id: them.memberId }, { auth_user_id: them.userId }]) {
        const r = await consent(t, { ...agreeTo(v), ...extra });
        expect(r.status, JSON.stringify(extra)).toBe(422);
      }
      expect((await consentsOf(me.userId)).map((x) => x.terms_version_id)).not.toContain(v.terms);
      expect((await consentsOf(them.userId)).map((x) => x.terms_version_id)).not.toContain(v.terms);
      // 知らない項目を外せば、自分の同意として書く（テナントと人はセッションから決める）
      const ok = await consent(t, agreeTo(v));
      expect(ok.status, await ok.clone().text()).toBe(201);
      const mine = (await consentsOf(me.userId)).filter((x) => x.terms_version_id === v.terms);
      expect(mine).toHaveLength(1);
      expect(mine[0]!.tenant_id).toBe(me.tenantId);
      expect(mine[0]!.member_id).toBe(me.memberId);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-022 今の版を読む口に一覧の引数（cursor・limit・sort・scope_id）を付ける：形が違えば 422、正しければ無視して今の版を返す", async () => {
    const good = await req(
      "GET",
      `${CURRENT}?limit=1&cursor=0&sort=version&scope_id=0193c5a0-0000-7000-8000-000000000000`,
    );
    expect(good.status).toBe(200);
    expect(((await json(good)).data as Item[]).map((x) => x.kind)).toEqual(
      expect.arrayContaining(["terms", "privacy"]),
    );
    for (const q of ["limit=0", "limit=abc", "cursor=-1", "sort=drop%20table", "scope_id=x"]) {
      const r = await req("GET", `${CURRENT}?${q}`);
      expect(r.status, q).toBe(422);
    }
  });
});

describe("K-53 時間の流れ・失敗", () => {
  it("K53-API-023 公開の時刻の直前・ちょうど・直後にログインする：直前は聞かない、ちょうどと直後は聞く（DB の now() で比べる）", async () => {
    const p = await person("edge");
    const v = await publishBoth("v2-edge", "now() + interval '1 hour'");
    try {
      await expectOpen(await login(p)); // 直前
      await admin.query("update terms_versions set published_at = now() where id = any($1::uuid[])", [
        [v.terms, v.privacy],
      ]);
      await expectBlocked(await login(p)); // ちょうど（published_at = その時の now()）
      await admin.query(
        "update terms_versions set published_at = now() - interval '1 second' where id = any($1::uuid[])",
        [[v.terms, v.privacy]],
      );
      await expectBlocked(await login(p)); // 直後
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-024 同意の行は入ったが、印を下ろす所で失敗：両方戻る（1 つのトランザクション）。500・E-PAGE-003。もう一度押せる", async () => {
    const p = await person("rollback");
    const v = await publishBoth("v2-rollback");
    const t = await login(p);
    await admin.query(`create or replace function public.k53_fail() returns trigger language plpgsql as $$
      begin
        if old.member_id = '${p.memberId}'::uuid and new.terms_pending is distinct from old.terms_pending then
          raise exception 'K-53 の試験：印を下ろせない';
        end if;
        return new;
      end $$`);
    await admin.query(
      "create trigger k53_fail before update on sessions for each row execute function public.k53_fail()",
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await consent(t, agreeTo(v));
      expect(r.status).toBe(500);
      const text = await r.text();
      expect((JSON.parse(text) as Record<string, unknown>)["code"]).toBe("E-PAGE-003");
      expect(text).not.toContain("K-53 の試験");
      expect(
        (await consentsOf(p.userId)).map((x) => x.terms_version_id),
        "同意の行も戻る",
      ).not.toContain(v.terms);
    } finally {
      spy.mockRestore();
      await admin.query("drop trigger if exists k53_fail on sessions");
      await admin.query("drop function if exists public.k53_fail()");
    }
    try {
      expect((await consent(t, agreeTo(v))).status).toBe(201);
      await expectOpen(t);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });
});

describe("K-53 操作の揺れ・守り", () => {
  it("K53-API-025 2 回押し：同意の行は版ごとに 1 つ", async () => {
    const p = await person("double");
    const v = await publishBoth("v2-double");
    try {
      const t = await login(p);
      expect((await consent(t, agreeTo(v))).status).toBe(201);
      expect((await consent(t, agreeTo(v))).status).toBeLessThan(300);
      const rows = (await consentsOf(p.userId)).filter((x) => [v.terms, v.privacy].includes(x.terms_version_id));
      expect(rows).toHaveLength(2);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-026 2 つのタブで同時に同意する：同意の行は版ごとに 1 つ（索引で止める）。どちらも 2xx", async () => {
    const p = await person("tabs");
    const v = await publishBoth("v2-tabs");
    try {
      const t = await login(p);
      const rs = await Promise.all([consent(t, agreeTo(v)), consent(t, agreeTo(v)), consent(t, agreeTo(v))]);
      for (const r of rs) expect(r.status, await r.clone().text()).toBeLessThan(300);
      const rows = (await consentsOf(p.userId)).filter((x) => [v.terms, v.privacy].includes(x.terms_version_id));
      expect(rows).toHaveLength(2);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-027 同意の口を 1 分に 61 回（同じ人）：61 回目は 429・待つ秒数（retry_after_sec）", async () => {
    const p = await person("rate-consent");
    const t = await login(p);
    for (let i = 0; i < 60; i++) {
      const r = await consent(t, agreeTo(base));
      expect(r.status, `${i + 1} 回目は上限の内`).not.toBe(429);
    }
    const r = await consent(t, agreeTo(base));
    expect(r.status).toBe(429);
    expect(Number((await json(r))["retry_after_sec"])).toBeGreaterThan(0);
  }, 60_000); // 何十回も続けて口を呼ぶ送りすぎの確かめ（重い台でも既定の 5 秒で切らない）

  it("K53-API-028 今の版を読む口を 1 分に 11 回（同じ IP）：11 回目は 429・待つ秒数", async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      const r = await req("GET", CURRENT, undefined, { ip });
      expect(r.status, `${i + 1} 回目`).toBe(200);
    }
    const r = await req("GET", CURRENT, undefined, { ip });
    expect(r.status).toBe(429);
    expect(Number((await json(r))["retry_after_sec"])).toBeGreaterThan(0);
  });

  it("K53-API-029 記録とログ：同意した版・時刻・IP が DB に残り、ログには IP もメールも出ない", async () => {
    const p = await person("log");
    const v = await publishBoth("v2-log");
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    try {
      const t = await login(p);
      out.length = 0; // ログインのところ（ログインするのチケット）は数えない
      const r = await req("POST", CONSENT, agreeTo(v), { ip: "192.0.2.199", headers: bearer(t) });
      expect(r.status).toBe(201);
    } finally {
      for (const s of spies) s.mockRestore();
      await withdraw(v.terms, v.privacy);
    }
    const rows = (await consentsOf(p.userId)).filter((x) => x.terms_version_id === v.terms);
    expect(rows[0]?.ip).toBe("192.0.2.199");
    const all = out.join("\n");
    for (const secret of ["192.0.2.199", p.email, p.email.split("@")[0]!]) expect(all).not.toContain(secret);
  });

  it("K53-API-030 関門：振る舞いは apps/api/src/features/F1/consent-terms/ にあり、書くのは関門 C2（withTenant）だけ（生の pg を直に使わない）", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p);
      }
    };
    expect(() => walk(FEATURE_DIR), "apps/api/src/features/F1/consent-terms/ がある").not.toThrow();
    expect(files.length).toBeGreaterThan(0);
    const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/from\s+["']pg["']/);
    expect(src).toMatch(/withTenant/);
  });

  it("K53-API-031 同意し直しの印が立つのは同意が要る 2 つ（利用規約・プライバシーポリシー）だけ：特商法の表示の新しい版では聞かない（D-128.137）", async () => {
    const p = await person("tokushoho-only");
    const tk = await publish("tokushoho", "tk-only");
    try {
      await expectOpen(await login(p));
    } finally {
      await withdraw(tk);
    }
  });
});

describe("K-53 精査で足した行（DB が落ちた・2 段階の後のログイン）", () => {
  it("K53-API-032 古い版だけ × 2 段階認証の後のログイン（パスワード → 6 けた）：その時にできたセッションにも印が立ち、ふつうの口は 403", async () => {
    const p = await person("two-factor");
    const t = await login(p);
    const h = new Headers({ authorization: `Bearer ${t}`, "user-agent": WEB_UA });
    const { totpURI } = await enableTotp(authFixture.auth, h, PW);
    const secret = new URL(totpURI).searchParams.get("secret")!;
    await verifyTotp(authFixture.auth, h, totp(secret)); // 有効化の確認
    const v = await publishBoth("v2-2fa");
    try {
      const si = await signIn(authFixture.auth, p.email, PW, WEB_UA);
      expect(si.twoFactor).toBe(true);
      const done = await verifyTotp(
        authFixture.auth,
        new Headers({ cookie: si.cookie, "user-agent": WEB_UA }),
        totp(secret, Date.now() + 30_000),
      );
      await expectBlocked(done.token);
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-035 施行日のそろい：ひな形（apps/web/content/legal/<kind>-v1.md）の施行日の行と、migration の種の第 1 版の published_at（日本時間の日付）が同じ", async () => {
    for (const kind of ["terms", "privacy"] as const) {
      const md = readFileSync(join(HERE, "..", "..", "..", "..", "web", "content", "legal", `${kind}-v1.md`), "utf8");
      const m = /^<!-- 施行日：(\d{4}-\d{2}-\d{2}) -->$/m.exec(md);
      expect(m, `${kind}-v1.md に施行日の行（<!-- 施行日：YYYY-MM-DD -->）がある`).not.toBeNull();
      const seed = await admin.query<{ d: string }>(
        "select to_char(published_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD') as d from terms_versions where tenant_id = $1 and kind = $2 and version = '1' order by created_at limit 1",
        [opsTenant, kind],
      );
      expect(seed.rows[0]?.d, `${kind} の種の第 1 版の公開日がひな形の施行日と同じ`).toBe(m![1]);
    }
  });

  it("K53-API-034 同意の口 × PC の印（Bridge のセッション）で呼ぶ：本人のログインではなく PC（device の役）なので 403（役が合わない）。同意の行は書かない", async () => {
    const p = await person("pc-consent");
    const web = await login(p);
    const pc = await pairPc(web, "K-53 の PC（同意）");
    const before = (await consentsOf(p.userId)).length;
    const r = await req("POST", CONSENT, agreeTo(base), { headers: { "x-bridge-session": pc.token } });
    // 契約の入口は PC の印を device の役に解く（K-57・apps/api/src/server.ts の withDevice）。同意の口は本人の口なので device は役が合わない＝ 403
    expect(r.status, await r.clone().text()).toBe(403);
    expect((await json(r))["code"], "同意し直しの止めではなく、役の止め").not.toBe(NEW_TERMS_REQUIRED);
    expect((await consentsOf(p.userId)).length, "何も書かない").toBe(before);
  });

  it("K53-API-033 DB が落ちた（今の版が読めない）：今の版を読む口は 500・E-PAGE-003。中身（版・url）を返さない", async () => {
    // 今の版の関数が読む表を読めなくする（関数を差し替えずに、表の読みを落とす。試験は直列・DB の排他の中なので他の試験に響かない）
    await admin.query("alter table terms_versions rename to terms_versions_k53_down");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await req("GET", CURRENT);
      expect(r.status).toBe(500);
      const text = await r.text();
      expect((JSON.parse(text) as Record<string, unknown>)["code"]).toBe("E-PAGE-003");
      expect(text).not.toContain("terms_versions");
      expect(text).not.toContain("kaname.example");
    } finally {
      spy.mockRestore();
      await admin.query("alter table terms_versions_k53_down rename to terms_versions");
    }
    expect((await req("GET", CURRENT)).status, "戻すと読める").toBe(200);
  });
});

/** TOTP（RFC 6238・SHA1・30 秒・6 桁）。認証アプリの代わり（apps/api/test/auth_ext.test.ts と同じ作り） */
function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, ""))
    bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const off = h[h.length - 1]! & 0xf;
  const code =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

describe("K-53 運営の人は同意し直しで止めない（D-128.172）", () => {
  it("K53-API-036 古い版だけ × 運営の人（運営のテナントの人）がログインする：印は立たず、契約のふつうの口・運営の口・前の道すじのどれも E-AUTH-010 で止まらない", async () => {
    const o = await opsPerson("ops-open");
    const v = await publishBoth("v2-ops-open");
    try {
      expect((await admin.query("select * from app.terms_pending($1)", [o.userId])).rowCount, "同意はまだ").toBe(2);
      const t = await loginOps(o);
      const s = await admin.query<{ terms_pending: boolean }>(
        "select terms_pending from sessions where member_id = $1 and revoked_at is null",
        [o.memberId],
      );
      expect(
        s.rows.map((x) => x.terms_pending),
        "運営の人のセッションには印を立てない",
      ).toEqual([false]);
      await expectOpsNotTermsBlocked(await other(t), "契約のふつうの口");
      await expectOpsNotTermsBlocked(await req("GET", OPS_API, undefined, { headers: bearer(t) }), "運営の口");
      await expectNotTermsBlocked(
        await req("GET", "/api/auth-ext/setup-state", undefined, { headers: bearer(t) }),
        "前の道すじ",
      );
      // 運営のセッションは会社なし（role ops・K-944）なので、会社の人の同意の口（auth member）には役の段で届かない。同意し直しでは止めない
      await expectOpsNotTermsBlocked(await consent(t, agreeTo(v)), "同意の口");
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-037 対照：同じ新しい版で、会社の利用者は止まり、運営の人は止まらない（D-128.172）", async () => {
    const p = await person("ops-contrast-company");
    const o = await opsPerson("ops-contrast-ops");
    const v = await publishBoth("v2-ops-contrast");
    try {
      const tp = await login(p);
      const to = await loginOps(o);
      await expectBlocked(tp);
      const w = await req("GET", "/api/auth-ext/setup-state", undefined, { headers: bearer(tp) });
      expect(w.status).toBe(403);
      expect((await json(w))["code"]).toBe(NEW_TERMS_REQUIRED);
      await expectOpsNotTermsBlocked(await other(to), "契約のふつうの口");
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-038 運営の人のセッション × 決め直し・手で立てた印：決め直し（refresh）でも印は立たず、列を手で true にしても止まらない（守りの 2 層目）", async () => {
    const o = await opsPerson("ops-layer");
    const v = await publishBoth("v2-ops-layer");
    try {
      const t = await loginOps(o);
      await appRole.query("select app.refresh_terms_pending($1)", [o.userId]);
      const after = await admin.query<{ terms_pending: boolean }>(
        "select terms_pending from sessions where member_id = $1 and revoked_at is null",
        [o.memberId],
      );
      expect(
        after.rows.map((x) => x.terms_pending),
        "決め直しでも立てない",
      ).toEqual([false]);
      await admin.query("update sessions set terms_pending = true where member_id = $1 and revoked_at is null", [
        o.memberId,
      ]);
      const sid = (
        await admin.query<{ id: string }>("select id from sessions where member_id = $1 and revoked_at is null", [
          o.memberId,
        ])
      ).rows[0]!.id;
      const read = await appRole.query<{ p: boolean }>("select app.session_terms_pending($1) as p", [sid]);
      expect(read.rows[0]?.p, "運営のテナントのセッションは常に false").toBe(false);
      await expectOpsNotTermsBlocked(await other(t), "契約のふつうの口");
      await expectOpsNotTermsBlocked(await req("GET", OPS_API, undefined, { headers: bearer(t) }), "運営の口");
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });
});

describe("K-53 テスターのレビュー 2 回目で足した行（招待の受諾の印・入口の止めの fail-closed）", () => {
  it("K53-API-039 古い版だけ × 招待を受けて新しいセッション B ができる・版が出る前から開いていたセッション A がある：A は止まらず（D-125.162）、B も止まらない。招待の受諾（契約の口・K-332）は画面の中で今の版に同意したことにする（続けると同意・K-55）。受諾はその人の全部のセッションを決め直さない（K-337 で前の道すじから契約の口へ移した・切る段で替えた）", async () => {
    const boss = await person("invite-boss");
    const v = await publishBoth("v2-invite");
    const tag = `${RUN}-invite-a`; // 受ける人の名前（下の仕掛けが、この名前の member が入った瞬間だけ動く）
    const fn = `app.k53_seed_session_a_${RUN.replace(/[^a-z0-9]/g, "_")}`;
    // 版が出る前から開いていたセッション A を置く仕掛け。今の DB は 1 人が 2 つの会社に入れず、招待の受諾は認証の人を新しく作るので、
    // 受諾の前から A を持つ人は道すじからは作れない。受諾の中で member が入った瞬間に、同じ人の生きている画面のセッション A
    // （印は下りたまま・発行は 1 時間前）を置き、受諾がその後に A の印を触らないことを見る（終わったら必ず外す・G-10）
    await admin.query(
      `create function ${fn}() returns trigger language plpgsql security definer set search_path = public as $$
       begin
         insert into sessions (tenant_id, member_id, kind_id, auth_session_id, issued_at, last_seen_at, terms_pending)
         values (new.tenant_id, new.id, 'web', '${tag}-session-a', now() - interval '1 hour', now() - interval '1 hour', false);
         return new;
       end $$`,
    );
    await admin.query(
      `create trigger k53_seed_session_a after insert on members for each row when (new.display_name = '${tag}') execute function ${fn}()`,
    );
    try {
      const repo = await createRepository(fixturePool);
      const inv = await createInvitation(
        repo,
        { tenantId: boss.tenantId, userId: boss.memberId, role: "member" },
        { email: email("invite-a"), roleId: "staff" },
      );
      const ac = await req("POST", `/api/v1/auth/invitations/${inv.token}/accept`, { name: tag, password: PW });
      expect(ac.status, await ac.clone().text()).toBe(201);
      const mid = (
        await admin.query<{ id: string }>("select id from members where tenant_id = $1 and display_name = $2", [
          boss.tenantId,
          tag,
        ])
      ).rows[0]!.id;
      const a = await admin.query<{ id: string; terms_pending: boolean }>(
        "select id, terms_pending from sessions where auth_session_id = $1",
        [`${tag}-session-a`],
      );
      expect(a.rows[0]?.terms_pending, "版が出る前から開いていたセッション A は印が下りたまま（D-125.162）").toBe(
        false,
      );
      const readA = await appRole.query<{ p: boolean }>("select app.session_terms_pending($1) as p", [a.rows[0]!.id]);
      expect(readA.rows[0]?.p, "A は止まらない").toBe(false);
      // 受諾でできたセッション B は、受諾が今の版に同意したことにするので止まらない（招待の画面の中で同意・K-55）
      const b = await admin.query<{ terms_pending: boolean }>(
        "select terms_pending from sessions where member_id = $1 and revoked_at is null and auth_session_id <> $2",
        [mid, `${tag}-session-a`],
      );
      expect(
        b.rows.map((x) => x.terms_pending),
        "受諾でできたセッション B は印が下りている",
      ).toEqual([false]);
      const agreed = await admin.query(
        `select 1 from terms_consents c join members m on m.auth_user_id = c.auth_user_id
          where m.id = $1 and c.terms_version_id = any($2::uuid[])`,
        [mid, [v.terms, v.privacy]],
      );
      expect(agreed.rowCount, "今の版の 2 つ（規約・プライバシー）に同意が記録される").toBe(2);
    } finally {
      await admin.query("drop trigger if exists k53_seed_session_a on members");
      await admin.query(`drop function if exists ${fn}()`);
      await withdraw(v.terms, v.privacy);
    }
  });

  it("K53-API-040 入口の止め × セッションを解く所が失敗する（DB の一時的な権限の外し）：止める側に倒す。/api/auth/change-password・契約の口（接続コードを出す）・前の道すじは通さず 503・E-PAGE-003（fail-closed）。パスワードは変わらず、接続コードも作らない", async () => {
    const errors = JSON.parse(
      readFileSync(join(HERE, "..", "..", "..", "..", "..", "07_qa", "test-specs", "errors.json"), "utf8"),
    ) as { errors: { id: string; message: string }[] };
    const down = errors.errors.find((e) => e.id === "E-PAGE-003")!.message;
    const p = await person("fail-closed");
    const t = await login(p);
    const pairsBefore = Number(
      (
        await admin.query<{ n: string }>("select count(*) as n from bridge_pairing_codes where member_id = $1", [
          p.memberId,
        ])
      ).rows[0]!.n,
    );
    // セッションを解く所（packages/auth の resolver が読む app.session_terms_pending）を、アプリの接続から一時的に呼べなくする
    await admin.query("revoke execute on function app.session_terms_pending(uuid) from kaname_app");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const cp = await req(
        "POST",
        "/api/auth/change-password",
        { currentPassword: PW, newPassword: "changed-horse-battery-3", revokeOtherSessions: true },
        { headers: bearer(t) },
      );
      expect(cp.status, `/api/auth/change-password: ${await cp.clone().text()}`).toBe(503);
      const cj = await json(cp);
      expect(cj["code"]).toBe("E-PAGE-003");
      expect(cj["message"]).toBe(down);
      // 契約の口（接続コードを出す・K-57）：入口の解決（withDevice → 画面のログイン）が落ちたら通さない
      const pc = await req("POST", "/api/v1/bridge/pairing-codes", {}, { headers: bearer(t) });
      expect(pc.status, `/api/v1/bridge/pairing-codes: ${await pc.clone().text()}`).toBe(503);
      expect((await json(pc))["code"]).toBe("E-PAGE-003");
      // 前の道すじ（/api/auth-ext の入口の止め）：残っている口（/bridge/state・F5 で移す）でも通さない
      const ext = await req("GET", "/api/auth-ext/bridge/state", undefined, { headers: bearer(t) });
      expect(ext.status, `/api/auth-ext/bridge/state: ${await ext.clone().text()}`).toBe(503);
      expect((await json(ext))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await admin.query("grant execute on function app.session_terms_pending(uuid) to kaname_app");
    }
    expect(
      (await signInWithLock(authFixture.auth, fixturePool, p.email, PW, WEB_UA)).ok,
      "パスワードは変わっていない（認証の部品に渡していない）",
    ).toBe(true);
    const pairsAfter = Number(
      (
        await admin.query<{ n: string }>("select count(*) as n from bridge_pairing_codes where member_id = $1", [
          p.memberId,
        ])
      ).rows[0]!.n,
    );
    expect(pairsAfter, "接続コードを作らない").toBe(pairsBefore);
    // 戻すと、ふつうに通る（止める側に倒すのは解けなかったときだけ）
    await expectOpen(t);
  });
});

describe("K-53 中間テスト（K-54）で見つけた継ぎ目（確定の答えの印）", () => {
  /** 申し込みを置き、登録のときに基準の版に同意した形にする（K53-API-008・009 と同じ作り） */
  const pendingFor = async (tag: string) => {
    const e = email(tag);
    const { token } = await putPending(authFixture.pool, MASTER_KEY, {
      email: e,
      name: "確定 する人",
      companyName: `${RUN}-確定社`,
      password: PW,
    });
    await admin.query(
      "update kaname_auth.pending_signup set terms_version_id = $2, privacy_version_id = $3, consented_at = now() where email = $1",
      [e, base.terms, base.privacy],
    );
    return { e, token };
  };
  const sessionPendingOf = async (e: string) =>
    (
      await admin.query<{ terms_pending: boolean }>(
        `select s.terms_pending from sessions s join members m on m.id = s.member_id
           join kaname_auth."user" u on u.id = m.auth_user_id
          where u.email = $1 and s.revoked_at is null and s.kind_id <> 'bridge'`,
        [e],
      )
    ).rows.map((x) => x.terms_pending);

  it("K53-API-041 確定の答え（verifySignup）に terms_pending が入る：登録と確定の間に新しい版が出ていれば true（このセッションの印と同じ）、登録のときの版が今の版なら false", async () => {
    // 同意済み（登録のときの版が今の版）→ false
    const same = await pendingFor("verify-tp-same");
    const r1 = await req("POST", "/api/v1/auth/sign-up/verify", { token: same.token });
    expect(r1.status, await r1.clone().text()).toBe(201);
    const d1 = ((await json(r1)).data ?? {}) as Record<string, unknown>;
    expect(d1["terms_pending"], "同意済みなら false").toBe(false);
    expect(await sessionPendingOf(same.e), "答えとセッションの印が同じ").toEqual([false]);
    // 版が新しい（登録と確定の間に出た）→ true
    const stale = await pendingFor("verify-tp-stale");
    const v = await publishBoth("v2-verify-tp");
    try {
      const r2 = await req("POST", "/api/v1/auth/sign-up/verify", { token: stale.token });
      expect(r2.status, await r2.clone().text()).toBe(201);
      const d2 = ((await json(r2)).data ?? {}) as Record<string, unknown>;
      expect(d2["terms_pending"], "版が新しいなら true").toBe(true);
      expect(await sessionPendingOf(stale.e), "答えとセッションの印が同じ").toEqual([true]);
      await expectBlocked(String(d2["token"]));
    } finally {
      await withdraw(v.terms, v.privacy);
    }
  });
});
