// K-220「PC をつなぐ（/setup/bridge）を新しい外枠に入れる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/MePC.dc.html の外側（左のメニュー・上の帯・自分の設定の第 2 ナビ・本文の箱と見出し）。中身（PC の一覧・小窓）は K-230。
//   画面の形（実装の役が作る）：外枠（components/k の Shell・K-138 の TicketShell を screen="bridge-setup" で使う）の本文に、
//     aside[aria-label="自分の設定の中"]（見出し アカウント・分身・ワークスペースごと／項目 a 5 つ：名前の字は .k-me-sub-t）と
//     section.k-page.k-me-page[aria-labelledby="connect-pc-title"]（見出しの行 .k-page-head に h1「PC と使った量」（キャンバス MePC）と説明・下に K-57 の中身）。
//   口（API）とこの PC の中だけの口（127.0.0.1:38617）は網の手前で差し替える（本人の Bridge に届かせない：つながらない扱いで止める）。
//   期待は決める人の決まり（D-143.1 新しい外枠・D-144.6 PC をつなぐはこのチケットで新しい外枠へ・D-145.9 キャンバスに在る物は出し、使えない物はグレーで押せない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  mismatches,
  readVals,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WS = "aaaaaaaa-0000-4000-8000-000000000220";
const ME = "11111111-0000-4000-8000-000000000220";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const WHITE = "rgb(255, 255, 255)";
const MUTED = "rgb(74, 85, 99)";
const SUB = '[aria-label="自分の設定の中"]';
const BODY = 'section.k-me-page[aria-labelledby="connect-pc-title"]';

type Reply = { status: number; body: unknown };
interface Mock {
  reads: Record<string, number>;
  devices: { state: "live" | "waiting" | "asleep" }[];
  holdDevices: boolean;
  /** PC の一覧の口の答えの番号（403 など）。既定 200 */
  devicesStatus: number;
  /** この回数より後の PC の一覧の答えは「つながっている 1 台」（待っている → つながったを作る） */
  liveAfter: number | null;
}
const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });
const never = () => new Promise<never>(() => undefined);

async function mockApi(page: Page, o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = { reads: {}, devices: [], holdDevices: false, devicesStatus: 200, liveAfter: null, ...o };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  // 本人の Bridge に届かせない（この PC に Bridge が無い扱い）
  await page.route(/127\.0\.0\.1:38617/, (route) => route.abort("connectionrefused"));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    m.reads[p] = (m.reads[p] ?? 0) + 1;
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/auth/get-session")
      r = {
        status: 200,
        body: {
          session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
          user: { id: ME, email: "me@example.com", name: "高本", emailVerified: true },
        },
      };
    else if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/scopes") r = ok([], { limit: 200, writable: [] });
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 20, counts: { total: 2 }, cursor: null });
    else if (p === "/api/v1/bridge/devices") {
      if (m.holdDevices) return never();
      const n = m.reads[p] ?? 0;
      const list = m.liveAfter !== null && n > m.liveAfter ? [{ state: "live" as const }] : m.devices;
      r =
        m.devicesStatus !== 200
          ? { status: m.devicesStatus, body: { error: "forbidden", code: "FORBIDDEN" } }
          : ok(
              list.map((d, i) => ({
                id: `d${i}`,
                device_label: "高本の MacBook",
                state: d.state,
                last_seen_at: "2026-11-15T00:00:00Z",
                version: "1.4.0",
              })),
            );
    } else if (p === "/api/v1/bridge/pairing-codes" && req.method() === "POST")
      r = { status: 201, body: { data: { code: "KQ7M2X", expires_at: new Date(Date.now() + 600_000).toISOString() } } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(page.locator(".k-shell")).toBeVisible();
  await expect(page.locator(`${BODY} h1`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const rect = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const subItem = (page: Page, name: string) => page.locator(SUB).getByRole("link", { name, exact: true });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("K220-UI-001 幅 1440：外枠（左のメニュー 216px）の中に入り、見出し「PC と使った量」は左上 (0,0) でなく左のメニューと第 2 ナビの右。h1 は 1 つ", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  const nav = page.getByRole("navigation", { name: "メニュー", exact: true });
  await expect(nav).toBeVisible();
  expect(Math.round((await nav.boundingBox())!.width)).toBe(216);
  const h = await rect(page, `${BODY} h1`);
  const sub = await rect(page, SUB);
  expect(h.x).toBeGreaterThanOrEqual(sub.x + sub.width);
  expect(h.y).toBeGreaterThan(48);
  await expect(page.locator(`${BODY} h1`)).toHaveText("PC と使った量");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("K220-UI-002 上の帯のいまの場所：「自分の設定 › PC と使った量」。自分の設定の画面はまだ無いので「自分の設定」は出すが押せない（role=link・aria-disabled・href なし・薄さ 0.55・押しても移らない）", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  const crumbs = page.getByRole("navigation", { name: "いまの場所" });
  await expect(crumbs).toHaveText(/自分の設定\s*›\s*PC と使った量/);
  const top = crumbs.getByRole("link", { name: "自分の設定" });
  await expect(top).toHaveAttribute("aria-disabled", "true");
  expect(await top.getAttribute("href")).toBeNull();
  expect(Number(await top.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(0.55, 2);
  await top.click({ force: true });
  await expect(page).toHaveURL(/\/setup\/bridge$/);
});

test("K220-UI-003 第 2 ナビ：見出し アカウント・分身・ワークスペースごと。項目は プロフィール・ログインと安全・PC と使った量・預けたログイン情報・知らせ の順で、PC と使った量 が今いる項目（aria-current=page・白い地・600）", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  const sub = page.locator(SUB);
  await expect(sub).toBeVisible();
  for (const h of ["アカウント", "分身", "ワークスペースごと"])
    await expect(sub.getByText(h, { exact: true })).toBeVisible();
  const names = (await sub.locator(".k-me-sub-t").allInnerTexts()).map((x) => x.trim());
  expect(names).toEqual(["プロフィール", "ログインと安全", "PC と使った量", "預けたログイン情報", "知らせ"]);
  expect(await sub.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(237, 240, 244)");
  expect(await sub.evaluate((e) => getComputedStyle(e).borderRightColor)).toBe("rgb(221, 226, 233)");
  const head = sub.locator(".k-me-sub-h").first();
  expect(await head.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  expect(await head.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(107, 117, 133)");
  const item = subItem(page, "ログインと安全");
  expect(Math.round((await item.boundingBox())!.height)).toBe(36);
  expect(await item.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  expect(await item.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  const cur = sub.locator('a[aria-current="page"]');
  await expect(cur).toHaveCount(1);
  expect(await cur.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(19, 27, 39)");
  expect(await cur.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none");
  await expect(cur).toContainText("PC と使った量");
  expect(await cur.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(WHITE);
  expect(await cur.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("600");
});

test("K220-UI-004 第 2 ナビの作った画面：ログインと安全は /mfa-setup、預けたログイン情報は /settings/credentials。押すとその画面が開く", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  await expect(subItem(page, "ログインと安全")).toHaveAttribute("href", "/mfa-setup");
  await expect(subItem(page, "預けたログイン情報")).toHaveAttribute("href", "/settings/credentials");
  await subItem(page, "ログインと安全").click();
  await expect(page).toHaveURL(/\/mfa-setup$/);
});

test("K220-UI-005 第 2 ナビのまだ無い画面（プロフィール・知らせ）：出すが押せない（aria-disabled・href なし・薄さ 0.55）。押しても Enter でも移らず、Tab で止まらない", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  for (const name of ["プロフィール", "知らせ"]) {
    const it = subItem(page, name);
    await expect(it, name).toHaveAttribute("aria-disabled", "true");
    expect(await it.getAttribute("href"), name).toBeNull();
    expect(Number(await it.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(0.55, 2);
    await it.click({ force: true });
    await expect(page, name).toHaveURL(/\/setup\/bridge$/);
    expect(await it.getAttribute("tabindex"), name).toBe("-1");
    await it.focus();
    await page.keyboard.press("Enter");
    await expect(page, name).toHaveURL(/\/setup\/bridge$/);
  }
});

test("K220-UI-006 預けたログイン情報の件数：本当の数を返す口が無いので数は出さない（項目の字に数字が無い）", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  const t = (await subItem(page, "預けたログイン情報").innerText()).trim();
  expect(t).toBe("預けたログイン情報");
  expect(t).not.toMatch(/\d/);
});

test("K220-UI-007 第 2 ナビの注：「アカウントは 1 人 1 つ。預けたログイン情報と知らせはワークスペースごと」は 11px で一番下", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  const note = page.locator(SUB).getByText("アカウントは 1 人 1 つ。預けたログイン情報と知らせはワークスペースごと");
  expect(await note.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  const last = await rect(page, `${SUB} a >> nth=-1`);
  expect((await note.boundingBox())!.y).toBeGreaterThan(last.y);
});

test("K220-UI-008 第 2 ナビの幅：1440 は 232px（項目の字が出る）・1023 は 64px（絵だけ・字は隠れる）・375 は本文の上のボタン 1 つ「自分の設定 › PC と使った量 ▾」（項目の列は隠れ、画面は溢れない・2026-11-18 代表の直し・K-350）", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page, 1440);
  expect(Math.round((await rect(page, SUB)).width)).toBe(232);
  await open(page, 1023);
  expect(Math.round((await rect(page, SUB)).width)).toBe(64);
  await expect(page.locator(`${SUB} .k-me-sub-t`).first()).toBeHidden();
  await open(page, 375);
  const s = await rect(page, SUB);
  const h = await rect(page, `${BODY} h1`);
  expect(s.y + s.height).toBeLessThanOrEqual(h.y);
  const pick = page.locator(SUB).getByRole("button", { name: "自分の設定の中を選ぶ" });
  await expect(pick).toBeVisible();
  await expect(pick).toHaveText("自分の設定 › PC と使った量 ▾");
  await expect(page.locator(`${SUB} .k-me-sub-t`).first()).toBeHidden();
  expect(await overflowX(page)).toBe(0);
});

test("K220-UI-009 本文の箱と見出し：箱は x 448・幅 956（中身の幅 900・余白はその外側）・padding 22px 28px・段の間 14px。見出しの行は帯にしない（地なし・下の線なし）、h1 は 20px・700、説明（キャンバスの字）は 12px・灰で h1 の右に並ぶ", async ({
  page,
}) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  expect(await css(page, BODY, "padding-top")).toBe("22px");
  expect(await css(page, BODY, "padding-left")).toBe("28px");
  expect(await css(page, BODY, "row-gap")).toBe("14px");
  expect(await css(page, BODY, "padding-right")).toBe("28px");
  expect(await css(page, BODY, "padding-bottom")).toBe("22px");
  const body = await rect(page, BODY);
  expect(Math.abs(body.x - 448), `本文の箱の左 ${body.x}（左のメニュー 216 と第 2 ナビ 232 の右）`).toBeLessThanOrEqual(
    2,
  );
  // キャンバスの section は box-sizing の指定が無い（content-box）ので、余白 28px×2 は中身の幅 900 の外側に付く（箱 956・中身 476〜1376）
  expect(Math.abs(body.width - 956), `本文の箱の幅 ${body.width}`).toBeLessThanOrEqual(2);
  const inner = await page
    .locator(BODY)
    .evaluate(
      (e) => e.clientWidth - parseFloat(getComputedStyle(e).paddingLeft) - parseFloat(getComputedStyle(e).paddingRight),
    );
  expect(Math.abs(inner - 900), `本文の中身の幅 ${inner}`).toBeLessThanOrEqual(2);
  const head = `${BODY} .k-page-head`;
  expect(await css(page, head, "background-color")).toBe("rgba(0, 0, 0, 0)");
  expect(await css(page, head, "border-bottom-width")).toBe("0px");
  expect(await css(page, `${head} h1`, "font-size")).toBe("20px");
  expect(await css(page, `${head} h1`, "font-weight")).toBe("700");
  const desc = page.locator(`${head} .k-desc`).first();
  await expect(desc).toHaveText("分身はあなたの PC で動く。どのワークスペースの分身も同じ PC を使う");
  expect(await desc.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await desc.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  const h = await rect(page, `${head} h1`);
  const d = (await desc.boundingBox())!;
  expect(d.x).toBeGreaterThan(h.x + h.width - 1);
});

test("K220-UI-010 外枠の口は 1 画面で 1 回ずつ（自分・承認待ちの数）。左のメニューの下の PC の状態は「つながっている」", async ({
  page,
}) => {
  const m = await mockApi(page, { devices: [{ state: "live" }] });
  await open(page);
  await expect(page.getByRole("navigation", { name: "メニュー", exact: true })).toContainText("PC つながっている");
  await expect.poll(() => m.reads["/api/auth-ext/me"] ?? 0).toBeGreaterThanOrEqual(1);
  expect(m.reads["/api/auth-ext/me"]).toBe(1);
  expect(m.reads["/api/v1/approvals/queue"] ?? 0).toBeLessThanOrEqual(1);
});

test("K220-UI-011 PC の一覧を読んでいる間（D-144.8）：外枠と見出し「PC と使った量」はすぐ出る。「読み込んでいます…」は 2.9 秒では出ず 3 秒を過ぎて出る", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-16T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-16T00:00:01Z")); // 実時間で進めない
  await mockApi(page, { holdDevices: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const asked = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/v1/bridge/devices");
  await page.goto("/setup/bridge");
  await asked;
  await expect(page.locator(".k-shell")).toBeVisible();
  await expect(page.locator(`${BODY} h1`)).toHaveText("PC と使った量");
  await page.clock.runFor(2900);
  await expect(page.getByText("読み込んでいます")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.locator(BODY).getByText("読み込んでいます…")).toBeVisible();
});

test("K220-UI-012 幅 320・375・768・1024・1440：横溢れ 0・見出しの 1 文字目が画面の中", async ({ page }) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await open(page, w);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：横溢れ ${o}px`);
    const left = await page.locator(`${BODY} h1`).evaluate((e) => {
      const r = document.createRange();
      r.setStart(e.firstChild!, 0);
      r.setEnd(e.firstChild!, 1);
      return r.getBoundingClientRect().left;
    });
    if (left < 0) bad.push(`幅 ${w}：見出しの 1 文字目が左に切れる`);
  }
  expect(bad).toEqual([]);
});

// K-367：前の画面への導線（「前の設定の画面」のリンク）を消したので、本文の一番下の物（本文の中で下の端がいちばん下の、大きさのある要素）で見る。
//   導線が在っても無くても同じ形で通る
test("K220-UI-013 幅 375：本文の一番下まで送ると、本文の一番下の物が下のタブに隠れない", async ({ page }) => {
  await mockApi(page, { devices: [{ state: "live" }] });
  await open(page, 375);
  await expect(page.locator(`${BODY} h1`)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const tabs = page.getByRole("navigation", { name: "下のタブ" });
  await expect(tabs).toBeVisible();
  const t = (await tabs.boundingBox())!;
  const bottom = await page.locator(BODY).evaluate((root) =>
    Math.max(
      ...[...root.querySelectorAll("*")]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 1 && r.height > 1) // 読み上げだけの 1px の物（sr-only）は見た目に無いので外す
        .map((r) => r.bottom),
    ),
  );
  expect(bottom).toBeGreaterThan(0);
  // 文書の高さは整数に丸められ、本文の高さが端数だと最後の 1px 未満までは送れない。被りは 1px からを数える（K-1114・K138-SH-019 と同じ）
  expect(bottom).toBeLessThan(t.y + 1);
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
const G = CFG.groups.find((x) => x.id === "bridge-shell");

test("K220-UI-014 突き合わせの設定：bridge-shell が enrolled・持ち主 K-220・第 2 ナビの字の一覧はデータの数（預けたログイン情報の 5）を含まない字の箱どうしで比べる・鍵が在る", () => {
  expect(G).toBeTruthy();
  expect(G!.enrolled).toBe(true);
  expect(G!.owner).toBe("K-220");
  const sub = G!.pairs.find((p) => p.role === "subnav")!;
  expect(sub.props).toContain("texts");
  expect(sub.canvas).toContain(".kn-sub-t");
  expect(sub.app).toContain(".k-me-sub-t");
  expect(FIDELITY_STATES[G!.state]).toBeTruthy();
});

for (const w of G?.widths ?? [1440]) {
  test(`K220-UI-015 bridge-shell（MePC）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
    expect(G).toBeTruthy();
    const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    await routeCanvasFonts(canvasPage);
    await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${G!.canvas}.dc.html`)).href);
    for (const p of G!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
    await canvasPage.evaluate(() => document.fonts.ready);
    const canvasVals = await readVals(canvasPage, G!.pairs, "canvas");
    const canvasFonts = await loadedFonts(canvasPage);
    await canvasPage.close();

    const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    await appPage.route(/127\.0\.0\.1:38617/, (route) => route.abort("connectionrefused"));
    await FIDELITY_STATES[G!.state]!(appPage, G!.app);
    for (const p of G!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
    await appPage.evaluate(() => document.fonts.ready);
    const appVals = await readVals(appPage, G!.pairs, "app");
    const appFonts = await loadedFonts(appPage);
    await appPage.close();

    const rows = [...compareRows(G!.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
    const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
    expect(mismatches(rows), bad.join("\n")).toBe(0);
  });
}

test("K220-UI-016 この画面で PC がつながったら（待っている → つながっている）、左のメニューの PC の状態も「PC つながっている」に変わる（外枠は口を読み直さず、画面の答えを渡す）", async ({
  page,
}) => {
  const m = await mockApi(page, { devices: [{ state: "waiting" }], liveAfter: 1 });
  await page.clock.install();
  await open(page);
  // 待っている PC だけのときは K-230 のつなぐ小窓が開き、開いている間は後ろ（左のメニュー）が読み上げの木から外れる。「あとで」で閉じてから見る
  await page.getByRole("dialog", { name: "PC をつなぐ" }).getByRole("button", { name: "あとで" }).click();
  await expect(page.getByRole("dialog", { name: "PC をつなぐ" })).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "メニュー", exact: true });
  await expect(nav).not.toContainText("PC つながっている");
  await page.clock.fastForward(6_000);
  await expect(nav).toContainText("PC つながっている");
  expect(m.reads["/api/auth-ext/me"]).toBe(1);
});

test("K220-UI-017 PC の一覧の口が 403（権限なし）：外枠の中に「この画面を見る権限がありません」が出る（外枠の外に出さない）", async ({
  page,
}) => {
  await mockApi(page, { devicesStatus: 403 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge");
  await expect(page.getByRole("heading", { name: /この画面を見る権限がありません/ })).toBeVisible();
  await expect(page.locator(".k-shell")).toBeVisible();
  await expect(page.locator(".k-shell").getByRole("heading", { name: /この画面を見る権限がありません/ })).toBeVisible();
});
