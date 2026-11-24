// K-944「運営のログイン」の単体の試験（本物の DB・本物のログインの部品・本番と同じ bootApi）。
// テストの名前の頭の行 ID（K944-API-…）は 11_tickets/K-944.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める形（K-944 が決める本体）:
//   ・運営の人（運営の会社の members ＋ 生きている ops_members）がパスキーで入ると、解決は role "ops"・tenantId null・userId は members.id。
//     同意し直しの印（K-53）と付けるまで進めないの印（K-308）は運営のセッションに立てない（顧客の規約の印・運営はパスキーを持つ）
//   ・運営の人がパスキー以外（パスワード）で入ろうとすると、部品の止め（セッションの before）が 403 E-AUTH-022 で断り、セッションを作らない
//   ・セッションには入り方 sessions.login_kind を残す（パスキーは 'passkey'）。解決は運営の人の 'passkey' のセッションだけを運営として解く（2 層目）
//   ・ops_members を外す（revoked_at・deleted_at）と、その時点から同じ印が解けない（401）
import { describe, expect, it } from "vitest";
import { CATALOG } from "@kaname/errors";
import { setupOps, OPS_PASSKEY_ONLY, PW, UA_MAC } from "./ops.harness.js";

const o = setupOps("k944");
const { h } = o;
const OPS_SHELL = "/api/v1/ops/shell";
const MOCK_TEXT = "運営の場所は、パスキーしか使えません（メールとパスワードでは入れません）";

const sessionRow = async (memberId: string) =>
  (
    await h.admin.query<{ id: string; login_kind: string | null; revoked_at: Date | null }>(
      "select id, login_kind, revoked_at from sessions where member_id = $1 order by issued_at desc limit 1",
      [memberId],
    )
  ).rows[0];
const signedInOps = async (tag: string, caps?: readonly string[]) => {
  const p = await o.makeOps(tag, caps ? { caps } : {});
  const a = await o.addPasskey(p.userId);
  const r = await o.passkeySignIn(p.userId, a);
  expect(r.status, await r.clone().text()).toBe(200);
  const t = o.tokenOf(r);
  expect(t, "セッションの印").toBeTruthy();
  return { p, a, token: t! };
};

describe("K-944 運営のログイン：パスキーで入る", () => {
  it("K944-API-001 運営の人 × パスキーで入る：200 と印。解決は role ops・tenantId null・userId は運営の会社の members.id・同意し直しと付けるまで進めないの印は立たない", async () => {
    const { p, token } = await signedInOps("ok");
    const r = await o.resolve(token);
    expect(r).not.toBeNull();
    expect(r!.ctx.role).toBe("ops");
    expect(r!.ctx.tenantId).toBeNull();
    expect(r!.ctx.userId).toBe(p.memberId);
    expect(r!.termsPending).toBe(false);
    expect(r!.mfaPending).toBe(false);
  });

  it("K944-API-002 入った印で運営の口を呼ぶ：GET /api/v1/ops/shell は役の段を通って 501（まだ作っていない口）。顧客の人の印では 403・印なしは 401", async () => {
    const { token } = await signedInOps("shell");
    const ops = await o.api("GET", OPS_SHELL, token);
    expect(ops.status, await ops.clone().text()).toBe(501);
    const u = await h.makeUser("cust-shell");
    const signed = await h.signIn(u.email);
    expect(signed.status, await signed.clone().text()).toBe(201);
    const cust = String((await h.json(signed)).data?.["token"]);
    expect((await o.api("GET", OPS_SHELL, cust)).status).toBe(403);
    expect((await o.api("GET", OPS_SHELL, null)).status).toBe(401);
  });

  it("K944-API-003 セッションの入り方：運営のパスキーのセッションは login_kind 'passkey'。顧客のパスワードのセッションは null のまま", async () => {
    const { p } = await signedInOps("kind");
    expect((await sessionRow(p.memberId))?.login_kind).toBe("passkey");
    const u = await h.makeUser("cust-kind");
    expect((await h.signIn(u.email)).status).toBe(201);
    expect((await sessionRow(u.memberId))?.login_kind ?? null).toBeNull();
  });

  it("K944-API-004 本人確認の取り直しの時刻（sessions.step_up_at）は運営の解決にもそのまま入る", async () => {
    const { p, token } = await signedInOps("stepup");
    await h.admin.query("update sessions set step_up_at = now() where member_id = $1 and revoked_at is null", [
      p.memberId,
    ]);
    const r = await o.resolve(token);
    expect(r!.ctx.role).toBe("ops");
    expect(r!.ctx.stepUpAt).toBeInstanceOf(Date);
  });
});

describe("K-944 運営のログイン：パスキーしか使えない", () => {
  it("K944-API-005 運営の人 × パスワードで入る（契約の口 POST /api/v1/auth/sign-in）：403 E-AUTH-022・セッションの印なし・認証側と業務側のセッションが増えない", async () => {
    const p = await o.makeOps("pw", { password: true });
    const before = { auth: await h.authSessions(p.userId), app: await h.liveSessions(p.memberId) };
    const r = await h.signIn(p.email, PW);
    expect(r.status, await r.clone().text()).toBe(403);
    expect((await h.json(r))["code"]).toBe(OPS_PASSKEY_ONLY);
    expect(o.tokenOf(r)).toBeNull();
    expect({ auth: await h.authSessions(p.userId), app: await h.liveSessions(p.memberId) }).toEqual(before);
  });

  it("K944-API-006 E-AUTH-022 は目録に在り、文は下絵（運営のログイン）の注記と同じ", () => {
    expect(CATALOG[OPS_PASSKEY_ONLY]?.message).toBe(MOCK_TEXT);
  });

  it("K944-API-007 2 層目：運営の人のセッションの入り方が 'passkey' でない（直に消した）なら、解決は運営として解かず null・運営の口は 401", async () => {
    const { p, token } = await signedInOps("layer2");
    await h.admin.query("update sessions set login_kind = null where member_id = $1 and revoked_at is null", [
      p.memberId,
    ]);
    expect(await o.resolve(token)).toBeNull();
    expect((await o.api("GET", OPS_SHELL, token)).status).toBe(401);
  });

  it("K944-API-008 顧客の人 × パスワードで入る：今までどおり 201・解決は role member（自分の会社）", async () => {
    const u = await h.makeUser("cust-pw");
    const r = await h.signIn(u.email);
    expect(r.status, await r.clone().text()).toBe(201);
    const t = String((await h.json(r)).data?.["token"]);
    const x = await o.resolve(t);
    expect(x!.ctx.role).toBe("member");
    expect(x!.ctx.tenantId).toBe(u.tenantId);
  });

  it("K944-API-009 止めの確かめ（app.ops_login_check）が落ちる（kaname_app の実行の権限を外す・K-303 の試験と同じ形）：503 E-PAGE-003 でセッションを作らない（止める側に倒す）。権限は finally で戻す", async () => {
    const p = await o.makeOps("down", { password: true });
    await h.admin.query("revoke execute on function app.ops_login_check(text, boolean) from kaname_app");
    try {
      const r = await h.signIn(p.email, PW);
      expect(r.status, await r.clone().text()).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      expect(await h.liveSessions(p.memberId)).toBe(0);
    } finally {
      await h.admin.query("grant execute on function app.ops_login_check(text, boolean) to kaname_app");
    }
  });
});

describe("K-944 運営のログイン：運営の人でなくなったとき", () => {
  it("K944-API-010 運営の会社の人だが ops_members が無い × パスキーで入る：部品のセッションはできる（止めは運営の人だけを見る）が、解決は null・運営の口は 401（運営として通さない）", async () => {
    const p = await o.makeOpsTenantOnly("noops");
    const a = await o.addPasskey(p.userId);
    const r = await o.passkeySignIn(p.userId, a);
    expect(r.status, await r.clone().text()).toBe(200);
    const t = o.tokenOf(r)!;
    expect(await o.resolve(t)).toBeNull();
    expect((await o.api("GET", OPS_SHELL, t)).status).toBe(401);
  });

  it("K944-API-011 ops_members を外した（revoked_at）：同じ印がその時点で解けず 401（時間を待たない）", async () => {
    const { p, token } = await signedInOps("revoked");
    expect((await o.api("GET", OPS_SHELL, token)).status).toBe(501);
    await h.admin.query("update ops_members set revoked_at = now() where member_id = $1", [p.memberId]);
    expect(await o.resolve(token)).toBeNull();
    expect((await o.api("GET", OPS_SHELL, token)).status).toBe(401);
  });

  it("K944-API-012 ops_members を消した（deleted_at）：同じ印が解けず 401", async () => {
    const { p, token } = await signedInOps("deleted");
    await h.admin.query("update ops_members set deleted_at = now() where member_id = $1", [p.memberId]);
    expect(await o.resolve(token)).toBeNull();
    expect((await o.api("GET", OPS_SHELL, token)).status).toBe(401);
  });
});

describe("K-944 運営のログイン：入り方を書けないとき（外に影響する手順 S1）", () => {
  const FAIL_UA = `${UA_MAC} K944-FAIL`;
  /** 入り方（login_kind）を書く所を落とす（この試験の印 K944-FAIL の端末の行だけ）。fn の後で必ず外す */
  const withKindDown = async (fn: () => Promise<void>) => {
    await h.admin.query(`create or replace function app.k944_kind_down() returns trigger language plpgsql as $$
      begin if new.device_label like '%K944-FAIL%' and new.login_kind is distinct from old.login_kind then
        raise exception 'K-944 の試験：入り方を書けない'; end if; return new; end $$`);
    await h.admin.query(
      "create trigger k944_kind_down before update on sessions for each row execute function app.k944_kind_down()",
    );
    try {
      await fn();
    } finally {
      await h.admin.query("drop trigger if exists k944_kind_down on sessions");
      await h.admin.query("drop function if exists app.k944_kind_down()");
    }
  };
  /** 認証側のセッションを消す所（後片付け）も落とす。fn の後で必ず外す */
  const withAuthDeleteDown = async (fn: () => Promise<void>) => {
    await h.admin.query(`create or replace function app.k944_auth_keep() returns trigger language plpgsql as $$
      begin if old."userAgent" like '%K944-FAIL%' then raise exception 'K-944 の試験：認証側のセッションを消せない'; end if;
      return old; end $$`);
    await h.admin.query(
      "create trigger k944_auth_keep before delete on kaname_auth.session for each row execute function app.k944_auth_keep()",
    );
    try {
      await fn();
    } finally {
      await h.admin.query("drop trigger if exists k944_auth_keep on kaname_auth.session");
      await h.admin.query("drop function if exists app.k944_auth_keep()");
    }
  };

  it("K944-API-013 手順 S1 の失敗：入り方を書けない × パスキーで入る：5xx で印なし。認証側のセッションは消してから上げる（数は入る前と同じ）", async () => {
    const p = await o.makeOps("kinddown");
    const a = await o.addPasskey(p.userId);
    const before = await h.authSessions(p.userId);
    let r: Response | undefined;
    await withKindDown(async () => {
      r = await o.passkeySignIn(p.userId, a, FAIL_UA);
    });
    expect(r!.status, await r!.clone().text()).toBeGreaterThanOrEqual(500);
    expect(o.tokenOf(r!)).toBeNull();
    expect(await h.authSessions(p.userId), "半分だけ入った状態を残さない").toBe(before);
  });

  it("K944-API-014 手順 S1 の後片付けが失敗：入り方を書けず、認証側のセッションを消すのも落ちる：5xx・印なし・ログに「後片付け」。残った認証側のセッションの印は、解決が null・運営の口は 401（入り方が無い）", async () => {
    const p = await o.makeOps("cleanupdown");
    const a = await o.addPasskey(p.userId);
    let r: Response | undefined;
    let logs = "";
    await withAuthDeleteDown(async () => {
      await withKindDown(async () => {
        logs = await h.captureLogs(async () => {
          r = await o.passkeySignIn(p.userId, a, FAIL_UA);
        });
      });
    });
    expect(r!.status, await r!.clone().text()).toBeGreaterThanOrEqual(500);
    expect(o.tokenOf(r!)).toBeNull();
    expect(logs).toMatch(/後片付け/);
    const left = await h.admin.query<{ token: string }>(
      `select token from kaname_auth.session where "userId" = $1 and "userAgent" like '%K944-FAIL%' order by "createdAt" desc limit 1`,
      [p.userId],
    );
    const token = left.rows[0]?.token;
    expect(token, "後片付けが落ちたので認証側のセッションが残っている").toBeTruthy();
    expect((await sessionRow(p.memberId))?.login_kind ?? null).toBeNull();
    expect(await o.resolve(token!, FAIL_UA)).toBeNull();
    expect((await o.api("GET", OPS_SHELL, token!, undefined, { "user-agent": FAIL_UA })).status).toBe(401);
  });
});
