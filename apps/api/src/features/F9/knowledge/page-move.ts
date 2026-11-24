// ページを動かす・並びを変える口（K-681・契約の口 updateKnowledgePage・PATCH /api/v1/knowledge_pages/:id）。
//   見えない（無い・消した・別の会社・他人の自分の棚・他人の書き終えていないページ）→ 404・書けない → 403・承認待ちの頼み → 409 E-KNW-011。
//   フォルダ：null は棚の直下・見えない・無い・消した → 404・見えるが別の棚 → 409 E-KNW-052。並びを送らずにフォルダを替えたら新しい置き場の最後。
//   何も変わらなければ書かない（証跡も残さない）。ページの行に錠をかけてから確かめて書く。DB の失敗は 503。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { checkKnowledgeInput } from "./input.js";
import { conflict, forbidden, notFound, unavailable } from "./reply.js";
import { PAGE_COLS, nextPagePosition, readPlaceOf, toPageStub, type DraftPageRow } from "./draft-shape.js";
import { moveBlocker } from "./page-guards/index.js";

/** 見える・書けるの読み（錠なし。書けない人は錠の文で行が見えないので、先に分ける） */
export const SEEN_PAGE_SQL = `select app.kpage_writable(p.id) as writable from knowledge_pages p
 where p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null
   and p.state in ('draft', 'published') and app.kpage_visible(p.id)`;
export const LOCK_PAGE_SQL = `select ${PAGE_COLS}, p.position from knowledge_pages p
 where p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null for update`;
const FOLDER_SQL = `select f.scope_id, f.is_personal, f.owner_member_id from knowledge_folders f
 where f.id = $1 and f.tenant_id = app.tenant_id() and f.deleted_at is null and app.kfolder_visible(f.id)`;
const MOVE_SQL = `with p as (
  update knowledge_pages set folder_id = $2, position = $3, updated_by = app.user_id()
   where id = $1 and tenant_id = app.tenant_id() and deleted_at is null
  returning *) select ${PAGE_COLS} from p`;

const AUDIT_SQL = "select app.record_audit($1, 'knowledge_pages', $2, 'C2', '{}'::jsonb)";

/** 動かす・消すの証跡（題名を入れない） */
export async function auditPageEdit(
  cl: pg.PoolClient,
  action: "knowledge.page.move" | "knowledge.page.delete",
  pageId: string,
): Promise<void> {
  await cl.query(AUDIT_SQL, [action, pageId]);
}

type Locked = DraftPageRow & { position: number };
interface MoveInput {
  folder_id?: string | null;
  position?: number;
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

/** 見えて書けるページに錠をかけて読む。断りの答えか行 */
export async function lockWritablePage(cl: pg.PoolClient, id: string): Promise<HookReply | Locked> {
  const seen = (await cl.query<{ writable: boolean }>(SEEN_PAGE_SQL, [id])).rows[0];
  if (!seen) return notFound();
  if (seen.writable !== true) return forbidden();
  return (await cl.query<Locked>(LOCK_PAGE_SQL, [id])).rows[0] ?? notFound();
}

/** 動かす先のフォルダを確かめる。断りの答えか null（通る） */
async function checkFolder(cl: pg.PoolClient, page: Locked, folderId: string): Promise<HookReply | null> {
  const f = (
    await cl.query<{ scope_id: string; is_personal: boolean; owner_member_id: string }>(FOLDER_SQL, [folderId])
  ).rows[0];
  if (!f) return notFound();
  const same =
    f.scope_id === page.scope_id &&
    f.is_personal === page.is_personal &&
    (!f.is_personal || f.owner_member_id === page.owner_member_id);
  return same ? null : conflict("E-KNW-052");
}

async function run(cl: pg.PoolClient, id: string, input: MoveInput): Promise<HookReply> {
  const page = await lockWritablePage(cl, id);
  if ("status" in page) return page;
  const blocked = await moveBlocker(cl, page);
  if (blocked) return conflict(blocked);
  const moving = input.folder_id !== undefined;
  const folderId = moving ? (input.folder_id ?? null) : page.folder_id;
  if (moving && folderId) {
    const stop = await checkFolder(cl, page, folderId);
    if (stop) return stop;
  }
  const position =
    input.position ??
    (folderId !== page.folder_id
      ? await nextPagePosition(cl, { scopeId: page.scope_id, isPersonal: page.is_personal }, folderId)
      : page.position);
  if (folderId === page.folder_id && position === page.position)
    return { status: 200, body: { data: toPageStub(page, await readPlaceOf(cl, page)) } };
  const row = (await cl.query<DraftPageRow>(MOVE_SQL, [id, folderId, position])).rows[0];
  if (!row) return notFound();
  await auditPageEdit(cl, "knowledge.page.move", id);
  return { status: 200, body: { data: toPageStub(row, await readPlaceOf(cl, row)) } };
}

export function createUpdateKnowledgePage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkKnowledgeInput("updateKnowledgePage", a.input);
    if (bad) return bad;
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, a.id!, a.input as MoveInput));
    } catch (e) {
      const msg = (e as { message?: unknown })?.message;
      if (typeof msg === "string" && msg.startsWith("KNW_FOLDER_SHELF")) return conflict("E-KNW-052");
      console.error(`[knowledge] ページを動かせなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
