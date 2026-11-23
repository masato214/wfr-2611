// 保存した検索条件の答えの形と、行を読む文の共通の部品（K-475・D-128.83）。一覧・保存（K-476 の直す・消すも）が同じ形で答える。
//   13 個の鍵ちょうど。表の列（tenant_id・created_by・updated_by・deleted_at）は読まない・出さない。
//   mine＝作った人が呼んだ人。can_edit＝mine か、グループの全員に見せた条件でそのグループのマネージャーかつ saved_views の edit を持つ人
//   （K-476 の入口の行の確かめ app.manages_scope と、行の守りの update の has_permission の積と同じ）

/** 行を読む文（saved_views v と作った人 m）。後ろに where・order by を続けて使う。行の守りの中（withTenant）で流す */
export const SAVED_VIEW_SELECT = `
select v.id, v.name, v.share, v.scope_id, v.filters, v.columns, v.density, v.member_id, m.display_name as member_name,
       (v.member_id = app.user_id()) as mine,
       (v.member_id = app.user_id()
         or (v.share = 'group' and app.manages_scope(v.scope_id) and has_permission(app.user_id(), 'saved_views', v.scope_id, 'edit'))) as can_edit,
       v.created_at, v.updated_at
  from saved_views v
  left join members m on m.id = v.member_id`;

export interface SavedViewRow {
  id: string;
  name: string;
  share: "self" | "group";
  scope_id: string | null;
  filters: Record<string, unknown>;
  columns: string[];
  density: "normal" | "compact";
  member_id: string;
  member_name: string | null;
  mine: boolean;
  can_edit: boolean;
  created_at: Date;
  updated_at: Date;
}
export interface SavedView {
  id: string;
  name: string;
  share: "self" | "group";
  scope_id: string | null;
  filters: Record<string, unknown>;
  columns: string[];
  density: "normal" | "compact";
  member_id: string;
  member_name: string;
  mine: boolean;
  can_edit: boolean;
  created_at: Date;
  updated_at: Date;
}

/** 行 → 答えの 13 個の鍵 */
export function toSavedView(row: SavedViewRow): SavedView {
  return {
    id: row.id,
    name: row.name,
    share: row.share,
    scope_id: row.scope_id,
    filters: row.filters,
    columns: row.columns,
    density: row.density,
    member_id: row.member_id,
    member_name: row.member_name ?? "",
    mine: row.mine,
    can_edit: row.can_edit,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
