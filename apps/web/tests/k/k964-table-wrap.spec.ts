// K-964「共通の表の箱 .k-table-wrap を位置の基準にする（表の中の読み上げ用の字が箱の外へ逃げて、狭い幅でページを広げるのを止める）」の試験
//   （ファイルを読む試験と実 Chrome・実装より先に積む）。
//   的：部品の見本 /dev/k（表「チケット（3 件）」が 1 つ在る・口を呼ばない）。
//   見ること：k.css の .k-table-wrap が position: relative を持つ・狭い幅で表が箱より広くなり、表の中に読み上げ用の字（.sr-only・absolute）が在っても、
//   はみ出しは箱の中のスクロールに留まり、ページ（document）は横に広がらない・広い幅でも同じ。
//   表を箱より広くする字と読み上げ用の字は、試験が見本の表に足す（見本の画面のファイルは変えない）。テストはチケットを作る人が書き、実装する人は変えない
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const K_CSS = join(HERE, "../../components/k/k.css");
const noComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "");

async function open(page: Page, width: number): Promise<void> {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto("/dev/k");
  expect(res?.status()).toBe(200);
  await expect(page.locator(".k-table-wrap").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 見本の表の 1 行目の最初の欄に折らない長い字を、最後の欄の後ろに読み上げ用の字を足し、表を箱より広くする */
async function widen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const table = document.querySelector(".k-table-wrap table");
    const first = table?.querySelector("tbody tr td");
    const last = table?.querySelector("tbody tr td:last-child");
    if (!first || !last) throw new Error("見本の表が無い");
    const wide = document.createElement("span");
    wide.style.whiteSpace = "nowrap";
    wide.textContent = "とても長い件名".repeat(30);
    first.append(wide);
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = "読み上げ用の字";
    last.append(sr);
  });
}

const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("K964-CS-001 k.css の .k-table-wrap の規則が position: relative と overflow-x: auto を持つ", () => {
  const css = noComments(readFileSync(K_CSS, "utf8"));
  const rule = /(^|\n)\.k-table-wrap\s*\{([^}]*)\}/.exec(css);
  expect(rule, "k.css に .k-table-wrap の規則が無い").not.toBeNull();
  expect(rule![2]).toMatch(/(^|;|\s)position:\s*relative\s*;/);
  expect(rule![2]).toMatch(/overflow-x:\s*auto\s*;/);
});

test("K964-UI-001 幅 375：見本の表の箱は位置の基準（position が relative）で、横のスクロールは箱が持つ（overflow-x が auto）", async ({
  page,
}) => {
  await open(page, 375);
  const wrap = page.locator(".k-table-wrap").first();
  expect(await wrap.evaluate((el) => getComputedStyle(el).position)).toBe("relative");
  expect(await wrap.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
});

test("K964-UI-002 幅 375：表が箱より広く、表の中に読み上げ用の字が在っても、ページは横に広がらず（はみ出し 0）、はみ出しは箱の中のスクロールになる", async ({
  page,
}) => {
  await open(page, 375);
  await widen(page);
  const wrap = page.locator(".k-table-wrap").first();
  const inner = await wrap.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(inner, "表が箱より広くなっていない（試験の前提が崩れている）").toBeGreaterThan(0);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});

test("K964-UI-003 幅 1440：同じく表を箱より広くしても、ページは横に広がらない（はみ出し 0）", async ({ page }) => {
  await open(page, 1440);
  await widen(page);
  const wrap = page.locator(".k-table-wrap").first();
  expect(await wrap.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});
