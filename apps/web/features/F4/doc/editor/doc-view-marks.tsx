// 本文の読む形（K-577）の印と行の中の描き。編集の部品（Tiptap・ProseMirror）を読まない。
//   印：bold＝b・italic＝i・underline＝u・strike＝s・code＝code・superscript＝sup・subscript＝sub・
//     文字の色＝前の 3 つの名前は span[data-c]（正本のトークン）・背景の色＝属性の無い物は mark・
//     link＝許された href（link-policy）のときだけ a（target _blank・rel noopener noreferrer）。許されない href・形に合わない色は印を付けずに字だけ出す。
//   利用者が選んだ #rrggbb の色は、ここでは付けない（字だけ出す）。style 属性でも style の要素でも当てない決め（PM 2026-11-23・class_gate・D8）。
//     #rrggbb の色を持つ文書は、DocView が読むだけの編集の部品（doc-view-color → doc-view-live）へ渡し、色はその部品が付ける。ここの描きは読み込みの間の形
import type { ReactNode } from "react";
import { DOC_COLORS, DOC_HEX_COLOR } from "@kaname/contracts";
import { isAllowedHref } from "./link-policy";

export type ViewMark = { type: string; attrs?: Record<string, unknown> };
export type ViewInline = { type: string; text?: string; marks?: ViewMark[] };

/** 文字の色の前の名前（正本のトークンで描く） */
const isNamed = (c: unknown): c is string => typeof c === "string" && (DOC_COLORS as readonly string[]).includes(c);
/** 決まった形の #rrggbb だけ（大文字・3 桁・rgb()・名前・url()・空は通さない） */
export const isHex = (c: unknown): c is string => typeof c === "string" && DOC_HEX_COLOR.test(c);

const SIMPLE: Record<string, (k: string, c: ReactNode) => ReactNode> = {
  bold: (k, c) => <b key={k}>{c}</b>,
  italic: (k, c) => <i key={k}>{c}</i>,
  underline: (k, c) => <u key={k}>{c}</u>,
  strike: (k, c) => <s key={k}>{c}</s>,
  code: (k, c) => <code key={k}>{c}</code>,
  superscript: (k, c) => <sup key={k}>{c}</sup>,
  subscript: (k, c) => <sub key={k}>{c}</sub>,
};

function wrap(m: ViewMark, k: string, c: ReactNode): ReactNode {
  const simple = SIMPLE[m.type];
  if (simple) return simple(k, c);
  const color = m.attrs?.["color"];
  if (m.type === "color") {
    if (isNamed(color))
      return (
        <span key={k} data-c={color}>
          {c}
        </span>
      );
    return c;
  }
  if (m.type === "highlight") {
    if (color === undefined) return <mark key={k}>{c}</mark>;
    return c;
  }
  if (m.type === "link") {
    const href = m.attrs?.["href"];
    if (typeof href === "string" && isAllowedHref(href))
      return (
        <a key={k} href={href.trim()} target="_blank" rel="noopener noreferrer">
          {c}
        </a>
      );
    return c;
  }
  return c;
}

/** 行の中の節（字と改行）を描く。印のある字は、外れた印しか無くても span で包む（字を 1 つの要素にまとめる） */
export function renderInline(nodes: readonly ViewInline[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const k = `${key}.${i}`;
    if (n.type === "hardBreak") return <br key={k} />;
    const text = typeof n.text === "string" ? n.text : "";
    const marks = n.marks ?? [];
    if (!marks.length) return text;
    const inner = marks.reduceRight<ReactNode>((c, m, j) => wrap(m, `${k}m${j}`, c), text);
    return <span key={k}>{inner}</span>;
  });
}

/** 文書に、形を確かめた #rrggbb の色（文字の色か背景）の印が 1 つでも在るか */
export function hasHexColor(node: unknown): boolean {
  const n = node as { content?: unknown[]; marks?: ViewMark[] } | null;
  if ((n?.marks ?? []).some((m) => (m.type === "color" || m.type === "highlight") && isHex(m.attrs?.["color"])))
    return true;
  return (n?.content ?? []).some(hasHexColor);
}
