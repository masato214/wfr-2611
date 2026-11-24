// 下書きをやめる口（K-679・契約の口 discardKnowledgeDraft・DELETE /api/v1/knowledge_pages/:id/draft）。
//   見えない → 404・書けない → 403・自分の生きている下書きの版が無い → 409 E-KNW-030。下書きの版に消した印（行は残す）。
//   まだ 1 度も書き終えていないページ（state draft）はページにも消した印（ページごと消える）。証跡は同じ取引。答え 200 { id, page_deleted }
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflict, forbidden, notFound } from "./reply.js";
import { auditPage, draftFailure, readMyDraft, readPage } from "./draft-shape.js";

const DROP_VERSION_SQL =
  "update knowledge_page_versions set deleted_at = now(), updated_by = app.user_id() where id = $1";
// ページごと消すのは DB の関数（行の守りが消したページを見せないので、アプリの接続の update では断られる・K-681）
const DROP_PAGE_SQL = "select app.kn_page_soft_delete($1, true)";

export function createDiscardKnowledgeDraft(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      return await withTenant(appPool, a.ctx, async (cl): Promise<HookReply> => {
        const page = await readPage(cl, a.id!);
        if (!page) return notFound();
        if (!page.writable) return forbidden();
        const mine = await readMyDraft(cl, page.id);
        if (!mine) return conflict("E-KNW-030");
        await cl.query(DROP_VERSION_SQL, [mine]);
        const pageDeleted = page.state === "draft";
        if (pageDeleted) await cl.query(DROP_PAGE_SQL, [page.id]);
        await auditPage(cl, "knowledge.draft.discard", page.id);
        return { status: 200, body: { data: { id: page.id, page_deleted: pageDeleted } } };
      });
    } catch (e) {
      return draftFailure(e, "下書きをやめられなかった");
    }
  };
}
