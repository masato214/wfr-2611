// K-567「本文の道具の部品（核）：見たまま編集する部品（Tiptap）と、読む形の描き」の試験（実 Chrome・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f4v2-editor/f4v2-editor-tools（本物の部品を 1 つ置いた頁。口は呼ばない）。
//     ?doc=empty|plain|full|ghost（最初の文書）。頁は部品の出す文書の木を data-testid="doc-json"・
//     素の文字を "doc-text"・validateDoc の結果を "doc-verdict"（ok か ng:理由）に出す。
//     読む形の描き（DocView）と、編集の部品の遅い読み込みの確かめは K-577（k577-doc-view.spec.ts）が持つ。
//   この葉が動かす帯の道具：戻す・やり直す・太字・斜体・下線・取り消し線・行の中のコード・リンク（見出し・並び・引用・コードの囲み・寄せ・上付き下付き・区切りの線・画像は K-587、色と表は K-568）。
//   見ること：帯の道具が効く（押す・キーボード）・押した結果が部品の出す文書の木に出る・危ない貼り付けが落ちる・日本語の変換中に崩れない・
//     読み上げの名前・幅 375／768／1440 のはみ出し 0。
//   画面に出す字と並びは下絵（features/F4/doc の DocBar・FreeDoc）が正。下絵に無い小さな入力（リンク）の字は K-567 の「画面の文」の勧めのとおり。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { matchMock } from "./stage2-match";

type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
const BASE = "/dev/mock/f4v2-editor/f4v2-editor-tools";
const WIDTHS = [375, 768, 1440] as const;
/** 帯の道具の名前と並び（下絵の DocBar と同じ・23 個）。出来合いの編集の部品の UI を土台にした並び（D-150.61） */
const TOOL_NAMES = [
  "戻す",
  "やり直す",
  "見出し",
  "並び",
  "引用",
  "コードの囲み",
  "太字",
  "斜体",
  "下線",
  "取り消し線",
  "行の中のコード",
  "文字の色",
  "背景の色",
  "リンク",
  "上付き",
  "下付き",
  "左寄せ",
  "中央",
  "右寄せ",
  "両端",
  "表",
  "区切りの線",
  "画像",
] as const;
type ToolName = (typeof TOOL_NAMES)[number];
async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "部品は口を呼ばない" }));
}

async function open(page: Page, doc: string, width = 1440) {
  await guard(page);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`${BASE}?doc=${doc}`);
  expect(res?.status(), "頁を開けない").toBe(200);
  await expect(page.locator('[data-mock="f4v2-editor-tools"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const body = (page: Page) => page.getByRole("textbox", { name: "本文", exact: true });
const tool = (page: Page, name: ToolName) =>
  page.getByRole("toolbar", { name: "本文の道具", exact: true }).getByRole("button", { name, exact: true });
const isOff = async (l: ReturnType<typeof tool>) =>
  (await l.isDisabled()) || (await l.getAttribute("aria-disabled")) === "true";
const outDoc = async (page: Page): Promise<Node> => JSON.parse(await page.getByTestId("doc-json").innerText()) as Node;
const outText = (page: Page) => page.getByTestId("doc-text").innerText();

function walk(n: Node, f: (n: Node) => void): void {
  f(n);
  (n.content ?? []).forEach((c) => walk(c, f));
}
const find = (n: Node, pred: (n: Node) => boolean): Node[] => {
  const r: Node[] = [];
  walk(n, (x) => pred(x) && r.push(x));
  return r;
};
const hasMark = (n: Node, mark: string, text?: string) =>
  find(
    n,
    (x) => x.type === "text" && (text === undefined || x.text === text) && !!x.marks?.some((m) => m.type === mark),
  ).length > 0;

/** 本文に打つ。全部の字を選んで置き換える（まず空にする） */
async function typeFresh(page: Page, text: string) {
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text);
}
const selectAll = async (page: Page) => {
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+a");
};

async function paste(page: Page, data: Record<string, string>) {
  await page.evaluate((d) => {
    const el = document.querySelector('[role="textbox"][aria-label="本文"]');
    if (!el) throw new Error("本文が無い");
    const dt = new DataTransfer();
    for (const [type, value] of Object.entries(d)) dt.setData(type, value);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, data);
}

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("K567-UI-001 帯：道具の名前が決めた並び（戻す・やり直す｜見出し・並び・引用・コードの囲み｜太字・斜体・下線・取り消し線・行の中のコード｜文字の色・背景の色・リンク｜上付き・下付き｜左寄せ・中央・右寄せ・両端｜表・区切りの線・画像）で 23 個あり、この葉が動かす 8 つのうち、太字・斜体・下線・取り消し線・行の中のコード・リンクの 6 つは押せる形で、戻す・やり直すは何も戻せない・やり直せない間は押せない形。本文の入力欄は『本文』の名前を持つ", async ({
  page,
}) => {
  await open(page, "empty");
  await expect(page.getByRole("toolbar", { name: "本文の道具", exact: true })).toBeVisible();
  const names = await page
    .getByRole("toolbar", { name: "本文の道具", exact: true })
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(names).toEqual([...TOOL_NAMES]);
  for (const n of ["太字", "斜体", "下線", "取り消し線", "行の中のコード", "リンク"] as const)
    expect(await isOff(tool(page, n)), n).toBe(false);
  for (const n of ["戻す", "やり直す"] as const)
    expect(await isOff(tool(page, n)), `${n}（何も無い間は押せない）`).toBe(true);
  await expect(body(page)).toBeVisible();
  await expect(body(page)).toHaveAttribute("contenteditable", "true");
});

test("K567-UI-002 字の印：字を選んで『太字』『斜体』『下線』『取り消し線』『行の中のコード』を押すと、その字だけに bold・italic・underline・strike・code が付いて部品の出す文書の木に出る。もう一度押すと外れる。素の文字は変わらない", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "支払期日");
  for (const [name, mark] of [
    ["太字", "bold"],
    ["斜体", "italic"],
    ["下線", "underline"],
    ["取り消し線", "strike"],
    ["行の中のコード", "code"],
  ] as const) {
    await selectAll(page);
    await tool(page, name).click();
    await expect.poll(async () => hasMark(await outDoc(page), mark, "支払期日"), name).toBe(true);
    await tool(page, name).click();
    await expect.poll(async () => hasMark(await outDoc(page), mark), name).toBe(false);
  }
  expect(await outText(page)).toBe("支払期日");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K567-UI-003 キーボード：Ctrl／⌘+B で太字・+I で斜体・+U で下線・+Z で戻す・+Shift+Z でやり直す", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "確認");
  await selectAll(page);
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(async () => hasMark(await outDoc(page), "bold", "確認")).toBe(true);
  await page.keyboard.press("ControlOrMeta+i");
  await expect.poll(async () => hasMark(await outDoc(page), "italic", "確認")).toBe(true);
  await page.keyboard.press("ControlOrMeta+u");
  await expect.poll(async () => hasMark(await outDoc(page), "underline", "確認")).toBe(true);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => hasMark(await outDoc(page), "underline", "確認")).toBe(false);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => hasMark(await outDoc(page), "italic", "確認")).toBe(false);
  await expect.poll(async () => hasMark(await outDoc(page), "bold", "確認")).toBe(true);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => hasMark(await outDoc(page), "italic", "確認")).toBe(true);
});

test("K567-UI-004 戻す・やり直す：打つ前は『戻す』『やり直す』とも押せない。太字を付けて『戻す』を押すと付ける前に戻り、『やり直す』で付いた形に戻る。付いた形に戻ったあとは『やり直す』が押せない", async ({
  page,
}) => {
  await open(page, "empty");
  expect(await isOff(tool(page, "戻す"))).toBe(true);
  expect(await isOff(tool(page, "やり直す"))).toBe(true);
  await typeFresh(page, "確認");
  await selectAll(page);
  await tool(page, "太字").click();
  await expect.poll(async () => hasMark(await outDoc(page), "bold", "確認")).toBe(true);
  expect(await isOff(tool(page, "戻す"))).toBe(false);
  await tool(page, "戻す").click();
  await expect.poll(async () => hasMark(await outDoc(page), "bold")).toBe(false);
  expect(await isOff(tool(page, "やり直す"))).toBe(false);
  await tool(page, "やり直す").click();
  await expect.poll(async () => hasMark(await outDoc(page), "bold", "確認")).toBe(true);
  expect(await isOff(tool(page, "やり直す"))).toBe(true);
  expect(await outText(page)).toBe("確認");
});

test("K567-UI-005 リンク：字を選んで『リンク』→ 小さな入力『リンク先』に https のリンクを入れて『付ける』と href の印が付く。『リンクを外す』で外れる", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "資料");
  await selectAll(page);
  await tool(page, "リンク").click();
  const dlg = page.getByRole("dialog", { name: "リンク", exact: true });
  await dlg.getByRole("textbox", { name: "リンク先", exact: true }).fill("https://example.com/a");
  await dlg.getByRole("button", { name: "付ける", exact: true }).click();
  await expect
    .poll(
      async () =>
        find(
          await outDoc(page),
          (n) => !!n.marks?.some((m) => m.type === "link" && m.attrs?.["href"] === "https://example.com/a"),
        ).length,
    )
    .toBe(1);
  expect(JSON.stringify(await outDoc(page))).not.toMatch(/target|"rel"|class/);
  await selectAll(page);
  await tool(page, "リンク").click();
  await page
    .getByRole("dialog", { name: "リンク", exact: true })
    .getByRole("button", { name: "リンクを外す", exact: true })
    .click();
  await expect.poll(async () => hasMark(await outDoc(page), "link")).toBe(false);
  expect(await outText(page)).toBe("資料");
});

test("K567-UI-006 リンクの守り：javascript:・data:・http でも mailto でもない文字を入れても『付ける』は効かず、『http・https・mailto のリンクだけ使えます』と出て、文書にリンクは入らない。mailto: は付く", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "危ない");
  await selectAll(page);
  await tool(page, "リンク").click();
  const dlg = page.getByRole("dialog", { name: "リンク", exact: true });
  const input = dlg.getByRole("textbox", { name: "リンク先", exact: true });
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "example.com", "//evil.example"]) {
    await input.fill(bad);
    await dlg.getByRole("button", { name: "付ける", exact: true }).click();
    await expect(dlg.getByRole("alert")).toHaveText("http・https・mailto のリンクだけ使えます");
    expect(hasMark(await outDoc(page), "link"), bad).toBe(false);
  }
  await input.fill("mailto:info@example.com");
  await dlg.getByRole("button", { name: "付ける", exact: true }).click();
  await expect.poll(async () => hasMark(await outDoc(page), "link", "危ない")).toBe(true);
});

test("K567-UI-007 貼り付け HTML の守り：script・onerror の画像・javascript: のリンク・iframe を含む HTML を貼っても、実行されず、文書にも入らない（字は残る）", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  await paste(page, {
    "text/html":
      '<p>安全な字</p><script>window.__pwned = 1</script><img src="x" onerror="window.__pwned = 2"><iframe src="https://evil.example"></iframe>' +
      '<p><a href="javascript:window.__pwned = 3">悪いリンク</a> <a href="https://example.com/ok">良いリンク</a></p>',
    "text/plain": "安全な字\n悪いリンク 良いリンク",
  });
  await expect.poll(async () => (await outText(page)).includes("安全な字")).toBe(true);
  const json = JSON.stringify(await outDoc(page));
  expect(json).not.toMatch(/script|onerror|iframe|javascript:|__pwned/);
  expect(json).toContain("https://example.com/ok");
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K567-UI-008 貼り付け HTML で、見出し・箇条書き・番号つき・区切りの線・太字・取り消し線・表は文書の木の形（heading・bulletList・orderedList・horizontalRule・bold・strike・table）に変わって残り、見出し 1 は level 2・見出し 2 は level 3・見出し 3 以降（3・5）は level 4 になる（Markdown と同じ）。style の色は入らない", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  await paste(page, {
    "text/html":
      '<h1>一</h1><h2>二</h2><h3>三</h3><h5>五</h5><ul><li>明細を集める</li></ul><ol start="3"><li>三つ目</li></ol><hr><p><strong>期日</strong>は <s>12/14</s> 12/15 <span style="color:#ff0000">赤</span></p>' +
      "<table><tr><th>項目</th></tr><tr><td>保守</td></tr></table>",
  });
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "table").length).toBe(1);
  const d = await outDoc(page);
  expect(find(d, (n) => n.type === "heading").map((n) => n.attrs?.["level"])).toEqual([2, 3, 4, 4]);
  expect(find(d, (n) => n.type === "bulletList").length).toBe(1);
  expect(find(d, (n) => n.type === "orderedList" && n.attrs?.["start"] === 3).length).toBe(1);
  expect(find(d, (n) => n.type === "horizontalRule").length).toBe(1);
  expect(hasMark(d, "bold", "期日")).toBe(true);
  expect(hasMark(d, "strike", "12/14")).toBe(true);
  expect(hasMark(d, "color")).toBe(false);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K567-UI-017 置けない場所に貼る：引用・表のセルの中に見出し・並び・区切りの線を含む HTML を貼っても、その中は段落だけのまま（置ける場所は K-584 と同じ）。貼った字は残り、文書は validateDoc を通る", async ({
  page,
}) => {
  const INNER = new Set(["blockquote", "tableCell", "tableHeader", "taskItem"]);
  const strays = (d: Node) =>
    find(d, (n) => INNER.has(n.type)).flatMap((n) => (n.content ?? []).filter((c) => c.type !== "paragraph"));
  const cases: { html: string; holder: string; words: string[] }[] = [
    {
      html: "<blockquote><h2>見出しの字</h2><ul><li>明細</li></ul><hr><p>終わり</p></blockquote>",
      holder: "blockquote",
      words: ["見出しの字", "明細", "終わり"],
    },
    {
      html: '<table><tr><th>項目</th></tr><tr><td><ol start="3"><li>三つ目</li></ol><h3>見出しの字</h3></td></tr></table>',
      holder: "table",
      words: ["項目", "三つ目", "見出しの字"],
    },
  ];
  for (const c of cases) {
    await open(page, "empty");
    await body(page).click();
    await paste(page, { "text/html": c.html });
    for (const w of c.words) await expect.poll(() => outText(page), c.holder).toContain(w);
    const d = await outDoc(page);
    expect(strays(d), c.holder).toEqual([]);
    const top = (d.content ?? []).map((n) => n.type);
    expect(
      find(d, (n) => n.type === "heading" || n.type === "horizontalRule").every((n) => (d.content ?? []).includes(n)),
      `${c.holder}：見出し・区切りの線は doc の直下だけ（${top.join("・")}）`,
    ).toBe(true);
    await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
  }
});

test("K567-UI-009 日本語の変換中：変換の途中の字は文書に二重に入らず、確定すると確定した字だけが入る。変換の途中でも画面が崩れない", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "にほん", selectionStart: 3, selectionEnd: 3 });
  await expect(body(page)).toContainText("にほん");
  expect(await overflowX(page)).toBe(0);
  await cdp.send("Input.insertText", { text: "日本" });
  await expect.poll(() => outText(page)).toBe("日本");
  await expect(body(page)).not.toContainText("にほん");
  await page.keyboard.type("語");
  await expect.poll(() => outText(page)).toBe("日本語");
});

test("K567-UI-010 読み上げ：本文は入力欄（複数行）で名前『本文』・帯は『本文の道具』・押された道具は aria-pressed が true になり、外すと false", async ({
  page,
}) => {
  await open(page, "empty");
  await expect(body(page)).toHaveAttribute("aria-multiline", "true");
  await typeFresh(page, "太字にする");
  await expect(tool(page, "太字")).toHaveAttribute("aria-pressed", "false");
  await selectAll(page);
  await tool(page, "太字").click();
  await expect(tool(page, "太字")).toHaveAttribute("aria-pressed", "true");
  await tool(page, "太字").click();
  await expect(tool(page, "太字")).toHaveAttribute("aria-pressed", "false");
});

test("K567-UI-011 キーボードだけ：帯は Tab の停止点が 1 つ（最初は『太字』・Shift+Tab で届く）・フォーカスの輪郭が見え・Enter で押せて・← → で道具を移れて・Tab で本文に戻れる", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "確認");
  await selectAll(page);
  await page.keyboard.press("Shift+Tab");
  await expect(tool(page, "太字")).toBeFocused();
  const outline = await tool(page, "太字").evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect.poll(async () => hasMark(await outDoc(page), "bold", "確認")).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect(tool(page, "斜体")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tool(page, "太字")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(body(page)).toBeFocused();
});

test("K567-UI-012 読み込み：番号つき・区切りの線・結合した表・寄せ・色・画像・チェック・引用・コード・リンク・薄い字を持つ文書を渡して何も触らないと、部品の出す文書の木は渡した物と同じで、validateDoc を通る", async ({
  page,
}) => {
  await open(page, "full");
  await expect(body(page)).toBeVisible();
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
  const before = await outDoc(page);
  await body(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type("x");
  await page.keyboard.press("Backspace");
  await expect.poll(async () => JSON.stringify(await outDoc(page))).toBe(JSON.stringify(before));
  for (const type of ["table", "taskList", "blockquote", "codeBlock", "image", "orderedList", "horizontalRule"])
    expect(find(before, (n) => n.type === type).length, type).toBe(1);
  expect(hasMark(before, "link", "資料")).toBe(true);
});

test("K567-UI-013 空の本文：何も書かないとき、出る文書の木は content が空で、素の文字は空。書いて全部消すと空に戻る", async ({
  page,
}) => {
  await open(page, "empty");
  expect(await outDoc(page)).toEqual({ type: "doc", content: [] });
  expect(await outText(page)).toBe("");
  await typeFresh(page, "あ");
  await expect.poll(() => outText(page)).toBe("あ");
  await page.keyboard.press("Backspace");
  await expect.poll(async () => (await outDoc(page)).content?.length ?? 0).toBe(0);
});

test("K567-UI-014 薄い字（ひな形）：薄い見出しと説明は薄く出て、薄い段落に打ち始めると薄い字は消えて打った字だけが普通の字として残る。打たない薄い字は文書に ghost で残り素の文字に入らない", async ({
  page,
}) => {
  await open(page, "ghost");
  const d0 = await outDoc(page);
  expect(find(d0, (n) => n.attrs?.["ghost"] === true).length).toBeGreaterThanOrEqual(2);
  expect(await outText(page)).toBe("");
  const ghostP = body(page).locator("p[data-ghost='true']").first();
  await expect(ghostP).toBeVisible();
  await ghostP.click();
  await page.keyboard.type("請求を届ける");
  await expect.poll(() => outText(page)).toBe("請求を届ける");
  const d1 = await outDoc(page);
  expect(
    find(d1, (n) => n.type === "paragraph" && n.attrs?.["ghost"] === true && JSON.stringify(n).includes("請求を届ける"))
      .length,
  ).toBe(0);
  expect(JSON.stringify(d1)).not.toContain("このチケットで何を実現したいかを書きます");
  expect(find(d1, (n) => n.attrs?.["ghost"] === true).length).toBeGreaterThanOrEqual(1);
});

test("K567-UI-015 幅 375・768・1440：幅 768 以上は帯が折り返して道具が全部見え（帯の scrollWidth - clientWidth が 0・折り返しなので 1440 で 1 段に収まらなければ 2 段）、幅 375 は帯の中で横に送られて（中身が帯より広い・帯の外へは出ない）送れる側にだけ影が出る。どの幅も頁の横のはみ出しは 0 で、広い表と長いコードを入れても本文の中だけ", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await open(page, "full", w);
    await expect(body(page)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    const barEl = page.getByRole("toolbar", { name: "本文の道具", exact: true });
    const bar = await barEl.boundingBox();
    expect(bar!.x + bar!.width, `幅 ${w} の帯`).toBeLessThanOrEqual(w);
    const [inner, outer, wrap, bg, bgAttach] = await barEl.evaluate(
      (e) =>
        [
          e.scrollWidth,
          e.clientWidth,
          getComputedStyle(e).flexWrap,
          getComputedStyle(e).backgroundImage,
          getComputedStyle(e).backgroundAttachment,
        ] as const,
    );
    if (w >= 768) {
      expect(wrap, `幅 ${w} の帯は折り返す`).toBe("wrap");
      expect(inner - outer, `幅 ${w}：道具が全部見えている`).toBe(0);
      const last = await tool(page, "画像").boundingBox();
      expect(last!.x + last!.width, `幅 ${w}：最後の道具が帯の中`).toBeLessThanOrEqual(bar!.x + bar!.width);
    } else {
      expect(inner, "狭い幅では帯の中身が帯より広い（横に送る）").toBeGreaterThan(outer);
      expect(wrap).toBe("nowrap");
      expect(bg, "送れる側にだけ出す影（local の覆いと scroll の影）").toContain("linear-gradient");
      expect(bgAttach).toContain("local");
      expect(bgAttach).toContain("scroll");
      const shadowEnds = await barEl.evaluate((e) => {
        const left0 = e.scrollLeft;
        e.scrollLeft = 0;
        const atStart = e.scrollLeft === 0;
        e.scrollLeft = e.scrollWidth;
        return { atStart, moved: e.scrollLeft > left0 };
      });
      expect(shadowEnds.moved, "右へ送れる").toBe(true);
    }
    await typeFresh(page, "あ".repeat(400));
    expect(await overflowX(page), `幅 ${w}・長い字`).toBe(0);
  }
});

// ---- 下絵 v2 に足された 2 つの状態（リンクの小さな入力・使えない値の赤い字）との突き合わせ
const LINK_PAIRS: FidelityPair[] = [
  {
    name: "pop",
    role: "pop",
    canvas: ".k-f4d-pop-link",
    app: ".k-f4d-pop-link",
    props: ["width", "background-color", "border-top-left-radius"],
  },
  {
    name: "title",
    role: "title",
    canvas: ".k-f4d-pop-title",
    app: ".k-f4d-pop-title",
    props: ["font-size", "font-weight", "color", "texts"],
  },
  {
    name: "input",
    role: "input",
    canvas: ".k-f4d-pop-link .k-input",
    app: ".k-f4d-pop-link .k-input",
    props: ["height", "font-size", "border-top-color"],
  },
  {
    name: "acts",
    role: "acts",
    canvas: ".k-f4d-pop-acts button",
    app: ".k-f4d-pop-acts button",
    props: ["height", "font-size", "color", "texts"],
  },
  {
    name: "err",
    role: "err",
    canvas: ".k-f4d-pop-link .k-err",
    app: ".k-f4d-pop-link .k-err",
    props: ["font-size", "color", "texts"],
  },
];
for (const [id, bad] of [
  ["f4v2-editor-link", false],
  ["f4v2-editor-link-error", true],
] as const) {
  test(`K567-UI-016 下絵との突き合わせ（${id}）：幅 375・768・1440 でリンクの小さな入力の大きさ・題・入力の高さ・『リンクを外す』『付ける』・${bad ? "使えない値の赤い字" : "字"}が下絵と同じ値`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows, bad: diff } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await open(page, "plain", w);
          await selectAll(page);
          await tool(page, "リンク").click();
          const dlg = page.getByRole("dialog", { name: "リンク", exact: true });
          await dlg
            .getByRole("textbox", { name: "リンク先", exact: true })
            .fill(bad ? "javascript:alert(1)" : "https://www.seiko-shoji.example/invoice");
          if (bad) {
            await dlg.getByRole("button", { name: "付ける", exact: true }).click();
            await expect(dlg.getByRole("alert")).toBeVisible();
          }
        },
        { base: "/dev/mock/f4v2", pairs: LINK_PAIRS, blur: true },
      );
      expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(diff, diff.join("\n")).toEqual([]);
    }
  });
}
