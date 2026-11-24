// K-691「必ず守る（付ける・外す・上限の小窓）と、書き終える前の似たページの小窓」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-must・kn-must-full・kn-similar（本番と同じ部品 features/F9/knowledge・K-670・K-671・代表 OK 2026-11-22）。モックとの比べ方は f9-match.ts の matchF9。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ナレッジの口は網の手前で差し替える（knowledge-mock.ts）。
//   必ず守る（K-685）と似たページ（K-686）の口は knowledge-must-mock.ts が足す。答えの形は 07_functional/段10-F9/土台-knowledge.md の 3.2。
//   本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない（口の数と答えを待つ・答えは hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { F9_WIDTHS, matchF9 } from "./f9-match";
import {
  H2,
  P,
  P_EXPENSE,
  P_INVOICE,
  P_NEW,
  doc,
  err,
  mockKnowledge,
  msg,
  pageExpense,
  pageInvoice,
  textOf,
  uid,
  type KMock,
  type PageAnswer,
} from "./knowledge-mock";
import { mockMustSimilar, type SimilarItem, type XMock } from "./knowledge-must-mock";

const TREE = 'aside[aria-label="ナレッジの木"]';
const CARD = "article.k-f9-card";
const EDIT = 'article[aria-label="ページを書いている"]';
const DLG = ".k-dialog";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const first = (s: string) => s.split("。")[0]!;
const toggle = (p: Page) => p.getByRole("button", { name: "必ず守る", exact: true });
const mustDlg = (p: Page) =>
  p
    .locator(DLG)
    .filter({ has: p.getByRole("heading", { name: "「必ず守る」は、これ以上付けられません", exact: true }) });
const simDlg = (p: Page) =>
  p.locator(DLG).filter({ has: p.getByRole("heading", { name: "似たページがあります", exact: true }) });
const done = (p: Page) => p.getByRole("button", { name: "書き終える", exact: true });

const M1 = uid(0xb001);
const M2 = uid(0xb002);
const LIST_A = [
  { id: M1, title: "メールの書き方", folder: "会社" },
  { id: M2, title: "外に出す前の確かめ", folder: "会社" },
];
const full = (pages = LIST_A) => err(409, "E-KNW-060", { detail: { shelf_name: "会社", limit: 30, pages } });
const okOff = (id: string, used: number) => ({
  status: 200,
  body: { data: { id, must: false, used, limit: 30 } },
});
const SIM: SimilarItem[] = [
  {
    id: P_INVOICE,
    title: "請求書の送り方",
    place: "会社 › 経理",
    desc: "請求書を取引先に送る前に確かめることと、送り方の順番。",
  },
  {
    id: uid(0xb010),
    title: "支払いの期日の決まり",
    place: "会社 › 経理",
    desc: "取引先ごとの締め日と、支払期日の決め方。",
  },
];

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function setup(page: Page, pages: PageAnswer[] = []): Promise<{ mk: KMock; x: XMock }> {
  const extra = LIST_A.map((p) => pageInvoice({ id: p.id, title: p.title, must: true, acts: ["must-off", "edit"] }));
  const mk = await mockKnowledge(page, { pages: [pageInvoice(), pageExpense(), ...extra, ...pages] });
  const x = await mockMustSimilar(page, mk);
  return { mk, x };
}
async function openAt(page: Page, id: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`/knowledge/${id}`);
  await expect(page.locator(CARD).or(page.locator(EDIT))).toBeVisible();
  if (width <= 1023)
    await page
      .getByRole("button", { name: "木を開く", exact: true })
      .click()
      .catch(() => undefined);
}
/** 経費の精算（公開済み・書ける）を「直す」で書いている画面にし、本文に 1 字足して「書き終える」の準備をする */
async function startWriting(page: Page, id = P_EXPENSE): Promise<void> {
  await openAt(page, id);
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(EDIT)).toBeVisible();
  await page.getByRole("textbox", { name: "本文", exact: true }).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("足した字");
}
async function openSimilar(page: Page, x: XMock): Promise<Locator> {
  x.similar = SIM;
  await startWriting(page);
  await done(page).click();
  const d = simDlg(page);
  await expect(d).toBeVisible();
  return d;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const prop = (role: string, sel: string, props: string[]) => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
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
const DLG_PAIRS = [
  prop("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  prop("dialog-title", ".k-dialog h2", ["x", "y", "font-size", "font-weight", "color", "line-height", "texts"]),
  prop("dialog-btn", ".k-dialog button[data-variant]", CTRL),
];
const MUST_PAIRS = [
  prop("acts", ".k-f9-acts button", CTRL),
  prop("mustline", ".k-f9-mustline", ["x", "width", "background-color", "font-size", "color", "texts"]),
];
const MUST_COMPANY = [
  ["請求書の送り方", "経理"],
  ["メールの書き方", "会社"],
  ["外に出す前の確かめ", "会社"],
  ["個人の情報の扱い", "会社"],
  ["取引先の名前の書き方", "お客さま対応"],
  ["お詫びのメールの決まり", "お客さま対応"],
  ["問い合わせへの最初の返事", "お客さま対応"],
  ["契約書を送る前の確かめ", "法務"],
  ["秘密を守る約束のある取引先", "法務"],
  ["値引きの上限", "経理"],
  ["支払いの期日の決まり", "経理"],
  ["休みの日の連絡", "会社"],
  ["ファイルの名前の付け方", "会社"],
  ["外の人に見せてよい資料", "会社"],
  ["AI に任せてはいけないこと", "会社"],
].map(([title, folder], i) => ({
  id: uid(0xb100 + i),
  title: title!,
  folder: folder === "会社" ? "会社" : `会社 › ${folder}`,
}));
const STATES: Record<string, { pairs: ReturnType<typeof prop>[]; drive: (page: Page, w: number) => Promise<void> }> = {
  "kn-must": {
    pairs: MUST_PAIRS,
    drive: async (page, w) => {
      await setup(page);
      await openAt(page, P_INVOICE, w);
      await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    },
  },
  "kn-must-full": {
    pairs: DLG_PAIRS,
    drive: async (page, w) => {
      const { x } = await setup(page);
      x.script("must", full(MUST_COMPANY));
      await openAt(page, P_EXPENSE, w);
      await toggle(page).click();
      await expect(mustDlg(page)).toBeVisible();
    },
  },
  "kn-similar": {
    pairs: DLG_PAIRS,
    drive: async (page, w) => {
      const { x } = await setup(page, [
        pageInvoice({
          id: P_NEW,
          title: "請求書を送る手順",
          desc: "請求書を送るときの順番と、気をつけること。",
          state: "draft",
          must: false,
          acts: [],
          body: null,
          draft: { doc: doc(H2("手順"), P("書き始めたばかり。")), saved_at: "2026-11-21T01:42:00Z" },
          place: { shelf: "me", shelf_name: "自分", group_id: null, folder_id: null, folders: [] },
        }),
      ]);
      x.similar = SIM;
      await openAt(page, P_NEW, w);
      await done(page).click();
      await expect(simDlg(page)).toBeVisible();
    },
  },
};
for (const [id, s] of Object.entries(STATES)) {
  for (const w of F9_WIDTHS) {
    test(`K691-UI-001 ${id} 幅 ${w}：押し込みの向き・小窓の位置と大きさと字がモックと同じ（matchF9 の bad が 0）`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchF9(
        browser,
        id,
        w,
        async (page) => {
          await s.drive(page, w);
        },
        { pairs: s.pairs },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 必ず守るを付ける・外す
test("K691-UI-002 付ける：経費の精算（付いていない）の「必ず守る」は押せる形で押し込みは外れている・押すと口 1 回（PUT /knowledge_pages/<id>/must・体は must=true だけ・冪等の鍵あり）→ ページと木を読み直し（口 2 回）押し込んだ形と「必ず守る」の 1 行と木の印が出る・お知らせ「「必ず守る」を付けました（会社の棚 9 / 30 件）」", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  await openAt(page, P_EXPENSE);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(toggle(page)).not.toHaveAttribute("aria-disabled", "true");
  const marks = await page.locator(`${TREE} [data-mark="must"]`).count();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".k-f9-mustline")).toContainText("AI に毎回このページを全部渡します");
  await expect(page.locator(".k-toast")).toContainText("「必ず守る」を付けました（会社の棚 9 / 30 件）");
  expect(x.count("must", P_EXPENSE)).toBe(1);
  expect(x.calls[0]!.body).toEqual({ must: true });
  expect(x.calls[0]!.key).toBeTruthy();
  expect(mk.count("page", P_EXPENSE)).toBe(2);
  expect(mk.count("tree")).toBe(2);
  await expect(page.locator(`${TREE} [data-mark="must"]`)).toHaveCount(marks + 1);
});

test("K691-UI-003 外す：請求書の送り方（付いている）の「必ず守る」は押し込んだ形・押すと must=false で口 1 回・押し込みが外れ「必ず守る」の 1 行が消える・お知らせ「「必ず守る」を外しました（会社の棚 7 / 30 件）」", async ({
  page,
}) => {
  const { x } = await setup(page);
  await openAt(page, P_INVOICE);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".k-f9-mustline")).toHaveCount(0);
  await expect(page.locator(".k-toast")).toContainText("「必ず守る」を外しました（会社の棚 7 / 30 件）");
  expect(x.calls[0]!.body).toEqual({ must: false });
});

test("K691-UI-004 本文が 2,000 字を超えるページ（must_blocked=too_long）：「必ず守る」は押せない形（aria-disabled）で、訳の文「本文が 2,000 字を超えているので、「必ず守る」は付けられません。」が見え、押しても口 0 回。口が先に 409 E-KNW-061 を返したときはお知らせ（失敗）に正本の文・ページを読み直す", async ({
  page,
}) => {
  const long = pageExpense();
  long.must_blocked = "too_long";
  const { mk, x } = await setup(page, []);
  mk.pages.set(P_EXPENSE, long);
  await openAt(page, P_EXPENSE);
  await expect(toggle(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator(".k-f9-note")).toHaveText(
    "本文が 2,000 字を超えているので、「必ず守る」は付けられません。",
  );
  await toggle(page).click({ force: true });
  expect(x.count("must")).toBe(0);
  mk.pages.set(P_EXPENSE, pageExpense());
  await page.reload();
  await expect(toggle(page)).not.toHaveAttribute("aria-disabled", "true");
  x.script("must", err(409, "E-KNW-061"));
  await toggle(page).click();
  await expect(page.locator(".k-toast-error")).toContainText(first(msg("E-KNW-061")));
  expect(mk.count("page", P_EXPENSE)).toBe(3);
});

test("K691-UI-005 上限に届いた（口が 409 E-KNW-060 と今付いている一覧を返す）：小窓「「必ず守る」は、これ以上付けられません」に「会社の「必ず守る」は 30 個までです」と今付いているページ（2）の題名と場所・付けようとしたページの場所つきの対象が出る・ページはそのまま（押し込みは外れ・読み直さない）", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  x.script("must", full());
  await openAt(page, P_EXPENSE);
  await toggle(page).click();
  const d = mustDlg(page);
  await expect(d).toBeVisible();
  await expect(d.getByText("会社の「必ず守る」は 30 個までです", { exact: true })).toBeVisible();
  await expect(d.getByText("会社 › 経理 › 経費の精算", { exact: true })).toBeVisible();
  const list = d.getByLabel("いま付いているページ", { exact: true });
  await expect(list.getByText("メールの書き方", { exact: true })).toBeVisible();
  await expect(list.getByText("いま付いているページ（2）", { exact: true })).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  expect(x.count("must")).toBe(1);
  expect(mk.count("page", P_EXPENSE)).toBe(1);
});

test("K691-UI-006 小窓で「外す」を押すと、そのページの「必ず守る」を外して（PUT must=false）続けてこのページに付ける（PUT must=true）：口は 3 本の順で、小窓が閉じ・ページと木を読み直して付いた形・お知らせ", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  x.script("must", full());
  await openAt(page, P_EXPENSE);
  await toggle(page).click();
  const d = mustDlg(page);
  await d.getByRole("button", { name: "メールの書き方の「必ず守る」を外す", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(x.calls.map((c) => [c.id, c.body["must"]])).toEqual([
    [P_EXPENSE, true],
    [M1, false],
    [P_EXPENSE, true],
  ]);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".k-toast")).toContainText("「必ず守る」を付けました");
  expect(mk.count("page", P_EXPENSE)).toBe(2);
  expect(mk.count("tree")).toBe(2);
});

for (const [name, reply, code] of [
  ["409 承認待ち", err(409, "E-KNW-011"), "E-KNW-011"],
  ["404 もう無い", err(404, "E-PAGE-001"), "E-PAGE-001"],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-008"],
] as const)
  test(`K691-UI-007 小窓の「外す」が失敗（${name}）：小窓の赤い箱に ${code} の文・一覧はそのまま・このページに付ける口は呼ばない（口は 2 本）・押し直せる`, async ({
    page,
  }) => {
    const { x } = await setup(page);
    x.script("must", full(), reply);
    await openAt(page, P_EXPENSE);
    await toggle(page).click();
    const d = mustDlg(page);
    await d.getByRole("button", { name: "メールの書き方の「必ず守る」を外す", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText(first(msg(code)));
    await expect(d.getByText("メールの書き方", { exact: true })).toBeVisible();
    expect(x.count("must")).toBe(2);
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await d.getByRole("button", { name: "メールの書き方の「必ず守る」を外す", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  });

test("K691-UI-008 外したあとの「続けて付ける」が失敗：また 409 E-KNW-060 なら一覧が新しい物に替わって小窓は開いたまま・503 なら赤い箱で、外したページは一覧から消えている", async ({
  page,
}) => {
  const { x } = await setup(page);
  const listB = [
    { id: M2, title: "外に出す前の確かめ", folder: "会社" },
    { id: uid(0xb003), title: "他の人が付けた決まり", folder: "会社" },
  ];
  x.script("must", full(), okOff(M1, 29), full(listB));
  await openAt(page, P_EXPENSE);
  await toggle(page).click();
  const d = mustDlg(page);
  await d.getByRole("button", { name: "メールの書き方の「必ず守る」を外す", exact: true }).click();
  await expect(d.getByText("他の人が付けた決まり", { exact: true })).toBeVisible();
  await expect(d.getByText("メールの書き方", { exact: true })).toHaveCount(0);
  expect(x.count("must")).toBe(3);
  x.script("must", okOff(M2, 28), err(503, "E-PAGE-003"));
  await d.getByRole("button", { name: "外に出す前の確かめの「必ず守る」を外す", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText(first(msg("E-PAGE-003")));
  await expect(d.getByText("外に出す前の確かめ", { exact: true })).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});

test("K691-UI-009 小窓の閉じる・Esc・右上の×：どれも口を呼ばず閉じ、焦点は「必ず守る」に戻り、ページは変わらない", async ({
  page,
}) => {
  const { x } = await setup(page);
  for (const how of ["閉じる", "Escape"]) {
    x.script("must", full());
    await openAt(page, P_EXPENSE);
    await toggle(page).click();
    const d = mustDlg(page);
    await expect(d).toBeVisible();
    const before = x.count("must");
    if (how === "Escape") await page.keyboard.press("Escape");
    else await d.getByRole("button", { name: how, exact: true }).first().click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(toggle(page)).toBeFocused();
    expect(x.count("must")).toBe(before);
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  }
});

test("K691-UI-010 二度押し：付ける口の答えを止めた間に「必ず守る」を 2 回押しても口は 1 回で、答えが来ると押し込んだ形になる", async ({
  page,
}) => {
  const { x } = await setup(page);
  await openAt(page, P_EXPENSE);
  const release = x.hold("must");
  await toggle(page).click();
  await toggle(page)
    .click({ force: true })
    .catch(() => undefined);
  expect(x.count("must")).toBe(1);
  release();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect(x.count("must")).toBe(1);
});

for (const [name, reply, code, reread] of [
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002", false],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001", true],
  ["409 承認待ち", err(409, "E-KNW-011"), "E-KNW-011", true],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", false],
  ["網の切れ", "network", "E-PAGE-008", false],
] as const)
  test(`K691-UI-011 付ける口が失敗（${name}）：お知らせ（失敗・自分で閉じるまで残る）に ${code} の文・押し込みは外れたまま・${reread ? "ページを読み直す" : "読み直さない"}・押し直せる`, async ({
    page,
  }) => {
    const { mk, x } = await setup(page);
    x.script("must", reply);
    await openAt(page, P_EXPENSE);
    await toggle(page).click();
    await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    expect(mk.count("page", P_EXPENSE)).toBe(reread ? 2 : 1);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    expect(x.count("must")).toBe(2);
  });

test("K691-UI-012 読むだけの人（口の acts に必ず守るが無い）：「必ず守る」のつまみは出ない・付いているページの「必ず守る」の 1 行は出る", async ({
  page,
}) => {
  const { mk } = await setup(page);
  mk.pages.set(P_INVOICE, pageInvoice({ acts: ["copy"], shared_from: { group_name: "営業", writable: false } }));
  await openAt(page, P_INVOICE);
  await expect(toggle(page)).toHaveCount(0);
  await expect(page.locator(".k-f9-mustline")).toBeVisible();
});

// ---------------------------------------------------------------- 書き終える前の似たページ
test("K691-UI-013 似たページがあるとき：「書き終える」→ 先に保存・似たページを探す口 1 回（体は題名・説明・本文の頭・exclude_page_id＝このページ）→ 公開の前に小窓「似たページがあります」（2 件の題名・場所・説明・「戻って直す」「このまま作る」）・公開の口はまだ 0 回", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  const d = await openSimilar(page, x);
  expect(x.count("similar")).toBe(1);
  expect(x.calls[0]!.body).toMatchObject({ title: "経費の精算", exclude_page_id: P_EXPENSE });
  expect(x.calls[0]!.body["desc"]).toBe(pageExpense().desc);
  expect(String(x.calls[0]!.body["text"])).toContain("足した字");
  expect(mk.count("save")).toBeGreaterThan(0);
  expect(mk.count("publish")).toBe(0);
  const list = d.getByLabel("似たページ", { exact: true });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).toContainText("会社 › 経理");
  await expect(list).toContainText("取引先ごとの締め日と、支払期日の決め方。");
  await expect(d.getByRole("button", { name: "戻って直す", exact: true })).toBeVisible();
  await expect(d.getByRole("button", { name: "このまま作る", exact: true })).toBeVisible();
});

test("K691-UI-014 「このまま作る」：小窓が閉じ、公開の口 1 回で読む形に戻る（版が進む・お知らせ「ページを書き終えました」）・似たページを探す口は 1 回のまま", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  const d = await openSimilar(page, x);
  await d.getByRole("button", { name: "このまま作る", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(page.locator(CARD)).toBeVisible();
  expect(mk.count("publish")).toBe(1);
  expect(x.count("similar")).toBe(1);
  await expect(page.locator(".k-toast")).toContainText("ページを書き終えました");
});

test("K691-UI-015 「戻って直す」：小窓が閉じ、公開の口は 0 回・書いている画面のまま書いた字が残る・もう一度「書き終える」を押すとまた探す（口 2 回）", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  const d = await openSimilar(page, x);
  await d.getByRole("button", { name: "戻って直す", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(page.locator(EDIT)).toBeVisible();
  expect(mk.count("publish")).toBe(0);
  await expect(page.getByRole("textbox", { name: "本文", exact: true })).toContainText("足した字");
  await done(page).click();
  await expect(simDlg(page)).toBeVisible();
  expect(x.count("similar")).toBe(2);
});

test("K691-UI-016 似たページが 1 件も無いとき：小窓を出さず、探す口 1 回のあとそのまま公開の口 1 回で読む形に戻る", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  await startWriting(page);
  await done(page).click();
  await expect(page.locator(CARD)).toBeVisible();
  expect(x.count("similar")).toBe(1);
  expect(mk.count("publish")).toBe(1);
  await expect(page.locator(DLG)).toHaveCount(0);
});

for (const [name, reply] of [
  ["503", err(503, "E-PAGE-003")],
  ["上限（429）", err(429, "RATE_LIMITED")],
  ["網の切れ", "network"],
] as const)
  test(`K691-UI-017 似たページを探す口が失敗（${name}）：書き終えるを止めない（探すのは気づかせるだけ）。お知らせ「似たページを探せませんでした。このまま書き終えます。」（仮）を出して、公開の口 1 回で読む形に戻る`, async ({
    page,
  }) => {
    const { mk, x } = await setup(page);
    x.script("similar", reply);
    await startWriting(page);
    await done(page).click();
    await expect(page.locator(CARD)).toBeVisible();
    await expect(page.locator(".k-toast")).toContainText("似たページを探せませんでした。このまま書き終えます。");
    expect(mk.count("publish")).toBe(1);
    await expect(page.locator(DLG)).toHaveCount(0);
  });

test("K691-UI-018 似たページの「開く」：新しいタブで /knowledge/<そのページの id> が開き、小窓と書いている画面は残る（書いた字も残る）", async ({
  page,
}) => {
  const { x } = await setup(page);
  const d = await openSimilar(page, x);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    d.getByRole("button", { name: "請求書の送り方を開く", exact: true }).click(),
  ]);
  await popup.waitForURL(new RegExp(`/knowledge/${P_INVOICE}$`));
  await expect(simDlg(page)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "本文", exact: true })).toContainText("足した字");
});

test("K691-UI-019 似たページの小窓を Esc・右上の×で閉じる：「戻って直す」と同じ（公開の口 0 回・書いている画面のまま）・焦点は「書き終える」に戻る", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  await openSimilar(page, x);
  await page.keyboard.press("Escape");
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(done(page)).toBeFocused();
  await done(page).click();
  await simDlg(page).getByRole("button", { name: "閉じる", exact: true }).first().click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("publish")).toBe(0);
  expect(x.count("similar")).toBe(2);
  await expect(page.locator(EDIT)).toBeVisible();
});

test("K691-UI-020 送る本文は頭の 500 字だけ（長い本文でも）・題名の前後の空白は落とす・説明が空なら desc を送らない", async ({
  page,
}) => {
  const long = doc(H2("長い"), P("あ".repeat(900)));
  const { mk, x } = await setup(page);
  const ex = { ...pageExpense(), desc: "", body: { doc: long, text: textOf(long) } };
  mk.pages.set(P_EXPENSE, ex);
  await startWriting(page);
  await done(page).click();
  await expect(page.locator(CARD)).toBeVisible();
  const b = x.calls[0]!.body;
  expect(Array.from(String(b["text"])).length).toBe(500);
  expect(b).not.toHaveProperty("desc");
  expect(b["title"]).toBe("経費の精算");
});

test("K691-UI-021 二度押し：似たページを探す口の答えを止めた間は「書き終える」が押せず、2 回押しても探す口は 1 回・公開の口は 0 回", async ({
  page,
}) => {
  const { mk, x } = await setup(page);
  x.similar = SIM;
  await startWriting(page);
  const release = x.hold("similar");
  await done(page).click();
  await expect(done(page)).toBeDisabled();
  await done(page)
    .click({ force: true })
    .catch(() => undefined);
  expect(x.count("similar")).toBe(1);
  expect(mk.count("publish")).toBe(0);
  release();
  await expect(simDlg(page)).toBeVisible();
  expect(x.count("similar")).toBe(1);
});

test("K691-UI-022 題名・場所・説明・フォルダ名に HTML が入っていても、上限の小窓・似たページの小窓に文字として出て動かない（img も作られない）", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__x=1">';
  const { x } = await setup(page);
  x.script("must", full([{ id: M1, title: evil, folder: "<b>会社</b>" }]));
  await openAt(page, P_EXPENSE);
  await toggle(page).click();
  await expect(mustDlg(page).getByText(evil, { exact: true })).toBeVisible();
  await expect(mustDlg(page).getByText("<b>会社</b>", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  x.similar = [{ id: P_INVOICE, title: evil, place: "<i>会社</i>", desc: "<u>説明</u>" }];
  await startWriting(page);
  await done(page).click();
  await expect(simDlg(page).getByText(evil, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(".k-dialog img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K691-UI-023 幅 ${w}：上限の小窓（付いているページ 15 件）と似たページの小窓を開いても横のはみ出し 0（数値）・小窓が画面の中に収まる`, async ({
    page,
  }) => {
    const { x } = await setup(page);
    x.script("must", full(MUST_COMPANY));
    await openAt(page, P_EXPENSE, w);
    await toggle(page).click();
    const d = mustDlg(page);
    await expect(d).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const box = (await d.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    await page.keyboard.press("Escape");
    x.similar = SIM;
    await startWriting(page);
    await done(page).click();
    await expect(simDlg(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K691-UI-024 キーボードだけ：「必ず守る」に焦点して Enter で上限の小窓が開く・Tab を 20 回押しても小窓の外へ出ず、Esc で閉じて焦点が戻る・もう一度 Enter で付けられる", async ({
  page,
}) => {
  const { x } = await setup(page);
  x.script("must", full());
  await openAt(page, P_EXPENSE);
  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await expect(mustDlg(page)).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".k-dialog"))), `Tab ${i + 1} 回目`).toBe(
      true,
    );
  }
  await page.keyboard.press("Escape");
  await expect(toggle(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect(x.count("must")).toBe(2);
});
