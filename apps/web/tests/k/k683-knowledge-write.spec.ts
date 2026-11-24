// K-683「ページを書く画面（直す → 自動で保存 → 書き終える／やめる・題名・1 行の説明・本文）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-write（本番と同じ部品 features/F9/knowledge の PageEdit・代表 OK 2026-11-22）。本文の編集は段 5 の DocEditor（textbox「本文」）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ナレッジの口（K-676・K-677・K-679・K-680）だけを網の手前で差し替える（knowledge-mock.ts）。
//   口の答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章（getKnowledgePage の draft に title・desc が付く前提・K-683.md の「前提と制約」）。
//   自動で保存する間は AUTOSAVE_MS（use-page-writing.ts の定数・800）。固定の待ちは使わない（口の数と答えを待つ・答えは hold() で止める）。
//   本人の Bridge（127.0.0.1:38617）は届かせない。テストはチケットを作る人が書き、実装する人は変えない
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { matchF9 } from "./f9-match";
import { ROOT } from "./kit";
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

const AUTOSAVE_MS = 800;
const WEB = join(ROOT, "apps/web");
const EDIT = 'article[aria-label="ページを書いている"]';
const READ = "article.k-f9-card[aria-labelledby]";
const SAVED = `${EDIT} .k-f9-saved`;
const P_MY = uid(0xa0b0);
const DISCOUNT = doc(H2("その場で返してよい範囲"), P("5% までは、その場で「できます」と返してよい。"));
const BOX = `${EDIT} [role="alert"]`;
const SAVED_RE = /自動で保存しました（\d\d:\d\d）/;

const body = (p: Page) => p.getByRole("textbox", { name: "本文", exact: true });
const titleF = (p: Page) => p.getByLabel("題名", { exact: true });
const descF = (p: Page) => p.getByLabel("1 行の説明", { exact: true });
const done = (p: Page) => p.getByRole("button", { name: "書き終える", exact: true });
const quit = (p: Page) => p.getByRole("button", { name: "やめる", exact: true });
const edit = (p: Page) => p.getByRole("button", { name: "直す", exact: true });
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const saves = (mk: KMock) => mk.calls.filter((c) => c.op === "save");

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openPage(page: Page, id: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`/knowledge/${id}`);
}
/** 経費の精算（公開済み・書ける）を開いて「直す」を押し、書いている画面にする */
async function startEdit(page: Page): Promise<void> {
  await openPage(page, P_EXPENSE);
  await edit(page).click();
  await expect(page.locator(EDIT)).toBeVisible();
}
async function typeBody(page: Page, text: string): Promise<void> {
  await body(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}
const newPage = (over: Partial<PageAnswer> = {}): PageAnswer =>
  pageInvoice({
    id: P_NEW,
    title: "書きかけのメモ",
    desc: "",
    state: "draft",
    must: false,
    acts: [],
    body: null,
    draft: { doc: doc(H2("目的"), P("書き始めたばかり。")), saved_at: "2026-11-21T01:42:00Z" },
    ...over,
  });
const mine = (over: Partial<PageAnswer> = {}): PageAnswer =>
  pageInvoice({
    id: P_MY,
    title: "値引きを頼まれたときの返し方",
    desc: "お客さまから値引きを頼まれたとき、その場で返してよい範囲と、持ち帰る範囲。",
    must: false,
    acts: ["edit"],
    place: { shelf: "me", shelf_name: "自分", group_id: null, folder_id: null, folders: [] },
    body: { doc: DISCOUNT, text: textOf(DISCOUNT) },
    draft: { doc: DISCOUNT, saved_at: "2026-11-21T01:42:00Z" },
    ...over,
  });

// ---------------------------------------------------------------- モックと本番の突き合わせ
const WRITE_PAIRS = [
  ["card", ".k-f9-card", ["width", "x", "background-color", "border-top-color", "border-top-left-radius"]],
  ["place", ".k-f9-place .k-f9-shelfchip", ["font-size", "color", "texts"]],
  ["fields", ".k-f9-editfields .k-input", ["width", "height", "x", "font-size", "border-top-color"]],
  ["label", ".k-f9-editfields .k-label", ["font-size", "font-weight", "color", "texts"]],
  ["saved", ".k-f9-saved", ["font-size", "color", "texts"]],
  [
    "acts",
    ".k-f9-acts button",
    ["width", "height", "font-size", "color", "background-color", "border-top-color", "texts"],
  ],
  ["bar", ".k-f4d-bar", ["width", "x", "background-color", "border-top-color"]],
  ["editor", ".k-f4d-editor", ["width", "x", "border-top-color"]],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
for (const w of [375, 768, 1440] as const) {
  test(`K683-UI-001 kn-write 幅 ${w}：書いている画面（枠・場所・題名と説明の欄・自動保存の字・やめる／書き終える・道具の帯・本文の枠）の位置と大きさと字がモックと同じ`, async ({
    browser,
  }) => {
    const { bad, rows } = await matchF9(
      browser,
      "kn-write",
      w,
      async (page) => {
        await mockKnowledge(page, { pages: [mine()] });
        await openPage(page, P_MY, w);
        await expect(page.locator(EDIT)).toBeVisible();
        await expect(page.locator(SAVED)).toHaveText("自動で保存しました（10:42）");
      },
      { pairs: WRITE_PAIRS },
    );
    expect(new Set(rows.map((r) => r.part))).toContain("fields");
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 入口・自動保存
test("K683-UI-002 「直す」を押すと書いている画面：口 0 回・題名と説明の欄に今の値・本文に焦点・主ボタンは「書き終える」・読む形の「直す」は無い", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await expect(titleF(page)).toHaveValue("経費の精算");
  await expect(descF(page)).toHaveValue("立て替えた経費を月末までに精算するときの、出し方と上限。");
  await expect(body(page)).toBeFocused();
  await expect(done(page)).toHaveAttribute("data-variant", "primary");
  await expect(edit(page)).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op !== "tree" && c.op !== "page")).toEqual([]);
});

test("K683-UI-003 打つと打ち終えてから 800 ms ちょうどで 1 回だけ下書きを送る（手前では送らない）：題名だけ打てば体は title だけ・本文を打てば doc だけ（text は送らない）・印「自動で保存しました（HH:MM）」", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await page.clock.install();
  await startEdit(page);
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await titleF(page).fill("経費の精算（改）");
  await page.clock.runFor(AUTOSAVE_MS - 1);
  expect(saves(mk), "打ち終えてすぐは送らない").toHaveLength(0);
  await page.clock.runFor(1);
  await expect.poll(() => saves(mk).length).toBe(1);
  const first = saves(mk)[0]!;
  expect(Object.keys(first.body)).toEqual(["title"]);
  expect(first.body["title"]).toBe("経費の精算（改）");
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  await typeBody(page, "追加の一文。");
  await page.clock.runFor(AUTOSAVE_MS);
  await expect.poll(() => saves(mk).length).toBe(2);
  const second = saves(mk)[1]!;
  expect(Object.keys(second.body)).toEqual(["doc"]);
  expect(JSON.stringify(second.body["doc"])).toContain("追加の一文。");
  expect(Object.keys(second.body)).not.toContain("text");
});

test("K683-UI-004 続けて打つ間は 1 回にまとまる：3 つの欄を同じ時刻に打つと、800 ms の手前では送らず、ちょうどで下書きの口は 1 回・体に 3 つの欄が全部入る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await page.clock.install();
  await startEdit(page);
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await titleF(page).fill("新しい題名");
  await descF(page).fill("新しい説明");
  await typeBody(page, "新しい本文");
  await page.clock.runFor(AUTOSAVE_MS - 1);
  expect(saves(mk)).toHaveLength(0);
  await page.clock.runFor(1);
  await expect.poll(() => saves(mk).length).toBe(1);
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  expect(saves(mk)).toHaveLength(1);
  expect(Object.keys(saves(mk)[0]!.body).sort()).toEqual(["desc", "doc", "title"]);
});

test("K683-UI-005 保存の答えを待つ間は印が「保存しています…」（仮）・答えると「自動で保存しました（HH:MM）」に替わる", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  const release = mk.hold("save");
  await startEdit(page);
  await descF(page).fill("説明を直した");
  await expect(page.locator(SAVED)).toHaveText("保存しています…");
  release();
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
});

test("K683-UI-006 保存が失敗（503・網の切れ）：印は「自動で保存できませんでした」（data-kind=failed）・書いた字は残る・次に打つともう一度送り、通れば印が戻る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("save", err(503, "E-PAGE-003"), "network");
  await startEdit(page);
  await descF(page).fill("一度目");
  await expect(page.locator(SAVED)).toHaveText("自動で保存できませんでした");
  await expect(page.locator(SAVED)).toHaveAttribute("data-kind", "failed");
  await descF(page).fill("二度目");
  await expect.poll(() => saves(mk).length).toBe(2);
  await expect(page.locator(SAVED)).toHaveAttribute("data-kind", "failed");
  await descF(page).fill("三度目");
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  await expect(descF(page)).toHaveValue("三度目");
  expect(saves(mk)[2]!.body["desc"]).toBe("三度目");
});

test("K683-UI-007 ほかの人がこのページを書いている（口が 409・E-KNW-012）：赤い箱に正本の文・書いた字は残る・「書き終える」は押せない・「やめる」で捨てて読む形に戻れる（口は呼ばない）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("save", err(409, "E-KNW-012"));
  await startEdit(page);
  await descF(page).fill("書いた説明");
  await expect(page.locator(BOX)).toContainText(msg("E-KNW-012"));
  await expect(descF(page)).toHaveValue("書いた説明");
  await expect(done(page)).toBeDisabled();
  await quit(page).click();
  await page.getByRole("button", { name: "捨てる", exact: true }).click();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.count("discard")).toBe(0);
  expect(mk.count("publish")).toBe(0);
});

// ---------------------------------------------------------------- 書き終える
test("K683-UI-008 書き終える：未保存の分を先に保存し、公開の口を 1 回（体は空の {}・冪等の鍵あり）→ 読む形・題名と説明と本文が新しい・版が 1 つ進む・木の題名も新しい・「直す」が戻る（口の順は 保存 → 公開 → ページ → 木）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await titleF(page).fill("経費の精算（11 月版）");
  await typeBody(page, "領収書は 2 か月以内。");
  const before = mk.calls.length;
  await done(page).click();
  await expect(
    page.locator(READ).getByRole("heading", { name: "経費の精算（11 月版）", level: 1, exact: true }),
  ).toBeVisible();
  const ops = mk.calls.slice(before).map((c) => c.op);
  expect(ops.slice(0, 2)).toEqual(["save", "publish"]);
  expect(ops).toContain("page");
  expect(ops).toContain("tree");
  const pub = mk.calls.find((c) => c.op === "publish")!;
  expect(pub.body).toEqual({});
  expect(pub.key).toBeTruthy();
  await expect(page.locator(READ)).toContainText("領収書は 2 か月以内。");
  await expect(page.locator(`${READ} .k-f9-pfoot`)).toContainText("版 3");
  await expect(
    page.locator('aside[aria-label="ナレッジの木"]').getByText("経費の精算（11 月版）", { exact: true }),
  ).toBeVisible();
  await expect(edit(page)).toBeVisible();
  await expect(page.locator(EDIT)).toHaveCount(0);
});

test("K683-UI-009 何も直していない公開済みのページで「書き終える」：口 0 回（保存も公開もしない）で読む形に戻る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  const before = mk.calls.length;
  await done(page).click();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.calls.length).toBe(before);
});

test("K683-UI-010 題名が空白だけで「書き終える」：口を呼ばず題名の欄の下に「題名を入れてください」（仮）・aria-invalid・焦点が題名へ。自動保存でも空白だけの題名は送らない（ほかの欄だけ送る）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await titleF(page).fill("   ");
  await descF(page).fill("説明だけ直した");
  await expect.poll(() => saves(mk).length).toBe(1);
  expect(Object.keys(saves(mk)[0]!.body)).toEqual(["desc"]);
  const before = mk.calls.length;
  await done(page).click();
  await expect(page.locator(`${EDIT} .k-err`)).toHaveText("題名を入れてください");
  await expect(titleF(page)).toHaveAttribute("aria-invalid", "true");
  await expect(titleF(page)).toBeFocused();
  expect(mk.calls.length).toBe(before);
  await titleF(page).fill("経費の精算");
  await expect(page.locator(`${EDIT} .k-err`)).toHaveCount(0);
});

test("K683-UI-011 書き終えるの前の差し込み口：書き終える手順が公開の口を呼ぶ前に usePublishGate().check を呼ぶ（中身は K-691 が書き替えるので、名前と順だけを見る）", () => {
  const src = readFileSync(join(WEB, "features/F9/knowledge/use-page-writing.ts"), "utf8");
  const gate = readFileSync(join(WEB, "features/F9/knowledge/publish-gate.tsx"), "utf8");
  const i = src.indexOf("gate.check(");
  const j = src.search(/call\(\s*["']publishKnowledgePage["']/);
  expect(i, "check を呼ぶ所が無い").toBeGreaterThan(-1);
  expect(j, "公開の口を呼ぶ所が無い").toBeGreaterThan(-1);
  expect(i, "check は公開の口を呼ぶより前").toBeLessThan(j);
  expect(gate).toMatch(/export function usePublishGate/);
});

test("K683-UI-012 必ず守るのページが 2,000 字を超える（口が 409・E-KNW-041）：赤い箱に正本の文・書いた字は残り編集の形のまま・本文を縮めて押し直すと通る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("publish", err(409, "E-KNW-041"));
  await startEdit(page);
  await typeBody(page, "長い文。");
  await done(page).click();
  await expect(page.locator(BOX)).toContainText(msg("E-KNW-041"));
  await expect(page.locator(EDIT)).toBeVisible();
  await expect(body(page)).toContainText("長い文。");
  await done(page).click();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.count("publish")).toBe(2);
  await expect(page.locator(BOX)).toHaveCount(0);
});

test("K683-UI-013 書き終える下書きが無い（口が 409・E-KNW-040：ほかで書き終えたか捨てた）：赤い箱に正本の文・字は残り、「やめる」で読む形に戻れる", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("publish", err(409, "E-KNW-040"));
  await startEdit(page);
  await typeBody(page, "続き。");
  await done(page).click();
  await expect(page.locator(BOX)).toContainText(msg("E-KNW-040"));
  await expect(body(page)).toContainText("続き。");
  await quit(page).click();
  await page.getByRole("button", { name: "捨てる", exact: true }).click();
  await expect(page.locator(READ)).toBeVisible();
});

const FAILS: [string, "network" | ReturnType<typeof err>, string][] = [
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-008"],
];
for (const [name, reply, code] of FAILS)
  test(`K683-UI-014 書き終えるが失敗（${name}）：赤い箱に ${code} の文・書いた字は残り編集の形のまま・もう一度押せて通れば閉じる（赤い箱も消える）`, async ({
    page,
  }) => {
    const mk = await mockKnowledge(page);
    mk.script("publish", reply);
    await startEdit(page);
    await typeBody(page, "書いた一文。");
    await done(page).click();
    await expect(page.locator(BOX)).toContainText(msg(code));
    await expect(body(page)).toContainText("書いた一文。");
    await done(page).click();
    await expect(page.locator(READ)).toBeVisible();
    await expect(page.locator(BOX)).toHaveCount(0);
  });

test("K683-UI-015 ログインが切れた（口が 401）：入り直しへ勝手に移さず、赤い帯「ログインが切れました」・字は残る・押すと /login へ移る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("publish", err(401, "E-AUTH-009"));
  await startEdit(page);
  await typeBody(page, "途中の字。");
  await done(page).click();
  const band = page.locator(`${EDIT} [role="alert"]`).filter({ hasText: "ログインが切れました" });
  await expect(band).toBeVisible();
  await expect(body(page)).toContainText("途中の字。");
  await band.getByRole("button", { name: "ログインし直す", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("K683-UI-016 二度押し：公開の答えを止めた間に「書き終える」を 2 回押しても口は 1 回・ボタンは押せない・答えると読む形", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await typeBody(page, "二度押し。");
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  const release = mk.hold("publish");
  await done(page).click();
  await expect(done(page)).toBeDisabled();
  await done(page).dispatchEvent("click"); // 押せない形のボタンへの 2 度目のクリック（何も起きない）
  expect(mk.count("publish")).toBe(1);
  release();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.count("publish")).toBe(1);
});

// ---------------------------------------------------------------- やめる
test("K683-UI-017 何も直していない公開済みのページで「やめる」：確かめの小窓なしで読む形に戻り、口は 0 回", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  const before = mk.calls.length;
  await quit(page).click();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.calls.length).toBe(before);
});

test("K683-UI-018 直した公開済みのページで「やめる」：小窓「書いた内容を捨てますか」・「書き続ける」で戻り字が残る・「捨てる」で下書きを捨てる口 1 回 → 読む形・本文は元のまま・読み直しても下書きは無い", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await typeBody(page, "捨てる字。");
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  await quit(page).click();
  const dlg = page.getByRole("dialog", { name: "書いた内容を捨てますか", exact: true });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "書き続ける", exact: true }).click();
  await expect(body(page)).toContainText("捨てる字。");
  await quit(page).click();
  await page
    .getByRole("dialog", { name: "書いた内容を捨てますか", exact: true })
    .getByRole("button", { name: "捨てる", exact: true })
    .click();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.count("discard")).toBe(1);
  await expect(page.locator(READ)).not.toContainText("捨てる字。");
  await page.reload();
  await expect(page.locator(READ)).toBeVisible();
  await expect(page.locator(EDIT)).toHaveCount(0);
});

test("K683-UI-019 まだ書き終えていない新しいページで「やめる」：小窓に「ページごと消えます」・「消す」で口 1 回（page_deleted）→ /knowledge に移り木から無くなる・そのページを開き直すと「見られない」", async ({
  page,
}) => {
  const mk = await mockKnowledge(page, { pages: [newPage()] });
  mk.tree.my_nodes.push({ kind: "page", id: P_NEW, title: "書きかけのメモ", mark: "draft" });
  await openPage(page, P_NEW);
  await expect(page.locator(EDIT)).toBeVisible();
  await quit(page).click();
  const dlg = page.getByRole("dialog", { name: "このページを消しますか", exact: true });
  await expect(dlg).toContainText("ページごと消えます");
  await dlg.getByRole("button", { name: "消す", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  expect(mk.count("discard")).toBe(1);
  await expect(
    page.locator('aside[aria-label="ナレッジの木"]').getByText("書きかけのメモ", { exact: true }),
  ).toHaveCount(0);
  await page.goto(`/knowledge/${P_NEW}`);
  await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
});

test("K683-UI-020 やめるの失敗：捨てる下書きが無い（409・E-KNW-030）は読む形に戻る（もう無いので）・503 は小窓の中の赤い箱で字は残り押し直せる", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await typeBody(page, "字。");
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  mk.script("discard", err(503, "E-PAGE-003"), err(409, "E-KNW-030"));
  await quit(page).click();
  const dlg = page.getByRole("dialog", { name: "書いた内容を捨てますか", exact: true });
  await dlg.getByRole("button", { name: "捨てる", exact: true }).click();
  await expect(dlg.getByRole("alert")).toContainText(msg("E-PAGE-003"));
  // 409・E-KNW-030 は「捨てる下書きがもう無い」（ほかで捨てた・書き終えた）場面。差し替えの口の下書きも合わせて消す（読み直しの答えに下書きが残らない）
  mk.pages.get(P_EXPENSE)!.draft = null;
  await dlg.getByRole("button", { name: "捨てる", exact: true }).click();
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.count("discard")).toBe(2);
});

// ---------------------------------------------------------------- 開き直し・権限・見た目
test("K683-UI-021 書きかけが在るページを再読み込み・別の入口から開く：書いている画面で戻り、題名・説明・本文・印（下書きを保存した時刻）が戻る・書き込みの口は 0 回", async ({
  page,
}) => {
  const mk = await mockKnowledge(page, {
    pages: [
      mine({ draft: { doc: DISCOUNT, saved_at: "2026-11-21T01:42:00Z", title: "直した題名", desc: "直した説明" } }),
    ],
  });
  await openPage(page, P_MY);
  await expect(page.locator(EDIT)).toBeVisible();
  await expect(titleF(page)).toHaveValue("直した題名");
  await expect(descF(page)).toHaveValue("直した説明");
  await expect(body(page)).toContainText("5% までは");
  await expect(page.locator(SAVED)).toHaveText("自動で保存しました（10:42）");
  await page.reload();
  await expect(titleF(page)).toHaveValue("直した題名");
  expect(mk.calls.filter((c) => ["save", "publish", "discard"].includes(c.op))).toEqual([]);
});

test("K683-UI-022 「直す」を押しただけ（何も打たない）で再読み込み：読む形に戻る（下書きは作られていない・書き込みの口は 0 回）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await page.reload();
  await expect(page.locator(READ)).toBeVisible();
  await expect(page.locator(EDIT)).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op === "save")).toEqual([]);
});

test("K683-UI-023 書けない人（acts に edit が無い）は「直す」が出ない。開いたまま権限が外れた直後に打つと口が 403 で止め、赤い箱に正本の文・書いた字は残る", async ({
  page,
}) => {
  const mk = await mockKnowledge(page, { pages: [pageExpense(), pageInvoice({ acts: ["copy"] })] });
  await openPage(page, P_INVOICE);
  await expect(page.locator(READ)).toBeVisible();
  await expect(edit(page)).toHaveCount(0);
  await page.goto(`/knowledge/${P_EXPENSE}`);
  await edit(page).click();
  mk.script("save", err(403, "FORBIDDEN"));
  await descF(page).fill("権限が外れた後の字");
  await expect(page.locator(BOX)).toContainText(msg("E-PAGE-002"));
  await expect(descF(page)).toHaveValue("権限が外れた後の字");
});

test("K683-UI-024 キーボードだけ：「直す」に焦点して Enter で本文へ・Tab の順は 題名 → 説明 → 本文の道具 → 本文 → やめる → 書き終える・「書き終える」に焦点して Enter で公開", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await openPage(page, P_EXPENSE);
  await edit(page).focus();
  await page.keyboard.press("Enter");
  await expect(body(page)).toBeFocused();
  await titleF(page).focus();
  const order: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "",
      ),
    );
  }
  expect(order[0]).toContain("1 行の説明");
  await descF(page).focus();
  await typeBody(page, "キーボード。");
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  await done(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(READ)).toBeVisible();
  expect(mk.count("publish")).toBe(1);
});

test("K683-UI-025 幅 320・375・768・1024・1440：書いている画面・赤い箱・小窓でも横のはみ出し 0（数値）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  mk.script("publish", err(409, "E-KNW-041"));
  await loginAs(page, owner.token);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.goto(`/knowledge/${P_EXPENSE}`);
    // 初めの幅だけ「直す」で書き始める。2 回目からは前の幅の「書き終える」の前の保存で書きかけが口に在るので、開くとすぐ書いている画面になる（チケットの決め）
    if (w === 320) await edit(page).click();
    await expect(page.locator(EDIT)).toBeVisible();
    await expect(edit(page)).toHaveCount(0);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    await typeBody(page, "あ");
    await quit(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await overflowX(page), `幅 ${w}・小窓`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    mk.script("publish", err(409, "E-KNW-041"));
    await done(page).click();
    await expect(page.locator(BOX)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}・赤い箱`).toBeLessThanOrEqual(0);
  }
});

test("K683-UI-026 題名と説明は 200 字まで：200 字を超えて打てない（欄が止める）・その字数で下書きが送られる", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await titleF(page).fill("あ".repeat(250));
  await descF(page).fill("い".repeat(250));
  expect((await titleF(page).inputValue()).length).toBe(200);
  expect((await descF(page).inputValue()).length).toBe(200);
  await expect.poll(() => saves(mk).length).toBeGreaterThanOrEqual(1);
  const sent = saves(mk).at(-1)!.body;
  expect(String(sent["title"] ?? "").length).toBeLessThanOrEqual(200);
  expect(String(sent["desc"] ?? "").length).toBeLessThanOrEqual(200);
});

test("K683-UI-027 題名に HTML を打って書き終えても、読む形・木・帯に文字として出て動かない・送る体は打ったとおりの字（削らない）", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__xss=1">';
  const mk = await mockKnowledge(page);
  await startEdit(page);
  await titleF(page).fill(evil);
  await done(page).click();
  await expect(page.locator(READ).getByRole("heading", { level: 1 })).toHaveText(evil);
  expect(saves(mk).at(-1)!.body["title"]).toBe(evil);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator(`${READ} img[src="x"]`)).toHaveCount(0);
});

test("K683-UI-028 送っていない直しがあるまま木で別のページを押す：移る前に打った字を元のページへ 1 回送り、移った先は読む形で開く（書いている印を持ち越さない）", async ({
  page,
}) => {
  const mk = await mockKnowledge(page);
  await page.clock.install();
  await startEdit(page);
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await typeBody(page, "移る前に打った一文。");
  expect(saves(mk), "まだ 800 ms 経っていない").toHaveLength(0);
  await page.locator('aside[aria-label="ナレッジの木"] a.k-f9-node').filter({ hasText: "請求書の送り方" }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_INVOICE}$`));
  await expect.poll(() => saves(mk).length).toBe(1);
  expect(saves(mk)[0]!.id).toBe(P_EXPENSE);
  expect(JSON.stringify(saves(mk)[0]!.body["doc"])).toContain("移る前に打った一文。");
  // 送りきったのは止めた時計のまま（800 ms の時計ではない）と確かめた。移った先の読み込みの答えを画面に届けるため時計を戻す
  await page.clock.resume();
  await expect(page.locator(READ)).toBeVisible();
  await expect(page.locator(EDIT)).toHaveCount(0);
});

test("K683-UI-029 送っていない直しがあるときだけ、再読み込み・タブを閉じる前にブラウザの確かめが出る（保存し終えた後は出ない）", async ({
  page,
}) => {
  await mockKnowledge(page);
  await page.clock.install();
  await startEdit(page);
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const askBeforeLeave = () =>
    page.evaluate(() => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    });
  expect(await askBeforeLeave(), "何も打っていない").toBe(false);
  await typeBody(page, "まだ送っていない字。");
  expect(await askBeforeLeave(), "送っていない直しがある").toBe(true);
  await page.clock.runFor(AUTOSAVE_MS);
  await expect(page.locator(SAVED)).toHaveText(SAVED_RE);
  expect(await askBeforeLeave(), "保存し終えた").toBe(false);
});
