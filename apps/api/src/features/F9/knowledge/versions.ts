// 前の版を読む口 2 本（K-677・契約の口 listKnowledgeVersions・getKnowledgePageVersion）。読むだけ。
//   先にページが見えるかを確かめ（見えなければ 404）、公開した版（kind = 'published'・消していない）だけを読む。下書きの版はどの番号でも 404。
//   一覧は版の番号の大きい順だけで並べ、200 行で切る（切ったらログに 1 行・題名は出さない）。取引は 1 つ・文は 2 つ
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { invalid, notFound, unavailable } from "./reply.js";
import { VISIBLE_PAGE_WHERE } from "./read.js";

/** 版の一覧で返す行の上限 */
export const VERSIONS_MAX = 200;

const SEEN_SQL = `select 1 as ok from knowledge_pages p where ${VISIBLE_PAGE_WHERE}`;
const COLS = `v.version, v.published_at, (select m.display_name from members m where m.id = v.published_by) as by_name`;
const PUBLISHED = `v.page_id = $1 and v.tenant_id = app.tenant_id() and v.kind = 'published' and v.deleted_at is null`;
const LIST_SQL = `select ${COLS} from knowledge_page_versions v where ${PUBLISHED} order by v.version desc limit $2`;
const ONE_SQL = `select ${COLS}, v.body from knowledge_page_versions v where ${PUBLISHED} and v.version = $2`;

interface VersionRow {
  version: number;
  published_at: Date;
  by_name: string | null;
  body?: unknown;
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);
const toItem = (r: VersionRow) => ({
  version: r.version,
  published_at: r.published_at.toISOString(),
  by_name: r.by_name ?? null,
});

/** ページが見えれば fn を流す。見えなければ null */
const ifSeen = <T>(
  appPool: pg.Pool,
  ctx: TenantContext,
  id: string,
  fn: (cl: pg.PoolClient) => Promise<T>,
): Promise<T | null> =>
  withTenant(appPool, ctx, async (cl) => ((await cl.query(SEEN_SQL, [id])).rows.length > 0 ? fn(cl) : null));

/** 契約が書く問い合わせ（cursor・limit）の形。道に :id のある口は入口の一覧の確かめを通らないので、ここで同じ形を見る（契約 fuzz ST201）。
 *  並びと上限は変えない（全部を新しい順に・VERSIONS_MAX 行で切る） */
const badQuery = (a: HookArgs): HookReply | null => {
  const limit = a.c.req.query("limit");
  if (
    limit !== undefined &&
    limit !== "" &&
    !(/^[0-9]{1,3}$/.test(limit) && Number(limit) >= 1 && Number(limit) <= VERSIONS_MAX)
  )
    return invalid("limit", `1〜${VERSIONS_MAX}`);
  const cursor = a.c.req.query("cursor");
  if (cursor !== undefined && cursor !== "" && !/^[0-9]{1,9}$/.test(cursor)) return invalid("cursor", "不正");
  return null;
};

export function createListKnowledgeVersions(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = badQuery(a);
    if (bad) return bad;
    let rows: VersionRow[] | null;
    try {
      rows = await ifSeen(
        appPool,
        a.ctx,
        a.id!,
        async (cl) => (await cl.query<VersionRow>(LIST_SQL, [a.id, VERSIONS_MAX + 1])).rows,
      );
    } catch (e) {
      console.error(`[knowledge] 版の一覧を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!rows) return notFound();
    if (rows.length > VERSIONS_MAX) console.warn(`[knowledge] 版の一覧を ${VERSIONS_MAX} 行で切った`);
    const data = rows.slice(0, VERSIONS_MAX).map(toItem);
    return { status: 200, body: { data, meta: { count: data.length } } };
  };
}

export function createGetKnowledgePageVersion(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const v = Number(a.c.req.param("v"));
    if (!Number.isInteger(v) || v < 1) return notFound();
    let row: VersionRow | undefined | null;
    try {
      row = await ifSeen(appPool, a.ctx, a.id!, async (cl) => (await cl.query<VersionRow>(ONE_SQL, [a.id, v])).rows[0]);
    } catch (e) {
      console.error(`[knowledge] 前の版を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!row) return notFound();
    return { status: 200, body: { data: { ...toItem(row), body: row.body } } };
  };
}
