// グループの概要を読む口（K-477）：getScopeOverview（GET /api/v1/scopes/:id/overview）。読むだけ（書かない・知らせない・証跡を残さない）。
//   見える範囲は 2 段（K-92 の一覧と同じく、行の守りの上で読み、口の文でも同じ条件を書く＝2 重）：
//     ①そのグループが呼んだ人に見えるか：同じ会社・消していない・visible_scopes(自分)（席のグループとその下・view か edit の権限が付いたグループとその下）に入る。入らなければ 404 E-PAGE-001（存在を教えない・件数も返さない）
//     ②数える・並べるのは、見えるグループとその下のグループのチケットのうち、消していない・他の人の取り込みの下書きでない物
//   答え：by_stage（会社の状態を位置の順に全部・0 件も）・milestones（節目の開始日・終わりの日の列がまだ無いのでいつも空・D-125.64・D-151.10）・
//         recent（直近 14 日のやり取りを、チケットごとに最新の 1 行にまとめ、新しい順に 10 件まで）・total（内訳の合計）
//   1 つの取引（withTenant）の中で文は 3 つ（見えるか・内訳・最近の更新）。本文の 80 文字の切りは SQL の中で行う。ログに題名・本文・番号を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

/** 最近の更新に入れるやり取りの窓（日）・件数・本文の長さ。仮の数字（K-477・PM の決め。変えるときは試験の行 008・009・011 の数字も一緒に変える） */
const RECENT_DAYS = 14;
const RECENT_MAX = 10;
const TEXT_MAX = 80;

interface StageRow {
  id: string;
  key: string | null;
  name: string;
  n: number;
}
interface RecentRow {
  ticket_id: string;
  number: string;
  title: string;
  at: Date;
  by_id: string | null;
  by_name: string | null;
  kind: string;
  text: string;
  cnt: number;
}

// 見えるグループ（$1）とその下のグループ。消したグループはたどらない
const DOWN = `
with recursive down(id) as (
  select s.id from scopes s where s.id = $1::uuid and s.tenant_id = app.tenant_id() and s.deleted_at is null
  union all
  select c.id from scopes c join down d on c.parent_id = d.id where c.deleted_at is null
),
t as (
  select tk.id, tk.number, tk.title, tk.stage_id
    from tickets tk
   where tk.tenant_id = app.tenant_id()
     and tk.deleted_at is null
     and app.ticket_draft_ok(tk.draft_import_id, app.user_id())
     and tk.scope_id in (select id from down)
)`;

const VISIBLE_SQL = `
select exists (
  select 1 from scopes s
   where s.id = $1::uuid and s.tenant_id = app.tenant_id() and s.deleted_at is null
     and s.id = any(visible_scopes(app.user_id()))
) as ok`;

const BY_STAGE_SQL = `${DOWN}
select s.id, s.key, s.name, coalesce(c.n, 0)::int as n
  from ticket_stages s
  left join (select stage_id, count(*) as n from t group by stage_id) c on c.stage_id = s.id
 where s.tenant_id = app.tenant_id() and s.deleted_at is null
 order by s.position, s.name, s.id`;

// 同じチケットはいちばん新しい 1 行にまとめ（count は窓の中の件数）、新しい順（同じ時刻はチケット id の順）に 10 件まで。
// 本文は SQL の中で先頭 80 文字に切る（81 文字以上は「…」を付ける・文字の数で数える）。本文が無い（null）ときは空の字
const RECENT_SQL = `${DOWN},
m as (
  select m.ticket_id, m.created_at, m.author_member_id, m.kind,
         case when char_length(coalesce(m.body, '')) > ${TEXT_MAX} then left(m.body, ${TEXT_MAX}) || '…' else coalesce(m.body, '') end as text,
         count(*) over (partition by m.ticket_id)::int as cnt,
         row_number() over (partition by m.ticket_id order by m.created_at desc, m.id desc) as rn
    from ticket_messages m
    join t on t.id = m.ticket_id
   where m.tenant_id = app.tenant_id()
     and m.deleted_at is null
     and m.created_at >= now() - interval '${RECENT_DAYS} days'
)
select t.id as ticket_id, t.number, t.title, m.created_at as at, a.id as by_id, a.display_name as by_name, m.kind, m.text, m.cnt
  from m
  join t on t.id = m.ticket_id
  left join members a on a.id = m.author_member_id
 where m.rn = 1
 order by m.created_at desc, t.id asc
 limit ${RECENT_MAX}`;

/** 見つからない（無い・消した・席の木の外は同じ答え。件数も返さない・存在を教えない）。画面は状態コード 404 で出し分ける */
const notFound = (): HookReply => ({ status: 404, body: kanameError("E-PAGE-001").toJSON() });

export function createGetScopeOverview(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const scopeId = a.id;
    if (!scopeId) return notFound();
    const data = await withTenant(appPool, a.ctx, async (cl) => {
      const visible = (await cl.query<{ ok: boolean }>(VISIBLE_SQL, [scopeId])).rows[0]?.ok === true;
      if (!visible) return null;
      const stages = (await cl.query<StageRow>(BY_STAGE_SQL, [scopeId])).rows;
      const recent = (await cl.query<RecentRow>(RECENT_SQL, [scopeId])).rows;
      return { stages, recent };
    });
    if (!data) return notFound();
    return {
      status: 200,
      body: {
        data: {
          by_stage: data.stages.map((s) => ({ stage: { id: s.id, key: s.key, name: s.name }, count: s.n })),
          milestones: [],
          recent: data.recent.map((r) => ({
            ticket: { id: r.ticket_id, number: r.number, title: r.title },
            at: r.at.toISOString(),
            by: r.by_id ? { id: r.by_id, display_name: r.by_name ?? "" } : null,
            kind: r.kind,
            text: r.text,
            count: r.cnt,
          })),
          total: data.stages.reduce((sum, s) => sum + s.n, 0),
        },
      },
    };
  };
}
