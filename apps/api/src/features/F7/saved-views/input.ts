// 保存した検索条件の入力の確かめ（K-475 保存する。K-476 の直すも同じ確かめを使う）。DB に触らない純粋な関数だけ。
//   入口（op.ts の normalize）が NFKC と前後の空白を直した後に来るが、ここでも同じに直す（サーバーが最後の砦）。
//   決まりは契約（05_flow/screen_api.d/K-475.py の VALUE_RANGES・INPUT_RULES）と同じ数字。口は形と大きさだけを見て、条件の中の意味は見ない。
//   エラーの文は正本（errors.json → @kaname/errors）から引く。ログには名前も条件も出さない
import { kanameError } from "@kaname/errors";
import type { Row } from "@kaname/db/repository";
import type { Hook, HookReply } from "../../../contract/deps.js";

export const NAME_MAX = 60;
export const FILTERS_MAX_KEYS = 8;
export const FILTERS_INNER_MAX_KEYS = 32;
export const VALUE_MAX = 500;
export const KEY_RE = /^[A-Za-z0-9_]{1,40}$/;
export const COLUMNS_MAX = 50;
export const COLUMN_MAX = 40;
export const SHARES = ["self", "group"] as const;
export const DENSITIES = ["normal", "compact"] as const;
// eslint-disable-next-line no-control-regex -- 名前の途中の制御文字（C0・DEL・C1）を断る
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

/** 正本のエラーを、欄の名前つきの答えにする（画面は details の欄の下に文を出す） */
export const fail = (code: string, field?: string): HookReply => {
  const e = kanameError(code);
  return {
    status: e.status,
    body: { ...e.toJSON(), ...(field ? { field, details: [{ field, message: e.entry.message }] } : {}) },
  };
};
/** 契約の形に合うが決まった値の外（share・density）：入口の形の確かめと同じ答え */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const chars = (s: string): number => [...s].length;

/** 名前：NFKC と前後の空白を直し、空は E-VWS-001・61 文字以上は E-VWS-002・途中の制御文字は E-VWS-008。通れば直した名前 */
export function checkName(raw: string): { name: string } | HookReply {
  const name = raw.normalize("NFKC").trim();
  if (name === "") return fail("E-VWS-001", "name");
  if (chars(name) > NAME_MAX) return fail("E-VWS-002", "name");
  if (CONTROL_RE.test(name)) return fail("E-VWS-008", "name");
  return { name };
}

export function checkShare(v: unknown): HookReply | null {
  return typeof v === "string" && (SHARES as readonly string[]).includes(v)
    ? null
    : invalid("share", SHARES.join("／"));
}
export function checkDensity(v: unknown): HookReply | null {
  return typeof v === "string" && (DENSITIES as readonly string[]).includes(v)
    ? null
    : invalid("density", DENSITIES.join("／"));
}

const isLeaf = (v: unknown): boolean =>
  (typeof v === "string" && chars(v) <= VALUE_MAX) || typeof v === "number" || typeof v === "boolean";
/** 欄の名前と値の形（入れ物は 1 段まで） */
const entriesOk = (o: Record<string, unknown>, max: number, inner: boolean): boolean => {
  const entries = Object.entries(o);
  if (entries.length > max) return false;
  return entries.every(
    ([k, v]) => KEY_RE.test(k) && (isLeaf(v) || (!inner && isObject(v) && entriesOk(v, FILTERS_INNER_MAX_KEYS, true))),
  );
};

/** 条件：入れ物・欄 8 個まで・名前は英数字と _ の 40 字まで・値は 500 字までの文字か数か真偽か 1 段の入れ物（32 欄まで）。外れたら E-VWS-007（欄 filters） */
export function checkFilters(v: unknown): HookReply | null {
  return isObject(v) && entriesOk(v, FILTERS_MAX_KEYS, false) ? null : fail("E-VWS-007", "filters");
}
/** 列：文字の並び（50 個まで・1 つ 40 文字まで）。外れたら E-VWS-007（欄 columns） */
export function checkColumns(v: unknown): HookReply | null {
  const ok =
    Array.isArray(v) && v.length <= COLUMNS_MAX && v.every((c) => typeof c === "string" && chars(c) <= COLUMN_MAX);
  return ok ? null : fail("E-VWS-007", "columns");
}

/** 口の前処理（Hook.input）：知っている欄だけを name・share・scope_id・filters・columns・density の順に確かめ、最初の誤りの答えを返す。
 *  知らない欄は返さず、入口の strict な形が 422 にする。体は名前を直しただけでそのまま返す（入口が契約の形でも確かめる） */
export const input: NonNullable<Hook["input"]> = (raw) => {
  if (!isObject(raw)) return { input: raw as Row };
  const body: Record<string, unknown> = { ...raw };
  // 名前は必須（契約の入口の形は欄を任意にしておくので、無い・文字でないのはここで 422・欄 name）
  if (typeof body["name"] !== "string") return { reply: invalid("name", "名前は必須（文字）") };
  const n = checkName(body["name"]);
  if ("status" in n) return { reply: n };
  body["name"] = n.name;
  if ("share" in body) {
    const bad = checkShare(body["share"]);
    if (bad) return { reply: bad };
  }
  if (body["share"] === "group" && (body["scope_id"] === undefined || body["scope_id"] === null))
    return { reply: fail("E-VWS-003", "scope_id") };
  for (const [key, check] of [
    ["filters", checkFilters],
    ["columns", checkColumns],
    ["density", checkDensity],
  ] as const) {
    if (!(key in body)) continue;
    const bad = check(body[key]);
    if (bad) return { reply: bad };
  }
  return { input: body as Row };
};
