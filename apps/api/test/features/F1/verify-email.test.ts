// K-52「メールを確かめる」の単体の試験（口・本物の DB）。テストの名前の頭の行 ID（K52-API-…）は 11_tickets/K-52.md の表のマスと分岐に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。
//
// 組み立ては本番と同じ bootApi（apps/api/src/server.ts）。外に出るものは関門の差し込み口だけを差し替える（K-51 と同じ Seams）:
//   ・mail          … 関門 C6 の送出先（@kaname/notify の MailLike）。届いたメールを全部ここに貯める
//   ・outboundFetch … 関門 C1 の外への口。確定では外に出ない。送り直しの試験（K52-API-034）だけ K-51 の登録の口を通るので、
//                     漏れたパスワードの照合（Have I Been Pwned の範囲の問い合わせ）にだけ「漏れていない」と答え、ほかは落とす
// 保留の申し込みは、ふつうは K-51 の口を通さず、既にある部品 putPending（packages/auth/src/pending.ts）で直に作る。
// 送り直し（K-51 の resendSignupEmail → renewPendingLink）で前のリンクが残ることだけは、K-51 の契約の口を通して確かめる（K52-API-034）。
// 時刻は眠らずに、DB の行の期限（expires_at）を DB の now() からずらして進める（D-128.130）。
//
// 試験が決める口の形（契約の口 verifySignup・POST /api/v1/auth/sign-up/verify・誰でも呼べる）:
//   要求の体 { token: string }（確認のメールのリンクの手がかり）。契約の形は K-52 の「契約を直す」の行で直す
//     （05_flow/screen_api.py の INPUTS・RESPONSES → 05_flow/build_api.py → 08_api/openapi.yaml・types.ts → packages/contracts）
//   201 { data: { email, token: string | null, signed_in: boolean } }（user_id は返さない・レビューの L8。本人は試験の道具 userIdOf で DB から引く）
//     ・ふつうは token にログインの印・signed_in=true
//     ・別のアカウントでログイン中（頭 authorization が別の人）に開いたら、確定はするが token=null・signed_in=false（D-128.137）
//   409 E-CONF-011（確定済み）／409 E-CONF-001（別の道で登録済み）／410 E-AUTH-003（期限切れ）／410 E-PAGE-006（無い・でたらめ）／
//   422 E-PAGE-006（手がかりが無い）／500 E-PAGE-003／429 retry_after_sec
//   足すエラー（K-52 が errors.json に足す・D-128.146 の文）
//     NEW_OLD_LINK  … E-AUTH-008 送り直す前の前のリンク（410）
//     NEW_OTHER_ACC … E-AUTH-009 確定済みのリンクを、別のアカウントでログイン中に開いた（409）
//   確定の後に本人へ「【Kaname】登録が完了しました」を 1 通（D-128.146）。2 回押しでも 1 通
// 試験が前提にする DB の形:
//   kaname_auth.pending_signup に replaced_token_hashes text[]（このチケットの migration）
//   kaname_auth.pending_signup に terms_version_id・privacy_version_id・consented_at（K-51 の migration）
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { mailTag, signUp } from "@kaname/auth/signup";
import { createInvitation } from "@kaname/auth/invitations";
import { createRepository } from "@kaname/db/repository";
import { hashPendingToken, putPending, sweepPending } from "@kaname/auth/pending";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { CATALOG } from "@kaname/errors";
import type { Config } from "@kaname/config";
import type { MailLike } from "@kaname/notify";
import { bootApi, type BootOptions } from "../../../src/server.js";
import type * as PendingModule from "@kaname/auth/pending";

// 本人の見分け（パスワードの照合）の差し込み口（4 回目のレビュー MEDIUM-1・K52-API-053〜055）。
//   @kaname/auth/pending の 2 つの部品を、そのまま通す包みに替える（ふだんの振る舞いは変えない）。
//   ・credentialHashOf … 呼ばれた本人の id を数える（照合の分岐に入ったかを確かめる）。throwCredential が立っている間は投げる（照合が例外になる）
//   ・authUserIdByEmail … throwLookupFor のメールで投げる（signUpFailed の e2 の catch）
const probe = vi.hoisted(() => ({
  credentialCalls: [] as string[],
  throwCredential: false,
  throwLookupFor: new Set<string>(),
}));
vi.mock("@kaname/auth/pending", async (importOriginal) => {
  const m = await importOriginal<typeof PendingModule>();
  return {
    ...m,
    credentialHashOf: async (...a: Parameters<typeof m.credentialHashOf>) => {
      probe.credentialCalls.push(a[1]);
      if (probe.throwCredential) throw new Error("K-52 の試験：パスワードのアカウントを読めない");
      return m.credentialHashOf(...a);
    },
    authUserIdByEmail: async (...a: Parameters<typeof m.authUserIdByEmail>) => {
      if (probe.throwLookupFor.has(a[1].toLowerCase())) throw new Error("K-52 の試験：同じメールの本人を引けない");
      return m.authUserIdByEmail(...a);
    },
  };
});

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
const FEATURE_DIR = join(HERE, "..", "..", "..", "src", "features", "F1", "verify-email");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k52@example.com";
const RUN = `k52-${Date.now().toString(36)}`; // この回が作るものの印（終わったら消す・G-10）
const PW = "correct-horse-battery-1";
const VERIFY = "/api/v1/auth/sign-up/verify";
const NEW_OLD_LINK = "E-AUTH-008"; // 足すエラー（前のリンク・D-128.146）
const NEW_OTHER_ACC = "E-AUTH-009"; // 足すエラー（別のアカウントの登録のリンク・D-128.146）
const DONE_SUBJECT = "【Kaname】登録が完了しました"; // 確定の後の 1 通（D-128.146）
const SIGNUP = "/api/v1/auth/sign-up";
const RESEND = "/api/v1/auth/sign-up/resend";
const EXPIRED_MESSAGE = "リンクの期限が切れました。もう一度登録してください"; // E-AUTH-003 を D-088 の 30 分に直した文（K-52 の表）

/** 実装する人が BootOptions に足す差し込み口（K-51 と同じ） */
type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };

// ---- 関門 C6 の偽の送出先 ----
interface SentMail {
  to: string;
  subject: string;
  text: string;
}
const mails: SentMail[] = [];
const failMailTo = new Set<string>();
const fakeMail: MailLike = {
  send: async (m) => {
    if (failMailTo.has(m.to)) return { error: { message: "daily quota exceeded" } };
    mails.push({ to: m.to, subject: m.subject, text: m.text });
    return { error: null };
  },
};
const mailsTo = (email: string, from = 0) => mails.slice(from).filter((m) => m.to === email);
const fakeFetch: typeof fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  // 送り直しの試験（K-51 の登録の口）だけが通る：漏れたパスワードの照合に「どれも漏れていない」と答える
  if (/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/i.test(url))
    return new Response("0018A45C4D1DEF81644B54AB7F969B88D65:3", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  throw new Error(`K-52 の確定は外に出ない: ${url}`);
};
/** 確認のメールの本文からリンクの手がかりを取る */
const linkTokenOf = (m: SentMail) => {
  const u = /https?:\/\/\S+\/verify-email\?token=([^\s&]+)/.exec(m.text);
  if (!u) throw new Error(`確認のリンクが本文に無い: ${m.text}`);
  return decodeURIComponent(u[1]!);
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
let authFixture: ReturnType<typeof createAuth>;
let fixturePool: pg.Pool;
let resolve: ReturnType<typeof createSessionResolver>;
let termsId = "";
let privacyId = "";
let ipSeq = 0;
/** 試験ごとに別の IP（上限の数え方を試験どうしで混ぜない） */
const nextIp = () => `203.0.113.${(ipSeq = (ipSeq % 250) + 1)}`;
const email = (tag: string) => `${RUN}-${tag}@example.com`;
const req = (method: string, path: string, body?: unknown, ip = nextIp(), headers: Record<string, string> = {}) =>
  app.app.request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const verify = (token: unknown, o: { ip?: string; headers?: Record<string, string> } = {}) =>
  req("POST", VERIFY, token === undefined ? {} : { token }, o.ip ?? nextIp(), o.headers ?? {});
const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
const msg = (code: string) => CATALOG[code]?.message ?? `（errors.json に ${code} が無い）`;

/** 保留の申し込みを直に作る（K-51 の口を通さない）。返すのはメールのリンクの手がかり（平文） */
const pend = async (tag: string, o: { name?: string; company?: string; key?: string } = {}) => {
  const r = await putPending(authFixture.pool, o.key ?? MASTER_KEY, {
    email: email(tag),
    name: o.name ?? "高本 聖斗",
    companyName: o.company ?? "株式会社テスト",
    password: PW,
  });
  return r.token;
};
interface PendingRow {
  email: string;
  token_hash: string;
  expires_at: Date;
  consumed_at: Date | null;
  pw_iv: string | null;
  pw_tag: string | null;
  pw_data: string | null;
  replaced_token_hashes: string[];
  [k: string]: unknown;
}
const pending = async (e: string) =>
  (await admin.query<PendingRow>("select * from kaname_auth.pending_signup where email = $1", [e])).rows[0];
const setExpiry = (e: string, sql: string) =>
  admin.query(`update kaname_auth.pending_signup set expires_at = ${sql} where email = $1`, [e]);
const usersOf = async (e: string) =>
  (await admin.query<{ id: string; emailVerified: boolean }>('select * from kaname_auth."user" where email = $1', [e]))
    .rows;
interface MemberRow {
  id: string;
  tenant_id: string;
  scope_id: string;
  display_name: string;
  tenant_name: string;
}
const membersOf = async (userId: string) =>
  (
    await admin.query<MemberRow>(
      "select m.id, m.tenant_id, m.scope_id, m.display_name, t.name as tenant_name from members m join tenants t on t.id = m.tenant_id where m.auth_user_id = $1",
      [userId],
    )
  ).rows;
const liveSessions = async (memberId: string) =>
  Number(
    (
      await admin.query<{ n: string }>(
        "select count(*) as n from sessions where member_id = $1 and revoked_at is null",
        [memberId],
      )
    ).rows[0]!.n,
  );
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
/** 確定した本人の id（答えに user_id を入れないので、メールで DB から引く） */
const userIdOf = async (e: string) => {
  const u = await usersOf(e);
  expect(u, `${e} の本人がいる`).toHaveLength(1);
  return u[0]!.id;
};
/** その印でログインできているか（本物のセッションの解き方で） */
const resolves = async (token: string, ua = "Mozilla/5.0 (K-52 test)") =>
  !!(await resolve(new Headers({ authorization: `Bearer ${token}`, "user-agent": ua })));
/** 確定する（201 を確かめて答えを返す） */
const verifyOk = async (token: string, o: Parameters<typeof verify>[1] = {}) => {
  const r = await verify(token, o);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data!;
};
/** 別の人（もう確定している人）を作ってログインの印を返す */
const otherUser = async (tag: string) => {
  const r = await signUp(authFixture.auth, {
    email: email(tag),
    password: PW,
    name: "別の 人",
    companyName: "別の会社",
  });
  return { token: r.token!, userId: r.userId };
};

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 3 });
  const ops = (await admin.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
  const ins = (kind: string) =>
    admin.query<{ id: string }>(
      "insert into terms_versions (tenant_id, kind, version, url, published_at) values ($1, $2, $3, $4, now()) returning id",
      [ops, kind, RUN, `https://kaname.example/${kind}/${RUN}`],
    );
  termsId = (await ins("terms")).rows[0]!.id;
  privacyId = (await ins("privacy")).rows[0]!.id;
  const seams: Seams = { bucketExists: async () => true, mail: fakeMail, outboundFetch: fakeFetch };
  app = await bootApi(config, seams);
  fixturePool = createPool({ databaseUrl: APP_URL, max: 2 });
  authFixture = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool: fixturePool,
    secret: config.authSecret,
    baseURL: config.baseUrl,
  });
  resolve = createSessionResolver(authFixture.auth, fixturePool);
}, 60_000);

afterAll(async () => {
  await admin?.query("delete from kaname_auth.pending_signup where email like $1", [`${RUN}-%`]);
  await admin?.query(
    "delete from terms_consents where terms_version_id in (select id from terms_versions where version = $1)",
    [RUN],
  );
  await admin?.query("delete from terms_versions where version = $1", [RUN]);
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await admin?.end();
});

describe("K-52 メールを確かめる：申し込みの状態 × 入口 × 利用者の状態", () => {
  it("K52-API-001 保留中（期限内）× 確認のメールのリンク × ログインしていない：確定する。本人・テナント・層・代表・自分のAI ができ、ログインした状態になる", async () => {
    const e = email("ok");
    const t = await pend("ok");
    expect(await usersOf(e), "押す前は本人がいない（D-088.2）").toHaveLength(0);
    const d = await verifyOk(t);
    expect(d).toMatchObject({ email: e, signed_in: true });
    expect(typeof d["token"]).toBe("string");
    const users = await usersOf(e);
    expect(users).toHaveLength(1);
    expect(users[0]!.emailVerified).toBe(true);
    expect(d, "答えに本人の id を入れない（L8）").not.toHaveProperty("user_id");
    const ms = await membersOf(users[0]!.id);
    expect(ms).toHaveLength(1);
    expect(ms[0]!.tenant_name).toBe("株式会社テスト");
    expect(ms[0]!.scope_id).toBeTruthy(); // 根の層
    const perms = await admin.query("select 1 from permissions where grantee_member_id = $1 and revoked_at is null", [
      ms[0]!.id,
    ]);
    expect(perms.rowCount, "代表には全部の権限").toBeGreaterThan(0);
    const clones = await admin.query("select 1 from clones where owner_member_id = $1", [ms[0]!.id]);
    expect(clones.rowCount, "自分のAI").toBe(1);
    expect((await pending(e))!.consumed_at).not.toBeNull();
    expect(await resolves(String(d["token"])), "返したログインの印で入れる").toBe(true);
  });

  it("K52-API-002 保留中（期限内）× 別の端末・別のブラウザで開く：確定する（同じ端末でなくてよい）。開いた方の端末でログインする", async () => {
    const e = email("other-device");
    const t = await pend("other-device");
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605";
    const d = await verifyOk(t, { ip: "192.0.2.77", headers: { "user-agent": ua } });
    expect(d["signed_in"]).toBe(true);
    expect(await usersOf(e)).toHaveLength(1);
    expect(await resolves(String(d["token"]), ua)).toBe(true);
  });

  it("K52-API-003 保留中（期限内）× 別のアカウントでログイン中：確定はするが今のアカウントは切り替えない（token=null・signed_in=false・新しい本人のセッションを作らない・D-128.137）", async () => {
    const other = await otherUser("acc-a");
    const e = email("acc-b");
    const t = await pend("acc-b");
    const d = await verifyOk(t, { headers: bearer(other.token) });
    expect(d["signed_in"]).toBe(false);
    expect(d["token"] ?? null).toBeNull();
    const users = await usersOf(e);
    expect(users, "確定はする").toHaveLength(1);
    const m = (await membersOf(users[0]!.id))[0]!;
    expect(await liveSessions(m.id), "新しいアカウントのセッションは作らない（作ったらすぐ閉じる）").toBe(0);
    // 閉じた理由はログアウト（logout）と分ける：理由のマスタに足す印 signup_other_account（migration 0087・レビューの L5）
    const reasons = await admin.query<{ r: string | null }>(
      "select revoke_reason_id as r from sessions where member_id = $1",
      [m.id],
    );
    for (const x of reasons.rows) expect(x.r).toBe("signup_other_account");
    expect(await resolves(other.token), "今のアカウントのログインはそのまま").toBe(true);
  });

  it("K52-API-004 保留中（期限内・送れなかった印がある）× 開発のログに出たリンク：期限内なら確定する（送れなかった印は確定を止めない）", async () => {
    const e = email("sendfail");
    const t = await pend("sendfail");
    await admin.query(
      "update kaname_auth.pending_signup set sent_at = null, send_error = 'daily quota exceeded' where email = $1",
      [e],
    );
    await verifyOk(t);
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-005 保留中（期限切れ・30 分を過ぎた）：410・E-AUTH-003「リンクの期限が切れました。もう一度登録してください」。本人は作らない", async () => {
    const e = email("expired");
    const t = await pend("expired");
    await setExpiry(e, "now() - interval '1 second'");
    const r = await verify(t);
    expect(r.status).toBe(410);
    const j = await json(r);
    expect(j["code"]).toBe("E-AUTH-003");
    expect(j["message"]).toBe(EXPIRED_MESSAGE);
    expect(await usersOf(e)).toHaveLength(0);
    expect((await pending(e))!.consumed_at, "使い終わりの印は付けない").toBeNull();
  });

  it("K52-API-006 期限の直前・ちょうど・直後（DB の now() で比べる）：直前は確定、ちょうど（期限＝今）と直後は 410・E-AUTH-003", async () => {
    const before = email("edge-before");
    const tb = await pend("edge-before");
    await setExpiry(before, "now() + interval '2 seconds'"); // 29 分 58 秒が過ぎた
    await verifyOk(tb);
    for (const [tag, sql] of [
      ["edge-just", "now()"],
      ["edge-after", "now() - interval '1 millisecond'"],
    ] as const) {
      const t = await pend(tag);
      await setExpiry(email(tag), sql);
      const r = await verify(t);
      expect(r.status, tag).toBe(410);
      expect((await json(r))["code"], tag).toBe("E-AUTH-003");
      expect(await usersOf(email(tag)), tag).toHaveLength(0);
    }
  });

  it(`K52-API-007 前のリンク（送り直した）× 前の方のリンク：410・${NEW_OLD_LINK}（前のリンク）。新しいリンクはそのまま使える`, async () => {
    const e = email("old-link");
    const first = await pend("old-link");
    const second = await pend("old-link"); // 送り直し（putPending の上書き）
    const r = await verify(first);
    expect(r.status).toBe(410);
    const j = await json(r);
    expect(j["code"], "期限切れ（E-AUTH-003）やでたらめ（E-PAGE-006）と分けて案内する").toBe(NEW_OLD_LINK);
    expect(await usersOf(e)).toHaveLength(0);
    await verifyOk(second);
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-008 送り直しの上書き：前のリンクの手がかり（ハッシュ）が replaced_token_hashes に残り、今の token_hash は新しいリンク（K-51 のマス・列はこのチケット）", async () => {
    const e = email("replaced");
    const first = await pend("replaced");
    const second = await pend("replaced");
    const third = await pend("replaced");
    const row = (await pending(e))!;
    expect(row.token_hash).toBe(hashPendingToken(third));
    expect(row.replaced_token_hashes).toEqual(
      expect.arrayContaining([hashPendingToken(first), hashPendingToken(second)]),
    );
    expect(row.replaced_token_hashes).not.toContain(hashPendingToken(third));
  });

  it("K52-API-009 前のリンク（新しいリンクで確定済み）× 前の方のリンク：409・E-CONF-011「登録は確認まで終わっています。ログインしてください」", async () => {
    const e = email("old-after-done");
    const first = await pend("old-after-done");
    const second = await pend("old-after-done");
    await verifyOk(second);
    const r = await verify(first);
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe("E-CONF-011");
    expect(j["message"]).toBe(msg("E-CONF-011"));
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-010 確定済み × 同じリンクをもう一度 × ログインしていない：409・E-CONF-011（D-088.9）。二重に作らず、ログインの印も渡さない", async () => {
    const e = email("twice");
    const t = await pend("twice");
    await verifyOk(t);
    const r = await verify(t);
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe("E-CONF-011");
    expect(j.data?.["token"] ?? null, "2 回目にログインの印を渡すと、リンクを持つ人なら誰でも入れてしまう").toBeNull();
    expect(JSON.stringify(j)).not.toMatch(/"token"\s*:\s*"/);
    const users = await usersOf(e);
    expect(users).toHaveLength(1);
    expect(await membersOf(users[0]!.id)).toHaveLength(1);
  });

  it(`K52-API-011 確定済み × 同じリンクをもう一度 × 別のアカウントでログイン中：409・${NEW_OTHER_ACC}（別のアカウントの登録のリンク）。今のアカウントのまま`, async () => {
    const e = email("done-other");
    const t = await pend("done-other");
    await verifyOk(t);
    const other = await otherUser("done-other-me");
    const r = await verify(t, { headers: bearer(other.token) });
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(NEW_OTHER_ACC);
    expect(await resolves(other.token), "勝手に切り替えない").toBe(true);
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-012 無い（1 日を過ぎて掃除された・でたらめの手がかり）：410・E-PAGE-006。メールアドレスは返さない", async () => {
    const e = email("swept");
    const t = await pend("swept");
    await setExpiry(e, "now() - interval '1 day 1 minute'");
    await sweepPending(authFixture.pool);
    expect(await pending(e)).toBeUndefined();
    for (const token of [t, "Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0", "a".repeat(32)]) {
      const r = await verify(token);
      expect(r.status, token).toBe(410);
      const text = await r.text();
      const j = JSON.parse(text) as Record<string, unknown>;
      expect(j["code"]).toBe("E-PAGE-006");
      expect(j["message"]).toBe(msg("E-PAGE-006"));
      expect(text).not.toContain(e);
    }
  });

  it("K52-API-013 別の道で登録済み（申し込みの後に同じメールで本人ができた・大文字小文字が違う）：409・E-CONF-001。申し込みは使い終わりにし、二重に作らない", async () => {
    const e = email("elsewhere");
    const t = await pend("elsewhere");
    await signUp(authFixture.auth, {
      email: e.toUpperCase(),
      password: PW,
      name: "別の道 太郎",
      companyName: "別の道社",
    });
    const r = await verify(t);
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe("E-CONF-001");
    expect(j["message"]).toBe(msg("E-CONF-001"));
    expect(await usersOf(e)).toHaveLength(1);
    expect((await pending(e))!.consumed_at).not.toBeNull();
    const m = await membersOf((await usersOf(e))[0]!.id);
    expect(m.map((x) => x.tenant_name)).toEqual(["別の道社"]); // 申し込みの会社は作らない
  });

  it("K52-API-014 保留中（期限内）× 口を直に呼ぶ（画面を通らない・Origin も Referer も無い）：画面からと同じ結果で確定する", async () => {
    const e = email("direct");
    const t = await pend("direct");
    const d = await verifyOk(t, { headers: { "user-agent": "curl/8.5.0" } });
    expect(d["signed_in"]).toBe(true);
    expect(await usersOf(e)).toHaveLength(1);
  });
});

describe("K-52 入力", () => {
  it("K52-API-015 手がかりが無い・空：422・E-PAGE-006 の文言。申し込みには触らない", async () => {
    const e = email("empty");
    await pend("empty");
    const before = await pending(e);
    for (const body of [{}, { token: "" }, { token: "   " }]) {
      const r = await req("POST", VERIFY, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = await json(r);
      expect(j["code"]).toBe("E-PAGE-006");
      expect(j["message"]).toBe(msg("E-PAGE-006"));
    }
    expect(await pending(e)).toEqual(before);
  });

  it("K52-API-016 手がかりの形が違う（長すぎる・使えない文字）：410・E-PAGE-006（でたらめと同じ扱い。形の違いで中身を探らせない）", async () => {
    const answers: string[] = [];
    for (const token of ["x".repeat(5000), "'; drop table users; --", "<script>alert(1)</script>", "手がかり"]) {
      const r = await verify(token);
      expect(r.status, token.slice(0, 20)).toBe(410);
      const j = await json(r);
      expect(j["code"]).toBe("E-PAGE-006");
      answers.push(JSON.stringify({ code: j["code"], message: j["message"] }));
    }
    expect(new Set(answers).size, "どの形でも同じ答え").toBe(1);
  });

  it("K52-API-017 手がかりの前後の空白（メールソフトが付ける）：前後の空白だけ除いて同じ手がかりとして扱う", async () => {
    const e = email("spaces");
    const t = await pend("spaces");
    await verifyOk(` \t${t}\r\n`);
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-018 会社名が空の申し込み：本人の名前で個人のテナントができる（tenants.name ＝ 名前・D-125.135）", async () => {
    const e = email("personal");
    const t = await pend("personal", { company: "", name: "個人 花子" });
    const d = await verifyOk(t);
    const ms = await membersOf(await userIdOf(String(d["email"])));
    expect(ms).toHaveLength(1);
    expect(ms[0]!.tenant_name).toBe("個人 花子");
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-019 名前・会社名の長さ（100 文字）：申し込みのときの値のまま使い、app.create_company の上限（会社 120・名前 80）で切れても確定する", async () => {
    const t = await pend("long", { name: "名".repeat(100), company: "社".repeat(100) });
    const d = await verifyOk(t);
    const m = (await membersOf(await userIdOf(String(d["email"]))))[0]!;
    expect(m.tenant_name).toBe("社".repeat(100));
    expect(m.display_name.length).toBeGreaterThan(0);
    expect(m.display_name.length).toBeLessThanOrEqual(80);
    expect(m.display_name.startsWith("名")).toBe(true);
  });
});

describe("K-52 時間の流れ・失敗", () => {
  it("K52-API-020 確定の途中に同じメールで送り直しが来る（2 つを同時に）：本人は 1 人。後で届いたリンクは確定に使えない（409）", async () => {
    const e = email("race-resend");
    const t = await pend("race-resend");
    const [r, resent] = await Promise.all([verify(t), pend("race-resend")]);
    expect(r.status).toBeLessThan(500);
    if (r.status === 410) {
      // 送り直しが先に来た：前のリンクになった。新しいリンクで確定できる
      await verifyOk(resent);
    }
    const again = await verify(resent);
    expect(again.status, "確定の後に届いたリンクは確定済み").toBe(409);
    expect(["E-CONF-011", "E-CONF-001"]).toContain((await json(again))["code"]);
    const users = await usersOf(e);
    expect(users).toHaveLength(1);
    expect(await membersOf(users[0]!.id)).toHaveLength(1);
  });

  it("K52-API-021 本人を作る途中で失敗（app.create_company が落ちる）：500・E-PAGE-003。作りかけの本人を消し、印を戻す（もう一度押せば確定できる）", async () => {
    const e = email("company-fail");
    const t = await pend("company-fail", { company: `${RUN}-落ちる社` });
    await admin.query(`create or replace function public.k52_fail() returns trigger language plpgsql as $$
      begin if new.name like '%-落ちる社' then raise exception 'K-52 の試験：会社が作れない'; end if; return new; end $$`);
    await admin.query(
      "create trigger k52_fail before insert on tenants for each row execute function public.k52_fail()",
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      expect(r.status).toBe(500);
      const text = await r.text();
      expect((JSON.parse(text) as Record<string, unknown>)["code"]).toBe("E-PAGE-003");
      expect(text).not.toContain("K-52 の試験");
      expect(await usersOf(e), "作りかけの本人は残さない").toHaveLength(0);
      expect((await pending(e))!.consumed_at, "印を戻す").toBeNull();
    } finally {
      spy.mockRestore();
      await admin.query("drop trigger if exists k52_fail on tenants");
      await admin.query("drop function if exists public.k52_fail()");
    }
    await verifyOk(t);
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-022 DB が落ちた（申し込みに印を付ける書き込みが失敗）：500・E-PAGE-003。申し込みはそのまま残る", async () => {
    const e = email("dbdown");
    const t = await pend("dbdown");
    const before = await pending(e);
    await admin.query(`create or replace function kaname_auth.k52_down() returns trigger language plpgsql as $$
      begin if old.email like '%-dbdown@example.com' then raise exception 'K-52 の試験：DB が落ちた'; end if; return new; end $$`);
    await admin.query(
      "create trigger k52_down before update on kaname_auth.pending_signup for each row execute function kaname_auth.k52_down()",
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      expect(r.status).toBe(500);
      const j = await json(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(j["message"]).toBe(msg("E-PAGE-003"));
    } finally {
      spy.mockRestore();
      await admin.query("drop trigger if exists k52_down on kaname_auth.pending_signup");
      await admin.query("drop function if exists kaname_auth.k52_down()");
    }
    expect(await pending(e)).toEqual(before);
    expect(await usersOf(e)).toHaveLength(0);
  });

  it("K52-API-023 包んだパスワードが開けない（鍵が替わった）：確定しない。E-PAGE-006 で登録し直しの案内。セキュリティの記録に残す", async () => {
    const e = email("rekeyed");
    const t = await pend("rekeyed", { key: Buffer.alloc(32, 8).toString("base64") }); // 別の鍵で包んだ（鍵の入れ替え）
    const count = async () =>
      Number((await admin.query<{ n: string }>("select count(*) as n from security_events")).rows[0]!.n);
    const before = await count();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      expect(r.status).toBe(410);
      expect((await json(r))["code"]).toBe("E-PAGE-006");
    } finally {
      spy.mockRestore();
    }
    expect(await usersOf(e)).toHaveLength(0);
    expect(await count(), "セキュリティの記録（security_events）に 1 行").toBe(before + 1);
    // 印は戻さない（使い終わりのまま・レビューの M4）。押し直しても「確認まで終わっています」や「前のリンク」にせず、同じ登録し直しの案内
    expect((await pending(e))!.consumed_at, "使い終わりのまま").not.toBeNull();
    const again = await verify(t);
    expect(again.status).toBe(410);
    expect((await json(again))["code"]).toBe("E-PAGE-006");
    expect(await usersOf(e)).toHaveLength(0);
    const last = await admin.query<{ t: string; tenant_id: string }>(
      "select s::text as t, s.tenant_id from security_events s order by occurred_at desc limit 1",
    );
    expect(last.rows[0]!.t).not.toContain(e);
    // security_events.tenant_id は空にできない。登録の前（本人もテナントも無い）の記録は運営のテナントに置く
    const ops = (await admin.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
    expect(last.rows[0]!.tenant_id, "登録の前の記録は運営のテナント").toBe(ops);
  });

  it("K52-API-024 確定の後の知らせ（関門 C6）が送れない：確定は止めない。送れなかったことはログに残すが、メールは書かない", async () => {
    const e = email("notify-fail");
    const t = await pend("notify-fail");
    failMailTo.add(e);
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    let d: Record<string, unknown> | undefined;
    try {
      d = await verifyOk(t);
      expect(d["signed_in"]).toBe(true);
    } finally {
      failMailTo.delete(e);
      for (const s of spies) s.mockRestore();
    }
    expect(await usersOf(e)).toHaveLength(1);
    const log = out.join("\n");
    expect(log).not.toContain(e);
    // 送れなかったことはログに残す（宛先はメールアドレスでなく印「宛先#…」・K-51 と同じ mailTag）
    expect(log, "送れなかったログが出る").toMatch(/送れなかった|送れません/);
    expect(log, "宛先は印で出す").toContain(mailTag(e));
    // 答えに「送った」の印を入れない（送れていないのに送ったと言わない・G-15）
    expect(d?.["mail_sent"] ?? null, "送ったの印が無い").not.toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/"(sent|mail_sent)"\s*:\s*true/);
  });

  it("K52-API-025 確定した直後の最初のログイン：本人に「新しい端末からログインしました」の知らせを出さない（D-128.137）。確定の後のメールは本文に秘密を入れない", async () => {
    const e = email("first-login");
    const t = await pend("first-login");
    const from = mails.length;
    await verifyOk(t);
    const after = mailsTo(e, from);
    expect(after.filter((m) => /新しい端末/.test(m.subject + m.text))).toHaveLength(0);
    expect(
      after.map((m) => m.subject),
      "届くのは「登録が完了しました」の 1 通だけ",
    ).toEqual([DONE_SUBJECT]);
    for (const m of after) {
      expect(m.text).not.toContain(PW);
      expect(m.text).not.toContain(t);
    }
    const n = await admin.query(
      "select 1 from notifications n join members m on m.id = n.member_id join kaname_auth.\"user\" u on u.id = m.auth_user_id where u.email = $1 and n::text ilike '%new_device%'",
      [e],
    );
    expect(n.rowCount, "画面の知らせにも新しい端末を出さない").toBe(0);
  });
});

describe("K-52 操作の揺れ・守り", () => {
  it("K52-API-026 2 回押し・同じリンクを 2 つのタブで同時に開く：本人は 1 人・テナントは 1 つ・知らせは 1 通まで。後の方は 409・E-CONF-011", async () => {
    const e = email("double");
    const t = await pend("double");
    const from = mails.length;
    const rs = await Promise.all([verify(t), verify(t), verify(t)]);
    const statuses = rs.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409]);
    for (const r of rs.filter((x) => x.status === 409)) expect((await json(r))["code"]).toBe("E-CONF-011");
    const users = await usersOf(e);
    expect(users).toHaveLength(1);
    expect(await membersOf(users[0]!.id)).toHaveLength(1);
    expect(
      mailsTo(e, from).map((m) => m.subject),
      "同時に 3 回押しても、完了のメールはちょうど 1 通",
    ).toEqual([DONE_SUBJECT]);
  });

  it("K52-API-027 1 分に 11 回（同じ IP）：11 回目は 429・待つ秒数（retry_after_sec）", async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      const r = await verify(`rate-${RUN}-${i}`, { ip });
      expect(r.status, `${i + 1} 回目は上限の内`).not.toBe(429);
    }
    const r = await verify(`rate-${RUN}-10`, { ip });
    expect(r.status).toBe(429);
    expect(Number((await json(r))["retry_after_sec"])).toBeGreaterThan(0);
  });

  it("K52-API-028 返すもの：409・410 の答えにメールアドレス・名前・会社名を入れない。当てずっぽうの手がかりは、どれも同じ E-PAGE-006", async () => {
    const e = email("leak");
    const t = await pend("leak", { name: "漏れない 太郎", company: "漏れない社" });
    const old = t;
    const fresh = await pend("leak", { name: "漏れない 太郎", company: "漏れない社" });
    await verifyOk(fresh);
    const bodies: string[] = [];
    bodies.push(await (await verify(old)).text()); // 前のリンク（確定済み）
    bodies.push(await (await verify(fresh)).text()); // 確定済み
    const e2 = email("leak-exp");
    const t2 = await pend("leak-exp", { name: "漏れない 次郎", company: "漏れない社" });
    await setExpiry(e2, "now() - interval '1 second'");
    bodies.push(await (await verify(t2)).text()); // 期限切れ
    for (const b of bodies) {
      for (const secret of [e, e2, e.split("@")[0]!, "漏れない"]) expect(b).not.toContain(secret);
    }
    const guesses = await Promise.all(
      ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"].map(async (g) => {
        const r = await verify(g);
        return `${r.status} ${JSON.stringify((await json(r))["code"])}`;
      }),
    );
    expect(guesses).toEqual(['410 "E-PAGE-006"', '410 "E-PAGE-006"']);
  });

  it("K52-API-029 DB の中：確定したら包んだパスワードが空になる。手がかりはハッシュだけ（前のリンクの列もハッシュだけ）。行は残る", async () => {
    const e = email("db");
    const first = await pend("db");
    const t = await pend("db");
    await verifyOk(t);
    const row = (await pending(e))!;
    expect(row, "行は「確定済み」と「期限切れ」を分けるために残す").toBeDefined();
    expect(row.pw_iv).toBeNull();
    expect(row.pw_tag).toBeNull();
    expect(row.pw_data).toBeNull();
    const text = (
      await admin.query<{ t: string }>("select p::text as t from kaname_auth.pending_signup p where email = $1", [e])
    ).rows[0]!.t;
    for (const plain of [PW, t, first]) expect(text).not.toContain(plain);
    expect(row.replaced_token_hashes).toContain(hashPendingToken(first));
  });

  it("K52-API-030 ログ：確定の間に、パスワードもメールもリンクの手がかりもログに出ない", async () => {
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    const e = email("log");
    const t = await pend("log");
    try {
      out.length = 0; // 申し込みを作るところ（K-51 の受け持ち）は数えない
      await verifyOk(t);
      await verify(t); // 2 回目（確定済み）
      await verify(`${t}x`); // でたらめ
    } finally {
      for (const s of spies) s.mockRestore();
    }
    const all = out.join("\n");
    for (const secret of [PW, e, e.split("@")[0]!, t]) expect(all).not.toContain(secret);
  });

  it("K52-API-031 関門：振る舞いは apps/api/src/features/F1/verify-email/ にあり、書くのは関門 C2（withTenant）・知らせは関門 C6（@kaname/notify）だけ（生の pg・送出の SDK を直に使わない）", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p);
      }
    };
    expect(() => walk(FEATURE_DIR), "apps/api/src/features/F1/verify-email/ がある").not.toThrow();
    expect(files.length).toBeGreaterThan(0);
    const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/from\s+["']pg["']/);
    expect(src).not.toMatch(/from\s+["'](resend|nodemailer|@sendgrid\/mail)["']/);
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src, "書くのは関門 C2 の withTenant を通す").toMatch(/withTenant/);
    expect(src, "知らせは関門 C6 の @kaname/notify を通す").toMatch(/@kaname\/notify/);
  });

  it("K52-API-032 規約の版：申し込みに残した利用規約とプライバシーポリシーの版と同意の時刻が、terms_consents に新しい本人の行として 2 行入る（D-128.137）", async () => {
    const e = email("terms");
    const t = await pend("terms");
    await admin.query(
      "update kaname_auth.pending_signup set terms_version_id = $2, privacy_version_id = $3, consented_at = now() - interval '7 minutes' where email = $1",
      [e, termsId, privacyId],
    );
    const consentedAt = (
      await admin.query<{ at: Date }>("select consented_at as at from kaname_auth.pending_signup where email = $1", [e])
    ).rows[0]!.at;
    const d = await verifyOk(t);
    const m = (await membersOf(await userIdOf(String(d["email"]))))[0]!;
    const rows = (
      await admin.query<{
        tenant_id: string;
        member_id: string;
        auth_user_id: string;
        terms_version_id: string;
        agreed_at: Date;
      }>(
        "select tenant_id, member_id, auth_user_id, terms_version_id, agreed_at from terms_consents where auth_user_id = $1 order by terms_version_id",
        [await userIdOf(String(d["email"]))],
      )
    ).rows;
    expect(rows.map((r) => r.terms_version_id).sort()).toEqual([termsId, privacyId].sort());
    for (const r of rows) {
      expect(r.tenant_id).toBe(m.tenant_id);
      expect(r.member_id).toBe(m.id);
      expect(new Date(r.agreed_at).getTime(), "同意した時刻は申し込みのときの時刻").toBe(
        new Date(consentedAt).getTime(),
      );
    }
  });

  it("K52-API-033 前の道すじは消えている：POST /api/auth-ext/verify-signup は無い（契約の口だけ）", async () => {
    const e = email("old-route");
    const t = await pend("old-route");
    const r = await req("POST", "/api/auth-ext/verify-signup", { token: t });
    expect(r.status).toBe(404);
    expect(await usersOf(e)).toHaveLength(0);
  });
});

describe("K-52 送り直し・招待・完了のメール・表記ゆらぎ（精査で足した行）", () => {
  it(`K52-API-034 送り直し（K-51 の契約の口 resendSignupEmail → renewPendingLink）× 前の方のリンク：前の手がかりが replaced_token_hashes に移り、前のリンクは 410・${NEW_OLD_LINK}。新しいリンクで確定できる`, async () => {
    const e = email("resend-api");
    const from = mails.length;
    const c = await req("POST", SIGNUP, { email: e, name: "送り直す 人", company_name: "送り直し社", password: PW });
    expect(c.status, await c.clone().text()).toBe(201);
    const signupToken = String((await json(c)).data!["signup_token"]);
    const first = linkTokenOf(mailsTo(e, from)[0]!);
    const rs = await req("POST", RESEND, {}, nextIp(), { "x-signup-token": signupToken });
    expect(rs.status, await rs.clone().text()).toBe(201);
    const sent = mailsTo(e, from);
    expect(sent, "確認のメールが 2 通（登録・送り直し）").toHaveLength(2);
    const second = linkTokenOf(sent[1]!);
    expect(second).not.toBe(first);
    const row = (await pending(e))!;
    expect(row.token_hash).toBe(hashPendingToken(second));
    expect(
      row.replaced_token_hashes,
      "送り直しでも前の手がかりを残す（putPending だけでなく renewPendingLink も）",
    ).toContain(hashPendingToken(first));
    const old = await verify(first);
    expect(old.status).toBe(410);
    expect((await json(old))["code"]).toBe(NEW_OLD_LINK);
    await verifyOk(second);
    expect(await usersOf(e)).toHaveLength(1);
  });

  it("K52-API-035 招待で入る（会社名を持たない登録）：会社は増えない。会社名が空のとき名前を渡すのは K-52 の確定の処理だけ（登録の直後の hook は変えない）", async () => {
    const boss = await verifyOk(await pend("inviter", { company: `${RUN}-招く社` }));
    const bm = (await membersOf(await userIdOf(String(boss["email"]))))[0]!;
    const repo = await createRepository(fixturePool);
    const inv = await createInvitation(
      repo,
      { tenantId: bm.tenant_id, userId: bm.id, role: "member" },
      { email: email("invitee"), roleId: "staff" },
    );
    const tenantsBefore = Number((await admin.query<{ n: string }>("select count(*) as n from tenants")).rows[0]!.n);
    const ac = await req("POST", `/api/v1/auth/invitations/${inv.token}/accept`, {
      name: "招かれた 人",
      password: PW,
    });
    expect(ac.status, await ac.clone().text()).toBe(201);
    const tenantsAfter = Number((await admin.query<{ n: string }>("select count(*) as n from tenants")).rows[0]!.n);
    expect(tenantsAfter, "招待で入っても会社（テナント）は増えない").toBe(tenantsBefore);
    const u = (await usersOf(email("invitee")))[0]!;
    const ms = await membersOf(u.id);
    expect(
      ms.map((m) => m.tenant_id),
      "招いた会社の一員になるだけ",
    ).toEqual([bm.tenant_id]);
    expect(
      (await admin.query("select 1 from tenants where name = $1", ["招かれた 人"])).rowCount,
      "名前の個人のテナントを作らない",
    ).toBe(0);
  });

  it(`K52-API-036 確定の後の 1 通（D-128.146）：件名「${DONE_SUBJECT}」・名前・登録が完了したこと・ログインの入口・登録したメールアドレス・問い合わせ先・送信専用。パスワードとリンクは入れない`, async () => {
    const e = email("done-mail");
    const t = await pend("done-mail", { name: "完了 太郎" });
    const from = mails.length;
    await verifyOk(t);
    const got = mailsTo(e, from);
    expect(got, "ちょうど 1 通").toHaveLength(1);
    const m = got[0]!;
    expect(m.subject).toBe(DONE_SUBJECT);
    expect(m.text).toContain("完了 太郎");
    expect(m.text).toContain("登録が完了しました");
    expect(m.text, "ログインの入口").toContain(`${config.webBaseUrl}/login`);
    expect(m.text, "登録したメールアドレス").toContain(e);
    expect(m.text, "心当たりが無いときの問い合わせ先").toContain(OPS_EMAIL);
    expect(m.text).toContain("送信専用");
    expect(m.text).not.toContain(PW);
    expect(m.text).not.toContain(t);
    expect(m.text, "確認のリンクを入れない").not.toMatch(/verify-email\?token=/);
  });

  it("K52-API-037 名前・会社名の全角・前後と途中の空白：NFKC でそろえ、前後の空白を切ってから作る（tenants.name・members.display_name）", async () => {
    const t = await pend("zenkaku", { name: "　高本　聖斗　", company: " ＡＢＣ株式会社　" });
    const d = await verifyOk(t);
    const m = (await membersOf(await userIdOf(String(d["email"]))))[0]!;
    expect(m.tenant_name).toBe("ABC株式会社");
    expect(m.display_name).toBe("高本 聖斗");
    const p = await pend("zenkaku-personal", { name: "　個人　花子　", company: "　" });
    const dp = await verifyOk(p);
    const mp = (await membersOf(await userIdOf(String(dp["email"]))))[0]!;
    expect(mp.tenant_name, "会社名が空白だけなら空と同じ＝名前の個人のテナント").toBe("個人 花子");
  });
});

describe("K-52 確定の途中の失敗と、ログイン中かの見分け（コードとセキュリティのレビューで足した行）", () => {
  it("K52-API-038 確定の途中（本人と会社ができ、emailVerified を立てた後・同意を移す所）で落ちる：500・E-PAGE-003。作りかけの会社は消さずに「作りかけで止めた」印（tenants.half_made_at）を付け、人・権限・自分のAI は片付ける。監査の記録は残す。押し直すと印の無い会社がちょうど 1 つできる（D-128.167）", async () => {
    const e = email("consent-fail");
    const company = `${RUN}-同意で落ちる社`;
    const t = await pend("consent-fail", { company });
    await admin.query(
      "update kaname_auth.pending_signup set terms_version_id = $2, privacy_version_id = $3, consented_at = now() where email = $1",
      [e, termsId, privacyId],
    );
    await admin.query(`create or replace function public.k52_consent_fail() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from kaname_auth."user" u where u.id = new.auth_user_id and u.email = '${e}') then
          raise exception 'K-52 の試験：同意を移せない';
        end if;
        return new;
      end $$`);
    await admin.query(
      "create trigger k52_consent_fail before insert on terms_consents for each row execute function public.k52_consent_fail()",
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      expect(r.status).toBe(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      expect(await usersOf(e), "作りかけの本人は残さない").toHaveLength(0);
      const tenants = await admin.query<{ id: string; half_made_at: Date | null }>(
        "select id, half_made_at from tenants where name = $1",
        [company],
      );
      expect(tenants.rowCount, "会社の行は消さない（D-128.167）").toBe(1);
      const tid = tenants.rows[0]!.id;
      expect(tenants.rows[0]!.half_made_at, "「作りかけで止めた」印が付く").not.toBeNull();
      for (const table of ["members", "permissions", "clones"] as const) {
        const n = (await admin.query(`select 1 from ${table} where tenant_id = $1`, [tid])).rowCount;
        expect(n, `${table} は片付ける`).toBe(0);
      }
      const audit = await admin.query(
        "select 1 from security_events where tenant_id = $1 and kind_id = 'company_created'",
        [tid],
      );
      expect(audit.rowCount, "監査の記録（company_created）は消さない").toBeGreaterThan(0);
      expect((await pending(e))!.consumed_at, "印を戻す（もう一度押せば確定できる）").toBeNull();
    } finally {
      spy.mockRestore();
      await admin.query("drop trigger if exists k52_consent_fail on terms_consents");
      await admin.query("drop function if exists public.k52_consent_fail()");
    }
    const d = await verifyOk(t);
    const ms = await membersOf(await userIdOf(String(d["email"])));
    expect(
      ms.map((m) => m.tenant_name),
      "押し直すと会社は 1 つ",
    ).toEqual([company]);
    const live = await admin.query<{ id: string }>("select id from tenants where name = $1 and half_made_at is null", [
      company,
    ]);
    expect(live.rowCount, "印の無い会社がちょうど 1 つ").toBe(1);
    expect(live.rows[0]!.id).toBe(ms[0]!.tenant_id);
    for (const table of ["permissions", "clones"] as const) {
      const col = table === "permissions" ? "grantee_member_id" : "owner_member_id";
      expect((await admin.query(`select 1 from ${table} where ${col} = $1`, [ms[0]!.id])).rowCount).toBeGreaterThan(0);
    }
  });

  it("K52-API-039 確定の途中で、同じメールの本人が別の道（招待の受け入れなど）でできた（signUp が重複で落ちる）：409・E-CONF-001。別の道でできた本人と所属は消さない（消すのはこの確定で作った本人だけ）", async () => {
    const e = email("race-other");
    const t = await pend("race-other");
    // 別の道の本人 X（いまは別のメール）。確定の signUp が本人を足す瞬間に、X のメールを同じメールに変えて重複を起こす。
    //   書き換えは別の接続で先にコミットさせる（同じ文の中で書き換えると、一意の違反で文ごと巻き戻り、X のメールも元に戻ってしまう）。
    //   段取り：引き金は確定の本人を足す直前に勧告ロック（LOCK_KEY）を待つ → 試験は待っているのを見てから、別の接続で X のメールを
    //   同じメールに変えてコミット → ロックを放す → 確定の本人の追加が、コミット済みの X と一意で重なって落ちる（確定の側だけが巻き戻る）
    const tmp = email("race-other-tmp");
    const x = await signUp(authFixture.auth, {
      email: tmp,
      password: PW,
      name: "別の道 次郎",
      companyName: `${RUN}-別の道の会社`,
    });
    const xMembersBefore = (await membersOf(x.userId)).map((m) => m.id);
    expect(xMembersBefore).toHaveLength(1);
    const LOCK_KEY = 52039;
    const holder = await admin.connect(); // ロックを持つ接続
    const other = new pg.Client({ connectionString: ADMIN }); // 別の道の書き換えをコミットする接続
    await other.connect();
    await holder.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await admin.query(`create or replace function kaname_auth.k52_race() returns trigger language plpgsql as $$
      begin
        if new.email = '${e}' then perform pg_advisory_xact_lock(${LOCK_KEY}); end if;
        return new;
      end $$`);
    await admin.query(
      'create trigger k52_race before insert on kaname_auth."user" for each row execute function kaname_auth.k52_race()',
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let released = false;
    try {
      const pendingVerify = verify(t);
      // 確定の本人の追加がロックを待つまで待つ（眠らずに pg_locks を見る）
      await expect
        .poll(
          async () =>
            (
              await admin.query("select 1 from pg_locks where locktype = 'advisory' and objid = $1 and not granted", [
                LOCK_KEY,
              ])
            ).rowCount,
          { timeout: 15_000 },
        )
        .toBe(1);
      await other.query('update kaname_auth."user" set email = $1 where id = $2', [e, x.userId]); // 自動でコミット
      await holder.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      released = true;
      const r = await pendingVerify;
      expect(r.status, await r.clone().text()).toBe(409);
      expect((await json(r))["code"]).toBe("E-CONF-001");
    } finally {
      spy.mockRestore();
      if (!released) await holder.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      holder.release();
      await other.end();
      await admin.query('drop trigger if exists k52_race on kaname_auth."user"');
      await admin.query("drop function if exists kaname_auth.k52_race()");
    }
    const users = await usersOf(e);
    expect(
      users.map((u) => u.id),
      "別の道でできた本人は消さない",
    ).toEqual([x.userId]);
    expect(
      (await membersOf(x.userId)).map((m) => m.id),
      "その所属も消さない",
    ).toEqual(xMembersBefore);
  });

  it("K52-API-040 ログイン中（role が anonymous でない）なのに、その人の members が読めない：新しい本人のログインの印を返さない（signed_in=false・token=null・D-128.137）。確定はする", async () => {
    const other = await otherUser("unreadable-me");
    const om = (await membersOf(other.userId))[0]!;
    const e = email("unreadable-new");
    const t = await pend("unreadable-new");
    // 行の守りに、その人の members の行だけを隠す制限の守りを一時的に足す（セッションの確かめ app.session_check は security definer なので通る）
    await admin.query(
      `create policy k52_hide_me on members as restrictive for select to kaname_app using (id <> '${om.id}'::uuid)`,
    );
    let d: Record<string, unknown> | undefined;
    try {
      d = await verifyOk(t, { headers: bearer(other.token) });
    } finally {
      await admin.query("drop policy if exists k52_hide_me on members");
    }
    expect(d!["signed_in"], "読めなくても、ログインしていない扱いにしない").toBe(false);
    expect(d!["token"] ?? null, "新しい本人のログインの印を返さない").toBeNull();
    expect(await usersOf(e), "確定はする").toHaveLength(1);
    expect(await resolves(other.token), "今のアカウントのまま").toBe(true);
  });
});

describe("K-52 片付けの関数の守りと、確定を始めた後の招待（2 回目のレビュー HIGH-1・HIGH-2・D-128.167）", () => {
  /** 片付けの関数は、確定の処理の役（認証の接続 kaname_auth）だけが呼べる。会社の id と本人の id で呼ぶ。
   *  関数は kaname_auth のスキーマに置く（3 回目のレビュー：kaname_auth に app のスキーマの usage を渡さない・K52-API-049〜051） */
  const dropAs = (pool: pg.Pool, tenantId: string, authUserId: string) =>
    pool.query("select kaname_auth.drop_half_made_company($1::uuid, $2)", [tenantId, authUserId]);
  const contents = async (tenantId: string): Promise<Record<string, number | Date | null>> => {
    const out: Record<string, number> = {};
    for (const table of ["members", "permissions", "clones"])
      out[table] = (await admin.query(`select 1 from ${table} where tenant_id = $1`, [tenantId])).rowCount ?? 0;
    const t = await admin.query<{ h: Date | null }>("select half_made_at as h from tenants where id = $1", [tenantId]);
    return { ...out, halfMade: t.rows[0]?.h ?? null };
  };

  it("K52-API-041 片付けの関数の守り：作られて時間がたった 1 人の会社・運営の会社・人が 2 人いる会社の id で呼んでも何も片付けない。アプリの役（kaname_app）からは呼べない", async () => {
    // ① 作られて時間がたった 1 人の会社（数分以内に作られた会社だけを片付ける）
    const oldOne = await verifyOk(await pend("guard-old", { company: `${RUN}-古い会社` }));
    const om = (await membersOf(await userIdOf(String(oldOne["email"]))))[0]!;
    await admin.query("update tenants set created_at = now() - interval '1 hour' where id = $1", [om.tenant_id]);
    const oldBefore = await contents(om.tenant_id);
    await dropAs(authFixture.pool, om.tenant_id, await userIdOf(String(oldOne["email"])));
    expect(await contents(om.tenant_id), "時間がたった会社は片付けない").toEqual(oldBefore);

    // ② 運営の会社
    const ops = (await admin.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
    const opsBefore = await contents(ops);
    await dropAs(authFixture.pool, ops, await userIdOf(String(oldOne["email"])));
    expect(await contents(ops), "運営の会社は片付けない").toEqual(opsBefore);

    // ③ 人が 2 人いる会社（作ったばかりでも、ほかの人がいれば片付けない）
    const boss = await verifyOk(await pend("guard-two", { company: `${RUN}-二人の会社` }));
    const bossUser = await userIdOf(String(boss["email"]));
    const bm = (await membersOf(bossUser))[0]!;
    const repo = await createRepository(fixturePool);
    const inv = await createInvitation(
      repo,
      { tenantId: bm.tenant_id, userId: bm.id, role: "member" },
      { email: email("guard-two-staff"), roleId: "staff" },
    );
    const ac = await req("POST", `/api/v1/auth/invitations/${inv.token}/accept`, {
      name: "二人目 の人",
      password: PW,
    });
    expect(ac.status, await ac.clone().text()).toBe(201);
    const twoBefore = await contents(bm.tenant_id);
    expect(twoBefore["members"]).toBe(2);
    await dropAs(authFixture.pool, bm.tenant_id, bossUser);
    expect(await contents(bm.tenant_id), "人が 2 人いる会社は片付けない").toEqual(twoBefore);

    // ④ アプリの役（kaname_app）からは呼べない
    const appPool = new pg.Pool({ connectionString: APP_URL, max: 1 });
    try {
      await expect(dropAs(appPool, bm.tenant_id, bossUser)).rejects.toThrow(/permission denied/);
    } finally {
      await appPool.end();
    }
    expect(await contents(bm.tenant_id)).toEqual(twoBefore);
  });

  it("K52-API-042 確定を始めた後に、招待の受け入れ（別の道）で同じメールの本人ができる：確定は 409・E-CONF-001。招待で入った人とその所属は残る（signUp が重複で落ちたら何も消さない・HIGH-1）", async () => {
    const e = email("race-invite");
    const t = await pend("race-invite");
    // 招く会社（同じメールを招く）
    const boss = await verifyOk(await pend("race-invite-boss", { company: `${RUN}-招く会社 2` }));
    const bm = (await membersOf(await userIdOf(String(boss["email"]))))[0]!;
    const repo = await createRepository(fixturePool);
    const inv = await createInvitation(
      repo,
      { tenantId: bm.tenant_id, userId: bm.id, role: "member" },
      { email: e, roleId: "staff" },
    );
    // 段取り：確定の本人の追加（1 本目）だけがロックを待つ。招待の受け入れの追加（2 本目）は待たずに進み、先にコミットする
    const LOCK_KEY = 52042;
    const FIRST_KEY = 52043;
    const holder = await admin.connect();
    await holder.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await admin.query(`create or replace function kaname_auth.k52_race_invite() returns trigger language plpgsql as $$
      begin
        if new.email = '${e}' and pg_try_advisory_xact_lock(${FIRST_KEY}) then perform pg_advisory_xact_lock(${LOCK_KEY}); end if;
        return new;
      end $$`);
    await admin.query(
      'create trigger k52_race_invite before insert on kaname_auth."user" for each row execute function kaname_auth.k52_race_invite()',
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let released = false;
    try {
      const pendingVerify = verify(t);
      await expect
        .poll(
          async () =>
            (
              await admin.query("select 1 from pg_locks where locktype = 'advisory' and objid = $1 and not granted", [
                LOCK_KEY,
              ])
            ).rowCount,
          { timeout: 15_000 },
        )
        .toBe(1);
      const ac = await req("POST", `/api/v1/auth/invitations/${inv.token}/accept`, {
        name: "招かれた 人",
        password: PW,
      });
      expect(ac.status, await ac.clone().text()).toBe(201);
      await holder.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      released = true;
      const r = await pendingVerify;
      expect(r.status, await r.clone().text()).toBe(409);
      expect((await json(r))["code"]).toBe("E-CONF-001");
    } finally {
      spy.mockRestore();
      if (!released) await holder.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      holder.release();
      await admin.query('drop trigger if exists k52_race_invite on kaname_auth."user"');
      await admin.query("drop function if exists kaname_auth.k52_race_invite()");
    }
    const users = await usersOf(e);
    expect(users, "招待で入った本人は残る").toHaveLength(1);
    const ms = await membersOf(users[0]!.id);
    expect(
      ms.map((m) => m.tenant_id),
      "招いた会社の所属も残る",
    ).toEqual([bm.tenant_id]);
  });
});

describe("K-52 片付けが落ちたとき・片付ける相手の見分け（3 回目のレビュー M-A・M-B・M-C・M-D・M-E）", () => {
  const CLEANUP_FAILED = "signup_cleanup_failed"; // 片付けが落ちた出来事（security_events.kind_id）
  const OTHER_PW = "another-horse-battery-9"; // 別の道の本人のパスワード（申し込みの PW と違う・M-B）
  const dbNowAdmin = async () => (await admin.query<{ now: Date }>("select now() as now")).rows[0]!.now;
  const tenantByName = async (name: string) =>
    (
      await admin.query<{ id: string; half_made_at: Date | null }>(
        "select id, half_made_at from tenants where name = $1",
        [name],
      )
    ).rows;
  const countIn = async (table: "members" | "permissions" | "clones", tenantId: string) =>
    (await admin.query(`select 1 from ${table} where tenant_id = $1`, [tenantId])).rowCount ?? 0;
  /** 同意を移す所で落とす（K52-API-038 と同じ形）。会社と本人ができた後に確定を落とすための引き金。外す関数を返す */
  const failAtConsents = async (name: string, e: string) => {
    await admin.query(
      "update kaname_auth.pending_signup set terms_version_id = $2, privacy_version_id = $3, consented_at = now() where email = $1",
      [e, termsId, privacyId],
    );
    await admin.query(`create or replace function public.${name}() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from kaname_auth."user" u where u.id = new.auth_user_id and u.email = '${e}') then
          raise exception 'K-52 の試験：同意を移せない';
        end if;
        return new;
      end $$`);
    await admin.query(
      `create trigger ${name} before insert on terms_consents for each row execute function public.${name}()`,
    );
    return async () => {
      await admin.query(`drop trigger if exists ${name} on terms_consents`);
      await admin.query(`drop function if exists public.${name}()`);
    };
  };
  /** セッションの写し（public.sessions）への書き込みを、その会社の分だけ変える。mode=raise は落とす（セッションの hook が落ちる・M-A）、
   *  mode=skip は黙って書かない（セッションが無く、会社がセッションから引けない・M-C）。外す関数を返す */
  const tamperSessions = async (name: string, company: string, mode: "raise" | "skip") => {
    const act = mode === "raise" ? "raise exception 'K-52 の試験：セッションを写せない'" : "return null";
    await admin.query(`create or replace function public.${name}() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from tenants t where t.id = new.tenant_id and t.name = '${company}') then ${act}; end if;
        return new;
      end $$`);
    await admin.query(
      `create trigger ${name} before insert on sessions for each row execute function public.${name}()`,
    );
    return async () => {
      await admin.query(`drop trigger if exists ${name} on sessions`);
      await admin.query(`drop function if exists public.${name}()`);
    };
  };
  /** 片付けが落ちたことが残っているか：security_events に signup_cleanup_failed があり、detail に会社の id と認証の本人の id が入り、
   *  メールアドレス（とその前半）は入らない（M-D）。運営への知らせ（alertOps・関門 C6）が出ていて、それにもメールアドレスが入らない */
  const expectCleanupFailedRecorded = async (
    since: Date,
    tenantId: string,
    userId: string,
    e: string,
    mailFrom: number,
  ) => {
    const ev = await admin.query<{ d: string }>(
      "select detail::text as d from security_events where kind_id = $1 and occurred_at >= $2",
      [CLEANUP_FAILED, since],
    );
    const mine = ev.rows.filter((x) => x.d.includes(tenantId) && x.d.includes(userId));
    expect(
      mine.length,
      `security_events に ${CLEANUP_FAILED}（detail に会社の id と本人の id）`,
    ).toBeGreaterThanOrEqual(1);
    for (const x of mine) {
      expect(x.d, "detail にメールアドレスを入れない（M-D）").not.toContain(e);
      expect(x.d).not.toContain(e.split("@")[0]!);
    }
    const alerts = mailsTo(OPS_EMAIL, mailFrom);
    expect(alerts.length, "運営への知らせ（alertOps）が出る").toBeGreaterThanOrEqual(1);
    for (const m of alerts) expect(`${m.subject}\n${m.text}`, "知らせにメールアドレスを入れない").not.toContain(e);
  };
  /** 片付けが落ちたまま残った会社の中身と本人を、試験の後で消す（G-10。片付けの関数に頼らず、関数と同じ順で直に） */
  const scrub = async (tenantId: string | null, userId: string | null) => {
    if (tenantId) {
      await admin.query("update tenants set half_made_at = coalesce(half_made_at, now()) where id = $1", [tenantId]);
      for (const table of [
        "sessions",
        "notifications",
        "terms_consents",
        "clones",
        "tenant_memberships",
        "permissions",
        "members",
        "scopes",
      ])
        await admin.query(`delete from ${table} where tenant_id = $1`, [tenantId]);
    }
    if (userId) await admin.query('delete from kaname_auth."user" where id = $1', [userId]);
  };
  /** 確定の本人の追加（1 本目）だけを勧告ロックで待たせ、その間に別の道の本人を足してから放す（K52-API-042 と同じ段取り） */
  const raceWithOtherPath = async (
    t: string,
    e: string,
    keys: [number, number],
    name: string,
    otherPath: () => Promise<void>,
  ) => {
    const [LOCK_KEY, FIRST_KEY] = keys;
    const holder = await admin.connect();
    await holder.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    await admin.query(`create or replace function kaname_auth.${name}() returns trigger language plpgsql as $$
      begin
        if new.email = '${e}' and pg_try_advisory_xact_lock(${FIRST_KEY}) then perform pg_advisory_xact_lock(${LOCK_KEY}); end if;
        return new;
      end $$`);
    await admin.query(
      `create trigger ${name} before insert on kaname_auth."user" for each row execute function kaname_auth.${name}()`,
    );
    let released = false;
    try {
      const pendingVerify = verify(t);
      await expect
        .poll(
          async () =>
            (
              await admin.query("select 1 from pg_locks where locktype = 'advisory' and objid = $1 and not granted", [
                LOCK_KEY,
              ])
            ).rowCount,
          { timeout: 15_000 },
        )
        .toBe(1);
      await otherPath();
      await holder.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      released = true;
      return await pendingVerify;
    } finally {
      if (!released) await holder.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      holder.release();
      await admin.query(`drop trigger if exists ${name} on kaname_auth."user"`);
      await admin.query(`drop function if exists kaname_auth.${name}()`);
    }
  };

  it(`K52-API-043 片付け（会社の中身の片付け drop_half_made_company）が落ちる：500・E-PAGE-003。申し込みの印は戻さない。security_events に ${CLEANUP_FAILED}（detail に会社の id と本人の id・メールは入れない）。運営に知らせる（M-E・M-D）`, async () => {
    const e = email("cleanup-company-fail");
    const company = `${RUN}-片付けで落ちる社`;
    const t = await pend("cleanup-company-fail", { company });
    const undo = await failAtConsents("k52_cf_company", e);
    const since = await dbNowAdmin();
    const mailFrom = mails.length;
    // 片付けを落とす：確定の処理の役（kaname_auth）から片付けの関数を呼べなくする（DB の権限を一時的に外す）
    await admin.query("revoke execute on function kaname_auth.drop_half_made_company(uuid, text) from kaname_auth");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let tid: string | null = null;
    let uid: string | null = null;
    try {
      const r = await verify(t);
      expect(r.status, await r.clone().text()).toBe(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      const ts = await tenantByName(company);
      expect(ts, "会社の行はある").toHaveLength(1);
      tid = ts[0]!.id;
      const left = await admin.query<{ u: string }>("select auth_user_id as u from members where tenant_id = $1", [
        tid,
      ]);
      expect(left.rowCount, "片付けが落ちたので、人は残っている").toBe(1);
      uid = left.rows[0]!.u;
      expect((await pending(e))!.consumed_at, "印は戻さない（作りかけが残ったまま押し直させない）").not.toBeNull();
      await expectCleanupFailedRecorded(since, tid, uid, e, mailFrom);
    } finally {
      spy.mockRestore();
      await admin.query("grant execute on function kaname_auth.drop_half_made_company(uuid, text) to kaname_auth");
      await undo();
      await scrub(tid, uid);
    }
  });

  it(`K52-API-044 片付け（認証の本人の削除）が落ちる：500・E-PAGE-003。申し込みの印は戻さない。security_events に ${CLEANUP_FAILED}（detail に会社の id と本人の id・メールは入れない）。運営に知らせる（M-E・M-D）`, async () => {
    const e = email("cleanup-user-fail");
    const company = `${RUN}-本人の片付けで落ちる社`;
    const t = await pend("cleanup-user-fail", { company });
    const undo = await failAtConsents("k52_cf_user", e);
    const since = await dbNowAdmin();
    const mailFrom = mails.length;
    // 本人の削除を落とす：確定の処理の役（kaname_auth）から認証の本人の表を消せなくする（DB の権限を一時的に外す）
    await admin.query('revoke delete on kaname_auth."user" from kaname_auth');
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let tid: string | null = null;
    let uid: string | null = null;
    try {
      const r = await verify(t);
      expect(r.status, await r.clone().text()).toBe(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      const ts = await tenantByName(company);
      expect(ts).toHaveLength(1);
      tid = ts[0]!.id;
      const users = await usersOf(e);
      expect(users, "本人の削除が落ちたので、本人は残っている").toHaveLength(1);
      uid = users[0]!.id;
      expect((await pending(e))!.consumed_at, "印は戻さない").not.toBeNull();
      await expectCleanupFailedRecorded(since, tid, uid, e, mailFrom);
    } finally {
      spy.mockRestore();
      await admin.query('grant delete on kaname_auth."user" to kaname_auth');
      await undo();
      await scrub(tid, uid);
    }
  });

  it("K52-API-045 会社ができた後（セッションの hook）で signUp が落ちる：E-CONF-001 にしない（500・E-PAGE-003）。この確定で作った本人は消え、会社は「作りかけで止めた」印付きで中身が片付く。印を戻し、押し直すと確定できる（M-A）", async () => {
    const e = email("session-hook-fail");
    const company = `${RUN}-セッションで落ちる社`;
    const t = await pend("session-hook-fail", { company });
    const undo = await tamperSessions("k52_session_raise", company, "raise");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      const j = await json(r);
      expect(j["code"], "この確定で作った本人を、別の道の本人と取り違えない").not.toBe("E-CONF-001");
      expect(r.status).toBe(500);
      expect(j["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await undo();
    }
    expect(await usersOf(e), "この確定で作った本人は消える").toHaveLength(0);
    const ts = await tenantByName(company);
    expect(ts, "会社の行は消さない（D-128.167）").toHaveLength(1);
    expect(ts[0]!.half_made_at, "「作りかけで止めた」印が付く").not.toBeNull();
    for (const table of ["members", "permissions", "clones"] as const)
      expect(await countIn(table, ts[0]!.id), `${table} は片付ける`).toBe(0);
    expect((await pending(e))!.consumed_at, "印を戻す（もう一度押せば確定できる）").toBeNull();
    const d = await verifyOk(t);
    const ms = await membersOf(await userIdOf(String(d["email"])));
    expect(ms.map((m) => m.tenant_name)).toEqual([company]);
    const live = (await tenantByName(company)).filter((x) => x.half_made_at === null);
    expect(live, "印の無い会社がちょうど 1 つ").toHaveLength(1);
    expect(live[0]!.id).toBe(ms[0]!.tenant_id);
  });

  it("K52-API-046 確定の途中に、同じメールの本人が招待の受け入れ（別の道・パスワードが違う）でできる：その本人と所属を消さない。見分けは開いたパスワードで credential が合うか（M-B）", async () => {
    const e = email("race-invite-otherpw");
    const t = await pend("race-invite-otherpw");
    const boss = await verifyOk(await pend("race-invite-otherpw-boss", { company: `${RUN}-招く会社 3` }));
    const bm = (await membersOf(await userIdOf(String(boss["email"]))))[0]!;
    const repo = await createRepository(fixturePool);
    const inv = await createInvitation(
      repo,
      { tenantId: bm.tenant_id, userId: bm.id, role: "member" },
      { email: e, roleId: "staff" },
    );
    let xId = "";
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let r!: Response;
    try {
      r = await raceWithOtherPath(t, e, [52046, 52047], "k52_race_invite_pw", async () => {
        const ac = await req("POST", `/api/v1/auth/invitations/${inv.token}/accept`, {
          name: "招かれた 人",
          password: OTHER_PW,
        });
        expect(ac.status, await ac.clone().text()).toBe(201);
        const u = await usersOf(e);
        expect(u, "招待で入った本人がいる（確定の本人はまだ足されていない）").toHaveLength(1);
        xId = u[0]!.id;
      });
    } finally {
      spy.mockRestore();
    }
    expect(r.status, await r.clone().text()).toBe(409);
    expect((await json(r))["code"]).toBe("E-CONF-001");
    expect(
      (await usersOf(e)).map((u) => u.id),
      "パスワードが違う本人（招待で入った人）は消さない",
    ).toEqual([xId]);
    expect(
      (await membersOf(xId)).map((m) => m.tenant_id),
      "その所属も消さない",
    ).toEqual([bm.tenant_id]);
    expect(await countIn("members", bm.tenant_id), "招いた会社の人は 2 人のまま").toBe(2);
  });

  it("K52-API-047 確定の途中に、同じメールの本人が別の道の登録（作ったばかりの 1 人の会社・パスワードが違う）でできる：会社の守り（数分以内・1 人・運営でない）を全部すり抜ける形でも、credential が合わない本人と会社は片付けない（M-B）", async () => {
    const e = email("race-signup-otherpw");
    const t = await pend("race-signup-otherpw");
    const otherCompany = `${RUN}-別の道の 1 人の会社`;
    let xId = "";
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let r!: Response;
    try {
      r = await raceWithOtherPath(t, e, [52048, 52049], "k52_race_signup_pw", async () => {
        const x = await signUp(authFixture.auth, {
          email: e,
          password: OTHER_PW,
          name: "別の道 三郎",
          companyName: otherCompany,
        });
        xId = x.userId;
      });
    } finally {
      spy.mockRestore();
    }
    expect(r.status, await r.clone().text()).toBe(409);
    expect((await json(r))["code"]).toBe("E-CONF-001");
    expect(
      (await usersOf(e)).map((u) => u.id),
      "パスワードが違う本人は消さない",
    ).toEqual([xId]);
    const ts = await tenantByName(otherCompany);
    expect(ts).toHaveLength(1);
    expect(ts[0]!.half_made_at, "別の道の会社に「作りかけ」の印を付けない").toBeNull();
    expect(
      (await membersOf(xId)).map((m) => m.tenant_id),
      "その所属も消さない",
    ).toEqual([ts[0]!.id]);
    for (const table of ["permissions", "clones"] as const)
      expect(await countIn(table, ts[0]!.id), `${table} も消さない`).toBeGreaterThan(0);
  });

  it(`K52-API-048 片付けるものが残っているのに、会社がセッションから引けない（セッションが無い）：会社は members.auth_user_id から引いて片付ける。片付けられないなら 500・${CLEANUP_FAILED}・印を戻さない。「何も片付けずに印だけ戻す」にしない（M-C）`, async () => {
    const e = email("no-session");
    const company = `${RUN}-セッションの無い社`;
    const t = await pend("no-session", { company });
    const since = await dbNowAdmin();
    const mailFrom = mails.length;
    const undo = await tamperSessions("k52_session_skip", company, "skip");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await verify(t);
      expect(r.status, await r.clone().text()).toBe(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await undo();
    }
    const ts = await tenantByName(company);
    expect(ts, "会社の行はある").toHaveLength(1);
    const tid = ts[0]!.id;
    const users = await usersOf(e);
    const leftMembers = await admin.query<{ u: string }>("select auth_user_id as u from members where tenant_id = $1", [
      tid,
    ]);
    const consumed = (await pending(e))!.consumed_at;
    const cleaned = ts[0]!.half_made_at !== null && leftMembers.rowCount === 0 && users.length === 0;
    expect(
      !cleaned && consumed === null,
      "何も片付けずに印だけ戻してはいけない（作りかけが残ったまま押し直せる）",
    ).toBe(false);
    if (cleaned) {
      // 片付けられた：印を戻し、押し直すと確定できる
      expect(consumed, "片付けたら印を戻す").toBeNull();
      const d = await verifyOk(t);
      const ms = await membersOf(await userIdOf(String(d["email"])));
      expect(ms.map((m) => m.tenant_name)).toEqual([company]);
      expect((await tenantByName(company)).filter((x) => x.half_made_at === null)).toHaveLength(1);
    } else {
      // 片付けられなかった：印は戻さず、片付けの失敗として残し、運営に知らせる
      expect(consumed, "印は戻さない").not.toBeNull();
      const uid = users[0]?.id ?? leftMembers.rows[0]?.u ?? "";
      expect(uid, "残った本人の id").not.toBe("");
      try {
        await expectCleanupFailedRecorded(since, tid, uid, e, mailFrom);
      } finally {
        await scrub(tid, users[0]?.id ?? null);
      }
    }
  });

  /** 照合で確かめられなかったときの記録（MEDIUM-1）：security_events に signup_cleanup_failed があり、detail に tenant_id と auth_user_id の
   *  2 つの欄がある（分かっていればその id・分からなければ null）。メールアドレスは入れない。運営に知らせる */
  const expectUnconfirmedRecorded = async (
    since: Date,
    ids: { tenant_id: string; auth_user_id: string },
    e: string,
    mailFrom: number,
  ) => {
    const ev = await admin.query<{ d: Record<string, unknown>; t: string }>(
      "select detail as d, detail::text as t from security_events where kind_id = $1 and occurred_at >= $2",
      [CLEANUP_FAILED, since],
    );
    const mine = ev.rows.filter(
      (x) =>
        "tenant_id" in x.d &&
        "auth_user_id" in x.d &&
        [null, ids.tenant_id].includes(x.d["tenant_id"] as string | null) &&
        [null, ids.auth_user_id].includes(x.d["auth_user_id"] as string | null),
    );
    expect(
      mine.length,
      `security_events に ${CLEANUP_FAILED}（detail に tenant_id と auth_user_id）`,
    ).toBeGreaterThanOrEqual(1);
    for (const x of mine) {
      expect(x.t, "detail にメールアドレスを入れない").not.toContain(e);
      expect(x.t).not.toContain(e.split("@")[0]!);
    }
    const alerts = mailsTo(OPS_EMAIL, mailFrom);
    expect(alerts.length, "運営への知らせ（alertOps）が出る").toBeGreaterThanOrEqual(1);
    for (const m of alerts) expect(`${m.subject}\n${m.text}`, "知らせにメールアドレスを入れない").not.toContain(e);
  };
  /** 確かめられなかったときに残るもの：本人も会社の中身も消さない・印は戻さない。残った会社と本人の id を返す（後で消す） */
  const expectNothingDropped = async (e: string, company: string) => {
    const users = await usersOf(e);
    expect(users, "本人を消さない（消さない側に倒す）").toHaveLength(1);
    const ts = await tenantByName(company);
    expect(ts).toHaveLength(1);
    expect(ts[0]!.half_made_at, "会社に印を付けない").toBeNull();
    expect(await countIn("members", ts[0]!.id), "会社の人を片付けない").toBe(1);
    expect((await pending(e))!.consumed_at, "印は戻さない").not.toBeNull();
    return { tenant_id: ts[0]!.id, auth_user_id: users[0]!.id };
  };

  it("K52-API-053 照合が合わない（同じメールの本人に credential があるが、いま開いたパスワードで合わない）：消さない・409・E-CONF-001。照合の分岐に入ったことを、照合の部品の呼び出しと、合うときの対照で確かめる（4 回目のレビュー MEDIUM-1）", async () => {
    // 段取り：確定の signUp が本人とパスワードのアカウントを足したあと、セッションの hook で落とす（code は FAILED_TO_CREATE_USER にならない）。
    //   アカウントを足す所で、パスワードのハッシュを別のパスワード（OTHER_PW）のものに差し替える → 照合は合わない
    //   OTHER_PW のハッシュは、別のメールで OTHER_PW の本人を作って借りる
    const x = await signUp(authFixture.auth, {
      email: email("mismatch-hash-src"),
      password: OTHER_PW,
      name: "照合 用",
      companyName: `${RUN}-照合用の会社`,
    });
    const otherPwHash = (
      await admin.query<{ p: string }>(
        `select password as p from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'`,
        [x.userId],
      )
    ).rows[0]!.p;

    const e = email("pw-mismatch");
    const company = `${RUN}-照合が合わない社`;
    const t = await pend("pw-mismatch", { company });
    await admin.query(`create or replace function kaname_auth.k52_swap_hash() returns trigger language plpgsql as $$
      begin
        if new."providerId" = 'credential' and exists (select 1 from kaname_auth."user" u where u.id = new."userId" and u.email = '${e}') then
          new.password := '${otherPwHash}';
        end if;
        return new;
      end $$`);
    await admin.query(
      "create trigger k52_swap_hash before insert on kaname_auth.account for each row execute function kaname_auth.k52_swap_hash()",
    );
    const undo = await tamperSessions("k52_session_raise_mm", company, "raise");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const callsFrom = probe.credentialCalls.length;
    let uid = "";
    let tid = "";
    try {
      const r = await verify(t);
      expect(r.status, await r.clone().text()).toBe(409);
      expect((await json(r))["code"]).toBe("E-CONF-001");
      const users = await usersOf(e);
      expect(users, "合わない本人は消さない").toHaveLength(1);
      uid = users[0]!.id;
      expect(probe.credentialCalls.slice(callsFrom), "照合の部品（credentialHashOf）がこの本人で呼ばれた").toContain(
        uid,
      );
      const ts = await tenantByName(company);
      expect(ts).toHaveLength(1);
      tid = ts[0]!.id;
      expect(ts[0]!.half_made_at, "会社に印を付けない").toBeNull();
      expect(await countIn("members", tid), "会社の人を片付けない").toBe(1);
    } finally {
      spy.mockRestore();
      await undo();
      await admin.query("drop trigger if exists k52_swap_hash on kaname_auth.account");
      await admin.query("drop function if exists kaname_auth.k52_swap_hash()");
      await scrub(tid || null, uid || null);
    }
    // 対照：同じ段取りでハッシュを差し替えない（照合が合う）と、この確定で作った本人として片付く（500・本人が消える）。
    //   照合でなく「アカウントがあるから別の道」と決める道を通っていれば、こちらも 409 になる
    const e2 = email("pw-match");
    const company2 = `${RUN}-照合が合う社`;
    const t2 = await pend("pw-match", { company: company2 });
    const undo2 = await tamperSessions("k52_session_raise_ok", company2, "raise");
    const spy2 = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r2 = await verify(t2);
      expect(r2.status, await r2.clone().text()).toBe(500);
      expect(await usersOf(e2), "照合が合えば、この確定で作った本人として消える").toHaveLength(0);
    } finally {
      spy2.mockRestore();
      await undo2();
    }
  });

  it(`K52-API-054 照合が例外になる（credential の読み出しが投げる）：消さない側に倒し、500・E-PAGE-003。${CLEANUP_FAILED}（detail は tenant_id と auth_user_id・メールなし）・運営に知らせる・印を戻さない（4 回目のレビュー MEDIUM-1）`, async () => {
    const e = email("pw-throw");
    const company = `${RUN}-照合が投げる社`;
    const t = await pend("pw-throw", { company });
    const undo = await tamperSessions("k52_session_raise_th", company, "raise");
    const since = await dbNowAdmin();
    const mailFrom = mails.length;
    const callsFrom = probe.credentialCalls.length;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    probe.throwCredential = true;
    let ids: { tenant_id: string; auth_user_id: string } | null = null;
    try {
      const r = await verify(t);
      expect(r.status, await r.clone().text()).toBe(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      expect(probe.credentialCalls.length, "照合の部品が呼ばれた（その中で投げた）").toBeGreaterThan(callsFrom);
      ids = await expectNothingDropped(e, company);
      await expectUnconfirmedRecorded(since, ids, e, mailFrom);
    } finally {
      probe.throwCredential = false;
      spy.mockRestore();
      await undo();
      if (!ids) {
        const u = (await usersOf(e))[0]?.id ?? null;
        await scrub((await tenantByName(company))[0]?.id ?? null, u);
      } else await scrub(ids.tenant_id, ids.auth_user_id);
    }
  });

  it(`K52-API-055 signUp が落ちた後に同じメールの本人を引けない（signUpFailed の e2 の catch）：消さない側に倒し、500・E-PAGE-003。${CLEANUP_FAILED}（detail は tenant_id と auth_user_id・メールなし）・運営に知らせる・印を戻さない（4 回目のレビュー MEDIUM-1）`, async () => {
    const e = email("lookup-throw");
    const company = `${RUN}-本人を引けない社`;
    const t = await pend("lookup-throw", { company });
    const undo = await tamperSessions("k52_session_raise_lk", company, "raise");
    const since = await dbNowAdmin();
    const mailFrom = mails.length;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    probe.throwLookupFor.add(e.toLowerCase());
    let ids: { tenant_id: string; auth_user_id: string } | null = null;
    try {
      const r = await verify(t);
      expect(r.status, await r.clone().text()).toBe(500);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      ids = await expectNothingDropped(e, company);
      await expectUnconfirmedRecorded(since, ids, e, mailFrom);
    } finally {
      probe.throwLookupFor.delete(e.toLowerCase());
      spy.mockRestore();
      await undo();
      if (!ids) {
        const u = (await usersOf(e))[0]?.id ?? null;
        await scrub((await tenantByName(company))[0]?.id ?? null, u);
      } else await scrub(ids.tenant_id, ids.auth_user_id);
    }
  });
});
