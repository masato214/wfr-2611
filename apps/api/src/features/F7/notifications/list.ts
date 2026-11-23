// 知らせを読む口（K-461）：listNotifications（GET /api/v1/notifications）。読むだけ（DB に書かない・メールも出さない）。
//   上限（1 分 120 回）・認証・同意し直しの止め・社内の外枠だけ（取引先・運営は 403）・欄 actor_member_id の uuid・欄 cursor の形（base64url の 1〜200 字）は契約の入口（op.ts）が先に確かめる。
//   見える行は VISIBLE_SQL（共有）：自分宛て・channel_id が inapp・消していない・種類が表にある・チケットの種類は今そのチケットが見える
//   ＋ 未読は全部／読んだものは読んだ時刻から 30 日まで。行の守り（notifications_self_read）の上で読み、口の文でも自分宛てで絞る（2 重）。
//   並び：できた時刻の新しい順 → id の新しい順。続きは keyset の鍵（読んでいる間に増えても重ならない）。
//   取引は 1 つ（withTenant）・文は 2 つ（一覧・最初の分だけ起こした人の候補）。行ごとに引かない。ログに payload・題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { UUID_RE } from "@kaname/db/id";
import { KanameError, kanameError } from "@kaname/errors";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { KNOWN_KINDS, TICKET_KINDS } from "./kinds.js";
import { toNotification, type Notification, type NotificationRow } from "./shape.js";

export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 50;
/** 起こした人の候補の上限（meta.actors） */
export const ACTORS_MAX = 50;
/** 続きの鍵の最大の長さ（入口 op.ts の KEY_CURSOR_OPS・base64url の 1〜200 字と同じ） */
const CURSOR_MAX = 200;

// ticket_id が uuid の形でない行は、見えない扱いにして落とす（::uuid が 22P02 で文ごと落ちないように）。形は正本の UUID_RE（入口の isUuid と同じ文字列）
const UUID_TEXT = UUID_RE.source;
/** 見える行の where の部品（alias n）。$1＝知っている種類・$2＝チケットの種類の配列。呼ぶ側の値は $3 から。
 *  K-462 の既読と K-465 の未読の数も同じ部品を使う（一覧に出る行だけが対象・一覧と数がずれない） */
export const VISIBLE_SQL = `n.tenant_id = app.tenant_id() and n.member_id = app.user_id()
   and n.channel_id = 'inapp' and n.deleted_at is null
   and n.event_kind_id = any($1::text[])
   and (n.read_at is null or n.read_at > now() - interval '30 days')
   and (n.event_kind_id <> all($2::text[])
        or app.ticket_visible(case when n.payload->>'ticket_id' ~ '${UUID_TEXT}' then (n.payload->>'ticket_id')::uuid end))`;
/** VISIBLE_SQL の $1・$2 に渡す値（この順で先頭に置く） */
export const KNOWN_PARAMS: readonly [readonly string[], readonly string[]] = [KNOWN_KINDS, TICKET_KINDS];
/** 未読の数（K-465 が使う） */
export const UNREAD_COUNT_SQL = `select count(*)::int as n from notifications n where ${VISIBLE_SQL} and n.read_at is null`;

// $3 未読だけか・$4 起こした人・$5 鍵の時刻・$6 鍵の id・$7 読む件数（limit + 1）
const LIST_SQL = `
select n.id, n.event_kind_id, n.payload, n.read_at, n.created_at,
       to_char(n.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_key,
       n.created_by as actor_id, m.display_name as actor_name
  from notifications n
  left join members m on m.id = n.created_by and m.tenant_id = n.tenant_id and m.deleted_at is null
 where ${VISIBLE_SQL}
   and (not $3::boolean or n.read_at is null)
   and ($4::uuid is null or n.created_by = $4::uuid)
   and ($5::timestamptz is null or (n.created_at, n.id) < ($5::timestamptz, $6::uuid))
 order by n.created_at desc, n.id desc
 limit $7`;

const ACTORS_SQL = `
select m.id, m.display_name as name
  from members m
 where m.tenant_id = app.tenant_id() and m.deleted_at is null
   and m.id in (select n.created_by from notifications n where ${VISIBLE_SQL})
 order by m.display_name, m.id
 limit ${ACTORS_MAX}`;

interface ListRow extends NotificationRow {
  created_key: string;
}

interface Issue {
  field: string;
  message: string;
}

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
/** 次の分の鍵：[できた時刻（マイクロ秒の ISO）, id] を base64url に */
export const encodeCursor = (createdKey: string, id: string): string =>
  Buffer.from(JSON.stringify([createdKey, id]), "utf8").toString("base64url");
/** 鍵として読めない物（形に合っても中身が JSON でない・時刻や id の形でない・長すぎる）は null */
export function decodeCursor(s: string): { createdKey: string; id: string } | null {
  if (s.length < 1 || s.length > CURSOR_MAX || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length !== 2 || !arr.every((x) => typeof x === "string")) return null;
  const [key, id] = arr as [string, string];
  if (!STAMP.test(key) || Number.isNaN(Date.parse(key)) || !isUuid(id)) return null;
  // 暦に無い日時（2026-02-30 など）は V8 が翌月に丸めて通すので、丸めが起きた鍵は読めない鍵にする（DB に行かせて 503 にしない）
  const head = /^[0-9T:-]{19}/.exec(key)?.[0] ?? "";
  if (!new Date(`${head}Z`).toISOString().startsWith(head)) return null;
  return { createdKey: key, id };
}

interface Query {
  unreadOnly: boolean;
  actorId: string | null;
  limit: number;
  cursor: string;
}

/** 422 の誤り（unread・limit）。空の値は指定なし。actor_member_id と cursor の形は入口が先に確かめる */
function parseQuery(raw: Record<string, string>): { ok: true; value: Query } | { ok: false; details: Issue[] } {
  const details: Issue[] = [];
  const unread = raw["unread"] ?? "";
  if (unread !== "" && unread !== "true" && unread !== "false")
    details.push({ field: "unread", message: "true か false" });
  const limitRaw = raw["limit"] ?? "";
  const limit = limitRaw === "" ? LIMIT_DEFAULT : /^[0-9]{1,4}$/.test(limitRaw) ? Number(limitRaw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
    details.push({ field: "limit", message: `1〜${LIMIT_MAX}` });
  if (details.length) return { ok: false, details };
  const actor = raw["actor_member_id"] ?? "";
  return {
    ok: true,
    value: { unreadOnly: unread === "true", actorId: actor === "" ? null : actor, limit, cursor: raw["cursor"] ?? "" },
  };
}

export function createListNotifications(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseQuery(a.c.req.query());
    if (!parsed.ok)
      return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: parsed.details } };
    const q = parsed.value;
    const cursor = q.cursor === "" ? null : decodeCursor(q.cursor);
    // 形（入口が確かめた）には合うが、今の状態では読めない鍵は 409・E-NTF-001（欄なし・DB に行かない）
    if (q.cursor !== "" && !cursor) return { status: 409, body: new KanameError("E-NTF-001").toJSON() };
    try {
      const { rows, actors } = await withTenant(appPool, a.ctx, async (cl) => {
        const list = await cl.query<ListRow>(LIST_SQL, [
          ...KNOWN_PARAMS,
          q.unreadOnly,
          q.actorId,
          cursor?.createdKey ?? null,
          cursor?.id ?? null,
          q.limit + 1,
        ]);
        const who = cursor ? [] : (await cl.query<{ id: string; name: string }>(ACTORS_SQL, [...KNOWN_PARAMS])).rows;
        return { rows: list.rows, actors: who };
      });
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      const next = rows.length > q.limit && last ? encodeCursor(last.created_key, last.id) : null;
      const data: Notification[] = page.map(toNotification);
      return { status: 200, body: { data, meta: { next_cursor: next, actors } } };
    } catch {
      console.error("[notifications] 知らせを読めなかった");
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };
}
