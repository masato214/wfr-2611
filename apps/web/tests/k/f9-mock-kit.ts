// 段 10（F9）の下絵 /dev/mock/f9 の試験の共通の道具（K-670 が運ぶ。K-671・K-672 の試験も読む）。
//   状態の持ち主は切り方 1 章の画面の葉（07_functional/段10-F9/切り方.md）。描く葉は 3 つに分かれる：
//   K-670＝木とページ・K-671＝帯・小窓・管理・K-672＝チケットの側・設定・メンバー。
//   画面に出す字と並びは下絵が正（この道具は字の細部を写さない）。テストはチケットを作る人が書き、実装する人は変えない
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const WEB = join(HERE, "../..");
export const MOCK_DIR = join(WEB, "app/(dev)/dev/mock/f9");
export const MOCKS_SRC = join(MOCK_DIR, "mocks.tsx");
export const WIDTHS = [375, 768, 1440] as const;

/** 状態と持ち主の葉（32 状態＝下絵 v2 の 25 ＋ K-684 が足した 5 ＋ K-720 が足した 2）。持ち主は画面の葉。描く（運ぶ）葉は DRAWN_BY */
export const OWNER: Readonly<Record<string, string>> = {
  "kn-tree": "K-682",
  "kn-empty": "K-682",
  "kn-loading": "K-682",
  "kn-failed": "K-682",
  "kn-noaccess": "K-682",
  "kn-drawer": "K-682",
  "kn-more": "K-684",
  "kn-add": "K-684",
  "kn-move": "K-684",
  "kn-delete": "K-684",
  "kn-versions": "K-684",
  "kn-write": "K-683",
  "kn-must": "K-691",
  "kn-must-full": "K-691",
  "kn-similar": "K-691",
  "kn-raise": "K-692",
  "kn-raise-waiting": "K-692",
  "kn-raise-declined": "K-692",
  "kn-share": "K-693",
  "kn-shared-view": "K-693",
  "kn-copy": "K-693",
  "kn-approvals": "K-694",
  "kn-review": "K-696",
  "tk-guard": "K-702",
  "tk-opened": "K-702",
  "tk-blocked": "K-703",
  "set-kinds": "K-707",
  "set-stages": "K-708",
  "set-fields": "K-709",
  "set-field-add": "K-720",
  "set-field-delete": "K-720",
  "mem-groups": "K-710",
};

/** 描く（運ぶ）葉ごとの状態 */
export const DRAWN_BY: Readonly<Record<"K-670" | "K-671" | "K-672" | "K-684" | "K-720", readonly string[]>> = {
  "K-670": ["kn-tree", "kn-write", "kn-must", "kn-empty", "kn-loading", "kn-failed", "kn-noaccess", "kn-drawer"],
  "K-671": [
    "kn-must-full",
    "kn-raise",
    "kn-raise-waiting",
    "kn-raise-declined",
    "kn-approvals",
    "kn-share",
    "kn-shared-view",
    "kn-copy",
    "kn-similar",
    "kn-review",
  ],
  "K-672": ["tk-guard", "tk-opened", "tk-blocked", "set-kinds", "set-stages", "set-fields", "mem-groups"],
  "K-684": ["kn-more", "kn-add", "kn-move", "kn-delete", "kn-versions"],
  "K-720": ["set-field-add", "set-field-delete"],
};

export interface MockRow {
  id: string;
  no: string;
  screen: string;
  label: string;
  ticket: string;
  leaf: string;
}

export const read = (f: string): string => readFileSync(f, "utf8");

/** MOCKS の並びを、機械（canvas_field_gate.py）と同じ形で読む（折った行も読む） */
export function entries(): MockRow[] {
  const arr = /export const MOCKS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(read(MOCKS_SRC))?.[1] ?? "";
  return [
    ...arr.matchAll(
      /\{\s*id:\s*"([^"]+)",\s*no:\s*"([^"]+)",\s*screen:\s*"([^"]+)",\s*label:\s*"([^"]*)",\s*ticket:\s*"([^"]*)",\s*leaf:\s*"([^"]*)",?\s*\}/g,
    ),
  ].map((m) => ({ id: m[1]!, no: m[2]!, screen: m[3]!, label: m[4]!, ticket: m[5]!, leaf: m[6]! }));
}

/** モックは口を呼ばない：網の手前で口を 599、本人の Bridge（127.0.0.1:38617）は 404 にする。呼ばれた口の数を数えて返す */
export async function guard(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => {
    calls.push(route.request().url());
    return route.fulfill({ status: 599, body: "モックは口を呼ばない" });
  });
  return calls;
}

/** 1 つの状態の頁を、決めた幅で開く（外枠が出て、文字の読み込みが済むまで待つ） */
export async function openState(page: Page, id: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f9/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await expect(page.locator(".k-shell")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** 横にはみ出した長さ（0 以下ならはみ出していない） */
export const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** 持ち主の葉が取り込まれるまで頁が出す字（描き手がまだ無い状態） */
export const NOT_YET = "この状態はまだありません";
