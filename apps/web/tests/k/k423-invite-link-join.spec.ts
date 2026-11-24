// K-423「招待のリンクで参加する画面と、確認のメールのリンクを開く画面（F2）」の画面の試験（実 Chrome・実装より先に積む）。
//   的：/invite/:token（リンクの招待＝下見の email が null）と /invite/confirm/:token（確認のメールのリンク）。
//   代表の答え D-148.51（answer=3d444fc8d59f）：リンクで新しく入る人は、確認のメールのリンクを押すまで参加が決まらない（口と DB は K-422）。
//   下見 getInvitation・参加 acceptInvitation・確認 confirmInvitationJoin だけを網の手前で差し替える（口の振る舞いと DB は K-421・K-422 の試験が本物の DB で持つ）。
//   口の形は K-421.md・K-422.md の申し送り。文は errors.json の正本と K-422 の文の案。本人の Bridge は 404。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { PW } from "../_lib/api";
import { ROOT, overflowX } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const WS_NAME = "株式会社ENGINE BASE";
interface Reply {
  status: number;
  body: unknown;
}

// ---------------------------------------------------------------- リンクの招待で参加する画面（F2 の /invite/:token・口は K-421・K-422）
//   下見 getInvitation と参加 acceptInvitation だけを網の手前で差し替える（口の振る舞いと DB は K-421 の試験が本物の DB で持つ）。
//   宛てのメールを持たない招待（下見の email が null）を開く形。ログインしていない形は印を置かず、ログイン中の形は下見の signed_in で作る
const LINK_TOKEN = "k423-link-token-0000000000000000";
const LINK_PATH = `/api/v1/auth/invitations/${LINK_TOKEN}`;
const linkPreview = {
  state: "ok",
  workspace_name: WS_NAME,
  inviter_name: "高本",
  group_name: "営業",
  role: "member",
  message: null,
  email: null, // 宛てのメールを持たない＝招待のリンク（K-421）
  expires_at: "2026-11-27T09:00:00Z",
  account_exists: false,
  signed_in: null,
};
const CATALOG = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msgOf = (id: string) => CATALOG.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
// メールの鍵が無い参加を口が断る文（K-422：409 E-INV-016・欄なし。空白だけ／形違いを送ったときの 422 E-INV-013 とは別の番号）
const E_INV_016 = msgOf("E-INV-016");
// 形違いのメールを送ったときの文（K-422：422 E-INV-013・欄 email。E-INV-016 と文が同じなので、体の email の鍵でどちらの答えかを分ける）
const E_INV_013 = msgOf("E-INV-013");
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function openLinkInvite(
  page: Page,
  accept: (body: Record<string, unknown>) => Reply,
  preview: Record<string, unknown> = linkPreview,
  state = "new",
  width = 1440,
): Promise<Record<string, unknown>[]> {
  const bodies: Record<string, unknown>[] = [];
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(
    (u) => u.pathname === LINK_PATH || u.pathname === `${LINK_PATH}/accept`,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (p !== LINK_PATH) bodies.push(body);
      const reply = p === LINK_PATH ? { status: 200, body: { data: preview } } : accept(body);
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
    },
  );
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  expect((await page.goto(`/invite/${LINK_TOKEN}`))?.status()).toBe(200);
  await expect(page.locator(`[data-auth="invite"][data-state="${state}"]`)).toBeVisible();
  return bodies;
}
const inviteForm = (page: Page) => page.locator('[data-auth="invite"]');
const JOINED: Reply = { status: 201, body: { data: { token: null, next: null } } }; // ログイン中の人の今のアカウントで参加（K-421・201）

// リンクで新しく入る人は確認のメールを押すまで参加が決まらない（D-148.51・answer=3d444fc8d59f・口は K-422）。参加の口は 202 で { state, email（伏せたメール） } を返す。
//   送りましたの文は 1 つの NoteBox の字（伏せたメールを太字などの別の要素に分けない）なので、getByText で文ごと当てる
const SENT: Reply = { status: 202, body: { data: { state: "sent", email: "ki****@engine-base.example" } } };
const SENT_TEXT =
  "確認のメールを送りました。メールのリンクを押すと参加が決まります（ki****@engine-base.example・24 時間で切れます）";
const fillNew = async (page: Page, mail: string | null) => {
  if (mail !== null) await inviteForm(page).getByLabel("メール").fill(mail);
  await inviteForm(page).getByLabel("名前").fill("木村 誠");
  await inviteForm(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await inviteForm(page).getByRole("button", { name: "参加する" }).click();
};

test("K423-UI-001 リンクの招待で参加する（ログインしていない・下見の email が null）：「メール」の欄が書け、メール・名前・パスワードで「参加する」→ 体に email（前後の空白を除く）を 1 回送り、口の 202（sent）で「確認のメールを送りました…」の形になる。ログインの印は置かず、画面も移らない（確認のメールを押すまで参加は決まらない・D-148.51）", async ({
  page,
}) => {
  const bodies = await openLinkInvite(page, () => SENT);
  await expect(inviteForm(page).getByLabel("メール")).not.toHaveAttribute("readonly", /.*/);
  await fillNew(page, " kimura@engine-base.example ");
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toEqual({ name: "木村 誠", password: PW, email: "kimura@engine-base.example" });
  await expect(page.getByText(SENT_TEXT)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/invite/${LINK_TOKEN}`);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeNull();
});

test("K423-UI-002 リンクの招待の参加を口が断る：メールが空なら体に email の鍵を入れずに送り、409 E-INV-016（欄なし）でメールの欄の下に正本の文（名前は残る）。続けてメールを入れて押すと 409 E-INV-006 で、文は入れたメールで「kimura@engine-base.example には、もう Kaname のアカウントがあります。ログインしてから参加してください」・「ログインして参加する」", async ({
  page,
}) => {
  const bodies = await openLinkInvite(page, (b) =>
    "email" in b
      ? { status: 409, body: { error: "conflict", code: "E-INV-006", message: msgOf("E-INV-006") } }
      : { status: 409, body: { error: "conflict", code: "E-INV-016", message: E_INV_016 } },
  );
  await fillNew(page, null);
  // 文はメールの欄の説明（aria-describedby）につながる。名前の欄にはつながらない（文に「メール」の字が入るので欄の字で絞らない）
  await expect(inviteForm(page).getByLabel("メール")).toHaveAccessibleDescription(new RegExp(esc(E_INV_016)));
  await expect(inviteForm(page).getByLabel("名前")).not.toHaveAccessibleDescription(new RegExp(esc(E_INV_016)));
  await expect(inviteForm(page).getByLabel("名前")).toHaveValue("木村 誠");
  expect(Object.keys(bodies[0]!).sort()).toEqual(["name", "password"]);
  await fillNew(page, "kimura@engine-base.example");
  const acc = page.locator('[data-auth="invite"][data-state="account"]');
  await expect(acc).toContainText(
    "kimura@engine-base.example には、もう Kaname のアカウントがあります。ログインしてから参加してください",
  );
  await expect(acc.getByText("ログインして参加する")).toBeVisible();
  expect(bodies).toHaveLength(2);
});

test("K423-UI-015 メールに形でない字（abc）を入れて参加する：体に email「abc」（鍵が在る）を 1 回送り、口の 422 E-INV-013（欄 email・detail.field）でメールの欄の下に正本の文（名前の欄にはつながらない）・名前とメールの字は残る", async ({
  page,
}) => {
  const bodies = await openLinkInvite(page, () => ({
    status: 422,
    body: { error: "validation", code: "E-INV-013", message: E_INV_013, detail: { field: "email" } },
  }));
  await fillNew(page, "abc");
  await expect(inviteForm(page).getByLabel("メール")).toHaveAccessibleDescription(new RegExp(esc(E_INV_013)));
  await expect(inviteForm(page).getByLabel("名前")).not.toHaveAccessibleDescription(new RegExp(esc(E_INV_013)));
  await expect(inviteForm(page).getByLabel("名前")).toHaveValue("木村 誠");
  await expect(inviteForm(page).getByLabel("メール")).toHaveValue("abc");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toEqual({ name: "木村 誠", password: PW, email: "abc" });
});

test("K423-UI-003 ログイン中の人がリンクの招待を開く（下見の email が null・signed_in の email_matches が true）：メールの欄はログイン中のメール（読むだけ・空にしない）で、「今のアカウントで参加する」で体なし（{}）を 1 回送る", async ({
  page,
}) => {
  const bodies = await openLinkInvite(
    page,
    () => JOINED,
    { ...linkPreview, signed_in: { email: "kimura@engine-base.example", email_matches: true, already_member: false } },
    "signed",
  );
  await expect(inviteForm(page).getByLabel("メール")).toHaveValue("kimura@engine-base.example");
  await inviteForm(page).getByRole("button", { name: "今のアカウントで参加する" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toEqual({});
});

test("K423-UI-004 確認のメールを送れなかった（口の 202 が state failed）：「確認のメールを送れませんでした。もう一度押してください」が出て、書いた中身は残る。押し直すと 2 回目を送り、sent で「確認のメールを送りました…」になる", async ({
  page,
}) => {
  let n = 0;
  const bodies = await openLinkInvite(page, () =>
    ++n === 1 ? { status: 202, body: { data: { state: "failed", email: "ki****@engine-base.example" } } } : SENT,
  );
  await fillNew(page, "kimura@engine-base.example");
  await expect(inviteForm(page).getByRole("alert")).toContainText(
    "確認のメールを送れませんでした。もう一度押してください",
  );
  await expect(inviteForm(page).getByLabel("メール")).toHaveValue("kimura@engine-base.example");
  await inviteForm(page).getByRole("button", { name: "参加する" }).click();
  await expect(page.getByText(SENT_TEXT)).toBeVisible();
  expect(bodies).toHaveLength(2);
});

// ---------------------------------------------------------------- 確認のメールのリンクを開く画面（/invite/confirm/:token・口は K-422 の confirmInvitationJoin）
//   開いただけでは口を呼ばない（メールの下見・自動で開く道具に押されない）。「参加を決める」を押すと POST /api/v1/auth/invitations/confirm に { token } を 1 回。
//   201 { data: { token, workspace_id, next: "/mfa-setup" } } → 口が返したログインの印を置き、付けるまで進めない /mfa-setup へ
const CONFIRM_TOKEN = "Abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE"; // 43 字（K-422 の確認のトークンの形）
const CONFIRM_PATH = "/api/v1/auth/invitations/confirm";
const SESSION = "k423-session-after-confirm";
const CONFIRMED: Reply = { status: 201, body: { data: { token: SESSION, workspace_id: "w1", next: "/mfa-setup" } } };
const errOf = (status: number, code: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, message: msgOf(code) },
});
const confirmBtn = (page: Page) => page.getByRole("button", { name: "参加を決める" });

interface CMock {
  bodies: Record<string, unknown>[];
  /** 確認の後に移った先（/mfa-setup）が呼んだ口と、そのときの Authorization（印は localStorage でなく届いた頭で見る） */
  auths: { path: string; auth: string | undefined }[];
  hold: () => () => void;
  gate: Promise<void>;
}
async function openConfirm(page: Page, reply: () => Reply, token = CONFIRM_TOKEN, width = 1440): Promise<CMock> {
  const m: CMock = {
    bodies: [],
    auths: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  // 移った先の /mfa-setup（security-screen.tsx）と外枠が呼ぶ口を差し替える（k318-security.spec.ts の形）。
  //   本物の口へ作り物の印で行くと 401 → 入り直し（/login）になり、台が混むと落ちる試験になるため
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (p === CONFIRM_PATH) return route.fallback();
    if (m.bodies.length > 0) m.auths.push({ path: p, auth: req.headers()["authorization"] });
    const ok = (data: unknown) => ({ status: 200, body: { data } });
    const r: Reply =
      p === "/api/v1/me/security"
        ? ok({ passkeys: [], has_password: true, two_factor: false, two_factor_required: true, mfa_pending: true })
        : p === "/api/v1/me" || p === "/api/auth-ext/me"
          ? ok({
              member_id: "m1",
              tenant_id: "w1",
              display_name: "木村",
              role_id: "member",
              scope_id: null,
              workspace_name: WS_NAME,
            })
          : p === "/api/v1/scopes"
            ? { status: 200, body: { data: [], meta: { limit: 200, writable: [] } } }
            : ok([]);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  await page.route(
    (u) => u.pathname === CONFIRM_PATH,
    async (route: Route, req: Request) => {
      m.bodies.push((req.postDataJSON() ?? {}) as Record<string, unknown>);
      await m.gate;
      const r = reply();
      await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    },
  );
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  expect((await page.goto(`/invite/confirm/${token}`))?.status()).toBe(200);
  await expect(page.locator('[data-auth="invite-confirm"]')).toBeVisible();
  return m;
}
/** 移った先で最初に呼んだ口（getMySecurity）に、確認の口が返した印が付いているか */
const authOnSecurity = (m: CMock) => () => m.auths.find((a) => a.path === "/api/v1/me/security")?.auth;

test("K423-UI-005 確認のリンクを開く：開いただけでは口を呼ばず、題「参加を確かめる」とボタン「参加を決める」が出る", async ({
  page,
}) => {
  const m = await openConfirm(page, () => CONFIRMED);
  await expect(page.getByRole("heading", { name: "参加を確かめる" })).toBeVisible();
  await expect(confirmBtn(page)).toBeEnabled();
  expect(m.bodies).toHaveLength(0);
});

test("K423-UI-006 「参加を決める」→ 口に { token } を 1 回 → 201 で口が返したログインの印を置き、付けるまで進めない /mfa-setup へ移る", async ({
  page,
}) => {
  const m = await openConfirm(page, () => CONFIRMED);
  await confirmBtn(page).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/mfa-setup");
  expect(m.bodies).toEqual([{ token: CONFIRM_TOKEN }]);
  await expect.poll(authOnSecurity(m)).toBe(`Bearer ${SESSION}`);
});

test("K423-UI-007 確認の期限（24 時間）が過ぎた（410 E-INV-014）：正本の文が出て、「参加を決める」は消え、招待のリンクからやり直す案内だけ（画面は移らない）", async ({
  page,
}) => {
  await openConfirm(page, () => errOf(410, "E-INV-014"));
  await confirmBtn(page).click();
  await expect(page.locator('[data-auth="invite-confirm"]')).toContainText(msgOf("E-INV-014"));
  await expect(confirmBtn(page)).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(`/invite/confirm/${CONFIRM_TOKEN}`);
});

test("K423-UI-008 もう使った確認のリンク（410 E-INV-015）：正本の文と「ログインして入る」（/login）が出て、「参加を決める」は消える", async ({
  page,
}) => {
  await openConfirm(page, () => errOf(410, "E-INV-015"));
  await confirmBtn(page).click();
  const box = page.locator('[data-auth="invite-confirm"]');
  await expect(box).toContainText(msgOf("E-INV-015"));
  await expect(box.getByRole("link", { name: "ログインして入る" })).toHaveAttribute("href", /^\/login/);
  await expect(confirmBtn(page)).toHaveCount(0);
});

test("K423-UI-009 二度押し：答えを待つ間「参加を決める」は押せず、口は 1 回だけ", async ({ page }) => {
  const m = await openConfirm(page, () => CONFIRMED);
  const release = m.hold();
  await confirmBtn(page).click();
  await expect.poll(() => m.bodies.length).toBe(1);
  await expect(confirmBtn(page)).toBeDisabled();
  await confirmBtn(page).click({ force: true });
  release();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/mfa-setup");
  expect(m.bodies).toHaveLength(1);
});

test("K423-UI-010 ログイン中の人が確認のリンクを開いて押す：前のログインの印は、確認したアカウントの印に替わり /mfa-setup へ（口は今のログインを見ない・K-422）", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "k423-old-session"));
  const m = await openConfirm(page, () => CONFIRMED);
  await confirmBtn(page).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/mfa-setup");
  await expect.poll(authOnSecurity(m)).toBe(`Bearer ${SESSION}`);
});

test("K423-UI-011 壊れた確認のリンク（印の形が違う）：口を呼ばず、正本 E-INV-001 の文が出て、「参加を決める」は出ない", async ({
  page,
}) => {
  const m = await openConfirm(page, () => CONFIRMED, "short-token");
  await expect(page.locator('[data-auth="invite-confirm"]')).toContainText(msgOf("E-INV-001"));
  await expect(confirmBtn(page)).toHaveCount(0);
  expect(m.bodies).toHaveLength(0);
});

test("K423-UI-012 ほかの断り：404 E-INV-001・410 E-INV-002／003／004・409 E-INV-006・403 E-AUTH-012 はどれも正本の文を出し「参加を決める」は消える。503 は正本 E-PAGE-003 の文で、押し直すと 2 回目を送り 201 で /mfa-setup へ", async ({
  browser,
}) => {
  for (const [status, code] of [
    [404, "E-INV-001"],
    [410, "E-INV-002"],
    [410, "E-INV-003"],
    [410, "E-INV-004"],
    [409, "E-INV-006"],
    [403, "E-AUTH-012"],
  ] as const) {
    const page = await browser.newPage();
    await openConfirm(page, () => errOf(status, code));
    await confirmBtn(page).click();
    await expect(page.locator('[data-auth="invite-confirm"]'), code).toContainText(msgOf(code));
    await expect(confirmBtn(page), code).toHaveCount(0);
    await page.close();
  }
  const page = await browser.newPage();
  let n = 0;
  const m = await openConfirm(page, () => (++n === 1 ? errOf(503, "E-PAGE-003") : CONFIRMED));
  await confirmBtn(page).click();
  await expect(page.locator('[data-auth="invite-confirm"]').getByRole("alert")).toContainText(msgOf("E-PAGE-003"));
  await confirmBtn(page).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/mfa-setup");
  expect(m.bodies).toHaveLength(2);
  await page.close();
});

test("K423-UI-013 幅 375・768・1440：確認のメールを送りましたの形と確認の画面で、横のはみ出し 0", async ({
  browser,
}) => {
  const bad: string[] = [];
  for (const w of [375, 768, 1440]) {
    const a = await browser.newPage();
    await openLinkInvite(a, () => SENT);
    await a.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await fillNew(a, "kimura@engine-base.example");
    await expect(a.getByText(SENT_TEXT)).toBeVisible();
    if ((await overflowX(a)) !== 0) bad.push(`幅 ${w}・送りました`);
    await a.close();
    const b = await browser.newPage();
    await openConfirm(b, () => CONFIRMED, CONFIRM_TOKEN, w);
    if ((await overflowX(b)) !== 0) bad.push(`幅 ${w}・確認の画面`);
    await b.close();
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

// ---------------------------------------------------------------- 見た目の突き合わせ（正の絵は /dev/mock/f2/<id>・PM の決め 2026-11-20）
//   本番の値をモックの値（mocks.tsx の PV：株式会社ENGINE BASE・高本 聖斗・経理グループ・ひとこと・期限 11/25）にそろえて、同じ幅で比べる（共通の道具 matchMock・役は AUTH_PAIRS）
const MOCK_PV = {
  ...linkPreview,
  workspace_name: "株式会社ENGINE BASE",
  inviter_name: "高本 聖斗",
  group_name: "経理グループ",
  message: "経理の月次をいっしょに回してもらいます。よろしくお願いします",
  expires_at: "2026-11-25T03:00:00Z",
};
const NO_EMAIL: Reply = { status: 409, body: { error: "conflict", code: "E-INV-016", message: E_INV_016 } };
const FAILED: Reply = { status: 202, body: { data: { state: "failed", email: "ki****@engine-base.example" } } };
const DRIVE: Record<string, (p: Page, w: number) => Promise<void>> = {
  "inv-link-new": async (p, w) => {
    await openLinkInvite(p, () => SENT, MOCK_PV, "new", w);
  },
  "inv-link-error": async (p, w) => {
    await openLinkInvite(p, () => NO_EMAIL, MOCK_PV, "new", w);
    await inviteForm(p).getByRole("button", { name: "参加する" }).click();
    await expect(inviteForm(p).getByLabel("メール")).toHaveAccessibleDescription(new RegExp(esc(E_INV_016)));
  },
  "inv-link-sent": async (p, w) => {
    await openLinkInvite(p, () => SENT, MOCK_PV, "new", w);
    await fillNew(p, "kimura@engine-base.example");
    await expect(p.locator('[data-auth="invite"][data-state="sent"]')).toBeVisible();
  },
  "inv-link-failed": async (p, w) => {
    await openLinkInvite(p, () => FAILED, MOCK_PV, "new", w);
    await fillNew(p, "kimura@engine-base.example");
    await expect(inviteForm(p).getByRole("alert")).toBeVisible();
  },
  "inv-confirm": async (p, w) => {
    await openConfirm(p, () => CONFIRMED, CONFIRM_TOKEN, w);
  },
  "inv-confirm-expired": async (p, w) => {
    await openConfirm(p, () => errOf(410, "E-INV-014"), CONFIRM_TOKEN, w);
    await confirmBtn(p).click();
    await expect(confirmBtn(p)).toHaveCount(0);
  },
  "inv-confirm-used": async (p, w) => {
    await openConfirm(p, () => errOf(410, "E-INV-015"), CONFIRM_TOKEN, w);
    await confirmBtn(p).click();
    await expect(confirmBtn(p)).toHaveCount(0);
  },
  "inv-confirm-down": async (p, w) => {
    await openConfirm(p, () => errOf(503, "E-PAGE-003"), CONFIRM_TOKEN, w);
    await confirmBtn(p).click();
    await expect(p.locator('[data-auth="invite-confirm"]').getByRole("alert")).toBeVisible();
  },
};

for (const [id, go] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K423-UI-014 ${id} 幅 ${w}：本番がモック /dev/mock/f2/${id} と同じ役の値（箱・見出し・文・入力・主ボタン・px は ±2・共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(browser, id, w, (p) => go(p, w), { base: "/dev/mock/f2" });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
