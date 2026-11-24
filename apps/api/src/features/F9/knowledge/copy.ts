// 写して直す口（K-690・契約の口 copyKnowledgePage・POST /api/v1/knowledge_pages/:id/copy・201 KnowledgePageStub）。
//   1 つの取引で：見える（404）→ 公開済み（409 E-KNW-010）→ 自分の棚でない（409 E-KNW-080）→ 入れるフォルダは自分の棚のフォルダ（404）
//   → 元の公開の最新の版の本文を読む → 自分の棚に下書きでページを作る（copied_from_page_id に元）→ 版 1 を下書きで入れてすぐ公開にする
//   → ページを公開済みにする → 証跡。元は何も変えない。必ず守るの印は写さない。DB の失敗は 503。ログに題名・本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { checkKnowledgeInput } from "./input.js";
import { conflict, notFound, unavailable } from "./reply.js";
import { resolveShelf, type ShelfRef } from "./shelf.js";
import { PAGE_COLS, nextPagePosition, readPage, readPlaceOf, toPageStub, type DraftPageRow } from "./draft-shape.js";

const FOLDER_SQL = `select 1 from knowledge_folders f
 where f.id = $1 and f.tenant_id = app.tenant_id() and f.deleted_at is null
   and f.is_personal and f.owner_member_id = app.user_id() and f.scope_id = $2 and app.kfolder_visible(f.id)`;
const BODY_SQL = `select v.body from knowledge_page_versions v
 where v.page_id = $1 and v.tenant_id = app.tenant_id() and v.kind = 'published' and v.deleted_at is null
 order by v.version desc limit 1`;
const INSERT_SQL = `insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, title, summary, is_must,
                             folder_id, position, copied_from_page_id, current_version, created_by, updated_by)
  values (app.tenant_id(), $1, true, app.user_id(), 'draft', $2, $3, false, $4, $5, $6, 0, app.user_id(), app.user_id())
  returning id`;
const VERSION_SQL = `insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, created_by, updated_by)
  values (app.tenant_id(), $1, 1, 'draft', $2::jsonb, app.user_id(), app.user_id(), app.user_id()) returning id`;
const PUBLISH_VERSION_SQL = `update knowledge_page_versions
   set kind = 'published', published_at = now(), published_by = app.user_id(), updated_by = app.user_id()
 where id = $1`;
const PUBLISH_PAGE_SQL = `with p as (
  update knowledge_pages set state = 'published', current_version = 1, updated_by = app.user_id()
   where id = $1 returning *) select ${PAGE_COLS} from p`;
const AUDIT_SQL = "select app.record_audit('knowledge.page.copy', 'knowledge_pages', $1, 'C2', '{}'::jsonb)";

interface CopyInput {
  folder_id?: string | null;
}

/** 入れるフォルダが自分の棚のフォルダか（ほかの棚のフォルダ・無い・消した・別の会社は偽） */
async function myFolder(cl: pg.PoolClient, shelf: ShelfRef, folderId: string): Promise<boolean> {
  return (await cl.query(FOLDER_SQL, [folderId, shelf.scopeId])).rows.length > 0;
}

/** 確かめてから書く。断りは何も書かずに返す */
async function copyIn(cl: pg.PoolClient, srcId: string, folderId: string | null): Promise<HookReply> {
  const src = await readPage(cl, srcId);
  if (!src) return notFound();
  if (src.state !== "published") return conflict("E-KNW-010");
  if (src.is_personal) return conflict("E-KNW-080");
  const shelf = await resolveShelf(cl, { shelf: "me" });
  if (!shelf) return notFound();
  if (folderId && !(await myFolder(cl, shelf, folderId))) return notFound();
  const body = (await cl.query<{ body: unknown }>(BODY_SQL, [src.id])).rows[0]?.body;
  if (body === undefined) return conflict("E-KNW-010");
  const position = await nextPagePosition(cl, shelf, folderId);
  const id = (
    await cl.query<{ id: string }>(INSERT_SQL, [
      shelf.scopeId,
      src.title,
      src.summary ?? "",
      folderId,
      position,
      src.id,
    ])
  ).rows[0]!.id;
  const versionId = (await cl.query<{ id: string }>(VERSION_SQL, [id, JSON.stringify(body)])).rows[0]!.id;
  await cl.query(PUBLISH_VERSION_SQL, [versionId]);
  const row = (await cl.query<DraftPageRow>(PUBLISH_PAGE_SQL, [id])).rows[0]!;
  await cl.query(AUDIT_SQL, [id]);
  return { status: 201, body: { data: toPageStub(row, await readPlaceOf(cl, row)) } };
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

/** 取引の外で受けた例外：引き金の競り負け（棚・所属）は写せる物が無い扱いで 404、それ以外は 503（ログに種類だけ） */
function copyFailure(e: unknown): HookReply {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("KNW_FOLDER_SHELF") || msg.startsWith("KNW_PERSONAL_SCOPE")) return notFound();
  console.error(`[knowledge] ページを写せなかった（${kindOf(e)}）`);
  return unavailable();
}

export function createCopyKnowledgePage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkKnowledgeInput("copyKnowledgePage", a.input);
    if (bad) return bad;
    const input = a.input as unknown as CopyInput;
    try {
      return await withTenant(appPool, a.ctx, (cl) => copyIn(cl, a.id!, input.folder_id ?? null));
    } catch (e) {
      return copyFailure(e);
    }
  };
}
