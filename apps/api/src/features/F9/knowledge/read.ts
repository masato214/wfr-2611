// ページを読む口（K-677・契約の口 getKnowledgePage・GET /api/v1/knowledge_pages/:id）。読むだけ（DB に書かない・お知らせも AI も呼ばない）。
//   見られないページ（app.kpage_visible が偽・消した・state が draft／published でない・別の会社・無い id）は 404（体は error と code だけ）。
//   答えは土台 3.1 の 15 鍵。帯の操作・頼みの帯・上げる先・共有された側の帯は page-parts/（後ろの葉が中身を差し替える）。
//   取引は 1 つ（withTenant）・文は 4〜6（ページ・版・部品）。ログに題名・本文を出さない
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { notFound, unavailable } from "./reply.js";
import { KNOWLEDGE_MUST_TEXT_MAX, toPlace, type ShelfKind } from "./shape.js";
import { readPageParts } from "./page-parts/index.js";
import type { PageRow } from "./page-parts/types.js";

/** 見えるページを読む条件（版の口と同じ）。$1＝ページの id */
export const VISIBLE_PAGE_WHERE = `p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null
   and p.state in ('draft', 'published') and app.kpage_visible(p.id)`;

/** ① ページの行と棚・置き場・書けるか */
const PAGE_SQL = `select p.id, p.title, p.summary, p.state, p.is_must, p.is_personal, p.scope_id, p.owner_member_id,
       p.folder_id, p.copied_from_page_id, p.current_version, p.updated_at,
       app.kn_shelf_kind(p.scope_id, p.is_personal) as shelf_kind,
       app.kn_shelf_name(p.scope_id, p.is_personal) as shelf_name,
       case when p.folder_id is null then '{}'::text[] else app.kn_folder_names(p.folder_id) end as folders,
       app.kpage_writable(p.id) as writable
  from knowledge_pages p
 where ${VISIBLE_PAGE_WHERE}`;

/** ② 最新の公開の版（本文と字数）と、自分の生きている下書きの版（本文と保存の時刻） */
const VERSIONS_SQL = `select pub.body as pub_body, char_length(coalesce(pub.body->>'text', '')) as pub_len,
       dr.body as draft_body, dr.updated_at as draft_saved
  from (select 1) x
  left join lateral (select v.body from knowledge_page_versions v
                      where v.page_id = $1 and v.tenant_id = app.tenant_id() and v.kind = 'published' and v.deleted_at is null
                      order by v.version desc limit 1) pub on true
  left join lateral (select v.body, v.updated_at from knowledge_page_versions v
                      where v.page_id = $1 and v.tenant_id = app.tenant_id() and v.kind = 'draft' and v.deleted_at is null
                        and v.author_member_id = app.user_id()
                      order by v.version desc limit 1) dr on true`;

type Row = PageRow & { shelf_kind: ShelfKind; shelf_name: string; folders: string[]; writable: boolean };
interface Body {
  readonly doc: unknown;
  readonly text: string;
}
interface Versions {
  pub_body: Body | null;
  pub_len: number | null;
  draft_body: Body | null;
  draft_saved: Date | null;
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

async function load(appPool: pg.Pool, ctx: TenantContext, id: string): Promise<Record<string, unknown> | null> {
  return withTenant(appPool, ctx, async (cl) => {
    const row = (await cl.query<Row>(PAGE_SQL, [id])).rows[0];
    if (!row) return null;
    const v = (await cl.query<Versions>(VERSIONS_SQL, [id])).rows[0]!;
    const groupId = row.shelf_kind === "group" ? row.scope_id : null;
    const parts = await readPageParts({
      cl,
      memberId: ctx.userId ?? "",
      page: row,
      shelf: { kind: row.shelf_kind, name: row.shelf_name, groupId },
      writable: row.writable === true,
    });
    const published = row.state === "published";
    const tooLong = published && !row.is_must && Number(v.pub_len ?? 0) > KNOWLEDGE_MUST_TEXT_MAX;
    return {
      id: row.id,
      title: row.title,
      desc: row.summary ?? "",
      state: row.state,
      must: row.is_must,
      must_blocked: tooLong ? "too_long" : null,
      place: toPlace(row.shelf_kind, row.shelf_name, groupId, row.folder_id, row.folders),
      acts: parts.acts,
      body: published ? v.pub_body : v.draft_body,
      draft: v.draft_body
        ? {
            title: row.title,
            desc: row.summary ?? "",
            doc: v.draft_body.doc,
            saved_at: (v.draft_saved ?? row.updated_at).toISOString(),
          }
        : null,
      request: parts.request,
      copied_from: parts.copied_from,
      shared_from: parts.shared_from,
      raise_to: parts.raise_to,
      foot: parts.foot,
    };
  });
}

export function createGetKnowledgePage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let data: Record<string, unknown> | null;
    try {
      data = await load(appPool, a.ctx, a.id!);
    } catch (e) {
      console.error(`[knowledge] ページを読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!data) return notFound();
    return { status: 200, body: { data } };
  };
}
