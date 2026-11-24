// K-682「ナレッジの画面の入れ物（/knowledge・/knowledge/<ページの id>）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-tree・kn-empty・kn-loading・kn-failed・kn-noaccess・kn-drawer（本番と同じ部品 features/F9/knowledge・代表 OK 2026-11-22）。
//   外枠は TicketShell（screen="knowledge"）。モックとの見た目の比べ方は f9-match.ts の matchF9（見出しが無い状態もある）。
//   ログイン・外枠・役（RequireRole）は本物（signupViaApi・loginAs）。ナレッジの口（K-676・K-677）だけを網の手前で差し替える（knowledge-mock.ts）。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi, viewerViaApi } from "../_lib/api";
import { F9_WIDTHS, matchF9 } from "./f9-match";
import {
  P_EXPENSE,
  P_GONE,
  P_INVOICE,
  P_MAIL,
  err,
  mockKnowledge,
  msg,
  pageInvoice,
  treeEmpty,
  treeSuzu,
  treeTaka,
  type KMock,
  type PageAnswer,
} from "./knowledge-mock";

const TREE = 'aside[aria-label="ナレッジの木"]';
const CARD = "article.k-f9-card";
const NODE = `${TREE} a.k-f9-node`;
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, path: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(path);
}
async function openInvoice(page: Page, width = 1440): Promise<void> {
  await openAt(page, `/knowledge/${P_INVOICE}`, width);
  await expect(
    page.locator(CARD).getByRole("heading", { name: "請求書の送り方", level: 1, exact: true }),
  ).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
/** 下絵の木は「経理」「見積もり」を開いた形（features/F9/knowledge/samples.tsx の open）。本番の木は開いているページの親だけを開くので、
 *  ほかの開いているフォルダを押して開く。幅 1023 以下は木が引き出しで隠れている（下絵も隠れている）ので、木が見える幅か引き出しを開いた後だけ押す */
async function openLikeMock(page: Page, folders: readonly string[]): Promise<void> {
  for (const name of folders) await page.locator(TREE).getByRole("button", { name, exact: true }).click();
}
const wide = (w: number): boolean => w >= 1024;
const STATES: Record<string, (page: Page, width: number) => Promise<KMock>> = {
  "kn-tree": async (page, w) => {
    const mk = await mockKnowledge(page);
    await openInvoice(page, w);
    if (wide(w)) await openLikeMock(page, ["見積もり"]); // 経理は開いているページの親なので初めから開いている
    return mk;
  },
  "kn-empty": async (page, w) => {
    const mk = await mockKnowledge(page, { tree: treeEmpty(), pages: [] });
    await openAt(page, "/knowledge", w);
    await expect(page.getByText("まだページがありません", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "最初のページを書く", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    ); // 動きを差し込む葉（K-684）が入るまでは押せない形
    return mk;
  },
  "kn-loading": async (page, w) => {
    const mk = await mockKnowledge(page);
    mk.hold("tree");
    await openAt(page, "/knowledge", w);
    await expect(page.getByRole("status", { name: "木を読み込んでいます", exact: true })).toBeVisible();
    return mk;
  },
  "kn-failed": async (page, w) => {
    const mk = await mockKnowledge(page);
    mk.tree.admin_counts = { approvals: 0, review: 0 }; // 下絵 kn-failed の管理の数は 0
    mk.script("page", "network", "network"); // 下絵 kn-failed は網の切れ（E-PAGE-007）
    await openAt(page, `/knowledge/${P_INVOICE}`, w);
    await expect(page.locator(`${CARD} [data-state="error"]`)).toBeVisible();
    if (wide(w)) await openLikeMock(page, ["見積もり"]);
    return mk;
  },
  "kn-noaccess": async (page, w) => {
    const mk = await mockKnowledge(page, { tree: treeSuzu() }); // 下絵 kn-noaccess は鈴木さん（担当者）の木
    await openAt(page, `/knowledge/${P_GONE}`, w);
    await expect(page.locator(`${CARD} [data-code="E-PAGE-002"]`)).toBeVisible();
    if (wide(w)) await openLikeMock(page, ["経理", "見積もり"]); // 見られないページには親が無いので、どれも初めは閉じている
    return mk;
  },
  "kn-drawer": async (page, w) => {
    const mk = await mockKnowledge(page);
    await openInvoice(page, w);
    if (!wide(w)) await page.getByRole("button", { name: "木を開く", exact: true }).click();
    await openLikeMock(page, ["見積もり"]);
    return mk;
  },
};
// 帯の操作は、動きを差し込む葉（K-691 ほか）が入るまで押せない形（aria-disabled・薄い）。下絵は動きを渡さない今の見た目なので、
//   帯の先頭のボタンの濃さ（opacity）だけは比べない（位置・大きさ・字・色は比べる）
const SKIP = ["acts:opacity"] as const;
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of F9_WIDTHS) {
    test(`K682-UI-001 ${id} 幅 ${w}：外枠の中の本文（木・ページの枠・題名・印・足元・状態の箱）の位置と大きさと字がモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchF9(
        browser,
        id,
        w,
        async (page) => {
          await drive(page, w);
        },
        { skip: SKIP },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く・読む
test("K682-UI-002 /knowledge を開くと木の口を 1 回だけ読む（ページの口は 0 回）・本文の場所に「左の木からページを選んでください」（仮）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openAt(page, "/knowledge");
  await expect(page.locator(TREE).getByRole("heading", { name: "会社", exact: true })).toBeVisible();
  expect(mk.count("tree")).toBe(1);
  expect(mk.count("page")).toBe(0);
  await expect(page.getByText("左の木からページを選んでください", { exact: true })).toBeVisible();
});

test("K682-UI-003 左のバーの「ナレッジ」が押せて、押すと /knowledge に移り今の場所の印が付く（作った道の一覧に入っている）", async ({
  page,
}) => {
  await mockKnowledge(page);
  await openAt(page, "/tickets"); // 左のバーがある作った画面（チケットの一覧）から入る
  const nav = page.getByRole("link", { name: "ナレッジ", exact: true });
  await expect(nav).not.toHaveAttribute("aria-disabled", "true");
  await nav.click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(nav).toHaveAttribute("aria-current", "page");
});

test("K682-UI-004 木：棚は 3 つ（会社・グループ・自分）・フォルダとページ・「必ず守る」の印・共有の印・グループの札・足す「＋」は書ける棚にだけ", async ({
  page,
}) => {
  await mockKnowledge(page);
  await openInvoice(page);
  const tree = page.locator(TREE);
  for (const s of ["会社", "グループ", "自分"])
    await expect(tree.getByRole("heading", { name: s, exact: true })).toBeVisible();
  await expect(tree.getByText("ENGINE BASE", { exact: true })).toBeVisible();
  await expect(tree.locator('[data-mark="must"]').first()).toBeVisible();
  await expect(tree.getByText("共有", { exact: true })).toBeVisible();
  await expect(tree.getByText("EG", { exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "会社の棚にページかフォルダを足す", exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "営業の棚にページかフォルダを足す", exact: true })).toHaveCount(0);
  await expect(tree.getByRole("button", { name: "自分の棚にページかフォルダを足す", exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "ページ", exact: true })).toBeVisible(); // 面の切り替え（管理の数は管理者・マネージャーにだけ）
});

test("K682-UI-005 フォルダを押すと開き閉じる（口は呼ばない）・いま開いているページの親は初めから開いている・押したフォルダは選ばれた形のまま", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openInvoice(page);
  const tree = page.locator(TREE);
  const keiri = tree.getByRole("button", { name: "経理", exact: true });
  await expect(keiri.locator("xpath=ancestor::li[1]")).toHaveAttribute("aria-expanded", "true");
  const cs = tree.getByRole("button", { name: "お客さま対応", exact: true });
  await expect(cs.locator("xpath=ancestor::li[1]")).toHaveAttribute("aria-expanded", "false");
  const before = mk.calls.length;
  await cs.click();
  await expect(cs.locator("xpath=ancestor::li[1]")).toHaveAttribute("aria-expanded", "true");
  await cs.click();
  await expect(cs.locator("xpath=ancestor::li[1]")).toHaveAttribute("aria-expanded", "false");
  expect(mk.calls.length, "開け閉めで口を呼んだ").toBe(before);
});

test("K682-UI-006 木のページを押すと /knowledge/<id> に移り、そのページの口を 1 回だけ読む（木は読み直さない）・押したページに今の場所の印", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openInvoice(page);
  await page.locator(NODE).filter({ hasText: "経費の精算" }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_EXPENSE}$`));
  await expect(page.locator(CARD).getByRole("heading", { name: "経費の精算", level: 1, exact: true })).toBeVisible();
  await expect(page.locator(NODE).filter({ hasText: "経費の精算" })).toHaveAttribute("aria-current", "page");
  expect(mk.count("tree")).toBe(1);
  expect(mk.count("page", P_EXPENSE)).toBe(1);
});

test("K682-UI-007 直に /knowledge/<id> を開く：木とページの口を同時に 1 回ずつ（直列にしない・二重に読まない）・開き直しても同じ結果", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  const release = mk.hold("tree");
  await openAt(page, `/knowledge/${P_INVOICE}`);
  await expect.poll(() => mk.count("page", P_INVOICE), "木の答えを待たずにページを読み始める").toBe(1);
  release();
  await expect(
    page.locator(CARD).getByRole("heading", { name: "請求書の送り方", level: 1, exact: true }),
  ).toBeVisible();
  expect(mk.count("tree")).toBe(1);
  await page.reload();
  await expect(
    page.locator(CARD).getByRole("heading", { name: "請求書の送り方", level: 1, exact: true }),
  ).toBeVisible();
  expect(mk.count("tree")).toBe(2);
  expect(mk.count("page", P_INVOICE)).toBe(2);
});

test("K682-UI-008 ページの字：題名・1 行の説明・場所（会社 › 経理）・本文（aria-label『本文』）・足元の 1 行・「必ず守る」の 1 行", async ({
  page,
}) => {
  await mockKnowledge(page);
  await openInvoice(page);
  const card = page.locator(CARD);
  await expect(card.getByText("請求書を取引先に送る前に確かめることと、送り方の順番。", { exact: true })).toBeVisible();
  await expect(card.locator(".k-f9-place")).toContainText("会社");
  await expect(card.locator(".k-f9-place")).toContainText("経理");
  await expect(card.getByLabel("本文", { exact: true })).toContainText(
    "宛先が、取引先に登録してある経理の連絡先と合っている",
  );
  await expect(card.locator(".k-f9-pfoot")).toHaveText(
    "最後に直した：高本 聖斗 11/18 ・ 版 4 ・ AI がこの 30 日に開いた：12 回",
  );
  await expect(card.locator(".k-f9-mustline")).toContainText("AI に毎回このページを全部渡します");
});

const BANDS: [string, Partial<PageAnswer>, string][] = [
  [
    "承認待ち",
    {
      request: {
        id: "r1",
        kind: "raise",
        state: "waiting",
        to_name: "営業",
        who_name: "鈴木 一郎",
        at: "11/21 16:20",
        reason: null,
        can_withdraw: true,
      },
      acts: ["must-off", "edit"],
    },
    "営業の棚に上げるのを頼んでいます",
  ],
  [
    "断られた",
    {
      request: {
        id: "r2",
        kind: "raise",
        state: "declined",
        to_name: "営業",
        who_name: "佐藤 花子",
        at: "11/21 17:00",
        reason: "似たページがあります",
        can_withdraw: false,
      },
    },
    "営業の棚に上げるのを断られました",
  ],
  [
    "写し",
    { copied_from: { page_id: P_EXPENSE, title: "請求書の送り方", shelf_name: "会社", must: true, gone: false } },
    "会社の写しです",
  ],
  [
    "共有された",
    { shared_from: { group_name: "営業", writable: false }, acts: ["copy"] },
    "営業から共有されたページです",
  ],
];
for (const [name, over, title] of BANDS)
  test(`K682-UI-009 ページの上の帯の出し分け（${name}）：口の答え（request・copied_from・shared_from）から帯の題が出る・出ない答えのときは帯が無い`, async ({
    page,
  }) => {
    await mockKnowledge(page, { pages: [pageInvoice(over)] });
    await openInvoice(page);
    await expect(
      page.locator(CARD).locator(".k-band").getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  });

test("K682-UI-010 帯の操作は口の答えの acts のとおり（役の名前では決めない）：書ける人は「直す」・共有された側は主ボタン「写して直す」だけで「直す」は無い・承認待ちの間は「上の棚に上げる」が無い", async ({
  page,
}) => {
  await mockKnowledge(page, {
    pages: [pageInvoice({ acts: ["copy"], shared_from: { group_name: "営業", writable: false } })],
  });
  await openInvoice(page);
  const acts = page.locator(`${CARD} .k-f9-acts`);
  await expect(acts.getByRole("button", { name: "写して直す", exact: true })).toHaveAttribute(
    "data-variant",
    "primary",
  );
  await expect(acts.getByRole("button", { name: "直す", exact: true })).toHaveCount(0);
  await expect(acts.getByRole("button", { name: "上の棚に上げる", exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- 空・読み込み中・読めない・見られない
test("K682-UI-013 読み込み中：木の答えを止めている間は木が読み込み中の形（status）・本文は「読み込んでいます…」・ページの題名はまだ出ない・答えると木が出る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  const release = mk.hold("tree");
  await openAt(page, "/knowledge");
  await expect(page.getByRole("status", { name: "木を読み込んでいます", exact: true })).toBeVisible();
  await expect(page.getByText("読み込んでいます…", { exact: true })).toBeVisible();
  release();
  await expect(page.locator(TREE).getByRole("heading", { name: "会社", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "木を読み込んでいます", exact: true })).toHaveCount(0);
});

test("K682-UI-014 木が読めない（503・網の切れ）：木と本文の場所に読めなかった旨（E-PAGE-003・E-PAGE-007 の文）と「もう一度読む」・押すと読み直して木が出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("tree", err(503, "E-PAGE-003"));
  await openAt(page, "/knowledge");
  const box = page.locator('[data-state="error"]');
  await expect(box).toHaveAttribute("data-code", "E-PAGE-003");
  await expect(box).toContainText(msg("E-PAGE-003").slice(0, 8));
  await box.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(TREE).getByRole("heading", { name: "会社", exact: true })).toBeVisible();
  expect(mk.count("tree")).toBe(2);
  const mk2 = await mockKnowledge(page);
  mk2.script("tree", "network");
  await page.goto("/knowledge");
  await expect(page.locator('[data-state="error"]')).toHaveAttribute("data-code", "E-PAGE-007");
});

test("K682-UI-015 ページが読めない（503・網の切れ）：本文の場所に読めなかった旨と「もう一度読む」・木はそのまま・書いたものは何も無い・押すと読み直して本文が出る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("page", err(503, "E-PAGE-003"), "network");
  await openAt(page, `/knowledge/${P_INVOICE}`);
  const box = page.locator(`${CARD} [data-state="error"]`);
  await expect(box).toHaveAttribute("data-code", "E-PAGE-003");
  await expect(page.locator(TREE).getByRole("heading", { name: "会社", exact: true })).toBeVisible();
  await box.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(`${CARD} [data-state="error"]`)).toHaveAttribute("data-code", "E-PAGE-007");
  await page.locator(CARD).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(
    page.locator(CARD).getByRole("heading", { name: "請求書の送り方", level: 1, exact: true }),
  ).toBeVisible();
  expect(mk.count("page", P_INVOICE)).toBe(3);
  expect(mk.count("tree")).toBe(1);
});

test("K682-UI-016 見られないページ（口が 404）：本文の場所に「見られない」旨（E-PAGE-002）と一手 2 つ（「マネージャーに頼む」は押せない形・「戻る」）・戻るで /knowledge に移る・木は読み直さない", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  const urls: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) urls.push(f.url());
  });
  await openAt(page, `/knowledge/${P_GONE}`);
  const box = page.locator(`${CARD} [data-code="E-PAGE-002"]`);
  await expect(box).toBeVisible();
  await expect(box.getByRole("button")).toHaveCount(2);
  const ask = box.getByRole("button", { name: "マネージャーに頼む", exact: true });
  await expect(ask).toHaveAttribute("aria-disabled", "true"); // 頼む口がまだ無い（代表の答え answer=21b765e5e0c8）
  urls.length = 0;
  await ask.click({ force: true });
  await expect(box).toBeVisible(); // 押しても箱はそのまま
  await expect(ask).toHaveAttribute("aria-disabled", "true");
  await box.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  expect(
    urls.map((u) => new URL(u).pathname),
    "道の移りは「戻る」の 1 回だけ（頼むでは移らない）",
  ).toEqual(["/knowledge"]);
  expect(mk.count("tree")).toBe(1);
});

for (const bad of ["abc", "00000000-0000-0000-0000-000000000000"])
  test(`K682-UI-017 道の id が不正（${bad}）：口は 404 で「見られない」画面（E-PAGE-002）・口 1 回・欄や詳しい理由は出ない`, async ({
    page,
  }) => {
    const mk = await mockKnowledge(page);
    await openAt(page, `/knowledge/${bad}`);
    await expect(page.locator(`${CARD} [data-code="E-PAGE-002"]`)).toBeVisible();
    expect(mk.count("page")).toBe(1);
  });

test("K682-UI-018 別の会社のページ・消えたページを古いリンクで開く：口が 404 を返し、中身も題名も出ず「見られない」画面だけ（どちらかを知らせない）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("page", err(404, "E-PAGE-001"));
  await openAt(page, `/knowledge/${P_EXPENSE}`);
  await expect(page.locator(`${CARD} [data-code="E-PAGE-002"]`)).toBeVisible();
  await expect(page.getByText("経費の精算", { exact: true })).toHaveCount(1); // 木の行だけ（本文の題名は出ない）
  await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toHaveCount(0);
});

test("K682-UI-019 閲覧のみの人が直に開く：「いまの権限では開けません」・ナレッジの口は 0 回", async ({ page }) => {
  const mk = await mockKnowledge(page);
  const viewer = await viewerViaApi();
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, viewer.token);
  await page.goto("/knowledge");
  await expect(page.getByText("いまの権限では開けません", { exact: true })).toBeVisible();
  expect(mk.calls.length).toBe(0);
});

test("K682-UI-020 権限が外れた直後（開いていた画面で別のページを押す）：口が 404 を返し「見られない」画面・木はそのまま（画面の表示に頼らず口が止める）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openInvoice(page);
  mk.script("page", err(404, "E-PAGE-001"));
  await page.locator(NODE).filter({ hasText: "経費の精算" }).click();
  await expect(page.locator(`${CARD} [data-code="E-PAGE-002"]`)).toBeVisible();
  await expect(page.locator(NODE).filter({ hasText: "経費の精算" })).toBeVisible();
});

test("K682-UI-021 見えない物は木にも数にも出ない：木に載っていないページは出ず、管理の数は口が返したときだけ（admin_counts が無い人には「管理」の切り替えが無い）", async ({
  page,
}) => {
  const tree = treeTaka();
  tree.admin_counts = null;
  tree.company_nodes = tree.company_nodes.filter((n) => n.id !== P_MAIL);
  await mockKnowledge(page, { tree });
  await openInvoice(page);
  await expect(page.locator(TREE).getByRole("tab", { name: /^管理/ })).toHaveCount(0);
  await expect(page.locator(NODE).filter({ hasText: "メールの書き方" })).toHaveCount(0);
});

test("K682-UI-022 幅 1023 以下：木は引き出し（本文の上に「木を開く」）・開くと幕と「木を閉じる」・幕を押す・Esc・ページを押すと閉じる・幅 1024 以上は横に並んで幕が無い", async ({
  page,
}) => {
  await mockKnowledge(page);
  await openInvoice(page, 375);
  const tree = page.locator(TREE);
  await expect(tree).not.toBeInViewport();
  await page.getByRole("button", { name: "木を開く", exact: true }).click();
  await expect(tree).toBeInViewport();
  await expect(page.locator(".k-f9-scrim")).toBeVisible();
  await tree.getByRole("button", { name: "木を閉じる", exact: true }).click();
  await expect(tree).not.toBeInViewport();
  await page.getByRole("button", { name: "木を開く", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(tree).not.toBeInViewport();
  await page.getByRole("button", { name: "木を開く", exact: true }).click();
  await page.locator(".k-f9-scrim").click({ position: { x: 360, y: 400 } });
  await expect(tree).not.toBeInViewport();
  await page.getByRole("button", { name: "木を開く", exact: true }).click();
  await tree.locator("a.k-f9-node").filter({ hasText: "経費の精算" }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_EXPENSE}$`));
  await expect(tree).not.toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(tree).toBeInViewport();
  await expect(page.locator(".k-f9-scrim")).toHaveCount(0);
});

test("K682-UI-023 幅 320・375・768・1024・1440：横のはみ出し 0（数値）・長い題名が出ても 0・木を開いた引き出しでも 0", async ({
  page,
}) => {
  const long = "とても長い題名のページ".repeat(12);
  const tree = treeTaka();
  tree.company_nodes.push({
    kind: "page",
    id: "0193c5a0-0000-7000-8000-00000000a0aa",
    title: long,
    must: false,
    mark: null,
  });
  await mockKnowledge(page, { tree, pages: [pageInvoice({ title: long })] });
  await loginAs(page, owner.token);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.goto(`/knowledge/${P_INVOICE}`);
    await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    if (w < 1024) {
      await page.getByRole("button", { name: "木を開く", exact: true }).click();
      expect(await overflowX(page), `幅 ${w}・引き出し`).toBeLessThanOrEqual(0);
    }
  }
});

test("K682-UI-024 題名・説明・棚・フォルダの名前に HTML やスクリプトが入っていても、文字として出て動かない（送られてきた字のまま）", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__xss=1">';
  const tree = treeTaka();
  tree.company_name = evil;
  tree.company_nodes[0]!.name = evil;
  await mockKnowledge(page, { tree, pages: [pageInvoice({ title: evil, desc: evil })] });
  await openInvoice0(page, evil);
  await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toHaveText(evil);
  await expect(page.locator(TREE).getByText(evil).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator(`${CARD} img[src="x"]`)).toHaveCount(0);
});
async function openInvoice0(page: Page, title: string): Promise<void> {
  await openAt(page, `/knowledge/${P_INVOICE}`);
  await expect(page.locator(CARD).getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
}

test("K682-UI-025 木が大きすぎて口が 5,000 で切ったとき（truncated）：木の下に「木が大きいので、一部だけ出しています」（仮）・切っていないときは出ない", async ({
  page,
}) => {
  const tree = treeTaka();
  tree.truncated = true;
  await mockKnowledge(page, { tree });
  await openInvoice(page);
  await expect(page.locator(TREE).getByText("木が大きいので、一部だけ出しています", { exact: true })).toBeVisible();
  await mockKnowledge(page);
  await page.goto(`/knowledge/${P_INVOICE}`);
  await expect(page.locator(TREE).getByText("木が大きいので、一部だけ出しています", { exact: true })).toHaveCount(0);
});

test("K682-UI-026 キーボードだけ：Tab で木のフォルダ → Enter で開閉・ページに Tab → Enter で開く・20 回 Tab しても焦点が画面の外へ出ない", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openInvoice(page);
  const cs = page.locator(TREE).getByRole("button", { name: "お客さま対応", exact: true });
  await cs.focus();
  await page.keyboard.press("Enter");
  await expect(cs.locator("xpath=ancestor::li[1]")).toHaveAttribute("aria-expanded", "true");
  const exp = page.locator(NODE).filter({ hasText: "経費の精算" });
  await exp.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_EXPENSE}$`));
  expect(mk.count("page", P_EXPENSE)).toBe(1);
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test("K682-UI-028 ブラウザの戻る・進む：前のページに戻り、もう一度開いたページは読み直さない（口は増えない）・木の開き閉じは残る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openInvoice(page);
  await page.locator(NODE).filter({ hasText: "経費の精算" }).click();
  await expect(page.locator(CARD).getByRole("heading", { name: "経費の精算", level: 1, exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.locator(CARD).getByRole("heading", { name: "請求書の送り方", level: 1, exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.locator(CARD).getByRole("heading", { name: "経費の精算", level: 1, exact: true })).toBeVisible();
  expect(mk.count("page", P_INVOICE)).toBe(1);
  expect(mk.count("page", P_EXPENSE)).toBe(1);
  expect(mk.count("tree")).toBe(1);
});
