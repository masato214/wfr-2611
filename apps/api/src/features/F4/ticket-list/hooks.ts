// チケットの一覧の口（K-92）：listTickets。読むだけ（口の中で書かない）。
//   見える範囲は行の守り（tickets_read）の上で読み、口でも消したもの（deleted_at）と他の人の下書きを外す（2 重・D-128.158）。
//   mine：担当者が自分（AI に任せているものも）か、自分が承認する（決めていない）もの（D-128.11・D-128.161）。all：見えるもの全部。
//   並び（sort・K-473）：付けなければ mine は期限の近い順（無いものは最後）→ 更新の新しい順 → id、all は更新の新しい順 → id。start_on は開始日、created_at は作った新しい順。
//   並びの表 SORTS（query.ts）から order by と続きの条件を組む。次の分は keyset（読んでいる間に動いても重ならない・鍵は [view, sort, …並びの値, id]）。
//   印は期限切れだけ（D-128.159）：日本時間の今日より前の期限で、段が完了でないもの。総数・数は返さない（D-144.3）。
//   絞り込み（K-472・K-473）：欄ごとの表 FILTERS（query.ts）が where の条件と値を足す。全部 AND・値は $9 から。
//   見せる欄（fields・K-473）：付けた欄だけ select と 1 件の鍵に足す（FIELDS）。
//   scope（チケットを置いたグループ { id, name, code }・K-560）は fields に関わらずいつも付ける（fields=scope は付けても同じ鍵 1 つ）。
//     自分に見えるグループだけ名前と頭文字を出し、担当・承認だけで見えるチケットの見えないグループは null（K-473 の守りのまま）。
//   select は 1 本（関門 C2・withTenant の接続 1 本）。ログに題名と q を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { todayJst } from "../create-ticket/input.js";
import {
  encodeCursor,
  parseListQuery,
  SORTS,
  type Cursor,
  type FieldKey,
  type ListQuery,
  type SortDef,
} from "./query.js";

interface ListRow {
  id: string;
  number: string;
  title: string;
  kind_id: string;
  kind_name: string;
  stage_id: string;
  stage_name: string;
  stage_key: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  delegated_to_clone: boolean;
  due_on: string | null;
  /** 並びの主の値の文字（date の並びは日付か infinity・stamp の並びは時刻）。次の分の鍵に入れる */
  sort_key: string;
  overdue: boolean;
  updated_at: Date;
  updated_key: string;
  parent_ticket_id: string | null;
  depth: number;
  /** チケットを置いたグループ（K-560・いつも付く。見えないグループは null） */
  scope: { id: string; name: string; code: string | null } | null;
  /** 見せる欄（fields）で足した列（f_<名前>） */
  [extra: `f_${string}`]: unknown;
}

// $1 mine か・$2 今日（日本時間）・$3 題名の LIKE・$4 番号・$5 グループ・$6 鍵の並びの値（jsonb の配列）・$7 鍵の id・$8 読む件数（limit + 1）
// 並び：既定の mine は索引 tickets_list_mine_idx（tenant_id, coalesce(due_on, infinity), updated_at desc, id）、all は tickets_list_all_idx と同じ式にする
//   （式が索引と違うと索引で並べられず、毎回会社のチケットを全部並べ直す）。start_on・created_at の並びは索引が無い（会社のチケット全部を並べ直す）。
//   並びの式・続きの条件は SORTS の固定の字だけで組む（問い合わせの字を SQL に入れない）。続きの条件は並びと同じ式で比べる
const BASE_PARAMS = 8;
const cursorVal = (i: number) => `($6::jsonb ->> ${i})`;
const orderBy = (d: SortDef, p: "t" | "p") =>
  `${p === "t" ? d.expr : "p.sort_key"} ${d.dir}${d.tieUpdated ? `, ${p}.updated_at desc` : ""}, ${p}.id asc`;
/** この並びで鍵より後ろの行だけ（主の値 → 同じなら更新の新しい順 → id） */
function afterCursor(d: SortDef): string {
  const op = d.dir === "asc" ? ">" : "<";
  const v0 = `${cursorVal(0)}::${d.kind === "date" ? "date" : "timestamptz"}`;
  const idAfter = "t.id > $7::uuid";
  if (!d.tieUpdated) return `(${d.expr} ${op} ${v0} or (${d.expr} = ${v0} and ${idAfter}))`;
  const v1 = `${cursorVal(1)}::timestamptz`;
  return `(${d.expr} ${op} ${v0} or (${d.expr} = ${v0} and (t.updated_at < ${v1} or (t.updated_at = ${v1} and ${idAfter}))))`;
}
/** チケットを置いたグループ { id, name, code }（K-560・いつも選ぶ）。自分に見えるグループだけ（scopes の行の守りは会社の中の全員に読ませるので
 *  visible_scopes で絞る・見えなければ null）。code は頭文字 ticket_prefix（空文字・null はどちらも null） */
const SCOPE_EXPR =
  "(select jsonb_build_object('id', sc.id, 'name', sc.name, 'code', nullif(sc.ticket_prefix, '')) from scopes sc where sc.id = t.scope_id and sc.id = any(visible_scopes(app.user_id())))";
/** 見せる欄の select の式（鍵の名前 → 式）。scope はいつも選ぶので、ここでは足さない（extraFields が外す） */
const FIELDS: Readonly<Record<FieldKey, string>> = {
  start_on: "t.start_on::text",
  priority: "t.priority",
  estimate_minutes: "t.estimate_minutes",
  actual_minutes: "t.actual_minutes",
  scope: SCOPE_EXPR,
};
/** fields のうち、いつも付ける scope を除いた物（同じ鍵を 2 つ選ばない） */
const extraFields = (fields: readonly FieldKey[]): FieldKey[] => fields.filter((k) => k !== "scope");

/** 絞り込みの欄の条件を where の最後（order by の前）に足す。conds は表が返した条件（値は $9 から） */
const sqlFor = (d: SortDef, fields: readonly FieldKey[], conds: readonly string[]): string => `
with recursive scope_down(id) as (
  select s.id from scopes s where $5::uuid is not null and s.id = $5::uuid
  union all
  select s.id from scopes s join scope_down d on s.parent_id = d.id
),
page as (
  select t.id, t.number, t.title, t.kind_id, t.stage_id, t.assignee_member_id, t.delegated_to_clone, t.due_on,
         ${d.expr} as sort_key, t.updated_at, t.parent_ticket_id, ${SCOPE_EXPR} as scope${extraFields(fields)
           .map((k) => `,\n         ${FIELDS[k]} as f_${k}`)
           .join("")}
    from tickets t
   where t.tenant_id = app.tenant_id()
     and t.deleted_at is null
     and app.ticket_draft_ok(t.draft_import_id, app.user_id())
     and (not $1::boolean
          or t.assignee_member_id = app.user_id()
          or exists (select 1 from approvals a
                      where a.ticket_id = t.id and a.tenant_id = t.tenant_id and a.approver_member_id = app.user_id()
                        and a.decision is null and a.withdrawn_at is null and a.deleted_at is null))
     and ($3::text is null
          or lower(normalize(t.title, NFKC)) like $3::text escape '\\'
          or lower(t.number) = $4::text)
     and ($5::uuid is null or t.scope_id in (select id from scope_down))
     and ($7::uuid is null or ${afterCursor(d)})${conds.map((c) => `\n     and (${c})`).join("")}
   order by ${orderBy(d, "t")}
   limit $8
)
select p.id, p.number, p.title, k.id as kind_id, k.name as kind_name, s.id as stage_id, s.name as stage_name, s.key as stage_key,
       m.id as assignee_id, m.display_name as assignee_name, p.delegated_to_clone,
       p.due_on::text as due_on, ${d.kind === "date" ? "p.sort_key::text" : "to_json(p.sort_key) #>> '{}'"} as sort_key,
       (p.due_on is not null and p.due_on < $2::date and s.key is distinct from 'done') as overdue,
       p.updated_at, to_json(p.updated_at) #>> '{}' as updated_key, p.parent_ticket_id,
       (select count(*)::int from (
          with recursive up(id, parent_id, n) as (
            select p.id, p.parent_ticket_id, 1
            union all
            select x.id, x.parent_ticket_id, up.n + 1 from tickets x join up on x.id = up.parent_id where up.n < 5
          ) select 1 from up) a) as depth, p.scope${extraFields(fields)
            .map((k) => `,\n       p.f_${k}`)
            .join("")}
  from page p
  join ticket_kinds k on k.id = p.kind_id
  join ticket_stages s on s.id = p.stage_id
  left join members m on m.id = p.assignee_member_id
 order by ${orderBy(d, "p")}`;

/** 文と値。表の欄が積んだ値は $9 から（積む順＝番号の順） */
const build = (q: ListQuery, today: string): { text: string; values: unknown[] } => {
  const c: Cursor | null = q.cursor;
  const pushed: unknown[] = [];
  const add = (v: unknown): string => {
    pushed.push(v);
    return `$${BASE_PARAMS + pushed.length}`;
  };
  const conds = q.filters.map((f) => f.def.sql(f.value, add)).filter((x): x is string => x !== null);
  return {
    text: sqlFor(SORTS[q.sort], q.fields, conds),
    values: [
      q.view === "mine",
      today,
      q.titleLike,
      q.number,
      q.scopeId,
      c ? JSON.stringify(c.vals) : null,
      c?.id ?? null,
      q.limit + 1,
      ...pushed,
    ],
  };
};

const toItem = (r: ListRow, fields: readonly FieldKey[]) => ({
  id: r.id,
  number: r.number,
  title: r.title,
  kind: { id: r.kind_id, name: r.kind_name },
  stage: { id: r.stage_id, name: r.stage_name, key: r.stage_key },
  assignee: r.assignee_id ? { id: r.assignee_id, display_name: r.assignee_name ?? "" } : null,
  delegated_to_clone: r.delegated_to_clone,
  due_on: r.due_on,
  overdue: r.overdue,
  updated_at: r.updated_at.toISOString(),
  parent_ticket_id: r.parent_ticket_id,
  depth: r.depth,
  scope: r.scope ?? null,
  ...Object.fromEntries(extraFields(fields).map((k) => [k, r[`f_${k}`] ?? null])),
});

const nextCursor = (q: ListQuery, last: ListRow): string =>
  encodeCursor({
    view: q.view,
    sort: q.sort,
    vals: SORTS[q.sort].tieUpdated ? [last.sort_key, last.updated_key] : [last.sort_key],
    id: last.id,
  });

/** 形に合うのに今の状態では読めない続きの鍵：409・E-LST-001（欄なし・DB に行かない）。画面は鍵なしで最初から読み直す */
function unreadableCursor(): HookReply {
  const e = new KanameError("E-LST-001");
  return { status: e.status, body: e.toJSON() };
}

function invalid(
  code: "VALIDATION_ERROR" | "E-VAL-017" | "E-VAL-018",
  details: { field: string; message: string }[],
): HookReply {
  if (code === "VALIDATION_ERROR") return { status: 422, body: { error: "validation_failed", code, details } };
  const e = new KanameError(code);
  const field = details[0]?.field ?? "body";
  return {
    status: e.status,
    body: { ...e.toJSON(), field, details: details.map((d) => ({ field: d.field, message: e.entry.message })) },
  };
}

export function createTicketListHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    listTickets: {
      before: async (a: HookArgs) => {
        const parsed = parseListQuery(a.c.req.query());
        if (!parsed.ok) return parsed.code === "E-LST-001" ? unreadableCursor() : invalid(parsed.code, parsed.details);
        const q = parsed.value;
        const { text, values } = build(q, todayJst());
        const rows = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<ListRow>(text, values)).rows);
        const page = rows.slice(0, q.limit);
        const more = rows.length > q.limit;
        return {
          status: 200,
          body: {
            data: page.map((r) => toItem(r, q.fields)),
            meta: { next_cursor: more ? nextCursor(q, page[page.length - 1]!) : null },
          },
        };
      },
    },
  };
}
