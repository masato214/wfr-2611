// K-330「段 3 の部品とモックの画面を本線に入れる」の試験（実 Chrome と、ファイルと検査の道具を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f2（索引）と /dev/mock/f2/<状態>（1 つの状態）。本番と同じ部品（features/F2/invite/views.tsx・components/k）を、
//   決めた値で並べたモック（代表 OK 2026-11-18 answer=65b51ba7b8ba・07_functional/段3-F2/機能分解.md）。
//   見ること：23 の状態（段 3 の 15・K-423 の 8）が全部描ける・幅 375／768／1440 で横のはみ出し 0・見出しは真ん中（代表の直し）・状態の持ち主が切り方の画面の葉・
//   「あなたに見えるもの」を出さない（answer=7fe1f09fdab4 ⑥）・正本の値の検査が緑。
//   口は呼ばない（モックは値を決めて並べるだけ）。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const MOCKS_SRC = join(WEB, "app/(dev)/dev/mock/f2/mocks.tsx");
const VIEWS_SRC = join(WEB, "features/F2/invite/views.tsx");
const CUT_DOC = join(ROOT, "07_functional/段3-F2/切り方.md");
const SHOTS_SRC = join(ROOT, "07_functional/段3-F2/mock-shots.mjs");

/** 画面の葉と、その葉が本物にするモックの状態（mocks.tsx の受け持ちと 07_functional/段3-F2/切り方.md の表のとおり・段 3 の 15 個）。
 *  K-423（段 9 の前に出す招待のリンク・確認の画面・PM の決め 2026-11-20）が同じ置き場に 8 個を足した（計 23 個） */
const LEAVES: Record<string, readonly string[]> = {
  "K-335": [
    "inv-new",
    "inv-new-error",
    "inv-new-nomsg",
    "inv-expired",
    "inv-resent",
    "inv-resent-already",
    "inv-revoked",
    "inv-used",
    "inv-notfound",
    "inv-wait",
    "inv-down",
  ],
  "K-336": ["inv-account", "inv-signed", "inv-other", "inv-member"],
  "K-423": [
    "inv-link-new",
    "inv-link-error",
    "inv-link-sent",
    "inv-link-failed",
    "inv-confirm",
    "inv-confirm-expired",
    "inv-confirm-used",
    "inv-confirm-down",
  ],
};
const ALL = Object.values(LEAVES).flat();
const OWNER = new Map(Object.entries(LEAVES).flatMap(([k, ids]) => ids.map((id) => [id, k] as const)));

function mockEntries(): { id: string; screen: string; ticket: string }[] {
  const src = readFileSync(MOCKS_SRC, "utf8");
  return [
    ...src.matchAll(/\{\s*id: "([^"]+)",\s*screen: "([^"]+)",\s*label: "[^"]*",\s*ticket: "([^"]+)",?\s*\}/g),
  ].map((m) => ({ id: m[1]!, screen: m[2]!, ticket: m[3]! }));
}

/** 切り方.md の表の「モックの状態（画面の葉）」の欄を、葉の番号ごとに読む。2 つめから頭（inv-）を省いた書き方を開く */
function cutDocLeaves(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of readFileSync(CUT_DOC, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 9 || !/^K-3\d\d$/.test(cells[1] ?? "")) continue;
    const raw = cells[6] ?? "";
    if (!raw.startsWith("inv-")) continue;
    out[cells[1]!] = raw.split("・").map((p) => (p.trim().startsWith("inv-") ? p.trim() : `inv-${p.trim()}`));
  }
  return out;
}

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}

async function openState(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f2/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K330-MK-001 モックの状態は 23 個で、画面の葉 3 本（K-335・K-336・K-423）が持つ状態の和とちょうど同じ（余りも欠けも重なりも 0）", () => {
  const ids = mockEntries().map((e) => e.id);
  expect(ids.length).toBe(23);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...ALL].sort());
});

test("K330-MK-002 各状態の持ち主（mocks.tsx の ticket）は、その状態を本物にする画面の葉（口の葉 K-331〜K-334 を指さない）", () => {
  const bad = mockEntries()
    .filter((e) => OWNER.get(e.id) !== e.ticket)
    .map((e) => `${e.id}：${e.ticket}（正は ${OWNER.get(e.id) ?? "無い"}）`);
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K330-MK-003 段 3 の切り方.md の表の画面の葉のモックの欄を開くと、この試験の葉の表（LEAVES の段 3 の葉 K-335・K-336）と同じ（正本とずれていない）", () => {
  const doc = cutDocLeaves();
  // K-423 は段 9 の葉（正本は 11_tickets/K-423.md の mock:）なので、段 3 の切り方.md とは比べない
  const stage3 = Object.entries(LEAVES).filter(([k]) => /^K-3\d\d$/.test(k));
  expect(Object.keys(doc).sort()).toEqual(stage3.map(([k]) => k).sort());
  for (const [k, ids] of stage3) expect([...(doc[k] ?? [])].sort(), k).toEqual([...ids].sort());
});

test("K330-MK-005 写しを撮る台本（mock-shots.mjs）は mocks.tsx の状態を全部（23 個）、幅 375・768・1440 で撮る", () => {
  const src = readFileSync(SHOTS_SRC, "utf8");
  expect(src).toContain("app/(dev)/dev/mock/f2/mocks.tsx");
  expect(src).toContain("localhost:3341/dev/mock/f2");
  expect(src).toMatch(/for \(const w of \[375, 768, 1440\]\)/);
});

test("K330-MK-006 部品は見た目だけ：views.tsx は口を呼ばない（fetch・api・useEffect・router を使わない）・生の色や大きさを書かない（style= と #色 と px が無い）・新しい CSS を足さない（段 1・段 2 の入口の部品の class だけ）", () => {
  const src = readFileSync(VIEWS_SRC, "utf8");
  expect(src).not.toMatch(/\bfetch\(|lib\/api|useEffect|useRouter|from "@\/lib\/auth/);
  expect(src).not.toMatch(/style=\{|#[0-9a-fA-F]{3,6}\b|\d+px/);
  expect(src).not.toMatch(/import "\.\/[^"]+\.css"/);
});

test("K330-MK-007 「あなたに見えるもの」は出さない（answer=7fe1f09fdab4 ⑥）：views.tsx にもモックにもその見出しが無い", () => {
  expect(readFileSync(VIEWS_SRC, "utf8")).not.toContain("あなたに見えるもの");
  expect(readFileSync(MOCKS_SRC, "utf8")).not.toContain("あなたに見えるもの");
});

// ---- 正本の値の検査（CI の static の段と同じ命令） ----

test("K330-DS-001 design_gate の D1〜D7（--part --scales --usage）が緑：段 3 の部品が正本の値だけを使う", () => {
  const out = runPy([
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
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
});

// ---- 実ブラウザ：全部の状態が描ける ----

test("K330-UI-001 索引 /dev/mock/f2：見出し invite-accept と 23 のリンクが出て、各リンクの先は /dev/mock/f2/<状態>", async ({
  page,
}) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f2"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["invite-accept"]);
  const hrefs = await page.locator("main a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect([...hrefs].sort()).toEqual(ALL.map((id) => `/dev/mock/f2/${id}`).sort());
});

for (const [row, w] of [
  ["K330-UI-002", 375],
  ["K330-UI-003", 768],
  ["K330-UI-004", 1440],
] as const) {
  test(`${row} 幅 ${w}：23 の状態が全部開け（200）、「この状態はありません」が出ず、h1 がちょうど 1 つで真ん中そろえ（代表の直し answer=65b51ba7b8ba）・横のはみ出し 0`, async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await guard(page);
    const bad: string[] = [];
    for (const id of ALL) {
      await openState(page, id, w);
      if ((await page.getByText("この状態はありません").count()) > 0) bad.push(`${id}：無い状態`);
      const h1 = page.locator("h1");
      if ((await h1.count()) !== 1) bad.push(`${id}：h1 が ${await h1.count()} 個`);
      else if ((await h1.evaluate((e) => getComputedStyle(e).textAlign)) !== "center")
        bad.push(`${id}：h1 が真ん中でない`);
      const over = await overflowX(page);
      if (over !== 0) bad.push(`${id}：横に ${over}px はみ出す`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K330-UI-005 幅 1440：23 の状態を開いても、ページのエラー（pageerror）と描き直しの食い違い（hydration）の知らせが 0", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await guard(page);
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errs.push(m.text());
  });
  for (const id of ALL) await openState(page, id, 1440);
  expect(errs, errs.join("\n")).toEqual([]);
});

test("K330-UI-006 1 画面 1 主アクション：どの状態も、見えていて押せる主ボタン（data-variant=primary）は 1 つまで", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await guard(page);
  const bad: string[] = [];
  for (const id of ALL) {
    await openState(page, id, 1440);
    const n = await page
      .locator('.k-btn[data-variant="primary"]:visible:not([disabled]):not([aria-disabled="true"])')
      .count();
    if (n > 1) bad.push(`${id}：主ボタンが ${n} 個`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K330-UI-007 新しく作って参加（inv-new）：頭文字の印・「〈ワークスペース〉に招待されています」・招いた人とグループと役割・ひとこと・メールは読むだけ・名前・パスワード（見る／隠すを押せる・D-087.1）・「参加する」・規約とプライバシーへのリンク・「ログインして入る」（/login?next=…）・期限の日", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "inv-new", 1440);
  await expect(page.locator("h1")).toHaveText("株式会社ENGINE BASE に招待されています");
  await expect(page.getByText("高本 聖斗 さんから ・ 経理グループの メンバー として")).toBeVisible();
  await expect(page.locator('[data-part="invite-message"]')).toContainText("経理の月次をいっしょに回してもらいます");
  await expect(page.getByLabel("メール")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("名前")).toBeEditable();
  const pw = page.getByLabel("パスワード", { exact: true });
  await expect(pw).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: /パスワードを(見る|表示)/ }).click();
  await expect(pw).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "参加する" })).toBeEnabled();
  // 同意の文（main の中）のリンク。枠の足元（nav「Kaname について」）にも同じ名前のリンクがあるので main に絞る
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/legal/terms");
  await expect(main.getByRole("link", { name: "プライバシー" })).toHaveAttribute("href", "/legal/privacy");
  await expect(main.getByText("に同意したことになる")).toBeVisible();
  await expect(page.getByRole("link", { name: "ログインして入る" })).toHaveAttribute(
    "href",
    /^\/login\?next=%2Finvite%2F/,
  );
  await expect(page.getByText("招待は 11/25 まで")).toBeVisible();
});

test("K330-UI-008 期限切れの 3 つ：inv-expired は「送り直しを頼む」が押せて文は「7 日の間使えます」（代表の直し）、inv-resent・inv-resent-already はボタンが押せず、それぞれの済んだ知らせ（role=status）が出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "inv-expired", 1440);
  await expect(page.getByRole("button", { name: "送り直しを頼む" })).toBeEnabled();
  await expect(page.getByText(/7 日の間使えます/)).toBeVisible();
  for (const [id, text] of [
    ["inv-resent", "送り直しを頼みました"],
    ["inv-resent-already", "今日はもう頼んであります"],
  ] as const) {
    await openState(page, id, 1440);
    await expect(page.getByRole("button", { name: "送り直しを頼む" })).toBeDisabled();
    await expect(page.getByText(text)).toBeVisible();
  }
});
