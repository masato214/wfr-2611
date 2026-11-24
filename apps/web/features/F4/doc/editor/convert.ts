// 文書の木（K-561 を K-584 が広げた Doc）⇔ 編集の部品（Tiptap）の JSON の変換（K-567）。編集の部品の型は見ない（字の並びの JSON だけ）。
//   toEditorContent：Doc → 編集の部品の JSON（文字の色の印 color は編集の部品の textStyle の色に）
//   fromEditorJson：編集の部品の JSON → Doc。編集の部品が持つ余りの鍵と既定の値（セルの colspan・rowspan の 1・colwidth の null／コードの language／
//     リンクの target・rel・class／null の ghost・textAlign／番号つきの type と start の 1／ハイライトの null の色／textStyle の色以外）を必ず落とす。
//     色は値の形を守る（文字の色：#rrggbb か旧い名前 red・teal・amber／背景の色：#rrggbb。通らない値の印は印ごと落とし、字は残す）。
//     印は決めた順に並べる。空の段落 1 つだけの本文は content が空。通らない形は投げずに、直せる所まで直して返す
import {
  DOC_ALIGNS,
  DOC_COLORS,
  DOC_COLSPAN_MAX,
  DOC_COLWIDTH_MAX,
  DOC_HEADING_LEVELS,
  DOC_HEX_COLOR,
  DOC_START_MAX,
  type Doc,
} from "@kaname/contracts";
import { normalizeHref } from "./link-policy";

type Json = Record<string, unknown>;
type Node = { type: string; attrs?: Json; content?: Node[]; text?: string; marks?: Mark[] };
type Mark = { type: string; attrs?: Json };

/** 印の並び（文書に書く順） */
export const MARK_ORDER = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "superscript",
  "subscript",
  "color",
  "highlight",
  "link",
] as const;
const SIMPLE_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "superscript", "subscript"]);
const BLOCKS_WITH_KIDS = new Set([
  "doc",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "blockquote",
]);
const INLINE_HOLDERS = new Set(["paragraph", "heading"]);
const NUL = String.fromCharCode(0);

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

// ---------------------------------------------------------------- Doc → 編集の部品の JSON
function toEditorMark(m: Mark): Mark {
  if (m.type === "color") return { type: "textStyle", attrs: { color: m.attrs?.["color"] } };
  return m.attrs ? { type: m.type, attrs: { ...m.attrs } } : { type: m.type };
}
function toEditorNode(n: Node): Node {
  const out: Node = { type: n.type };
  if (n.attrs) out.attrs = { ...n.attrs };
  if (typeof n.text === "string") out.text = n.text;
  if (n.marks) out.marks = n.marks.map(toEditorMark);
  if (n.content) out.content = n.content.map(toEditorNode);
  return out;
}
/** Doc → 編集の部品が読む JSON */
export function toEditorContent(doc: Doc): Json {
  return toEditorNode(doc as unknown as Node) as unknown as Json;
}

// ---------------------------------------------------------------- 編集の部品の JSON → Doc
const textColorOk = (c: unknown): c is string =>
  typeof c === "string" && ((DOC_COLORS as readonly string[]).includes(c) || DOC_HEX_COLOR.test(c));
const bgColorOk = (c: unknown): c is string => typeof c === "string" && DOC_HEX_COLOR.test(c);

function fromMark(m: unknown): Mark | null {
  if (!isObj(m) || typeof m["type"] !== "string") return null;
  const type = m["type"];
  const a = isObj(m["attrs"]) ? m["attrs"] : {};
  if (SIMPLE_MARKS.has(type)) return { type };
  if (type === "textStyle" || type === "color")
    return textColorOk(a["color"]) ? { type: "color", attrs: { color: a["color"] } } : null;
  if (type === "highlight") {
    const c = a["color"];
    if (c === undefined || c === null) return { type: "highlight" };
    return bgColorOk(c) ? { type: "highlight", attrs: { color: c } } : null;
  }
  if (type === "link") {
    const href = typeof a["href"] === "string" ? normalizeHref(a["href"]) : null;
    return href ? { type: "link", attrs: { href } } : null;
  }
  return null;
}
function fromMarks(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return [];
  const byType = new Map<string, Mark>();
  for (const m of raw) {
    const x = fromMark(m);
    if (x && !byType.has(x.type)) byType.set(x.type, x);
  }
  return MARK_ORDER.flatMap((t) => (byType.has(t) ? [byType.get(t)!] : []));
}

function fromInline(raw: unknown[], plain = false): Node[] {
  const out: Node[] = [];
  for (const c of raw) {
    if (!isObj(c)) continue;
    if (c["type"] === "hardBreak" && !plain) {
      out.push({ type: "hardBreak" });
      continue;
    }
    if (c["type"] !== "text" || typeof c["text"] !== "string" || c["text"] === "") continue;
    const text = c["text"].split(NUL).join("");
    if (text === "") continue;
    const marks = plain ? [] : fromMarks(c["marks"]);
    out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
  }
  return out;
}

function blockAttrs(type: string, a: Json): Json | undefined {
  const out: Json = {};
  const align = (DOC_ALIGNS as readonly unknown[]).includes(a["textAlign"]) ? a["textAlign"] : undefined;
  switch (type) {
    case "heading": {
      const lv = Number(a["level"]);
      out["level"] = (DOC_HEADING_LEVELS as readonly number[]).includes(lv) ? lv : lv < 2 ? 2 : 4;
      if (a["ghost"] === true) out["ghost"] = true;
      if (align) out["textAlign"] = align;
      return out;
    }
    case "paragraph":
      if (a["ghost"] === true) out["ghost"] = true;
      if (align) out["textAlign"] = align;
      break;
    case "orderedList":
      if (isInt(a["start"], 2, DOC_START_MAX)) out["start"] = a["start"];
      break;
    case "tableCell":
    case "tableHeader": {
      const colspan = isInt(a["colspan"], 1, DOC_COLSPAN_MAX) ? a["colspan"] : 1;
      const rowspan = isInt(a["rowspan"], 1, DOC_COLSPAN_MAX) ? a["rowspan"] : 1;
      if (colspan > 1) out["colspan"] = colspan;
      if (rowspan > 1) out["rowspan"] = rowspan;
      const w = a["colwidth"];
      if (Array.isArray(w) && w.length === colspan && w.every((x) => isInt(x, 1, DOC_COLWIDTH_MAX)))
        out["colwidth"] = [...w];
      break;
    }
    case "taskItem":
      return { checked: a["checked"] === true };
    case "image":
      return {
        caption: typeof a["caption"] === "string" ? a["caption"] : "",
        attachment_id: typeof a["attachment_id"] === "string" ? a["attachment_id"] : null,
      };
  }
  return Object.keys(out).length ? out : undefined;
}

function fromBlock(raw: unknown): Node | null {
  if (!isObj(raw) || typeof raw["type"] !== "string") return null;
  const type = raw["type"];
  const attrs = blockAttrs(type, isObj(raw["attrs"]) ? raw["attrs"] : {});
  const content = Array.isArray(raw["content"]) ? (raw["content"] as unknown[]) : [];
  const withAttrs = (n: Node): Node => (attrs ? { ...n, attrs } : n);
  if (INLINE_HOLDERS.has(type)) {
    const kids = fromInline(content);
    return withAttrs(kids.length ? { type, content: kids } : { type });
  }
  if (type === "codeBlock") {
    const kids = fromInline(content, true);
    return kids.length ? { type, content: kids } : { type };
  }
  if (type === "horizontalRule") return { type };
  if (type === "image") return withAttrs({ type });
  if (BLOCKS_WITH_KIDS.has(type)) {
    const kids = content.map(fromBlock).filter((n): n is Node => n !== null);
    return withAttrs({ type, content: kids });
  }
  return null;
}

/** 編集の部品の JSON → 文書の木（K-561 の形） */
export function fromEditorJson(json: unknown): Doc {
  const root = isObj(json) ? json : {};
  const raw = Array.isArray(root["content"]) ? (root["content"] as unknown[]) : [];
  const content = raw.map(fromBlock).filter((n): n is Node => n !== null && n.type !== "doc");
  const only = content[0];
  const empty = content.length === 1 && only?.type === "paragraph" && !only.content && !only.attrs;
  return { type: "doc", content: empty ? [] : content } as unknown as Doc;
}
