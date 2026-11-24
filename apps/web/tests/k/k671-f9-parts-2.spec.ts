// K-671「段 10 の部品 2：帯・小窓・管理（下絵 v2 の 10 状態）を本線に入れる（K-69 の葉・W0）」の試験
//   （実 Chrome と、ファイル・検査を読む試験・実装より先に積む）。K-670（状態の一覧・外枠・描き方の下ごしらえ）の後。
//   的：開発用の置き場 /dev/mock/f9 の、K-671 が描く 10 状態（必ず守るの上限・上の棚に上げる 3・承認待ち・共有 2・写して直す・似たページ・見直すページ）。
//   見ること：10 状態が描ける・幅 375／768／1440 で横のはみ出し 0・字（「グループ」・上限 30）・押せる形・部品は口を呼ばない・生の長さ 0。
//   画面に出す字と並びは下絵が正。テストはチケットを作る人が書き、実装する人は変えない
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DRAWN_BY, MOCK_DIR, WEB, guard, openState, overflowX, read } from "./f9-mock-kit";

const MINE = DRAWN_BY["K-671"];
const KN = join(WEB, "features/F9/knowledge");
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("K671-MK-001 render-admin.tsx が K-671 の 10 状態を描き（case が 10 個）、render.tsx がそれを読む", () => {
  const src = strip(read(join(MOCK_DIR, "render-admin.tsx")));
  for (const id of MINE) expect(src, `${id} を描く所が無い`).toContain(`case "${id}"`);
  expect([...src.matchAll(/case "/g)].length).toBe(MINE.length);
  expect(strip(read(join(MOCK_DIR, "render.tsx")))).toMatch(/renderAdmin\(id, theme\)/);
});

test("K671-MK-002 小窓と管理の部品（dialogs.tsx・admin-views.tsx）は口を呼ばず、編集の部品を直に読まない", () => {
  for (const n of ["dialogs.tsx", "admin-views.tsx"]) {
    const src = strip(read(join(KN, n)));
    expect(src, `${n} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1/);
    expect(src, `${n} が編集の部品を読む`).not.toMatch(/@tiptap\/|prosemirror-/);
  }
});

test("K671-DS-001 G72（D8 生の長さ）で、dialogs・admin-views・admin.css に台帳に無い生の値が 0 件", () => {
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
      { cwd: join(WEB, "../.."), encoding: "utf8", timeout: 300_000 },
    );
  } catch (e) {
    out = String((e as { stdout?: string }).stdout ?? "");
  }
  const mine = out
    .split("\n")
    .filter((l) => /D8 apps\/web\/features\/F9\/knowledge\/(dialogs|admin-views|admin)\./.test(l));
  expect(mine, mine.join("\n")).toEqual([]);
});

test("K671-UI-001 10 状態が全部開き（200・外枠が出る）、口を 1 回も呼ばない", async ({ page }) => {
  const calls = await guard(page);
  for (const id of MINE) await openState(page, id, 1440);
  expect(calls, calls.join(", ")).toEqual([]);
});

test("K671-UI-002 10 状態が幅 375 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 375);
    expect(await overflowX(page), `${id} が幅 375 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K671-UI-003 10 状態が幅 768 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 768);
    expect(await overflowX(page), `${id} が幅 768 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K671-UI-004 10 状態が幅 1440 で開き、横のはみ出しが 0", async ({ page }) => {
  await guard(page);
  for (const id of MINE) {
    await openState(page, id, 1440);
    expect(await overflowX(page), `${id} が幅 1440 で横にはみ出す`).toBeLessThanOrEqual(0);
  }
});

test("K671-UI-005 kn-must-full：小窓が「会社の「必ず守る」は 30 個までです」と言い、いま付いているページ（30）から外すボタンが並ぶ（付けるページの題名が出る）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-must-full", 1440);
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText("会社の「必ず守る」は 30 個までです", { exact: true })).toBeVisible();
  await expect(dlg.getByText("いま付いているページ（30）", { exact: true })).toBeVisible();
  await expect(dlg.getByText("ほか 15 個", { exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: /の「必ず守る」を外す$/ }).first()).toBeVisible();
  await expect(dlg.getByRole("button", { name: "閉じる", exact: true })).toBeVisible();
});

test("K671-UI-006 kn-raise：上げる先（営業の棚）・承認する人・入れるフォルダ・ひとことが出て、「上げるのを頼む」が主ボタン", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-raise", 1440);
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText("営業の棚", { exact: true })).toBeVisible();
  await expect(dlg.getByText("佐藤 花子さん（営業のマネージャー）", { exact: true })).toBeVisible();
  await expect(dlg.getByRole("textbox", { name: "ひとこと", exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "上げるのを頼む", exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "やめる", exact: true })).toBeVisible();
});

test("K671-UI-007 kn-raise-waiting：帯に「取り下げる」だけが出て、「上の棚に上げる」は出さない（承認待ちの間）・木の行に承認待ちの印", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-raise-waiting", 1440);
  await expect(page.getByText("営業の棚に上げるのを頼んでいます", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "取り下げる", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "上の棚に上げる", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("承認待ち", { exact: true }).first()).toBeVisible();
});

test("K671-UI-008 kn-raise-declined：断られた帯に理由が出て、「直してもう一度頼む」「このお知らせを消す」が押せる形", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-raise-declined", 1440);
  await expect(page.getByText("営業の棚に上げるのを断られました", { exact: true })).toBeVisible();
  await expect(page.getByText(/5% まで/)).toBeVisible();
  await expect(page.getByRole("button", { name: "直してもう一度頼む", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "このお知らせを消す", exact: true })).toBeEnabled();
});

test("K671-UI-009 kn-approvals：管理の「承認待ち」の一覧に、頼みごとの「中身を見る」「断る…」「承認する」が並ぶ", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-approvals", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "承認する", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "断る…", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "中身を見る", exact: true }).first()).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("部署");
});

test("K671-UI-010 kn-approvals：断る形のカードには「断る理由」の欄（理由が入っている）と「やめる」「断る」が出て、そのカードに「承認する」は出ない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-approvals", 1440);
  const reason = page.getByRole("textbox", { name: /断る理由/ });
  await expect(reason).toHaveCount(1);
  await expect(reason).toHaveValue(/見積書の出し方/);
  const card = page.getByRole("listitem").filter({ has: reason });
  await expect(card.getByRole("button", { name: "断る", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "承認する", exact: true })).toHaveCount(0);
});

test("K671-UI-011 kn-share：小窓「グループを選んで共有」に、見せるグループ（承認する人つき）が並び、共有している物は選べない・主ボタンに選んだ数が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-share", 1440);
  const dlg = page.getByRole("dialog", { name: "グループを選んで共有", exact: true });
  await expect(dlg.getByText("見せるグループ", { exact: true })).toBeVisible();
  await expect(dlg.getByRole("checkbox", { name: /受託開発/ })).toBeChecked();
  await expect(dlg.getByRole("checkbox", { name: /法務/ })).toBeDisabled();
  await expect(dlg.getByRole("button", { name: "1 つのグループに共有を頼む", exact: true })).toBeVisible();
});

test("K671-UI-012 kn-shared-view：共有された側は帯に「営業から共有されたページです」が出て、主ボタンは「写して直す」・「直す」は出ない", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-shared-view", 1440);
  await expect(page.getByText("営業から共有されたページです", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "写して直す", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "直す", exact: true })).toHaveCount(0);
});

test("K671-UI-013 kn-copy：写しの帯に元のページの名前と「元のページを開く」が出て、「必ず守る」の元なら「上が効きます」が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-copy", 1440);
  await expect(page.getByRole("button", { name: "元のページを開く", exact: true })).toBeVisible();
  await expect(page.getByText("上が効きます", { exact: true })).toBeVisible();
  await expect(page.getByLabel("写し", { exact: true }).first()).toBeVisible();
});

test("K671-UI-014 kn-similar：書き終える前の小窓「似たページがあります」に似たページが並び、「戻って直す」と「このまま作る」が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-similar", 1440);
  const dlg = page.getByRole("dialog", { name: "似たページがあります", exact: true });
  await expect(dlg.getByRole("list", { name: "似たページ", exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "戻って直す", exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "このまま作る", exact: true })).toBeVisible();
});

test("K671-UI-015 kn-review：「見直すページ」に 3 つ（使われていない・食い違っている・よく破られる）の一覧が並び、各行に開く／並べて見る／書き方を直すが出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-review", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "見直すページ", exact: true })).toBeVisible();
  for (const n of ["使われていないページ", "食い違っているページ", "よく破られる決まり"]) {
    await expect(page.getByRole("heading", { name: new RegExp(n) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /を並べて見る$/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /の書き方を直す$/ }).first()).toBeVisible();
});

test("K671-UI-016 kn-review：食い違いの説明が「会社 › グループ › 自分」の順で、画面に「部署」の字が無い", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-review", 1440);
  await expect(page.getByText("会社 › グループ › 自分 の順", { exact: false })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("部署");
});

test("K671-UI-017 幅 375 でも小窓が画面に収まり、足のボタン「閉じる」が画面の中に見える（kn-must-full）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "kn-must-full", 375);
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("button", { name: "閉じる", exact: true })).toBeInViewport();
  const box = await dlg.boundingBox();
  expect(box && box.y >= 0 && box.y + box.height <= 812, "小窓が画面からはみ出す").toBe(true);
});
