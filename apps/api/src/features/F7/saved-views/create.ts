// 保存した検索条件を保存する口（K-475・契約の口 createSavedView・POST /api/v1/saved_views・D-128.83・D-151.9・関門 C2）。
//   入力の確かめ（名前・share・条件・列・density）は前処理（input.ts の input）が済ませた体で来る。作った人は呼んだ人に決まる（member_id は受けない）。
//   1 つの取引の中で：① その人ごとの助言ロック（同時の 2 回押しが数と名前の確かめをすり抜けない）
//     ② 見せるグループ（scope_id・自分だけの保存に付けた物も）が同じ会社・消していない・自分に見えるかを確かめ、違えば 404 E-VWS-004（在るかを教えない）
//     ③ 消していない自分の物が 50 件以上なら 409 E-VWS-006 ④ 同じ名前（大文字小文字を区別しない・消した物は数えない）があれば 409 E-VWS-005
//     ⑤ 行を入れて同じ形で読む ⑥ 証跡 saved_views.create（C2・中身は share だけ。名前・条件は残さない）。
//   最後の砦：一意の索引 saved_views_name_uq の 23505 は 409 E-VWS-005。書く所で DB が落ちたら 503 E-PAGE-003（1 つの取引なので何も残らない・11-22 18:30 の決め）。
//   知らせは出さない（受け箱にも書かず、メールも出さない）。ログに名前と条件を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { kanameError } from "@kaname/errors";
import { fail } from "./input.js";
import { SAVED_VIEW_SELECT, toSavedView, type SavedViewRow } from "./shape.js";

/** 1 人が持てる保存した条件の数（消していない物・仮・K-475） */
export const MAX_PER_PERSON = 50;
const NAME_INDEX = "saved_views_name_uq";

const LOCK_SQL = "select pg_advisory_xact_lock(hashtextextended('saved_views:' || app.user_id()::text, 0))";
const SCOPE_SQL = `select exists (
  select 1 from scopes where id = $1 and tenant_id = app.tenant_id() and deleted_at is null
     and $1 = any(visible_scopes(app.user_id()))) as ok`;
const COUNT_SQL =
  "select count(*)::int as n from saved_views where member_id = app.user_id() and tenant_id = app.tenant_id() and deleted_at is null";
const SAME_NAME_SQL = `select exists (
  select 1 from saved_views where member_id = app.user_id() and tenant_id = app.tenant_id() and deleted_at is null
     and lower(name) = lower($1)) as taken`;
const INSERT_SQL = `insert into saved_views (tenant_id, member_id, name, share, scope_id, filters, columns, density, created_by, updated_by)
values (app.tenant_id(), app.user_id(), $1, $2, $3, $4::jsonb, $5::jsonb, $6, app.user_id(), app.user_id())
returning id`;
const ONE_SQL = `${SAVED_VIEW_SELECT} where v.id = $1`;
const AUDIT_SQL = "select app.record_audit('saved_views.create', 'saved_views', $1, 'C2', $2::jsonb)";

interface Checked {
  name: string;
  share: "self" | "group";
  scopeId: string | null;
  filters: Record<string, unknown>;
  columns: string[];
  density: "normal" | "compact";
}

/** 前処理の済んだ体 → 既定の値を入れた形（share self・filters {}・columns []・density normal・scope_id なし） */
function fromInput(i: Record<string, unknown>): Checked {
  return {
    name: String(i["name"]),
    share: i["share"] === "group" ? "group" : "self",
    scopeId: typeof i["scope_id"] === "string" ? i["scope_id"] : null,
    filters: (i["filters"] as Record<string, unknown> | undefined) ?? {},
    columns: (i["columns"] as string[] | undefined) ?? [],
    density: i["density"] === "compact" ? "compact" : "normal",
  };
}

const isNameTaken = (e: unknown): boolean => {
  const x = e as { code?: unknown; constraint?: unknown } | null;
  return x?.code === "23505" && x.constraint === NAME_INDEX;
};

export function createCreateSavedView(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const v = fromInput(a.input);
    try {
      return await withTenant(appPool, a.ctx, async (cl): Promise<HookReply> => {
        await cl.query(LOCK_SQL);
        if (v.scopeId !== null) {
          const seen = (await cl.query<{ ok: boolean }>(SCOPE_SQL, [v.scopeId])).rows[0]?.ok === true;
          if (!seen) return fail("E-VWS-004");
        }
        const count = (await cl.query<{ n: number }>(COUNT_SQL)).rows[0]?.n ?? 0;
        if (count >= MAX_PER_PERSON) return fail("E-VWS-006");
        const taken = (await cl.query<{ taken: boolean }>(SAME_NAME_SQL, [v.name])).rows[0]?.taken === true;
        if (taken) return fail("E-VWS-005", "name");
        const made = await cl.query<{ id: string }>(INSERT_SQL, [
          v.name,
          v.share,
          v.scopeId,
          JSON.stringify(v.filters),
          JSON.stringify(v.columns),
          v.density,
        ]);
        const id = made.rows[0]!.id;
        await cl.query(AUDIT_SQL, [id, JSON.stringify({ share: v.share })]);
        const row = (await cl.query<SavedViewRow>(ONE_SQL, [id])).rows[0]!;
        return { status: 201, body: { data: toSavedView(row) } };
      });
    } catch (e) {
      if (isNameTaken(e)) return fail("E-VWS-005", "name");
      // 書く所で DB が落ちた（1 つの取引なので何も残らない）：止める側に倒して 503 E-PAGE-003（11-22 18:30 の決め）。ログは場所と例外の種類だけ
      console.error(`[saved-views] 保存した条件を保存する：書けなかった（${(e as Error)?.name ?? "Error"}）`);
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };
}
