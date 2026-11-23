// K-303「止められた人と会社を、セッションを作る前の 1 か所で断る」の単体の試験（口・本物の DB）。
// テストの名前の頭の行 ID（K303-DB-…・K303-API-…）は 11_tickets/K-303.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 土台は K-301 の login.harness.ts（本番と同じ bootApi・確定した本人 makeUser・契約の口 signIn）。登録のときにできたセッションは土台の準備が閉じる
//   （段 2 の精査の後の決め 7）。それでも数の確かめは「断る前と後の差が 0」「入った後の差が 1」で比べる（準備に左右されない）。
// 止める操作（運営の「止める」F12・管理者の suspendMember F8）はまだ無いので、止めは DB に直に書く。
//
// 試験が決める形:
//   app.login_gate(p_auth_user_id text) returns text … 'ok' | 'member_suspended' | 'workspace_suspended' | 'member_left' だけを返す
//     member の行と、同じ (tenant_id, member_id) の所属の行（tenant_memberships）を組にして見る。
//     止めたときは、その人のワークスペースの security_events に kind_id 'login_blocked' と detail { reason } を 1 行残す（'ok' のときは残さない）
//   止めは packages/auth の databaseHooks.session.create.before の 1 か所。投げるのは better-auth の APIError で、body.code が errors.json の id
//   契約の口 signInWithPassword（K-301）は、止めで断られたら 403 と id と文を返す（止めの確かめが落ちたら 503・E-PAGE-003）
//     E-AUTH-011 人が止められている／E-AUTH-012 会社が止められている／E-AUTH-007 会社の人が無い・抜けた（番号は決め打ち・精査の後の決め 1）
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { emailHash, signUp } from "@kaname/auth/signup";
import { signIn as partsSignIn, verifyTotp } from "@kaname/auth/two_factor";
import { CATALOG } from "@kaname/errors";
import { PW, UA_MAC, awayFromStepEdge, setupLogin, totp, type User } from "./login.harness.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const MEMBER_SUSPENDED = "E-AUTH-011";
const WORKSPACE_SUSPENDED = "E-AUTH-012";
const NO_MEMBER = "E-AUTH-007";
const MSG_MEMBER = "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください"; // D-128.141
const MSG_WORKSPACE =
  "このワークスペースは、いま止められています。データは残っています。管理者か運営に連絡してください"; // D-128.141

const h = setupLogin("k303");

const gate = async (userId: string) =>
  (await h.admin.query<{ r: string }>("select app.login_gate($1) as r", [userId])).rows[0]!.r;
const suspendMember = (u: User) =>
  h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [u.memberId]);
const resumeMember = (u: User) =>
  h.admin.query("update members set suspended_at = null, suspended_by = null where id = $1", [u.memberId]);
const suspendWorkspace = (u: User) =>
  h.admin.query(
    "insert into subscriptions (tenant_id, status_id, started_at, suspended_at) values ($1, 'active', now(), now())",
    [u.tenantId],
  );
const leave = (u: User) => h.admin.query("update members set deleted_at = now() where id = $1", [u.memberId]);
const membership = (u: User, status: "suspended" | "left") =>
  h.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', $4) on conflict (tenant_id, member_id) do update set role = 'member', status = excluded.status, deleted_at = null", // 会社を作った人は admin の行を持つ（D-148.49）
    [u.tenantId, u.memberId, u.userId, status],
  );
/** 認証側（kaname_auth.session）と業務側（生きている画面の sessions）のセッションの数 */
const counts = async (u: User) => ({ auth: await h.authSessions(u.userId), app: await h.liveSessions(u.memberId) });
const failsOf = async (e: string) => (await h.attempts(e))?.fails ?? 0;
const blockedEvents = async (u: User) =>
  (
    await h.admin.query<{ detail: Record<string, unknown> }>(
      "select detail from security_events where tenant_id = $1 and kind_id = 'login_blocked' order by occurred_at",
      [u.tenantId],
    )
  ).rows;
/** 403 と、止めの id と文。印も待ちの印も返さない */
const expectRefused = async (r: Response, code: string, message?: string) => {
  const text = await r.clone().text();
  expect(r.status, text).toBe(403);
  const j = await h.json(r);
  expect(j["code"]).toBe(code);
  if (message) expect(j["message"]).toBe(message);
  expect(j["data"], "セッションの印も待ちの印も返さない").toBeUndefined();
  return text;
};
/** 部品の関数が投げた例外の body.code（better-auth の APIError） */
const codeOfError = async (p: Promise<unknown>) => {
  const e = await p.then(
    () => null,
    (x: unknown) => x as { body?: { code?: string } },
  );
  expect(e, "例外になる（セッションを作らない）").not.toBeNull();
  return e?.body?.code;
};

describe("K-303 止めの関数（app.login_gate）", () => {
  it("K303-DB-001 ふつうの人（止められていない・会社も止められていない）：'ok' を返し、記録は残さない", async () => {
    const u = await h.makeUser("db-ok");
    expect(await gate(u.userId)).toBe("ok");
    expect(await blockedEvents(u)).toEqual([]);
  });

  it("K303-DB-002 人が止められた（members.suspended_at）：'member_suspended'", async () => {
    const u = await h.makeUser("db-member");
    await suspendMember(u);
    expect(await gate(u.userId)).toBe("member_suspended");
  });

  it("K303-DB-003 同じ member の所属の行が止められた（tenant_memberships.status = suspended）：'member_suspended'（両方を見る・answer=75dc21e85b2e）", async () => {
    const u = await h.makeUser("db-membership");
    await membership(u, "suspended");
    expect(await gate(u.userId)).toBe("member_suspended");
  });

  it("K303-DB-004 会社が止められた（subscriptions.suspended_at）：'workspace_suspended'。人も会社も止められていれば人の方（'member_suspended'）", async () => {
    const u = await h.makeUser("db-ws");
    await suspendWorkspace(u);
    expect(await gate(u.userId)).toBe("workspace_suspended");
    await suspendMember(u);
    expect(await gate(u.userId)).toBe("member_suspended");
  });

  it("K303-DB-005 抜けた：member の行が消された（deleted_at）・member の行は生きていて同じ組の所属の行が left、のどちらも 'member_left'", async () => {
    const a = await h.makeUser("db-left-a");
    await leave(a);
    expect(await gate(a.userId)).toBe("member_left");
    const b = await h.makeUser("db-left-b");
    await membership(b, "left");
    expect(await gate(b.userId)).toBe("member_left");
  });

  it("K303-DB-006 まだ会社に属していない利用者（招待の受諾の途中・会社を作らない登録）：'ok'（登録と招待の道を止めない）", async () => {
    const r = await signUp(h.auth, { email: h.email("db-nomember"), password: PW, name: "まだ 属していない" });
    expect(await gate(r.userId)).toBe("ok");
  });

  it("K303-DB-007 止めを外した直後（suspended_at を空に戻した 0 秒後）：'ok'（D-125.126 再開すれば元に戻る）", async () => {
    const u = await h.makeUser("db-resume");
    await suspendMember(u);
    expect(await gate(u.userId)).toBe("member_suspended");
    await resumeMember(u);
    expect(await gate(u.userId)).toBe("ok");
  });

  it("K303-DB-008 止めたときの記録：その人のワークスペースに login_blocked を 1 行・detail は理由だけ（メール・名前・IP を入れない）", async () => {
    const u = await h.makeUser("db-record");
    await suspendMember(u);
    await gate(u.userId);
    const ev = await blockedEvents(u);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.detail).toEqual({ reason: "member_suspended" });
    expect(JSON.stringify(ev[0])).not.toContain(u.email);
  });

  it("K303-DB-009 関数の形と権限：返すのは text だけ。kaname_app は呼べ、誰でも（PUBLIC）は呼べない", async () => {
    const f = (
      await h.admin.query<{ result: string; acl: string | null; ok: boolean }>(
        `select pg_get_function_result(p.oid) as result, p.proacl::text as acl,
                has_function_privilege('kaname_app', p.oid, 'execute') as ok
           from pg_proc p where p.oid = 'app.login_gate(text)'::regprocedure`,
      )
    ).rows[0]!;
    expect(f.result).toBe("text");
    expect(f.ok).toBe(true);
    expect(f.acl ?? "", "PUBLIC に execute を与えていない").not.toMatch(/(^|[{,])=X/);
  });
});

describe("K-303 パスワードの道（契約の口 signInWithPassword）", () => {
  it("K303-API-001 人が止められた × 正しいパスワード：403・E-AUTH-011 と文。セッションは認証側にも業務側にも増えない。失敗の数に入れない", async () => {
    const u = await h.makeUser("api-member");
    await suspendMember(u);
    const [before, fails] = [await counts(u), await failsOf(u.email)];
    await expectRefused(await h.signIn(u.email), MEMBER_SUSPENDED, MSG_MEMBER);
    expect(await counts(u)).toEqual(before);
    expect(await failsOf(u.email)).toBe(fails);
  });

  it("K303-API-002 会社が止められた × 正しいパスワード：403・E-AUTH-012 と文。セッションは増えない。データ（人・会社）は残る", async () => {
    const u = await h.makeUser("api-ws");
    await suspendWorkspace(u);
    const before = await counts(u);
    await expectRefused(await h.signIn(u.email), WORKSPACE_SUSPENDED, MSG_WORKSPACE);
    expect(await counts(u)).toEqual(before);
    const still = await h.admin.query("select 1 from members where id = $1 and deleted_at is null", [u.memberId]);
    expect(still.rowCount, "人は消えない").toBe(1);
  });

  it("K303-API-003 会社から抜けた × 正しいパスワード：403・E-AUTH-007。セッションは増えない", async () => {
    const u = await h.makeUser("api-left");
    await leave(u);
    const before = await counts(u);
    await expectRefused(await h.signIn(u.email), NO_MEMBER);
    expect(await counts(u)).toEqual(before);
  });

  it("K303-API-004 止められた × 違うパスワード：401・E-AUTH-001（止めの有無を探らせない）。失敗は 1 回数える", async () => {
    const u = await h.makeUser("api-wrongpw");
    await suspendMember(u);
    const fails = await failsOf(u.email);
    const r = await h.signIn(u.email, "wrong-password-0000");
    expect(r.status, await r.clone().text()).toBe(401);
    expect((await h.json(r))["code"]).toBe("E-AUTH-001");
    expect(await failsOf(u.email)).toBe(fails + 1);
  });

  it("K303-API-005 2 段階を付けた人 × 止められた × 正しいパスワード：パスワードの段で 403・E-AUTH-011。待ちの印を返さない（6 けたの画面に進ませない）", async () => {
    const u = await h.makeUser("api-2fa", { twoFactor: true });
    await suspendMember(u);
    const before = await counts(u);
    await expectRefused(await h.signIn(u.email), MEMBER_SUSPENDED, MSG_MEMBER);
    expect(await counts(u)).toEqual(before);
  });

  it("K303-API-006 パスワードを通って待ちの印を持った直後に止められた（G-12）× 正しい 6 けた：部品が止めの E-AUTH-011 で断り、セッションは増えない（6 けたの道も同じ 1 か所）", async () => {
    const u = await h.makeUser("api-2fa-race", { twoFactor: true });
    const si = await partsSignIn(h.auth, u.email, PW, UA_MAC);
    expect(si.twoFactor, "待ちの印を持った").toBe(true);
    await suspendMember(u);
    const before = await counts(u);
    await awayFromStepEdge();
    const code = await codeOfError(
      verifyTotp(h.auth, new Headers({ cookie: si.cookie, "user-agent": UA_MAC }), totp(u.secret!)),
    );
    expect(code).toBe(MEMBER_SUSPENDED);
    expect(await counts(u)).toEqual(before);
  });

  it("K303-API-007 止めを外した直後に入る：201 でセッションが認証側と業務側に 1 つずつ増える", async () => {
    const u = await h.makeUser("api-resume");
    await suspendMember(u);
    await expectRefused(await h.signIn(u.email), MEMBER_SUSPENDED);
    await resumeMember(u);
    const before = await counts(u);
    const r = await h.signIn(u.email);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await counts(u)).toEqual({ auth: before.auth + 1, app: before.app + 1 });
  });

  it("K303-API-008 部品を直に呼ぶ道（Kaname の口を通らない auth.api.signInEmail）でも、止めの E-AUTH-011 で断られ、セッションは増えない", async () => {
    const u = await h.makeUser("api-direct");
    await suspendMember(u);
    const before = await counts(u);
    const code = await codeOfError(
      h.auth.api.signInEmail({
        headers: new Headers({ "user-agent": UA_MAC }),
        body: { email: u.email, password: PW },
      }),
    );
    expect(code).toBe(MEMBER_SUSPENDED);
    expect(await counts(u)).toEqual(before);
  });

  it("K303-API-009 まだ会社に属していない利用者の登録（会社を作らない signUp・招待の受諾の途中）：自動のログインのセッションはできる（止めない）", async () => {
    const r = await signUp(h.auth, { email: h.email("api-nomember"), password: PW, name: "まだ 属していない" });
    expect(r.token, "登録の自動ログインの印がある").toBeTruthy();
    expect(await h.authSessions(r.userId)).toBe(1);
  });

  it("K303-API-010 止めの関数が読めない（実行の権限を一時的に外す）：止める側に倒す。503・E-PAGE-003。セッションは増えず、失敗の数にも入れない", async () => {
    const u = await h.makeUser("api-gate-down");
    const [before, fails] = [await counts(u), await failsOf(u.email)];
    await h.admin.query("revoke execute on function app.login_gate(text) from kaname_app");
    let status = 0;
    let code: unknown = null;
    try {
      await h.captureLogs(async () => {
        const r = await h.signIn(u.email);
        status = r.status;
        code = (await h.json(r))["code"];
      });
    } finally {
      await h.admin.query("grant execute on function app.login_gate(text) to kaname_app");
    }
    expect(status).toBe(503);
    expect(code).toBe("E-PAGE-003");
    expect(await counts(u)).toEqual(before);
    expect(await failsOf(u.email)).toBe(fails);
  });

  it("K303-API-011 記録とログ：止めで断ったことが security_events に 1 行（理由）。ログにメール・パスワード・IP が出ない", async () => {
    const u = await h.makeUser("api-log");
    await suspendMember(u);
    const log = await h.captureLogs(async () => {
      await expectRefused(await h.signIn(u.email, PW, { ip: "192.0.2.203" }), MEMBER_SUSPENDED);
    });
    const ev = await blockedEvents(u);
    expect(ev.map((e) => e.detail["reason"])).toEqual(["member_suspended"]);
    for (const secret of [u.email, u.email.split("@")[0]!, PW, "192.0.2.203"]) expect(log).not.toContain(secret);
  });

  it("K303-API-012 断った答えに、ワークスペースの名前・id・人の id を出さない", async () => {
    const u = await h.makeUser("api-leak", { company: `${h.run} 漏れない会社` });
    await suspendWorkspace(u);
    const text = await expectRefused(await h.signIn(u.email), WORKSPACE_SUSPENDED);
    for (const s of [u.tenantId, u.memberId, u.userId, `${h.run} 漏れない会社`]) expect(text).not.toContain(s);
  });

  it("K303-API-013 ロック中の止められた人 × 正しいパスワード：429・E-AUTH-002（ロックを先に見る。止めの有無は出さない）", async () => {
    const u = await h.makeUser("api-locked");
    await suspendMember(u);
    await h.admin.query(
      "insert into app.login_attempts (email_hash, fails, first_failed_at, locked_until) values ($1, 5, now(), now() + interval '15 minutes') on conflict (email_hash) do update set fails = 5, locked_until = now() + interval '15 minutes'",
      [emailHash(u.email)],
    );
    const r = await h.signIn(u.email);
    expect(r.status, await r.clone().text()).toBe(429);
    expect((await h.json(r))["code"]).toBe("E-AUTH-002");
  });

  it("K303-API-014 規約の新しい版が出ている（同意を消す）× 止められた人：403・E-AUTH-011（同意の画面に進ませない。止めが先）", async () => {
    const u = await h.makeUser("api-terms");
    await h.admin.query("delete from terms_consents where member_id = $1", [u.memberId]);
    await suspendMember(u);
    const before = await counts(u);
    await expectRefused(await h.signIn(u.email), MEMBER_SUSPENDED);
    expect(await counts(u)).toEqual(before);
  });
});

describe("K-303 正本と関門", () => {
  it("K303-API-015 errors.json：E-AUTH-011・E-AUTH-012 が D-128.141 の文で載り、根拠に D-128.141（012 は D-125.126 も）・層に API と DB・support_code", () => {
    const e11 = CATALOG[MEMBER_SUSPENDED];
    const e12 = CATALOG[WORKSPACE_SUSPENDED];
    expect(e11?.message).toBe(MSG_MEMBER);
    expect(e12?.message).toBe(MSG_WORKSPACE);
    const raw = JSON.parse(readFileSync(join(ROOT, "07_qa", "test-specs", "errors.json"), "utf8")) as {
      errors: { id: string; source?: string[]; layers?: string[]; support_code?: string }[];
    };
    const by = (id: string) => raw.errors.find((e) => e.id === id);
    expect(by(MEMBER_SUSPENDED)?.source).toContain("D-128.141");
    expect(by(WORKSPACE_SUSPENDED)?.source).toEqual(expect.arrayContaining(["D-128.141", "D-125.126"]));
    for (const id of [MEMBER_SUSPENDED, WORKSPACE_SUSPENDED])
      expect(by(id)?.layers).toEqual(expect.arrayContaining(["API", "DB"]));
    expect(by(MEMBER_SUSPENDED)?.support_code).toBe("AUTH-011");
    expect(by(WORKSPACE_SUSPENDED)?.support_code).toBe("AUTH-012");
  });

  it("K303-API-016 関門：止めは packages/auth の databaseHooks.session.create.before の関数の中で app.login_gate を呼ぶ 1 か所だけ（ほかの hook・apps/api では呼ばない）", () => {
    const src = readFileSync(join(ROOT, "packages", "auth", "src", "index.ts"), "utf8");
    const hooks = src.slice(src.indexOf("databaseHooks"));
    const session = hooks.slice(hooks.search(/\bsession:\s*\{/));
    const create = session.slice(session.search(/\bcreate:\s*\{/));
    const beforeAt = create.search(/\bbefore:/);
    const afterAt = create.search(/\bafter:/);
    expect(beforeAt, "session.create に before がある").toBeGreaterThanOrEqual(0);
    const beforeBody = afterAt > beforeAt ? create.slice(beforeAt, afterAt) : create.slice(beforeAt);
    expect(beforeBody).toContain("app.login_gate");
    const all = src.split("app.login_gate").length - 1;
    expect(all, "index.ts の中でも before の 1 か所だけ").toBe(beforeBody.split("app.login_gate").length - 1);
    const callers = execFileSync("git", ["grep", "-l", "app.login_gate", "--", "apps/api/src", "packages/auth/src"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .trim()
      .split("\n");
    expect(callers).toEqual(["packages/auth/src/index.ts"]);
  });
});
