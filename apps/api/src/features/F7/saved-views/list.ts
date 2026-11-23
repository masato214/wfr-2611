// 保存した検索条件の一覧の口（K-475）：listSavedViews。読むだけ（DB に書かない・知らせない）。
//   見えるのは、自分が作った物と、グループの全員に見せた物のうち自分に見えるグループの物。消した物は出さない。
//   見える範囲は 2 重：行の守り（saved_views_read）の上で読み、口の文でも同じ条件で絞る（消した物は口の文だけが外す）。
//   問い合わせ：share（self・group）・scope_id（uuid・入口が形を確かめる）・limit・cursor（入口の共通の形だけ・口は全部を返す）。知らない名前は黙って無視せず 422。
//   並び：名前の順（同じ名前は作った順）。上限 500 行（501 行読み、超えたら切ってログに 1 行）。ログに名前と条件を出さない。
//   取引は 1 つ（withTenant）・文は 1 つ。readSavedViews は K-465 の getShell も同じ文で呼ぶ
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { isUuid } from "@kaname/contracts";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { invalid, SHARES } from "./input.js";
import { SAVED_VIEW_SELECT, toSavedView, type SavedView, type SavedViewRow } from "./shape.js";

/** 一覧で返す行の上限 */
export const LIST_MAX = 500;
const KNOWN = new Set(["share", "scope_id", "limit", "cursor"]);

const LIST_SQL = `${SAVED_VIEW_SELECT}
 where v.tenant_id = app.tenant_id() and v.deleted_at is null
   and (v.member_id = app.user_id() or (v.share = 'group' and v.scope_id = any(visible_scopes(app.user_id()))))
   and ($1::text is null or v.share = $1)
   and ($2::uuid is null or v.scope_id = $2)
 order by v.name, v.created_at, v.id
 limit ${LIST_MAX + 1}`;

/** 見える保存した条件を名前の順に読む（行の守りの中の接続で）。share・scope_id で絞れる（null は絞らない）。500 行を超えたら切ってログに 1 行 */
export async function readSavedViews(
  client: pg.PoolClient,
  share: string | null,
  scopeId: string | null,
): Promise<SavedView[]> {
  const rows = (await client.query<SavedViewRow>(LIST_SQL, [share, scopeId])).rows;
  if (rows.length > LIST_MAX) console.warn(`[saved-views] 一覧を ${LIST_MAX} 行で切った`);
  return rows.slice(0, LIST_MAX).map(toSavedView);
}

/** 問い合わせを確かめる。空の値は指定なし。知らない名前・share の外・uuid でない scope_id は 422（欄はその名前） */
function parseQuery(raw: Record<string, string>): { share: string | null; scopeId: string | null } | HookReply {
  const unknown = Object.keys(raw).filter((k) => !KNOWN.has(k));
  if (unknown.length)
    return {
      status: 422,
      body: {
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: unknown.map((field) => ({ field, message: "受け付けない問い合わせ" })),
      },
    };
  const share = raw["share"] ?? "";
  if (share !== "" && !(SHARES as readonly string[]).includes(share)) return invalid("share", SHARES.join("／"));
  const scope = raw["scope_id"] ?? "";
  if (scope !== "" && !isUuid(scope)) return invalid("scope_id", "uuid");
  return { share: share === "" ? null : share, scopeId: scope === "" ? null : scope };
}

export function createListSavedViews(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const q = parseQuery(a.c.req.query());
    if ("status" in q) return q;
    try {
      const data = await withTenant(appPool, a.ctx, (cl) => readSavedViews(cl, q.share, q.scopeId));
      return { status: 200, body: { data, meta: { limit: LIST_MAX } } };
    } catch (e) {
      // 一覧を読む所の DB の失敗：止める側に倒す（503・E-PAGE-003・D-136.1）。ログは場所と例外の種類だけ（名前と条件を出さない）
      console.error(`[saved_views] 一覧を読む所で失敗した（${(e as Error)?.name ?? "Error"}）`);
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };
}
