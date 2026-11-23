// やり取りの書き込みを直す・消す・☆ の口（K-386）：updateTicketMessage（PATCH /api/v1/ticket_messages/:id）・
//   deleteTicketMessage（DELETE 同）・starTicketMessage（POST /api/v1/ticket_messages/:id/star）。
//   入口の後、取引の中で先に「そのチケットが見えるか」を 1 回引いてから（守りの 2 層・判定の例外は 503）、DB の関数を 1 回だけ呼ぶ。
//   書く所の例外も 503・E-PAGE-003（何も変わらない）。ログに本文・人の名前・例外の文を出さない（reply.ts が場所と例外の種類だけを出す）。
//   直す・消すの答えは K-383 と同じ 1 件の形、☆ の答えは { id, stars, starred }
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { uniqueIds } from "./input.js";
import { inputPost, pageNotFound } from "./post.js";
import { broke, down, notFound } from "./reply.js";

/** 正本のエラーを 4xx の答えにする（欄の名前つき。文言は正本から引く） */
const refused = (code: string, field: string): HookReply => {
  const e = new KanameError(code);
  return { status: e.status, body: { ...e.toJSON(), field, details: [{ field, message: e.entry.message }] } };
};

interface EditResult {
  item?: unknown;
  id?: string;
  stars?: number;
  starred?: boolean;
  error?: string;
  field?: string;
}

/** 直す：本文が空・無いは入口の前処理で断る（E-VAL-027）。ほかの形は入口の確かめに回す */
export const inputEdit = inputPost;

/** 関数 1 回を、守りの判定の後に呼ぶ。守りの例外は 503、書く所の例外も 503 */
/** 呼ぶ DB の関数ごとの文（関数の名前を文に埋め込まない・G10） */
const CALL_SQL = {
  ticket_message_edit: "select app.ticket_message_edit($1, $2::jsonb) as v",
  ticket_message_delete: "select app.ticket_message_delete($1) as v",
  ticket_message_star: "select app.ticket_message_star($1) as v",
} as const;

async function run(
  appPool: pg.Pool,
  a: HookArgs,
  fn: keyof typeof CALL_SQL,
  args: unknown[],
  where: string,
): Promise<EditResult | HookReply> {
  let stage = "guard" as "guard" | "write";
  try {
    return await withTenant(appPool, a.ctx, async (cl) => {
      // 守りの判定を先に 1 回（ここで例外なら止める側に倒す）。見えるかの答えは関数の中でもう一度見る
      await cl.query("select app.ticket_visible(m.ticket_id) as ok from ticket_messages m where m.id = $1", [a.id]);
      stage = "write";
      const r = await cl.query<{ v: EditResult | null }>(CALL_SQL[fn], [a.id as string, ...args]);
      return r.rows[0]?.v ?? {};
    });
  } catch (e) {
    return stage === "guard" ? down(`${where}（守りの判定）`, e) : broke(where, e);
  }
}

const isReply = (x: EditResult | HookReply): x is HookReply => "status" in x && "body" in x;

/** 関数の error の言葉を答えにする。知らない言葉は 503（止める側に倒す） */
function answer(v: EditResult, where: string, okBody: (v: EditResult) => unknown | undefined): HookReply {
  const ok = okBody(v);
  if (ok !== undefined) return { status: 200, body: { data: ok } };
  if (v.error === "not_found") return notFound();
  if (v.error === "forbidden") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (v.error === "empty") return refused("E-VAL-027", "body");
  // @ に選べない人（見られない・抜けた・止められた）は見えない物：404 E-PAGE-001（欄・details・detail なし・控え帳 2026-11-21 01:15・K-385 の post.ts と同じ）
  if (v.error === "not_selectable") return pageNotFound();
  return down(`${where}（知らない答え）`, new Error("unknown"));
}

const itemOf = (v: EditResult): unknown | undefined => (v.item !== undefined && v.item !== null ? v.item : undefined);

export function createEditTicketMessage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const blank = inputPost(a.input);
    if ("reply" in blank) return blank.reply;
    const ids = a.input["mention_member_ids"];
    const payload = {
      body: String(a.input["body"] ?? ""),
      mention_member_ids: uniqueIds(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []),
    };
    const r = await run(appPool, a, "ticket_message_edit", [JSON.stringify(payload)], "やり取りの書き込みを直す");
    return isReply(r) ? r : answer(r, "やり取りの書き込みを直す", itemOf);
  };
}

export function createDeleteTicketMessage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const r = await run(appPool, a, "ticket_message_delete", [], "やり取りの書き込みを消す");
    return isReply(r) ? r : answer(r, "やり取りの書き込みを消す", itemOf);
  };
}

export function createStarTicketMessage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const r = await run(appPool, a, "ticket_message_star", [], "やり取りの書き込みに ☆ を付ける");
    return isReply(r)
      ? r
      : answer(r, "やり取りの書き込みに ☆ を付ける", (v) =>
          v.id !== undefined ? { id: v.id, stars: v.stars, starred: v.starred } : undefined,
        );
  };
}
