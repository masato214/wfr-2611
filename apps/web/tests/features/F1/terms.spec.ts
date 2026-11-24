// K-53「規約に同意する」の画面の試験（実 Chrome）：同意し直しの画面（/login?step=terms&next=…）と、登録の画面の規約のリンク。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/terms.md）＝試験 1 本。名前の頭の行 ID で op_gate.py が証拠を引く。
//   口（API）は網の手前（page.route）で差し替える。口の振る舞いそのものは apps/api/test/features/F1/terms.test.ts が本物の DB で持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   今の版：GET /api/v1/auth/terms/current → { data: [{ id, kind, version, url, published_at }] }
//   同意：POST /api/v1/auth/terms/consent ← { agree: true, terms_version_id, privacy_version_id }
//   同意し直しが要る間、ふつうの口は 403・E-AUTH-010（K-53 が errors.json に足す・D-128.146）。画面はそれを受けたら同意し直しの画面へ移し、その文を出す
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import type { Page, Request, Route } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../../_lib/row";
import { PW, WIDTHS, admin, setupDone, signupViaApi, uniq } from "../../_lib/api";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/terms.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));

const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const CURRENT_PATH = "/api/v1/auth/terms/current";
const CONSENT_PATH = "/api/v1/auth/terms/consent";
const SIGN_OUT_PATH = "/api/v1/auth/sign-out";
const NEW_TERMS_REQUIRED = "E-AUTH-010"; // 足すエラー（同意し直しが要る・D-128.146）
const NEW_TERMS_STALE = "E-CONF-012"; // 足すエラー（版が古い・D-128.146）
const MSG = {
  required: "利用規約とプライバシーポリシーが新しくなりました。同意してから続けてください",
  stale: "規約の版が新しくなりました。新しい版を読んで同意してください",
  noAgree: "同意する場合は、チェックを入れてください",
  expired: "ログインが切れました",
  down: "Kaname の調子が悪くなっています。運営が直しています。あなたの操作や PC の問題ではありません",
};
const SESSION = "session-k53";
const at = new Date(Date.now() - 60_000).toISOString();
let seq = 0;
/** 版 1 つ（id は版ごとに違う uuid） */
const item = (
  kind: string,
  version: string,
  url = `https://kaname.example/${kind}/${encodeURIComponent(version)}`,
) => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  kind,
  version,
  url,
  published_at: at,
});
const V2 = [item("terms", "第2版"), item("privacy", "第2版"), item("tokushoho", "第1版")];
const V3 = [item("terms", "第3版"), item("privacy", "第3版"), item("tokushoho", "第1版")];
const idOf = (items: typeof V2, kind: string) => items.find((x) => x.kind === kind)!.id;

type Reply = { status: number; body: unknown };
type Handler = (req: Request) => Reply | Promise<Reply>;
interface Mock {
  consents: Record<string, unknown>[];
  signOuts: number;
  currents: number;
  on: { current: Handler; consent: Handler; me: Handler; other: Handler };
}
const blocked: Reply = { status: 403, body: { error: "forbidden", code: NEW_TERMS_REQUIRED, message: MSG.required } };

/** 口を網の手前で差し替える。既定はログイン中・同意し直しが要る（ふつうの口は 403）・今の版は V2 */
async function mockApi(page: Page): Promise<Mock> {
  const m: Mock = {
    consents: [],
    signOuts: 0,
    currents: 0,
    on: {
      current: () => ({ status: 200, body: { data: V2 } }),
      consent: () => ({ status: 201, body: { data: { consented: true } } }),
      me: () => ({ status: 200, body: { data: { id: "u1", email: "takamoto@example.com", name: "高本" } } }),
      other: () => blocked,
    },
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    let reply: Reply;
    if (req.method() === "GET" && u.pathname === CURRENT_PATH) {
      m.currents++;
      reply = await m.on.current(req);
    } else if (req.method() === "POST" && u.pathname === CONSENT_PATH) {
      m.consents.push((req.postDataJSON() as Record<string, unknown> | null) ?? {});
      reply = await m.on.consent(req);
    } else if (req.method() === "POST" && u.pathname === SIGN_OUT_PATH) {
      m.signOuts++;
      reply = { status: 201, body: { data: { ok: true } } };
    } else if (req.method() === "GET" && u.pathname === "/api/v1/auth/service-status")
      // 誰でも読める口（K-307・auth public）は同意し直しの 403 を返さない。ログインの画面が開いたときに 1 回読む（K-317）
      reply = { status: 200, body: { data: { incidents: [], maintenance: null } } };
    else if (req.method() === "GET" && /\/me$/.test(u.pathname)) reply = await m.on.me(req);
    else reply = await m.on.other(req);
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}
const signedIn = (page: Page) =>
  page.addInitScript((t) => {
    if (!window.sessionStorage.getItem("k53.loggedOut")) window.localStorage.setItem("kaname.token", t);
  }, SESSION);
const openTerms = async (page: Page, next = "/tickets/abc", width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/login?step=terms&next=${encodeURIComponent(next)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /規約/ })).toBeVisible();
};
const box = (page: Page) => page.getByRole("checkbox", { name: "利用規約とプライバシーポリシーに同意します" });
const agreeBtn = (page: Page) => page.getByRole("button", { name: "同意して続ける", exact: true });
const link = (page: Page, name: string) => page.getByRole("link", { name, exact: true });
/** 版の一覧の中のリンク。足元にも同じ名前の「利用規約」がある（キャンバス AuthConsent・K-256）ので、版の一覧の中だけで探す */
const listLink = (page: Page, name: string) =>
  page.locator('[data-part="auth-box"]').getByRole("list").getByRole("link", { name, exact: true });
const agree = async (page: Page) => {
  await box(page).check();
  await agreeBtn(page).click();
};
/** 欄の下の理由（欄の aria-describedby が指す文に出る） */
const reasonOfBox = async (page: Page) => {
  const ids = (await box(page).getAttribute("aria-describedby")) ?? "";
  const texts = await Promise.all(
    ids
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => page.locator(`[id="${id}"]`).innerText()),
  );
  return texts.join(" ");
};

// ---- 形 ----
row(R["K53-UI-000"], async (page) => {
  await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  expect(await missingRows(page, ROWS)).toEqual([]);
});
row(R["K53-UI-001"], async (page) => {
  await mockApi(page);
  await signedIn(page);
  for (const w of WIDTHS) {
    await openTerms(page, "/tickets/abc", w);
    await expect(page.getByText(/第2版/).first()).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w} の横溢れ`).toBe(0);
  }
});

// ---- 同意する ----
row(R["K53-UI-002"], async (page) => {
  await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await expect(box(page)).not.toBeChecked();
  await box(page).click();
  await expect(box(page)).toBeChecked();
  await box(page).click();
  await expect(box(page)).not.toBeChecked();
});
row(R["K53-UI-003"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page, "/tickets/abc");
  m.on.other = () => ({ status: 200, body: { data: [] } }); // 同意の後はふつうの口が通る
  await agree(page);
  await expect(page).toHaveURL(/\/tickets\/abc$/);
  expect(m.consents).toEqual([
    { agree: true, terms_version_id: idOf(V2, "terms"), privacy_version_id: idOf(V2, "privacy") },
  ]);
  expect(JSON.stringify(m.consents), "特商法の版は送らない").not.toContain(idOf(V2, "tokushoho"));
});
row(R["K53-UI-004"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await agreeBtn(page).click();
  await expect.poll(() => reasonOfBox(page)).toContain(MSG.noAgree);
  expect(m.consents).toHaveLength(0);
  await expect(page).toHaveURL(/step=terms/);
});
const termsLink = async (page: Page, name: string, kind: string) => {
  await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  const l = listLink(page, name);
  await expect(l).toHaveAttribute("href", V2.find((x) => x.kind === kind)!.url);
  await expect(l).toHaveAttribute("target", "_blank");
};
row(R["K53-UI-005"], (page) => termsLink(page, "利用規約", "terms"));
row(R["K53-UI-006"], (page) => termsLink(page, "プライバシーポリシー", "privacy"));
row(R["K53-UI-007"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await page.evaluate(() => window.sessionStorage.setItem("k53.loggedOut", "1"));
  m.on.me = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect.poll(() => m.signOuts).toBe(1);
  await expect(page).toHaveURL(/\/login(?![^#]*step=terms)/);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeNull();
  expect(m.consents).toHaveLength(0);
});

// ---- 利用者の状態・入口 ----
row(R["K53-UI-008"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await page.reload();
  await expect(box(page)).toBeVisible();
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login\?step=terms/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login\?step=terms/);
  await expect(box(page)).toBeVisible();
  expect(m.consents).toHaveLength(0);
});
row(R["K53-UI-009"], async (page) => {
  await mockApi(page);
  await signedIn(page);
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login\?step=terms&next=%2Ftickets$/);
  await expect(box(page)).toBeVisible();
  // 口が返した E-AUTH-010 の文を、同意し直しの画面に出す（なぜこの画面に来たかが分かる）
  await expect(page.getByText(MSG.required)).toBeVisible();
});
row(R["K53-UI-010"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  m.on.consent = () => ({
    status: 401,
    body: {
      error: "unauthenticated",
      code: "E-PAGE-005",
      message: "ログインが切れました。書きかけのものはこの PC に残っています。入り直すと続きから書けます",
    },
  });
  await agree(page);
  await expect(page.getByText(new RegExp(MSG.expired)).first()).toBeVisible();
  await expect(page).not.toHaveURL(/\/tickets\/abc/);
  await expect(page).toHaveURL(/\/login/);
  // 入り直す（新しいログインの印）と、まだ同意していないので同意し直しの画面に戻る（元の道を next に持ったまま）
  m.on.consent = () => ({ status: 201, body: { data: { consented: true } } });
  await page.evaluate(() => window.localStorage.setItem("kaname.token", "session-k53-again"));
  await page.goto("/tickets/abc");
  await expect(page).toHaveURL(/\/login\?step=terms&next=%2Ftickets%2Fabc$/);
  await expect(box(page)).toBeVisible();
  expect(m.consents, "1 回目は 401 で、何も残っていない").toHaveLength(1);
});
row(R["K53-UI-011"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await page.evaluate(() => window.sessionStorage.setItem("k53.loggedOut", "1"));
  m.on.me = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  m.on.other = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(page).toHaveURL(/\/login(?![^#]*step=terms)/);
  await page.goBack();
  await expect(box(page)).toHaveCount(0);
  await expect(agreeBtn(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/login/);
});
row(R["K53-UI-012"], async (page, info) => {
  // 周ごとに新しいタブ（page）で開く：前の周の /tickets を開いたまま口の差し替えを変えると、前の周の画面の要求に効いてしまうため。
  //   ふつうの口ははじめから通す（同意の後の猶予に頼らない：同意し直しの画面は口の答えではなく道で開く）
  const origin = new URL(String(info.project.use.baseURL)).origin; // 画面の origin（BASE_URL か手元の next dev）
  const bad = [
    "https://evil.example/x",
    "//evil.example/x",
    "javascript:alert(1)",
    "/\\evil.example/x", // /\ で始まる（ブラウザは \ を / と読む）
    "/\t/evil.example/x", // タブ（%09）：ブラウザは道からタブを消すので //evil.example/x になる
    "/\n/evil.example/x", // 改行（%0A）：同じく消えて //evil.example/x になる
    "\t//evil.example/x",
    "/%09/evil.example/x", // 一度 符号にしたタブ・改行
    "/%0A/evil.example/x",
  ];
  const cases: [string, RegExp][] = [
    ...bad.map((n): [string, RegExp] => [n, /^https?:\/\/[^/]+\/tickets$/]),
    ["/tickets/abc?tab=1", /^https?:\/\/[^/]+\/tickets\/abc\?tab=1$/], // 同じ origin の道は通る
  ];
  for (const [next, want] of cases) {
    const p = await page.context().newPage();
    try {
      const m = await mockApi(p);
      m.on.other = () => ({ status: 200, body: { data: [] } });
      const hosts: string[] = [];
      p.on("request", (r) => hosts.push(new URL(r.url()).host));
      await signedIn(p);
      await openTerms(p, next);
      await agree(p);
      await expect(p, JSON.stringify(next)).toHaveURL(want);
      await p.waitForLoadState("load");
      expect(new URL(p.url()).origin, `${JSON.stringify(next)} は同じ origin に留まる`).toBe(origin);
      expect(new URL(p.url()).host, JSON.stringify(next)).not.toContain("evil.example");
      expect(
        hosts.filter((h) => h.includes("evil.example")),
        `${JSON.stringify(next)} で外へ要求しない`,
      ).toEqual([]);
      expect(m.consents, JSON.stringify(next)).toHaveLength(1);
    } finally {
      await p.close();
    }
  }
});

// ---- 失敗 ----
row(R["K53-UI-013"], async (page) => {
  const m = await mockApi(page);
  m.on.current = () => ({ status: 500, body: { error: "internal", code: "E-PAGE-003", message: MSG.down } });
  await signedIn(page);
  await page.goto(`/login?step=terms&next=${encodeURIComponent("/tickets")}`);
  await expect(page.getByRole("alert").filter({ hasText: MSG.down })).toBeVisible();
  expect(m.consents).toHaveLength(0);
});
row(R["K53-UI-014"], async (page) => {
  const m = await mockApi(page);
  const unreachable = [
    item("terms", "第2版", "https://unreachable.invalid/terms"),
    item("privacy", "第2版", "https://unreachable.invalid/privacy"),
  ];
  m.on.current = () => ({ status: 200, body: { data: unreachable } });
  await signedIn(page);
  await openTerms(page);
  await expect(page.getByText(/第2版/).first()).toBeVisible();
  await expect(listLink(page, "利用規約")).toHaveAttribute("href", "https://unreachable.invalid/terms");
  m.on.other = () => ({ status: 200, body: { data: [] } });
  await agree(page);
  await expect(page).toHaveURL(/\/tickets\/abc$/);
});

// ---- 操作の揺れ ----
row(R["K53-UI-015"], async (page) => {
  const m = await mockApi(page);
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  m.on.consent = async () => {
    await held;
    return { status: 201, body: { data: { consented: true } } };
  };
  await signedIn(page);
  await openTerms(page);
  await box(page).check();
  await agreeBtn(page).click();
  await agreeBtn(page)
    .click({ force: true, timeout: 2_000 })
    .catch(() => undefined); // 押せない形になっていてもよい
  m.on.other = () => ({ status: 200, body: { data: [] } });
  release();
  await expect(page).toHaveURL(/\/tickets\/abc$/);
  expect(m.consents).toHaveLength(1);
});
row(R["K53-UI-016"], async (page) => {
  // 閉じるのは別に開いたタブ（first）。row() が最後に証拠を撮る page は閉じずに残し、開き直した側として使う
  const first = await page.context().newPage();
  const m = await mockApi(first);
  m.on.consent = () => new Promise<Reply>(() => undefined); // 答えが返る前に閉じる
  await signedIn(first);
  await openTerms(first);
  await agree(first);
  await expect.poll(() => m.consents.length).toBe(1);
  await first.close();
  const m2 = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await expect(box(page)).toBeVisible();
  m2.on.other = () => ({ status: 200, body: { data: [] } });
  await agree(page);
  await expect(page).toHaveURL(/\/tickets\/abc$/);
});
row(R["K53-UI-017"], async (page) => {
  const m = await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  m.on.consent = () => ({
    status: 409,
    body: { error: "conflict", code: NEW_TERMS_STALE, message: MSG.stale, current: V3 },
  });
  m.on.current = () => ({ status: 200, body: { data: V3 } });
  await agree(page);
  await expect(page.getByText(MSG.stale)).toBeVisible();
  await expect(page.getByText(/第3版/).first()).toBeVisible();
  await expect(page).toHaveURL(/step=terms/);
  await expect(listLink(page, "利用規約")).toHaveAttribute("href", V3[0]!.url);
});
row(R["K53-UI-018"], async (page) => {
  const m = await mockApi(page);
  m.on.consent = () => ({ status: 429, body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 42 } });
  await signedIn(page);
  await openTerms(page);
  await agree(page);
  await expect(page.getByText(/42\s*秒/)).toBeVisible();
  await expect(page).toHaveURL(/step=terms/);
});

// ---- 登録の画面（K-51）の規約のリンク ----
row(R["K53-UI-019"], async (page) => {
  const m = await mockApi(page);
  m.on.me = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  m.on.other = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await page.goto("/signup");
  const consentText = page.getByText(/続けると/);
  await expect(consentText.getByRole("link", { name: "利用規約", exact: true })).toHaveAttribute("href", V2[0]!.url);
  await expect(consentText.getByRole("link", { name: "プライバシー", exact: true })).toHaveAttribute(
    "href",
    V2[1]!.url,
  );
  expect(m.currents, "登録の画面は今の版の口で版を取る").toBeGreaterThan(0);
});
row(R["K53-UI-020"], async (page) => {
  await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  await expect(link(page, "困ったとき").first()).toHaveAttribute("href", /help/);
});
row(R["K53-UI-027"], async (page) => {
  await mockApi(page);
  await signedIn(page);
  await openTerms(page);
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual([
    "利用規約",
    "プライバシー",
    "困ったとき",
  ]);
  await expect(foot.getByRole("link", { name: "プライバシー", exact: true })).toHaveAttribute("href", /privacy/);
});

// ---- 文面のページ（/legal/terms・/legal/privacy・K-53 で作る・G-04 の届くこと） ----
/** 種の第 1 版の url は Kaname の中の道（/legal/<kind>?v=1）。文面は apps/web/content/legal/<kind>-v1.md のひな形を設定で埋めて出す */
/** ひな形の施行日の行（決まった書き方：`<!-- 施行日：YYYY-MM-DD -->`）。文面のページは DB も API も読まず、ひな形と legalValues() だけで埋める */
const effectiveOn = (kind: "terms" | "privacy") => {
  const md = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), `../../../content/legal/${kind}-v1.md`),
    "utf8",
  );
  const m = /^<!-- 施行日：(\d{4})-(\d{2})-(\d{2}) -->$/m.exec(md);
  if (!m) throw new Error(`${kind}-v1.md に施行日の行が無い`);
  return `${Number(m[1])} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
};
const legal = async (page: Page, kind: "terms" | "privacy", title: string, from: "consent" | "signup") => {
  const m = await mockApi(page);
  const seedNow = [item("terms", "1", "/legal/terms?v=1"), item("privacy", "1", "/legal/privacy?v=1")];
  m.on.current = () => ({ status: 200, body: { data: seedNow } });
  const name = kind === "terms" ? "利用規約" : "プライバシーポリシー";
  if (from === "consent") {
    await signedIn(page);
    await openTerms(page);
  } else {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/signup");
  }
  // 足元にも同じ名前のリンクがある（K-256）ので、同意の画面は版の一覧の中、登録の画面は「続けると」の文の中だけで探す（.first() で足元に落ちない）
  const a =
    from === "consent"
      ? listLink(page, name)
      : page.getByText(/続けると/).getByRole("link", { name: new RegExp(`^${name.slice(0, 5)}`) });
  await expect(a).toHaveAttribute("href", new RegExp(`/legal/${kind}`));
  const href = (await a.getAttribute("href"))!;
  for (const path of [href, `/legal/${kind}`]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} は実在の画面（200）`).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByText(/第 1 版/).first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body, "ひな形の {{ }} が残っていない").not.toMatch(/\{\{[^}]*\}\}/);
    expect(body, "施行日はひな形の施行日の行から入る").toContain(effectiveOn(kind));
    await expect(page, "ログインを求めない").toHaveURL(new RegExp(`/legal/${kind}`));
  }
};
row(R["K53-UI-021"], (page) => legal(page, "terms", "Kaname 利用規約", "consent"));
row(R["K53-UI-022"], (page) => legal(page, "privacy", "Kaname プライバシーポリシー", "signup"));

// ---- 運営の人は同意し直しで止めない（D-128.172）の対照：本物の口と DB（網の手前で差し替えない） ----
//   運営の人の行（K53-UI-023）は外した：運営の人はパスキーだけで入り、顧客のログインの画面からは入れない（K-944・E-AUTH-022）。
//   運営の人が同意し直しの画面へ移されないことは、運営のログインの画面の葉（K-946）と口の試験（terms.test.ts の K53-API-036〜038）が受ける。
//   同意を外すのは試験が作った人の行だけ（G-10）。版は出さない（ほかの試験の人を止めないため）
const loginByForm = async (page: Page, email: string) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  // 送るボタンの字はログインの画面のチケット（K-221）が替える。名前に依らず欄から送る（同じ試験のファイルを 2 本で分け持たない）
  await page.getByLabel("パスワード", { exact: true }).press("Enter");
  await page.waitForURL((u) => u.pathname !== "/login" || u.searchParams.get("step") === "terms", { timeout: 30_000 });
};
/** 会社の利用者を作り、今の版への同意を外す（同意し直しが要る人にする） */
const staleCompanyUser = async () => {
  const u = await signupViaApi("同意し直しの対照の会社");
  await setupDone(u);
  await admin("delete from terms_consents where auth_user_id = $1", [u.userId]);
  return u;
};
row(R["K53-UI-024"], async (page) => {
  const u = await staleCompanyUser();
  await loginByForm(page, u.email);
  await expect(page).toHaveURL(/\/login\?step=terms/);
  await expect(page.getByRole("heading", { level: 1, name: /規約/ })).toBeVisible();
});

// ---- 確定の直後（K-52 との継ぎ目・K-54 の中間テストで見つけた：K54-M1-07 途中でやめる）----
//   確定の口 verifySignup の答えの terms_pending（確定の最後に決めたこのセッションの印）が true なら、「続ける」で同意し直しの画面へ移す。
//   false なら今の行き先（チケットの画面）へ。口は網の手前で差し替える（口の振る舞いは K53-API-041）
const VERIFY_PATH = "/api/v1/auth/sign-up/verify";
const afterVerify = async (page: Page, termsPending: boolean) => {
  const visited: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname + new URL(f.url()).search);
  });
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    let reply: Reply;
    if (req.method() === "POST" && u.pathname === VERIFY_PATH)
      reply = {
        status: 201,
        body: {
          data: { email: "k53-verify@example.com", token: SESSION, signed_in: true, terms_pending: termsPending },
        },
      };
    else if (req.method() === "GET" && u.pathname === CURRENT_PATH) reply = { status: 200, body: { data: V2 } };
    else if (req.method() === "GET" && /\/me$/.test(u.pathname))
      reply = { status: 200, body: { data: { id: "u1", email: "k53-verify@example.com", name: "確定 する人" } } };
    else reply = termsPending ? blocked : { status: 200, body: { data: [] } };
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const res = await page.goto(`/verify-email?token=${encodeURIComponent(`k53-link-${uniq()}`)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "登録できました" })).toBeVisible();
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  return visited;
};
row(R["K53-UI-025"], async (page) => {
  const visited = await afterVerify(page, true);
  await expect(page).toHaveURL(/\/login\?step=terms/);
  const u = new URL(page.url());
  expect(u.searchParams.get("next"), "戻る先は今の行き先（チケットの画面）").toBe("/tickets");
  await expect(page.getByRole("heading", { level: 1, name: /規約/ })).toBeVisible();
  expect(
    visited.filter((v) => v.startsWith("/tickets")),
    "同意の前にチケットの画面へ行かない",
  ).toEqual([]);
});
row(R["K53-UI-026"], async (page) => {
  await afterVerify(page, false);
  await expect(page).toHaveURL(/\/tickets(\?|$)/);
  await expect(page).not.toHaveURL(/step=terms/);
});
