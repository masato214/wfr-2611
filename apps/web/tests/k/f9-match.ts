// ナレッジ（段 10・F9）の画面の葉（K-682・K-683・K-684 ほか）の試験の道具：モック /dev/mock/f9/<状態> と本番の画面を同じ幅で開き、
//   同じ役の要素の値を比べる。共通の道具 stage2-match.ts の matchMock と同じ比べ方だが、モックの「見出し」を待たない
//   （kn-empty・kn-loading・kn-write などの状態は h1 が無い）。待つ物は外枠の本文 .k-f9-main。
//   写しは test-results/f9-match/ に両方を撮って残す（人が見比べる用・判定には使わない）。
//   テストはチケットを作る人が書き、実装する人は変えない
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

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../test-results/f9-match");
export const F9_WIDTHS = [375, 768, 1440] as const;
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];

const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** ナレッジの本文（外枠の中）の役割の組。外枠（左のバー・上の帯）は比べない：本番の外枠は別の部品（K-138）で、モックは見本の外枠 */
export const KN_PAIRS: FidelityPair[] = [
  pair("tree", ".k-f9-tree", [...BOX, "texts"]),
  pair("shelf-head", ".k-f9-shelf-h", ["x", "height", ...TEXT]),
  pair("node", ".k-f9-node", ["x", "height", "font-size", "color", "texts"]),
  pair("mark", ".k-f9-mark", ["width", "height", "color"]),
  pair("add", ".k-f9-add", ["width", "height", "x"]),
  pair("scrim", ".k-f9-scrim", ["width", "height", "background-color"]),
  pair("card", ".k-f9-card", [...BOX, "texts"]),
  pair("place", ".k-f9-place", ["x", ...TEXT]),
  pair("title", ".k-f9-title", ["x", "y", ...TEXT]),
  pair("desc", ".k-f9-desc", ["x", ...TEXT]),
  pair("mustline", ".k-f9-mustline", [...BOX, "texts"]),
  pair("acts", ".k-f9-acts button", CTRL),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("fields", ".k-f9-editfields .k-input", ["width", "height", "x", "font-size", "border-top-color"]),
  pair("saved", ".k-f9-saved", TEXT),
  pair("editor", ".k-f4d-editor", [...BOX]),
  pair("bar", ".k-f4d-bar", [...BOX]),
  pair("foot", ".k-f9-pfoot", ["x", ...TEXT]),
  pair("state", ".k-f9-card [role='status'], .k-f9-card [role='alert'], .k-f9-main .k-empty", ["x", "width", ...TEXT]),
  pair("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  pair("dialog-title", ".k-dialog h2", ["x", "y", ...TEXT]),
  pair("dialog-label", ".k-dialog .k-label", TEXT),
  pair("dialog-btn", ".k-dialog button[data-variant]", ["x", "y", ...CTRL]),
];

const settle = (p: Page) =>
  p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));

/** モックの状態 id と、本番の画面をその状態にする手順を受け、同じ幅で値を比べた行を返す */
export async function matchF9(
  browser: Browser,
  id: string,
  width: number,
  drive: (page: Page) => Promise<void>,
  opts: { pairs?: FidelityPair[]; skip?: readonly string[] } = {},
): Promise<{ rows: FidelityRow[]; bad: string[] }> {
  const pairs = opts.pairs ?? KN_PAIRS;
  const vp = { width, height: width === 375 ? 812 : 900 };
  const blockBridge = (p: Page) => p.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  mkdirSync(OUT, { recursive: true });

  const mock = await browser.newPage({ viewport: vp, colorScheme: "light", reducedMotion: "reduce" });
  await blockBridge(mock);
  expect((await mock.goto(`/dev/mock/f9/${id}`))?.status(), `モック ${id}`).toBe(200);
  await expect(mock.locator(`[data-mock="${id}"] .k-f9-main`)).toBeVisible();
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
