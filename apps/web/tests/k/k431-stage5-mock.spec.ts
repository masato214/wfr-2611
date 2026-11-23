// K-431「段 5 の下絵 v2（/dev/mock/f4v2 の 41 の状態）と、残す前の下絵（/dev/mock/f4 の 16 の状態）を本線に入れ、
//   区画の入力・テスト仕様・業務の型・前の版と差分の下絵と部品を外す（K-59 の葉・W0）」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f4v2（索引と 41 の状態）・/dev/mock/f4（索引と残す 16 の状態）。
//   モックは本番と同じ部品（features/F4/doc・features/F4/<区画>/views.tsx・components/k）を決めた値で並べたもの（代表が OK を出した下絵 v2）。
//   見ること：全部の状態が描ける・幅 375／768／1440 で横のはみ出し 0・状態の持ち主は画面の葉（切り方.md の表どおり）・
//   外した状態と部品が無い・作る面の担当者と期限に必須の印（D-125.51・D-128.25）・部品は口を呼ばない。
//   画面に出す字と並びは下絵が正（この試験は字の細部を写さず、決めの核だけ見る）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const MOCK_DIR = join(WEB, "app/(dev)/dev/mock");
const V2_SRC = join(MOCK_DIR, "f4v2/mocks.tsx");
const V1_SRC = join(MOCK_DIR, "f4/mocks.tsx");
const F4 = join(WEB, "features/F4");

/** 新しい下絵の状態と持ち主の葉（41 の状態。葉を書く途中で足した 25 を含む・07_functional/段5-F4/切り方.md の画面の表のとおり） */
const V2_OWNER: Record<string, string> = {
  "f4v2-create-template": "K-442",
  "f4v2-create-free": "K-442",
  "f4v2-create-long": "K-442",
  "f4v2-create-blank": "K-442",
  "f4v2-create-custom": "K-569",
  "f4v2-create-missing": "K-569",
  "f4v2-detail-new": "K-571",
  "f4v2-detail-worked": "K-571",
  "f4v2-detail-editing": "K-447",
  "f4v2-specs": "K-450",
  "f4v2-spec-add": "K-450",
  "f4v2-detail-thread": "K-574",
  "f4v2-complete": "K-572",
  "f4v2-nospecs": "K-573",
  "f4v2-versions": "K-449",
  "f4v2-versions-items": "K-449",
  "f4v2-create-head": "K-442",
  "f4v2-create-group": "K-442",
  "f4v2-create-missing-types": "K-569",
  "f4v2-detail-item-edit": "K-569",
  "f4v2-detail-item-error": "K-569",
  "f4v2-spec-edit": "K-450",
  "f4v2-spec-add-error": "K-450",
  "f4v2-create-specs": "K-450",
  "f4v2-detail-more": "K-571",
  "f4v2-body-read": "K-577",
  "f4v2-detail-empty": "K-571",
  "f4v2-detail-edit-enter": "K-447",
  "f4v2-detail-edit-discard": "K-447",
  "f4v2-detail-edit-conflict": "K-447",
  "f4v2-detail-edit-session": "K-447",
  "f4v2-detail-edit-failed": "K-447",
  "f4v2-versions-items-restored": "K-579",
  "f4v2-create-links": "K-580",
  "f4v2-create-link-add": "K-580",
  "f4v2-editor-image-off": "K-587",
  "f4v2-editor-link": "K-567",
  "f4v2-editor-link-error": "K-567",
  "f4v2-editor-color": "K-568",
  "f4v2-editor-table": "K-568",
  "f4v2-editor-paste-fail": "K-568",
};
/** 残す前の下絵の状態と持ち主の葉（親・期限・複製・つながり・空の一覧のおすすめ・「…」） */
const V1_OWNER: Record<string, string> = {
  "f4-parent-dialog": "K-443",
  "f4-parent-none": "K-443",
  "f4-parent-limit": "K-443",
  "f4-due-dialog": "K-444",
  "f4-due-past": "K-444",
  "f4-dup-pick": "K-446",
  "f4-dup-dialog": "K-446",
  "f4-dup-error": "K-446",
  "f4-home-empty": "K-453",
  "f4-more-menu": "K-458",
  "f4-links-collapsed": "K-452",
  "f4-links": "K-452",
  "f4-links-empty": "K-452",
  "f4-link-remove": "K-452",
  "f4-links-variants": "K-452",
  "f4-link-add": "K-452",
};
/** 外した状態（区画の入力・業務の型・本文の書き直し・見出しの足し引き・前の版と差分・テスト仕様） */
const REMOVED = [
  "f4-create-text",
  "f4-create-checklist",
  "f4-create-table",
  "f4-create-missing",
  "f4-create-error",
  "f4-wt-auto",
  "f4-wt-pick",
  "f4-wt-none",
  "f4-edit-section",
  "f4-edit-conflict",
  "f4-add-section",
  "f4-remove-section",
  "f4-versions",
  "f4-versions-restore",
  "f4-specs",
  "f4-spec-add",
  "f4-spec-lint",
];
/** 外した部品の置き場とファイル */
const REMOVED_DIRS = ["sections", "test-spec", "work-type"] as const;
/** 前の版と差分の部品。K-449 が同じ置き場 features/F4/versions/ に新しい物（versions-view.tsx ほか）を置くので、置き場は数えず前の 2 ファイルだけを見る */
const REMOVED_FILES = ["versions/versions.css", "versions/views.tsx"] as const;
const WIDTHS = [375, 768, 1440] as const;

const read = (f: string) => readFileSync(f, "utf8");
/** MOCKS の並びを、機械（canvas_field_gate.py）と同じ読み方で読む */
function entries(src: string): { id: string; ticket: string; leaf: string }[] {
  const arr = /export const MOCKS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(read(src))?.[1] ?? "";
  return [...arr.matchAll(/\{\s*id:\s*"([^"]+)",[^{}]*?\bticket:\s*"([^"]*)",\s*leaf:\s*"([^"]*)"[^{}]*?\}/g)].map(
    (m) => ({
      id: m[1]!,
      ticket: m[2]!,
      leaf: m[3]!,
    }),
  );
}
const V2 = entries(V2_SRC);
const V1 = entries(V1_SRC);

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".next") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}

async function openState(page: Page, base: "f4" | "f4v2", id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/${base}/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await expect(page.locator(".k-shell")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K431-MK-001 新しい下絵の状態は持ち主の表と余りも欠けも重なりも無く同じで、画面の葉が持つ（ticket と leaf は同じ K-番号）", () => {
  const ids = V2.map((e) => e.id);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual(Object.keys(V2_OWNER).sort());
  for (const e of V2) {
    expect(e.ticket, `${e.id} の持ち主`).toBe(V2_OWNER[e.id]);
    expect(e.leaf, `${e.id} の leaf は ticket と同じ`).toBe(e.ticket);
  }
});

test("K431-MK-002 前の下絵に残る状態は残す表と同じで、外した状態の id は 1 つも MOCKS に無い", () => {
  const ids = V1.map((e) => e.id);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual(Object.keys(V1_OWNER).sort());
  for (const e of V1) {
    expect(e.ticket, `${e.id} の持ち主`).toBe(V1_OWNER[e.id]);
    expect(e.leaf).toBe(e.ticket);
  }
  for (const id of REMOVED) expect(ids, `${id} は外した`).not.toContain(id);
});

test("K431-MK-003 外した部品（sections・test-spec・work-type・前の版と差分の versions/views.tsx・versions.css）と区画の入力の組み立て（create-surface.tsx）が無く、どこからも読まれない", () => {
  for (const d of REMOVED_DIRS) expect(existsSync(join(F4, d)), `features/F4/${d} が残っている`).toBe(false);
  for (const f of REMOVED_FILES) expect(existsSync(join(F4, f)), `features/F4/${f} が残っている`).toBe(false);
  expect(existsSync(join(MOCK_DIR, "f4/create-surface.tsx"))).toBe(false);
  const re = new RegExp(
    `F4/(${REMOVED_DIRS.join("|")})/|F4/(${REMOVED_FILES.join("|").replace(/\./g, "\\.")})|create-surface`,
  );
  for (const dir of [join(WEB, "app"), join(WEB, "features"), join(WEB, "components")]) {
    for (const f of sources(dir)) expect(read(f), `${f} が外した部品を読んでいる`).not.toMatch(re);
  }
});

test("K431-MK-004 残す部品（親・期限・複製・つながり・おすすめ・「…」）と、新しい下絵が読む前の部品が在り、部品は口を呼ばない", () => {
  for (const f of [
    "parent/views.tsx",
    "due/views.tsx",
    "due/dates.ts",
    "duplicate/views.tsx",
    "links/views.tsx",
    "home/views.tsx",
    "detail-more/views.tsx",
    "create-ticket/notify-picker.tsx",
    "create-ticket/detail-head.tsx",
    "doc/views.tsx",
    "doc/detail-views.tsx",
    "doc/thread-views.tsx",
  ]) {
    expect(existsSync(join(F4, f)), `features/F4/${f} が無い`).toBe(true);
  }
  expect(existsSync(join(MOCK_DIR, "f4/frame.tsx"))).toBe(true);
  const views = [
    ...sources(join(F4, "doc")),
    ...["parent", "due", "duplicate", "links", "home", "detail-more"].flatMap((d) => sources(join(F4, d))),
  ]
    .filter((f) => f.endsWith(".tsx"))
    // K-458 が後で置く入れ物 more-menu.tsx（複製の小窓を開く・版と差分の頁へ移る）は、この葉の部品の確かめに数えない
    .filter((f) => !f.endsWith("detail-more/more-menu.tsx"));
  for (const f of views) {
    expect(
      read(f)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, ""),
      `${f} が口を呼ぶ`,
    ).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1/);
  }
});

test("K431-MK-005 2 つの置き場の MOCKS は機械が読める形（{ id, screen, label, ticket, leaf } の順）で、書いた行の数と読めた数が同じ", () => {
  for (const [src, got] of [
    [V2_SRC, V2],
    [V1_SRC, V1],
  ] as const) {
    const written = [...read(src).matchAll(/^\s*\{ id: "/gm)].length;
    expect(got.length, `${src} の読めない行がある`).toBe(written);
  }
});

test("K431-RT-001 道の一覧に /dev/mock/f4v2 と /dev/mock/f4v2/:id が在る（機械生成 scripts/ci/gen_built_routes.py）", () => {
  expect(BUILT_ROUTES).toContain("/dev/mock/f4v2");
  expect(BUILT_ROUTES).toContain("/dev/mock/f4v2/:id");
  expect(BUILT_ROUTES).toContain("/dev/mock/f4");
  expect(BUILT_ROUTES).toContain("/dev/mock/f4/:id");
});

test("K431-CG-001 画面の持ち主の検査（canvas_field_gate.py）が、2 つの置き場の状態を持ち主のチケットの mock に結べる形で読む", () => {
  const out = execFileSync("python3", ["scripts/ci/canvas_field_gate.py", "--no-base"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  }).concat("");
  expect(out).not.toMatch(/読めない|MOCKS の並びが無い|状態が 1 つも無い|が 2 つある/);
});

// ---- 実ブラウザ ----

test("K431-UI-001 索引 /dev/mock/f4v2 は 41 の状態の見出しを並べ、押すとその状態が開く", async ({ page }) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f4v2"))?.status()).toBe(200);
  const links = page.getByRole("main").getByRole("link");
  await expect(links).toHaveCount(V2.length);
  await links.first().click();
  await expect(page).toHaveURL(new RegExp(`/dev/mock/f4v2/${V2[0]!.id}$`));
  await expect(page.locator(`[data-mock="${V2[0]!.id}"]`)).toBeVisible();
});

test("K431-UI-002 索引 /dev/mock/f4 は残す 16 の状態の見出しだけを並べ、押すとその状態が開く", async ({ page }) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f4"))?.status()).toBe(200);
  const links = page.getByRole("region", { name: "states" }).getByRole("link");
  await expect(links).toHaveCount(V1.length);
  await links.first().click();
  await expect(page.locator(`[data-mock="${V1[0]!.id}"]`)).toBeVisible();
});

for (const w of WIDTHS) {
  test(`K431-UI-003 幅 ${w}：新しい下絵の全部の状態が開き、横のはみ出しが 0`, async ({ page }) => {
    await guard(page);
    for (const e of V2) {
      await openState(page, "f4v2", e.id, w);
      expect(await overflowX(page), `${e.id} 幅 ${w}`).toBe(0);
    }
  });

  test(`K431-UI-004 幅 ${w}：残す前の下絵の全部の状態が開き、横のはみ出しが 0`, async ({ page }) => {
    await guard(page);
    for (const e of V1) {
      await openState(page, "f4", e.id, w);
      expect(await overflowX(page), `${e.id} 幅 ${w}`).toBe(0);
    }
  });
}

test("K431-UI-005 外した状態の id を開くと「この状態はまだありません」と出て、外枠も部品も出ない", async ({ page }) => {
  await guard(page);
  for (const id of REMOVED) {
    const res = await page.goto(`/dev/mock/f4/${id}`);
    expect(res?.status(), id).toBe(200);
    await expect(page.getByText(`この状態はまだありません：${id}`, { exact: true })).toBeVisible();
    await expect(page.locator(".k-shell"), id).toHaveCount(0);
  }
});

test("K431-UI-006 作る面（ひな形）：担当者と期限に必須の印（＊）が付き、優先度・開始日・親には付かない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f4v2", "f4v2-create-template", 1440);
  const mark = (name: string) =>
    page
      .locator(".k-f4d-pair")
      .filter({ has: page.locator(".k-f4d-name", { hasText: name }) })
      .locator(".k-f4d-req-mark");
  await expect(mark("担当者")).toHaveCount(1);
  await expect(mark("期限")).toHaveCount(1);
  for (const name of ["優先度", "開始日", "親", "予定時間"]) await expect(mark(name), name).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "担当者", exact: true })).toBeVisible();
});

test("K431-UI-007 作る面（必須が足りない）：題名・支払期日・PJコードの欄の下に誤りの文が出て、作るボタンは在る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f4v2", "f4v2-create-missing", 1440);
  for (const t of ["題名を書いてください", "支払期日を選んでください", "PJコードを選んでください"]) {
    await expect(page.getByText(t, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "作る", exact: true })).toBeVisible();
});

test("K431-UI-008 詳細：右のパネルは項目とやり取りのタブを持ち、パネルを閉じる・AI のタブは押せない形", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f4v2", "f4v2-detail-new", 1440);
  const panel = page.getByRole("complementary", { name: "チケットのパネル", exact: true });
  await expect(panel).toBeVisible();
  const tabs = panel.getByRole("navigation", { name: "パネルのタブ", exact: true });
  await expect(tabs.getByRole("button", { name: "項目", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("button", { name: "やり取り", exact: true })).toBeVisible();
  await expect(tabs.getByRole("button", { name: /のAI$/ })).toHaveAttribute("aria-disabled", "true");
  await expect(panel.getByRole("button", { name: "パネルを閉じる", exact: true })).toBeVisible();
});

test("K431-UI-009 確認項目を足す小窓：確かめること 1 つだけを書き、「誰が確かめるか」の欄は無い", async ({ page }) => {
  await guard(page);
  await openState(page, "f4v2", "f4v2-spec-add", 1440);
  const d = page.getByRole("dialog", { name: "確認項目を足す", exact: true });
  await expect(d).toBeVisible();
  await expect(d.getByRole("textbox", { name: "確かめること", exact: true })).toHaveValue("PDF の合計が請求額と合う");
  await expect(d.getByRole("button", { name: "やめる", exact: true })).toBeVisible();
  await expect(d.getByRole("button", { name: "足す", exact: true })).toBeVisible();
  await expect(d.getByText("誰が確かめる")).toHaveCount(0);
});

test("K431-UI-010 前の下絵の小窓（親）は新しい作る面の上に開き、前の区画の入力（必須の区画の誤り）は背景に出ない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f4", "f4-parent-dialog", 1440);
  await expect(page.getByRole("dialog", { name: /親/ })).toBeVisible();
  await expect(page.locator("#create-ticket-title")).toHaveText("チケットを作る");
  await expect(page.getByText("この区画は書かないと作れません")).toHaveCount(0);
});

test("K431-UI-011 複製の小窓（見本）：写す物は 本文・担当者と承認する人・項目・確認項目・つながり・子チケットで、添付は押せない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f4", "f4-dup-dialog", 1440);
  const d = page.getByRole("dialog");
  for (const name of [
    "本文",
    "担当者・承認する人",
    "項目（期限・優先度・会社の項目）",
    "確認項目",
    "つながり",
    "子チケット（0 件）",
  ]) {
    await expect(d.getByRole("checkbox", { name, exact: true }), name).toBeChecked();
  }
  await expect(d.getByRole("checkbox", { name: "添付", exact: true })).toBeDisabled();
  await expect(d.getByText(/テスト仕様|参照するもの/)).toHaveCount(0);
});

test("K431-UI-012 詳細の「…」：複製と版と差分の 2 つだけが押せて、ほかは押せない形で出る", async ({ page }) => {
  await guard(page);
  await openState(page, "f4", "f4-more-menu", 1440);
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "複製する", exact: true })).toBeEnabled();
  await expect(menu.getByRole("menuitem", { name: "版と差分を見る", exact: true })).toBeEnabled();
  await expect(menu.getByRole("menuitem", { name: "種別を変える タスク → 依頼 など" })).toBeDisabled();
  await expect(menu.getByRole("menuitem", { name: "ひな形にする この本文の形を次から使う" })).toBeDisabled();
});

test("K431-UI-013 つながり（見本）：子 2 件・つながり 2 件を並べ、閉じた形は件数と「開く」だけを出す", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f4", "f4-links", 1440);
  const card = page.getByRole("region", { name: "子チケット・つながり", exact: true });
  await expect(card.getByRole("link", { name: /EG-120/ })).toBeVisible();
  await expect(card.getByRole("link", { name: /EG-110/ })).toBeVisible();
  await openState(page, "f4", "f4-links-collapsed", 1440);
  const closed = page.getByRole("region", { name: "子チケット・つながり", exact: true });
  await expect(closed.getByRole("button", { name: "開く", exact: true })).toBeVisible();
  await expect(closed.getByRole("link")).toHaveCount(0);
});
