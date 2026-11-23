// K-138「外枠をキャンバスどおりの新しい外枠に載せ替える」の画面の試験（実 Chrome・実装より先に積む）。
//   新しい層の 3 画面（/tickets と作る面・/tickets/:id・/approvals）が components/k の Shell に載り、左のメニューが flow.json の
//   主ナビ（lib/nav.ts の sectionsByRole）と同じになるか・上の帯・下のタブ・横溢れ・固定の箱の被り・突き合わせを数で見る。
//   口（API）は網の手前（page.route）で差し替える。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404 を返す）。
//   期待は決める人の答えのおすすめ（K-138.md の決定ログ 1〜6）による：作っていない項目は押せない形で出し目に見える「準備中」を出さない・
//   グループの件数と知らせの数は出さない・探す欄は出さない・承認待ちの数はどの画面でも出す。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Browser, type Page, type Request, type Route } from "@playwright/test";
import { NAV, type RoleId } from "../../lib/nav";
import { isBuilt } from "../../lib/built-routes";
import {
  capture,
  compareFonts,
  compareRows,
  mismatches,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const WS = "aaaaaaaa-0000-4000-8000-000000000001";
const ME = "11111111-0000-4000-8000-000000000001";
const ID = "0193c5a0-0000-7000-8000-00000000c138";
const SALES = "22222222-0000-4000-8000-000000000001";
const ACCT = "22222222-0000-4000-8000-000000000002";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
/** 使えない状態の不透明度（正本 DESIGN-kaname.md の components.button-disabled・input-disabled・tab-disabled） */
const DISABLED_OPACITY = "0.55";

type Reply = { status: number; body: unknown };
interface Mock {
  /** members.role_id（null・知らない値も入れられる） */
  role: string | null;
  /** 自分の情報の口が返す会社名（workspace_name・口の側は K-253）。null は欄が無い */
  workspaceName: string | null;
  meStatus: number;
  /** 名前（null は口が名前を返さない） */
  displayName: string | null;
  approvals: number;
  devices: { state: "waiting" | "live" | "asleep" }[];
  /** 外枠だけが読む 3 つの口（グループ・承認待ちの数・PC）を 500 にする */
  outerFail: boolean;
  signOuts: number;
  /** 呼ばれた口（"GET /api/v1/approvals/queue?limit=5" の形） */
  calls: string[];
}

const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });

async function mockApi(page: Page, o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = {
    role: "owner",
    workspaceName: "ENGINE BASE",
    meStatus: 200,
    displayName: "高本",
    approvals: 2,
    devices: [{ state: "live" }],
    outerFail: false,
    signOuts: 0,
    calls: [],
    ...o,
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  // 本人の Bridge に届かせない（テストで本人の Bridge を止めない・触らない）
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    m.calls.push(`${req.method()} ${p}${u.search}`);
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    const outer = ["/api/v1/scopes", "/api/v1/approvals/queue", "/api/v1/bridge/devices"];
    if (m.outerFail && outer.includes(p)) r = { status: 500, body: { error: "internal", code: "INTERNAL" } };
    else if (p === "/api/auth/get-session")
      r = {
        status: 200,
        body: {
          session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
          user: { id: ME, email: "me@example.com", name: "高本", emailVerified: true },
        },
      };
    else if (p === "/api/v1/auth/sign-out") {
      // ログアウトは契約の口 signOut（K-306）。部品の道 /api/auth/sign-out は K-317 で閉じた（数えない）
      m.signOuts += 1;
      r = { status: 201, body: { data: { signed_out: true } } };
    } else if (p === "/api/auth-ext/me")
      r =
        m.meStatus === 200
          ? ok({
              member_id: ME,
              tenant_id: WS,
              display_name: m.displayName,
              role_id: m.role,
              scope_id: null,
              ...(m.workspaceName === null ? {} : { workspace_name: m.workspaceName }),
            })
          : { status: m.meStatus, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
    else if (p === "/api/v1/scopes")
      r = ok(
        [
          { id: SALES, name: "営業", ticket_prefix: "EG", tenant_id: WS },
          { id: ACCT, name: "経理", ticket_prefix: null, tenant_id: WS },
        ],
        { limit: 200, writable: [SALES] },
      );
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 20, counts: { total: m.approvals }, cursor: null });
    else if (p === "/api/v1/bridge/devices")
      r = ok(
        m.devices.map((d, i) => ({
          id: `d${i}`,
          device_label: "Mac",
          state: d.state,
          last_seen_at: "2026-11-15T00:00:00Z",
          version: "1.0.0",
        })),
      );
    else if (p === "/api/v1/ticket_kinds") r = ok([], { limit: 50 });
    else if (p === "/api/v1/members") r = ok([{ id: ME, display_name: "高本", kind_id: "human" }], { limit: 200 });
    else if (p === "/api/v1/tickets" && req.method() === "GET")
      r = { status: 501, body: { error: "not_implemented", code: "NOT_IMPLEMENTED" } };
    else if (p === `/api/v1/tickets/${ID}`)
      r = ok({
        ticket: { id: ID, number: "EG-133", title: "請求書を送る", due_on: null, start_on: null, priority: "mid" },
        sections: Array.from({ length: 12 }, (_, i) => ({
          key: `s${i}`,
          label: `区画 ${i + 1}`,
          body: { text: "長い本文の段落。".repeat(20) },
          version: 1,
        })),
        kind: { name: "タスク" },
        stage: { name: "未着手" },
        assignee: { display_name: "高本" },
      });
    else if (p === `/api/v1/tickets/${ID}/runs`) r = ok([]);
    else if (p === "/api/v1/me/ticket-drafts") r = ok([]);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

const PATHS = {
  tickets: "/tickets",
  create: "/tickets?new=1",
  detail: `/tickets/${ID}`,
  approvals: "/approvals",
} as const;

async function open(page: Page, path: string, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
  await expect(page.locator(".k-shell")).toBeVisible();
}

const leftNav = (page: Page) => page.getByRole("navigation", { name: "メニュー", exact: true });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** lib/nav.ts（flow.json の生成物）から、その役の左のメニューの名前の並び（主ナビ → 下のワークスペースの管理） */
function expectedLabels(role: RoleId): string[] {
  const keys = (NAV.sectionsByRole[role] ?? []).filter((k) => k !== "me");
  const label = (k: string) => NAV.sections.find((s) => s.key === k)!.label.replace("（名前）", "高本");
  return [...keys.filter((k) => k !== "company").map(label), ...keys.filter((k) => k === "company").map(label)];
}

/** 左のメニューの項目（グループの行を除く）の名前の並び */
const navLabels = (page: Page) =>
  leftNav(page)
    .locator(".k-nav-item:not(:has(.k-group-mark))")
    .evaluateAll((els) => els.map((e) => e.querySelector(".k-nav-label")?.textContent?.trim() ?? ""));

/** 絵（svg）の大きさ（width・height・viewBox）と線の形：子の要素ごとに 形の名前・d・x・y・幅・高さ・角丸（色や太さは見ない） */
const svgSigs = (page: Page, sel: string) =>
  page.locator(sel).evaluateAll((els) =>
    els.map((e) => {
      const svg = e.querySelector("svg");
      const size = ["width", "height", "viewBox"].map((a) => svg?.getAttribute(a) ?? "").join(",");
      const lines = [...(svg?.children ?? [])]
        .map((c) =>
          [c.tagName, ...["d", "x", "y", "width", "height", "rx"].map((x) => c.getAttribute(x) ?? "")].join(","),
        )
        .join(" ");
      return `${size} ${lines}`;
    }),
  );
/** キャンバスの頁を開いて、その要素の絵の線を読む（外への道は止める） */
async function canvasSigs(browser: Browser, file: string, sel: string, width: number): Promise<string[]> {
  const cp = await browser.newPage({ viewport: { width, height: 900 } });
  await cp.route(/^https?:\/\//, (route) => route.abort());
  await cp.goto(pathToFileURL(join(ROOT, `04_design/canvas/${file}.dc.html`)).href);
  await cp.locator(sel).first().waitFor({ state: "attached" });
  const sigs = await svgSigs(cp, sel);
  await cp.close();
  return sigs;
}

test("K138-SH-001 役 owner（R1）・/tickets：左のメニューの項目が lib/nav.ts の R1 の主ナビと同じ並びで、項目の絵の線がキャンバス Main と同じ", async ({
  page,
  browser,
}) => {
  await mockApi(page, { role: "owner" });
  await open(page, PATHS.tickets);
  const want = expectedLabels("R1");
  expect(want).toEqual(["チケット", "承認待ち", "高本のAI", "ナレッジ", "取引先", "ワークスペースの管理"]);
  await expect.poll(() => navLabels(page)).toEqual(want);
  const canvas = await canvasSigs(browser, "Main", ".kn-nav > a.kn-item:not(:has(> span:not(.kn-lbl)))", 1440);
  expect(canvas).toHaveLength(6);
  expect(await svgSigs(page, ".k-nav > .k-nav-item:not(:has(.k-group-mark))")).toEqual(canvas);
});

test("K138-SH-002 役 staff（R3）：項目が lib/nav.ts の R3 と同じ（取引先が無い）", async ({ page }) => {
  await mockApi(page, { role: "staff" });
  await open(page, PATHS.tickets);
  const want = expectedLabels("R3");
  expect(want).not.toContain("取引先");
  await expect.poll(() => navLabels(page)).toEqual(want);
});

test("K138-SH-003 3 画面とも新しい外枠に載り、前の外枠（主ナビ・下タブ）が 0", async ({ page }) => {
  await mockApi(page);
  for (const path of [PATHS.tickets, PATHS.detail, PATHS.approvals]) {
    await open(page, path);
    await expect(page.getByRole("complementary", { name: "主ナビ" }), path).toHaveCount(0);
    await expect(page.locator("nav.tabbar"), path).toHaveCount(0);
    await expect(page.locator(".k-shell [data-ticket-shell]"), path).toHaveCount(1);
  }
});

test("K138-SH-004 apps/web/features のどのファイルも前の外枠（@/components/shell・@/lib/nav.legacy）を読まない", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) {
        const src = readFileSync(p, "utf8");
        if (/from\s+["']@\/components\/shell["']|from\s+["']@\/lib\/nav\.legacy["']/.test(src)) hits.push(p);
      }
    }
  };
  walk(join(WEB, "features"));
  expect(hits).toEqual([]);
});

test("K138-SH-005 今いる項目：/tickets と /tickets/:id はチケット、/approvals は承認待ちだけに aria-current", async ({
  page,
}) => {
  await mockApi(page);
  for (const [path, here] of [
    [PATHS.tickets, "チケット"],
    [PATHS.detail, "チケット"],
    [PATHS.approvals, "承認待ち"],
  ] as const) {
    await open(page, path);
    const current = leftNav(page).locator('[aria-current="page"]');
    await expect(current, path).toHaveCount(1);
    await expect(current.locator(".k-nav-label").first(), path).toHaveText(here);
  }
});

test("K138-SH-006 作っていない項目（ナレッジ・取引先・ワークスペースの管理）は押せない形（読み上げは「使えないリンク」・Tab で止まり Enter でも移らない）・title に準備中・目に見える「準備中」の字が無い", async ({
  page,
}) => {
  await mockApi(page);
  await open(page, PATHS.tickets);
  const nav = leftNav(page);
  for (const name of ["ナレッジ", "取引先", "ワークスペースの管理"]) {
    // 押せるリンクは無く、読み上げには「使えないリンク」として届く（role=link・aria-disabled）
    await expect(nav.getByRole("link", { name: new RegExp(name), disabled: false }), name).toHaveCount(0);
    const item = nav.getByRole("link", { name: new RegExp(name), disabled: true });
    await expect(item, name).toHaveCount(1);
    expect(await item.getAttribute("title"), name).toContain("準備中");
    expect(await item.evaluate((e) => getComputedStyle(e).opacity), name).toBe(DISABLED_OPACITY);
    const before = page.url();
    await item.click({ force: true });
    expect(page.url(), name).toBe(before);
    // キーボード：Tab で止まり（tabindex 0・title の準備中に届く）、Enter を押しても移らない
    await expect(item, name).toHaveAttribute("tabindex", "0");
    await item.focus();
    await expect(item, name).toBeFocused();
    await page.keyboard.press("Enter");
    expect(page.url(), name).toBe(before);
  }
  expect(await nav.innerText()).not.toContain("準備中");
});

test("K138-SH-007 左のメニューを押す：承認待ちの画面でチケットを押すと /tickets、/tickets で承認待ちを押すと /approvals", async ({
  page,
}) => {
  await mockApi(page);
  await open(page, PATHS.approvals);
  await leftNav(page)
    .getByRole("link", { name: /^チケット/ })
    .click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.locator(".k-shell")).toBeVisible();
  await leftNav(page)
    .getByRole("link", { name: /^承認待ち/ })
    .click();
  await expect(page).toHaveURL(/\/approvals$/);
});

test("K138-SH-008 承認待ちの口の数 2：/tickets でも /approvals でも承認待ちの項目に「2」（aria-label「2 件」）", async ({
  page,
}) => {
  await mockApi(page, { approvals: 2 });
  for (const path of [PATHS.tickets, PATHS.approvals]) {
    await open(page, path);
    const item = leftNav(page).getByRole("link", { name: /^承認待ち/ });
    await expect(item.locator(".k-nav-badge"), path).toHaveText("2");
    await expect(item.locator(".k-nav-badge"), path).toHaveAttribute("aria-label", "2 件");
  }
});

test("K138-SH-009 グループ：見出し「グループ」と★（グレーで押せない）の下に 営業・経理 の 2 行。絞り込みができるまでグレーで押せない（D-145.18）・件数の字は無い・札は番号の頭（無ければ名前の頭 1 字）で 18px", async ({
  page,
}) => {
  await mockApi(page);
  await open(page, PATHS.tickets);
  const nav = leftNav(page);
  await expect(nav.locator(".k-nav-sec")).toBeVisible();
  await expect(nav.locator(".k-nav-sec")).toContainText("グループ");
  const star = nav.locator('.k-nav-sec [aria-disabled="true"]', { hasText: "★" });
  await expect(star).toBeVisible();
  expect(await star.evaluate((e) => getComputedStyle(e).opacity)).toBe(DISABLED_OPACITY);
  const groups = nav.locator(".k-nav-item:has(.k-group-mark)");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0).locator(".k-nav-label").first()).toHaveText("営業");
  await expect(groups.nth(1).locator(".k-nav-label").first()).toHaveText("経理");
  await expect(groups.locator(".k-group-mark")).toHaveText(["EG", "経"]);
  for (const i of [0, 1]) {
    const g = groups.nth(i);
    await expect(g).toHaveAttribute("role", "link");
    await expect(g).toHaveAttribute("aria-disabled", "true");
    await expect(g).toHaveAttribute("tabindex", "0");
    await expect(g).toHaveAttribute("data-group", ["営業", "経理"][i]!);
    // 札の字はキャンバスどおり 10px・太さ普通
    expect(
      await g.locator(".k-group-mark").evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).fontWeight]),
    ).toEqual(["10px", "400"]);
    await expect(g).not.toHaveAttribute("href", /./);
    expect(await g.getAttribute("title")).toContain("準備中");
    expect(await g.evaluate((e) => getComputedStyle(e).opacity)).toBe(DISABLED_OPACITY);
    const box = await g
      .locator(".k-group-mark")
      .evaluate((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]);
    expect(box.map(Math.round)).toEqual([18, 18]);
    const before = page.url();
    await g.click({ force: true });
    expect(page.url()).toBe(before);
  }
  // 札の幅がそろい、名前の左の端が 2 行でそろう（札がはみ出して名前がずれない）
  const lefts = await groups
    .locator(".k-nav-label")
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(1);
  await expect(groups.locator(".k-nav-count")).toHaveCount(0);
});

for (const [devices, label] of [
  [[{ state: "live" }], "PC つながっている"],
  [[{ state: "asleep" }], "PC をつないでいない"],
  [[], "PC をつないでいない"],
] as const) {
  test(`K138-SH-010 PC の口 ${devices.map((d) => d.state).join("・") || "0 件"}：「${label}」`, async ({ page }) => {
    await mockApi(page, { devices: [...devices] });
    await open(page, PATHS.tickets);
    await expect(leftNav(page).locator(".k-pc")).toHaveText(label);
  });
}

test("K138-SH-011 上の帯のいまの場所：画面ごとの字・詳細はチケットへのリンクと番号・帯に h1 が無く、どの画面も h1 は 1 つ", async ({
  page,
}) => {
  await mockApi(page);
  for (const [path, want] of [
    [PATHS.tickets, ["チケット"]],
    [PATHS.detail, ["チケット", "EG-133"]],
    [PATHS.approvals, ["承認待ち"]],
  ] as const) {
    await open(page, path);
    const crumbs = page.getByRole("navigation", { name: "いまの場所" });
    for (const w of want) await expect(crumbs, path).toContainText(w);
    if (path === PATHS.detail)
      await expect(crumbs.getByRole("link", { name: "チケット" })).toHaveAttribute("href", "/tickets");
    await expect(page.locator("header.k-bar h1"), path).toHaveCount(0);
    await expect(page.locator("h1"), path).toHaveCount(1);
  }
});

test("K138-SH-012 上の帯：探す欄はグレーで出て打っても字が入らない（⌘K でも）・知らせの鈴はグレーで押しても何も開かず数の字が無い", async ({
  page,
}) => {
  await mockApi(page);
  await open(page, PATHS.tickets);
  const bar = page.locator("header.k-bar");
  const search = bar.getByRole("search");
  await expect(search).toHaveCount(1);
  const box = search.locator("input");
  await expect(box).toBeDisabled();
  await expect(box).toHaveAttribute("aria-disabled", "true");
  expect(await search.evaluate((e) => getComputedStyle(e).opacity)).toBe(DISABLED_OPACITY);
  await box.click({ force: true });
  await page.keyboard.type("請求");
  await expect(box).toHaveValue("");
  await page.keyboard.press("Meta+k");
  await expect(box).not.toBeFocused();
  const bell = bar.locator(".k-bell");
  await expect(bell).toHaveCount(1);
  await expect(bell).toHaveAttribute("aria-disabled", "true");
  expect(await bell.evaluate((e) => getComputedStyle(e).opacity)).toBe(DISABLED_OPACITY);
  expect((await bell.innerText()).trim()).toBe("");
  const before = page.url();
  await bell.click({ force: true });
  await page.keyboard.press("Enter");
  expect(page.url()).toBe(before);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("K138-SH-013 自分のメニュー：名前「高本」・「準備中」の字が無い・ログアウトを押すとログアウトの口を呼び /login へ移る", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page, PATHS.tickets);
  await page.getByRole("button", { name: "自分のメニュー" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("高本");
  // 作っていない項目（自分の設定 など）も「準備中」の字を出さない（D-144.1）
  expect(await menu.innerText()).not.toContain("準備中");
  await menu.getByRole("menuitem", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(m.signOuts).toBeGreaterThan(0);
});

test("K138-SH-014 幅 375：左のメニューは見えず、下のタブが チケット・承認（2）・＋・AI・メニュー の順で絵の線がキャンバス MobileList と同じ。＋で /tickets?new=1", async ({
  page,
  browser,
}) => {
  await mockApi(page, { approvals: 2 });
  await open(page, PATHS.tickets, 375);
  await expect(leftNav(page)).toBeHidden();
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs).toBeVisible();
  const items = await tabs
    .locator(":scope > *")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.querySelector(".k-nav-label")?.textContent?.trim()),
    );
  expect(items).toEqual(["チケット", "承認", "チケットを作る", "AI", "メニュー"]);
  await expect(tabs.locator(":scope > *").nth(1)).toContainText("2");
  // 数の印はキャンバスどおり 16px の丸・10px
  expect(
    await tabs.locator(".k-nav-badge").evaluate((e) => {
      const r = e.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height), getComputedStyle(e).fontSize];
    }),
  ).toEqual([16, 16, "10px"]);
  // 絵の線がキャンバス MobileList の下のタブと同じ（＋は字なので絵を持たない）
  const canvas = await canvasSigs(browser, "MobileList", 'nav[aria-label="下のタブ"] > a', 375);
  expect(await svgSigs(page, ".k-tabs > :is(a, button, span)")).toEqual(canvas);
  await tabs.getByRole("button", { name: "チケットを作る" }).click();
  await expect(page).toHaveURL(/\/tickets\?new=1$/);
});

test("K138-SH-015 幅 375：メニューを押すと全部のメニューが開き項目が左のメニューと同じ・「準備中」の字が無い。もう一度押すと閉じる", async ({
  page,
}) => {
  await mockApi(page);
  await open(page, PATHS.tickets, 375);
  const btn = page.getByRole("navigation", { name: "下のタブ" }).getByRole("button", { name: "メニュー" });
  await btn.click();
  const sheet = page.getByRole("navigation", { name: "メニュー（全部）" });
  await expect(sheet).toBeVisible();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  const labels = await sheet
    .locator(".k-nav-item:not(:has(.k-group-mark))")
    .evaluateAll((els) => els.map((e) => e.querySelector(".k-nav-label")?.textContent?.trim() ?? ""));
  expect(labels).toEqual(expectedLabels("R1"));
  expect(await sheet.innerText()).not.toContain("準備中");
  await btn.click();
  await expect(sheet).toHaveCount(0);
});

test("K138-SH-016 外枠を持つ 4 画面 × 幅 320・375・768・1024・1440 で横溢れ 0・本文の h1 の左の端が画面の中・作る面の左右の端も画面の中", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mockApi(page);
  const bad: string[] = [];
  for (const path of Object.values(PATHS))
    for (const w of WIDTHS) {
      await open(page, path, w);
      const o = await overflowX(page);
      if (o !== 0) bad.push(`${path} 幅 ${w}：${o}px`);
      // 左へのはみ出しは scrollWidth − clientWidth に出ないので、本文の h1 の左の端が画面の中かを見る（レビューの見つけもの）
      const x = await page
        .locator("#k-main h1")
        .first()
        .evaluate((e) => e.getBoundingClientRect().left);
      if (x < 0) bad.push(`${path} 幅 ${w}：本文の h1 の左の端 ${x}`);
      // 作る面を開いたときは、作る面の欄（region「チケットを作る」）の左右の端も画面の中（字の頭が切れない）
      if (path === PATHS.create) {
        const r = await page
          .getByRole("region", { name: "チケットを作る" })
          .evaluate((e) => [e.getBoundingClientRect().left, e.getBoundingClientRect().right]);
        if (r[0]! < 0 || r[1]! > w) bad.push(`${path} 幅 ${w}：作る面の左右の端 ${r.join("〜")}`);
      }
    }
  expect(bad).toEqual([]);
});

test("K138-SH-017 幅 375・768・1440：外枠の中の押せるものは 24px 以上", async ({ page }) => {
  await mockApi(page);
  for (const w of [375, 768, 1440]) {
    await open(page, PATHS.tickets, w);
    const small = await page.$$eval(
      ".k-shell > nav a[href], .k-shell > nav button, .k-shell header.k-bar a[href], .k-shell header.k-bar button",
      (els) =>
        els
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && !e.classList.contains("k-skip");
          })
          .map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim()),
    );
    expect(small, `幅 ${w}`).toEqual([]);
  }
});

test("K138-SH-018 左のメニュー・下のタブ・全部のメニュー・自分のメニューの行き先は全部作った画面", async ({ page }) => {
  await mockApi(page);
  const hrefs = new Set<string>();
  const collect = async (sel: string) => {
    for (const h of await page.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? "")))
      hrefs.add(h);
  };
  await open(page, PATHS.tickets);
  await collect('nav[aria-label="メニュー"] a[href]');
  await page.getByRole("button", { name: "自分のメニュー" }).click();
  await collect('[role="menu"] a[href]');
  await page.keyboard.press("Escape");
  await open(page, PATHS.tickets, 375);
  await collect('nav[aria-label="下のタブ"] a[href]');
  await page.getByRole("navigation", { name: "下のタブ" }).getByRole("button", { name: "メニュー" }).click();
  await collect('nav[aria-label="メニュー（全部）"] a[href]');
  expect(hrefs.size).toBeGreaterThan(0);
  expect([...hrefs].filter((h) => !isBuilt(h))).toEqual([]);
});

test("K138-SH-019 幅 375：本文を一番下まで送っても、本文の最後の要素が下のタブ（固定の箱）に被らない", async ({
  page,
}) => {
  await mockApi(page, { approvals: 0 });
  for (const path of [PATHS.detail, PATHS.approvals]) {
    await open(page, path, 375);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const tabsTop = await page
      .getByRole("navigation", { name: "下のタブ" })
      .evaluate((e) => e.getBoundingClientRect().top);
    const lastBottom = await page.locator("#k-main").evaluate((main) => {
      const all = [...main.querySelectorAll<HTMLElement>("*")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).position !== "fixed";
      });
      return Math.max(...all.map((e) => e.getBoundingClientRect().bottom));
    });
    // 文書の高さ（scrollHeight）は整数に丸められ、字の行の高さで本文の高さが端数（例 .39px）になると最後の 1px 未満までは送れない。
    // 被りは 1px からを数える（K-1114：G48 で 840.39 ＞ 840 が赤だった。最後の物は面の下の余白で、字は 16px 上で終わっていた）
    expect(lastBottom, path).toBeLessThan(tabsTop + 1);
  }
});

test("K138-SH-020 幅 768 は左のメニューが 56px のレール（項目の名前は title で読める・畳むボタンが在る）、1024 は 216px", async ({
  page,
}) => {
  await mockApi(page);
  await open(page, PATHS.tickets, 768);
  await expect.poll(() => leftNav(page).evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(56);
  await expect(leftNav(page).getByRole("link", { name: /^チケット/ })).toHaveAttribute("title", /チケット/);
  // レールにもキャンバスどおり畳むボタンが在る
  await expect(leftNav(page).locator(".k-nav-toggle")).toBeVisible();
  await open(page, PATHS.tickets, 1024);
  await expect.poll(() => leftNav(page).evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(216);
});

test("K138-SH-021 役が分かるまで（読み中）は左のメニューに役の項目のリンクが 0・本文は出る。役の口が 401（ログインが切れた）なら入り直し（/login?next=）へ移り、前の役の項目を出さない。役の値が分からない（null・知らない値）ときも役の項目を出さない", async ({
  page,
  browser,
}) => {
  await mockApi(page);
  // 役の口の答えを止めておき（読み中）、後で 401 を返す。後から足した route が先に効く
  let release!: () => void;
  const held = new Promise<void>((done) => (release = done));
  await page.route(/\/api\/auth-ext\/me$/, async (route) => {
    await held;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthenticated", code: "UNAUTHENTICATED" }),
    });
  });
  // 401 の後に役の項目を一度でも描いたら印を立てる（入り直しは画面の中の移動なので、印は /login に移った後も読める）
  await page.addInitScript(() => {
    const w = window as unknown as { __roleNavSeen?: boolean };
    w.__roleNavSeen = false;
    const look = () => {
      if (document.querySelector('nav[aria-label="メニュー"] .k-nav-item:not(:has(.k-group-mark))'))
        w.__roleNavSeen = true;
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(PATHS.detail);
  await expect(page.locator(".k-shell")).toBeVisible();
  await expect(page.locator("#k-main h1")).toHaveText("請求書を送る");
  for (const name of expectedLabels("R1"))
    await expect(leftNav(page).getByRole("link", { name: new RegExp(`^${name}`) }), name).toHaveCount(0);
  await expect(leftNav(page).locator(".k-nav-item:not(:has(.k-group-mark))")).toHaveCount(0);
  // ログインが切れた（401）：どの画面も入り直しへ（lib/api/query.tsx・D-086.4）。開いていた場所を next に持つ
  release();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(PATHS.detail)}$`));
  // 読み中から入り直しまでのあいだに、役の項目（R1 などに倒した物）を一度も描いていない
  expect(await page.evaluate(() => (window as unknown as { __roleNavSeen?: boolean }).__roleNavSeen)).toBe(false);
  // 口は答えたが役の値が分からない（null・知らない値）：いちばん広い主ナビ（R1）に倒さず、役の項目を出さない
  for (const role of [null, "unknown-role"]) {
    const p2 = await browser.newPage();
    await mockApi(p2, { role });
    await p2.setViewportSize({ width: 1440, height: 900 });
    await p2.goto(PATHS.detail);
    await expect(p2.locator("#k-main h1")).toHaveText("請求書を送る");
    await expect(p2.locator(".k-bar .k-me .k-avatar")).toHaveText("高");
    await expect(leftNav(p2).locator(".k-nav-item:not(:has(.k-group-mark))"), String(role)).toHaveCount(0);
    await p2.close();
  }
});

test("K138-SH-022 鍵が無い（ログインしていない）：/tickets を開くと /login?next=%2Ftickets に移る", async ({
  page,
}) => {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHENTICATED" }) }),
  );
  await page.goto(PATHS.tickets);
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets$/);
});

test("K138-SH-025 使えない状態の部品：正本に button-disabled・input-disabled・tab-disabled（opacity 0.55）・トークン --k-c-button-disabled-opacity と --k-c-input-disabled-opacity が 0.55・作っていない項目と探す欄（外の箱）の不透明度がその値で、中の入力欄は重ねない", async ({
  page,
}) => {
  const design = readFileSync(join(ROOT, "04_design/DESIGN-kaname.md"), "utf8");
  const front = design.split(/^---$/m)[1] ?? "";
  for (const part of ["button-disabled", "input-disabled", "tab-disabled"]) {
    expect(front, part).toMatch(new RegExp(`\\n {2}${part}:\\n(?: {4}.*\\n)*? {4}opacity: "?0\\.55"?\\n`));
  }
  await mockApi(page);
  await open(page, PATHS.tickets);
  const tokens = await page.evaluate(() => {
    const st = getComputedStyle(document.documentElement);
    return {
      button: st.getPropertyValue("--k-c-button-disabled-opacity").trim(),
      input: st.getPropertyValue("--k-c-input-disabled-opacity").trim(),
    };
  });
  // 本番の形の組み立てでは CSS の圧縮でトークンの字が「.55」になる（CI の回 43801690491）。字でなく数で比べる
  expect({ button: Number(tokens.button), input: Number(tokens.input) }).toEqual({
    button: Number(DISABLED_OPACITY),
    input: Number(DISABLED_OPACITY),
  });
  const item = leftNav(page).locator('[aria-disabled="true"]').first();
  expect(Number(await item.evaluate((e) => getComputedStyle(e).opacity))).toBe(Number(tokens.button));
  // 探す欄は外の箱（role search）だけを薄くする。中の入力欄にも掛けると薄さが重なる（0.55 × 0.55）ので、入力欄は 1 のまま
  const search = page.getByRole("search");
  expect(Number(await search.evaluate((e) => getComputedStyle(e).opacity))).toBe(Number(tokens.input));
  expect(await search.locator("input").evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
});

test("K138-SH-026 外枠だけが読む 3 つの口（グループ・承認待ちの数・PC）が 500：主ナビは R1 どおり・数の印なし・グループの見出しなし・PC はつないでいない・本文は出る", async ({
  page,
}) => {
  await mockApi(page, { outerFail: true });
  await open(page, PATHS.detail);
  await expect(page.locator("#k-main h1")).toHaveText("請求書を送る");
  await expect.poll(() => navLabels(page)).toEqual(expectedLabels("R1"));
  const nav = leftNav(page);
  await expect(nav.locator(".k-nav-badge")).toHaveCount(0);
  await expect(nav.getByText("グループ", { exact: true })).toHaveCount(0);
  await expect(nav.locator(".k-nav-item:has(.k-group-mark)")).toHaveCount(0);
  await expect(nav.locator(".k-pc")).toHaveText("PC をつないでいない");
  // 書けるグループが分からないあいだは作るボタンを出さない
  await expect(nav.getByRole("button", { name: "チケットを作る" })).toHaveCount(0);
});

test("K138-SH-027 外枠の口は 1 画面で 1 回：/tickets で PC・承認待ちの数・グループを 1 回ずつ読み、時計を 60 秒進めても窓に戻っても増えない・/approvals では外枠が数を読まない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await page.clock.install();
  await open(page, PATHS.tickets);
  await expect(leftNav(page).locator(".k-pc")).toHaveText("PC つながっている");
  await expect(leftNav(page).locator(".k-nav-badge")).toHaveText("2");
  const count = (prefix: string) => m.calls.filter((c) => c.startsWith(prefix)).length;
  expect(count("GET /api/v1/bridge/devices")).toBe(1);
  // 承認待ちの数は、一覧の右の列（自分の承認を待っているもの・5 件）と同じ問い合わせを分け合う（K-235）
  expect(count("GET /api/v1/approvals/queue?limit=5")).toBe(1);
  // グループの口は外枠と本文（作る面の選択肢）で分け合い、1 回だけ読む
  expect(count("GET /api/v1/scopes")).toBe(1);
  await page.clock.runFor(60_000);
  expect(count("GET /api/v1/bridge/devices")).toBe(1);
  expect(count("GET /api/v1/approvals/queue?limit=5")).toBe(1);
  expect(count("GET /api/v1/scopes")).toBe(1);
  // 窓に戻っても役の口を読み直さない
  const meBefore = count("GET /api/auth-ext/me");
  // 入っている TanStack Query は window の visibilitychange を聞く（document の物は泡立たず届かない）
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await page.clock.runFor(10_000);
  expect(count("GET /api/auth-ext/me")).toBe(meBefore);

  m.calls.length = 0;
  await open(page, PATHS.approvals);
  await expect(page.locator("#k-main h1")).toHaveText("承認待ち");
  await expect(leftNav(page).locator(".k-pc")).toHaveText("PC つながっている");
  expect(count("GET /api/v1/approvals/queue?limit=5")).toBe(0);
});

test("K138-SH-028 名前が無い（display_name が null）：自分の札とメニューの名前は空（嘘の名前を出さない）・AI の項目は「あなたのAI」（下のタブは「AI」のまま）", async ({
  page,
}) => {
  await mockApi(page, { displayName: null });
  await open(page, PATHS.tickets);
  await expect.poll(() => navLabels(page)).toContain("チケット");
  await expect(page.locator(".k-bar .k-me .k-avatar")).toHaveText("");
  await page.getByRole("button", { name: "自分のメニュー" }).click();
  await expect(page.locator(".k-menu-head")).toHaveText("");
  await page.keyboard.press("Escape");
  const labels = await navLabels(page);
  // 決める人の答え（D-145.17・answer=f0b42d2edbed）
  expect(labels).toContain("あなたのAI");
  expect(labels).not.toContain("のAI");
  // 下のタブの短い名前は「AI」のまま
  await open(page, PATHS.tickets, 375);
  await expect(
    page.getByRole("navigation", { name: "下のタブ" }).locator(".k-nav-label", { hasText: /AI/ }),
  ).toHaveText("AI");
});

test("K138-SH-029 左上の会社の印：口の答えに会社名（workspace_name）が在れば頭文字と会社名、無ければどちらも出さない（紺の四角だけ）。会社の切り替え ▾ はグレーで押せない", async ({
  page,
}) => {
  await mockApi(page, { workspaceName: "ENGINE BASE" });
  await open(page, PATHS.tickets);
  const top = leftNav(page).locator(".k-nav-top");
  await expect(top.locator(".k-ws-mark")).toHaveText("E");
  await expect(top.locator(".k-ws-name")).toContainText("ENGINE BASE");
  const sw = top.getByRole("button", { name: /会社を切り替える/, disabled: true });
  await expect(sw).toHaveText("▾");
  expect(await sw.evaluate((e) => getComputedStyle(e).opacity)).toBe(DISABLED_OPACITY);
  const before = page.url();
  await sw.click({ force: true });
  expect(page.url()).toBe(before);
  await expect(page.getByRole("menu")).toHaveCount(0);

  await mockApi(page, { workspaceName: null });
  await open(page, PATHS.tickets);
  await expect.poll(() => navLabels(page)).toContain("チケット");
  await expect(top.locator(".k-ws-mark")).toHaveText("");
  await expect(top.locator(".k-ws-name")).not.toContainText("ENGINE");
  expect((await top.locator(".k-ws-name").innerText()).replace("▾", "").trim()).toBe("");
});

test("K138-SH-030 幅 767 以下（375）は上の帯を出す（2026-11-18 代表がキャンバス MobileList の決めを変えた・K-350）：帯の左に会社の印と名前、右に 探す（グレー）・知らせ（グレー）・自分のメニュー。いまの場所と帯の題は出さず、見える題は本文の h1 だけ。本文の見出しの右に鈴は無い。引き出し「メニュー（全部）」に自分のメニューは無い", async ({
  page,
}) => {
  await mockApi(page, { workspaceName: "ENGINE BASE" });
  for (const path of [PATHS.tickets, PATHS.detail, PATHS.approvals]) {
    await open(page, path, 375);
    const h1 = page.locator("#k-main h1").first();
    await expect(h1, path).toBeVisible();
    // 見えている見出し（h1・帯の題）のうち、画面の題として出るのは本文の h1 の 1 つだけ
    const titles = await page.evaluate(
      () =>
        [...document.querySelectorAll("h1, .k-bar-title")].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== "hidden";
        }).length,
    );
    expect(titles, path).toBe(1);
    const bar = page.locator("header.k-bar");
    await expect(bar, path).toBeVisible();
    expect(Math.round((await bar.boundingBox())!.height), `${path} 帯の高さ`).toBe(48);
    await expect(bar.locator(".k-bar-ws"), path).toHaveText("E");
    await expect(bar.locator(".k-bar-ws-name"), path).toHaveText("ENGINE BASE");
    await expect(page.getByRole("navigation", { name: "いまの場所" }), path).toBeHidden();
    await expect(page.getByRole("search"), path).toBeHidden();
    const searchOpen = bar.getByRole("button", { name: "探す（準備中）" });
    await expect(searchOpen, path).toBeVisible();
    await expect(searchOpen, path).toHaveAttribute("aria-disabled", "true");
    await expect(bar.getByRole("button", { name: "自分のメニュー" }), path).toBeVisible();
    // 鈴は帯の中の 1 つだけ（本文の見出しの右には置かない）
    await expect(page.locator(".k-bell"), path).toHaveCount(1);
    const bell = bar.locator(".k-bell");
    await expect(bell, path).toBeVisible();
    await expect(bell, path).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#k-main .k-bell"), path).toHaveCount(0);
    expect(await overflowX(page), path).toBe(0);
  }
  await open(page, PATHS.tickets, 375);
  await page.locator("header.k-bar").getByRole("button", { name: "自分のメニュー" }).click();
  await expect(page.getByRole("menu")).toContainText("高本");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByRole("navigation", { name: "下のタブ" }).getByRole("button", { name: "メニュー" }).click();
  const sheet = page.getByRole("navigation", { name: "メニュー（全部）" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "自分のメニュー" })).toHaveCount(0);
});

interface Group {
  id: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
}
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const SHELL_GROUPS = ["shell-nav", "shell-tabs"] as const;

test("K138-SH-023 突き合わせの設定：shell-nav・shell-tabs が enrolled・持ち主 K-138・shell-tabs の絵は MobileList・画面を整える道具に鍵・帯の箱とグループの行も比べる", () => {
  for (const id of SHELL_GROUPS) {
    const g = CFG.groups.find((x) => x.id === id);
    expect(g, id).toBeTruthy();
    expect(g!.enrolled, id).toBe(true);
    expect(g!.owner, id).toBe("K-138");
    expect(FIDELITY_STATES[g!.state], `${id} の state ${g!.state}`).toBeTruthy();
  }
  expect(CFG.groups.find((x) => x.id === "shell-tabs")!.canvas).toBe("MobileList");
  // 上の帯の箱（高さ・背景）とグループの行（高さ・文字の大きさ）も、名前の違う値として比べる（レビューの指摘 7）
  const nav = CFG.groups.find((x) => x.id === "shell-nav")!.pairs;
  const bar = nav.find((p) => p.canvas === ".kn-bar" && p.app === ".k-bar");
  expect(bar?.props).toEqual(expect.arrayContaining(["height", "background-color"]));
  const group = nav.find(
    (p) => p.canvas === '.kn-nav > a.kn-item[title="営業"]' && p.app === '.k-nav > .k-nav-item[data-group="営業"]',
  );
  expect(group?.props).toEqual(expect.arrayContaining(["height", "font-size"]));
});

for (const id of SHELL_GROUPS) {
  const g = CFG.groups.find((x) => x.id === id);
  for (const w of g?.widths ?? [1440]) {
    test(`K138-SH-024 ${id}（${g?.canvas ?? "?"}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({
      browser,
    }) => {
      expect(g, id).toBeTruthy();
      const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await routeCanvasFonts(canvasPage);
      await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${g!.canvas}.dc.html`)).href);
      for (const p of g!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
      const C = await capture(canvasPage, g!.pairs, "canvas");
      await canvasPage.close();

      const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await appPage.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
      await FIDELITY_STATES[g!.state]!(appPage, g!.app);
      for (const p of g!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
      // 後から届く口の値（承認待ちの数の印・自分の札）が出てから読む（届く前の値で比べない）
      if (id === "shell-nav") {
        await expect(appPage.locator(".k-nav .k-nav-badge")).toHaveText("2");
        await expect(appPage.locator(".k-bar .k-me .k-avatar")).toHaveText("高");
      } else await expect(appPage.locator(".k-tabs .k-nav-badge")).toHaveText("9");
      const A = await capture(appPage, g!.pairs, "app");
      await appPage.close();

      const rows = [...compareRows(g!.pairs, C.vals, A.vals), compareFonts(C.fonts, A.fonts)];
      const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
      expect(mismatches(rows), bad.join("\n")).toBe(0);
    });
  }
}
