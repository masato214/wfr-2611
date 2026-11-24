// K-941「段 13 の部品 1：運営の外枠・ワークスペースの一覧・1 社・運営の人の部品と、幅で出し分ける表（features/F12/ops・shared）と、
//   下絵の置き場 /dev/mock/f12-ops（20 状態）を本線に入れる（K-72 の葉・W0）」の試験（実 Chrome と、ファイル・検査を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f12-ops（索引と 20 状態）。モックは本番と同じ部品（features/F12/ops・shared・components/k）を決めた値で並べたもの。
//   見ること：20 状態が全部描ける・幅 375／768／1440 で横のはみ出し 0・運営の外枠（顧客の外枠を使わない）・表は置き場の幅で出し分ける・
//   書き出し・取引先・業務の型の字が無い・部品は口を呼ばない・デザインの検査（G37・G72）が緑。
//   画面に出す字と並びは下絵が正。テストはチケットを作る人が書き、実装する人は変えない
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";
import {
  F12,
  FORBIDDEN,
  ROOT,
  dialogOf,
  entries,
  guard,
  mockDir,
  openState,
  overflowX,
  read,
  sources,
  strip,
} from "./f12-mock-kit";

const DIR = "f12-ops" as const;
const MOCK = mockDir(DIR);
/** 状態と持ち主の葉（切り方 1 章の画面の葉）。運ぶ（描く）のはこの葉。
 *  後の葉の部品を使う状態（パスキーを付ける 4 つ・請求書の型 3 つ・ひな形の新しい版を直す 1 つ）は、部品を運ぶ葉の置き場に分けた（K-1003・K-1108・K-942） */
const OWNER: Readonly<Record<string, string>> = {
  "op-list": "K-965",
  "op-list-empty": "K-965",
  "op-list-pwned": "K-1019",
  "op-pwned": "K-1019",
  "op-ws": "K-971",
  "op-ws-members": "K-971",
  "op-ws-billing": "K-971",
  "op-ws-inquiries": "K-971",
  "op-ws-log": "K-971",
  "op-ws-nocap": "K-971",
  "op-peek": "K-972",
  "op-peek-open": "K-972",
  "op-stop": "K-972",
  "op-stopped": "K-972",
  "op-ws-notice": "K-972",
  "op-team": "K-986",
  "op-team-add": "K-986",
  "op-team-edit": "K-986",
  "op-team-remove": "K-986",
  "op-login": "K-946",
};
const IDS = Object.keys(OWNER);
const SHELLED = IDS.filter((id) => id !== "op-login");
const MINE = [join(F12, "ops"), join(F12, "shared"), MOCK];

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K941-MK-001 状態の一覧が 20 件で、持ち主は切り方 1 章の画面の葉（ticket と leaf は同じ K-番号・重なり 0）", () => {
  const rows = entries(DIR);
  const ids = rows.map((r) => r.id);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...IDS].sort());
  for (const r of rows) {
    expect(r.ticket, `${r.id} の持ち主`).toBe(OWNER[r.id]);
    expect(r.leaf, `${r.id} の leaf は ticket と同じ`).toBe(r.ticket);
  }
  expect(rows.length, "機械が読めない行がある").toBe([...read(join(MOCK, "mocks.tsx")).matchAll(/\bid: "/g)].length);
});

test("K941-MK-002 画面の字に「取引先」「業務の型」「書き出」「エクスポート」「CSV」が 0 件（features/F12/ops・shared・mock/f12-ops の注を除く中身）", () => {
  for (const d of MINE)
    for (const f of sources(d)) expect(strip(read(f)), `${f} に出してはいけない字がある`).not.toMatch(FORBIDDEN);
});

test("K941-MK-003 部品は口を呼ばない（features/F12/ops・shared の .tsx に fetch・/api/v1 が 0）", () => {
  for (const d of [join(F12, "ops"), join(F12, "shared")])
    for (const f of sources(d).filter((p) => p.endsWith(".tsx")))
      expect(strip(read(f)), `${f} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1/);
});

test("K941-MK-004 一覧と描き手が分かれている：mocks.tsx は部品を読まず、render.tsx が 20 状態を 1 つずつ描き、知らない id は「まだありません」", () => {
  expect(strip(read(join(MOCK, "mocks.tsx"))), "一覧が部品を読んでいる").not.toMatch(
    /from "@\/features|from "\.\/render/,
  );
  const render = strip(read(join(MOCK, "render.tsx")));
  for (const id of IDS) expect(render, `${id} を描く所が無い`).toContain(`case "${id}"`);
  expect(render).toContain("この状態はまだありません");
  expect(read(join(MOCK, "[id]/page.tsx"))).toMatch(/from "\.\.\/render"/);
});

test("K941-MK-005 運営の外枠は顧客の外枠を使わない（features/F12/ops が components/k の Shell を読まない）・表の箱の位置の基準は共通の部品が持つ（ops.css に position: relative の受けが無い・K-964）", () => {
  for (const f of sources(join(F12, "ops")).filter((p) => p.endsWith(".tsx")))
    expect(strip(read(f)), `${f} が顧客の外枠を読む`).not.toMatch(/\bShell\b[^"]*from "@\/components\/k"|<Shell\b/);
  const css = strip(read(join(F12, "ops/ops.css")));
  const rule = /\.k-op-shell \.k-table-wrap\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(rule).not.toMatch(/position:\s*relative/);
});

test("K941-MK-006 幅で出し分ける表は共通の部品の Table を使う（shared/resp-table.tsx が components/k の Table を読み、自分で table を組まない）", () => {
  const rt = strip(read(join(F12, "shared/resp-table.tsx")));
  expect(rt).toMatch(/import \{[^}]*\bTable\b[^}]*\} from "@\/components\/k"/);
  expect(rt).not.toMatch(/<table\b/);
});

test("K941-RT-001 道の一覧に /dev/mock/f12-ops と /dev/mock/f12-ops/:id が在る（機械生成 scripts/ci/gen_built_routes.py）", () => {
  expect(BUILT_ROUTES).toContain("/dev/mock/f12-ops");
  expect(BUILT_ROUTES).toContain("/dev/mock/f12-ops/:id");
});

test("K941-CG-001 画面の持ち主の検査（canvas_field_gate.py）が置き場の状態を読める形で読む（読めない・重複の語が出ない）", () => {
  const out = execFileSync("python3", ["scripts/ci/canvas_field_gate.py", "--no-base"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  expect(out).not.toMatch(/読めない|MOCKS の並びが無い|状態が 1 つも無い|が 2 つある/);
});

test("K941-DS-001 デザインの検査 G37（D1〜D7）が緑：features の色・書体・角丸・文字・部品の値が正本に在る", () => {
  const out = execFileSync(
    "python3",
    [
      "scripts/ci/design_gate.py",
      "--design",
      "04_design/DESIGN-kaname.md",
      "--mocks",
      "apps/web/components/k",
      "apps/web/features",
      "--css",
      "apps/web/styles/k-tokens.css",
      "--part",
      "--scales",
      "--usage",
      "apps/web",
      "apps/bridge/src",
    ],
    { cwd: ROOT, encoding: "utf8", timeout: 300_000 },
  );
  expect(out).toMatch(/PASS/);
});

test("K941-DS-002 デザインの検査 G72（D8 生の長さ）で、F12 の ops・shared と mock/f12-ops に台帳に無い生の値が 0 件", () => {
  let out: string;
  try {
    out = execFileSync(
      "python3",
      [
        "scripts/ci/design_gate.py",
        "--design",
        "04_design/DESIGN-kaname.md",
        "--mocks",
        "apps/web/components/k",
        "apps/web/features",
        "--css",
        "apps/web/styles/k-tokens.css",
        "--part",
        "--no-components",
        "--raw-lengths",
        "--no-base",
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 300_000 },
    );
  } catch (e) {
    out = String((e as { stdout?: string }).stdout ?? "");
  }
  const mine = out
    .split("\n")
    .filter((l) => /D8 apps\/web\/(features\/F12\/(ops|shared)|app\/\(dev\)\/dev\/mock\/f12-ops)\//.test(l));
  expect(mine, mine.join("\n")).toEqual([]);
});

// ---- 実ブラウザ ----

test("K941-UI-001 索引 /dev/mock/f12-ops に 20 件が並び、どの状態も頁が開く（200・状態の入れ物が出る）", async ({
  page,
}) => {
  await guard(page);
  await page.goto("/dev/mock/f12-ops");
  await expect(page.locator("main li a")).toHaveCount(20);
  for (const id of IDS) await openState(page, DIR, id, 1440);
});

// 行 ID：K941-UI-002・K941-UI-003・K941-UI-004
for (const [n, w] of [
  ["002", 375],
  ["003", 768],
  ["004", 1440],
] as const) {
  test(`K941-UI-${n} 20 状態が幅 ${w} で開き、横のはみ出しが 0`, async ({ page }) => {
    await guard(page);
    for (const id of IDS) {
      await openState(page, DIR, id, w);
      expect(await overflowX(page), `${id} が幅 ${w} で横にはみ出す`).toBeLessThanOrEqual(0);
    }
  });
}

test("K941-UI-005 暗いテーマでも 20 状態が幅 375 で開き、横にはみ出さない", async ({ page, context }) => {
  await guard(page);
  await context.addCookies([{ name: "k-theme", value: "dark", domain: "127.0.0.1", path: "/" }]);
  for (const id of IDS) {
    await openState(page, DIR, id, 375);
    expect(await overflowX(page), `${id} が暗いテーマで横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K941-UI-006 20 状態のどれを開いても、口（/api/）を 1 回も呼ばず、本人の Bridge にも届かない", async ({
  page,
}) => {
  const calls = await guard(page);
  let bridge = 0;
  page.on("request", (r) => {
    if (/127\.0\.0\.1:38617/.test(r.url())) bridge += 1;
  });
  for (const id of IDS) await openState(page, DIR, id, 1440);
  expect(calls).toEqual([]);
  expect(bridge).toBe(0);
});

test("K941-UI-007 運営の外枠：左のメニューは ワークスペース・問い合わせ（3）・お知らせ・請求（2）・配るもの の順で下に運営の人、一覧ではワークスペースが今の印、左上は「Kaname」と「運営」の札", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-list", 1440);
  const nav = page.getByRole("navigation", { name: "運営のメニュー", exact: true });
  const items = nav.locator("a.k-nav-item .k-nav-label");
  await expect(items).toHaveText(["ワークスペース", "問い合わせ", "お知らせ", "請求", "配るもの", "運営の人"]);
  await expect(nav.getByRole("link", { name: /^ワークスペース/ })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByLabel("3 件", { exact: true })).toBeVisible();
  await expect(nav.getByLabel("2 件", { exact: true })).toBeVisible();
  await expect(nav.locator(".k-op-brand")).toHaveText("Kaname");
  await expect(nav.locator(".k-op-tag")).toHaveText("運営");
});

test("K941-UI-008 運営のログイン（op-login）だけは外枠が無く、見出し「運営のログイン」と「パスキーで入る」の 1 つだけ（メールとパスワードの欄が無い）。ほかの 19 状態は運営の外枠に入る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-login", 1440);
  await expect(page.locator(".k-op-shell")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "運営のログイン", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "パスキーで入る", exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"], input[type="email"]')).toHaveCount(0);
  for (const id of SHELLED) {
    await openState(page, DIR, id, 1440);
    await expect(page.locator(".k-op-shell"), `${id} が運営の外枠に入っていない`).toHaveCount(1);
  }
});

test("K941-UI-009 幅 375：左のメニューは出ず、上の帯に「Kaname 運営」、帯の「メニューを開く」で引き出しが開き、「メニューを閉じる」で閉じる", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-list", 375);
  await expect(page.getByRole("navigation", { name: "運営のメニュー", exact: true })).toBeHidden();
  await expect(page.getByText("Kaname 運営", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "メニューを開く", exact: true }).click();
  const drawer = page.getByRole("navigation", { name: "運営のメニュー（引き出し）", exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: /^配るもの/ })).toBeVisible();
  await page.getByRole("button", { name: "メニューを閉じる", exact: true }).click();
  await expect(drawer).toHaveCount(0);
});

test("K941-UI-010 表は置き場の幅で出し分ける（D-156.14）：一覧は幅 1440 で表が見えて組が隠れ、幅 375 で組（1 行 1 枚）が見えて表が隠れる", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-list", 1440);
  await expect(page.locator(".k-f12-rt-table").first()).toBeVisible();
  await expect(page.locator(".k-f12-rt-cards").first()).toBeHidden();
  await openState(page, DIR, "op-list", 375);
  await expect(page.locator(".k-f12-rt-cards").first()).toBeVisible();
  await expect(page.locator(".k-f12-rt-table").first()).toBeHidden();
});

test("K941-UI-011 一覧：見出し「ワークスペース」と絞り込みの組が出て、探して 0 件（op-list-empty）では表が無く「「ほしの」に合うワークスペースはありません」と「探す欄を空にする」が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-list", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "ワークスペース", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "絞り込み", exact: true })).toBeVisible();
  await openState(page, DIR, "op-list-empty", 1440);
  await expect(page.locator(".k-f12-rt")).toHaveCount(0);
  await expect(page.getByText("「ほしの」に合うワークスペースはありません", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "探す欄を空にする", exact: true })).toBeVisible();
});

test("K941-UI-012 回収：一覧の上に「パスワードの照合が使えなかった登録が 3 件あります」の帯と「見る」、小窓（op-pwned）に「確かめた」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-list-pwned", 1440);
  await expect(page.getByText("パスワードの照合が使えなかった登録が 3 件あります", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "見る", exact: true })).toBeVisible();
  await openState(page, DIR, "op-pwned", 1440);
  const dlg = dialogOf(page, "パスワードの照合が使えなかった登録");
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("button", { name: /さんを確かめた$/ }).first()).toBeVisible();
});

test("K941-UI-013 1 社（op-ws）：見出しが会社の名前で、タブ 5 つ（いまの状態・メンバー・プランと請求・問い合わせ・記録）のうち「いまの状態」が選ばれている", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-ws", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "合同会社ミナト企画", exact: true })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "1 社の画面", exact: true }).getByRole("tab");
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText([/^いまの状態/, /^メンバー/, /^プランと請求/, /^問い合わせ/, /^記録/]);
  await expect(page.getByRole("tab", { name: "いまの状態", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("K941-UI-014 できることが無いタブ（op-ws-nocap）：中身は「見られない」（E-PAGE-002）で、タブとワークスペースの情報は出たまま", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-ws-nocap", 1440);
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-002"]')).toBeVisible();
  await expect(page.getByRole("tablist", { name: "1 社の画面", exact: true })).toBeVisible();
});

test("K941-UI-015 中を見る・止める・1 社にお知らせ の小窓：題が「中を見る」「止める」「お知らせを送る」で、止めるは「先に知らせて、日を決めて止める」と「すぐ止める」の 2 つから選ぶ", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-peek", 1440);
  await expect(dialogOf(page, "中を見る")).toBeVisible();
  await openState(page, DIR, "op-stop", 1440);
  const stop = dialogOf(page, "止める");
  await expect(stop).toBeVisible();
  await expect(stop.getByText("先に知らせて、日を決めて止める", { exact: true })).toBeVisible();
  await expect(stop.getByText("すぐ止める", { exact: true })).toBeVisible();
  await openState(page, DIR, "op-ws-notice", 1440);
  await expect(dialogOf(page, "お知らせを送る")).toBeVisible();
});

test("K941-UI-016 止めている 1 社（op-stopped）：札「止めている」と帯「このワークスペースは止めています」と「再開する」が出る。中を見ている間（op-peek-open）は上に帯が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-stopped", 1440);
  await expect(page.getByText(/^止めている/).first()).toBeVisible();
  await expect(page.getByText("このワークスペースは止めています", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "再開する", exact: true })).toBeVisible();
  await openState(page, DIR, "op-peek-open", 1440);
  await expect(page.locator(".k-op-banner")).toBeVisible();
});

test("K941-UI-017 運営の人：一覧（op-team）の見出し「運営の人」・足す小窓「運営の人を足す」・変える小窓「できることを変える」・外す確かめ（題が「運営の人から外す」で終わる）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, DIR, "op-team", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "運営の人", exact: true })).toBeVisible();
  await openState(page, DIR, "op-team-add", 1440);
  await expect(dialogOf(page, "運営の人を足す")).toBeVisible();
  await openState(page, DIR, "op-team-edit", 1440);
  await expect(dialogOf(page, "できることを変える")).toBeVisible();
  await openState(page, DIR, "op-team-remove", 1440);
  await expect(dialogOf(page, "運営の人から外す")).toBeVisible();
});

test("K941-UI-018 20 状態のどこにも「書き出す」のボタン・リンクが無い（押せない形でも出さない・D-156.13）", async ({
  page,
}) => {
  await guard(page);
  for (const id of IDS) {
    await openState(page, DIR, id, 1440);
    await expect(page.getByRole("button", { name: /書き出/ }), id).toHaveCount(0);
    await expect(page.getByRole("link", { name: /書き出/ }), id).toHaveCount(0);
  }
});
