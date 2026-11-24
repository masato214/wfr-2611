// 貼り付け HTML の掃除（K-567・Tiptap の transformPastedHTML）。貼った HTML を字の並びとして読み、許した要素と属性だけの HTML を書き直して返す。
//   中身ごと消す：script・style・iframe・object・embed・form・input・select・textarea（ほかに button・noscript・template・svg・math・title など）
//   許す要素の表に無い要素は、字だけ残して外す。属性は全部落とし、a の href（許されたものだけ）と ol の start だけ残す（style＝貼った物の色も入らない）。
//   見出しは h1→h2・h2→h3・h3〜h6→h4 に付け替える（K-568 の Markdown の写し方と同じ）。
//   ブラウザの DOM に頼らず字の並びで読む（返す HTML は許した物だけで組み直すので、壊れた HTML でも許していない要素・属性は出ない。
//   読み込み前の試験〔Node〕でも同じ物が動く）。字（要素の外の文）はそのまま写す（< は &lt; にする）
import { normalizeHref } from "./link-policy";

/** 中身ごと消す要素（開きから閉じまでを読み飛ばす） */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "select",
  "textarea",
  "button",
  "noscript",
  "template",
  "svg",
  "math",
  "title",
  "head",
  "link",
  "meta",
  "frame",
  "frameset",
  "xmp",
]);
/** 中の字を HTML として読まない要素（閉じの字まで読み飛ばす） */
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "noscript", "iframe", "template"]);
/** 閉じを持たない要素 */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
  "frame",
]);
const KEEP = new Set([
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "sup",
  "sub",
  "mark",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "pre",
  "code",
  "a",
]);
const HEADING_TO: Record<string, string> = { h1: "h2", h2: "h3", h3: "h4", h4: "h4", h5: "h4", h6: "h4" };
const START_RE = /^[1-9][0-9]{0,3}$/;
const TAG_RE = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/;
const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const escAttr = (v: string): string => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** 属性の値の文字参照を戻す（&#x61; などで隠した javascript: を見落とさない） */
function decode(v: string): string {
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#([0-9]+);?/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&(tab|newline);/gi, "\t")
    .replace(/&colon;/gi, ":")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}
const safeChar = (n: number): string => (Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

function attrsOf(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = (m[1] ?? "").toLowerCase();
    if (!name || out.has(name)) continue;
    out.set(name, decode(m[2] ?? m[3] ?? m[4] ?? ""));
  }
  return out;
}

/** 残す要素の開きの字（a の href と ol の start だけ） */
function openTag(tag: string, raw: string): string {
  const a = attrsOf(raw);
  if (tag === "a") {
    const href = normalizeHref(a.get("href") ?? "");
    return href ? `<a href="${escAttr(href)}">` : "<a>";
  }
  if (tag === "ol") {
    const start = (a.get("start") ?? "").trim();
    return START_RE.test(start) ? `<ol start="${start}">` : "<ol>";
  }
  return `<${tag}>`;
}

/** 貼った HTML を、許した要素と属性だけの HTML にする */
export function sanitizePastedHtml(html: string): string {
  let out = "";
  const open: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    i = lt;
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      const end = html.indexOf(">", i);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    const m = TAG_RE.exec(html.slice(i));
    if (!m) {
      out += "&lt;";
      i += 1;
      continue;
    }
    i += m[0].length;
    const closing = m[1] === "/";
    const name = (m[2] ?? "").toLowerCase();
    const raw = m[3] ?? "";
    if (DROP_WITH_CONTENT.has(name)) {
      if (closing || VOID.has(name) || /\/\s*$/.test(raw)) continue;
      i = skipElement(html, i, name);
      continue;
    }
    const tag = HEADING_TO[name] ?? name;
    if (!KEEP.has(tag)) continue; // 字だけ残して外す（開きと閉じの字を書かない）
    if (closing) {
      const at = open.lastIndexOf(tag);
      if (at < 0) continue;
      while (open.length > at) out += `</${open.pop()}>`;
      continue;
    }
    if (VOID.has(tag)) {
      out += `<${tag}>`;
      continue;
    }
    out += openTag(tag, raw);
    open.push(tag);
  }
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

/** 中身ごと消す要素の閉じの後ろの位置。入れ子（同じ名前の開き）を数える。閉じが無ければ終わりまで */
function skipElement(html: string, from: number, name: string): number {
  if (RAW_TEXT.has(name)) {
    const close = new RegExp(`</${name}(?=[\\s/>])[^>]*>`, "gi");
    close.lastIndex = from;
    const m = close.exec(html);
    return m ? m.index + m[0].length : html.length;
  }
  let depth = 1;
  const re = new RegExp(`<(/?)${name}(?=[\\s/>])[^>]*>`, "gi");
  re.lastIndex = from;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}
