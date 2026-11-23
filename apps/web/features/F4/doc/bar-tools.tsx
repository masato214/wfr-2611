// 本文の道具の帯の道具の並びと名前（下絵 DocBar と本物の帯 editor/doc-bar-live.tsx が同じ物を読む・1 か所）。
//   出来合いの編集の部品（Tiptap の UI の部品）が持つ道具を絞らずに並べる（代表 2026-11-22）。並びは Simple Editor のひな形を土台に、名前は日本語。
//   pop の付く道具は押すと開く物：メニュー（見出し・並び・表）か小さな画面（文字の色・背景の色）。画像は押せない形（ファイルを付ける仕組みが入るまで）
import type { ReactNode } from "react";

export interface BarTool {
  name: string;
  label: ReactNode;
  /** 押すと開く物：メニュー（見出し・並び・表）か小さな画面（色） */
  pop?: "menu" | "dialog";
  off?: boolean;
}
export const BAR_GROUPS: readonly (readonly BarTool[])[] = [
  [
    { name: "戻す", label: "戻す" },
    { name: "やり直す", label: "やり直す" },
  ],
  [
    { name: "見出し", label: "見出し", pop: "menu" },
    { name: "並び", label: "並び", pop: "menu" },
    { name: "引用", label: "引用" },
    { name: "コードの囲み", label: "{ }" },
  ],
  [
    { name: "太字", label: <b>B</b> },
    { name: "斜体", label: <i>I</i> },
    { name: "下線", label: <u>U</u> },
    { name: "取り消し線", label: <s>S</s> },
    { name: "行の中のコード", label: "</>" },
  ],
  [
    {
      name: "文字の色",
      label: (
        <span>
          A<span className="k-f4d-swatch" aria-hidden="true" />
        </span>
      ),
      pop: "dialog",
    },
    { name: "背景の色", label: <span className="k-f4d-bgmark">背景</span>, pop: "dialog" },
    { name: "リンク", label: "リンク" },
  ],
  [
    { name: "上付き", label: "x²" },
    { name: "下付き", label: "x₂" },
  ],
  [
    { name: "左寄せ", label: "左" },
    { name: "中央", label: "中央" },
    { name: "右寄せ", label: "右" },
    { name: "両端", label: "両端" },
  ],
  [
    { name: "表", label: "表", pop: "menu" },
    { name: "区切りの線", label: "―" },
    { name: "画像", label: "画像", off: true },
  ],
];
export const TOOL_NAMES: readonly string[] = BAR_GROUPS.flat().map((t) => t.name);
