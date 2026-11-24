// 運営の画面（段 13・/ops の下：K-965・K-971・K-972 ほか）の画面の試験の道具（K-965 が持ち込む）：
//   運営の口を網の手前で差し替え、運営のログイン（パスキー）を Chrome の仮の認証器で通して /ops の入れ物（K-946）に入る。
//   答えの形は 11_tickets/K-1006.md の「画面が使う答えの形」（違えばこの 1 枚だけを合わせる）。名前・字・数は下絵
//   （features/F12/ops/ops-sample.ts と views-list.tsx の見本）と同じにする（モックとの突き合わせのため）。
//   ログインの手順は K-946 の試験（k946-ops-shell.spec.ts）と同じ形（WebAuthn は IP の宛先で動かないので localhost で開く）。
//   本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { expect, type Page, type Request, type Route } from "@playwright/test";

export { uid, shellOf, WS_A, type ShellA, type WsRowA, type Attention } from "./ops-answers";
import { shellOf, WS_A } from "./ops-answers";
const CRED_ID = randomBytes(16);
const b64u = (b: Buffer) => b.toString("base64url");
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "set-auth-token",
};
export const MENU = 'nav[aria-label="運営のメニュー"]';

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
export interface OpsMock {
  calls: string[];
  /** 一覧の口に来た問い合わせの値（並びのまま） */
  listQueries: URLSearchParams[];
  on: { shell: () => Reply | "abort"; list: (q: URLSearchParams) => Reply | "abort" };
}

export async function mockOps(page: Page): Promise<OpsMock> {
  const m: OpsMock = {
    calls: [],
    listQueries: [],
    on: {
      shell: () => ({ status: 200, body: { data: shellOf() } }),
      list: () => ({ status: 200, body: { data: WS_A } }),
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    m.calls.push(`${req.method()} ${p}${u.search}`);
    let r: Reply | "abort" = { status: 501, body: { code: "NOT_IMPLEMENTED" } };
    if (/^\/api\/auth\/passkey\/.*authenticate-options/.test(p))
      r = {
        status: 200,
        body: {
          challenge: b64u(randomBytes(32)),
          challenge_token: "ch-k965",
          rpId: "localhost",
          timeout: 60_000,
          allowCredentials: [],
          userVerification: "preferred",
        },
      };
    else if (/^\/api\/auth\/passkey\/verify-authentication/.test(p))
      r = {
        status: 200,
        headers: { "set-auth-token": "tok-k965" },
        body: { session: { token: "tok-k965" }, user: { id: "u-k965", email: "ops@example.test", name: "高本 聖斗" } },
      };
    else if (p === "/api/auth/get-session")
      r = { status: 200, body: { session: { token: "tok-k965" }, user: { id: "u-k965", name: "高本 聖斗" } } };
    else if (p === "/api/v1/ops/shell") r = m.on.shell();
    else if (p === "/api/v1/ops/workspaces") {
      m.listQueries.push(u.searchParams);
      r = m.on.list(u.searchParams);
    }
    if (r === "abort") return route.abort("failed");
    await route.fulfill({
      status: r.status,
      headers: { ...CORS, ...(r.headers ?? {}) },
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}

export const local = (baseURL: string | undefined): string => String(baseURL).replace("127.0.0.1", "localhost");

async function authenticator(page: Page): Promise<void> {
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
      userHandle: Buffer.from("u-k965").toString("base64"),
      signCount: 0,
    },
  });
}

/** 運営のログインを通して next の道に入る（入れ物の外枠のメニューが出るまで待つ） */
export async function signInOps(page: Page, base: string, next = "/ops", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  await authenticator(page);
  expect((await page.goto(`${base}/ops/login?next=${encodeURIComponent(next)}`))?.status()).toBe(200);
  await page.getByRole("button", { name: "パスキーで入る", exact: true }).click();
  await page.waitForURL((u) => `${u.pathname}${u.search}` === next);
  await page.evaluate(() => document.fonts.ready);
}
