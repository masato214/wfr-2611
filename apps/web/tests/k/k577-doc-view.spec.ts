// K-577「本文の読む形の描き（DocView）と、編集の部品の遅い読み込み」の試験（実 Chrome・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f4v2-editor/f4v2-editor-tools（K-567 が作った頁。K-577 が ?mode=edit|read と、読む形の取り扱い・危ない href の文書への切り替えのボタンを足す）。
//     頁：読む形は data-testid="doc-read"・編集の入力欄は『本文』・チェックの箱を押した記録（[位置, 付いたか] の並び）は "task-log"。
//   見ること：読む形は編集の部品を読み込まない・編集に入るときだけ読み込む・文書の木どおりに描く・チェックの箱の取り扱い・リンクの守り・幅。
//   文書：?doc=calm は全部の節を持ち #rrggbb の色を持たない文書（編集の部品を読まない道）。#rrggbb の色を 1 つでも持つ文書（rich・colortask・colorbad）は、
//     読むだけの編集の部品（Tiptap・editable: false・遅い読み込み）が描く（PM の決め 2026-11-23：利用者の色は style={…} でも <style> でも当てない）。
//   画面に出す字と並びは下絵（features/F4/doc の FreeDoc・Checks・BillTable・Img）が正。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";

const BASE = "/dev/mock/f4v2-editor/f4v2-editor-tools";
const WIDTHS = [375, 768, 1440] as const;
const EDITOR_CHUNK = /prosemirror-(state|view|model)|@tiptap\/core/i;

async function open(page: Page, doc: string, width = 1440, mode: "edit" | "read" = "read") {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "部品は口を呼ばない" }));
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`${BASE}?doc=${doc}&mode=${mode}`);
  expect(res?.status(), "頁を開けない").toBe(200);
  await expect(page.locator('[data-mock="f4v2-editor-tools"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const body = (page: Page) => page.getByRole("textbox", { name: "本文", exact: true });
/** 読むだけの編集の部品の根（#rrggbb の色を持つ文書だけ。色なしの読む形が先に出て、読み込めたら差し替わる） */
const liveRoot = (page: Page) => page.getByTestId("doc-read").locator('.ProseMirror[contenteditable="false"]');
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("K577-UI-001 読む形は編集の部品を読み込まない：読む形の頁を開いて待っても、どの script にも編集の部品（prosemirror・@tiptap/core）が入っていない", async ({
  page,
}) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") bodies.push(r.text().catch(() => ""));
  });
  await open(page, "calm", 1440, "read");
  await expect(page.getByTestId("doc-read")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const all = await Promise.all(bodies);
  expect(all.length).toBeGreaterThan(0);
  expect(all.some((s) => EDITOR_CHUNK.test(s))).toBe(false);
  await expect(body(page)).toHaveCount(0);
});

test("K577-UI-002 編集に入ると編集の部品を読み込む：『編集に切り替える』を押すと本文の入力欄が出て、そのときだけ編集の部品の script が読まれる。『読む形に切り替える』で読む形に戻る", async ({
  page,
}) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") bodies.push(r.text().catch(() => ""));
  });
  await open(page, "plain", 1440, "read");
  await page.waitForLoadState("networkidle");
  expect((await Promise.all(bodies.splice(0))).some((s) => EDITOR_CHUNK.test(s))).toBe(false);
  await page.getByRole("button", { name: "編集に切り替える", exact: true }).click();
  await expect(body(page)).toBeVisible();
  await expect.poll(async () => (await Promise.all([...bodies])).some((s) => EDITOR_CHUNK.test(s))).toBe(true);
  await page.getByRole("button", { name: "読む形に切り替える", exact: true }).click();
  await expect(page.getByTestId("doc-read")).toBeVisible();
  await expect(body(page)).toHaveCount(0);
});

test("K577-UI-003 読む形の描き：見出し・段落・箇条書き・チェックの箱・表・引用・コード・画像の置き場が文書の木どおりに出て、色は data-c・印は b／i／mark で出る。薄い字は薄い見た目", async ({
  page,
}) => {
  await open(page, "calm", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(view.getByRole("heading", { level: 2, name: "目的", exact: true })).toBeVisible();
  await expect(view.locator("ul").first()).toContainText("明細を集める");
  await expect(view.getByRole("checkbox")).toHaveCount(2);
  await expect(view.getByRole("checkbox", { name: "送った", exact: true })).toBeChecked();
  await expect(view.getByRole("checkbox", { name: "控える", exact: true })).not.toBeChecked();
  await expect(view.getByRole("table")).toBeVisible();
  await expect(view.locator("th")).toHaveText(["項目", "数量"]);
  await expect(view.locator("blockquote")).toContainText("先月と同じ書式で");
  await expect(view.locator("pre")).toContainText("b = 2");
  await expect(view.getByRole("img", { name: "先月の請求書の見本.png", exact: true })).toBeVisible();
  await expect(view.locator('[data-c="red"]')).toContainText("支払期日は 12/15");
  await expect(view.locator("b, strong")).toContainText("支払期日は 12/15");
  await expect(view.locator(".k-f4d-ghost, .k-f4d-ghost-h")).not.toHaveCount(0);
  expect(await overflowX(page)).toBe(0);
});

test("K577-UI-004 読む形のチェックの箱：押したときの取り扱いを渡さない読む形では押せず（disabled）、渡した読む形では押すと [位置, 付いたか] が渡る。押しても文書は部品の中で書き換わらない", async ({
  page,
}) => {
  await open(page, "calm", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(view.getByRole("checkbox").first()).toBeDisabled();
  await page.getByRole("button", { name: "箱を押せる読む形にする", exact: true }).click();
  const box = view.getByRole("checkbox", { name: "控える", exact: true });
  await expect(box).toBeEnabled();
  await box.click();
  await expect(page.getByTestId("task-log")).toHaveText(JSON.stringify([[1, true]]));
  await expect(box).not.toBeChecked();
});

test("K577-UI-005 読む形のリンクの守り：http・https・mailto のリンクは rel に noopener noreferrer・target _blank の a になり、危ない href（javascript: など）を持つ文書でも a にならず字だけが出る", async ({
  page,
}) => {
  await open(page, "calm", 1440, "read");
  const view = page.getByTestId("doc-read");
  const a = view.getByRole("link", { name: "資料", exact: true });
  await expect(a).toHaveAttribute("href", "https://example.com/a");
  await expect(a).toHaveAttribute("rel", /noopener/);
  await expect(a).toHaveAttribute("rel", /noreferrer/);
  await expect(a).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "危ない href の文書にする", exact: true }).click();
  await expect(view).toContainText("悪いリンク");
  await expect(view.getByRole("link", { name: "悪いリンク", exact: true })).toHaveCount(0);
  expect(await view.locator('a[href^="javascript:" i]').count()).toBe(0);
});

test("K577-UI-006 幅 375・768・1440：読む形は広い表と長い字を含む文書でも頁の横のはみ出しが 0 で、表は読む形の中でだけ横に流れる。薄い字・引用・コードも収まる", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await open(page, "calm", w, "read");
    await expect(page.getByTestId("doc-read")).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    await page.getByRole("button", { name: "広い表と長い字の文書にする", exact: true }).click();
    await expect(page.getByTestId("doc-read").getByRole("table")).toBeVisible();
    expect(await overflowX(page), `幅 ${w}・広い表`).toBe(0);
    await open(page, "rich", w, "read");
    await expect(liveRoot(page)).toBeVisible();
    await expect(page.getByTestId("doc-read").getByRole("table")).toBeVisible();
    expect(await overflowX(page), `幅 ${w}・結合したセルの表`).toBe(0);
  }
});

test("K577-UI-007 足した節の描き：見出し 4 は h4 で中央寄せ・番号つきは ol（start 3 と start なし）・区切りの線は hr・段落の寄せは計算された text-align・結合した表は th／td の colspan・rowspan・列頭の th・薄い字は薄い見た目", async ({
  page,
}) => {
  await open(page, "rich", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(liveRoot(page)).toBeVisible();
  const h4 = view.getByRole("heading", { level: 4, name: "小さい見出し", exact: true });
  await expect(h4).toBeVisible();
  await expect(h4).toHaveCSS("text-align", "center");
  const ols = view.locator("ol");
  await expect(ols).toHaveCount(2);
  await expect(ols.nth(0)).toHaveAttribute("start", "3");
  await expect(ols.nth(0).locator("li")).toHaveText(["三つ目", "四つ目"]);
  expect(await ols.nth(1).getAttribute("start")).toBeNull();
  await expect(view.locator("hr")).toHaveCount(1);
  await expect(view.getByText("右寄せの段落", { exact: true })).toHaveCSS("text-align", "right");
  await expect(view.getByText("両端そろえの段落", { exact: true })).toHaveCSS("text-align", "justify");
  await expect(view.locator("th[colspan='2']")).toHaveText("項目");
  await expect(view.locator("td[rowspan='2']")).toHaveText("保守");
  await expect(view.locator("tbody th, tr > th:first-child").filter({ hasText: "運用" })).toHaveCount(1);
  await expect(view.locator(".k-f4d-ghost, .k-f4d-ghost-h")).not.toHaveCount(0);
});

test("K577-UI-008 足した印の描き：下線 u・取り消し線 s・行の中のコード code・上付き sup・下付き sub・前の 3 色の名前は data-c・#dc2626 の文字の色と #fde68a の背景は計算された色・属性の無い背景は mark", async ({
  page,
}) => {
  await open(page, "rich", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(liveRoot(page)).toBeVisible();
  await expect(view.locator("u")).toContainText("下線");
  await expect(view.locator("s")).toContainText("取り消し");
  await expect(view.locator("code").filter({ hasText: "x = 1" })).toHaveCount(1);
  await expect(view.locator("sup")).toHaveText("2");
  await expect(view.locator("sub")).toHaveText("i");
  await expect(view.locator('[data-c="teal"]')).toContainText("青緑");
  await expect(view.getByText("赤い字", { exact: true })).toHaveCSS("color", "rgb(220, 38, 38)");
  await expect(view.getByText("黄の背景", { exact: true })).toHaveCSS("background-color", "rgb(253, 230, 138)");
  await expect(view.locator("mark").filter({ hasText: "前の黄" })).toHaveCount(1);
});

test("K577-UI-009 色の値の守り：形に合わない値（色の rgb()・大文字・3 桁・名前・url()、4 つの値以外の寄せ、整数でない colspan・rowspan・start）を持つ文書でも字は出て、style も data-c も colspan・rowspan・start の属性も付かず、javascript・url( を含む style が頁に 1 つも無い", async ({
  page,
}) => {
  await open(page, "badcolor", 1440, "read");
  const view = page.getByTestId("doc-read");
  for (const word of ["rgb の色", "大文字の色", "三桁の色", "名前の色", "url の背景"]) {
    const el = view.getByText(word, { exact: true });
    await expect(el, word).toBeVisible();
    expect(await el.evaluate((e) => e.getAttribute("style") ?? ""), word).toBe("");
    expect(await el.evaluate((e) => e.getAttribute("data-c")), word).toBeNull();
  }
  // 寄せは 4 つの値だけ・colspan／rowspan／start は整数だけ（外れた値は style・属性を付けない）
  const align = view.getByText("不正な寄せ", { exact: true });
  await expect(align).toBeVisible();
  expect(await align.evaluate((e) => e.getAttribute("style") ?? "")).toBe("");
  const start = view.getByText("不正な始まり", { exact: true });
  await expect(start).toBeVisible();
  expect(await start.evaluate((e) => e.closest("ol")?.getAttribute("start") ?? null)).toBeNull();
  for (const [word, attr] of [
    ["不正な横結合", "colspan"],
    ["不正な縦結合", "rowspan"],
  ] as const) {
    const cell = view.getByText(word, { exact: true });
    await expect(cell, word).toBeVisible();
    expect(
      await cell.evaluate((e, a) => e.closest("td,th")?.getAttribute(a) ?? null, attr),
      `${word} ${attr}`,
    ).toBeNull();
  }
  expect(await page.locator('[style*="javascript" i], [style*="url(" i]').count()).toBe(0);
});

test("K577-UI-010 色のある文書だけ読むだけの編集の部品で描く：#rrggbb の色を持つ文書を読む形で開くと編集の部品の script が読まれ、本文の入力欄は無く書き換えられず、色は計算された色で出る。読む形の中に style の要素も data-k-ink／data-k-bg も無い", async ({
  page,
}) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") bodies.push(r.text().catch(() => ""));
  });
  await open(page, "rich", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(liveRoot(page)).toBeVisible();
  await expect.poll(async () => (await Promise.all([...bodies])).some((s) => EDITOR_CHUNK.test(s))).toBe(true);
  await expect(body(page)).toHaveCount(0);
  await expect(view.getByRole("textbox")).toHaveCount(0);
  await expect(view.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(view.getByText("赤い字", { exact: true })).toHaveCSS("color", "rgb(220, 38, 38)");
  await expect(view.getByText("黄の背景", { exact: true })).toHaveCSS("background-color", "rgb(253, 230, 138)");
  await expect(view.locator("style")).toHaveCount(0);
  await expect(view.locator("[data-k-ink], [data-k-bg]")).toHaveCount(0);
});

test("K577-UI-011 色のある文書のチェックの箱：取り扱いを渡さない読む形では押せず（disabled）、渡した読む形では押すと [位置, 付いたか] が渡る。押しても文書は部品の中で書き換わらない（色の無い文書と同じ結果）", async ({
  page,
}) => {
  await open(page, "colortask", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(liveRoot(page)).toBeVisible();
  await expect(view.getByText("色つきの字", { exact: true })).toHaveCSS("color", "rgb(220, 38, 38)");
  await expect(view.getByRole("checkbox")).toHaveCount(2);
  await expect(view.getByRole("checkbox", { name: "送った", exact: true })).toBeChecked();
  await expect(view.getByRole("img", { name: "色のある文書の画像.png", exact: true })).toBeVisible();
  await expect(view.getByRole("checkbox").first()).toBeDisabled();
  await page.getByRole("button", { name: "箱を押せる読む形にする", exact: true }).click();
  const box = view.getByRole("checkbox", { name: "控える", exact: true });
  await expect(box).toBeEnabled();
  await box.click();
  await expect(page.getByTestId("task-log")).toHaveText(JSON.stringify([[1, true]]));
  await expect(box).not.toBeChecked();
  await expect(view.getByRole("checkbox", { name: "送った", exact: true })).toBeChecked();
});

test("K577-UI-012 色のある文書の守り：正しい #rrggbb の色と一緒に、形に合わない値（色の rgb()・大文字・3 桁・名前・url()、4 つの値以外の寄せ、整数でない colspan・rowspan・start、javascript: の href）を持つ文書でも、正しい色だけが付き、外れた値は style にも属性にもならない（色の無い文書と同じ結果）", async ({
  page,
}) => {
  await open(page, "colorbad", 1440, "read");
  const view = page.getByTestId("doc-read");
  await expect(liveRoot(page)).toBeVisible();
  await expect(view.getByText("正しい赤", { exact: true })).toHaveCSS("color", "rgb(220, 38, 38)");
  for (const word of ["rgb の色", "大文字の色", "三桁の色", "名前の色", "url の背景", "不正な寄せ"]) {
    const el = view.getByText(word, { exact: true });
    await expect(el, word).toBeVisible();
    expect(await el.evaluate((e) => e.getAttribute("style") ?? ""), word).toBe("");
    expect(await el.evaluate((e) => e.getAttribute("data-c")), word).toBeNull();
    expect(await el.evaluate((e) => e.closest("mark, [data-c]") === null), word).toBe(true);
  }
  const start = view.getByText("不正な始まり", { exact: true });
  await expect(start).toBeVisible();
  expect(await start.evaluate((e) => e.closest("ol")?.getAttribute("start") ?? null)).toBeNull();
  for (const [word, attr] of [
    ["不正な横結合", "colspan"],
    ["不正な縦結合", "rowspan"],
  ] as const) {
    const cell = view.getByText(word, { exact: true });
    await expect(cell, word).toBeVisible();
    // 外れた値（1.5・文字の "2"）がそのまま属性にならないことを見る（結合していないセルは属性なしか 1）
    expect(["", "1"], `${word} ${attr}`).toContain(
      await cell.evaluate((e, a) => e.closest("td,th")?.getAttribute(a) ?? "", attr),
    );
  }
  await expect(view).toContainText("悪いリンク");
  await expect(view.getByRole("link", { name: "悪いリンク", exact: true })).toHaveCount(0);
  expect(await view.locator('a[href^="javascript:" i]').count()).toBe(0);
  expect(await page.locator('[style*="javascript" i], [style*="url(" i]').count()).toBe(0);
});
