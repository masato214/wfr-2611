// 段 13「運営のログイン」まわりの試験の共通の土台（K-944 が切る段で書いた。K-945・K-1003 の口の試験も使う）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては段 2 のログインの土台（F1/login.harness.ts の setupLogin・本番と同じ bootApi）をそのまま使い、運営の人を作る所だけ足す:
//   ・運営の人：認証の部品の利用者（パスワードなし・確認済み）＋運営の会社（app.ops_tenant_id()）の members の行＋ops_members（できること caps）
//   ・パスキー：仮の認証器（P-256・ES256）を部品の表 kaname_auth.passkey に直に置き、応答を組んで部品の口で入る（K-304 の試験と同じ形）
//   ・顧客の会社：運営が指す先の会社（tenants と scopes の行だけ）
// 作った行は名前の頭（run）で見分ける。運営の会社そのもの（0003 が作る行）は消さない。
import { afterAll, expect } from "vitest";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from "node:crypto";
import pg from "pg";
import { createSessionResolver } from "@kaname/auth/resolver";
import { setupLogin, PW, UA_MAC, type Login } from "../F1/login.harness.js";

export { PW, UA_MAC };
/** 運営の会社（0003 の app.ops_tenant_id()） */
export const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
/** 運営のできること 9 つ（0078 の ops_members_caps_ck） */
export const ALL_CAPS = [
  "inquiry",
  "peek",
  "money",
  "stop",
  "notice",
  "distribute",
  "plan_propose",
  "plan_decide",
  "ops_people",
] as const;
/** 運営はパスキーでしか入れない（K-944 で足す番号） */
export const OPS_PASSKEY_ONLY = "E-AUTH-022";

const WEB = "http://127.0.0.1:3123"; // 土台（login.harness.ts）の config.webBaseUrl。画面の origin
const RP_ID = new URL(WEB).hostname;
const OPTIONS = "/api/auth/passkey/generate-authenticate-options";
const VERIFY = "/api/auth/passkey/verify-authentication";
const APP_URL = process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");

export interface Authenticator {
  credentialId: Buffer;
  privateKey: KeyObject;
  cose: Buffer;
}
export interface OpsPerson {
  email: string;
  userId: string;
  memberId: string;
}
export interface Ops {
  h: Login;
  /** 運営の人を作る（パスワードなし）。caps を省くと 9 つ全部 */
  makeOps: (tag: string, o?: { caps?: readonly string[]; password?: boolean }) => Promise<OpsPerson>;
  /** 運営の会社の人だが運営の人の行（ops_members）が無い人 */
  makeOpsTenantOnly: (tag: string) => Promise<OpsPerson>;
  /** 仮の認証器を作って、その人のパスキーとして部品の表に置く */
  addPasskey: (userId: string) => Promise<Authenticator>;
  /** パスキーで入る（チャレンジ → 応答 → 送る）。答えをそのまま返す */
  passkeySignIn: (userId: string, a: Authenticator, ua?: string) => Promise<Response>;
  /** 答えの頭のセッションの印 */
  tokenOf: (r: Response) => string | null;
  /** 本物の解き方で解いた結果（解けなければ null） */
  resolve: (token: string, ua?: string) => Promise<Awaited<ReturnType<ReturnType<typeof createSessionResolver>>>>;
  /** 顧客の会社を 1 つ作る（tenants と scopes） */
  company: (name: string) => Promise<string>;
  /** 契約の口を Bearer で呼ぶ */
  api: (
    method: string,
    path: string,
    token: string | null,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<Response>;
}

const b64u = (b: Buffer) => b.toString("base64url");
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest();
const cborBytes = (b: Buffer) => Buffer.concat([Buffer.from([0x58, b.length]), b]);

export function makeAuthenticator(): Authenticator {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  // COSE_Key { 1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y }
  const cose = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]),
    cborBytes(Buffer.from(jwk.x, "base64url")),
    Buffer.from([0x22]),
    cborBytes(Buffer.from(jwk.y, "base64url")),
  ]);
  return { credentialId: randomBytes(32), privateKey, cose };
}

/** 認証器の応答（AuthenticationResponseJSON・署名の回数は毎回 1 つ進める）。運営の人をパスキーで入れるほかの試験（F1/terms.test.ts）も使う */
export function assertion(a: Authenticator, userId: string, challenge: string, counter: number) {
  const cnt = Buffer.alloc(4);
  cnt.writeUInt32BE(counter);
  const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x05]), cnt]); // UP + UV
  const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: WEB, crossOrigin: false }));
  const signature = sign("sha256", Buffer.concat([authData, sha256(clientData)]), a.privateKey);
  return {
    id: b64u(a.credentialId),
    rawId: b64u(a.credentialId),
    type: "public-key",
    response: {
      authenticatorData: b64u(authData),
      clientDataJSON: b64u(clientData),
      signature: b64u(signature),
      userHandle: b64u(Buffer.from(userId)),
    },
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
}

/** 各試験のファイルの頭で 1 回呼ぶ（中で段 2 の setupLogin を呼ぶ） */
export function setupOps(prefix: string): Ops {
  const h = setupLogin(prefix);
  let pool: pg.Pool | null = null;
  const appPool = () => (pool ??= new pg.Pool({ connectionString: APP_URL, max: 2 }));
  const counters = new Map<string, number>();
  const made: string[] = [];
  afterAll(async () => {
    if (made.length) {
      await h.admin.query("delete from ops_members where member_id = any($1::uuid[])", [made]);
    }
    await pool?.end();
  });

  const opsScope = async (): Promise<string> => {
    const r = await h.admin.query<{ id: string }>(
      "select id from scopes where tenant_id = $1 and deleted_at is null order by created_at limit 1",
      [OPS_TENANT],
    );
    if (r.rows[0]) return r.rows[0].id;
    const ins = await h.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '運営の全体', '') returning id",
      [OPS_TENANT],
    );
    return ins.rows[0]!.id;
  };

  const authUser = async (tag: string, password: boolean): Promise<{ email: string; userId: string }> => {
    const email = h.email(tag);
    const ctx = await h.auth.$context;
    const u = await ctx.internalAdapter.createUser({ email, name: `運営 ${tag}`, emailVerified: true });
    if (password)
      await ctx.internalAdapter.linkAccount({
        userId: u.id,
        providerId: "credential",
        accountId: u.id,
        password: await ctx.password.hash(PW),
      });
    return { email, userId: u.id };
  };

  const opsMember = async (tag: string, userId: string): Promise<string> => {
    const scope = await opsScope();
    const r = await h.admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values ($1, $2, 'human', $3, $4) returning id",
      [OPS_TENANT, scope, `運営 ${tag}`, userId],
    );
    return r.rows[0]!.id;
  };

  const makeOps: Ops["makeOps"] = async (tag, o = {}) => {
    const { email, userId } = await authUser(tag, o.password === true);
    const memberId = await opsMember(tag, userId);
    await h.admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, $3)", [
      OPS_TENANT,
      memberId,
      [...(o.caps ?? ALL_CAPS)],
    ]);
    made.push(memberId);
    return { email, userId, memberId };
  };

  const makeOpsTenantOnly: Ops["makeOpsTenantOnly"] = async (tag) => {
    const { email, userId } = await authUser(tag, false);
    const memberId = await opsMember(tag, userId);
    return { email, userId, memberId };
  };

  const addPasskey: Ops["addPasskey"] = async (userId) => {
    const a = makeAuthenticator();
    await h.admin.query(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values ($1, $2, $3, $4, $5, 0, 'singleDevice', false, 'internal', now())`,
      [randomUUID(), `${h.run}-鍵`, a.cose.toString("base64"), userId, b64u(a.credentialId)],
    );
    return a;
  };

  const passkeySignIn: Ops["passkeySignIn"] = async (userId, a, ua = UA_MAC) => {
    const head = { "user-agent": ua, origin: WEB };
    const opt = await h.req("GET", OPTIONS, undefined, { headers: head });
    expect(opt.status, await opt.clone().text()).toBe(200);
    const j = (await opt.json()) as Record<string, unknown>;
    const key = b64u(a.credentialId);
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return h.req(
      "POST",
      VERIFY,
      { response: assertion(a, userId, String(j["challenge"]), n) },
      { headers: { ...head, "x-passkey-challenge": String(j["challenge_token"]) } },
    );
  };

  const tokenOf: Ops["tokenOf"] = (r) => r.headers.get("set-auth-token");

  const resolve: Ops["resolve"] = async (token, ua = UA_MAC) =>
    createSessionResolver(h.auth, appPool())(new Headers({ authorization: `Bearer ${token}`, "user-agent": ua }));

  const company: Ops["company"] = async (name) => {
    const t = await h.admin.query<{ id: string }>(
      "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
      [`${h.run} ${name}`],
    );
    const id = t.rows[0]!.id;
    await h.admin.query("insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '')", [
      id,
      `${name} の全体`,
    ]);
    return id;
  };

  const api: Ops["api"] = (method, path, token, body, headers = {}) =>
    h.req(method, path, body, {
      headers: { "user-agent": UA_MAC, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    });

  return { h, makeOps, makeOpsTenantOnly, addPasskey, passkeySignIn, tokenOf, resolve, company, api };
}
