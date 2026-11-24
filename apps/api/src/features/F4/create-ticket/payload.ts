// チケットを作る（K-437）の本文・会社の項目・確認項目の入口の確かめ。外れは番号なしの 422（欄つき）。
//   本文 body：{ doc } だけ（text・知らない鍵は 422・欄 body.<鍵>）。doc の中身は @kaname/contracts の validateDoc（K-561・K-584）。text は口が doc から作る（toTicketBody）
//   会社の項目 fields：鍵が項目の id（uuid）・値が文字・数・真偽・文字の並び・null のどれか。型ごとの確かめ（選択肢・日付・必須・種別）は DB の app.ticket_fields_set（K-564）が持つ
//   確認項目 specs：文字の並び（0〜50 件）。文の長さと空白だけかは DB の app.test_spec_title_check（K-434）が持つ
//   つなぐ相手 links（K-581）：[{ kind: related|derived_from, other_ticket_id: uuid }]（0〜20 件・同じ組なし・知らない鍵なし）。相手が見えるか・書けるかは DB の app.ticket_link_add（K-441）が持つ
//   本文と確認項目の文は、入口が揃えた体（NFKC・前後の空白を落とした物）でなく画面が送ったままを受ける（hooks.ts が渡す）
import { isUuid, toTicketBody, validateDoc, type Doc } from "@kaname/contracts";
import type { Detail } from "./input.js";

export const SPECS_MAX = 50;
export const LINKS_MAX = 20;
export const LINK_KINDS = ["related", "derived_from"] as const;
export interface LinkInput {
  kind: (typeof LINK_KINDS)[number];
  other_ticket_id: string;
}

/** 中身の無い本文（本文を送らなかったとき） */
export const EMPTY_DOC: Doc = { type: "doc", content: [] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export type Part<T> = { ok: true; value: T } | { ok: false; details: Detail[] };

/** 本文：{ doc } だけ。無ければ空の木。答えは DB に渡す { doc, text } */
export function checkBody(body: unknown): Part<{ doc: unknown; text: string }> {
  if (body === undefined) return { ok: true, value: toTicketBody(EMPTY_DOC) };
  if (!isObj(body)) return { ok: false, details: [{ field: "body", message: "本文は { doc } の形で送ってください" }] };
  const extra = Object.keys(body).filter((k) => k !== "doc");
  if (extra.length)
    return {
      ok: false,
      details: extra.map((k) => ({
        field: `body.${k}`,
        message: "本文は doc だけを送ってください（text は送らない）",
      })),
    };
  const checked = validateDoc(body["doc"]);
  if (!checked.ok) return { ok: false, details: [{ field: "body.doc", message: checked.reason }] };
  return { ok: true, value: toTicketBody(checked.doc) };
}

const isFieldValue = (v: unknown): boolean =>
  v === null ||
  typeof v === "string" ||
  (typeof v === "number" && Number.isFinite(v)) ||
  typeof v === "boolean" ||
  (Array.isArray(v) && v.every((x) => typeof x === "string"));

/** 会社の項目：鍵の形と JSON の値の種類だけ。無ければ空 */
export function checkFields(fields: unknown): Part<Record<string, unknown>> {
  if (fields === undefined) return { ok: true, value: {} };
  if (!isObj(fields))
    return {
      ok: false,
      details: [{ field: "fields", message: "会社の項目は { 項目の id: 値 } の形で送ってください" }],
    };
  const details: Detail[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!isUuid(k)) details.push({ field: `fields.${k}`, message: "項目の id（uuid）を鍵にしてください" });
    else if (!isFieldValue(v))
      details.push({
        field: `fields.${k}`,
        message: "値は文字・数・true か false・文字の並び・null のどれかにしてください",
      });
  }
  return details.length ? { ok: false, details } : { ok: true, value: fields };
}

/** 確認項目：文字の並び（0〜50 件）。無ければ空 */
export function checkSpecs(specs: unknown): Part<string[]> {
  if (specs === undefined) return { ok: true, value: [] };
  if (!Array.isArray(specs))
    return { ok: false, details: [{ field: "specs", message: "確認項目は文の並びで送ってください" }] };
  if (specs.length > SPECS_MAX)
    return { ok: false, details: [{ field: "specs", message: `確認項目は ${SPECS_MAX} 件までです` }] };
  const details: Detail[] = [];
  specs.forEach((x, i) => {
    if (typeof x !== "string") details.push({ field: `specs.${i}`, message: "確認項目は文字で書いてください" });
  });
  return details.length ? { ok: false, details } : { ok: true, value: specs as string[] };
}

const LINK_KEYS = new Set(["kind", "other_ticket_id"]);
const isLinkKind = (v: unknown): v is LinkInput["kind"] => (LINK_KINDS as readonly unknown[]).includes(v);

/** つなぐ相手 1 件の形。外れの文（無ければ null） */
function linkProblem(x: unknown): string | null {
  if (!isObj(x)) return "つなぐ相手は { kind, other_ticket_id } の形で送ってください";
  if (Object.keys(x).some((k) => !LINK_KEYS.has(k))) return "つなぐ相手は kind と other_ticket_id だけを送ってください";
  if (!isLinkKind(x["kind"])) return "つながりの種類は related か derived_from です";
  if (typeof x["other_ticket_id"] !== "string" || !isUuid(x["other_ticket_id"]))
    return "つなぐ相手を選び直してください";
  return null;
}

/** つなぐ相手：[{ kind, other_ticket_id }]（0〜20 件・同じ組なし）。無ければ空 */
export function checkLinks(links: unknown): Part<LinkInput[]> {
  if (links === undefined) return { ok: true, value: [] };
  if (!Array.isArray(links))
    return { ok: false, details: [{ field: "links", message: "つなぐ相手は並びで送ってください" }] };
  if (links.length > LINKS_MAX)
    return { ok: false, details: [{ field: "links", message: `つなぐ相手は ${LINKS_MAX} 件までです` }] };
  const details: Detail[] = [];
  const seen = new Set<string>();
  links.forEach((x, i) => {
    const problem = linkProblem(x);
    if (problem) {
      details.push({ field: `links.${i}`, message: problem });
      return;
    }
    const link = x as unknown as LinkInput;
    const pair = `${link.kind}:${link.other_ticket_id.toLowerCase()}`;
    if (seen.has(pair)) details.push({ field: `links.${i}`, message: "同じ相手を同じ種類で 2 回つなげません" });
    seen.add(pair);
  });
  if (details.length) return { ok: false, details };
  return {
    ok: true,
    value: (links as LinkInput[]).map((x) => ({ kind: x.kind, other_ticket_id: x.other_ticket_id })),
  };
}
