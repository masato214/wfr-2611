// ナレッジの棚を決める（K-675）：入力の shelf（company・group・me）と group_id から、置く棚（scope と自分の棚か）を決める。
//   会社＝会社のいちばん上のグループ（app.kn_company_scope）・自分＝今の人の主の所属（members.scope_id）で自分の棚・
//   グループ＝今の会社の、いちばん上でない消していないグループで、今の人が見られる物（app.kn_shelf_readable）。
//   外れは null（口は 404＝在るかを漏らさない）。書けるか（403）は口が app.kn_shelf_writable などで決める。DB に書かない
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { ShelfKind } from "./shape.js";

export interface ShelfInput {
  readonly shelf: ShelfKind;
  readonly group_id?: string | null;
}
export interface ShelfRef {
  readonly kind: ShelfKind;
  readonly scopeId: string;
  readonly isPersonal: boolean;
  readonly groupId: string | null;
}

const COMPANY_SQL = "select app.kn_company_scope() as id";
const ME_SQL = "select m.scope_id as id from members m where m.id = app.user_id() and m.deleted_at is null";
const GROUP_SQL = `select s.id from scopes s
  where s.id = $1::uuid and s.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null
    and app.kn_shelf_readable(s.id, false, null)`;

const one = async (client: pg.PoolClient, sql: string, params: unknown[] = []): Promise<string | null> => {
  const r = await client.query<{ id: string | null }>(sql, params);
  return r.rows[0]?.id ?? null;
};

/** 棚を決める。決まらなければ null（口は 404） */
export async function resolveShelf(client: pg.PoolClient, input: ShelfInput): Promise<ShelfRef | null> {
  if (input.shelf === "company") {
    const id = await one(client, COMPANY_SQL);
    return id ? { kind: "company", scopeId: id, isPersonal: false, groupId: null } : null;
  }
  if (input.shelf === "me") {
    const id = await one(client, ME_SQL);
    return id ? { kind: "me", scopeId: id, isPersonal: true, groupId: null } : null;
  }
  if (input.shelf !== "group") return null;
  const g = input.group_id;
  if (typeof g !== "string" || !isUuid(g)) return null;
  const id = await one(client, GROUP_SQL, [g]);
  return id ? { kind: "group", scopeId: id, isPersonal: false, groupId: id } : null;
}
