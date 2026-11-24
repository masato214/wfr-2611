// K-670「段 10 の部品 1：木とページ（下絵 v2 の 8 状態）と、状態の一覧・描き手・外枠を本線に入れる（K-69 の葉・W0）」の試験
//   （実 Chrome と、ファイル・検査を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f9（索引と、K-670 が描く 8 状態）。モックは本番と同じ部品（features/F9/knowledge・components/k）を決めた値で並べたもの。
//   見ること：8 状態が全部描ける・幅 375／768／1440 で横のはみ出し 0・棚は 3 つ（会社・グループ・自分）で「部署」の字が無い・
//   本文は段 5 の DocEditor／DocView（境界 B10）・部品は口を呼ばない・デザインの検査（G37・G72）が緑。
//   画面に出す字と並びは下絵が正。テストはチケットを作る人が書き、実装する人は変えない
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";
import { DRAWN_BY, MOCK_DIR, OWNER, ROOT, WEB, entries, guard, openState, overflowX, read } from "./f9-mock-kit";

const MINE = DRAWN_BY["K-670"];
const KN = join(WEB, "features/F9/knowledge");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".next") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K670-MK-001 状態の一覧が 32 件（下絵 v2 の 25 ＋ K-684 が足した 5 ＋ K-720 が足した 2）で、持ち主は切り方 1 章の画面の葉（ticket と leaf は同じ K-番号・K-69 は 0 件・重なり 0）", () => {
  const rows = entries();
  const ids = rows.map((r) => r.id);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual(Object.keys(OWNER).sort());
  for (const r of rows) {
    expect(r.ticket, `${r.id} の持ち主`).toBe(OWNER[r.id]);
    expect(r.leaf, `${r.id} の leaf は ticket と同じ`).toBe(r.ticket);
  }
  const written = [...read(join(MOCK_DIR, "mocks.tsx")).matchAll(/\bid: "/g)].length;
  expect(rows.length, "機械が読めない行がある").toBe(written);
});

test("K670-MK-002 画面の字にも識別子にも「部署」「dept」が 0 件（features/F9 と mock/f9）", () => {
  const files = [...sources(join(WEB, "features/F9")), ...sources(MOCK_DIR)];
  for (const f of files)
    expect(read(f), `${f} に部署・dept が残っている`).not.toMatch(
      /部署|(^|[^a-z])[Dd]epts?([^a-z]|$)|Dept[A-Z]|DEPTS/m,
    );
});

test("K670-MK-003 描き手が分かれている：mocks.tsx は一覧だけ（部品を読まない）・render.tsx が描き手に順に聞く・render-knowledge.tsx が K-670 の 8 状態を描く", () => {
  const list = strip(read(join(MOCK_DIR, "mocks.tsx")));
  expect(list, "一覧が部品を読んでいる").not.toMatch(/from "@\/features|from "\.\/(render|frame)/);
  expect(strip(read(join(MOCK_DIR, "render.tsx")))).toMatch(/renderKnowledge\(id, theme\)/);
  const mine = strip(read(join(MOCK_DIR, "render-knowledge.tsx")));
  for (const id of MINE) expect(mine, `${id} を描く所が無い`).toContain(`case "${id}"`);
  expect(read(join(MOCK_DIR, "[id]/page.tsx"))).toMatch(/from "\.\.\/render"/);
});

test("K670-MK-004 本文は段 5 の部品から読む（境界 B10）：Tiptap・ProseMirror を features/F9 が直に読まず、ナレッジの葉が doc-temp の DocEditor・DocRead を読まない", () => {
  for (const f of sources(join(WEB, "features/F9"))) {
    expect(strip(read(f)), `${f} が編集の部品を直に読む`).not.toMatch(/@tiptap\/|prosemirror-/);
  }
  const body = ["page-views.tsx", "samples.tsx", "tree.tsx"].map((n) => strip(read(join(KN, n)))).join("\n");
  expect(body).toMatch(/from "@\/features\/F4\/doc\/editor"/);
  expect(body, "仮の部品を読んでいる").not.toMatch(/from "\.\/doc-temp"/);
  expect(
    existsSync(join(KN, "doc-temp.tsx")),
    "doc-temp.tsx は K-672 が消すまで残る（settings と ticket-mocks が読む）",
  ).toBe(true);
});

test("K670-MK-005 部品は口を呼ばない（features/F9/knowledge の .tsx に fetch・/api/v1 が 0）", () => {
  for (const f of sources(KN).filter((p) => p.endsWith(".tsx"))) {
    expect(strip(read(f)), `${f} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1/);
  }
});

test("K670-RT-001 道の一覧に /dev/mock/f9 と /dev/mock/f9/:id が在る（機械生成 scripts/ci/gen_built_routes.py）", () => {
  expect(BUILT_ROUTES).toContain("/dev/mock/f9");
  expect(BUILT_ROUTES).toContain("/dev/mock/f9/:id");
});

test("K670-CG-001 画面の持ち主の検査（canvas_field_gate.py）が置き場の状態を読める形で読む（読めない・重複の語が出ない）", () => {
  const out = execFileSync("python3", ["scripts/ci/canvas_field_gate.py", "--no-base"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  }).concat("");
  expect(out).not.toMatch(/読めない|MOCKS の並びが無い|状態が 1 つも無い|が 2 つある/);
});

test("K670-DS-001 デザインの検査 G37（D1〜D7）が緑：features の色・書体・角丸・文字・部品の値が正本に在る", () => {
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

test("K670-DS-002 デザインの検査 G72（D8 生の長さ）で、knowledge の部品と mock/f9 に台帳に無い生の値が 0 件（トークンを通す）", () => {
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
    .filter((l) => /D8 apps\/web\/(features\/F9\/knowledge|app\/\(dev\)\/dev\/mock\/f9)\//.test(l));
  expect(mine, mine.join("\n")).toEqual([]);
});

// ---- 実ブラウザ ----

test("K670-UI-001 索引 /dev/mock/f9 に 32 件が並び、K-670 の 8 状態は押すと頁が開く", async ({ page }) => {
  await guard(page);
  await page.goto("/dev/mock/f9");
  await expect(page.locator("main li a")).toHaveCount(32);
  for (const id of MINE) {
    const res = await page.goto(`/dev/mock/f9/${id}`);
    expect(res?.status(), id).toBe(200);
    await expect(page.locator(`[data-mock="${id}"] .k-shell`)).toBeVisible();
  }
});

test("K670-UI-002 8 状態が幅 375 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 375);
    expect(await overflowX(page), `${id} が幅 375 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K670-UI-003 8 状態が幅 768 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 768);
    expect(await overflowX(page), `${id} が幅 768 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K670-UI-004 8 状態が幅 1440 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 1440);
    expect(await overflowX(page), `${id} が幅 1440 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K670-UI-005 kn-tree：棚が 3 つ（会社・グループ・自分）で、画面に「部署」の字が無い・題名と 1 行の説明が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-tree", 1440);
  const tree = page.getByRole("complementary", { name: "ナレッジの木", exact: true });
  for (const n of ["会社の棚", "グループの棚", "自分の棚"])
    await expect(tree.getByRole("region", { name: n, exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("部署");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("請求書の送り方");
  await expect(page.getByText("1 行の説明", { exact: true })).toBeVisible();
});

test("K670-UI-006 kn-tree：足すボタン「＋」は書ける棚にだけ（管理者は会社と自分の棚・営業のグループには無い）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-tree", 1440);
  await expect(page.getByRole("button", { name: "会社の棚にページかフォルダを足す", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "自分の棚にページかフォルダを足す", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "営業の棚にページかフォルダを足す", exact: true })).toHaveCount(0);
});

test("K670-UI-007 kn-tree：いま開いているページの行が現在の印を持ち、「必ず守る」の行に印が付く", async ({ page }) => {
  await guard(page);
  await openState(page, "kn-tree", 1440);
  const row = page.getByRole("link", { name: /請求書の送り方/ }).first();
  await expect(row).toHaveAttribute("aria-current", "page");
  await expect(row.getByLabel("必ず守る", { exact: true })).toBeVisible();
});

test("K670-UI-008 kn-tree：ページの上の帯は主ボタンが「直す」の 1 つで、「…」の中に前の版・リンクのコピー・動かす・消すが並ぶ", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-tree", 1440);
  await expect(page.getByRole("button", { name: "直す", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "このページのほかの操作", exact: true }).click();
  for (const n of ["前の版を見る", "リンクをコピー", "別のフォルダへ動かす", "消す…"]) {
    await expect(page.getByRole("menuitem", { name: n, exact: true })).toBeVisible();
  }
});

test("K670-UI-009 kn-must：「必ず守る」が付いたページに、見出しの下の 1 行（AI に毎回全部渡す・確認項目にも入る）と木の行の印が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-must", 1440);
  await expect(page.getByText("必ず守る：AI に毎回このページを全部渡します", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "必ず守る", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("tree", { name: "会社のページ", exact: true }).getByLabel("必ず守る", { exact: true }).first(),
  ).toBeVisible();
});

test("K670-UI-010 kn-write：題名・1 行の説明・本文の欄と、自動で保存した字・「やめる」「書き終える」が出る（主ボタンは「書き終える」）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-write", 1440);
  await expect(page.getByLabel("題名", { exact: false })).toBeVisible();
  await expect(page.getByLabel("1 行の説明", { exact: false })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "自動で保存しました" })).toBeVisible();
  await expect(page.getByRole("button", { name: "やめる", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "書き終える", exact: true })).toBeVisible();
});

test("K670-UI-011 kn-write：本文は段 5 の DocEditor（道具の帯『本文の道具』が在り、本文の欄に打てる）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-write", 1440);
  await expect(page.getByRole("toolbar", { name: "本文の道具", exact: true })).toBeVisible();
  const body = page.getByRole("textbox", { name: "本文", exact: true });
  await body.click();
  await page.keyboard.type("追記の確かめ");
  await expect(body).toContainText("追記の確かめ");
});

test("K670-UI-012 kn-tree：読む形の本文は DocView（aria-label『本文』の領域に、見出しと文が出る）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-tree", 1440);
  const doc = page.getByLabel("本文", { exact: true }).first();
  await expect(doc).toBeVisible();
  await expect(doc.getByRole("heading").first()).toBeVisible();
});

test("K670-UI-013 kn-empty：1 枚も無いとき『まだページがありません』と「最初のページを書く」が出て、木の棚は『まだありません』", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-empty", 1440);
  await expect(page.getByRole("heading", { name: "まだページがありません", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "最初のページを書く", exact: true })).toBeVisible();
  await expect(page.getByText("まだありません", { exact: true }).first()).toBeVisible();
});

test("K670-UI-014 kn-loading：木と本文が読み込み中の形（status が出る）で、ページの題名はまだ出ない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-loading", 1440);
  await expect(page.getByRole("status", { name: "木を読み込んでいます", exact: true })).toBeVisible();
  await expect(page.locator('[data-state="loading"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
});

test("K670-UI-015 kn-failed と kn-noaccess：読めなかった（E-PAGE-007）と見られない（E-PAGE-002）が別の番号で出て、見られないは一手（戻る）が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-failed", 1440);
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-007"]')).toBeVisible();
  await openState(page, "kn-noaccess", 1440);
  const err = page.locator('[data-state="error"][data-code="E-PAGE-002"]');
  await expect(err).toBeVisible();
  await expect(err.getByRole("button").first()).toBeVisible();
});

test("K670-UI-016 kn-drawer：幅 375 では木が引き出しで開き（背景の幕と『木を閉じる』）、幅 1440 では横に並んで幕が出ない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-drawer", 375);
  await expect(page.locator("aside.k-f9-tree[data-open]")).toBeVisible();
  await expect(page.locator(".k-f9-scrim")).toBeVisible();
  await expect(page.getByRole("button", { name: "木を閉じる", exact: true })).toBeVisible();
  await openState(page, "kn-drawer", 1440);
  await expect(page.locator("aside.k-f9-tree")).toBeVisible();
  await expect(page.locator(".k-f9-scrim")).toBeHidden();
});

test("K670-UI-017 幅 767 以下では木が引き出しで隠れ、本文の上に「木を開く」の帯が出る（kn-tree）", async ({ page }) => {
  await guard(page);
  await openState(page, "kn-tree", 768);
  await expect(page.locator("aside.k-f9-tree")).toBeHidden();
  await expect(page.getByRole("button", { name: "木を開く", exact: true })).toBeVisible();
});

test("K670-UI-018 暗いテーマでも 8 状態が開き、横にはみ出さない", async ({ page, context }) => {
  await guard(page);
  await context.addCookies([{ name: "k-theme", value: "dark", domain: "127.0.0.1", path: "/" }]);
  for (const id of MINE) {
    await openState(page, id, 375);
    expect(await overflowX(page), `${id} が暗いテーマで横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K670-UI-019 8 状態のどれを開いても、口（/api/）を 1 回も呼ばず、本人の Bridge にも届かない", async ({ page }) => {
  const calls = await guard(page);
  for (const id of MINE) await openState(page, id, 1440);
  expect(calls, `呼ばれた口：${calls.join(", ")}`).toEqual([]);
});

test("K670-UI-020 描き手がまだ無い状態（K-671・K-672 が足す）は 200 で「この状態はまだありません」を出し、外枠を出さない", async ({
  page,
}) => {
  await guard(page);
  const res = await page.goto("/dev/mock/f9/no-such-state");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("この状態はまだありません", { exact: false })).toBeVisible();
  await expect(page.locator(".k-shell")).toHaveCount(0);
});
