// K-421「招待のリンク（口と DB）：宛てのメールを持たない招待のリンクを作る createInvitationLink と、その下見・ログイン中の人が今のアカウントで参加できる F2 の直し」の試験
//   （ログインしていない新しい人がリンクで参加する道はメールを確かめる K-422・invite-link-confirm.test.ts）
//   （本物の DB・本番と同じ bootApi・本物のログインの部品。土台は F2 の invite.harness.ts（K-331）。メールは試験の偽 mails）。
//   行 ID（K421-API-…）は 11_tickets/K-421.md の表と 1 対 1。
//   口の形（K-421 の契約・05_flow/screen_api.d/K-421.py と screen_api.py の acceptInvitation・getInvitation）:
//     createInvitationLink  POST /api/v1/invitations/link ← { scope_id, role_key }（strict）→ 201 { data: { url, expires_at } }・Cache-Control private, no-store・冪等の器に残さない
//     getInvitation         GET  /api/v1/auth/invitations/:token → リンクの招待は email が null（ログイン中は email_matches が true）
//     acceptInvitation      POST /api/v1/auth/invitations/:token/accept ← ログイン中の人は体なし。ログインしていない人のリンクの参加は K-422 まで 401・後は 202（K-422）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { failMailTo, mails } from "../F1/login.harness.js";
import { PW, setupInvite, sha256, type User } from "../F2/invite.harness.js";

const h = setupInvite("k421");
const LINK = "/api/v1/invitations/link";
const NAME = "リンクで入る人";

/** リンクを作る口（ログインの印つき） */
const makeLink = (token: string, body: unknown, headers: Record<string, string> = {}) =>
  h.req("POST", LINK, body, { headers: { ...h.bearer(token), ...headers } });
/** その会社のいちばん上のグループ */
const topOf = async (u: User) =>
  (
    await h.admin.query<{ id: string }>(
      "select id from scopes where tenant_id = $1 and parent_id is null and deleted_at is null order by created_at limit 1",
      [u.tenantId],
    )
  ).rows[0]!.id;
/** 答えの url の末尾のトークン */
const tokenOfUrl = (url: unknown): string => String(url).split("/invite/")[1] ?? "";
/** そのログインの印の本人確認の取り直しの時刻を、secs 秒前にする（null なら取り直していない） */
const stepUp = (token: string, secs: number | null) =>
  h.admin.query(
    `update sessions set step_up_at = case when $2::int is null then null else now() - make_interval(secs => $2::int) end
      where auth_session_id = (select id from kaname_auth.session where token = $1)`,
    [token, secs],
  );
const linkRows = (tenantId: string) =>
  h.admin.query<{
    id: string;
    email: string | null;
    scope_id: string;
    role_id: string;
    created_by: string;
    days: number;
    accepted_member_id: string | null;
  }>(
    `select id, email, scope_id, role_id, created_by, extract(epoch from (expires_at - created_at)) / 86400 as days, accepted_member_id
       from invitations where tenant_id = $1 and email is null order by created_at`,
    [tenantId],
  );
const n = async (sql: string, p: unknown[] = []) => Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
/** 管理者がリンクを 1 本作り、平文のトークンを返す */
const linkOf = async (host: User, o: Record<string, unknown> = {}) => {
  const t = await h.tokenOf(host);
  const r = await makeLink(t, { scope_id: await topOf(host), role_key: "member", ...o });
  expect(r.status, await r.clone().text()).toBe(201);
  return tokenOfUrl((await h.json(r)).data!["url"]);
};
/** 招待で host に入った人（招く権限の無いメンバー・マネージャー）。その人のログインの印は host の会社に切り替わっている */
const joinedAs = async (host: User, tag: string, role: string) => {
  const me = await h.makeUser(tag);
  const inv = await h.invite(host, { email: me.email, role });
  const t = await h.tokenOf(me);
  expect((await h.accept(inv.token, {}, { headers: h.bearer(t) })).status).toBe(201);
  return { me, token: t };
};
/** その表の insert で、cond のときだけ落とす引き金を置いて fn を流す（終わったら必ず外す） */
async function failOn(table: string, when: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k421_fail_${randomUUID().replaceAll("-", "")}`;
  await h.admin.query(
    `create function public.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K421 試験の失敗'; end if; return ${when === "delete" ? "old" : "new"}; end $$`,
  );
  await h.admin.query(
    `create trigger ${name} before ${when} on ${table} for each row execute function public.${name}()`,
  );
  try {
    await fn();
  } finally {
    await h.admin.query(`drop trigger if exists ${name} on ${table}`);
    await h.admin.query(`drop function if exists public.${name}()`);
  }
}

describe("K-421 招待のリンクを作る（createInvitationLink）", () => {
  it("K421-API-001 管理者がリンクを作る：201・鍵は url と expires_at だけ・url は /invite/<43 字のトークン>・no-store。招待の行は宛てのメールが空・グループ・役割・作った人・期限 7 日・token_hash はトークンの sha256。証跡 invitation.link_created 1（トークンの字は書かない）", async () => {
    const host = await h.owner("host001");
    const t = await h.tokenOf(host);
    const top = await topOf(host);
    const r = await makeLink(t, { scope_id: top, role_key: "member" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["expires_at", "url"]);
    const token = tokenOfUrl(d["url"]);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = (await linkRows(host.tenantId)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: null,
      scope_id: top,
      role_id: "member",
      created_by: host.memberId,
      accepted_member_id: null,
    });
    expect(Math.round(Number(rows[0]!.days))).toBe(7);
    expect(
      await n("select count(*) as n from invitations where id = $1 and token_hash = $2", [rows[0]!.id, sha256(token)]),
    ).toBe(1);
    const ev = await h.admin.query<{ payload: unknown }>(
      "select payload from audit_events where tenant_id = $1 and action = 'invitation.link_created'",
      [host.tenantId],
    );
    expect(ev.rows).toHaveLength(1);
    expect(JSON.stringify(ev.rows[0]!.payload)).not.toContain(token);
  });

  it("K421-API-002 グループが別の会社・在らない・消したグループ：404・E-INV-011・招待 0", async () => {
    const host = await h.owner("host002");
    const other = await h.owner("other002");
    const t = await h.tokenOf(host);
    const gone = (
      await h.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix, deleted_at) values ($1, $2, '消した', 'DL', now()) returning id",
        [host.tenantId, await topOf(host)],
      )
    ).rows[0]!.id;
    for (const scope of [await topOf(other), randomUUID(), gone]) {
      const r = await makeLink(t, { scope_id: scope, role_key: "member" });
      expect(r.status, await r.clone().text()).toBe(404);
      expect(JSON.stringify(await h.json(r))).toContain("E-INV-011");
    }
    expect((await linkRows(host.tenantId)).rows).toHaveLength(0);
  });

  it("K421-API-003 管理者として入るリンク（role_key admin）：取り直し無し・16 分前は 403・STEP_UP_REQUIRED・招待 0。1 分前は 201・role_id admin", async () => {
    const host = await h.owner("host003");
    const t = await h.tokenOf(host);
    const top = await topOf(host);
    for (const secs of [null, 16 * 60]) {
      await stepUp(t, secs);
      const r = await makeLink(t, { scope_id: top, role_key: "admin" });
      expect(r.status, await r.clone().text()).toBe(403);
      expect(JSON.stringify(await h.json(r))).toContain("STEP_UP_REQUIRED");
    }
    expect((await linkRows(host.tenantId)).rows).toHaveLength(0);
    await stepUp(t, 60);
    const ok = await makeLink(t, { scope_id: top, role_key: "admin" });
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect((await linkRows(host.tenantId)).rows.map((x) => x.role_id)).toEqual(["admin"]);
  });

  it("K421-API-004 招く権限の無い人（招待で入ったメンバー・マネージャー）は 403・ログインしていない人は 401。どれも招待 0", async () => {
    const host = await h.owner("host004");
    const top = await topOf(host);
    for (const [tag, role] of [
      ["mem004", "member"],
      ["mgr004", "manager"],
    ] as const) {
      const { token } = await joinedAs(host, tag, role);
      const r = await makeLink(token, { scope_id: top, role_key: "member" });
      expect(r.status, `${role}：${await r.clone().text()}`).toBe(403);
    }
    const anon = await h.req("POST", LINK, { scope_id: top, role_key: "member" });
    expect(anon.status).toBe(401);
    expect((await linkRows(host.tenantId)).rows).toHaveLength(0);
  });

  it("K421-API-005 入力の形：知らない役割（owner）・知らない欄（email）・グループが無い：422・招待 0", async () => {
    const host = await h.owner("host005");
    const t = await h.tokenOf(host);
    const top = await topOf(host);
    for (const body of [
      { scope_id: top, role_key: "owner" },
      { scope_id: top, role_key: "member", email: "x@example.com" },
      { role_key: "member" },
    ]) {
      const r = await makeLink(t, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect((await linkRows(host.tenantId)).rows).toHaveLength(0);
  });

  it("K421-API-006 二度押し（同じ Idempotency-Key で 2 回）：答えを器に残さないので 2 回とも 201 で、違うリンクが 2 本・どちらも下見で使える（state ok）", async () => {
    const host = await h.owner("host006");
    const t = await h.tokenOf(host);
    const body = { scope_id: await topOf(host), role_key: "member" };
    const key = randomUUID();
    const a = await makeLink(t, body, { "idempotency-key": key });
    const b = await makeLink(t, body, { "idempotency-key": key });
    expect([a.status, b.status]).toEqual([201, 201]);
    const ta = tokenOfUrl((await h.json(a)).data!["url"]);
    const tb = tokenOfUrl((await h.json(b)).data!["url"]);
    expect(ta).not.toBe(tb);
    expect((await linkRows(host.tenantId)).rows).toHaveLength(2);
    for (const tk of [ta, tb]) expect((await h.json(await h.preview(tk))).data!["state"]).toBe("ok");
  });

  it("K421-API-016 手順 S1（招待の行と証跡を書く）の失敗：503・E-PAGE-003・招待 0・証跡 0", async () => {
    const host = await h.owner("host021");
    const t = await h.tokenOf(host);
    const top = await topOf(host);
    await failOn("invitations", "insert", `new.tenant_id = '${host.tenantId}'`, async () => {
      const r = await makeLink(t, { scope_id: top, role_key: "member" });
      expect(r.status, await r.clone().text()).toBe(503);
      expect(JSON.stringify(await h.json(r))).toContain("E-PAGE-003");
    });
    expect((await linkRows(host.tenantId)).rows).toHaveLength(0);
    expect(
      await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'invitation.link_created'", [
        host.tenantId,
      ]),
    ).toBe(0);
  });
});

describe("K-421 リンクの下見と参加（F2 の口の直し）", () => {
  it("K421-API-007 ログインしていない人がリンクの下見を開く：200・state ok・email は null・account_exists false・ワークスペースの名前と招いた人", async () => {
    const host = await h.owner("host007", "株式会社リンク007");
    const tk = await linkOf(host);
    const r = await h.preview(tk);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data!;
    expect(d).toMatchObject({ state: "ok", email: null, account_exists: false, workspace_name: "株式会社リンク007" });
  });

  it("K421-API-008 ログイン中の人がリンクの下見を開く：どのメールの人でも email_matches true（宛てを照らさない）・already_member false", async () => {
    const host = await h.owner("host008");
    const me = await h.makeUser("me008");
    const tk = await linkOf(host);
    const d = (await h.json(await h.preview(tk, { headers: h.bearer(await h.tokenOf(me)) }))).data!;
    expect(d["email"]).toBeNull();
    expect(JSON.stringify(d["signed_in"])).toContain('"email_matches":true');
    expect(JSON.stringify(d["signed_in"])).toContain('"already_member":false');
  });

  it('K421-API-009 ログイン中の人がリンクで参加：201・next "/"・招かれた会社に所属（リンクの役割・active）・そのログインの印が切り替わる・招待は使われた', async () => {
    const host = await h.owner("host009");
    const me = await h.makeUser("me009");
    const tk = await linkOf(host, { role_key: "manager" });
    const t = await h.tokenOf(me);
    const r = await h.accept(tk, {}, { headers: h.bearer(t) });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data).toMatchObject({ workspace_id: host.tenantId, next: "/" });
    const tm = await h.admin.query<{ role: string; status: string }>(
      "select role, status from tenant_memberships where tenant_id = $1 and auth_user_id = $2",
      [host.tenantId, me.userId],
    );
    expect(tm.rows).toEqual([{ role: "manager", status: "active" }]);
    const s = await h.admin.query<{ tenant_id: string }>(
      "select x.tenant_id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [t],
    );
    expect(s.rows[0]!.tenant_id).toBe(host.tenantId);
    expect((await linkRows(host.tenantId)).rows[0]!.accepted_member_id).not.toBeNull();
  });

  it("K421-API-010 もうその会社に入っている人がリンクで参加：409・E-INV-007・招待は使われない（ほかの人がまだ使える）", async () => {
    const host = await h.owner("host010");
    const { token } = await joinedAs(host, "me010", "member");
    const tk = await linkOf(host);
    const r = await h.accept(tk, {}, { headers: h.bearer(token) });
    expect(r.status, await r.clone().text()).toBe(409);
    expect(JSON.stringify(await h.json(r))).toContain("E-INV-007");
    expect((await linkRows(host.tenantId)).rows[0]!.accepted_member_id).toBeNull();
  });

  it("K421-API-011 リンクは 1 回だけ・期限つき（ログイン中の人）：1 人目が入った後、2 人目は 410・E-INV-004（下見は state used）。期限切れのリンクは 410・E-INV-003。どちらも 2 人目の所属は 0", async () => {
    const host = await h.owner("host011");
    const first = await h.makeUser("first011");
    const second = await h.makeUser("second011");
    const tk = await linkOf(host);
    expect((await h.accept(tk, {}, { headers: h.bearer(await h.tokenOf(first)) })).status).toBe(201);
    const t2 = await h.tokenOf(second);
    const again = await h.accept(tk, {}, { headers: h.bearer(t2) });
    expect(again.status).toBe(410);
    expect(JSON.stringify(await h.json(again))).toContain("E-INV-004");
    expect((await h.json(await h.preview(tk))).data!["state"]).toBe("used");
    const tk2 = await linkOf(host);
    await h.admin.query("update invitations set expires_at = now() - interval '1 minute' where token_hash = $1", [
      sha256(tk2),
    ]);
    const old = await h.accept(tk2, {}, { headers: h.bearer(t2) });
    expect(old.status).toBe(410);
    expect(JSON.stringify(await h.json(old))).toContain("E-INV-003");
    expect(
      await n("select count(*) as n from tenant_memberships where tenant_id = $1 and auth_user_id = $2", [
        host.tenantId,
        second.userId,
      ]),
    ).toBe(0);
  });

  it("K421-API-012 ログインしていない新しい人がリンクで参加（名前・パスワード・メール）：この葉の間は 401・K-422 の後は 202。どちらでも、押した時点でそのメールの利用者は 0・所属は 0・招待は使われない（確認のメールを押すまで参加は決まらない・D-148.51）", async () => {
    const host = await h.owner("host012");
    const tk = await linkOf(host);
    const email = h.email("new012");
    const r = await h.accept(tk, { name: NAME, password: PW, email });
    expect([401, 202], await r.clone().text()).toContain(r.status);
    expect(await h.authUsers(email)).toBe(0);
    expect(
      await n(
        `select count(*) as n from tenant_memberships m join kaname_auth."user" u on u.id = m.auth_user_id
          where m.tenant_id = $1 and u.email = $2`,
        [host.tenantId, email],
      ),
    ).toBe(0);
    expect((await linkRows(host.tenantId)).rows[0]!.accepted_member_id).toBeNull();
  });

  it("K421-API-017 手順 S4（今のアカウントで参加）の失敗：503・E-PAGE-003・所属 0・招待は使われない（ほかの人がまだ使える）・そのログインの印は元の会社のまま", async () => {
    const host = await h.owner("host024");
    const me = await h.makeUser("me024");
    const tk = await linkOf(host);
    const t = await h.tokenOf(me);
    const before = await h.admin.query<{ tenant_id: string | null }>(
      "select x.tenant_id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [t],
    );
    await failOn("tenant_memberships", "insert", `new.tenant_id = '${host.tenantId}'`, async () => {
      const r = await h.accept(tk, {}, { headers: h.bearer(t) });
      expect(r.status, await r.clone().text()).toBe(503);
      expect(JSON.stringify(await h.json(r))).toContain("E-PAGE-003");
    });
    expect(
      await n("select count(*) as n from tenant_memberships where tenant_id = $1 and auth_user_id = $2", [
        host.tenantId,
        me.userId,
      ]),
    ).toBe(0);
    expect((await linkRows(host.tenantId)).rows[0]!.accepted_member_id).toBeNull();
    const after = await h.admin.query<{ tenant_id: string | null }>(
      "select x.tenant_id from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [t],
    );
    expect(after.rows[0]?.tenant_id ?? null).toBe(before.rows[0]?.tenant_id ?? null);
  });
});

describe("K-421 DB の関数・並び・送り直しの頼み", () => {
  it("K421-API-013 リンクを作る DB の関数を、招く権限の無い人の文脈で直に呼ぶと 42501（守りは入口と関数の 2 層）", async () => {
    const host = await h.owner("host018");
    const { me } = await joinedAs(host, "mem018", "member");
    const mem = (
      await h.admin.query<{ member_id: string }>(
        "select member_id from tenant_memberships where tenant_id = $1 and auth_user_id = $2",
        [host.tenantId, me.userId],
      )
    ).rows[0]!.member_id;
    const c = await h.admin.connect();
    try {
      await c.query("begin");
      await c.query("set local role kaname_app");
      await c.query("select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)", [
        host.tenantId,
        mem,
      ]);
      const e = await c
        .query("select * from app.create_invitation_link($1, 'member', $2)", [await topOf(host), sha256(randomUUID())])
        .then(
          () => null,
          (x: { code?: string }) => x,
        );
      expect(e?.code).toBe("42501");
    } finally {
      await c.query("rollback");
      c.release();
    }
    expect((await linkRows(host.tenantId)).rows).toHaveLength(0);
  });

  it("K421-API-014 メンバーの並び（getWorkspaceMembers・K-419）の招待中に、リンクの招待は出ない（宛てのメールが空の行が無い・count にも入らない）", async () => {
    const host = await h.owner("host019");
    const t = await h.tokenOf(host);
    await linkOf(host);
    const r = await h.req("GET", "/api/v1/workspace/members", undefined, { headers: h.bearer(t) });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as {
      invitations: { email: unknown }[];
      count: number;
      groups: { members: { id: string }[] }[];
    };
    expect(d.invitations.filter((x) => x.email === null)).toHaveLength(0);
    const people = new Set(d.groups.flatMap((g) => g.members.map((m) => m.id))).size;
    expect(d.count).toBe(people + d.invitations.length);
  });

  it("K421-API-015 期限切れのリンクで送り直しを頼む：招いた人へのメールの本文に「招待のリンクを開いた人から」と書き、「開いた人 さん」「null」「undefined」の字を出さない", async () => {
    const host = await h.owner("host020");
    const tk = await linkOf(host);
    await h.admin.query("update invitations set expires_at = now() - interval '1 minute' where token_hash = $1", [
      sha256(tk),
    ]);
    failMailTo.delete(host.email);
    const before = mails.length;
    const r = await h.resendRequest(tk);
    expect(r.status, await r.clone().text()).toBeLessThan(300);
    expect(mails.length - before).toBe(1);
    const m = mails.at(-1)!;
    expect(m.to).toBe(host.email);
    expect(m.text).toContain("招待のリンクを開いた人から");
    expect(m.text).not.toContain("開いた人 さん");
    expect(m.text + m.subject).not.toMatch(/null|undefined/);
  });
  it("K421-API-018 会社を作った人は管理者の束を全部持つ（代表の答え answer=ac95454ce2aa）：新しい会社の owner に admin の所属の行ができ、招く・書き出す・プランと支払い・ワークスペースを消すの束が付く／埋め戻しは何度流しても増えない／作りかけの会社の片付けがその行も消す", async () => {
    const o = await h.owner("o018");
    const memberOf = async (u: User) =>
      (
        await h.admin.query<{ id: string }>("select id from members where tenant_id = $1 and auth_user_id = $2", [
          u.tenantId,
          u.userId,
        ])
      ).rows[0]!.id;
    const mid = await memberOf(o);
    const rows = (tenantId: string, memberId: string) =>
      n(
        "select count(*) as n from tenant_memberships where tenant_id = $1 and member_id = $2 and role = 'admin' and status = 'active'",
        [tenantId, memberId],
      );
    const bundle = (tenantId: string, memberId: string) =>
      n(
        `select count(*) as n from permissions where tenant_id = $1 and grantee_member_id = $2 and bundle_role = 'admin'
            and ((target_kind_id = 'tenants' and ability_id in ('billing', 'export', 'delete_workspace'))
              or (target_kind_id = 'members' and ability_id = 'invite'))`,
        [tenantId, memberId],
      );
    expect(await rows(o.tenantId, mid), "新しい会社の owner に admin の行").toBe(1);
    expect(await bundle(o.tenantId, mid), "束の 4 つの権限").toBe(4);
    // 埋め戻し：所属の行を消した owner に戻る・何度流しても 1 行のまま
    const here = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(
      join(here, "..", "..", "..", "..", "..", "packages", "db", "migrations", "20261122100000_owner_is_admin.sql"),
      "utf8",
    );
    const backfill = /\ninsert into tenant_memberships[\s\S]*?on conflict \(tenant_id, member_id\) do nothing;/.exec(
      sql,
    )?.[0];
    expect(backfill, "migration に埋め戻しの文が在る").toBeTruthy();
    await h.admin.query("delete from tenant_memberships where tenant_id = $1 and member_id = $2", [o.tenantId, mid]);
    expect(await bundle(o.tenantId, mid), "所属を消せば束も消える").toBe(0);
    await h.admin.query(backfill!);
    await h.admin.query(backfill!);
    expect(await rows(o.tenantId, mid), "埋め戻しは何度流しても増えない").toBe(1);
    expect(await bundle(o.tenantId, mid)).toBe(4);
    // 作りかけの会社の片付けが、所属の行（と束の権限）も消す
    const dropped = await h.admin.query<{ r: number }>("select kaname_auth.drop_half_made_company($1::uuid, $2) as r", [
      o.tenantId,
      o.userId,
    ]);
    expect(dropped.rows[0]!.r).toBe(1);
    expect(await n("select count(*) as n from tenant_memberships where tenant_id = $1", [o.tenantId])).toBe(0);
    expect(await n("select count(*) as n from members where tenant_id = $1", [o.tenantId])).toBe(0);
  });
});
