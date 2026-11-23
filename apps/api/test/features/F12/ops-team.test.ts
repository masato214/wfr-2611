// K-985「運営の人を読む・足す」の単体の試験（本物の DB・本物のログインの部品・本番と同じ bootApi・土台 ops-team.harness.ts）。
// テストの名前の頭の行 ID（K985-…）は 11_tickets/K-985.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import pg from "pg";
import { failMailTo, MEMBERS, OPS_MEMBER_KEYS, OPS_TENANT, setupTeam } from "./ops-team.harness.js";

const t = setupTeam("k985");
const { h } = t.o;
const SETUP = "/api/v1/auth/ops-setup";

/** 運営の人の口を持つ人で入り、取り直す */
const admin = async (tag: string) => {
  const s = await t.signedIn(tag);
  await t.stepUp(s.p.memberId);
  return s;
};
const add = (token: string, body: unknown) => t.call(token, "POST", MEMBERS, body);
const usersWith = (email: string) => t.n('select count(*)::int as n from kaname_auth."user" where email = $1', [email]);
const opsMembersOf = (email: string) =>
  t.n(
    `select count(*)::int as n from members m join kaname_auth."user" u on u.id = m.auth_user_id
      where m.tenant_id = $1 and u.email = $2`,
    [OPS_TENANT, email],
  );

describe("K-985 運営の人を読む", () => {
  it("K985-API-001 一覧：200・この回の人が作った順・1 行は 8 欄・caps は持つ物だけ・パスキーの有る無し・自分の印", async () => {
    const me = await t.signedIn("list-me");
    const other = await t.o.makeOps("list-sano", { caps: ["inquiry", "notice"] });
    const r = await t.call(me.token, "GET", MEMBERS);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const rows = t.mine((await t.json(r)).data);
    const meRow = rows.find((x) => x["email"] === me.p.email)!;
    const otherRow = rows.find((x) => x["email"] === other.email)!;
    expect(rows.indexOf(meRow)).toBeLessThan(rows.indexOf(otherRow));
    expect(Object.keys(meRow).sort()).toEqual([...OPS_MEMBER_KEYS]);
    expect(meRow["member_id"]).toBe(me.p.memberId);
    expect(meRow["is_self"]).toBe(true);
    expect(meRow["has_passkey"]).toBe(true);
    expect(otherRow["is_self"]).toBe(false);
    expect(otherRow["has_passkey"]).toBe(false);
    expect(otherRow["caps"]).toEqual(["inquiry", "notice"]);
  });

  it("K985-API-002 出さない人：外した運営の人と、運営の会社の人で運営の行の無い人は一覧に無い", async () => {
    const me = await t.signedIn("hide-me");
    const gone = await t.o.makeOps("hide-gone");
    await t.revoke(gone.memberId);
    const plain = await t.o.makeOpsTenantOnly("hide-plain");
    const rows = t.mine((await t.json(await t.call(me.token, "GET", MEMBERS))).data);
    const emails = rows.map((x) => x["email"]);
    expect(emails).toContain(me.p.email);
    expect(emails).not.toContain(gone.email);
    expect(emails).not.toContain(plain.email);
  });

  it("K985-API-003 最後の 1 人の印：運営の人を持つのが 1 人なら locked_caps に ops_people。2 人目を置くと消える", async () => {
    // 共用の DB なので、この回の前からの運営の人の ops_people を数え、1 人だけの状態を作ってから見る
    const me = await t.signedIn("last-me");
    const others = await h.admin.query<{ id: string; caps: string[] }>(
      "select id, caps from ops_members where member_id <> $1 and revoked_at is null and deleted_at is null and 'ops_people' = any(caps)",
      [me.p.memberId],
    );
    await h.admin.query("update ops_members set caps = array_remove(caps, 'ops_people') where id = any($1::uuid[])", [
      others.rows.map((x) => x.id),
    ]);
    try {
      const one = t
        .mine((await t.json(await t.call(me.token, "GET", MEMBERS))).data)
        .find((x) => x["email"] === me.p.email)!;
      expect(one["locked_caps"]).toContain("ops_people");
      await t.o.makeOps("last-second", { caps: ["ops_people"] });
      const two = t
        .mine((await t.json(await t.call(me.token, "GET", MEMBERS))).data)
        .find((x) => x["email"] === me.p.email)!;
      expect(two["locked_caps"]).not.toContain("ops_people");
    } finally {
      for (const x of others.rows)
        await h.admin.query("update ops_members set caps = $2 where id = $1", [x.id, x.caps]);
    }
  });

  it("K985-API-004 入口：ログインなし 401・顧客の会社の人 403・運営の人を持たない運営の人は一覧も足すも 403・人が増えない", async () => {
    expect((await t.call(null, "GET", MEMBERS)).status).toBe(401);
    const u = await h.makeUser("cust-entry");
    const signed = await h.signIn(u.email);
    const cust = String((await h.json(signed)).data?.["token"]);
    expect((await t.call(cust, "GET", MEMBERS)).status).toBe(403);
    const weak = await t.signedIn("entry-weak", ["inquiry"]);
    await t.stepUp(weak.p.memberId);
    expect((await t.call(weak.token, "GET", MEMBERS)).status).toBe(403);
    const email = h.email("entry-new");
    expect((await add(weak.token, { email, caps: ["inquiry"] })).status).toBe(403);
    expect(await usersWith(email)).toBe(0);
  });

  it("K985-API-015 上限：一覧の上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const me = await t.signedIn("rate");
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await t.call(me.token, "GET", MEMBERS);
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = (await t.json(last!))["retry_after_sec"];
    expect(Number.isInteger(sec)).toBe(true);
    expect(Number(sec)).toBeGreaterThanOrEqual(1);
    expect(Number(sec)).toBeLessThanOrEqual(60);
  });
});

describe("K-985 運営の人を足す", () => {
  it("K985-API-005 足す：201・8 欄・リンクとメール 1 通・パスワードの行なし・運営の記録 ops_member.add", async () => {
    const me = await admin("add-me");
    const email = h.email("add-new");
    const r = await add(me.token, { email, caps: ["inquiry", "notice"] });
    expect(r.status, await r.clone().text()).toBe(201);
    const j = await t.json(r);
    const d = j.data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual([...OPS_MEMBER_KEYS]);
    expect(d["has_passkey"]).toBe(false);
    expect(d["setup_pending"]).toBe(true);
    expect(d["caps"]).toEqual(["inquiry", "notice"]);
    expect(d["name"]).toBe(email.split("@")[0]);
    expect(j.meta?.["mail_sent"]).toBe(true);
    const ops = await t.opsOf(email);
    expect(ops?.caps).toEqual(["inquiry", "notice"]);
    expect(await opsMembersOf(email)).toBe(1);
    expect(
      await t.n(
        `select count(*)::int as n from kaname_auth.account a join kaname_auth."user" u on u.id = a."userId"
          where u.email = $1 and a."providerId" = 'credential'`,
        [email],
      ),
    ).toBe(0);
    expect(
      await t.n("select count(*)::int as n from ops_setup_links where ops_member_id = $1", [ops!.ops_member_id]),
    ).toBe(1);
    const sent = t.mailsTo(email);
    expect(sent).toHaveLength(1);
    const tok = t.tokenIn(sent[0]);
    expect(tok).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sent[0]!.subject).not.toContain(tok!);
    expect(
      await t.n(
        "select count(*)::int as n from ops_audit_events where action = 'ops_member.add' and target_id = $1 and target_tenant_id = $2",
        [ops!.ops_member_id, OPS_TENANT],
      ),
    ).toBe(1);
  });

  it("K985-API-006 届いたリンク：メールの印で startOpsSetup が 201・解決は role ops・mfaPending true", async () => {
    const me = await admin("link-me");
    const email = h.email("link-new");
    expect((await add(me.token, { email, caps: ["inquiry"] })).status).toBe(201);
    const tok = t.tokenIn(t.mailsTo(email)[0]);
    const r = await h.req("POST", SETUP, { token: tok });
    expect(r.status, await r.clone().text()).toBe(201);
    const s = String((await h.json(r)).data?.["token"]);
    const res = await t.o.resolve(s);
    expect(res?.ctx.role).toBe("ops");
    expect(res?.mfaPending).toBe(true);
  });

  it('K985-API-016 名前は入るときに本人が付ける：startOpsSetup に { token, name: " 佐野 美穂 " } で 201・運営の会社の members.display_name は「佐野 美穂」。名前を送らない回はメールの @ の前のまま（D-156.66）', async () => {
    const me = await admin("name-me");
    const email = h.email("name-new");
    expect((await add(me.token, { email, caps: ["inquiry"] })).status).toBe(201);
    const nameOf = async () =>
      (
        await h.admin.query<{ n: string }>(
          `select m.display_name as n from members m join kaname_auth."user" u on u.id = m.auth_user_id
            where m.tenant_id = $1 and u.email = $2`,
          [OPS_TENANT, email],
        )
      ).rows[0]?.n;
    expect(await nameOf()).toBe(email.split("@")[0]);
    const r = await h.req("POST", SETUP, { token: t.tokenIn(t.mailsTo(email)[0]), name: " 佐野 美穂 " });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await nameOf()).toBe("佐野 美穂");
  });

  it("K985-API-017 名前の形：空・空白だけ・41 字は 422 で、リンクは使われず名前も変わらない（同じ印で名前を直すと 201）", async () => {
    const me = await admin("name-bad");
    const email = h.email("name-bad-new");
    expect((await add(me.token, { email, caps: ["inquiry"] })).status).toBe(201);
    const tok = t.tokenIn(t.mailsTo(email)[0]);
    for (const name of ["", "\u3000 \t", "あ".repeat(41)]) {
      const r = await h.req("POST", SETUP, { token: tok, name });
      expect(r.status, JSON.stringify(name)).toBe(422);
    }
    expect((await h.req("POST", SETUP, { token: tok, name: "木村 健" })).status).toBe(201);
  });

  it("K985-API-007 もう運営の人：409・E-OPS-015・欄なし。人・リンク・メールが増えない", async () => {
    const me = await admin("dup-me");
    const other = await t.o.makeOps("dup-other", { caps: ["inquiry"] });
    const links = await t.n("select count(*)::int as n from ops_setup_links");
    const r = await add(me.token, { email: other.email, caps: ["money"] });
    expect(r.status, await r.clone().text()).toBe(409);
    const j = await t.json(r);
    expect(j["code"]).toBe("E-OPS-015");
    expect(j["field"]).toBeUndefined();
    expect(await opsMembersOf(other.email)).toBe(1);
    expect(await t.n("select count(*)::int as n from ops_setup_links")).toBe(links);
    expect(t.mailsTo(other.email)).toHaveLength(0);
  });

  it("K985-API-008 顧客のメール：409・E-OPS-016・欄なし。運営の会社の members が増えず、その人の利用者は消えない", async () => {
    const me = await admin("cust-me");
    const u = await h.makeUser("cust-target");
    const r = await add(me.token, { email: u.email, caps: ["inquiry"] });
    expect(r.status, await r.clone().text()).toBe(409);
    const j = await t.json(r);
    expect(j["code"]).toBe("E-OPS-016");
    expect(j["field"]).toBeUndefined();
    expect(await opsMembersOf(u.email)).toBe(0);
    expect(await usersWith(u.email)).toBe(1);
  });

  it("K985-API-009 外した人を足し直す：同じ member_id で生き返る・caps は新しい物・前のリンクは 409 E-PAGE-006・新しいリンクは 201", async () => {
    const me = await admin("again-me");
    const email = h.email("again-new");
    expect((await add(me.token, { email, caps: ["inquiry"] })).status).toBe(201);
    const first = await t.opsOf(email);
    const oldTok = t.tokenIn(t.mailsTo(email)[0]);
    await t.revoke(first!.member_id);
    const r = await add(me.token, { email, caps: ["money", "stop"] });
    expect(r.status, await r.clone().text()).toBe(201);
    const again = await t.opsOf(email);
    expect(again?.member_id).toBe(first!.member_id);
    expect(again?.revoked_at).toBeNull();
    expect(again?.caps).toEqual(["money", "stop"]);
    expect(await opsMembersOf(email)).toBe(1);
    const newTok = t.tokenIn(t.mailsTo(email)[1]);
    expect(newTok).not.toBe(oldTok);
    const old = await h.req("POST", SETUP, { token: oldTok });
    expect(old.status).toBe(409);
    expect((await h.json(old))["code"]).toBe("E-PAGE-006");
    expect((await h.req("POST", SETUP, { token: newTok })).status).toBe(201);
  });

  it("K985-API-010 表記ゆらぎ：前後の空白と大文字のメールは小文字にそろえて残し、同じ人の 2 回目は 409 E-OPS-015", async () => {
    const me = await admin("norm-me");
    const email = h.email("norm-new");
    const r = await add(me.token, { email: `  ${email.toUpperCase()} `, caps: ["inquiry"] });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await t.json(r)).data as Record<string, unknown>)["email"]).toBe(email);
    const again = await add(me.token, { email, caps: ["inquiry"] });
    expect(again.status).toBe(409);
    expect((await t.json(again))["code"]).toBe("E-OPS-015");
  });

  it("K985-API-011 形の誤り：caps の空・知らない字・重なり・10 個・文字列、email の無い・形の違う・255 字、余計な欄は 422。人が増えない", async () => {
    const me = await admin("bad-me");
    const email = h.email("bad-new");
    const bodies: unknown[] = [
      { email, caps: [] },
      { email, caps: ["owner"] },
      { email, caps: ["inquiry", "inquiry"] },
      {
        email,
        caps: [
          "inquiry",
          "peek",
          "money",
          "stop",
          "notice",
          "distribute",
          "plan_propose",
          "plan_decide",
          "ops_people",
          "inquiry",
        ],
      },
      { email, caps: "inquiry" },
      { caps: ["inquiry"] },
      { email: "not-a-mail", caps: ["inquiry"] },
      { email: `${"a".repeat(243)}@example.com`, caps: ["inquiry"] },
      { email, caps: ["inquiry"], name: "佐野" },
    ];
    for (const b of bodies) {
      const r = await add(me.token, b);
      expect(r.status, JSON.stringify(b)).toBe(422);
    }
    expect(await usersWith(email)).toBe(0);
  });

  it("K985-API-012 取り直していない：403・STEP_UP_REQUIRED・人もリンクも増えない", async () => {
    const me = await t.signedIn("step-me");
    const email = h.email("step-new");
    const r = await add(me.token, { email, caps: ["inquiry"] });
    expect(r.status).toBe(403);
    expect((await t.json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await usersWith(email)).toBe(0);
    expect(t.mailsTo(email)).toHaveLength(0);
  });

  it("K985-API-013 メールが送れない：201・mail_sent false・運営の人とリンクは残る・ログに宛先と印が無い", async () => {
    const me = await admin("mailfail-me");
    const email = h.email("mailfail-new");
    failMailTo.add(email);
    let r: Response | null = null;
    try {
      const logs = await h.captureLogs(async () => {
        r = await add(me.token, { email, caps: ["inquiry"] });
      });
      expect(r!.status, await r!.clone().text()).toBe(201);
      expect((await t.json(r!)).meta?.["mail_sent"]).toBe(false);
      expect(logs).toContain("招待のメールを送れなかった");
      expect(logs).not.toContain(email);
      expect(logs).not.toMatch(/#token=/);
      const ops = await t.opsOf(email);
      expect(ops).toBeDefined();
      expect(
        await t.n("select count(*)::int as n from ops_setup_links where ops_member_id = $1", [ops!.ops_member_id]),
      ).toBe(1);
    } finally {
      failMailTo.delete(email);
    }
  });

  it("K985-API-014 書けない：ops_members への書き込みを落とすと 503・E-PAGE-003・利用者も members も残らず・メールが無い", async () => {
    const me = await admin("break-me");
    const email = h.email("break-new");
    const fix = await t.breakWrites(
      "ops_members",
      `new.member_id in (select m.id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = '${email}')`,
    );
    try {
      const r = await add(me.token, { email, caps: ["inquiry"] });
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await usersWith(email)).toBe(0);
    expect(await opsMembersOf(email)).toBe(0);
    expect(t.mailsTo(email)).toHaveLength(0);
  });

  it("K985-DB-001 2 層目：会社の人の文脈で app.ops_member_add を直に呼ぶと 42501・PUBLIC は app.ops_members_list を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true)", [
        OPS_TENANT,
      ]);
      await expect(
        app.query("select app.ops_member_add($1, '偽', array['inquiry'], $2)", ["u-fake", "0".repeat(64)]),
      ).rejects.toMatchObject({ code: "42501" });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_members_list()', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});
