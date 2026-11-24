// 項目のマスタの口（K-706・契約の口 listTicketFieldMaster・createTicketField）。直す・並べる・消す（K-717）も fieldErrorOf と toFieldSetting を使う。
//   設計は 07_functional/段10-F9/土台-settings.md の 3・4 章。仕事は DB の関数 app.ticket_field_* が持ち（権限 → 確かめ → 書く → 証跡を 1 つの取引）、
//   口は「入力の確かめ → 関数を呼ぶ → 答えの形にする」だけ。断りの言葉 → 番号は fieldErrorOf（name_taken＝409 E-FMS-001・dup_option＝E-FMS-004・
//   kind_not_found・option_not_found・not_found＝404 E-PAGE-001〔欄・details なし〕・forbidden＝403・invalid＝422 欄つき）。想定外の例外は 503 E-PAGE-003。
//   ログに項目の名前・説明・選ぶ物を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import {
  FIELD_TYPES,
  SELECT_TYPES,
  toTicketField,
  type CustomFieldRow,
  type TicketField,
} from "../../F4/ticket-fields/shape.js";

/** 答えの 1 行（鍵ちょうど 10）＝段 5 の TicketField の 7 つ＋どの種別で出すか・全部の種別か・値の数 */
export interface TicketFieldSetting extends TicketField {
  kind_ids: string[];
  all_kinds: boolean;
  value_count: number;
}

interface SettingRow extends CustomFieldRow {
  kind_ids: unknown;
  all_kinds: boolean;
  value_count: number;
}

export const toFieldSetting = (r: SettingRow): TicketFieldSetting => ({
  ...toTicketField(r),
  kind_ids: Array.isArray(r.kind_ids) ? r.kind_ids.filter((k): k is string => typeof k === "string") : [],
  all_kinds: r.all_kinds === true,
  value_count: Number(r.value_count) || 0,
});

const WS = /^\s+|\s+$/g; // \s は全角の空白（U+3000）・タブ・改行も含む
const NAME_MAX = 40;
/** 前後の空白（全角・タブ・改行）を落として 1〜40 字。外れは null */
export const cleanName = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(WS, "");
  return t.length >= 1 && [...t].length <= NAME_MAX ? t : null;
};

export const invalid = (field: string): HookReply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field, message: "入力内容を確認してください" }],
  },
});
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "E-PAGE-001" } });
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
export const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const conflict = (code: string): HookReply => {
  const e = kanameError(code);
  return { status: e.status, body: { error: e.entry.cls, code: e.code } };
};
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

const CONFLICT: Record<string, string> = { name_taken: "E-FMS-001", dup_option: "E-FMS-004" };
const NOT_FOUND = new Set(["not_found", "kind_not_found", "option_not_found"]);

/** DB の関数の断りの言葉 → 口の答え（K-717 も使う）。知らない言葉は 503（止める側に倒す） */
export function fieldErrorOf(word: string, field?: string, extra: Record<string, string> = {}): HookReply {
  if (word === "forbidden") return forbidden();
  if (word === "invalid") return invalid(field ?? "body");
  if (NOT_FOUND.has(word)) return notFound();
  const code = extra[word] ?? CONFLICT[word];
  return code ? conflict(code) : unavailable();
}

type Outcome = { data: SettingRow } | { error: string; field?: string };

const SETTINGS_SQL = "select x as v from jsonb_array_elements(app.ticket_field_settings()) x";

export function createListTicketFieldMaster(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      const rows = await withTenant(
        appPool,
        a.ctx,
        async (cl) => (await cl.query<{ v: SettingRow }>(SETTINGS_SQL)).rows,
      );
      return { status: 200, body: { data: rows.map((r) => toFieldSetting(r.v)) } };
    } catch (e) {
      console.error(`[ticket-fields] マスタを読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}

/** 足す入力の確かめ（入口が strict な形で確かめた後の、契約に書けない・入口の zod が見ない決まり） */
function pickCreate(input: Record<string, unknown>): unknown[] | HookReply {
  const name = cleanName(input["name"]);
  if (name === null) return invalid("name");
  const type = input["field_type"];
  if (typeof type !== "string" || !(FIELD_TYPES as readonly string[]).includes(type)) return invalid("field_type");
  const kinds = input["kind_ids"];
  if (!Array.isArray(kinds) || !kinds.length) return invalid("kind_ids");
  const opts = input["options"];
  if (SELECT_TYPES.includes(type)) {
    if (!Array.isArray(opts) || !opts.length) return invalid("options");
    for (const o of opts) {
      if (typeof o !== "object" || o === null || Array.isArray(o)) return invalid("options");
      const r = o as Record<string, unknown>;
      if (Object.keys(r).some((k) => k !== "id" && k !== "name")) return invalid("options");
      if (cleanName(r["name"]) === null) return invalid("options");
      if (r["id"] !== undefined && typeof r["id"] !== "string") return invalid("options");
    }
  } else if (opts !== undefined && !(Array.isArray(opts) && opts.length === 0)) return invalid("options");
  const desc = input["description"];
  const description = typeof desc === "string" && desc.replace(WS, "") !== "" ? desc.replace(WS, "") : null;
  return [
    name,
    type,
    JSON.stringify(SELECT_TYPES.includes(type) ? opts : []),
    input["required"] === true,
    description,
    kinds,
  ];
}

const CREATE_SQL = "select app.ticket_field_create($1, $2, $3::jsonb, $4, $5, $6::uuid[]) as v";

export function createCreateTicketField(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = pickCreate(a.input);
    if (!Array.isArray(p)) return p;
    let v: Outcome | undefined;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Outcome }>(CREATE_SQL, p)).rows[0]?.v);
    } catch (e) {
      console.error(`[ticket-fields] 足せなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!v) return unavailable();
    if ("data" in v) return { status: 201, body: { data: toFieldSetting(v.data) } };
    return fieldErrorOf(v.error, v.field);
  };
}
