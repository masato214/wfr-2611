// 下書きを保存する口（K-679・契約の口 saveKnowledgeDraft・PATCH /api/v1/knowledge_pages/:id/draft）。自動保存の頻度は画面（K-683）が決める。
//   見えない（無い・消した・別の会社・他人の自分の棚・他人の下書きのページ）→ 404・書けない → 403・本文の形が合わない → 422（欄 doc）。
//   断る分は書く前に決める。本文（doc）は入口の揃え（NFKC・前後の空白）を当てず、画面が送ったままの doc を確かめる（PM の決め・K-432 と同じ扱い）。
//   下書きの版：自分の物があれば直す・無ければ on conflict do nothing で入れ、戻りが空なら自分の物を読み直す（無ければ他人の下書き → 409 E-KNW-012）。
//   本文なしの保存（題名・説明だけ）も、自分の下書きの版が無く他人の下書きの版があれば 409 E-KNW-012 で何も変えない（app.kn_page_other_draft）。
//   題名・説明はページの列に直ちに書き、変わったときだけ証跡。本文だけの保存は証跡を残さない。ログに題名・本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { TicketBody } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { parseDocInput } from "./body.js";
import { checkKnowledgeInput } from "./input.js";
import { conflict, forbidden, invalid, notFound } from "./reply.js";
import { auditPage, draftFailure, readMyDraft, readPage, type DraftPageRow } from "./draft-shape.js";

const UPDATE_VERSION_SQL = `update knowledge_page_versions set body = $2::jsonb, updated_by = app.user_id()
 where id = $1 returning updated_at`;
const INSERT_VERSION_SQL = `insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, created_by, updated_by)
  values (app.tenant_id(), $1, $2, 'draft', $3::jsonb, app.user_id(), app.user_id(), app.user_id())
  on conflict (page_id) where kind = 'draft' and deleted_at is null do nothing returning updated_at`;
const RETITLE_SQL = `update knowledge_pages set title = $2, summary = $3, updated_by = app.user_id()
 where id = $1 and tenant_id = app.tenant_id() and deleted_at is null returning updated_at`;

const OTHER_DRAFT_SQL = `select app.kn_page_other_draft($1) as other`;

interface SaveInput {
  title?: string;
  desc?: string;
  doc?: unknown;
}

/** 画面が送ったままの doc（入口の揃えの前の体から読む） */
async function rawDoc(a: HookArgs): Promise<unknown> {
  const raw = (await a.c.req.json().catch(() => ({}))) as Record<string, unknown> | null;
  return raw && typeof raw === "object" ? raw["doc"] : undefined;
}

/** 本文なしの保存で、自分の下書きの版が無く他人の下書きの版がある（他人の下書きは行の守りで見えないので DB の関数で見る） */
async function blockedByOther(cl: pg.PoolClient, pageId: string): Promise<boolean> {
  if (await readMyDraft(cl, pageId)) return false;
  return (await cl.query<{ other: boolean }>(OTHER_DRAFT_SQL, [pageId])).rows[0]?.other === true;
}

/** 自分の下書きの版に本文を書く。他人の下書きに当たったら null */
async function writeDraft(cl: pg.PoolClient, page: DraftPageRow, body: TicketBody): Promise<Date | null> {
  const json = JSON.stringify(body);
  const mine = await readMyDraft(cl, page.id);
  if (mine) return (await cl.query<{ updated_at: Date }>(UPDATE_VERSION_SQL, [mine, json])).rows[0]!.updated_at;
  const ins = (await cl.query<{ updated_at: Date }>(INSERT_VERSION_SQL, [page.id, page.current_version + 1, json]))
    .rows[0];
  if (ins) return ins.updated_at;
  const again = await readMyDraft(cl, page.id); // 同じ人の別の画面が先に入れた
  if (!again) return null;
  return (await cl.query<{ updated_at: Date }>(UPDATE_VERSION_SQL, [again, json])).rows[0]!.updated_at;
}

export function createSaveKnowledgeDraft(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkKnowledgeInput("saveKnowledgeDraft", a.input);
    if (bad) return bad;
    const input = a.input as SaveInput;
    const hasDoc = input.doc !== undefined;
    const doc = hasDoc ? await rawDoc(a) : undefined;
    try {
      return await withTenant(appPool, a.ctx, async (cl): Promise<HookReply> => {
        const page = await readPage(cl, a.id!);
        if (!page) return notFound();
        if (!page.writable) return forbidden();
        let body: TicketBody | null = null;
        if (hasDoc) {
          const parsed = parseDocInput(doc);
          if (!parsed.ok) return invalid("doc", parsed.message);
          body = parsed.body;
        }
        let savedAt: Date = page.updated_at;
        if (body) {
          const at = await writeDraft(cl, page, body);
          if (!at) return conflict("E-KNW-012");
          savedAt = at;
        } else if (await blockedByOther(cl, page.id)) {
          return conflict("E-KNW-012");
        }
        const title = input.title ?? page.title;
        const desc = input.desc ?? page.summary ?? "";
        if (title !== page.title || desc !== (page.summary ?? "")) {
          const at = (await cl.query<{ updated_at: Date }>(RETITLE_SQL, [page.id, title, desc])).rows[0]!.updated_at;
          if (!body) savedAt = at;
          await auditPage(cl, "knowledge.page.retitle", page.id);
        }
        return { status: 200, body: { data: { saved_at: savedAt.toISOString(), title, desc } } };
      });
    } catch (e) {
      return draftFailure(e, "下書きを保存できなかった");
    }
  };
}
