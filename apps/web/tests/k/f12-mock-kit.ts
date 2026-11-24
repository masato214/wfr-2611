// 段 13（F12）の下絵 /dev/mock/f12-ops・f12-ops2・f12-user の試験の共通の道具（K-941 が運ぶ。K-942・K-943 の試験も読む）。
//   状態と持ち主の葉の対応は、置き場ごとに各葉の試験が持つ（この道具は持たない＝後の葉が来ても、この道具を書き換えない）。
//   画面に出す字と並びは下絵が正（この道具は字の細部を写さない）。テストはチケットを作る人が書き、実装する人は変えない
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const WEB = join(HERE, "../..");
export const F12 = join(WEB, "features/F12");
export type MockDir = "f12-ops" | "f12-ops2" | "f12-user";
export const mockDir = (d: MockDir): string => join(WEB, "app/(dev)/dev/mock", d);
export const WIDTHS = [375, 768, 1440] as const;

export interface MockRow {
  id: string;
  no: string;
  screen: string;
  label: string;
  ticket: string;
  leaf: string;
}

export const read = (f: string): string => readFileSync(f, "utf8");
/** 注（/* *\/ と行の //）を外した中身（画面に出る字と import だけを見るため） */
export const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** フォルダの下の .ts・.tsx・.css を全部（node_modules・.next は見ない） */
export function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".next") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

/** MOCKS の並びを、機械（canvas_field_gate.py）と同じ形で読む（折った行も読む） */
export function entries(d: MockDir): MockRow[] {
  const arr = /export const MOCKS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(read(join(mockDir(d), "mocks.tsx")))?.[1] ?? "";
  return [
    ...arr.matchAll(
      /\{\s*id:\s*"([^"]+)",\s*no:\s*"([^"]+)",\s*screen:\s*"([^"]+)",\s*label:\s*"([^"]*)",\s*ticket:\s*"([^"]*)",\s*leaf:\s*"([^"]*)",?\s*\}/g,
    ),
  ].map((m) => ({ id: m[1]!, no: m[2]!, screen: m[3]!, label: m[4]!, ticket: m[5]!, leaf: m[6]! }));
}

/** モックは口を呼ばない：網の手前で口を 599、本人の Bridge（127.0.0.1:38617）は 404 にする。呼ばれた口を数えて返す */
export async function guard(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => {
    calls.push(route.request().url());
    return route.fulfill({ status: 599, body: "モックは口を呼ばない" });
  });
  return calls;
}

/** 1 つの状態の頁を、決めた幅で開く（状態の入れ物が出て、文字の読み込みが済むまで待つ） */
export async function openState(page: Page, d: MockDir, id: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/${d}/${id}`);
  expect(res?.status(), `${d}/${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 横にはみ出した長さ（0 以下ならはみ出していない） */
export const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** 小窓（dialog・alertdialog）を題で探す */
export const dialogOf = (page: Page, title: string) =>
  page.locator('[role="dialog"], [role="alertdialog"]').filter({ hasText: title });

/** 画面に出してはいけない字（D-156.13 書き出し・D-156.16 取引先・D-156.18 業務の型）。注を外した中身で数える */
export const FORBIDDEN = /取引先|業務の型|書き出|エクスポート|CSV/;
