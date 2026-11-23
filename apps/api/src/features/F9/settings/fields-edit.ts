// 項目を直す・消す・並べる口（K-717・契約の口 updateTicketField・deleteTicketField・reorderTicketFields）。足す・マスタを読むは K-706（fields.ts）。
//   設計は 07_functional/段10-F9/土台-settings.md の 3・4 章。仕事は DB の関数 app.ticket_field_update・delete・reorder が持ち（権限 → 確かめ → 書く → 証跡を 1 つの取引）、
//   口は「入力の確かめ → 関数を呼ぶ → 答えの形にする」だけ。入口の zod は契約の値域（長さ・型の 7 つ・1 つ以上）を見ないので、ここでも確かめて欄つきの 422 を返す。
//   断りの言葉 → 番号は K-706 の fieldErrorOf に、この葉の言葉（type_locked＝409 E-FMS-002・order_mismatch＝E-FMS-003・options_not_allowed＝E-FMS-005）を足して渡す。
//   想定外の例外は 503 E-PAGE-003。ログに項目の名前・説明・選ぶ物を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { isUuid } from "@kaname/contracts";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { FIELD_TYPES } from "../../F4/ticket-fields/shape.js";
import { cleanName, fieldErrorOf, invalid, kindOf, toFieldSetting, unavailable } from "./fields.js";

const EDIT_ERRORS: Record<string, string> = {
  type_locked: "E-FMS-002",
  order_mismatch: "E-FMS-003",
  options_not_allowed: "E-FMS-005",
};
const KEYS = ["name", "field_type", "required", "description", "options", "kind_ids"] as const;
const isUuidList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && isUuid(x));

type Outcome = { data: unknown } | { error: string; field?: string };

const optionsOk = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((o) => {
    if (typeof o !== "object" || o === null || Array.isArray(o)) return false;
    const r = o as Record<string, unknown>;
    if (Object.keys(r).some((k) => k !== "id" && k !== "name")) return false;
    if (cleanName(r["name"]) === null) return false;
    return r["id"] === undefined || (typeof r["id"] === "string" && isUuid(r["id"]));
  });

/** 直す入力の確かめ（送った欄だけ・1 つは要る）。通れば DB の関数へ渡す差分 */
function pickPatch(input: Record<string, unknown>): { patch: Record<string, unknown> } | { reply: HookReply } {
  const sent = KEYS.filter((k) => input[k] !== undefined);
  const bad = (field: string) => ({ reply: invalid(field) });
  if (!sent.length) return bad("body");
  if (input["name"] !== undefined && cleanName(input["name"]) === null) return bad("name");
  const type = input["field_type"];
  if (type !== undefined && (typeof type !== "string" || !(FIELD_TYPES as readonly string[]).includes(type)))
    return bad("field_type");
  if (input["required"] !== undefined && typeof input["required"] !== "boolean") return bad("required");
  const desc = input["description"];
  if (desc !== undefined && desc !== null && typeof desc !== "string") return bad("description");
  if (input["options"] !== undefined && !optionsOk(input["options"])) return bad("options");
  if (input["kind_ids"] !== undefined && !isUuidList(input["kind_ids"])) return bad("kind_ids");
  return { patch: Object.fromEntries(sent.map((k) => [k, input[k]])) };
}

async function callFn(
  appPool: pg.Pool,
  a: HookArgs,
  sql: string,
  params: unknown[],
  what: string,
): Promise<Outcome | null> {
  try {
    return (
      (await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Outcome }>(sql, params)).rows[0]?.v)) ?? null
    );
  } catch (e) {
    console.error(`[ticket-fields] ${what}（${kindOf(e)}）`);
    return null;
  }
}

const reject = (v: { error: string; field?: string }): HookReply => fieldErrorOf(v.error, v.field, EDIT_ERRORS);

const UPDATE_SQL = "select app.ticket_field_update($1::uuid, $2::jsonb) as v";
const DELETE_SQL = "select app.ticket_field_delete($1::uuid) as v";
const REORDER_SQL = "select app.ticket_field_reorder($1::uuid[]) as v";

export function createUpdateTicketField(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = pickPatch(a.input);
    if ("reply" in p) return p.reply;
    const v = await callFn(appPool, a, UPDATE_SQL, [a.id, JSON.stringify(p.patch)], "直せなかった");
    if (!v) return unavailable();
    if ("error" in v) return reject(v);
    return { status: 200, body: { data: toFieldSetting(v.data as Parameters<typeof toFieldSetting>[0]) } };
  };
}

export function createDeleteTicketField(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const v = await callFn(appPool, a, DELETE_SQL, [a.id], "消せなかった");
    if (!v) return unavailable();
    if ("error" in v) return reject(v);
    return { status: 200, body: { data: { id: (v.data as { id: string }).id } } };
  };
}

/** 並べるの形の誤り（欄つきの 422） */
function orderInvalid(field: string): HookReply {
  return {
    status: 422,
    body: {
      error: "validation_failed",
      code: "VALIDATION_ERROR",
      details: [{ field, message: "入力内容を確認してください" }],
    },
  };
}
/** 並べるの断り：対象を指さない口なので 404 は無い（403・422・409 E-FMS-003。知らない言葉は 503） */
function rejectOrder(v: { error: string; field?: string }): HookReply {
  if (v.error === "forbidden") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (v.error === "invalid") return orderInvalid(v.field ?? "field_ids");
  if (v.error !== "order_mismatch") return unavailable();
  const e = kanameError("E-FMS-003");
  return { status: e.status, body: { error: e.entry.cls, code: e.code } };
}

export function createReorderTicketFields(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const ids = a.input["field_ids"];
    if (!isUuidList(ids)) return orderInvalid("field_ids");
    const v = await callFn(appPool, a, REORDER_SQL, [ids], "並べられなかった");
    if (!v) return unavailable();
    if ("error" in v) return rejectOrder(v);
    const rows = Array.isArray(v.data) ? (v.data as Parameters<typeof toFieldSetting>[0][]) : [];
    return { status: 200, body: { data: rows.map(toFieldSetting) } };
  };
}
