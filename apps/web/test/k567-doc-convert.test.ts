// K-567「本文の道具の部品（核）」のうち、画面を使わない道具の単体試験：編集の部品の木 ⇔ 文書の木（K-561 を K-584 が広げた Doc）の変換・貼り付け HTML の掃除・リンクの許し方・色の値の守り。
//   行 ID は 11_tickets/K-567.md の行の表（K567-UN-001〜008）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   実装はまだ無いので、読み込みは試験の中（動的 import）で行う（まだ無い道具を import の時点で読んで準備を落とさない）。
//   掃除（sanitize-html）は DOMParser を使う。ここは字の並びの変換だけを見る（実ブラウザでの貼り付けは k567-doc-editor.spec.ts の K567-UI-010・011）
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 写した hook の頭（20 行）に出どころと MIT の表示が在る（自前で書き直した物は頭の注の行を「自前」で始める） */
const BAR_DIR = new URL("../features/F4/doc/editor/bar/", import.meta.url);
const headOf = (file: string): string => {
  const url = new URL(file, BAR_DIR);
  // まだ無いときは、読み込みの失敗（ENOENT）でなく確かめの赤にする（準備の赤と見分ける）
  expect(existsSync(url), `${file} が在る`).toBe(true);
  return readFileSync(url, "utf8").split("\n").slice(0, 20).join("\n");
};
function expectOrigin(file: string): void {
  const h = headOf(file);
  if (/^\s*(\/\/|\*)\s*自前/m.test(h)) return;
  expect(h, `${file}：写し元のリポジトリ`).toMatch(/ueberdosis\/tiptap-ui-components/);
  expect(h, `${file}：写し元の版（コミット）`).toMatch(/\b[0-9a-f]{7,40}\b/);
  expect(h, `${file}：元のファイルの道`).toMatch(/apps\/web\/src\/components\/tiptap-ui\/[\w-]+\//);
  expect(h, `${file}：MIT の表示`).toMatch(/MIT/);
  expect(h, `${file}：著作権の表示`).toMatch(/Copyright/i);
}

const CONVERT = "../features/F4/doc/editor/convert";
const SANITIZE = "../features/F4/doc/editor/sanitize-html";
const LINK = "../features/F4/doc/editor/link-policy";
const CONTRACTS = "@kaname/contracts";

type Json = Record<string, unknown>;
type Convert = { fromEditorJson: (j: unknown) => Json; toEditorContent: (d: Json) => Json };
type Contracts = { validateDoc: (d: unknown) => { ok: boolean }; docToText: (d: Json) => string };
const convert = async (): Promise<Convert> => (await import(/* @vite-ignore */ CONVERT)) as Convert;
const contracts = async (): Promise<Contracts> => (await import(/* @vite-ignore */ CONTRACTS)) as Contracts;

const p = (text: string, marks?: Json[]): Json => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
/** 帯の道具が作れる節・印・属性を全部含む、K-584 が広げた形の文書。印は決めた順（bold・italic・underline・strike・code・superscript・subscript・color・highlight・link） */
const FULL = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "目的" }] },
    { type: "heading", attrs: { level: 4, textAlign: "center" }, content: [{ type: "text", text: "小さい見出し" }] },
    { type: "heading", attrs: { level: 3, ghost: true }, content: [{ type: "text", text: "薄い見出し" }] },
    p("支払期日は 12/15", [
      { type: "bold" },
      { type: "underline" },
      { type: "color", attrs: { color: "#dc2626" } },
      { type: "highlight", attrs: { color: "#fde68a" } },
    ]),
    { type: "paragraph", attrs: { textAlign: "right" }, content: [{ type: "text", text: "右寄せ" }] },
    { type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "両端" }] },
    { type: "paragraph", attrs: { ghost: true }, content: [{ type: "text", text: "薄い説明" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "消す", marks: [{ type: "strike" }] },
        { type: "text", text: "code", marks: [{ type: "code" }] },
        { type: "text", text: "2", marks: [{ type: "superscript" }] },
        { type: "text", text: "i", marks: [{ type: "subscript" }] },
        { type: "text", text: "青緑", marks: [{ type: "color", attrs: { color: "teal" } }] },
        { type: "text", text: "旧", marks: [{ type: "highlight" }] },
      ],
    },
    { type: "bulletList", content: [{ type: "listItem", content: [p("明細を集める")] }] },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        { type: "listItem", content: [p("三つ目")] },
        { type: "listItem", content: [p("四つ目")] },
      ],
    },
    { type: "orderedList", content: [{ type: "listItem", content: [p("一つ目")] }] },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [p("送った")] },
        { type: "taskItem", attrs: { checked: false }, content: [p("控える")] },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableHeader", attrs: { colspan: 2, colwidth: [120, 80] }, content: [p("項目")] }],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [p("見出しの行の左")] },
            { type: "tableCell", attrs: { rowspan: 2 }, content: [p("保守")] },
          ],
        },
        { type: "tableRow", content: [{ type: "tableHeader", content: [p("見出しの列")] }] },
      ],
    },
    { type: "blockquote", content: [p("先月と同じ書式で")] },
    { type: "codeBlock", content: [{ type: "text", text: "a = 1\nb = 2" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "資料", marks: [{ type: "link", attrs: { href: "https://example.com/a" } }] },
        { type: "hardBreak" },
        { type: "text", text: "次の行" },
      ],
    },
    { type: "image", attrs: { caption: "先月の請求書の見本.png", attachment_id: null } },
  ],
};

describe("編集の部品の木 ⇔ 文書の木（K-567）", () => {
  it("K567-UN-001 編集の部品が出す余りの鍵と既定の値（表のセルの colspan・rowspan が 1・colwidth が null・コードの language・リンクの target と rel と class・null の ghost／textAlign・番号つきの type と start が 1・ハイライトの null の色・textStyle の色以外）は落ち、結合したセルの値と start が 2 以上の並びは残り、validateDoc を通る", async () => {
    const { fromEditorJson } = await convert();
    const { validateDoc } = await contracts();
    const raw = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { ghost: null, textAlign: null } },
        {
          type: "orderedList",
          attrs: { start: 1, type: null },
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }],
        },
        {
          type: "orderedList",
          attrs: { start: 5, type: null },
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] }],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: "paragraph" }],
                },
                {
                  type: "tableCell",
                  attrs: { colspan: 2, rowspan: 3, colwidth: [100, 50] },
                  content: [{ type: "paragraph" }],
                },
              ],
            },
          ],
        },
        { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "x" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "a",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.com", target: "_blank", rel: "noopener", class: null },
                },
              ],
            },
            {
              type: "text",
              text: "b",
              marks: [
                { type: "highlight", attrs: { color: null } },
                {
                  type: "textStyle",
                  attrs: {
                    color: "#16a34a",
                    fontSize: null,
                    fontFamily: null,
                    lineHeight: null,
                    backgroundColor: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const doc = fromEditorJson(raw);
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(
      /"language"|target|"rel"|class|"ghost":null|"textAlign":null|"type":null|"start":1\b|fontSize|fontFamily|lineHeight|backgroundColor|"color":null|"colspan":1|"rowspan":1|"colwidth":null|textStyle/,
    );
    expect(json).toContain('"start":5');
    expect(json).toContain('"colspan":2');
    expect(json).toContain('"rowspan":3');
    expect(json).toContain('"colwidth":[100,50]');
    expect(json).toContain('"color":"#16a34a"');
    expect(validateDoc(doc).ok).toBe(true);
  });

  it("K567-UN-002 空の段落だけ（編集の部品が空の本文に持つ形）は content が空の文書になり、素の文字は空", async () => {
    const { fromEditorJson } = await convert();
    const { docToText } = await contracts();
    const doc = fromEditorJson({ type: "doc", content: [{ type: "paragraph" }] });
    expect(doc).toEqual({ type: "doc", content: [] });
    expect(docToText(doc)).toBe("");
    expect(fromEditorJson({ type: "doc" })).toEqual({ type: "doc", content: [] });
  });

  it("K567-UN-003 文書の木 → 編集の部品の木 → 文書の木で、番号つきの並び・区切りの線・見出し 4・寄せ・結合した表・下線・取り消し線・行の中のコード・上付き・下付き・文字の色（16 進と旧い名前）・背景の色・チェック・引用・コード・リンク・薄い字を含む文書がそのまま戻り、素の文字も同じ", async () => {
    const { fromEditorJson, toEditorContent } = await convert();
    const { validateDoc, docToText } = await contracts();
    const back = fromEditorJson(toEditorContent(FULL as Json));
    expect(back).toEqual(FULL);
    expect(validateDoc(back).ok).toBe(true);
    expect(docToText(back)).toBe(docToText(FULL as Json));
  });

  it("K567-UN-004 貼り付け HTML の掃除：script・style・iframe・object・embed・form は中身ごと消え、on* の属性・style の属性・javascript:／data:／vbscript: のリンクは落ち、見出し・段落・箇条書き・太字・表・普通のリンクは残る", async () => {
    const { sanitizePastedHtml } = (await import(/* @vite-ignore */ SANITIZE)) as {
      sanitizePastedHtml: (h: string) => string;
    };
    const dirty =
      '<h2 onclick="x()">見出し</h2><script>window.__pwned=1</script><style>p{display:none}</style>' +
      '<iframe src="https://evil.example"></iframe><object data="a"></object><embed src="b"><form action="c"><input></form>' +
      '<p style="color:red"><strong>太字</strong> <a href="javascript:alert(1)">悪いリンク</a> <a href=" JaVaScRiPt:alert(2)">空白つき</a> ' +
      '<a href="data:text/html,x">データ</a> <a href="vbscript:x">vb</a> <a href="https://example.com/ok" onmouseover="y()">良いリンク</a></p>' +
      '<img src="x" onerror="window.__pwned=2"><ul><li>項目</li></ul><table><tr><td>セル</td></tr></table>';
    const out = sanitizePastedHtml(dirty);
    expect(out).not.toMatch(
      /<script|<style|<iframe|<object|<embed|<form|<input|onclick|onerror|onmouseover|style=|javascript:|vbscript:|data:text|__pwned/i,
    );
    for (const keep of [
      "見出し",
      "<strong>太字</strong>",
      "悪いリンク",
      "空白つき",
      "データ",
      "https://example.com/ok",
      "<li>項目</li>",
      "<td>セル</td>",
    ])
      expect(out).toContain(keep);
  });

  it("K567-UN-005 貼り付け HTML の掃除の続き：見出し 1 は見出し 2・見出し 2 は見出し 3・見出し 3 以降（3・5・6）は見出し 4 に寄せ（Markdown の `#`・`##`・`###` 以降と同じ）、番号つき・区切りの線・下線・取り消し線・上付き・下付き・行の中のコードは残り、style の属性（貼った物の色）は落ちる", async () => {
    const { sanitizePastedHtml } = (await import(/* @vite-ignore */ SANITIZE)) as {
      sanitizePastedHtml: (h: string) => string;
    };
    const out = sanitizePastedHtml(
      '<h1>一</h1><h2>二</h2><h3>三</h3><h5>五</h5><h6>六</h6><ol start="3"><li>三</li></ol><hr><p><u>下線</u><s>消す</s><del>削除</del><sup>2</sup><sub>i</sub><code>code</code><span style="color:#ff0000;background:#00ff00">色</span></p>',
    );
    expect(out).not.toMatch(/<h1|<h5|<h6|style=/i);
    expect(out).toContain("<h2>一</h2>");
    expect(out).toContain("<h3>二</h3>");
    expect(out).toContain("<h4>三</h4>");
    expect((out.match(/<h2>/g) ?? []).length).toBe(1);
    expect((out.match(/<h3>/g) ?? []).length).toBe(1);
    expect((out.match(/<h4>/g) ?? []).length).toBe(3);
    for (const keep of ["<ol", "<hr", "<u>下線</u>", "<sup>2</sup>", "<sub>i</sub>", "<code>code</code>", "色"])
      expect(out).toContain(keep);
    expect(out).toMatch(/<(s|del)>/);
  });

  it("K567-UN-006 リンクの許し方：http・https・mailto だけ。大文字・前後の空白は許す。javascript:・data:・vbscript:・空白や制御文字を挟んだ javascript:・//で始まる物・相対・空・NUL・2049 字以上は許さない", async () => {
    const { isAllowedHref } = (await import(/* @vite-ignore */ LINK)) as { isAllowedHref: (h: string) => boolean };
    for (const ok of [
      "https://example.com",
      "http://example.com/a?b=1#c",
      "mailto:a@example.com",
      "HTTPS://EXAMPLE.COM",
      "  https://example.com  ",
    ])
      expect(isAllowedHref(ok), ok).toBe(true);
    const long = "https://example.com/" + "a".repeat(2048);
    const bad = [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "\u0000javascript:alert(1)",
      " javascript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "//evil.example",
      "/relative/path",
      "example.com",
      "",
      "https://example.com/\u0000",
      long,
    ];
    for (const b of bad) expect(isAllowedHref(b), JSON.stringify(b)).toBe(false);
  });
  it("K567-UN-007 色の値の守り：文字の色は #rrggbb（小文字 6 桁）と旧い名前（red・teal・amber）、背景の色は #rrggbb だけが残り、大文字・3 桁・rgb()・名前・url()・var()・長い値を持つ印と、背景の色の旧い名前は、印ごと落ちる。文字は残る", async () => {
    const { fromEditorJson } = await convert();
    const { validateDoc } = await contracts();
    const mk = (mark: Json): Json => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "字", marks: [mark] }] }],
    });
    const keep: Json[] = [
      { type: "textStyle", attrs: { color: "#dc2626" } },
      { type: "textStyle", attrs: { color: "red" } },
      { type: "textStyle", attrs: { color: "teal" } },
      { type: "textStyle", attrs: { color: "amber" } },
      { type: "highlight", attrs: { color: "#fde68a" } },
    ];
    for (const m of keep) {
      const doc = fromEditorJson(mk(m)) as { content: { content: { marks?: unknown[] }[] }[] };
      expect(doc.content[0]!.content[0]!.marks?.length, JSON.stringify(m)).toBe(1);
      expect(validateDoc(doc).ok).toBe(true);
    }
    const bad = [
      "#DC2626",
      "#f00",
      "rgb(220,38,38)",
      "blue",
      "url(javascript:x)",
      "var(--k-primary)",
      "#dc2626;background:red",
      "#dc26261",
      "",
    ];
    for (const c of bad) {
      for (const type of ["textStyle", "highlight"]) {
        const doc = fromEditorJson(mk({ type, attrs: { color: c } })) as {
          content: { content: { text: string; marks?: unknown[] }[] }[];
        };
        expect(doc.content[0]!.content[0]!.text).toBe("字");
        expect(doc.content[0]!.content[0]!.marks ?? [], `${type} ${c}`).toEqual([]);
        expect(validateDoc(doc).ok).toBe(true);
      }
    }
    // 旧い名前（red・teal・amber）は文字の色だけ。背景の色（highlight）に来たら印ごと落とす（K-584 DOC-011）
    for (const c of ["red", "teal", "amber"]) {
      const doc = fromEditorJson(mk({ type: "highlight", attrs: { color: c } })) as {
        content: { content: { text: string; marks?: unknown[] }[] }[];
      };
      expect(doc.content[0]!.content[0]!.text).toBe("字");
      expect(doc.content[0]!.content[0]!.marks ?? [], `highlight ${c}`).toEqual([]);
      expect(validateDoc(doc).ok).toBe(true);
    }
    expect(JSON.stringify(fromEditorJson(mk({ type: "textStyle", attrs: { color: "red" } })))).not.toContain(
      "textStyle",
    );
  });

  it("K567-UN-008 写した部品の関数（use-mark-button・use-undo-redo・use-link-popover）の頭に、出どころ（リポジトリ・版＝コミット・元のファイルの道）と MIT の許諾の表示が在る。自前で書き直した物は頭の注の行を「自前」で始める", () => {
    for (const f of ["use-mark-button.ts", "use-undo-redo.ts", "use-link-popover.ts"]) expectOrigin(f);
  });
});
