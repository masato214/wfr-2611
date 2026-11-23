// K-945「運営の最初の 1 人とパスキーを付けるリンク」の単体の試験（本物の DB・本物のログインの部品・本番と同じ bootApi・土台 ops.harness.ts）。
// テストの名前の頭の行 ID（K945-API-…）は 11_tickets/K-945.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める形（K-945 が決める本体・D-156.22）:
//   createFirstOps(admin, auth, { email, name, webBaseURL, mailer })  … packages/auth/src/ops-first.ts（命令 ops:first の中身）
//   cliMailer(config, inner?)  … 同じファイル。台本の本物の送り出し（signedMail で署名と返信先・from は mailFrom・{ error } で投げる）
//     → { status: "sent" | "already" | "mail_failed" }
//     ・"already"：運営の人（ops_people）を持ち、パスキーを持つ別の運営の人が居る（その人が足し直す）。何も作らず、メールも送らない
//     ・それ以外：同じメールの運営の人が居ればその人に、居なければ作って（パスワードなし・運営の会社・できること 9 つ）、
//       パスキーを付けるリンク（24 時間・1 回だけ・前のリンクは使えなくなる）をメールで送る。リンクは {webBaseURL}/ops/setup#token=<43 字>
//   startOpsSetup  POST /api/v1/auth/ops-setup  ← { token }（ほかの欄は 422）・ログインしていない人が呼ぶ
//     201 { data: { token: <セッションの印> } }。セッションの入り方は 'ops_setup'：解決は role ops・mfaPending true（パスキーを付けるだけ。運営の口は 403 MFA_REQUIRED）
//     409 E-PAGE-006（無い・使った・期限切れ・欄なし）／ 422（形）／ 429（1 分に 10 回・IP ごと）
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { createHash } from "node:crypto";
import type { Mail } from "@kaname/auth";
import { cliMailer, createFirstOps } from "@kaname/auth/ops-first";
import { setupOps, ALL_CAPS, OPS_TENANT } from "./ops.harness.js";

const o = setupOps("k945");
const { h } = o;
const SETUP = "/api/v1/auth/ops-setup";
const WEB = "http://127.0.0.1:3123";
const OPS_SHELL = "/api/v1/ops/shell";
const REGISTER_OPTIONS = "/api/auth/passkey/generate-register-options";

const sent: Mail[] = [];
const mailer = async (m: Mail) => {
  sent.push(m);
};
const failing = async () => {
  throw new Error("daily quota exceeded");
};
const run = (email: string, m: (x: Mail) => Promise<void> = mailer) =>
  createFirstOps(h.admin as unknown as pg.Pool, h.auth, { email, name: "最初の運営", webBaseURL: WEB, mailer: m });
const tokenIn = (m: Mail | undefined) => /#token=([A-Za-z0-9_-]{43})$/.exec(m?.url ?? "")?.[1] ?? null;
const lastTo = (email: string) => [...sent].reverse().find((m) => m.to === email);
const setup = (token: unknown, extra: Record<string, unknown> = {}) => o.api("POST", SETUP, null, { token, ...extra });
const opsCount = async () =>
  Number(
    (
      await h.admin.query<{ n: string }>(
        "select count(*) as n from ops_members om join members m on m.id = om.member_id where om.revoked_at is null and om.deleted_at is null and m.deleted_at is null",
      )
    ).rows[0]!.n,
  );
/** ほかの試験が作った運営の人を外す（この試験は「運営の人が居ない」から始めたい）。終わりに戻す */
const aside = async (fn: () => Promise<void>) => {
  const r = await h.admin.query<{ id: string }>(
    "update ops_members set revoked_at = now() where revoked_at is null and deleted_at is null returning id",
  );
  try {
    await fn();
  } finally {
    await h.admin.query("update ops_members set revoked_at = null where id = any($1::uuid[])", [
      r.rows.map((x) => x.id),
    ]);
  }
};
const memberOf = async (email: string) =>
  (
    await h.admin.query<{ member_id: string; tenant_id: string; caps: string[]; auth_user_id: string }>(
      `select m.id as member_id, m.tenant_id, om.caps, m.auth_user_id from members m
         join kaname_auth."user" u on u.id = m.auth_user_id
         left join ops_members om on om.member_id = m.id and om.revoked_at is null and om.deleted_at is null
        where u.email = $1 and m.deleted_at is null`,
      [email],
    )
  ).rows;

describe("K-945 最初の 1 人を作る命令", () => {
  it("K945-API-001 運営の人が居ない × 命令：sent。パスワードの無い利用者・運営の会社の members・できること 9 つの ops_members を 1 つずつ作り、メールを 1 通送る", async () => {
    await aside(async () => {
      const email = h.email("first");
      expect((await run(email)).status).toBe("sent");
      const rows = await memberOf(email);
      expect(rows.length).toBe(1);
      expect(rows[0]!.tenant_id).toBe(OPS_TENANT);
      expect([...rows[0]!.caps].sort()).toEqual([...ALL_CAPS].sort());
      const pw = await h.admin.query(`select 1 from kaname_auth.account where "userId" = $1 and password is not null`, [
        rows[0]!.auth_user_id,
      ]);
      expect(pw.rowCount, "パスワードを持たない").toBe(0);
      expect(sent.filter((m) => m.to === email).length).toBe(1);
    });
  });

  it("K945-API-002 送ったメール：リンクは {画面}/ops/setup#token=<43 字>（問い合わせの値に載せない）。本文にリンクの印もパスワードも書かない（リンクにだけある）", async () => {
    await aside(async () => {
      const email = h.email("mail");
      await run(email);
      const m = lastTo(email)!;
      expect(m.url.startsWith(`${WEB}/ops/setup#token=`)).toBe(true);
      const t = tokenIn(m)!;
      expect(t).toBeTruthy();
      expect(m.url).not.toContain("?");
      expect(m.text).not.toContain(t);
    });
  });

  it("K945-API-003 運営の人を持ち、パスキーのある別の運営の人が居る × 命令：already。人も行もリンクも作らず、メールも送らない", async () => {
    await aside(async () => {
      const boss = await o.makeOps("boss", { caps: ["ops_people"] });
      await o.addPasskey(boss.userId);
      const before = { ops: await opsCount(), mails: sent.length };
      const email = h.email("second");
      expect((await run(email)).status).toBe("already");
      expect(await opsCount()).toBe(before.ops);
      expect(sent.length).toBe(before.mails);
      expect((await memberOf(email)).length).toBe(0);
    });
  });

  it("K945-API-004 最後の 1 人がパスキーを無くした（運営の人は居るがパスキーが無い）× 同じメールで命令：人を増やさず、新しいリンクを送る。前のリンクは 409", async () => {
    await aside(async () => {
      const email = h.email("lost");
      await run(email);
      const old = tokenIn(lastTo(email))!;
      const n = await opsCount();
      expect((await run(email)).status).toBe("sent");
      expect(await opsCount()).toBe(n);
      expect((await memberOf(email)).length).toBe(1);
      const now = tokenIn(lastTo(email))!;
      expect(now).not.toBe(old);
      expect((await setup(old)).status).toBe(409);
      expect((await setup(now)).status).toBe(201);
    });
  });

  it("K945-API-005 メールを送れない：mail_failed。送れたと言わず、もう一度流すと新しいリンクを送る", async () => {
    await aside(async () => {
      const email = h.email("mailfail");
      expect((await run(email, failing)).status).toBe("mail_failed");
      expect(lastTo(email)).toBeUndefined();
      expect((await run(email)).status).toBe("sent");
      expect(tokenIn(lastTo(email))).toBeTruthy();
    });
  });
});

describe("K-945 リンクでパスキーを付ける（startOpsSetup）", () => {
  const fresh = async (tag: string) => {
    let token = "";
    await aside(async () => {
      const email = h.email(tag);
      await run(email);
      token = tokenIn(lastTo(email))!;
    });
    return token;
  };

  it("K945-API-006 使えるリンク：201 とセッションの印。入り方は ops_setup・解決は role ops・tenantId null・mfaPending true", async () => {
    const t = await fresh("ok");
    const r = await setup(t);
    expect(r.status, await r.clone().text()).toBe(201);
    const s = String(((await h.json(r)).data ?? {})["token"]);
    const x = await o.resolve(s);
    expect(x!.ctx.role).toBe("ops");
    expect(x!.ctx.tenantId).toBeNull();
    expect(x!.mfaPending).toBe(true);
    const kind = await h.admin.query<{ k: string }>(
      "select login_kind as k from sessions where member_id = $1 and revoked_at is null order by issued_at desc limit 1",
      [x!.ctx.userId],
    );
    expect(kind.rows[0]!.k).toBe("ops_setup");
  });

  it("K945-API-007 付けるだけのセッションで運営の口：403 MFA_REQUIRED（運営の口に届かない）", async () => {
    const r = await setup(await fresh("mfa"));
    const s = String(((await h.json(r)).data ?? {})["token"]);
    const ops = await o.api("GET", OPS_SHELL, s);
    expect(ops.status).toBe(403);
    expect((await h.json(ops))["code"]).toBe("MFA_REQUIRED");
  });

  it("K945-API-008 付けるだけのセッションでパスキーを付け始める（部品の付ける口のチャレンジ）：200（ログインから 15 分の内）", async () => {
    const r = await setup(await fresh("reg"));
    const s = String(((await h.json(r)).data ?? {})["token"]);
    const reg = await o.api("GET", REGISTER_OPTIONS, s, undefined, { origin: WEB });
    expect(reg.status, await reg.clone().text()).toBe(200);
  });

  it("K945-API-009 付けた後にパスキーで入る：解決は role ops・mfaPending false（ふつうの運営のセッション）", async () => {
    const t = await fresh("after");
    const r = await setup(t);
    const x = await o.resolve(String(((await h.json(r)).data ?? {})["token"]));
    const u = await h.admin.query<{ a: string }>("select auth_user_id as a from members where id = $1", [
      x!.ctx.userId,
    ]);
    const a = await o.addPasskey(u.rows[0]!.a);
    const signed = await o.passkeySignIn(u.rows[0]!.a, a);
    expect(signed.status).toBe(200);
    const y = await o.resolve(o.tokenOf(signed)!);
    expect(y!.ctx.role).toBe("ops");
    expect(y!.mfaPending).toBe(false);
  });

  it("K945-API-010 使ったリンクをもう一度：409 E-PAGE-006（欄なし）・セッションの印なし", async () => {
    const t = await fresh("used");
    expect((await setup(t)).status).toBe(201);
    const again = await setup(t);
    expect(again.status).toBe(409);
    const b = await h.json(again);
    expect(b["code"]).toBe("E-PAGE-006");
    expect(b).not.toHaveProperty("field");
    expect(b.data).toBeUndefined();
  });

  it("K945-API-011 期限を過ぎたリンク（作って 24 時間後・行の印は sha256 の 16 進）：409 E-PAGE-006", async () => {
    const t = await fresh("expired");
    const hash = createHash("sha256").update(t).digest("hex");
    await h.admin.query("update ops_setup_links set expires_at = now() - interval '1 second' where token_hash = $1", [
      hash,
    ]);
    expect((await setup(t)).status).toBe(409);
  });

  it("K945-API-012 無いリンク（形は正しい 43 字）：409 E-PAGE-006。形の違う印（42 字・記号）は 422", async () => {
    expect((await setup("A".repeat(43))).status).toBe(409);
    expect((await setup("A".repeat(42))).status).toBe(422);
    expect((await setup(`${"A".repeat(42)}!`)).status).toBe(422);
  });

  it("K945-API-013 欄が足りない・余計な欄：token が無い 422・email を足すと 422（strict）", async () => {
    expect((await o.api("POST", SETUP, null, {})).status).toBe(422);
    expect((await setup(await fresh("extra"), { email: "x@example.com" })).status).toBe(422);
  });

  it("K945-API-014 同じリンクを 2 つ同時に送る：201 は 1 つだけ・もう 1 つは 409。セッションは 1 つだけ増える", async () => {
    const t = await fresh("twice");
    const [a, b] = await Promise.all([setup(t), setup(t)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it("K945-API-015 送りすぎ：1 分に 11 回目は 429（同じ IP）", async () => {
    const ip = h.nextIp();
    let last = 0;
    for (let i = 0; i < 11; i++)
      last = (await h.req("POST", SETUP, { token: "B".repeat(43) }, { ip, headers: { "user-agent": "k945" } })).status;
    expect(last).toBe(429);
  });

  it("K945-API-016 運営の人のパスワードの道は今までどおり断る（K-944）：リンクを作った人でもパスワードで入れない（パスワードを持たない＝E-AUTH-001）", async () => {
    let email = "";
    await aside(async () => {
      email = h.email("nopw");
      await run(email);
    });
    const r = await h.signIn(email, "any-password-123");
    expect(r.status).toBe(401);
    expect(o.tokenOf(r)).toBeNull();
  });
});

describe("K-945 失敗の道（外に影響する手順 S1・S3）", () => {
  /** 試験の間だけ、指した表に落ちる引き金を置く。fn の後で必ず外す */
  const withTrigger = async (name: string, table: string, when: string, cond: string, fn: () => Promise<void>) => {
    await h.admin.query(`create or replace function app.${name}() returns trigger language plpgsql as $$
      begin if ${cond} then raise exception 'K-945 の試験：${name}'; end if;
      return case when tg_op = 'DELETE' then old else new end; end $$`);
    await h.admin.query(`create trigger ${name} ${when} on ${table} for each row execute function app.${name}()`);
    try {
      await fn();
    } finally {
      await h.admin.query(`drop trigger if exists ${name} on ${table}`);
      await h.admin.query(`drop function if exists app.${name}()`);
    }
  };
  /** 使えるリンクの印と、その人（members.id・認証の利用者の id） */
  const freshWithPerson = async (tag: string) => {
    let token = "";
    let email = "";
    await aside(async () => {
      email = h.email(tag);
      await run(email);
      token = tokenIn(lastTo(email))!;
    });
    const p = (await memberOf(email))[0]!;
    return { token, memberId: p.member_id, userId: p.auth_user_id };
  };
  const kindDown = (memberId: string) =>
    `new.member_id = '${memberId}'::uuid and new.login_kind is distinct from old.login_kind`;

  it("K945-API-017 手順 S1 の失敗：命令の取引の途中で落ちる（ops_members に書けない）：命令は投げて終わり、その宛先の認証の利用者・members・運営の人・リンクの行は 0、メールも送らない", async () => {
    await aside(async () => {
      const email = h.email("txfail");
      await withTrigger(
        "k945_ops_down",
        "ops_members",
        "before insert",
        `exists (select 1 from members m join kaname_auth."user" u on u.id = m.auth_user_id where m.id = new.member_id and u.email = '${email}')`,
        async () => {
          await expect(run(email)).rejects.toThrow();
        },
      );
      expect(await memberOf(email)).toHaveLength(0);
      const users = await h.admin.query<{ n: string }>(
        'select count(*) as n from kaname_auth."user" where email = $1',
        [email],
      );
      expect(Number(users.rows[0]!.n), "取引ごと戻る（認証の利用者も残らない）").toBe(0);
      const links = await h.admin.query<{ n: string }>(
        `select count(*) as n from ops_setup_links l join ops_members om on om.id = l.ops_member_id
           join members m on m.id = om.member_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1`,
        [email],
      );
      expect(Number(links.rows[0]!.n)).toBe(0);
      expect(lastTo(email)).toBeUndefined();
    });
  });

  it("K945-API-018 手順 S3 の失敗：入り方を書けない：503 E-PAGE-003・印なし。認証側のセッションは消してから上げる（数は前と同じ）。同じリンクをもう一度送ると 409（使った印のまま）", async () => {
    const f = await freshWithPerson("kinddown");
    const before = await h.authSessions(f.userId);
    let r: Response | undefined;
    await withTrigger("k945_kind_down", "sessions", "before update", kindDown(f.memberId), async () => {
      r = await setup(f.token);
    });
    expect(r!.status, await r!.clone().text()).toBe(503);
    const j = await h.json(r!);
    expect(j["code"]).toBe("E-PAGE-003");
    expect(j["data"] ?? null).toBeNull();
    expect(await h.authSessions(f.userId), "半分だけ入った状態を残さない").toBe(before);
    expect((await setup(f.token)).status).toBe(409);
  });

  it("K945-API-019 手順 S3 の後片付けが失敗：入り方を書けず、認証側のセッションを消すのも落ちる：503 E-PAGE-003・印なし・ログに「後片付け」。残った認証側のセッションの印は、解決が null・運営の口は 401（入り方が無い）", async () => {
    const f = await freshWithPerson("cleanupdown");
    let r: Response | undefined;
    let logs = "";
    await withTrigger(
      "k945_auth_keep",
      "kaname_auth.session",
      "before delete",
      `old."userId" = '${f.userId}'`,
      async () => {
        await withTrigger("k945_kind_down2", "sessions", "before update", kindDown(f.memberId), async () => {
          logs = await h.captureLogs(async () => {
            r = await setup(f.token);
          });
        });
      },
    );
    expect(r!.status, await r!.clone().text()).toBe(503);
    expect((await h.json(r!))["code"]).toBe("E-PAGE-003");
    expect(logs).toMatch(/後片付け/);
    const left = await h.admin.query<{ token: string }>(
      'select token from kaname_auth.session where "userId" = $1 order by "createdAt" desc limit 1',
      [f.userId],
    );
    const token = left.rows[0]?.token;
    expect(token, "後片付けが落ちたので認証側のセッションが残っている").toBeTruthy();
    expect(await o.resolve(token!)).toBeNull();
    expect((await o.api("GET", OPS_SHELL, token!)).status).toBe(401);
  });

  it("K945-API-020 台本の送り出し（関門 C6 の 1 か所）：from は mailFrom・replyTo は mailReplyTo・本文の末尾に運営者の署名。送り口が error を返すと投げる", async () => {
    const got: { from: string; to: string; subject: string; text: string; replyTo?: string }[] = [];
    const config = {
      resendApiKey: null,
      mailFrom: "Kaname <no-reply@example.test>",
      mailReplyTo: "info@example.test",
      operator: {
        service: "Kaname",
        company: "試験の運営会社",
        representative: "試験 太郎",
        email: "info@example.test",
        phone: "000",
        address: null,
      },
    };
    const okMail = cliMailer(config as never, {
      send: async (m) => {
        got.push(m);
        return { error: null };
      },
    });
    await okMail({
      to: "first@example.test",
      subject: "件名",
      text: "本文",
      url: `${WEB}/ops/setup#token=x`,
      kind: "ops_setup",
    });
    expect(got).toHaveLength(1);
    expect(got[0]!.from).toBe(config.mailFrom);
    expect(got[0]!.replyTo).toBe(config.mailReplyTo);
    expect(got[0]!.text.startsWith("本文")).toBe(true);
    expect(got[0]!.text).toContain("試験の運営会社");
    const badMail = cliMailer(config as never, { send: async () => ({ error: { message: "rejected" } }) });
    await expect(
      badMail({
        to: "first@example.test",
        subject: "件名",
        text: "本文",
        url: `${WEB}/ops/setup#token=x`,
        kind: "ops_setup",
      }),
    ).rejects.toThrow();
  });
});
