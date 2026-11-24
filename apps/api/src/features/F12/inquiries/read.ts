// 自分の問い合わせを読む口（K-951）：listMyInquiries（GET /api/v1/inquiries）・getMyInquiry（GET /api/v1/inquiries/:id）。
//   見えるのは書いた本人だけ（D-156.25）。行の守り（K-949 の inquiries_self_read）に加えて、口の文でも opened_by_member_id = app.user_id() で絞る（2 重）。
//   認証・上限（120/分/人）・先方の権限の人の 403・limit と cursor の形・道の id の形は契約の入口（op.ts）が先に確かめる。
//   一覧：本人の・消していない問い合わせを、やり取りの新しい順（last_message_at desc, created_at desc, id desc）に。続きは入口の共通の位置の数。
//   1 件：本人の・消していない問い合わせだけ（ほかは 404 E-PAGE-001・欄なし）。やり取りは visibility 'all' だけ（社内メモは出さない・行の守りと 2 重）。
//     返す同じ取引で読んだ印（inquiries.asker_read_at）を DB の関数 app.inquiry_mark_read で入れる（関門 C2）。書けなければ 503 で答えない。
//   答えの 7 欄は K-949 の toMyInquiry（状態の読み替え・返事の印）。ログに題・本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { toMyInquiry } from "./shape.js";

/** 入口（op.ts）の一覧の既定と同じ（limit が無いとき） */
const LIMIT_DEFAULT = 50;

/** 問い合わせ 1 行の材料（toMyInquiry に渡す）。last_reply_at は運営の返事（visibility 'all'・送り手なし・inquiry_reply）の最新 */
const ROW_COLUMNS = `
  i.id, i.title, i.topic_key, i.state, i.created_at, i.asker_read_at,
  (select max(m.created_at) from messages m
    where m.conversation_id = i.conversation_id and m.tenant_id = i.tenant_id and m.deleted_at is null
      and m.visibility = 'all' and m.sender_member_id is null and m.kind = 'inquiry_reply') as last_reply_at`;

const MINE = `i.tenant_id = app.tenant_id() and i.opened_by_member_id = app.user_id() and i.deleted_at is null`;

// $1 読む件数（limit + 1）・$2 位置
const LIST_SQL = `
select ${ROW_COLUMNS}
  from inquiries i
 where ${MINE}
 order by i.last_message_at desc nulls last, i.created_at desc, i.id desc
 limit $1 offset $2`;

// $1 問い合わせの id
const ONE_SQL = `
select ${ROW_COLUMNS}, i.context, i.conversation_id
  from inquiries i
 where ${MINE} and i.id = $1`;

// $1 会話の id・$2 本人の id（入口の ctx）。本人の書き込みは本人の名前、運営の返事は書いたときの名前の写し
const MESSAGES_SQL = `
select m.id, m.body, m.created_at, m.attachments,
       case when m.sender_member_id is null then 'ops' else 'me' end as "from",
       case when m.sender_member_id is null then m.author_name else mb.display_name end as author_name
  from messages m
  left join members mb on mb.id = m.sender_member_id and mb.tenant_id = m.tenant_id
 where m.conversation_id = $1 and m.tenant_id = app.tenant_id() and m.deleted_at is null and m.visibility = 'all'
 order by m.created_at, m.id`;

const MARK_SQL = `select app.inquiry_mark_read($1::uuid) as ok`;

type InquiryRow = Parameters<typeof toMyInquiry>[0];

interface MessageRow {
  id: string;
  body: string | null;
  created_at: Date;
  attachments: unknown;
  from: "me" | "ops";
  author_name: string | null;
}

export interface MyInquiryMessage {
  id: string;
  from: "me" | "ops";
  author_name: string | null;
  body: string;
  attachments: { id: string; name: string; size: number }[];
  created_at: string;
}

/** 書き込みの添付（[{id,name,size}]）だけを、その 3 つの鍵で返す。形の違う物は落とす */
function toAttachments(raw: unknown): MyInquiryMessage["attachments"] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const a = x as Record<string, unknown> | null;
    if (!a || typeof a["id"] !== "string" || typeof a["name"] !== "string" || typeof a["size"] !== "number") return [];
    return [{ id: a["id"], name: a["name"], size: a["size"] }];
  });
}

const toMessage = (m: MessageRow): MyInquiryMessage => ({
  id: m.id,
  from: m.from,
  author_name: m.author_name,
  body: m.body ?? "",
  attachments: toAttachments(m.attachments),
  created_at: m.created_at.toISOString(),
});

/** 問い合わせたときの画面の情報（D-156.39）。null か空の {} なら null */
function toContext(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return Object.keys(raw).length ? (raw as Record<string, unknown>) : null;
}

/** 正本のエラーを、欄なし・detail なしの形で（在るかを漏らさない） */
const bare = (status: number, code: string): HookReply => {
  const j = kanameError(code).toJSON();
  return {
    status,
    body: {
      error: j.error,
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};

const unavailable = (what: string, e: unknown): HookReply => {
  console.error(`[inquiries] 問い合わせを${what}（${(e as Error)?.name ?? "Error"}）`);
  return bare(503, "E-PAGE-003");
};

/** 入口が形を確かめた limit と cursor（位置の数）を読む */
function page(query: Record<string, string>): { limit: number; offset: number } {
  const limit = query["limit"] ? Number(query["limit"]) : LIMIT_DEFAULT;
  const offset = query["cursor"] ? Number(query["cursor"]) : 0;
  return { limit, offset };
}

export function createListMyInquiries(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const { limit, offset } = page(a.c.req.query());
    try {
      const rows = await withTenant(
        appPool,
        a.ctx,
        async (cl) => (await cl.query<InquiryRow>(LIST_SQL, [limit + 1, offset])).rows,
      );
      const next = rows.length > limit ? String(offset + limit) : null;
      return { status: 200, body: { data: rows.slice(0, limit).map(toMyInquiry), meta: { limit, next_cursor: next } } };
    } catch (e) {
      return unavailable("読めなかった", e);
    }
  };
}

type OneRow = InquiryRow & { context: unknown; conversation_id: string | null };

export function createGetMyInquiry(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const out = await withTenant(appPool, a.ctx, async (cl) => {
        const row = (await cl.query<OneRow>(ONE_SQL, [a.id])).rows[0];
        if (!row) return null;
        const msgs = row.conversation_id ? (await cl.query<MessageRow>(MESSAGES_SQL, [row.conversation_id])).rows : [];
        const marked = (await cl.query<{ ok: boolean | null }>(MARK_SQL, [row.id])).rows[0];
        // 読んだ印が入らない答えで「読んだ」を見せない（本人の行を今読んだのに書けない＝想定外）
        if (!marked?.ok) throw new Error("読んだ印を入れられなかった");
        return { row, msgs };
      });
      if (!out) return bare(404, "E-PAGE-001");
      const { context, conversation_id: _c, ...base } = out.row;
      return {
        status: 200,
        body: {
          data: { ...toMyInquiry(base as InquiryRow), context: toContext(context), messages: out.msgs.map(toMessage) },
        },
      };
    } catch (e) {
      return unavailable("開けなかった", e);
    }
  };
}
