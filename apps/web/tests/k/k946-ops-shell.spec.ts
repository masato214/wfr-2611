// K-946「運営の画面の入れ物：/ops の道・運営の外枠・運営のログインの画面」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops/op-login（運営のログイン・この葉が持ち主）と、外枠の部品（features/F12/ops/ops-shell.tsx・下絵 op-list の左のバーと上の帯）。
//   呼ぶ口：パスキーは部品の口（/api/auth/passkey/*・K-304・K-944）、外枠の数と人は getOpsShell（GET /api/v1/ops/shell・K-963 が作る・形は K-1006）。
//   口は網の手前で差し替える（振る舞いは口の葉の試験が本物の DB で持つ）。本人の Bridge（127.0.0.1:38617）にも届かせない。
//   パスキーは Chrome の仮の認証器（CDP WebAuthn）で本物のブラウザの手順を通す。WebAuthn は IP の宛先で動かないので localhost で開く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-946.md の表と 1 対 1
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { AUTH_PAIRS, MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";

const BOX = '[data-part="auth-box"]';
const CRED_ID = randomBytes(16);
const b64u = (b: Buffer) => b.toString("base64url");
const MSG = {
  failed:
    "パスキーで入れませんでした。もう一度試してください。入れないときは運営の管理者に、パスキーの登録し直しを頼んでください",
  // 顧客の側の同意し直しの画面の文（K-53・terms.spec.ts の MSG.required と同じ字）。運営の画面には出ない
  termsRequired: "利用規約とプライバシーポリシーが新しくなりました。同意してから続けてください",
} as const;
const MENU = 'nav[aria-label="運営のメニュー"]';
const NAV = ["ワークスペース", "問い合わせ", "お知らせ", "請求", "配るもの"] as const;
const NAV_HREF: Record<string, string> = {
  ワークスペース: "/ops",
  問い合わせ: "/ops/support",
  お知らせ: "/ops/notices",
  請求: "/ops/billing",
  配るもの: "/ops/skills",
  運営の人: "/ops/team",
};
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "set-auth-token",
};

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
interface Mock {
  calls: string[];
  shellAuth: string[];
  on: { verify: () => Reply; shell: () => Reply | "abort" };
}
/** 外枠の答え（K-1006 の getOpsShell の形） */
const shellBody = (o: { support?: number; billing?: number; caps?: string[] } = {}) => ({
  data: {
    operator: { member_id: "0193c5a0-0000-7000-8000-0000000009a1", caps: o.caps ?? ["inquiry", "money"] },
    inbox: { unassigned: o.support ?? 3, mine: 1, waiting: 2, later: 0 },
    invoices: { overdue_count: o.billing ?? 2, overdue_amount: 49500 },
    workspaces: {
      total: 48,
      active: 46,
      stopped: 1,
      closing: 1,
      attention: 4,
      by_plan: { free: 21, team: 19, business: 8 },
    },
    runs_month: { count: 48210, prev_ratio: 1.12 },
    pwned: { unchecked: 0 },
  },
});

async function mockApi(page: Page): Promise<Mock> {
  const m: Mock = {
    calls: [],
    shellAuth: [],
    on: {
      verify: () => ({
        status: 200,
        headers: { "set-auth-token": "tok-k946" },
        body: { session: { token: "tok-k946" }, user: { id: "u-k946", email: "ops@example.test" } },
      }),
      shell: () => ({ status: 200, body: shellBody() }),
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    m.calls.push(`${req.method()} ${p}`);
    let r: Reply = { status: 501, body: { code: "NOT_IMPLEMENTED" } };
    if (/^\/api\/auth\/passkey\/.*authenticate-options/.test(p))
      r = {
        status: 200,
        body: {
          challenge: b64u(randomBytes(32)),
          challenge_token: "ch-k946",
          rpId: "localhost",
          timeout: 60_000,
          allowCredentials: [],
          userVerification: "preferred",
        },
      };
    else if (/^\/api\/auth\/passkey\/verify-authentication/.test(p)) r = m.on.verify();
    else if (p === "/api/v1/ops/shell") {
      m.shellAuth.push(req.headers()["authorization"] ?? "");
      const x = m.on.shell();
      if (x === "abort") return route.abort("failed");
      r = x;
    } else if (p === "/api/auth/get-session") r = { status: 200, body: { session: null, user: null } };
    await route.fulfill({
      status: r.status,
      headers: { ...CORS, ...(r.headers ?? {}) },
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}

const local = (baseURL: string | undefined) => String(baseURL).replace("127.0.0.1", "localhost");
async function authenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: {
      credentialId: CRED_ID.toString("base64"),
      isResidentCredential: true,
      rpId: "localhost",
      privateKey: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
      userHandle: Buffer.from("u-k946").toString("base64"),
      signCount: 0,
    },
  });
}
async function openLogin(page: Page, base: string, width = 1440, q = "") {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(`${base}/ops/login${q}`))?.status()).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toHaveText("運営のログイン");
  await page.evaluate(() => document.fonts.ready);
}
/** 入った後の状態：印を置いてから /ops を開く（印の置き場は lib/auth/client と同じ道で、ログインの画面を通して作る） */
async function signedIn(page: Page, base: string, width = 1440) {
  await authenticator(page);
  await openLogin(page, base, width);
  await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
  await page.waitForURL(/\/ops$/);
  await expect(page.locator(MENU).getByText("ワークスペース", { exact: true })).toBeVisible();
}

test.describe("K-946 運営のログイン", () => {
  for (const w of MATCH_WIDTHS)
    test(`K946-UI-001 運営のログインの画面がモック op-login と同じ（幅 ${w}・箱・見出し・注記・ボタン・下の行）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-login",
        w,
        async (page) => {
          await mockApi(page);
          await openLogin(page, local(baseURL), w);
        },
        { base: "/dev/mock/f12-ops", pairs: AUTH_PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });

  test("K946-UI-002 パスキーで入る：問い → 応答の口を 1 回ずつ呼び、/ops に移って運営の外枠が出る。外枠の口は Bearer の印で呼ぶ", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await signedIn(page, local(baseURL));
    expect(m.calls.filter((c) => /authenticate-options/.test(c)).length).toBe(1);
    expect(m.calls.filter((c) => /verify-authentication/.test(c)).length).toBe(1);
    expect(m.shellAuth.at(-1)).toBe("Bearer tok-k946");
  });

  test("K946-UI-003 ログインの画面に ?next=/ops/billing で来て入る：/ops/billing に移る。next が外の道（//evil.example）なら /ops", async ({
    page,
    baseURL,
  }) => {
    await mockApi(page);
    await authenticator(page);
    const base = local(baseURL);
    await openLogin(page, base, 1440, `?next=${encodeURIComponent("/ops/billing")}`);
    await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
    await page.waitForURL(/\/ops\/billing$/);
    await openLogin(page, base, 1440, `?next=${encodeURIComponent("//evil.example/x")}`);
    await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
    await page.waitForURL(/\/ops$/);
  });

  test("K946-UI-004 応答の口が断る（401）：下絵の失敗の文（role alert）が出て、ログインの画面に残る。もう一度押せる", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.verify = () => ({ status: 401, body: { code: "INVALID_PASSKEY", message: "x" } });
    await authenticator(page);
    await openLogin(page, local(baseURL));
    await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(MSG.failed);
    await expect(page).toHaveURL(/\/ops\/login/);
    await expect(page.getByRole("button", { name: "パスキーで入る", exact: true })).toBeEnabled();
  });

  test("K946-UI-005 本人がやめた（NotAllowedError）：同じ失敗の文。応答の口は呼ばない", async ({ page, baseURL }) => {
    const m = await mockApi(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator.credentials, "get", {
        configurable: true,
        value: () => Promise.reject(new DOMException("やめた", "NotAllowedError")),
      });
    });
    await openLogin(page, local(baseURL));
    await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(MSG.failed);
    expect(m.calls.filter((c) => /verify-authentication/.test(c)).length).toBe(0);
  });

  test("K946-UI-006 「顧客のログインへ」は /login に移る", async ({ page, baseURL }) => {
    await mockApi(page);
    await openLogin(page, local(baseURL));
    await page.getByRole("link", { name: "顧客のログインへ", exact: true }).click();
    await page.waitForURL(/\/login$/);
  });
});

test.describe("K-946 /ops の入れ物（入っていない・役が違う）", () => {
  test("K946-UI-007 印なしで /ops/notices を開く（外枠の口が 401）：/ops/login?next=%2Fops%2Fnotices に移る。外枠は描かない", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.shell = () => ({ status: 401, body: { code: "UNAUTHENTICATED" } });
    await page.goto(`${local(baseURL)}/ops/notices`);
    await page.waitForURL(/\/ops\/login\?next=%2Fops%2Fnotices$/);
    await expect(page.locator(MENU)).toHaveCount(0);
  });

  test("K946-UI-008 顧客の会社の人の印で /ops（外枠の口が 403 FORBIDDEN）：/ops/login に移る（顧客の画面へは送らない）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.shell = () => ({ status: 403, body: { code: "FORBIDDEN" } });
    await page.goto(`${local(baseURL)}/ops`);
    await page.waitForURL(/\/ops\/login/);
  });

  test("K946-UI-009 パスキーを付けるだけのセッション（外枠の口が 403 MFA_REQUIRED）：/ops/setup に移る", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.shell = () => ({ status: 403, body: { code: "MFA_REQUIRED" } });
    await page.goto(`${local(baseURL)}/ops`);
    await page.waitForURL(/\/ops\/setup$/);
  });

  // 前は apps/web/tests/features/F1/terms.spec.ts の K53-UI-023（メールとパスワードで入る）が見ていた。運営のログインはパスキーだけ（K-944）なので、画面の分をここで受ける。
  //   顧客の側は、口が 403・E-AUTH-010 を返すとどの画面からでも /login?step=terms へ移す（lib/terms-gate.ts）。運営の入れ物はその道に乗らない（D-128.172）。
  //   運営のセッションに規約の待ちの印が立たないこと（本物の DB）は口の側の行が持つ（K-946.md の「前からの試験を替えた所」）
  test("K946-UI-017 パスキーで入った運営の人は、規約の同意し直しの画面（/login?step=terms）へ移されない。外枠の口が 403・E-AUTH-010 を返しても /ops のままで、数の印だけ出さない。規約の口は呼ばない（D-128.172）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    const nav = page.locator(MENU);
    const stays = async () => {
      await expect(nav.locator(".k-nav-item .k-nav-label")).toHaveCount(6);
      expect(new URL(page.url()).pathname).toBe("/ops");
      expect(new URL(page.url()).searchParams.get("step")).toBeNull();
      await expect(page.getByRole("heading", { level: 1, name: /規約/ })).toHaveCount(0);
      await expect(page.getByText(MSG.termsRequired)).toHaveCount(0);
    };
    await signedIn(page, local(baseURL));
    await stays();
    m.on.shell = () => ({ status: 403, body: { code: "E-AUTH-010", message: MSG.termsRequired } });
    const before = m.shellAuth.length;
    await page.reload();
    await expect.poll(() => m.shellAuth.length, "読み直しで外枠の口を呼んだ").toBeGreaterThan(before);
    await page.waitForLoadState("networkidle");
    await stays();
    await expect(nav.locator(".k-nav-badge")).toHaveCount(0);
    expect(m.calls.filter((c) => /\/api\/v1\/auth\/terms\//.test(c))).toEqual([]);
  });
});

test.describe("K-946 運営の外枠", () => {
  test("K946-UI-010 左のメニュー：上から ワークスペース・問い合わせ・お知らせ・請求・配るもの、下に 運営の人。行き先は /ops の道。いまの画面に印", async ({
    page,
    baseURL,
  }) => {
    await mockApi(page);
    await signedIn(page, local(baseURL));
    const nav = page.locator(MENU);
    const labels = await nav.locator(".k-nav-item .k-nav-label").allInnerTexts();
    expect(labels).toEqual([...NAV, "運営の人"]);
    for (const [label, href] of Object.entries(NAV_HREF))
      expect(await nav.locator(".k-nav-item", { hasText: label }).first().getAttribute("href"), label).toBe(href);
    await expect(nav.locator('.k-nav-item[aria-current="page"]')).toHaveText(/ワークスペース/);
  });

  test("K946-UI-011 数の印は外枠の口から（問い合わせ＝未担当 3・請求＝期限を過ぎた 2）。右上の丸はログインの人の名前の頭（高）。0 なら印を出さない", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await signedIn(page, local(baseURL));
    const nav = page.locator(MENU);
    await expect(nav.locator(".k-nav-item", { hasText: "問い合わせ" }).locator(".k-nav-badge")).toHaveText("3");
    await expect(nav.locator(".k-nav-item", { hasText: "請求" }).locator(".k-nav-badge")).toHaveText("2");
    await expect(page.getByRole("button", { name: "高本 聖斗のメニュー", exact: true })).toHaveText("高");
    m.on.shell = () => ({ status: 200, body: shellBody({ support: 0, billing: 0 }) });
    await page.reload();
    await expect(nav.locator(".k-nav-badge")).toHaveCount(0);
  });

  test("K946-UI-012 できることが少ない人（問い合わせだけ）でも、左のメニューは全部出す（隠さない・押せない形は各画面）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.shell = () => ({ status: 200, body: shellBody({ caps: ["inquiry"] }) });
    await signedIn(page, local(baseURL));
    const labels = await page.locator(MENU).locator(".k-nav-item .k-nav-label").allInnerTexts();
    expect(labels).toEqual([...NAV, "運営の人"]);
  });

  test("K946-UI-013 外枠の口が落ちた（503・網が切れた）：左のメニューと右上の人（ログインの人）は出し、数の印だけ出さない。外枠は文を足さない（勧めで仮置き・聞くこと 追加 1）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await signedIn(page, local(baseURL));
    m.on.shell = () => ({ status: 503, body: { code: "E-PAGE-003" } });
    await page.reload();
    const nav = page.locator(MENU);
    await expect(nav.locator(".k-nav-item .k-nav-label")).toHaveCount(6);
    await expect(nav.locator(".k-nav-badge")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "高本 聖斗のメニュー", exact: true })).toHaveText("高");
    m.on.shell = () => "abort";
    await page.reload();
    await expect(nav.locator(".k-nav-item .k-nav-label")).toHaveCount(6);
  });

  test("K946-UI-014 狭い幅（375）：左のバーを出さず、帯の左のボタンで引き出しが開き、同じ 6 つが出る。押すと閉じて移る", async ({
    page,
    baseURL,
  }) => {
    await mockApi(page);
    await signedIn(page, local(baseURL), 375);
    await page.getByRole("button", { name: "メニューを開く", exact: true }).click();
    await expect(page.locator(MENU)).toBeHidden();
    const drawer = page.locator("#k-op-drawer");
    await expect(drawer.locator(".k-nav-item .k-nav-label")).toHaveCount(6);
    await drawer.locator(".k-nav-item", { hasText: "お知らせ" }).click();
    await page.waitForURL(/\/ops\/notices$/);
  });

  for (const w of [320, 375, 768, 1024, 1440])
    test(`K946-UI-015 横にはみ出さない（幅 ${w}・/ops と /ops/login）`, async ({ page, baseURL }) => {
      await mockApi(page);
      await signedIn(page, local(baseURL), w);
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
      await openLogin(page, local(baseURL), w);
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    });

  test("K946-UI-016 運営の画面に出してはいけない字（取引先・業務の型・書き出し・CSV）と内部の ID が無い", async ({
    page,
    baseURL,
  }) => {
    await mockApi(page);
    await signedIn(page, local(baseURL));
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/\bD-\d|\bA\d{2,3}\b|ops-home|R6/);
  });
});
