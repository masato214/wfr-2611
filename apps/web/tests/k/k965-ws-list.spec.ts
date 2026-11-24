// K-965「運営のワークスペースの一覧の画面（/ops）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops/op-list・op-list-empty（この葉が持ち主）。部品は features/F12/ops/views-list.tsx（K-941 が運ぶ）。
//   呼ぶ口：getOpsShell（上の数・K-946 の外枠と同じ鍵）・listOpsWorkspaces（一覧・K-963）。口は網の手前で差し替える（ops-mock.ts）。
//   絞り込み・探す・並びは URL に持つ（view・plan・sort・q。既定の値は書かない）。運営のログインは仮の認証器で通す（K-946 と同じ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-965.md の表と 1 対 1
import { expect, test, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, signInOps, shellOf, WS_A, type OpsMock } from "./ops-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 一覧の本文の役（外枠は比べない＝K-946 の受け持ち） */
const LIST_PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", [...BOX, "texts"]),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("sub", ".k-page-sub", ["x", ...TEXT]),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("stat", ".k-op-stat", [...BOX, "texts"]),
  pair("chip", ".k-op-chip", ["width", "height", "x", "y", "color", "background-color", "texts"]),
  pair("find", ".k-op-find", BOX),
  pair("table", ".k-f12-rt-table", [...BOX, "texts"]),
  pair("card", ".k-f12-rt-card", [...BOX, "texts"]),
  pair("empty", "main [role='status'], .k-empty", ["x", "width", ...TEXT]),
  pair("note", ".k-op-note-text", ["x", ...TEXT]),
];
const LIST = "/api/v1/ops/workspaces";
const lists = (m: OpsMock) => m.calls.filter((c) => c.startsWith(`GET ${LIST}`));
const shells = (m: OpsMock) => m.calls.filter((c) => c.startsWith("GET /api/v1/ops/shell"));
const rowsShown = (page: Page) => page.locator(".k-f12-rt-table tbody tr");
const chip = (page: Page, name: string) => page.locator(".k-op-chip").filter({ hasText: new RegExp(`^${name}\\d*$`) });

async function open(page: Page, baseURL: string | undefined, next = "/ops", width = 1440): Promise<OpsMock> {
  const m = await mockOps(page);
  await signInOps(page, local(baseURL), next, width);
  await expect(page.locator(".k-page-head h1")).toHaveText("ワークスペース");
  return m;
}

test.describe("K-965 一覧の見た目", () => {
  for (const w of MATCH_WIDTHS)
    test(`K965-UI-001 一覧がモック op-list と同じ（幅 ${w}・見出し・上の数・絞り込み・表か組・注）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-list",
        w,
        async (page) => void (await open(page, baseURL, "/ops", w)),
        {
          base: "/dev/mock/f12-ops",
          pairs: LIST_PAIRS,
        },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });

  for (const w of MATCH_WIDTHS)
    test(`K965-UI-002 探して 0 件がモック op-list-empty と同じ（幅 ${w}・「ほしの」に合うワークスペースはありません）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-list-empty",
        w,
        async (page) => {
          const m = await mockOps(page);
          m.on.list = () => ({ status: 200, body: { data: [] } });
          await signInOps(page, local(baseURL), `/ops?q=${encodeURIComponent("ほしの")}`, w);
          await expect(page.getByText("「ほしの」に合うワークスペースはありません", { exact: true })).toBeVisible();
        },
        { base: "/dev/mock/f12-ops", pairs: LIST_PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
});

test.describe("K-965 一覧の動き", () => {
  test("K965-UI-003 開く：外枠の口と一覧の口を 1 回ずつ（既定の値は問い合わせに書かない）・8 行・見出しの下に「・ 48」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await expect(rowsShown(page)).toHaveCount(8);
    expect(lists(m)).toEqual([`GET ${LIST}`]);
    expect(shells(m).length).toBe(1);
    await expect(page.locator(".k-page-sub")).toHaveText("Kaname を使っているワークスペース ・ 48");
  });

  test("K965-UI-004 名前を押すとその 1 社の画面の道（/ops/tenants/<id>）に移る", async ({ page, baseURL }) => {
    await open(page, baseURL);
    const link = page.getByRole("link", { name: "合同会社ミナト企画", exact: true });
    await expect(link).toHaveAttribute("href", `/ops/tenants/${WS_A[0]!.id}`);
    await link.click();
    await page.waitForURL(new RegExp(`/ops/tenants/${WS_A[0]!.id}$`));
  });

  test("K965-UI-005 「気にかける」を押す：URL が ?view=attention・押した印・一覧の口を view=attention で 1 回。もう一度「すべて」で戻る", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.list = (q) => ({
      status: 200,
      body: { data: q.get("view") === "attention" ? WS_A.filter((r) => r.attention.length > 0) : WS_A },
    });
    await chip(page, "気にかける").click();
    await page.waitForURL(/\/ops\?view=attention$/);
    await expect(chip(page, "気にかける")).toHaveAttribute("aria-pressed", "true");
    await expect(rowsShown(page)).toHaveCount(3);
    expect(lists(m).at(-1)).toBe(`GET ${LIST}?view=attention`);
    await chip(page, "すべて").click();
    await page.waitForURL(/\/ops$/);
    await expect(rowsShown(page)).toHaveCount(8);
  });

  test("K965-UI-006 プランを押す：?plan=team で一覧の口に plan=team。同じプランをもう一度押すと外れる", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await chip(page, "チーム").click();
    await page.waitForURL(/\/ops\?plan=team$/);
    expect(lists(m).at(-1)).toBe(`GET ${LIST}?plan=team`);
    await chip(page, "チーム").click();
    await page.waitForURL(/\/ops$/);
  });

  test("K965-UI-007 探す：欄に書いて Enter で ?q=…・一覧の口に q。前後の空白は落とす", async ({ page, baseURL }) => {
    const m = await open(page, baseURL);
    const box = page.getByLabel("探す", { exact: true });
    await box.fill("  ミナト  ");
    await box.press("Enter");
    await page.waitForURL((u) => u.searchParams.get("q") === "ミナト");
    expect(m.listQueries.at(-1)?.get("q")).toBe("ミナト");
  });

  test("K965-UI-008 並びを「人数」に：?sort=members で一覧の口に sort=members", async ({ page, baseURL }) => {
    const m = await open(page, baseURL);
    await page.getByLabel("並び", { exact: true }).selectOption({ label: "人数" });
    await page.waitForURL(/\/ops\?sort=members$/);
    expect(m.listQueries.at(-1)?.get("sort")).toBe("members");
  });

  test("K965-UI-009 URL を直に開く（?view=stopped&q=ハル）：止めている が押した印・探す欄に「ハル」・一覧の口は両方の値で 1 回だけ", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `/ops?view=stopped&q=${encodeURIComponent("ハル")}`);
    await expect(chip(page, "止めている")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("探す", { exact: true })).toHaveValue("ハル");
    expect(lists(m).length).toBe(1);
    expect([m.listQueries[0]!.get("view"), m.listQueries[0]!.get("q")]).toEqual(["stopped", "ハル"]);
  });

  test("K965-UI-010 0 件の「探す欄を空にする」を押す：URL から q が消え、一覧の口を q なしで呼び直す", async ({
    page,
    baseURL,
  }) => {
    const m = await mockOps(page);
    m.on.list = (q) => ({ status: 200, body: { data: q.get("q") ? [] : WS_A } });
    await signInOps(page, local(baseURL), `/ops?q=${encodeURIComponent("ほしの")}`);
    await page.getByRole("button", { name: "探す欄を空にする", exact: true }).click();
    await page.waitForURL(/\/ops$/);
    await expect(rowsShown(page)).toHaveCount(8);
    expect(lists(m).at(-1)).toBe(`GET ${LIST}`);
  });

  test("K965-UI-011 知らない値の URL（?view=gone&sort=name）：既定に戻して一覧の口を値なしで呼ぶ（422 を出させない）", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, "/ops?view=gone&sort=name");
    await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "true");
    expect(lists(m)).toEqual([`GET ${LIST}`]);
  });
});

test.describe("K-965 失敗と守り", () => {
  test("K965-UI-012 一覧の口が 503・外枠の口が網の切れ：本文は読めなかった旨（E-PAGE-007）と「もう一度」。押すと両方を読み直して一覧が出る", async ({
    page,
    baseURL,
  }) => {
    const m = await mockOps(page);
    let fail = true;
    m.on.list = () => (fail ? { status: 503, body: { code: "E-PAGE-003" } } : { status: 200, body: { data: WS_A } });
    await signInOps(page, local(baseURL));
    await expect(page.locator('[data-code="E-PAGE-007"]')).toBeVisible();
    await expect(rowsShown(page)).toHaveCount(0);
    fail = false;
    await page.getByRole("button", { name: "もう一度", exact: true }).click();
    await expect(rowsShown(page)).toHaveCount(8);
    expect(lists(m).length).toBe(2);
  });

  test("K965-UI-013 お金を持たない運営の人（invoices が null）：期限を過ぎた請求の数は「—」で、金額を出さない", async ({
    page,
    baseURL,
  }) => {
    const m = await mockOps(page);
    m.on.shell = () => ({ status: 200, body: { data: shellOf({ invoices: null }) } });
    await signInOps(page, local(baseURL));
    const stat = page.locator(".k-op-stat").filter({ hasText: "期限を過ぎた請求" });
    await expect(stat.locator(".k-op-stat-value")).toHaveText("—");
    await expect(stat).not.toContainText("¥");
  });

  test("K965-UI-014 幅：320・375・768・1024・1440 で横のはみ出しが 0 以下（表は置き場の幅で組に変わる）", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    }
  });

  test("K965-UI-015 字の守り：HTML の入った名前が字のまま出て、スクリプトが動かない", async ({ page, baseURL }) => {
    const m = await mockOps(page);
    const evil = '<img src=x onerror="window.__k965=1">悪い名前';
    m.on.list = () => ({ status: 200, body: { data: [{ ...WS_A[0]!, name: evil }] } });
    await signInOps(page, local(baseURL));
    await expect(page.getByRole("link", { name: evil, exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k965?: number }).__k965)).toBeUndefined();
  });

  test("K965-UI-016 出してはいけない字：取引先・業務の型・書き出し・CSV が本文に無く、書き出すボタンも無い（D-156.13・D-156.16）", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
    await expect(page.getByRole("button", { name: /書き出/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /書き出/ })).toHaveCount(0);
  });
});
