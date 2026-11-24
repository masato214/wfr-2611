// 編集の部品（Tiptap）に組む節と印（K-567）。K-561（K-584 が広げた形）の節・節の attr・印だけを組み、知らない節・印は作れない。
//   節の中身は K-584 の validateDoc の置ける親と同じに絞る（引用・表のセル・チェックの項目は段落だけ・並びの項目は段落と並びだけ）。
//   これで帯・キーボード・貼り付けのどの入口からも validateDoc が断る木を作れない（置けない場所では can() が偽になり、貼った物は置ける形に合わせられる）。
//   「/」「#」「@」・注意の枠・文字の大きさ・書体・メンション・絵文字などは組まない（D-150.48）。表・色・寄せ・画像は読み込みと書き出しのために組む（道具は K-587・K-568）
import { Extension, Node, mergeAttributes, type AnyExtension } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableCell, TableHeader, TableKit } from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { DOC_ALIGNS } from "@kaname/contracts";
import { isAllowedHref } from "./link-policy";

const PARAS = "paragraph+";

/** 薄い字（ひな形・ghost）の attr。真のときだけ data-ghost="true" と薄い見た目の class を描く */
const Ghost = Extension.create({
  name: "kGhost",
  addGlobalAttributes() {
    const ghost = (cls: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => (el.getAttribute("data-ghost") === "true" ? true : null),
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs["ghost"] === true ? { "data-ghost": "true", class: cls } : {},
    });
    return [
      { types: ["paragraph"], attributes: { ghost: ghost("k-f4d-ghost") } },
      { types: ["heading"], attributes: { ghost: ghost("k-f4d-ghost-h") } },
    ];
  },
});

/** 引用：中は段落だけ（K-584） */
const Blockquote = Node.create({
  name: "blockquote",
  group: "block",
  content: PARAS,
  defining: true,
  parseHTML: () => [{ tag: "blockquote" }],
  renderHTML: ({ HTMLAttributes }) => ["blockquote", mergeAttributes(HTMLAttributes), 0],
});

/** 並びの項目：中は段落と並びだけ（K-584。項目の中に段落が 2 つ・入れ子の並びで始まる木も開ける） */
const ListItem = Node.create({
  name: "listItem",
  content: "(paragraph | bulletList | orderedList | taskList)+",
  defining: true,
  parseHTML: () => [{ tag: "li", priority: 40 }],
  renderHTML: ({ HTMLAttributes }) => ["li", mergeAttributes(HTMLAttributes), 0],
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };
  },
});

/** 画像の置き場（attrs は caption と attachment_id だけ・編集はしない。添付の段で中身が入る） */
const ImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      caption: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-caption") ?? "",
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-caption": String(attrs["caption"] ?? "") }),
      },
      attachment_id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs["attachment_id"] ? { "data-attachment-id": String(attrs["attachment_id"]) } : {},
      },
    };
  },
  parseHTML: () => [{ tag: "figure[data-k-image]" }],
  renderHTML: ({ node, HTMLAttributes }) => [
    "figure",
    mergeAttributes(HTMLAttributes, { "data-k-image": "", class: "k-f4d-figure" }),
    ["figcaption", {}, String(node.attrs["caption"] ?? "")],
  ],
});

/** 組む拡張の全部（毎回新しく作る） */
export function buildExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      blockquote: false,
      listItem: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        isAllowedUri: (url) => isAllowedHref(url),
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    Blockquote,
    ListItem,
    Ghost,
    TaskList,
    TaskItem.extend({ content: PARAS }).configure({ nested: false }),
    TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
    TableCell.extend({ content: PARAS }),
    TableHeader.extend({ content: PARAS }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: [...DOC_ALIGNS] }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Superscript,
    Subscript,
    ImageNode,
  ];
}
