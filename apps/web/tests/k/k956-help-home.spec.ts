// K-956「困ったとき・お知らせのホーム（/notices）とお知らせ 1 件（/notices/[id]）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の uh-help・uh-help-empty・uh-help-error・uh-notice（本番と同じ部品 features/F12/help・K-943）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。利用者の口（listNotices・markNoticeRead・getServiceStatusForMember・listMyInquiries）だけを
//   網の手前で差し替える（help-mock.ts）。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import { GONE, N_INCIDENT, N_MAINT, Q_STUCK, err, mockHelp, noticesTaka } from "./help-mock";

const HOME = "/notices";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "../..");
const NOTICES = 'section:has(h2:text-is("お知らせ")) ul.k-uh-list';
const MINE = 'section:has(h2:text-is("自分の問い合わせ")) ul.k-uh-list';

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, path = HOME, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(path);
}
async function openHome(page: Page, width = 1440): Promise<void> {
  await openAt(page, HOME, width);
  await expect(page.getByRole("heading", { name: "困ったとき・お知らせ", level: 1, exact: true })).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, (page: Page) => Promise<void>> = {
  "uh-help": async (page) => {
    await mockHelp(page);
    await openHome(page, page.viewportSize()!.width);
    await expect(page.locator(MINE).locator("li")).toHaveCount(2);
  },
  "uh-help-empty": async (page) => {
    await mockHelp(page, { notices: [], inquiries: [] });
    await openHome(page, page.viewportSize()!.width);
    await expect(page.getByText("まだお知らせも問い合わせもありません", { exact: true })).toBeVisible();
  },
  "uh-help-error": async (page) => {
    const mk = await mockHelp(page);
    mk.script("notices", err(503, "E-PAGE-003"));
    await openHome(page, page.viewportSize()!.width);
    await expect(page.locator('[data-code="E-PAGE-007"]')).toBeVisible();
  },
  "uh-notice": async (page) => {
    await mockHelp(page);
    await openAt(page, `${HOME}/${N_MAINT}`, page.viewportSize()!.width);
    await expect(page.getByRole("status")).toHaveText("読みました（一覧の印が消えます）");
  },
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K956-UI-001 ${id} 幅 ${w}：本文（見出し・区画・お知らせの行・稼働状況・自分の問い合わせ・1 件の時間と影響）の位置と大きさと字がモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchUser(browser, id, w, DRIVES[id]!);
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く・読む
test("K956-UI-002 /notices を開くと区画 3 つ（お知らせ・いまの稼働状況・自分の問い合わせ）・口は 3 本を 1 回ずつ（StrictMode でも二重にしない）・稼働状況の字", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openHome(page);
  for (const h of ["お知らせ", "いまの稼働状況", "自分の問い合わせ"])
    await expect(page.getByRole("heading", { name: h, level: 2, exact: true })).toBeVisible();
  await expect(page.locator(NOTICES).locator("li")).toHaveCount(4);
  const st = page.getByRole("list", { name: "いまの稼働状況", exact: true }).locator("li");
  await expect(st).toHaveCount(3);
  await expect(st.nth(1)).toContainText("分身の実行");
  await expect(st.nth(1)).toContainText("遅れている");
  expect([mk.count("notices"), mk.count("status"), mk.count("inquiries")]).toEqual([1, 1, 1]);
  expect(mk.count("read")).toBe(0);
});

test("K956-UI-003 お知らせの行：未読に「まだ読んでいません」の印が 2 つ・障害は「原因が分かった ・ 」を頭に・1 件への道は /notices/<id>", async ({
  page,
}) => {
  await mockHelp(page);
  await openHome(page);
  const rows = page.locator(NOTICES).locator("li");
  await expect(page.locator(NOTICES).getByRole("img", { name: "まだ読んでいません", exact: true })).toHaveCount(2);
  await expect(rows.first()).toContainText("原因が分かった ・ 送る順番の仕組みを入れ替えています");
  await expect(rows.first().getByRole("link", { name: "分身の実行が遅れています", exact: true })).toHaveAttribute(
    "href",
    `${HOME}/${N_INCIDENT}`,
  );
});

test("K956-UI-004 自分の問い合わせ：返事あり・済みの札と「運営から返事あり」・1 件への道は /inquiry/<id>", async ({
  page,
}) => {
  await mockHelp(page);
  await openHome(page);
  const rows = page.locator(MINE).locator("li");
  await expect(rows.first()).toContainText("返事あり");
  await expect(rows.first()).toContainText("うまく動かない ・ 11/02 ・ 運営から返事あり");
  await expect(rows.nth(1)).toContainText("済み");
  await expect(
    rows.first().getByRole("link", { name: "PC をつけているのに実行待ちのまま", exact: true }),
  ).toHaveAttribute("href", `/inquiry/${Q_STUCK}`);
});

test("K956-UI-005 はじめ（お知らせも問い合わせも 0 件）：「まだお知らせも問い合わせもありません」と各区画の「まだありません」の字", async ({
  page,
}) => {
  await mockHelp(page, { notices: [], inquiries: [] });
  await openHome(page);
  await expect(page.getByText("まだお知らせも問い合わせもありません", { exact: true })).toBeVisible();
  await expect(page.getByText("お知らせはまだありません。", { exact: true })).toBeVisible();
  await expect(page.getByText("問い合わせはまだありません。", { exact: true })).toBeVisible();
});

test("K956-UI-006 読めない：3 本のどれかが 503 か網の切れなら読めなかった旨（E-PAGE-007）で、「もう一度」で 3 本を読み直して区画が出る", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("inquiries", "network");
  await openAt(page);
  await expect(page.locator('[data-code="E-PAGE-007"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "お知らせ", level: 2, exact: true })).toHaveCount(0);
  await page.locator('[data-code="E-PAGE-007"]').getByRole("button").first().click();
  await expect(page.locator(MINE).locator("li")).toHaveCount(2);
  expect(mk.count("inquiries")).toBe(2);
});

test("K956-UI-007 お知らせ 1 件を開く：時間・影響・内容が出て読んだ印の口が 1 回（体は空）・戻ると一覧の印が 1 つ減る（一覧を読み直す）", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openHome(page);
  await page.locator(NOTICES).getByRole("link", { name: "11/10（月）2:00〜3:00 メンテナンス", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${HOME}/${N_MAINT}$`));
  await expect(
    page.getByRole("heading", { name: "11/10（月）2:00〜3:00 メンテナンス", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".k-uh-notice-meta")).toContainText("11/10（月）2:00〜3:00");
  await expect(page.locator(".k-uh-notice-meta")).toContainText("データベースの入れ替えのため");
  await expect(page.getByRole("status")).toHaveText("読みました（一覧の印が消えます）");
  expect(mk.count("read")).toBe(1);
  expect(mk.last("read")).toMatchObject({ id: N_MAINT, body: {} });
  await page.getByRole("link", { name: "困ったとき・お知らせへ戻る", exact: true }).click();
  await expect(page.locator(NOTICES).getByRole("img", { name: "まだ読んでいません", exact: true })).toHaveCount(1);
});

test("K956-UI-008 読んだ印の口が失敗しても 1 件は読める（中身は出る・「読みました」の行は出さない・一覧の印は残る）", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("read", err(503, "E-PAGE-003"));
  await openAt(page, `${HOME}/${N_MAINT}`);
  await expect(
    page.getByRole("heading", { name: "11/10（月）2:00〜3:00 メンテナンス", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("読みました（一覧の印が消えます）", { exact: true })).toHaveCount(0);
  expect(mk.count("read")).toBe(1);
});

test("K956-UI-009 無い・見えないお知らせの道（/notices/<無い id>）は「見つからない」（E-PAGE-001）で、読んだ印の口を呼ばない", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAt(page, `${HOME}/${GONE}`);
  await expect(page.locator('[data-code="E-PAGE-001"]')).toBeVisible();
  expect(mk.count("read")).toBe(0);
});

test("K956-UI-010 「問い合わせる」は道の一覧に /inquiry があれば /inquiry へ、無ければ押せない形（aria-disabled・押しても道は変わらない）", async ({
  page,
}) => {
  await mockHelp(page);
  await openHome(page);
  const built = readFileSync(join(WEB, "lib/built-routes.ts"), "utf8").includes('"/inquiry"');
  const ask = page.getByRole("button", { name: "問い合わせる", exact: true }).first();
  if (built) {
    await ask.click();
    await expect(page).toHaveURL(/\/inquiry$/);
  } else {
    await expect(page.locator('.k-uh-inert:has(button:text-is("問い合わせる"))').first()).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await ask.click({ force: true });
    await expect(page).toHaveURL(new RegExp(`${HOME}$`));
  }
});

test("K956-UI-011 HTML の入った題・本文は字のまま出て動かない", async ({ page }) => {
  const notices = noticesTaka();
  notices[2]!.title = '<img src=x onerror="window.__x=1">スレッド';
  notices[2]!.body = "<b>太字</b>";
  await mockHelp(page, { notices });
  await openHome(page);
  await expect(page.locator(NOTICES)).toContainText('<img src=x onerror="window.__x=1">スレッド');
  await expect(page.locator(NOTICES)).toContainText("<b>太字</b>");
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
});

test("K956-UI-012 幅 320・375・768・1024・1440：ホームと 1 件の横のはみ出しが 0", async ({ page }) => {
  await mockHelp(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openHome(page, w);
    expect(await overflowX(page), `ホーム 幅 ${w}`).toBeLessThanOrEqual(0);
    await openAt(page, `${HOME}/${N_MAINT}`, w);
    await expect(page.locator(".k-uh-notice-meta")).toBeVisible();
    expect(await overflowX(page), `1 件 幅 ${w}`).toBeLessThanOrEqual(0);
  }
});
