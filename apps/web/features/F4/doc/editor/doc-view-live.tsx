"use client";
// 色のある文書の読むだけの形の本体（K-577・Tiptap・editable: false）。doc-view-color.tsx が要るときだけ遅く読む。
//   利用者が選んだ #rrggbb の色は、編集の部品が自分で付ける（JSX の style 属性・style の要素は使わない・PM の決め 2026-11-23）。
//   渡す前に K-567 の fromEditorJson で値の守りを通す（形に合わない色・寄せ・colspan・rowspan・start・許されない href を落とす）。colwidth は読む形では使わない。
//   前の 3 つの名前の色は span[data-c]（正本のトークン）。画像の置き場は DocView と同じ形（枠は role="img"・名前＝caption）。
//   チェックの箱：onToggleTask が無ければ押せない（disabled）。在れば onToggleTask(位置, 押した後の真偽) を呼び、表示は渡された doc のまま戻す。
//   書き換えられない（入力欄の役を付けない）。口は呼ばない
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Mark, type AnyExtension, type Node as TiptapNode } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";
import { DOC_COLORS, type Doc } from "@kaname/contracts";
import { buildExtensions } from "./extensions";
import { fromEditorJson, toEditorContent } from "./convert";
import "../doc.css";
import "../extra.css";
import "./editor.css";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNamed = (c: unknown): c is string => typeof c === "string" && (DOC_COLORS as readonly string[]).includes(c);

/** 前の 3 つの名前の色の印（span[data-c]・見た目は doc.css のトークン） */
const NamedColor = Mark.create({
  name: "kNamedColor",
  addAttributes() {
    return {
      c: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-c"),
        renderHTML: (attrs: Json) => (isNamed(attrs["c"]) ? { "data-c": attrs["c"] } : {}),
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-c]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", HTMLAttributes, 0],
});

/** 編集の部品の JSON を読む形に合わせる：名前の色は kNamedColor に・セルの colwidth は外す */
function forView(n: Json): Json {
  const out: Json = { ...n };
  if (isObj(n["attrs"]) && "colwidth" in n["attrs"])
    out["attrs"] = Object.fromEntries(Object.entries(n["attrs"]).filter(([k]) => k !== "colwidth"));
  if (Array.isArray(n["marks"]))
    out["marks"] = (n["marks"] as Json[]).map((m) => {
      const color = isObj(m["attrs"]) ? m["attrs"]["color"] : undefined;
      return m["type"] === "textStyle" && isNamed(color) ? { type: "kNamedColor", attrs: { c: color } } : m;
    });
  if (Array.isArray(n["content"])) out["content"] = (n["content"] as Json[]).map(forView);
  return out;
}
/** 文書の木 → 読むだけの編集の部品に渡す中身（値の守りを通した物） */
export const viewContent = (doc: Doc): Json => forView(toEditorContent(fromEditorJson(doc)));

type OnChecked = (node: PmNode, checked: boolean) => boolean;
function viewExtensions(onChecked: OnChecked): AnyExtension[] {
  const base = buildExtensions().map((e) => {
    if (e.name === "taskItem")
      return e.configure({
        onReadOnlyChecked: onChecked,
        a11y: { checkboxLabel: (node: PmNode) => node.textContent.trim() },
      });
    if (e.name === "image")
      return (e as TiptapNode).extend({
        renderHTML({ node }) {
          const caption = String(node.attrs["caption"] ?? "");
          return [
            "figure",
            { class: "k-f4d-img" },
            ["div", { class: "k-f4d-img-box", role: "img", "aria-label": caption }, "画像"],
            ["figcaption", {}, caption],
          ];
        },
      });
    return e;
  });
  return [...base, NamedColor];
}

export interface DocViewLiveProps {
  doc: Doc;
  onToggleTask?: (index: number, checked: boolean) => void;
  ariaLabel: string;
  /** 編集の部品が出来るまで出す、色を付けない読む形 */
  fallback: ReactNode;
}

export default function DocViewLive({ doc, onToggleTask, ariaLabel, fallback }: DocViewLiveProps) {
  const toggleRef = useRef(onToggleTask);
  toggleRef.current = onToggleTask;
  const editorRef = useRef<Editor | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const extensions = useMemo(
    () =>
      viewExtensions((node, checked) => {
        const ed = editorRef.current;
        const toggle = toggleRef.current;
        if (!ed || !toggle) return false;
        // 文書の中の taskItem の出てくる順の位置（0 から・入れ子も数える）
        let at = -1;
        let i = 0;
        ed.state.doc.descendants((n) => {
          if (n.type.name !== "taskItem") return true;
          if (n === node) at = i;
          i += 1;
          return true;
        });
        // 表示は渡された doc のまま（偽を返すと箱は元に戻る）
        if (at >= 0) toggle(at, checked);
        return false;
      }),
    [],
  );
  const key = JSON.stringify(doc);
  const shown = useRef(key);
  const editor = useEditor({
    extensions,
    content: viewContent(doc),
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { role: "group", "aria-label": ariaLabel, class: "k-f4d-pm" } },
  });
  editorRef.current = editor;
  const canToggle = onToggleTask !== undefined;

  useEffect(() => {
    if (!editor) return;
    if (shown.current !== key) {
      shown.current = key;
      editor.commands.setContent(viewContent(doc), { emitUpdate: false });
    }
    // 取り扱いが無ければ箱は押せない（編集の部品は disabled を付けないので、ここで付け外しする）
    for (const box of rootRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])
      box.disabled = !canToggle;
  }, [editor, key, doc, canToggle]);

  if (!editor) return <>{fallback}</>;
  return (
    <div ref={rootRef} className="k-f4d-doc k-f4d-read">
      <EditorContent editor={editor} />
    </div>
  );
}
