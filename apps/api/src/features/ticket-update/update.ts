// チケットを直す口（updateTicket）の振る舞い（K-387）。欄の組は fields.ts の表（TICKET_FIELD_GROUPS）が持つ。
//   前処理（input）：表のどの組にも無い欄が 1 つでもあれば 422 E-VAL-018（欄ごとに「この欄はまだ変えられません」・鍵の名前の順）。
//     空の体は 422（欄 body「変える欄がありません」）。組の形の決まり（inputIssues・契約に書ける物だけ）も 422。体が入れ物でなければ入口（契約の strict な形）に任せる。
//   before：1 つの処理（withTenant）で、送られた欄を持つ組の apply を表の順に呼び、組の答えから答えを組み立てる。
//     組が断ったら、その処理で書いた物を全部戻して（例外で rollback）組の答えを返す（段と優先度を一緒に送って段が断られたら、優先度も書かない・K-440）。書く所の DB の失敗は 503 E-PAGE-003（何も残らない・11-22 の決め）。
//   ログに理由の字・題名を出さない（場所と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Row } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../contract/deps.js";
import { TICKET_FIELD_GROUPS, type TicketFieldGroup } from "./fields.js";

/** まだ変えられない欄の明細の文（E-VAL-018 の頭の文は正本のまま・欄ごとの文はこれ） */
export const NOT_YET_MESSAGE = "この欄はまだ変えられません";

const isObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

/** 組が断った答えを、処理の外へ運ぶ（投げて rollback させる） */
class GroupStop extends Error {
  constructor(readonly reply: HookReply) {
    super("group_stop");
  }
}

/** どの組の答えにも在り、組み立てで合わせる鍵 */
const SHARED_KEYS: readonly string[] = ["ticket", "changed", "message_id"];

/** 組の答えを 1 つの答えに組み立てる（表の順）。ticket は組の列を重ね（id・number は同じ・updated_at は後の組の物）、
 *  changed はどれかが変えたら true、message_id は最初の null でない値、stage など組だけが持つ鍵はその組が送られたときだけ付く */
function combine(parts: readonly Row[]): Row {
  const ticket = parts.reduce<Row>((acc, p) => ({ ...acc, ...(isObject(p["ticket"]) ? p["ticket"] : {}) }), {});
  const rest = parts.reduce<Row>(
    (acc, p) => ({
      ...acc,
      ...Object.fromEntries(Object.entries(p).filter(([k]) => !SHARED_KEYS.includes(k))),
    }),
    {},
  );
  return {
    ...rest,
    ticket,
    changed: parts.some((p) => p["changed"] === true),
    message_id: parts.map((p) => p["message_id"]).find((m) => m !== null && m !== undefined) ?? null,
  };
}

/** 前処理：表に無い欄・空の体を断る */
export function checkUpdateInput(
  raw: unknown,
  groups: readonly TicketFieldGroup[] = TICKET_FIELD_GROUPS,
): { input: Row } | { reply: HookReply } {
  if (!isObject(raw)) return { input: raw as Row }; // 形の違いは入口の契約の確かめが 422 にする
  const known = new Set(groups.flatMap((g) => g.fields));
  const notYet = Object.keys(raw)
    .filter((k) => !known.has(k))
    .sort();
  if (notYet.length)
    return {
      reply: {
        status: 422,
        body: {
          ...kanameError("E-VAL-018").toJSON(),
          details: notYet.map((field) => ({ field, message: NOT_YET_MESSAGE })),
        },
      },
    };
  if (Object.keys(raw).length === 0)
    return {
      reply: {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: "body", message: "変える欄がありません" }],
        },
      },
    };
  // 組ごとの形の決まり（送られた欄を持つ組だけ・表の順）
  for (const g of groups) {
    if (!g.inputIssues || !g.fields.some((f) => f in raw)) continue;
    const issue = g.inputIssues(raw);
    if (issue) return { reply: issue };
  }
  return { input: raw };
}

async function update(pool: pg.Pool, a: HookArgs, groups: readonly TicketFieldGroup[]): Promise<HookReply> {
  const sent = Object.keys(a.input).filter((k) => a.input[k] !== undefined);
  const todo = groups.filter((g) => g.fields.some((f) => sent.includes(f)));
  if (!todo.length)
    return {
      status: 422,
      body: {
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "body", message: "変える欄がありません" }],
      },
    };
  let data: Row;
  try {
    data = await withTenant(pool, a.ctx, async (cl) => {
      const parts: Row[] = [];
      // 親を決める要求は、どの組より先に会社の錠を取る（組の中で先に行の錠を取ると、親だけの要求と錠の順が逆になって行き詰まる・K-440・PM の決め 2026-11-23 04:55）
      if (sent.includes("parent_ticket_id")) {
        await cl.query("select pg_advisory_xact_lock(hashtextextended('ticket_sort_parent:' || $1::text, 0))", [
          a.ctx.tenantId,
        ]);
      }
      for (const g of todo) {
        const part = Object.fromEntries(g.fields.filter((f) => sent.includes(f)).map((f) => [f, a.input[f]]));
        const r = await g.apply(cl, a.id!, part);
        if (!r.ok) throw new GroupStop(r.reply);
        parts.push(r.data);
      }
      return combine(parts);
    });
  } catch (e) {
    if (e instanceof GroupStop) return e.reply;
    // 書く所の失敗（1 つの処理なので何も残らない・知らせも出さない）。中身を返さず、ログは場所と例外の種類だけ
    console.error(`[ticket-update] チケットを直す：書く所で失敗した（${(e as Error)?.name ?? "Error"}）`);
    return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
  }
  return { status: 200, body: { data } };
}

/** updateTicket の口（hooks/ticket-update.ts が登録する）。groups は試験が差し替えられる（既定は表） */
export function ticketUpdateHooks(
  appPool: pg.Pool,
  groups: readonly TicketFieldGroup[] = TICKET_FIELD_GROUPS,
): Record<string, Hook> {
  return {
    updateTicket: {
      input: (raw) => checkUpdateInput(raw, groups),
      before: (a) => update(appPool, a, groups),
    },
  };
}
