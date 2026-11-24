"use client";
// 本文の道具の部品を、本物のまま 1 つ置く開発用の頁（K-567・試験の置き場。正の絵ではない＝正の絵は下絵 v2 の /dev/mock/f4v2）。
//   置き方は下絵 v2 の作る面（f4v2-editor-link など）と同じ枠（Frame・CreateForm の本文の欄）。部品の出す文書の木を
//   data-testid="doc-json"（JSON）・"doc-text"（docToText）・"doc-verdict"（validateDoc の結果。ok か ng:理由）に出す。
//   最初の文書は ?doc=empty|plain|full|calm|ghost|rich|badcolor|colortask|colorbad・?mode=read|edit（既定 edit・読む形は DocView を data-testid="doc-read" で包む・K-577）。口は呼ばない
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { docToText, emptyDoc, validateDoc, type Doc } from "@kaname/contracts";
import type { Theme } from "@/lib/theme";
import { DocEditor, DocView } from "@/features/F4/doc/editor";
import { CreateForm, SPEC_LINES } from "@/features/F4/doc/views";
import { CreateHeadFull } from "@/features/F4/doc/create-views";
import { Frame } from "../f4/frame";

/** 置き場の状態の id（K-587 が f4v2-editor-format・K-568 が f4v2-editor-more を足す） */
export const LIVE_PAGES = ["f4v2-editor-tools"] as const;
export type LivePage = (typeof LIVE_PAGES)[number];
export const isLivePage = (id: string): id is LivePage => (LIVE_PAGES as readonly string[]).includes(id);

const CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "チケットを作る" }];
const p = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
/** 帯の道具が作れる節・印・属性を全部含む文書（番号つき・区切りの線・見出し 4・寄せ・結合した表・色・画像・チェック・引用・コード・リンク・薄い字）。
 *  各節は 1 つずつ（K567-UI-012 が数える）・表の見出しの行は『項目』『数量』（K577-UI-003 が読む形で数える） */
const FULL = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "目的" }] },
    { type: "heading", attrs: { level: 4, textAlign: "center" }, content: [{ type: "text", text: "小さい見出し" }] },
    { type: "heading", attrs: { level: 3, ghost: true }, content: [{ type: "text", text: "薄い見出し" }] },
    p("支払期日は 12/15", [
      { type: "bold" },
      { type: "underline" },
      { type: "color", attrs: { color: "red" } },
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
        { type: "text", text: "赤", marks: [{ type: "color", attrs: { color: "#dc2626" } }] },
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
          content: [
            { type: "tableHeader", content: [p("項目")] },
            { type: "tableHeader", content: [p("数量")] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", attrs: { rowspan: 2 }, content: [p("保守")] },
            { type: "tableCell", content: [p("1")] },
          ],
        },
        { type: "tableRow", content: [{ type: "tableCell", content: [p("2")] }] },
        {
          type: "tableRow",
          content: [{ type: "tableCell", attrs: { colspan: 2, colwidth: [120, 80] }, content: [p("合計")] }],
        },
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
} as unknown as Doc;
const GHOST = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2, ghost: true }, content: [{ type: "text", text: "目的" }] },
    {
      type: "paragraph",
      attrs: { ghost: true },
      content: [{ type: "text", text: "このチケットで何を実現したいかを書きます" }],
    },
    { type: "heading", attrs: { level: 2, ghost: true }, content: [{ type: "text", text: "完了の条件" }] },
    { type: "paragraph", attrs: { ghost: true }, content: [{ type: "text", text: "どうなれば終わりかを書きます" }] },
  ],
} as unknown as Doc;
const PLAIN = { type: "doc", content: [p("先月の請求書の見本を見て書式をそろえる。")] } as unknown as Doc;
const t = (text: string, marks: unknown[]) => ({ type: "text", text, marks });
/** 読む形の足した節と印の確かめ（K577-UI-007・008） */
const RICH = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 4, textAlign: "center" }, content: [{ type: "text", text: "小さい見出し" }] },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        { type: "listItem", content: [p("三つ目")] },
        { type: "listItem", content: [p("四つ目")] },
      ],
    },
    { type: "orderedList", content: [{ type: "listItem", content: [p("一つ目")] }] },
    { type: "horizontalRule" },
    { type: "paragraph", attrs: { textAlign: "right" }, content: [{ type: "text", text: "右寄せの段落" }] },
    { type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "両端そろえの段落" }] },
    {
      type: "paragraph",
      content: [
        t("下線", [{ type: "underline" }]),
        t("取り消し線", [{ type: "strike" }]),
        t("x = 1", [{ type: "code" }]),
        t("2", [{ type: "superscript" }]),
        t("i", [{ type: "subscript" }]),
        t("青緑", [{ type: "color", attrs: { color: "teal" } }]),
        t("赤い字", [{ type: "color", attrs: { color: "#dc2626" } }]),
        t("黄の背景", [{ type: "highlight", attrs: { color: "#fde68a" } }]),
        t("前の黄", [{ type: "highlight" }]),
      ],
    },
    {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2 }, content: [p("項目")] }] },
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [p("運用")] },
            { type: "tableCell", attrs: { rowspan: 2 }, content: [p("保守")] },
          ],
        },
        { type: "tableRow", content: [{ type: "tableHeader", content: [p("点検")] }] },
      ],
    },
    { type: "paragraph", attrs: { ghost: true }, content: [{ type: "text", text: "薄い段落" }] },
  ],
} as unknown as Doc;
/** 形に合わない値を持つ文書（サーバーに前から入っていた物でも守る・K577-UI-009） */
const BADCOLOR = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        t("rgb の色", [{ type: "color", attrs: { color: "rgb(255,0,0)" } }]),
        t("大文字の色", [{ type: "color", attrs: { color: "#FF0000" } }]),
        t("三桁の色", [{ type: "color", attrs: { color: "#f00" } }]),
        t("名前の色", [{ type: "color", attrs: { color: "pink" } }]),
        t("url の背景", [{ type: "highlight", attrs: { color: "url(javascript:alert(1))" } }]),
      ],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left;background:url(x)" },
      content: [{ type: "text", text: "不正な寄せ" }],
    },
    { type: "orderedList", attrs: { start: 2.5 }, content: [{ type: "listItem", content: [p("不正な始まり")] }] },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", attrs: { colspan: 1.5 }, content: [p("不正な横結合")] },
            { type: "tableCell", attrs: { rowspan: "2" }, content: [p("不正な縦結合")] },
          ],
        },
      ],
    },
  ],
} as unknown as Doc;
type Raw = { marks?: { type: string; attrs?: { color?: unknown } }[]; content?: Raw[] };
const isHexMark = (m: { attrs?: { color?: unknown } }) =>
  typeof m.attrs?.color === "string" && m.attrs.color.startsWith("#");
/** #rrggbb の色の印だけを外す（節と、ほかの印はそのまま） */
const dropHex = (n: Raw): Raw => ({
  ...n,
  ...(n.marks ? { marks: n.marks.filter((m) => !isHexMark(m)) } : {}),
  ...(n.content ? { content: n.content.map(dropHex) } : {}),
});
/** 全部の節を持ち #rrggbb の色を持たない文書（読む形が編集の部品を読まない道・K577-UI-001・003〜006） */
const CALM = dropHex(FULL as unknown as Raw) as unknown as Doc;
/** #rrggbb の色とチェックの箱・画像の置き場を持つ文書（読むだけの編集の部品が描く道・K577-UI-011） */
const COLORTASK = {
  type: "doc",
  content: [
    { type: "paragraph", content: [t("色つきの字", [{ type: "color", attrs: { color: "#dc2626" } }])] },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [p("送った")] },
        { type: "taskItem", attrs: { checked: false }, content: [p("控える")] },
      ],
    },
    { type: "image", attrs: { caption: "色のある文書の画像.png", attachment_id: null } },
  ],
} as unknown as Doc;
/** 正しい #rrggbb の色 1 つと、形に合わない値・危ない href を持つ文書（K577-UI-012） */
const COLORBAD = {
  type: "doc",
  content: [
    { type: "paragraph", content: [t("正しい赤", [{ type: "color", attrs: { color: "#dc2626" } }])] },
    { type: "paragraph", content: [t("rgb の色", [{ type: "color", attrs: { color: "rgb(255,0,0)" } }])] },
    { type: "paragraph", content: [t("大文字の色", [{ type: "color", attrs: { color: "#FF0000" } }])] },
    { type: "paragraph", content: [t("三桁の色", [{ type: "color", attrs: { color: "#f00" } }])] },
    { type: "paragraph", content: [t("名前の色", [{ type: "color", attrs: { color: "pink" } }])] },
    {
      type: "paragraph",
      content: [t("url の背景", [{ type: "highlight", attrs: { color: "url(javascript:alert(1))" } }])],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left;background:url(x)" },
      content: [{ type: "text", text: "不正な寄せ" }],
    },
    {
      type: "paragraph",
      content: [t("悪いリンク", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])],
    },
    { type: "orderedList", attrs: { start: 2.5 }, content: [{ type: "listItem", content: [p("不正な始まり")] }] },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", attrs: { colspan: 1.5 }, content: [p("不正な横結合")] },
            { type: "tableCell", attrs: { rowspan: "2" }, content: [p("不正な縦結合")] },
          ],
        },
      ],
    },
  ],
} as unknown as Doc;
/** 危ない href を持つ文書（K577-UI-005） */
const DANGER = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [t("悪いリンク", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])],
    },
  ],
} as unknown as Doc;
/** 広い表と長い字の文書（K577-UI-006） */
const WIDE = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [0, 1, 2].map((r) => ({
        type: "tableRow",
        content: Array.from({ length: 8 }, (_, c) => ({
          type: r === 0 ? "tableHeader" : "tableCell",
          content: [p(r === 0 ? `見出しの列 ${c + 1}` : `とても長いセルの中身 ${r}-${c + 1}`)],
        })),
      })),
    },
    p("あ".repeat(400)),
  ],
} as unknown as Doc;
const START: Record<string, () => Doc> = {
  empty: emptyDoc,
  plain: () => PLAIN,
  full: () => FULL,
  calm: () => CALM,
  ghost: () => GHOST,
  rich: () => RICH,
  badcolor: () => BADCOLOR,
  colortask: () => COLORTASK,
  colorbad: () => COLORBAD,
};

function Out({ doc }: { doc: Doc }) {
  const v = validateDoc(doc);
  return (
    <section className="k-f4d-devout" aria-label="部品の出す文書">
      <pre data-testid="doc-json">{JSON.stringify(doc)}</pre>
      <pre data-testid="doc-text">{docToText(doc)}</pre>
      <p data-testid="doc-verdict">{v.ok ? "ok" : `ng:${v.reason}`}</p>
    </section>
  );
}

export function LiveView({ id, theme }: { id: string; theme: Theme }) {
  return isLivePage(id) ? <Live id={id} theme={theme} /> : <p>この状態はまだありません</p>;
}

/** 読む形と編集の切り替え・読む形の取り扱い・文書の差し替え（開発用の字・本番には出ない） */
function Switches({
  onMode,
  onToggleable,
  onDoc,
  log,
}: {
  onMode: (read: boolean) => void;
  onToggleable: () => void;
  onDoc: (d: Doc) => void;
  log: readonly [number, boolean][];
}) {
  return (
    <section className="k-f4d-devout" aria-label="開発用の切り替え">
      <button type="button" onClick={() => onMode(false)}>
        編集に切り替える
      </button>
      <button type="button" onClick={() => onMode(true)}>
        読む形に切り替える
      </button>
      <button type="button" onClick={onToggleable}>
        箱を押せる読む形にする
      </button>
      <button type="button" onClick={() => onDoc(DANGER)}>
        危ない href の文書にする
      </button>
      <button type="button" onClick={() => onDoc(WIDE)}>
        広い表と長い字の文書にする
      </button>
      <pre data-testid="task-log">{JSON.stringify(log)}</pre>
    </section>
  );
}

function Live({ id, theme }: { id: LivePage; theme: Theme }) {
  const params = useSearchParams();
  const [doc, setDoc] = useState<Doc>(() => (START[params.get("doc") ?? "empty"] ?? emptyDoc)());
  const [read, setRead] = useState(params.get("mode") === "read");
  const [toggleable, setToggleable] = useState(false);
  const [log, setLog] = useState<readonly [number, boolean][]>([]);
  const view = (
    <div data-testid="doc-read">
      <DocView
        doc={doc}
        {...(toggleable ? { onToggleTask: (i: number, c: boolean) => setLog((l) => [...l, [i, c]]) } : {})}
      />
    </div>
  );
  return (
    <Frame theme={theme} crumbs={CRUMBS}>
      <div className="k-root" data-live={id}>
        <CreateForm
          titleValue="セイコー商事の 11 月分の請求書を送る"
          body="free"
          specs={SPEC_LINES}
          head={<CreateHeadFull saved="下書きを自動で保存しました（10:42）" />}
          editor={read ? view : <DocEditor doc={doc} onChange={setDoc} />}
        />
        <Out doc={doc} />
        <Switches onMode={setRead} onToggleable={() => setToggleable(true)} onDoc={setDoc} log={log} />
      </div>
    </Frame>
  );
}
