// K-422「招待のリンクで新しく入る人のメールを確かめる（口と DB）」の試験
//   （本物の DB・本番と同じ bootApi・本物のログインの部品。土台は F2 の invite.harness.ts（K-331）。メールは試験の偽 mails）。
//   行 ID（K422-API-…）は 11_tickets/K-422.md の表と 1 対 1。
//   口の形（K-422 の契約・05_flow/screen_api.d/K-422.py と screen_api.py の acceptInvitation）:
//     acceptInvitation       POST /api/v1/auth/invitations/:token/accept ← ログインしていない人のリンクの参加は { name, password, email }
//                            → 202 { data: { state: "sent" | "failed", email: <伏せたメール> } }（利用者も所属も作らない・確認のメールを 1 通）
//     confirmInvitationJoin  POST /api/v1/auth/invitations/confirm ← { token } → 201 { data: { token, workspace_id, next: "/mfa-setup" } }
//   代表の答え（問い 33・answer=3d444fc8d59f・D-148.51）：確認のメールを押すまで参加は決まらない
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { failMailTo, mails } from "../F1/login.harness.js";
import { PW, msg, setupInvite, sha256, type User } from "../F2/invite.harness.js";

const h = setupInvite("k422");
const LINK = "/api/v1/invitations/link";
const CONFIRM = "/api/v1/auth/invitations/confirm";
const SIGN_UP = "/api/v1/auth/sign-up";
const NAME = "リンクで入る人";

/** その会社のいちばん上のグループ */
const topOf = async (u: User) =>
  (
    await h.admin.query<{ id: string }>(
      "select id from scopes where tenant_id = $1 and parent_id is null and deleted_at is null order by created_at limit 1",
      [u.tenantId],
    )
  ).rows[0]!.id;
/** 管理者がリンクを 1 本作り（K-421 の口）、平文のトークンを返す */
const linkOf = async (host: User, role = "member") => {
  const r = await h.req(
    "POST",
    LINK,
    { scope_id: await topOf(host), role_key: role },
    { headers: h.bearer(await h.tokenOf(host)) },
  );
  expect(r.status, await r.clone().text()).toBe(201);
  return String((await h.json(r)).data!["url"]).split("/invite/")[1] ?? "";
};
const join = (tk: string, email: string, name = NAME, password = PW) => h.accept(tk, { name, password, email });
const confirm = (token: unknown) => h.req("POST", CONFIRM, token === undefined ? {} : { token });
/** その宛てに届いた最後の確認のメール（無ければ undefined） */
const lastMailTo = (email: string) => [...mails].reverse().find((m) => m.to === email.toLowerCase().trim());
/** 確認のメールの本文から確認のリンクのトークンを取り出す */
const confirmTokenOf = (email: string): string => {
  const m = lastMailTo(email);
  expect(m, `${email} に確認のメールが届いていない`).toBeTruthy();
  const t = /\/invite\/confirm\/([A-Za-z0-9_-]{43})/.exec(m!.text)?.[1];
  expect(t, "確認のメールに /invite/confirm/<43 字> のリンクが無い").toBeTruthy();
  return t!;
};
const n = async (sql: string, p: unknown[] = []) => Number((await h.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const joinsOf = (email: string) =>
  h.admin.query<{
    id: string;
    email: string;
    display_name: string;
    pw_data: string | null;
    pw_iv: string | null;
    pw_tag: string | null;
    hours: number;
    sent_at: string | null;
    send_error: string | null;
    confirmed_at: string | null;
    deleted_at: string | null;
  }>(
    `select id, email, display_name, pw_data, pw_iv, pw_tag, extract(epoch from (expires_at - created_at)) / 3600 as hours,
            sent_at, send_error, confirmed_at, deleted_at
       from kaname_auth.invitation_link_joins where email = $1 order by created_at`,
    [email.toLowerCase()],
  );
const membersOf = (tenantId: string, email: string) =>
  n(
    `select count(*) as n from tenant_memberships m join kaname_auth."user" u on u.id = m.auth_user_id
      where m.tenant_id = $1 and u.email = $2`,
    [tenantId, email.toLowerCase()],
  );
const linkUsed = async (tenantId: string) =>
  (
    await h.admin.query<{ accepted_member_id: string | null }>(
      "select accepted_member_id from invitations where tenant_id = $1 and email is null order by created_at limit 1",
      [tenantId],
    )
  ).rows[0]!.accepted_member_id;
/** その表の when のときに cond で落とす引き金を置いて fn を流す（終わったら必ず外す） */
async function failOn(table: string, when: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k422_fail_${randomUUID().replaceAll("-", "")}`;
  const row = when === "delete" ? "old" : "new";
  await h.admin.query(
    `create function public.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K422 試験の失敗'; end if; return ${row}; end $$`,
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

describe("K-422 リンクで参加を押す（利用者も所属も作らず、確認のメールだけ）", () => {
  it("K422-API-001 ログインしていない人がリンクで参加：202・state sent と伏せたメール。確認のメール 1 通。利用者 0・所属 0・招待は使われない。保留の行 1（そろえたメール・名前・24 時間・送った印・パスワードの平文が無い）", async () => {
    const host = await h.owner("host001");
    const tk = await linkOf(host);
    const email = h.email("new001");
    const before = mails.length;
    const r = await join(tk, email);
    expect(r.status, await r.clone().text()).toBe(202);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["email", "state"]);
    expect(d["state"]).toBe("sent");
    expect(String(d["email"])).toMatch(/^[^@*]{2}\*{4}@/);
    expect(String(d["email"])).toBe(`${email.slice(0, 2)}****@${email.split("@")[1]}`);
    expect(mails.length - before).toBe(1);
    expect(lastMailTo(email)).toBeTruthy();
    expect(await h.authUsers(email)).toBe(0);
    expect(await membersOf(host.tenantId, email)).toBe(0);
    expect(await linkUsed(host.tenantId)).toBeNull();
    const rows = (await joinsOf(email)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: email.toLowerCase(), display_name: NAME, confirmed_at: null });
    expect(rows[0]!.sent_at).not.toBeNull();
    expect(Math.round(Number(rows[0]!.hours))).toBe(24);
    expect(JSON.stringify(rows[0])).not.toContain(PW);
  });

  it("K422-API-002 確認のメールの中身：件名に「参加を確かめてください」とワークスペース名、本文に名前・招いた人・/invite/confirm/<43 字>・24 時間。パスワード・リンクの招待のトークン・null／undefined の字が無い", async () => {
    const host = await h.owner("host002", "株式会社確認002");
    const tk = await linkOf(host);
    const email = h.email("new002");
    expect((await join(tk, email)).status).toBe(202);
    const m = lastMailTo(email)!;
    expect(m.subject).toContain("参加を確かめてください");
    expect(m.subject).toContain("株式会社確認002");
    expect(m.text).toContain(NAME);
    const inviter = (
      await h.admin.query<{ display_name: string }>("select display_name from members where id = $1", [host.memberId])
    ).rows[0]!.display_name;
    expect(m.text).toContain(inviter);
    expect(m.text).toContain("24 時間");
    expect(m.text).toMatch(/\/invite\/confirm\/[A-Za-z0-9_-]{43}/);
    expect(m.text + m.subject).not.toContain(PW);
    expect(m.text + m.subject).not.toContain(tk);
    expect(m.text + m.subject).not.toMatch(/null|undefined/);
  });

  it("K422-API-003 メールの形：空の字・空白だけ・メールの形でない → 422・E-INV-013・欄 email（契約の pattern と同じ決まり）。メールが送られていない → 409・E-INV-016（欄・details なし・招待の行で決まる断り）。保留の行 0・メール 0", async () => {
    const host = await h.owner("host003");
    const tk = await linkOf(host);
    const before = mails.length;
    for (const body of [
      { name: NAME, password: PW, email: "" },
      { name: NAME, password: PW, email: "   " },
      { name: NAME, password: PW, email: "メールではない" },
    ]) {
      const r = await h.accept(tk, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = JSON.stringify(await h.json(r));
      expect(j).toContain("E-INV-013");
      expect(j).toContain('"field":"email"');
      expect(j).toContain(msg("E-INV-013"));
    }
    const none = await h.accept(tk, { name: NAME, password: PW });
    expect(none.status).toBe(409);
    const nj = JSON.stringify(await h.json(none));
    expect(nj).toContain("E-INV-016");
    expect(nj).not.toContain("E-INV-013");
    expect(nj).not.toContain("field");
    expect(nj).not.toContain("details");
    expect(mails.length - before).toBe(0);
    expect(await n("select count(*) as n from kaname_auth.invitation_link_joins where email = 'メールではない'")).toBe(
      0,
    );
  });

  it("K422-API-004 入れたメールにもうアカウントがある：409・E-INV-006（ログインしてから参加）・保留の行 0・メール 0・その人の所属も増えない", async () => {
    const host = await h.owner("host004");
    const someone = await h.makeUser("some004");
    const tk = await linkOf(host);
    const before = mails.length;
    const r = await join(tk, someone.email);
    expect(r.status, await r.clone().text()).toBe(409);
    expect(JSON.stringify(await h.json(r))).toContain("E-INV-006");
    expect((await joinsOf(someone.email)).rows).toHaveLength(0);
    expect(mails.length - before).toBe(0);
    expect(await membersOf(host.tenantId, someone.email)).toBe(0);
  });

  it("K422-API-005 表記ゆらぎ：全角の＠・大文字・前後の空白のメールで押すと、保留の行のメールは小文字の半角 1 つ・確認のメールもそろえた宛てに届き、確認すると利用者のメールもそろえた 1 つ", async () => {
    const host = await h.owner("host005");
    const tk = await linkOf(host);
    const email = h.email("new005");
    const wide = `  ${email.toUpperCase().replace("@", "＠")}  `;
    expect((await join(tk, wide)).status).toBe(202);
    expect((await joinsOf(email)).rows.map((x) => x.email)).toEqual([email.toLowerCase()]);
    const ok = await confirm(confirmTokenOf(email));
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect(await n('select count(*) as n from kaname_auth."user" where email = $1', [email.toLowerCase()])).toBe(1);
    // 参加が決まった後は、包んだパスワードを保留の行から消す
    const done = (await joinsOf(email)).rows[0]!;
    expect([done.pw_iv, done.pw_tag, done.pw_data]).toEqual([null, null, null]);
  });

  it("K422-API-006 名前が空・パスワードが 11 文字：422・E-VAL-007／E-VAL-005（K-332 と同じ）・保留の行 0・メール 0", async () => {
    const host = await h.owner("host006");
    const tk = await linkOf(host);
    const email = h.email("new006");
    const before = mails.length;
    const a = await join(tk, email, "　");
    expect(a.status).toBe(422);
    expect(JSON.stringify(await h.json(a))).toContain("E-VAL-007");
    const b = await join(tk, email, NAME, "short-11-ch");
    expect(b.status).toBe(422);
    expect(JSON.stringify(await h.json(b))).toContain("E-VAL-005");
    expect((await joinsOf(email)).rows).toHaveLength(0);
    expect(mails.length - before).toBe(0);
  });
});

describe("K-422 確認のリンクを押す（confirmInvitationJoin）", () => {
  it('K422-API-007 確認のリンクを押す：201・token と workspace_id と next "/mfa-setup"（その token でログインできている）・no-store。利用者 1（emailVerified true）・所属 1（リンクの役割・active）・招待は使われた・保留の行に確認した時刻', async () => {
    const host = await h.owner("host007");
    const tk = await linkOf(host, "manager");
    const email = h.email("new007");
    expect((await join(tk, email)).status).toBe(202);
    const r = await confirm(confirmTokenOf(email));
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["next", "token", "workspace_id"]);
    expect(d).toMatchObject({ workspace_id: host.tenantId, next: "/mfa-setup" });
    expect(typeof d["token"]).toBe("string");
    expect(await h.resolves(d["token"] as string)).toBe(true);
    const u = await h.admin.query<{ id: string; emailVerified: boolean }>(
      'select id, "emailVerified" from kaname_auth."user" where email = $1',
      [email.toLowerCase()],
    );
    expect(u.rows).toHaveLength(1);
    expect(u.rows[0]!.emailVerified).toBe(true);
    const tm = await h.admin.query<{ role: string; status: string }>(
      "select role, status from tenant_memberships where tenant_id = $1 and auth_user_id = $2",
      [host.tenantId, u.rows[0]!.id],
    );
    expect(tm.rows).toEqual([{ role: "manager", status: "active" }]);
    expect(await linkUsed(host.tenantId)).not.toBeNull();
    expect((await joinsOf(email)).rows[0]!.confirmed_at).not.toBeNull();
  });

  it("K422-API-008 確認の期限（24 時間）が過ぎた：410・E-INV-014・利用者 0・所属 0", async () => {
    const host = await h.owner("host008");
    const tk = await linkOf(host);
    const email = h.email("new008");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    await h.admin.query(
      "update kaname_auth.invitation_link_joins set expires_at = now() - interval '1 minute' where email = $1",
      [email.toLowerCase()],
    );
    const r = await confirm(token);
    expect(r.status).toBe(410);
    expect(JSON.stringify(await h.json(r))).toContain("E-INV-014");
    expect(await h.authUsers(email)).toBe(0);
    expect(await membersOf(host.tenantId, email)).toBe(0);
  });

  it("K422-API-009 確認を 2 回押す：1 回目 201・2 回目 410・E-INV-015（ログインの印は渡さない）・利用者 1", async () => {
    const host = await h.owner("host009");
    const tk = await linkOf(host);
    const email = h.email("new009");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    expect((await confirm(token)).status).toBe(201);
    const again = await confirm(token);
    expect(again.status).toBe(410);
    const j = await h.json(again);
    expect(JSON.stringify(j)).toContain("E-INV-015");
    expect(j.data).toBeUndefined();
    expect(await h.authUsers(email)).toBe(1);
  });

  it("K422-API-010 同時に 2 回確認する：201 は 1 つ・もう 1 つは 410・E-INV-015。利用者 1・所属 1", async () => {
    const host = await h.owner("host010");
    const tk = await linkOf(host);
    const email = h.email("new010");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    const [a, b] = await Promise.all([confirm(token), confirm(token)]);
    expect([a.status, b.status].sort()).toEqual([201, 410]);
    expect(await h.authUsers(email)).toBe(1);
    expect(await membersOf(host.tenantId, email)).toBe(1);
  });

  it("K422-API-011 ほかの人のメールで先に押された（確認されない）：そのメールの利用者は 0。持ち主は登録できる（202）。同じリンクで持ち主が押すと前の確認のリンクは 404・E-INV-001 で、持ち主に届いた新しい確認のリンクで入れる", async () => {
    const host = await h.owner("host011");
    const tk = await linkOf(host);
    const victim = h.email("victim011");
    expect((await join(tk, victim, "なりすまし")).status).toBe(202);
    const first = confirmTokenOf(victim);
    expect(await h.authUsers(victim)).toBe(0);
    const signUp = await h.req("POST", SIGN_UP, {
      email: victim,
      name: "本当の持ち主",
      company_name: "持ち主の会社",
      password: PW,
    });
    expect(signUp.status, await signUp.clone().text()).toBeLessThan(300);
    expect((await join(tk, victim, "本当の持ち主")).status).toBe(202);
    const second = confirmTokenOf(victim);
    expect(second).not.toBe(first);
    const stale = await confirm(first);
    expect(stale.status).toBe(404);
    expect(JSON.stringify(await h.json(stale))).toContain("E-INV-001");
    const ok = await confirm(second);
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect(await membersOf(host.tenantId, victim)).toBe(1);
  });

  it("K422-API-012 同じメールで参加を押し直す：保留の行は 1 のまま・確認のメール 2 通・前の確認のリンクは 404・E-INV-001・新しい方で 201", async () => {
    const host = await h.owner("host012");
    const tk = await linkOf(host);
    const email = h.email("new012");
    const before = mails.length;
    expect((await join(tk, email)).status).toBe(202);
    const old = confirmTokenOf(email);
    expect((await join(tk, email)).status).toBe(202);
    const fresh = confirmTokenOf(email);
    expect(mails.length - before).toBe(2);
    expect((await joinsOf(email)).rows.filter((x) => x.deleted_at === null)).toHaveLength(1);
    const stale = await confirm(old);
    expect(stale.status).toBe(404);
    expect(JSON.stringify(await h.json(stale))).toContain("E-INV-001");
    expect((await confirm(fresh)).status).toBe(201);
  });

  it("K422-API-013 同じリンクで 2 人（別々のメール）が押し、1 人目が確認した：1 人目 201・2 人目の確認は 410・E-INV-004・2 人目の利用者 0", async () => {
    const host = await h.owner("host013");
    const tk = await linkOf(host);
    const ea = h.email("a013");
    const eb = h.email("b013");
    expect((await join(tk, ea)).status).toBe(202);
    expect((await join(tk, eb)).status).toBe(202);
    expect((await confirm(confirmTokenOf(ea))).status).toBe(201);
    const r = await confirm(confirmTokenOf(eb));
    expect(r.status).toBe(410);
    expect(JSON.stringify(await h.json(r))).toContain("E-INV-004");
    expect(await h.authUsers(eb)).toBe(0);
  });

  it("K422-API-014 確認の前に招待が取り消された・期限切れになった：410・E-INV-002／E-INV-003・利用者 0・保留の行は閉じる", async () => {
    const host = await h.owner("host014");
    for (const [tag, change, code] of [
      ["rev014", "revoked_at = now()", "E-INV-002"],
      ["exp014", "expires_at = now() - interval '1 minute'", "E-INV-003"],
    ] as const) {
      const tk = await linkOf(host);
      const email = h.email(tag);
      expect((await join(tk, email)).status).toBe(202);
      await h.admin.query(`update invitations set ${change} where token_hash = $1`, [sha256(tk)]);
      const r = await confirm(confirmTokenOf(email));
      expect(r.status, tag).toBe(410);
      expect(JSON.stringify(await h.json(r))).toContain(code);
      expect(await h.authUsers(email)).toBe(0);
      const closed = (await joinsOf(email)).rows[0]!;
      expect(closed.deleted_at).not.toBeNull();
      expect([closed.pw_iv, closed.pw_tag, closed.pw_data]).toEqual([null, null, null]); // 閉じた後は包んだパスワードも消す
    }
  });

  it("K422-API-015 メールで招いた招待（宛てのメールが在る）に体の email を送る：201・宛てのメールで利用者ができる・体のメールの利用者は 0・確認のメールは送らない（K-332 のまま）", async () => {
    const host = await h.owner("host015");
    const inv = await h.invite(host);
    const other = h.email("other015");
    const r = await h.accept(inv.token, { name: NAME, password: PW, email: other });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await h.authUsers(inv.email)).toBe(1);
    expect(await h.authUsers(other)).toBe(0);
    expect(lastMailTo(other)).toBeUndefined();
    expect((await joinsOf(other)).rows).toHaveLength(0);
  });

  it("K422-API-031 送られたメールの形は招待の種類によらず契約の決まり：メールで招いた招待でも email が空・形違いなら 422・E-INV-013（欄 email）。利用者は作らない", async () => {
    const host = await h.owner("host015b");
    const inv = await h.invite(host);
    for (const email of ["", "x"]) {
      const r = await h.accept(inv.token, { name: NAME, password: PW, email });
      expect(r.status, JSON.stringify(email)).toBe(422);
      expect(JSON.stringify(await h.json(r))).toContain("E-INV-013");
    }
    expect(await h.authUsers(inv.email)).toBe(0);
  });

  it("K422-API-016 確認の前に同じメールのアカウントができた：409・E-INV-006・利用者は 1 のまま（増えない）・保留の行は閉じる", async () => {
    const host = await h.owner("host016");
    const tk = await linkOf(host);
    const email = h.email("new016");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    await h.makeUser("new016");
    expect(await h.authUsers(email)).toBe(1);
    const r = await confirm(token);
    expect(r.status, await r.clone().text()).toBe(409);
    expect(JSON.stringify(await h.json(r))).toContain("E-INV-006");
    expect(await h.authUsers(email)).toBe(1);
    expect((await joinsOf(email)).rows[0]!.deleted_at).not.toBeNull();
  });

  it("K422-API-017 確認の前にワークスペースが止められた：403・E-AUTH-012・利用者 0・招待は使われない", async () => {
    const host = await h.owner("host017");
    const tk = await linkOf(host);
    const email = h.email("new017");
    expect((await join(tk, email)).status).toBe(202);
    await h.admin.query(
      "insert into subscriptions (tenant_id, status_id, started_at, suspended_at) values ($1, 'active', now(), now())",
      [host.tenantId],
    );
    try {
      const r = await confirm(confirmTokenOf(email));
      expect(r.status).toBe(403);
      expect(JSON.stringify(await h.json(r))).toContain("E-AUTH-012");
      expect(await h.authUsers(email)).toBe(0);
      expect(await linkUsed(host.tenantId)).toBeNull();
    } finally {
      await h.admin.query("delete from subscriptions where tenant_id = $1", [host.tenantId]);
    }
  });

  it("K422-API-018 確認のトークンが無い・空白だけ（前後の空白を落として空）：422。でたらめ：404・E-INV-001。どれも利用者は増えない", async () => {
    const before = await n('select count(*) as n from kaname_auth."user"');
    expect((await confirm(undefined)).status).toBe(422);
    expect((await confirm("   ")).status).toBe(422);
    const r = await confirm("x".repeat(43));
    expect(r.status).toBe(404);
    expect(JSON.stringify(await h.json(r))).toContain("E-INV-001");
    expect(await n('select count(*) as n from kaname_auth."user"')).toBe(before);
  });

  it("K422-API-019 ログに秘密を出さない：参加と確認の間のログに、入れたメール・パスワード・確認のトークン・リンクの招待のトークンの字が無い", async () => {
    const host = await h.owner("host019");
    const tk = await linkOf(host);
    const email = h.email("new019");
    let token = "";
    const logs = await h.captureLogs(async () => {
      expect((await join(tk, email)).status).toBe(202);
      token = confirmTokenOf(email);
      expect((await confirm(token)).status).toBe(201);
    });
    for (const secret of [email, PW, token, tk]) expect(logs).not.toContain(secret);
  });

  it("K422-API-020 保留の表の守り：kaname_app から kaname_auth.invitation_link_joins を読む・書くと permission denied（認証の接続だけ）", async () => {
    const c = await h.admin.connect();
    try {
      for (const sql of [
        "select count(*) from kaname_auth.invitation_link_joins",
        "delete from kaname_auth.invitation_link_joins",
      ]) {
        await c.query("begin");
        await c.query("set local role kaname_app");
        const e = await c.query(sql).then(
          () => null,
          (x: { message?: string }) => x,
        );
        expect(e?.message ?? "", sql).toMatch(/permission denied/);
        await c.query("rollback");
      }
    } finally {
      c.release();
    }
  });
});

describe("K-422 失敗の道", () => {
  it("K422-API-021 手順 S1（保留の行を書く）の失敗：503・E-PAGE-003・保留の行 0・メール 0", async () => {
    const host = await h.owner("host021");
    const tk = await linkOf(host);
    const email = h.email("new021");
    const before = mails.length;
    await failOn("kaname_auth.invitation_link_joins", "insert", `new.email = '${email.toLowerCase()}'`, async () => {
      const r = await join(tk, email);
      expect(r.status, await r.clone().text()).toBe(503);
      expect(JSON.stringify(await h.json(r))).toContain("E-PAGE-003");
    });
    expect((await joinsOf(email)).rows).toHaveLength(0);
    expect(mails.length - before).toBe(0);
  });

  it("K422-API-022 手順 S2（確認のメールを送る）の失敗：202・state failed・保留の行は残る（送った印なし・送れなかった印あり）。もう一度押すと確認のメール 1 通・state sent", async () => {
    const host = await h.owner("host022");
    const tk = await linkOf(host);
    const email = h.email("new022");
    failMailTo.add(email.toLowerCase());
    try {
      const r = await join(tk, email);
      expect(r.status, await r.clone().text()).toBe(202);
      expect((await h.json(r)).data!["state"]).toBe("failed");
    } finally {
      failMailTo.delete(email.toLowerCase());
    }
    const row = (await joinsOf(email)).rows[0]!;
    expect(row.sent_at).toBeNull();
    expect(row.send_error).not.toBeNull();
    // 残すのは例外の種類だけ（文には宛てのメールが入りうる）
    expect(row.send_error).not.toContain(email.toLowerCase());
    expect(row.send_error).not.toContain("@");
    const before = mails.length;
    const again = await join(tk, email);
    expect((await h.json(again)).data!["state"]).toBe("sent");
    expect(mails.length - before).toBe(1);
  });

  it("K422-API-023 手順 S3（送った印を書く）の失敗（S2 の後片付けの失敗）：202・state sent・メールは 1 通届く・ログに「送った印を書けなかった」1 行（メールの字は無い）・送った印は空のまま", async () => {
    const host = await h.owner("host023");
    const tk = await linkOf(host);
    const email = h.email("new023");
    const before = mails.length;
    let logs = "";
    await failOn(
      "kaname_auth.invitation_link_joins",
      "update",
      `new.sent_at is not null and new.email = '${email.toLowerCase()}'`,
      async () => {
        logs = await h.captureLogs(async () => {
          const r = await join(tk, email);
          expect(r.status, await r.clone().text()).toBe(202);
          expect((await h.json(r)).data!["state"]).toBe("sent");
        });
      },
    );
    expect(mails.length - before).toBe(1);
    expect(logs).toContain("送った印を書けなかった");
    expect(logs).not.toContain(email);
    expect((await joinsOf(email)).rows[0]!.sent_at).toBeNull();
  });

  it("K422-API-024 手順 S4（確認のときに利用者を作る）の失敗：503・E-PAGE-003・利用者 0・所属 0・印は戻る（同じ確認のリンクでもう一度押すと 201）", async () => {
    const host = await h.owner("host024");
    const tk = await linkOf(host);
    const email = h.email("new024");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    await failOn('kaname_auth."user"', "insert", `new.email = '${email.toLowerCase()}'`, async () => {
      const r = await confirm(token);
      expect(r.status, await r.clone().text()).toBe(503);
      expect(JSON.stringify(await h.json(r))).toContain("E-PAGE-003");
    });
    expect(await h.authUsers(email)).toBe(0);
    expect(await membersOf(host.tenantId, email)).toBe(0);
    expect((await joinsOf(email)).rows[0]!.confirmed_at).toBeNull();
    expect((await confirm(token)).status).toBe(201);
  });

  it("K422-API-025 手順 S5（受諾）の失敗（S4 の後片付けが走る）：503・E-PAGE-003・S4 で作った利用者は消える・招待は使われない・印は戻る", async () => {
    const host = await h.owner("host025");
    const tk = await linkOf(host);
    const email = h.email("new025");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    await failOn("tenant_memberships", "insert", `new.tenant_id = '${host.tenantId}'`, async () => {
      const r = await confirm(token);
      expect(r.status, await r.clone().text()).toBe(503);
      expect(JSON.stringify(await h.json(r))).toContain("E-PAGE-003");
    });
    expect(await h.authUsers(email)).toBe(0);
    expect(await linkUsed(host.tenantId)).toBeNull();
    expect((await joinsOf(email)).rows[0]!.confirmed_at).toBeNull();
  });

  it("K422-API-026 手順 S5 の失敗の後片付け（S4 の利用者を消す）も失敗：503・ログに「作った利用者を消せなかった」の 1 行（メールの字は出さない）・利用者は 1 人残る", async () => {
    const host = await h.owner("host026");
    const tk = await linkOf(host);
    const email = h.email("new026");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    let logs = "";
    await failOn("tenant_memberships", "insert", `new.tenant_id = '${host.tenantId}'`, async () => {
      await failOn('kaname_auth."user"', "delete", `old.email = '${email.toLowerCase()}'`, async () => {
        logs = await h.captureLogs(async () => {
          const r = await confirm(token);
          expect(r.status, await r.clone().text()).toBe(503);
        });
      });
    });
    expect(logs).toContain("作った利用者を消せなかった");
    expect(logs).not.toContain(email);
    expect(await h.authUsers(email)).toBe(1);
  });

  it("K422-API-027 包んだパスワード：保留の行の包みは登録の用途の鍵で開けない（用途ごとの鍵）。確認して利用者ができた後、そのパスワードでログインできる", async () => {
    const host = await h.owner("host027");
    const tk = await linkOf(host);
    const email = h.email("new027");
    expect((await join(tk, email)).status).toBe(202);
    const row = (await joinsOf(email)).rows[0]!;
    const { open_ } = await import("@kaname/auth/pending");
    // 試験の api に渡している master key（F1 の login.harness.ts の MASTER_KEY と同じ値）
    const key = Buffer.alloc(32, 7).toString("base64");
    expect(() => open_(key, { iv: row.pw_iv!, tag: row.pw_tag!, data: row.pw_data! })).toThrow();
    expect((await confirm(confirmTokenOf(email))).status).toBe(201);
    const signIn = await h.req("POST", "/api/v1/auth/sign-in", { email, password: PW });
    expect(signIn.status, await signIn.clone().text()).toBeLessThan(300);
  });
  it("K422-API-028 同じリンクで別々の 2 人が押し、2 人が同時に確認する（競り）：201 は 1 つ・もう 1 人は 410・E-INV-004・その人の利用者 0・その人の保留の行は閉じる・所属は勝った人だけ", async () => {
    const host = await h.owner("host028");
    const tk = await linkOf(host);
    const ea = h.email("a028");
    const eb = h.email("b028");
    expect((await join(tk, ea)).status).toBe(202);
    expect((await join(tk, eb)).status).toBe(202);
    const [ra, rb] = await Promise.all([confirm(confirmTokenOf(ea)), confirm(confirmTokenOf(eb))]);
    expect([ra.status, rb.status].sort()).toEqual([201, 410]);
    const [loser, lost] = ra.status === 410 ? [ra, ea] : [rb, eb];
    const won = lost === ea ? eb : ea;
    expect(JSON.stringify(await h.json(loser))).toContain("E-INV-004");
    expect(await h.authUsers(lost)).toBe(0);
    expect(await h.authUsers(won)).toBe(1);
    const row = (await joinsOf(lost)).rows[0]!;
    expect(row.deleted_at).not.toBeNull();
    expect(row.confirmed_at).not.toBeNull();
    expect(await membersOf(host.tenantId, won)).toBe(1);
    expect(await membersOf(host.tenantId, lost)).toBe(0);
  });

  it("K422-API-029 手順 S6（セッションを作る）の失敗：503・E-PAGE-003・利用者 1 と所属 1 は残る・招待は使われた・確認の印は付いたまま。押し直すと 410・E-INV-015。そのメールとパスワードでログインできる", async () => {
    const host = await h.owner("host029");
    const tk = await linkOf(host);
    const email = h.email("new029");
    expect((await join(tk, email)).status).toBe(202);
    const token = confirmTokenOf(email);
    let r!: Response;
    await failOn(
      "kaname_auth.session",
      "insert",
      `exists (select 1 from kaname_auth."user" u where u.id = new."userId" and lower(u.email) = lower('${email}'))`,
      async () => {
        await h.captureLogs(async () => {
          r = await confirm(token);
        });
      },
    );
    expect(r.status).toBe(503);
    expect(JSON.stringify(await h.json(r))).toContain("E-PAGE-003");
    expect(await h.authUsers(email)).toBe(1);
    expect(await membersOf(host.tenantId, email)).toBe(1);
    expect(await linkUsed(host.tenantId)).not.toBeNull();
    expect((await joinsOf(email)).rows[0]!.confirmed_at).not.toBeNull();
    const again = await confirm(token);
    expect(again.status).toBe(410);
    expect(JSON.stringify(await h.json(again))).toContain("E-INV-015");
    const signIn = await h.req("POST", "/api/v1/auth/sign-in", { email, password: PW });
    expect(signIn.status, await signIn.clone().text()).toBeLessThan(300);
  });

  it("K422-API-030 同じメールで参加を同時に 2 回押す：2 回とも 202・保留の行は 1・確認のメールは 2 通・2 つの確認のリンクのうち 1 つだけが 201（もう 1 つは 404・E-INV-001）", async () => {
    const host = await h.owner("host030");
    const tk = await linkOf(host);
    const email = h.email("new030");
    const before = mails.length;
    const [a, b] = await Promise.all([join(tk, email), join(tk, email)]);
    expect([a.status, b.status]).toEqual([202, 202]);
    expect((await joinsOf(email)).rows.filter((x) => x.deleted_at === null)).toHaveLength(1);
    const sent = mails.slice(before).filter((m) => m.to === email.toLowerCase());
    expect(sent).toHaveLength(2);
    const tokens = sent.map((m) => /\/invite\/confirm\/([A-Za-z0-9_-]{43})/.exec(m.text)?.[1] ?? "");
    const results = [await confirm(tokens[0]), await confirm(tokens[1])];
    expect(results.map((x) => x.status).sort()).toEqual([201, 404]);
    const miss = results.find((x) => x.status === 404)!;
    expect(JSON.stringify(await h.json(miss))).toContain("E-INV-001");
    expect(await h.authUsers(email)).toBe(1);
  });
});
