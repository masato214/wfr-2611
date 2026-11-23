// K-305「端末をなくした：ワークスペースの管理者に戻してもらうよう頼む」の単体の試験（契約の口 requestAdminRecovery・本物の DB）。
// テストの名前の頭の行 ID（K305-API-…・K305-DB-…）は 11_tickets/K-305.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 土台は K-301 の login.harness.ts（本番と同じ bootApi・確定した本人 makeUser・関門 C6 の偽の送出先 mails／failMailTo・待ちの印 pendingOf）。
// 時刻は眠らずに、DB に過去の行を入れるか、待ちの印の期限を now() からずらして進める。
//
// 試験が決める口の形（K-305 が決める・段 2 の精査の後の決め 12。K-317 が合わせる）:
//   POST /api/v1/auth/recovery/admin-request・誰でも・10 回／分／IP・関門 C2 と C6
//     体 { pending }（K-302 の verifySignInCode と同じ欄。欄が無い・文字でない・知らない欄は 422（K-302 と同じ））
//     待ちの印が切れた・でたらめ → 401・E-AUTH-013（K-302 が足す・番号は決め打ち・決め 1）
//     201 { data: { result } }
//       "sent"     … 頼んだ（管理者に受け箱の知らせとメール）
//       "already"  … 1 時間の内にもう頼んである（届いている）。何も足さない
//       "failed"   … 管理者へのメールが 1 通でも送れなかった（記録と受け箱は残る）。押し直すと、送れなかった管理者にだけ送り直す
//       "no_admin" … 本人のほかに管理者がいない。記録だけ残し、何も送らない（画面は運営が戻す・answer=75dc21e85b2e）
//   管理者：本人が入っている全部のワークスペースの、本人でない管理者（所属の役割が admin・会社を作った人 members.role_id = owner）。
//     member が抜けた・止められた、同じ組の所属が left・suspended の管理者には送らない（D-128.141・answer=75dc21e85b2e の ⑧ と同じ見方）
//   記録：本人が入っているワークスペースごとに security_events（kind_id admin_recovery_requested・member_id は本人）。
//     メールが送れなかったら同じワークスペースに admin_recovery_send_failed
//   受け箱：管理者ごとに notifications（event_kind_id security.admin_recovery_requested・payload は requester_member_id だけ）
//   メンバーの画面（/members/:id）と戻す口（resetMemberTwoFactor）ができるまでは、メールにリンクを入れず、運営への連絡先を書く（G-04）
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { signUp } from "@kaname/auth/signup";
import { PW, failMailTo, mails, pendingOf, setPendingExpiry, setupLogin, type User } from "./login.harness.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const FEATURE_DIR = join(ROOT, "apps", "api", "src", "features", "F1", "admin-recovery");
const OPS_EMAIL = "ops-login@example.com"; // 土台（login.harness.ts）の config.opsEmail
const ASK = "/api/v1/auth/recovery/admin-request";
const PENDING_EXPIRED = "E-AUTH-013"; // 待ちの印が切れた（K-302 が足す・決め 1）
const KIND = "admin_recovery_requested";
const KIND_FAILED = "admin_recovery_send_failed";
const EVENT = "security.admin_recovery_requested";

const h = setupLogin("k305");

/** 2 段階を付けた本人。owner のままにしない（管理者の数を所属の行の admin だけで数える）ときは demote */
const requester = async (tag: string, o: { keepOwner?: boolean } = {}) => {
  const u = await h.makeUser(tag, { twoFactor: true });
  if (!o.keepOwner) {
    await h.admin.query("update members set role_id = null where id = $1", [u.memberId]);
    // 会社を作った人は admin の所属の行を持つ（D-148.49）。あれば member に直し、無ければ足す
    await h.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active') on conflict (tenant_id, member_id) do update set role = 'member', status = 'active', deleted_at = null",
      [u.tenantId, u.memberId, u.userId],
    );
  }
  return u;
};
/** そのワークスペースに人を足す（ログインの部品の利用者と member と所属の行） */
const addPerson = async (
  tenantId: string,
  tag: string,
  role: "admin" | "member",
  status: "active" | "suspended" | "left" = "active",
) => {
  const e = h.email(tag);
  const r = await signUp(h.auth, { email: e, password: PW, name: `管理者 ${tag}` });
  const scope = (await h.admin.query<{ id: string }>("select id from scopes where tenant_id = $1 limit 1", [tenantId]))
    .rows[0]!.id;
  const id = (
    await h.admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values ($1, $2, 'human', $3, $4) returning id",
      [tenantId, scope, `管理者 ${tag}`, r.userId],
    )
  ).rows[0]!.id;
  await h.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, $5)",
    [tenantId, id, r.userId, role, status],
  );
  return { email: e, memberId: id, userId: r.userId };
};
/** 同じ人を別のワークスペースにも入れる（D-125.150。fixture.ts の alsoIn と同じ形） */
const alsoIn = async (u: User, tag: string) => {
  const co = await h.makeUser(`${tag}-owner`);
  await h.admin.query("update members set role_id = null where id = $1", [co.memberId]);
  const scope = (
    await h.admin.query<{ id: string }>("select id from scopes where tenant_id = $1 limit 1", [co.tenantId])
  ).rows[0]!.id;
  const id = (
    await h.admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '頼む人') returning id",
      [co.tenantId, scope],
    )
  ).rows[0]!.id;
  await h.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active')",
    [co.tenantId, id, u.userId],
  );
  return { tenantId: co.tenantId, memberId: id };
};
const nameOf = async (memberId: string) =>
  (await h.admin.query<{ n: string }>("select display_name as n from members where id = $1", [memberId])).rows[0]!.n;
const ask = (body: unknown, ip?: string) => h.req("POST", ASK, body, ip ? { ip } : {});
const resultOf = async (r: Response) => {
  expect(r.status, await r.clone().text()).toBe(201);
  const d = (await h.json(r)).data as Record<string, unknown>;
  expect(Object.keys(d), "答えは result だけ（決め 12）").toEqual(["result"]);
  return String(d["result"]);
};
const eventsOf = async (tenantId: string, kind = KIND) =>
  (
    await h.admin.query<{ member_id: string | null; detail: Record<string, unknown> }>(
      "select member_id, detail from security_events where tenant_id = $1 and kind_id = $2",
      [tenantId, kind],
    )
  ).rows;
const allEvents = async (kind = KIND) =>
  Number(
    (await h.admin.query<{ n: string }>("select count(*) as n from security_events where kind_id = $1", [kind]))
      .rows[0]!.n,
  );
const noticesTo = async (memberId: string) =>
  (
    await h.admin.query<{ payload: Record<string, unknown> }>(
      "select payload from notifications where member_id = $1 and event_kind_id = $2 and deleted_at is null",
      [memberId, EVENT],
    )
  ).rows;
const mailsTo = (e: string) => mails.filter((m) => m.to === e);
/** 2 段階を付けた本人と、同じワークスペースの管理者 1 人 */
const setup = async (tag: string) => {
  const u = await requester(tag);
  const adm = await addPerson(u.tenantId, `${tag}-admin`, "admin");
  return { u, adm };
};

describe("K-305 管理者に頼む：届く", () => {
  it("K305-API-001 待ちの印あり × 頼む：201・sent。管理者に受け箱 1 つ・メール 1 通・頼みの記録 1 行。本人には送らない", async () => {
    const { u, adm } = await setup("ok");
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
    expect(mailsTo(adm.email)).toHaveLength(1);
    expect(mailsTo(u.email)).toHaveLength(0);
    expect((await eventsOf(u.tenantId)).map((e) => e.member_id)).toEqual([u.memberId]);
  });

  it("K305-API-002 2 つのワークスペースに入っている人：両方の管理者に届き（D-128.141）、頼みの記録はワークスペースごとに 1 行", async () => {
    const { u, adm } = await setup("multi");
    const b = await alsoIn(u, "multi-b");
    const admB = await addPerson(b.tenantId, "multi-b-admin", "admin");
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
    expect(await noticesTo(admB.memberId)).toHaveLength(1);
    expect(mailsTo(admB.email)).toHaveLength(1);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
    expect((await eventsOf(b.tenantId)).map((e) => e.member_id)).toEqual([b.memberId]);
  });

  it("K305-API-003 本人も所属の行で管理者・ほかに管理者がいる：ほかの管理者にだけ届く（自分には送らない）", async () => {
    const { u, adm } = await setup("self-admin");
    await h.admin.query("update tenant_memberships set role = 'admin' where member_id = $1", [u.memberId]);
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(mailsTo(u.email)).toHaveLength(0);
    expect(await noticesTo(u.memberId)).toHaveLength(0);
    expect(mailsTo(adm.email)).toHaveLength(1);
  });

  it("K305-API-004 本人のほかに管理者がいない（誰も管理者でない会社）：no_admin。何も送らず、頼みの記録だけ残る（運営が本人を確かめて戻す・D-128.141）", async () => {
    const u = await requester("solo");
    const sent = mails.length;
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("no_admin");
    expect(mails.length).toBe(sent);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
  });

  it("K305-API-005 会社を作った人（owner）は管理者として届く。member が抜けた・止められた、所属の行が left・suspended の管理者には届かない", async () => {
    const u = await requester("owner");
    const owner = await addPerson(u.tenantId, "owner-o", "member");
    await h.admin.query("update members set role_id = 'owner' where id = $1", [owner.memberId]);
    const gone = await addPerson(u.tenantId, "owner-gone", "admin");
    await h.admin.query("update members set deleted_at = now() where id = $1", [gone.memberId]);
    const stopped = await addPerson(u.tenantId, "owner-stopped", "admin");
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [stopped.memberId]);
    const msLeft = await addPerson(u.tenantId, "owner-ms-left", "admin", "left");
    const msStopped = await addPerson(u.tenantId, "owner-ms-stopped", "admin", "suspended");
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(mailsTo(owner.email)).toHaveLength(1);
    for (const x of [gone, stopped, msLeft, msStopped]) {
      expect(mailsTo(x.email), x.email).toHaveLength(0);
      expect(await noticesTo(x.memberId), x.email).toHaveLength(0);
    }
  });

  it("K305-API-020 1 人で会社を作った人（owner のまま・唯一の管理者が本人）：no_admin。本人にメールも受け箱も出さない（owner の道でも本人を除く）", async () => {
    const u = await requester("owner-alone", { keepOwner: true });
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("no_admin");
    expect(mailsTo(u.email)).toHaveLength(0);
    expect(await noticesTo(u.memberId)).toHaveLength(0);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
  });
});

describe("K-305 管理者に頼む：二重・時間・失敗", () => {
  it("K305-API-006 届いた後に 1 時間の内にもう一度押す：already。受け箱・メール・記録は増えない", async () => {
    const { u, adm } = await setup("again");
    await resultOf(await ask({ pending: await pendingOf(h, u) }));
    const sent = mails.length;
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("already");
    expect(mails.length).toBe(sent);
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
  });

  it("K305-API-007 前の頼みが 59 分前なら already、61 分前なら sent（1 時間の境目・DB の now() で比べる）", async () => {
    const prior = (u: User, minutes: number) =>
      h.admin.query(
        "insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at) values ($1, $2, $3, '{}'::jsonb, now() - make_interval(mins => $4))",
        [u.tenantId, KIND, u.memberId, minutes],
      );
    const a = await setup("hour-59");
    await prior(a.u, 59);
    expect(await resultOf(await ask({ pending: await pendingOf(h, a.u) }))).toBe("already");
    const b = await setup("hour-61");
    await prior(b.u, 61);
    expect(await resultOf(await ask({ pending: await pendingOf(h, b.u) }))).toBe("sent");
  });

  it("K305-API-008 2 つのタブで同時に押す：片方は sent、もう片方は already。記録・受け箱・メールは 1 つずつ", async () => {
    const { u, adm } = await setup("race");
    const [t1, t2] = [await pendingOf(h, u), await pendingOf(h, u)];
    const rs = await Promise.all([ask({ pending: t1 }), ask({ pending: t2 })]);
    const results = (await Promise.all(rs.map(resultOf))).sort();
    expect(results).toEqual(["already", "sent"]);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
    expect(mailsTo(adm.email)).toHaveLength(1);
  });

  it("K305-API-009 管理者へのメールが送れない：failed（送れたと言わない）。頼みの記録と送れなかった記録が残り、受け箱の知らせは残る", async () => {
    const { u, adm } = await setup("mailfail");
    failMailTo.add(adm.email);
    try {
      expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("failed");
    } finally {
      failMailTo.delete(adm.email);
    }
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
    expect(await eventsOf(u.tenantId, KIND_FAILED)).toHaveLength(1);
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
  });

  it("K305-API-010 送れなかった後にもう一度押す：送り直して sent。受け箱の知らせは 1 つのまま（二重に出ない）", async () => {
    const { u, adm } = await setup("retry");
    failMailTo.add(adm.email);
    try {
      expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("failed");
    } finally {
      failMailTo.delete(adm.email);
    }
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(mailsTo(adm.email)).toHaveLength(1);
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
  });

  it("K305-API-021 管理者 2 人のうち 1 人だけ送れない → 押し直す：送れなかった管理者にだけ送り直し、届いた管理者のメールは増えない", async () => {
    const { u, adm } = await setup("partial");
    const adm2 = await addPerson(u.tenantId, "partial-admin2", "admin");
    failMailTo.add(adm2.email);
    try {
      expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("failed");
    } finally {
      failMailTo.delete(adm2.email);
    }
    expect(mailsTo(adm.email)).toHaveLength(1);
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(mailsTo(adm.email), "届いた方には増えない").toHaveLength(1);
    expect(mailsTo(adm2.email), "送れなかった方にだけ送り直す").toHaveLength(1);
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
    expect(await noticesTo(adm2.memberId)).toHaveLength(1);
  });
});

describe("K-305 管理者に頼む：押し直しの行き止まりを作らない（Q の差し戻し・2026-11-18）", () => {
  it("K305-API-024 no_admin の後に 1 時間の内にもう一度押す：no_admin のまま（already にしない）。記録も受け箱もメールも増えない", async () => {
    const u = await requester("solo-again");
    const sent = mails.length;
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("no_admin");
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("no_admin");
    expect(mails.length).toBe(sent);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
  });

  it("K305-API-025 送り中のまま止まった受け箱の行（届いた印も送れなかった印も無く、最後に触ってから 2 分を過ぎた）：押し直すと送り直して sent。受け箱は 1 つのまま。触ってすぐの行（送り中・送り直しの最中）は送り直さず already", async () => {
    const { u, adm } = await setup("stuck");
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    const unsent = () =>
      h.admin.query(
        "update notifications set sent_at = null, failed_at = null where member_id = $1 and event_kind_id = $2",
        [adm.memberId, EVENT],
      );
    // 送った後に「送り終えた記録」が書けなかった形にする（届いた印を消す）。触ったばかりなので、まだ送り中とみなす
    await unsent();
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("already");
    expect(mailsTo(adm.email)).toHaveLength(1);
    // 最後に触ってから 3 分（updated_at を書き直す trigger を、この取引だけ止めて古くする）
    const c = await h.admin.connect();
    try {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      await c.query(
        "update notifications set updated_at = now() - interval '3 minutes' where member_id = $1 and event_kind_id = $2",
        [adm.memberId, EVENT],
      );
      await c.query("commit");
    } finally {
      c.release();
    }
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("sent");
    expect(mailsTo(adm.email)).toHaveLength(2);
    // 送り直しを引き受けた直後（届いた印がまだ無い）にもう 1 回押す：送り中なので already・メールは増えない
    await unsent();
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("already");
    expect(mailsTo(adm.email)).toHaveLength(2);
    expect(await noticesTo(adm.memberId)).toHaveLength(1);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
  });

  it("K305-API-026 送れなかった管理者が、押し直す前に止められた（ほかの管理者には届いている）：送り直さず already（いまの管理者の条件で引き直す）。届いた管理者にも増えない", async () => {
    const { u, adm } = await setup("gone-before-retry");
    const adm2 = await addPerson(u.tenantId, "gone-before-retry-admin2", "admin");
    failMailTo.add(adm2.email);
    try {
      expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("failed");
    } finally {
      failMailTo.delete(adm2.email);
    }
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [adm2.memberId]);
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("already");
    expect(mailsTo(adm2.email)).toHaveLength(0);
    expect(mailsTo(adm.email)).toHaveLength(1);
  });

  it("K305-API-027 管理者が 1 人だけで、その人に送れず、押し直す前にその人が止められた：誰にも届いていないので no_admin（already にしない）。メールは送らず、記録は増えない", async () => {
    const { u, adm } = await setup("only-admin-gone");
    failMailTo.add(adm.email);
    try {
      expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("failed");
    } finally {
      failMailTo.delete(adm.email);
    }
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [adm.memberId]);
    expect(await resultOf(await ask({ pending: await pendingOf(h, u) }))).toBe("no_admin");
    expect(mailsTo(adm.email)).toHaveLength(0);
    expect(await eventsOf(u.tenantId)).toHaveLength(1);
  });
});

describe("K-305 管理者に頼む：入れない入口・入力・守り", () => {
  it("K305-API-011 待ちの印の欄が無い（体が空）：422（K-302 と同じ）。知らせも記録も作らない", async () => {
    const before = await allEvents();
    const r = await ask({});
    expect(r.status, await r.clone().text()).toBe(422);
    expect(await allEvents()).toBe(before);
  });

  it("K305-API-012 待ちの印が切れた（5 分を過ぎた）・でたらめの印：401・E-AUTH-013。管理者に何も届かない", async () => {
    const { u, adm } = await setup("expired");
    const t = await pendingOf(h, u);
    await setPendingExpiry(h, u.userId, "now() - interval '1 second'");
    for (const tok of [t, "garbage-token-0000"]) {
      const r = await ask({ pending: tok });
      expect(r.status, await r.clone().text()).toBe(401);
      expect((await h.json(r))["code"]).toBe(PENDING_EXPIRED);
    }
    expect(await noticesTo(adm.memberId)).toHaveLength(0);
    expect(await eventsOf(u.tenantId)).toHaveLength(0);
  });

  it("K305-API-013 体に知らない欄・印が文字でない：422。何も書かない", async () => {
    const { u } = await setup("input");
    const t = await pendingOf(h, u);
    expect((await ask({ pending: t, member_id: u.memberId })).status).toBe(422);
    expect((await ask({ pending: 12345 })).status).toBe(422);
    expect(await eventsOf(u.tenantId)).toHaveLength(0);
  });

  it("K305-API-014 1 分に 11 回（同じ IP）：11 回目は 429・待つ秒数（retry_after_sec）", async () => {
    const ip = h.nextIp();
    for (let i = 0; i < 10; i++) expect((await ask({ pending: "garbage" }, ip)).status, `${i + 1} 回目`).toBe(401);
    const r = await ask({ pending: "garbage" }, ip);
    expect(r.status).toBe(429);
    expect(Number((await h.json(r))["retry_after_sec"])).toBeGreaterThan(0);
  });

  it("K305-API-015 管理者へのメールと受け箱の中身：頼んだ人の名前と運営への連絡先だけ。メンバーの画面ができるまではリンクを入れない（G-04）。パスワード・コード・待ちの印・IP・頼んだ人のメールを入れない", async () => {
    const { u, adm } = await setup("body");
    const t = await pendingOf(h, u);
    await resultOf(await ask({ pending: t }, "192.0.2.205"));
    const m = mailsTo(adm.email)[0]!;
    expect(m.text).toContain(await nameOf(u.memberId));
    expect(m.text).toContain(OPS_EMAIL);
    expect(m.text).not.toContain("/members/");
    for (const s of [PW, t, "192.0.2.205", u.email]) expect(`${m.subject}\n${m.text}`).not.toContain(s);
    const n = (await noticesTo(adm.memberId))[0]!;
    expect(Object.keys(n.payload)).toEqual(["requester_member_id"]);
    expect(n.payload["requester_member_id"]).toBe(u.memberId);
  });

  it("K305-API-016 ログ：頼んだ人と管理者のメール・待ちの印・IP が出ない", async () => {
    const { u, adm } = await setup("log");
    const t = await pendingOf(h, u);
    const log = await h.captureLogs(async () => {
      await resultOf(await ask({ pending: t }, "192.0.2.206"));
    });
    for (const s of [u.email, adm.email, t, "192.0.2.206"]) expect(log).not.toContain(s);
  });

  it("K305-API-017 頼みを書く関数が使えない（実行の権限を一時的に外す）：500・E-PAGE-003。メールも受け箱も作らない", async () => {
    const { u, adm } = await setup("down");
    const t = await pendingOf(h, u);
    const sig = (
      await h.admin.query<{ sig: string }>(
        "select p.oid::regprocedure::text as sig from pg_proc p where p.proname = 'request_admin_recovery' and p.pronamespace = 'app'::regnamespace",
      )
    ).rows[0]!.sig;
    const sent = mails.length;
    await h.admin.query(`revoke execute on function ${sig} from kaname_app`);
    let status = 0;
    let code: unknown = null;
    try {
      await h.captureLogs(async () => {
        const r = await ask({ pending: t });
        status = r.status;
        code = (await h.json(r))["code"];
      });
    } finally {
      await h.admin.query(`grant execute on function ${sig} to kaname_app`);
    }
    expect(status).toBe(500);
    expect(code).toBe("E-PAGE-003");
    expect(mails.length).toBe(sent);
    expect(await noticesTo(adm.memberId)).toHaveLength(0);
  });
});

describe("K-305 関数・関門・契約", () => {
  it("K305-DB-001 頼みを書く関数 app.request_admin_recovery：kaname_app は呼べ、誰でも（PUBLIC）は呼べない", async () => {
    const f = (
      await h.admin.query<{ acl: string | null; ok: boolean }>(
        `select p.proacl::text as acl, has_function_privilege('kaname_app', p.oid, 'execute') as ok
           from pg_proc p where p.proname = 'request_admin_recovery' and p.pronamespace = 'app'::regnamespace`,
      )
    ).rows;
    expect(f).toHaveLength(1);
    expect(f[0]!.ok).toBe(true);
    expect(f[0]!.acl ?? "").not.toMatch(/(^|[{,])=X/);
  });

  it("K305-API-018 関門：振る舞いは apps/api/src/features/F1/admin-recovery/ にあり、生の pg を使わない（関門 C2）。メールは送出の口（関門 C6）からだけ", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p);
      }
    };
    expect(() => walk(FEATURE_DIR)).not.toThrow();
    const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/from\s+["']pg["']/);
    expect(src).not.toMatch(/from\s+["']resend["']/);
    expect(src).toContain("app.request_admin_recovery");
  });

  it("K305-API-019 契約：requestAdminRecovery の関門に C6、401 に E-AUTH-013、422 の必須の欄に pending（08_api/endpoints.json）", () => {
    const eps = (
      JSON.parse(readFileSync(join(ROOT, "08_api", "endpoints.json"), "utf8")) as {
        endpoints: Record<string, unknown>[];
      }
    ).endpoints;
    const ep = eps.find((e) => e["operation_id"] === "requestAdminRecovery")!;
    expect(ep["choke_points"]).toEqual(expect.arrayContaining(["C2", "C6"]));
    const out = JSON.stringify(ep["outputs_4xx"]);
    expect(out).toContain(PENDING_EXPIRED);
    expect(out).toContain('"status":422');
  });
});
