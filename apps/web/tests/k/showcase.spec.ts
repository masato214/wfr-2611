// 見本の画面（/dev/k/showcase）の操作：操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/showcase.md）＝試験 1 本（K-36）
//   新しい画面の試験はこの書き方（row(R["行 ID"], async (page) => …)）で書く
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../_lib/row";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../07_qa/test-specs/k/showcase.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));

const open = async (page: Page, tab?: "4 つの状態とエラー") => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const res = await page.goto("/dev/k/showcase");
  expect(res?.status()).toBe(200);
  await expect(page.locator(".k-shell")).toBeVisible();
  if (tab) await page.getByRole("tablist", { name: "見本の中" }).getByRole("tab", { name: tab }).click();
};
const nav = (page: Page) => page.getByRole("navigation", { name: "メニュー", exact: true });
const bar = (page: Page) => page.locator(".k-bar");
const toast = (page: Page, text: string) => page.locator(".k-toast").filter({ hasText: text });
// タブの中身。切り替えの動きの間は前の中身（inert）も一瞬並ぶので、inert でないものだけを見る（K-113）
const parts = (page: Page) => page.getByRole("tabpanel").and(page.locator(":not([inert])"));

row(R["KSC-00-001"], async (page) => {
  await open(page);
  expect(await missingRows(page, ROWS), "部品のタブ").toEqual([]);
  await page.getByRole("tablist", { name: "見本の中" }).getByRole("tab", { name: "4 つの状態とエラー" }).click();
  expect(await missingRows(page, ROWS), "4 つの状態のタブ").toEqual([]);
});

// ---- 外枠（左のバー） ----
row(R["KSC-01-001"], async (page) => {
  await open(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "本文へ" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#k-main")).toBeFocused();
});
row(R["KSC-01-002"], async (page) => {
  await open(page);
  await page.getByRole("button", { name: "メニューを畳む" }).click();
  await expect.poll(() => nav(page).evaluate((e) => e.getBoundingClientRect().width)).toBe(56);
  await page.reload();
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect.poll(() => nav(page).evaluate((e) => e.getBoundingClientRect().width)).toBe(216);
});
row(R["KSC-01-003"], async (page) => {
  await open(page);
  await nav(page).getByRole("button", { name: "チケットを作る" }).click();
  await expect(toast(page, "チケットを作る（見本）")).toBeVisible();
});
const navLink = (id: string, name: RegExp, href: string, extra?: (p: Page) => Promise<void>) =>
  row(R[id], async (page) => {
    await open(page);
    const l = nav(page).getByRole("link", { name });
    await expect(l).toBeVisible();
    await expect(l).toHaveAttribute("href", href);
    if (extra) await extra(page);
  });
navLink("KSC-01-004", /^チケット/, "/tickets", async (p) =>
  expect(nav(p).getByRole("link", { name: /^チケット/ })).toHaveAttribute("aria-current", "page"),
);
navLink("KSC-01-005", /^承認待ち/, "/approvals", async (p) =>
  expect(nav(p).getByRole("link", { name: /承認待ち/ })).toContainText("2"),
);
navLink("KSC-01-006", /^高本のAI/, "/ai/chat");
navLink("KSC-01-007", /^ナレッジ/, "/knowledge");
navLink("KSC-01-008", /^取引先/, "/clients");
navLink("KSC-01-009", /^営業/, "#eg", async (p) =>
  expect(nav(p).getByRole("link", { name: /^営業/ })).toContainText("18"),
);
navLink("KSC-01-010", /^受託開発/, "#jd", async (p) =>
  expect(nav(p).getByRole("link", { name: /^受託開発/ })).toContainText("42"),
);
navLink("KSC-01-011", /^経理/, "#kr", async (p) =>
  expect(nav(p).getByRole("link", { name: /^経理/ })).toContainText("9"),
);
row(R["KSC-01-012"], async (page) => {
  await open(page);
  const href = await nav(page)
    .getByRole("link", { name: /ワークスペースの管理/ })
    .getAttribute("href");
  expect(href, "R1 が入れる画面（会社を作った人もメンバーの画面へ・D-148.49・K-420）").toBe("/members");
});
// まだ使えない小さな印（会社の切り替え ▾・グループの ★）：押しても何も起きない（K-138）
const inert = (id: string, name: string) =>
  row(R[id], async (page) => {
    await open(page);
    const b = nav(page).getByRole("button", { name, disabled: true });
    await expect(b).toBeVisible();
    expect(await b.evaluate((e) => getComputedStyle(e).opacity)).toBe("0.55");
    const before = page.url();
    await b.click({ force: true });
    await b.focus();
    await page.keyboard.press("Enter");
    expect(page.url()).toBe(before);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
inert("KSC-01-013", "会社を切り替える（準備中）");
inert("KSC-01-014", "グループの★（準備中）");

// ---- 外枠（上の帯） ----
row(R["KSC-02-001"], async (page) => {
  await open(page);
  const crumbs = page.getByRole("navigation", { name: "いまの場所" });
  await expect(crumbs.getByRole("link", { name: "チケット" })).toHaveAttribute("href", "/tickets");
  await expect(crumbs.getByText("見本")).toHaveAttribute("aria-current", "page");
});
row(R["KSC-02-002"], async (page) => {
  await open(page);
  const box = page.getByRole("searchbox", { name: "探す" });
  await box.fill("請求");
  await box.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "「請求」を探す" })).toBeVisible();
});
row(R["KSC-02-003"], async (page) => {
  await open(page);
  await bar(page).getByRole("button", { name: "知らせ（3 件）" }).click();
  await expect(toast(page, "知らせを開く（見本）")).toBeVisible();
});
row(R["KSC-02-004"], async (page) => {
  await open(page);
  await page.getByRole("button", { name: "自分のメニュー" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "自分の設定" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "ログアウト" })).toBeVisible();
  await expect(menu.getByRole("radio", { name: "暗い" })).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
row(R["KSC-02-005"], async (page) => {
  await open(page);
  const before = await page.locator("#k-main").evaluate((e) => e.getBoundingClientRect().width);
  await page.getByRole("button", { name: "自分の AI のパネルを閉じる" }).click();
  await expect(page.getByRole("complementary", { name: "自分の AI" })).toBeHidden();
  await expect(page.getByRole("button", { name: "自分の AI のパネルを開く" })).toBeVisible();
  expect(await page.locator("#k-main").evaluate((e) => e.getBoundingClientRect().width)).toBeGreaterThan(before);
});
row(R["KSC-02-006"], async (page) => {
  await open(page, "4 つの状態とエラー");
  await page.getByRole("tablist", { name: "見本の中" }).getByRole("tab", { name: "部品" }).click();
  await expect(parts(page).getByRole("button", { name: "保存する" })).toBeVisible();
});
row(R["KSC-02-007"], async (page) => {
  await open(page, "4 つの状態とエラー");
  await expect(page.getByRole("heading", { name: "まだチケットがありません" })).toBeVisible();
});

// ---- 部品 ----
const theme = (id: string, label: string, attr: string | null) =>
  row(R[id], async (page) => {
    await open(page);
    await parts(page).locator(".k-theme label", { hasText: label }).click();
    if (attr) await expect(page.locator("html")).toHaveAttribute("data-theme", attr);
    else await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });
theme("KSC-03-001", "システム", null);
theme("KSC-03-002", "明るい", "light");
row(R["KSC-03-003"], async (page) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  const bg = () => page.locator(".k-shell").evaluate((e) => getComputedStyle(e).backgroundColor);
  const light = await bg();
  await parts(page).locator(".k-theme label", { hasText: "暗い" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bg()).not.toBe(light);
});
row(R["KSC-03-004"], async (page) => {
  await open(page);
  const b = parts(page).getByRole("button", { name: "保存する" });
  await b.click();
  await expect(b).toHaveAttribute("aria-busy", "true");
  await expect(b).toBeDisabled();
  await expect(b).not.toHaveAttribute("aria-busy", "true", { timeout: 5000 });
});
const plain = (id: string, name: string) =>
  row(R[id], async (page) => {
    await open(page);
    const b = parts(page).getByRole("button", { name, exact: true });
    await expect(b).toBeEnabled();
    await b.click();
    await expect(b).toBeVisible();
  });
plain("KSC-03-005", "下書き");
plain("KSC-03-006", "共有する");
plain("KSC-03-007", "あとで");
row(R["KSC-03-008"], async (page) => {
  await open(page);
  await parts(page).getByRole("button", { name: "消す", exact: true }).click();
  const dlg = page.getByRole("alertdialog", { name: "チケットを消しますか" });
  await dlg.getByRole("button", { name: "やめる" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByText("消しました")).toHaveCount(0);
  await parts(page).getByRole("button", { name: "消す", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "消す" }).click();
  await expect(page.getByRole("status").filter({ hasText: "消しました" })).toBeVisible();
});
row(R["KSC-03-009"], async (page) => {
  await open(page);
  const b = parts(page).getByRole("button", { name: "小さい" });
  expect(await b.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(28);
  await b.click();
});
row(R["KSC-03-010"], async (page) => {
  await open(page);
  await expect(parts(page).getByRole("button", { name: "押せない" })).toBeDisabled();
});
row(R["KSC-03-011"], async (page) => {
  await open(page);
  await parts(page).getByRole("button", { name: "確かめる" }).click();
  const t = parts(page).getByRole("textbox", { name: "件名" });
  await expect(t).toHaveAttribute("aria-invalid", "true");
  await expect(t).toHaveAccessibleDescription(/件名を入れてください/);
});
row(R["KSC-03-012"], async (page) => {
  await open(page);
  const t = parts(page).getByRole("textbox", { name: "中身" });
  await t.fill("1 行目\n2 行目");
  await expect(t).toHaveValue("1 行目\n2 行目");
});
row(R["KSC-03-013"], async (page) => {
  await open(page);
  const c = parts(page).getByRole("combobox", { name: "種類" });
  await c.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "会議" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: "課題" }).click();
  await expect(c).toHaveText(/課題/);
});
row(R["KSC-03-014"], async (page) => {
  await open(page);
  const t = parts(page).getByRole("textbox", { name: "件名" });
  await parts(page).getByRole("button", { name: "確かめる" }).click();
  await t.fill("見積");
  await parts(page).getByRole("button", { name: "確かめる" }).click();
  await expect(t).not.toHaveAttribute("aria-invalid", "true");
});
const innerTab = (id: string, name: string, text: string) =>
  row(R[id], async (page) => {
    await open(page);
    const list = page.getByRole("tablist", { name: "チケットの中" });
    await list.getByRole("tab", { name }).click();
    await expect(list.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name, exact: true }).getByText(text)).toBeVisible();
  });
innerTab("KSC-03-015", "中身", "中身のタブ");
innerTab("KSC-03-016", "記録", "記録のタブ");
innerTab("KSC-03-017", "ファイル", "ファイルのタブ");
row(R["KSC-03-018"], async (page) => {
  await open(page);
  await expect(page.getByRole("tablist", { name: "チケットの中" }).getByRole("tab", { name: "まだ" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});
row(R["KSC-03-019"], async (page) => {
  await open(page);
  await parts(page).getByRole("button", { name: "知らせを出す" }).click();
  await expect(toast(page, "コピーしました")).toBeVisible();
});
row(R["KSC-03-020"], async (page) => {
  await open(page);
  await parts(page).getByRole("button", { name: "失敗の知らせ" }).click();
  const t = toast(page, "保存できませんでした");
  await expect(t).toBeVisible();
  await t.getByRole("button", { name: "閉じる" }).click();
  await expect(t).toBeHidden();
});
row(R["KSC-03-021"], async (page) => {
  await open(page);
  const opener = parts(page).getByRole("button", { name: "ダイアログを開く" });
  await opener.click();
  await expect(page.getByRole("dialog", { name: "共有の相手" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});

// ---- 4 つの状態とエラー ----
row(R["KSC-04-001"], async (page) => {
  await open(page, "4 つの状態とエラー");
  await parts(page).getByRole("button", { name: "チケットを作る" }).click();
  await expect(page.getByRole("status").filter({ hasText: "作る（見本 1）" })).toBeVisible();
});
row(R["KSC-04-002"], async (page) => {
  await open(page, "4 つの状態とエラー");
  const b = parts(page).getByRole("button", { name: "もう一度" });
  await b.click();
  await expect(page.getByRole("status").filter({ hasText: "作る（見本 1）" })).toBeVisible();
});
row(R["KSC-04-003"], async (page) => {
  await open(page, "4 つの状態とエラー");
  await parts(page).getByRole("button", { name: "マネージャーに頼む" }).click();
  await expect(page.getByRole("status").filter({ hasText: "頼みました（見本）" })).toBeVisible();
});
row(R["KSC-04-004"], async (page) => {
  await open(page, "4 つの状態とエラー");
  await expect(parts(page).getByRole("link", { name: "戻る" })).toHaveAttribute("href", "/dev/k");
});
const PAGES: [string, string, string][] = [
  ["KSC-04-005", "notFound", "見つかりませんでした。"],
  ["KSC-04-006", "forbidden", "この画面を見る権限がありません。"],
  ["KSC-04-007", "down", "Kaname の調子が悪くなっています。"],
  ["KSC-04-008", "maintenance", "いまメンテナンス中です。"],
  ["KSC-04-009", "sessionExpired", "ログインが切れました。"],
  ["KSC-04-010", "linkExpired", "このリンクは使えなくなりました。"],
  ["KSC-04-011", "loadFailed", "読み込めませんでした。"],
  ["KSC-04-012", "offline", "オフラインです。"],
];
for (const [id, name, h1] of PAGES)
  row(R[id], async (page) => {
    await open(page, "4 つの状態とエラー");
    await parts(page).getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
  });
