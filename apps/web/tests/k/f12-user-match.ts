// 利用者の側の画面（段 13：K-956・K-953・K-1007・K-957・K-1008）の見た目の突き合わせの道具（K-956 が持ち込む）：
//   モック /dev/mock/f12-user/<状態> と本番の画面を同じ幅で開き、同じ役の要素の値を比べる。比べ方は段 10 の f9-ws-match.ts と同じ
//   （scripts/ci/fidelity_compare.mjs の readVals・compareRows）。外枠（左のバー・頭）は比べない（外枠は別の部品・名前は本物のログインの人）。
//   写しは test-results/f12-user-match/ に両方を撮って残す（人が見比べる用・判定には使わない）。テストはチケットを作る人が書き、実装する人は変えない
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Browser, type Page } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  readVals,
  type FidelityPair,
  type FidelityRow,
} from "../../../../scripts/ci/fidelity_compare.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../test-results/f12-user-match");
export const USER_WIDTHS = [375, 768, 1440] as const;
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "x", "y", "font-size", "color", "background-color", "border-top-color", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});

/** 本文（外枠の中）と小窓・帯・画面いっぱいの形の役割の組 */
export const USER_PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", [...BOX, "texts"]),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("sub", ".k-page-sub", ["x", ...TEXT]),
  pair("section", ".k-section", BOX),
  pair("item", ".k-uh-item", ["x", "height", "font-size", "color", "texts"]),
  pair("item-when", ".k-uh-item-when", ["x", ...TEXT]),
  pair("new-dot", ".k-uh-new", ["width", "height", "background-color"]),
  pair("status", ".k-uh-status li", ["height", "x", "texts"]),
  pair("callout", ".k-callout", [...BOX, "texts"]),
  pair("meta", ".k-uh-notice-meta", [...BOX, "texts"]),
  pair("msg", ".k-uh-msg-box", [...BOX, "texts"]),
  pair("compose", ".k-uh-compose", BOX),
  pair("file", ".k-uh-file", ["height", "x", "texts"]),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("full", ".k-uh-full-card", [...BOX, "texts"]),
  pair("peek", ".k-uh-peek-bar", [...BOX, "texts"]),
  pair("state", "[role='status'], [role='alert']", ["x", "width", ...TEXT]),
  pair("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  pair("dialog-title", ".k-dialog h2", ["x", "y", ...TEXT]),
  pair("dialog-btn", ".k-dialog button[data-variant]", ["x", "y", ...CTRL]),
];

const settle = (p: Page) =>
  p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));

/** モックの状態 id と、本番の画面をその状態にする手順を受け、同じ幅で値を比べた行を返す。skip は「役:値の名前」 */
export async function matchUser(
  browser: Browser,
  id: string,
  width: number,
  drive: (page: Page) => Promise<void>,
  opts: { pairs?: FidelityPair[]; skip?: readonly string[] } = {},
): Promise<{ rows: FidelityRow[]; bad: string[] }> {
  const pairs = opts.pairs ?? USER_PAIRS;
  const vp = { width, height: width === 375 ? 812 : 900 };
  const blockBridge = (p: Page) => p.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  mkdirSync(OUT, { recursive: true });

  const mock = await browser.newPage({ viewport: vp, colorScheme: "light", reducedMotion: "reduce" });
  await blockBridge(mock);
  expect((await mock.goto(`/dev/mock/f12-user/${id}`))?.status(), `モック ${id}`).toBe(200);
  await expect(mock.locator(`[data-mock="${id}"]`)).toBeVisible();
  await mock.evaluate(() => document.fonts.ready);
  await mock.mouse.move(0, 0);
  await settle(mock);
  const mockVals = await readVals(mock, pairs, "canvas");
  const mockFonts = await loadedFonts(mock);
  await mock.screenshot({ path: join(OUT, `${id}-${width}-mock.png`), fullPage: true });
  await mock.close();

  const app = await browser.newPage({ viewport: vp, colorScheme: "light", reducedMotion: "reduce" });
  await blockBridge(app);
  await drive(app);
  await app.evaluate(() => document.fonts.ready);
  await app.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await app.mouse.move(0, 0);
  await settle(app);
  const appVals = await readVals(app, pairs, "app");
  const appFonts = await loadedFonts(app);
  await app.screenshot({ path: join(OUT, `${id}-${width}-app.png`), fullPage: true });
  await app.close();

  const skip = new Set(opts.skip ?? []);
  const rows: FidelityRow[] = [];
  pairs.forEach((p, i) => {
    const n = mockVals[i]?.__count ?? 0;
    const m = appVals[i]?.__count ?? 0;
    if (n === 0 && m === 0) return;
    rows.push({ part: p.name, prop: "当たった数", canvas: n, app: m, ok: n === m });
    if (n !== m) return;
    rows.push(...compareRows([p], [mockVals[i]!], [appVals[i]!]).filter((r) => r.prop !== "当たった数"));
  });
  rows.push(compareFonts(mockFonts, appFonts));
  const kept = rows.filter((r) => !skip.has(`${r.part}:${r.prop}`));
  const bad = kept
    .filter((r) => !r.ok)
    .map((r) => `${id} 幅 ${width}・${r.part}・${r.prop}：モック ${r.canvas} ／ 本番 ${r.app}`);
  return { rows: kept, bad };
}

/** 横にはみ出した長さ（0 以下ならはみ出していない） */
export const overflowX = (p: Page): Promise<number> =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
