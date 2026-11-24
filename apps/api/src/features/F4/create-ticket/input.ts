// チケットを作る（K-60・K-437）の入力の形の確かめ。同じ会社か・書けるか・会社の項目の値・確認項目の文の長さは DB（app.ticket_create）が確かめる。
//   題名は NFKC で整えず前後の空白だけ落とす（D-150.34）：入口（op.ts の normalize）が直す前の生の題名を 3 つ目の引数で受け、長さは生の字で数える（契約の maxLength と同じ TITLE_MAX）。
//   期限が今日より前は E-VAL-012・開始が期限より後は E-VAL-028（どちらも 409・欄なし。hooks.ts が E-VAL-012 → E-VAL-028 の順に先に返す）。
//   つなぐ相手 links（K-581）は形だけを確かめて value に載せる（無い・空なら鍵ごと載せない）。相手が選べるかは DB の app.ticket_link_add（K-441）
//   複製（K-438）：duplicate_of（元の id・uuid）と copy（写す物の名前 6 つの並び・重複なし）を形だけ確かめて value に載せる。
//     空文字・null・uuid でない字・知らない名前・重複は入口が先に 422 にするので、ここは二重の守り。duplicate_of が無いのに copy があれば 422（欄 copy）
//   本文 body があれば body だけを使い sections は載せない／body が無く sections だけなら前の区画の道（K-578 まで）／どちらも無ければ空の本文
import { isUuid } from "@kaname/contracts";
import { isCopyName } from "./duplicate.js";
import { checkBody, checkFields, checkLinks, checkSpecs } from "./payload.js";
export const TITLE_MAX = 200;
export const NOTIFY_MAX = 20;
/** 正式な uuid の形（契約の入口と同じ isUuid＝z.uuid()・版と variant の桁まで見る・K-145） */
const UUID = { test: (v: string): boolean => isUuid(v) };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface Detail {
  field: string;
  message: string;
  code?: string;
}
export type Checked = { ok: true; value: Record<string, unknown> } | { ok: false; details: Detail[] };

/** 日本時間の今日（期限は日付だけ・時差でずれない・D-128.130） */
export function todayJst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
const isDate = (v: unknown): v is string =>
  typeof v === "string" &&
  DATE.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/** 画面が送ったままの値（入口が揃える前）。題名・本文・確認項目の文に使う。無い鍵は入口が揃えた値を使う */
export interface RawParts {
  title?: unknown;
  body?: unknown;
  specs?: unknown;
}

export function checkCreate(
  input: Record<string, unknown>,
  today: string,
  rawTitle?: unknown,
  raw: RawParts = {},
): Checked {
  const d: Detail[] = [];
  const typed = typeof rawTitle === "string" ? rawTitle : input["title"];
  const title = typeof typed === "string" ? typed.trim() : "";
  if (!title) d.push({ field: "title", message: "題名を入れてください" });
  else if ([...(typed as string)].length > TITLE_MAX)
    d.push({ field: "title", message: `題名は ${TITLE_MAX} 文字までです` });
  for (const [f, label] of [
    ["scope_id", "グループを選んでください"],
    ["kind_id", "種別を選んでください"],
    ["assignee_member_id", "担当者を選んでください"],
  ] as const)
    if (typeof input[f] !== "string" || !UUID.test(input[f] as string)) d.push({ field: f, message: label });
  const due = input["due_on"];
  if (due === undefined || due === "") d.push({ field: "due_on", message: "期限を入れてください" });
  else if (!isDate(due)) d.push({ field: "due_on", message: "期限は日付で入れてください" });
  else if (due < today)
    d.push({ field: "due_on", message: "期限は今日か、それより後の日にしてください", code: "E-VAL-012" });
  const start = input["start_on"];
  if (start !== undefined && start !== "" && !isDate(start))
    d.push({ field: "start_on", message: "開始は日付で入れてください" });
  else if (isDate(start) && isDate(due) && start > due)
    d.push({ field: "start_on", message: "開始は期限より前の日にしてください", code: "E-VAL-028" });
  const priority = input["priority"] === undefined || input["priority"] === "" ? "mid" : input["priority"];
  if (priority !== "mid" && priority !== "high") d.push({ field: "priority", message: "優先度は 中 か 高 です" });
  const reason = typeof input["priority_reason"] === "string" ? input["priority_reason"].trim() : "";
  if (priority === "high" && !reason)
    d.push({ field: "priority_reason", message: "優先度を高にする理由を書いてください" });
  let estimate: number | null = null;
  const est = input["estimate_minutes"];
  if (est !== undefined && est !== null && est !== "") {
    const n = typeof est === "number" ? est : typeof est === "string" && /^\d+$/.test(est) ? Number(est) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > 100_000)
      d.push({ field: "estimate_minutes", message: "見込み時間は 0 以上の分で入れてください" });
    else estimate = n;
  }
  const parent = input["parent_ticket_id"];
  if (parent !== undefined && parent !== "" && (typeof parent !== "string" || !UUID.test(parent)))
    d.push({ field: "parent_ticket_id", message: "親のチケットを選び直してください" });
  const sections: Record<string, string> = {};
  const hasBody = input["body"] !== undefined;
  const rawSections = input["sections"] ?? {};
  // 区画の形（名前・文字）は本文があっても契約どおり確かめる（K144-API-039）。本文があれば中身は捨てる（DB にも渡さない・K-561 の決め）
  if (!rawSections || typeof rawSections !== "object" || Array.isArray(rawSections))
    d.push({ field: "sections", message: "区画の形が違います" });
  else
    for (const [k, v] of Object.entries(rawSections as Record<string, unknown>)) {
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(k)) d.push({ field: `sections.${k}`, message: "区画の名前が違います" });
      else if (typeof v !== "string") d.push({ field: `sections.${k}`, message: "区画は文字で書いてください" });
      else if (!hasBody) sections[k] = v.trim(); // 区画の中身に上限は置かない（D-130.3）。守りは入口の送る量 1MB だけ
    }
  const notify = input["notify_member_ids"] ?? [];
  if (
    !Array.isArray(notify) ||
    notify.length > NOTIFY_MAX ||
    notify.some((x) => typeof x !== "string" || !UUID.test(x))
  )
    d.push({ field: "notify_member_ids", message: `知らせる人は ${NOTIFY_MAX} 人まで選べます` });
  const draft = input["draft_id"];
  if (draft !== undefined && draft !== "" && (typeof draft !== "string" || !UUID.test(draft)))
    d.push({ field: "draft_id", message: "uuid" });
  // 続きとして出した元の下書き（別のタブ・別の端末で書いていたもの）。作ったら同じ処理で消す（本人の分だけ・K-60）
  const source = input["source_draft_id"];
  if (source !== undefined && source !== "" && (typeof source !== "string" || !UUID.test(source)))
    d.push({ field: "source_draft_id", message: "uuid" });
  // 本文は sections だけで来た作り方（前の道）でないときに載せる。送らなければ空の本文
  const useSections = !hasBody && input["sections"] !== undefined;
  const bodyPart = useSections ? null : checkBody("body" in raw ? raw.body : input["body"]);
  if (bodyPart && !bodyPart.ok) d.push(...bodyPart.details);
  const fieldsPart = checkFields(input["fields"]);
  if (!fieldsPart.ok) d.push(...fieldsPart.details);
  const specsPart = checkSpecs("specs" in raw ? raw.specs : input["specs"]);
  if (!specsPart.ok) d.push(...specsPart.details);
  const linksPart = checkLinks(input["links"]);
  if (!linksPart.ok) d.push(...linksPart.details);
  const dup = input["duplicate_of"];
  if (dup !== undefined && (typeof dup !== "string" || !UUID.test(dup)))
    d.push({ field: "duplicate_of", message: "複製の元を選び直してください" });
  const copy = input["copy"];
  if (copy !== undefined) {
    if (!Array.isArray(copy) || copy.some((x) => !isCopyName(x)) || new Set(copy).size !== copy.length)
      d.push({
        field: "copy",
        message: "写す物は本文・担当者・項目・確認項目・つながり・子チケットから重ねずに選んでください",
      });
    else if (dup === undefined) d.push({ field: "copy", message: "写す物は複製の元と一緒に送ってください" });
  }
  if (d.length || (bodyPart && !bodyPart.ok) || !fieldsPart.ok || !specsPart.ok || !linksPart.ok)
    return { ok: false, details: d };
  const bodyValue = bodyPart && bodyPart.ok ? bodyPart.value : null;
  return {
    ok: true,
    value: {
      scope_id: input["scope_id"],
      kind_id: input["kind_id"],
      title,
      assignee_member_id: input["assignee_member_id"],
      due_on: due,
      start_on: isDate(start) ? start : null,
      priority,
      priority_reason: reason || null,
      estimate_minutes: estimate,
      parent_ticket_id: parent || null,
      ...(bodyValue ? { body: bodyValue } : { sections }),
      fields: fieldsPart.value,
      specs: specsPart.value,
      ...(linksPart.value.length ? { links: linksPart.value } : {}),
      notify_member_ids: notify,
      draft_id: draft || null,
      source_draft_id: source || null,
      ...(typeof dup === "string" ? { duplicate_of: dup, copy: Array.isArray(copy) ? copy : [] } : {}),
    },
  };
}
