// K-725：web の前の記憶の画面を外した後の、実ブラウザでの確かめ（ファイルと字の確かめは test/k725-memory-ui-retire.test.ts）。
// 本物の API と DB につなぐ。Bridge は使わない（本人の Bridge に触れない）。行 ID は md の行の表（K725-UI-）
import { expect, test, type Page } from "@playwright/test";
import { loginAs, setupStep, signupViaApi } from "../_lib/api";

async function ready(page: Page) {
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  return u;
}

test("K725-UI-001 前の記憶の頁 /dev/memory は開けず、見つからない（404）", async ({ page }) => {
  await ready(page);
  const res = await page.goto("/dev/memory");
  expect(res?.status()).toBe(404);
  await expect(page.locator('[data-digest], [data-part="memory-reviews"]')).toHaveCount(0);
});

test("K725-UI-002 設定の見本の頁 /dev/ai-settings は 3 つの部品だけを出し、記憶のまとめと確認待ちは出ない", async ({
  page,
}) => {
  await ready(page);
  const res = await page.goto("/dev/ai-settings");
  expect(res?.status()).toBe(200);
  await expect(page.locator('[data-part="always-allow"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-part="usage"]')).toBeVisible();
  await expect(page.locator('[data-notify="done"]')).toBeVisible();
  await expect(page.locator("[data-digest-start]")).toHaveCount(0);
  await expect(page.locator("[data-digest='pending'], [data-digest='result']")).toHaveCount(0);
  await expect(page.locator('[data-part="memory-reviews"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "AI まわりの設定（見本）", exact: true })).toBeVisible();
});

test("K725-UI-003 設定の見本の頁を開いても、旧い記憶の道（/agent/memory）を 1 度も呼ばない", async ({ page }) => {
  await ready(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/agent/memory")) calls.push(`${r.method()} ${r.url()}`);
  });
  await page.goto("/dev/ai-settings");
  await expect(page.locator('[data-part="usage"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-part="always-allow"]')).toBeVisible();
  expect(calls, "呼ばれた記憶の道").toEqual([]);
});

test("K725-UI-004 ログインしていない人は設定の見本の頁の代わりにログインの画面へ送られ、部品は 1 つも出ない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/dev/ai-settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fdev%2Fai-settings/, { timeout: 15_000 });
  await expect(page.locator('[data-part="always-allow"], [data-part="usage"], [data-notify="done"]')).toHaveCount(0);
});
