-- 20261125012500 必ず守るの上限（K-685・契約の口 setKnowledgeMust・D-152.10・D-152.16・関門 C2）
--   ① 製品共通の設定の表 knowledge_limits（会社の列を持たない・role_bundle_defaults〔0080〕と同じ形）② 既定の 3 行（会社 30・グループ 20・自分 10）
--   ③ アプリの役は読むだけ（行の守りは同じ名前の policies・gen_rls.py が作る）④ 関数 app.kn_must_limit・app.kn_must_set。
--   運営が数を変えるときは migration か管理者の接続で行を直す（会社の管理者が変える画面は作らない）。
--   同じ migration をもう 1 度当てても壊れない形にする（if not exists・on conflict do nothing・create or replace）。

-- ---------------------------------------------------------------- ① 設定の表
create table if not exists knowledge_limits (
  shelf text primary key check (shelf in ('company', 'group', 'me')),   -- 棚の種類（app.kn_shelf_kind と同じ言葉）
  must_max integer not null check (must_max >= 0)                       -- その棚 1 つに付けられる必ず守るの数
);

-- ---------------------------------------------------------------- ② 既定の 3 行
insert into knowledge_limits (shelf, must_max) values ('company', 30), ('group', 20), ('me', 10)
  on conflict do nothing;

-- ---------------------------------------------------------------- ③ 権限と行の守り（読むだけ・書けない）
grant select on knowledge_limits to kaname_app;
-- 既定の権限（0002 の alter default privileges）で付いた書く権限を外す。書く道は migration と管理者の接続だけ（K685-DB-001）
revoke insert, update, delete, truncate on knowledge_limits from kaname_app;
alter table knowledge_limits enable row level security;
alter table knowledge_limits force row level security;

-- ---------------------------------------------------------------- ④ 関数
-- 棚の種類の上限（知らない種類は null）。キャッシュしない（行を直したら次の呼びから効く）
create or replace function app.kn_must_limit(p_kind text) returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select l.must_max from knowledge_limits l where l.shelf = p_kind
$$;

-- 必ず守るを付ける・外す（呼ぶ人の行の守りがそのまま効く＝security invoker）。答えは jsonb：
--   { ok: false, reason: denied | draft | too_long | full（limit・shelf_name・pages 付き） } ／ { ok: true, changed, must, used, limit }
--   棚ごとの錠を取ってからページの行を読み直すので、同時に付けても上限を超えない。数える前に字数を見る
create or replace function app.kn_must_set(p_page uuid, p_must boolean) returns jsonb
language plpgsql security invoker set search_path = public, app, pg_temp as $$
declare
  pg_row record;
  lim integer;
  n integer;
  body_len integer;
  pages jsonb;
begin
  if not app.kpage_writable(p_page) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  select p.scope_id, p.is_personal, p.owner_member_id into pg_row from knowledge_pages p
   where p.id = p_page and p.tenant_id = app.tenant_id() and p.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'knowledge_must:' || app.tenant_id()::text || ':' || pg_row.scope_id::text || ':' || pg_row.is_personal::text || ':'
      || case when pg_row.is_personal then pg_row.owner_member_id::text else '' end, 0));
  select p.id, p.state, p.is_must, p.scope_id, p.is_personal, p.owner_member_id into pg_row from knowledge_pages p
   where p.id = p_page and p.tenant_id = app.tenant_id() and p.deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if pg_row.state <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'draft');
  end if;
  lim := app.kn_must_limit(app.kn_shelf_kind(pg_row.scope_id, pg_row.is_personal));
  select count(*) into n from knowledge_pages p
   where p.tenant_id = app.tenant_id() and p.deleted_at is null and p.is_must
     and p.scope_id = pg_row.scope_id and p.is_personal = pg_row.is_personal
     and (not pg_row.is_personal or p.owner_member_id = pg_row.owner_member_id);
  if pg_row.is_must = p_must then
    return jsonb_build_object('ok', true, 'changed', false, 'must', p_must, 'used', n, 'limit', lim);
  end if;
  if p_must then
    select char_length(coalesce(v.body->>'text', '')) into body_len from knowledge_page_versions v
     where v.page_id = p_page and v.tenant_id = app.tenant_id() and v.kind = 'published' and v.deleted_at is null
     order by v.version desc limit 1;
    if coalesce(body_len, 0) > app.kn_must_text_max() then
      return jsonb_build_object('ok', false, 'reason', 'too_long');
    end if;
    if n >= lim then
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id, 'title', x.title,
               'folder', coalesce((select f[array_length(f, 1)] from (select app.kn_folder_names(x.folder_id) as f) y
                                    where x.folder_id is not null), ''))
             order by x.title collate "C", x.id), '[]'::jsonb)
        into pages
        from knowledge_pages x
       where x.tenant_id = app.tenant_id() and x.deleted_at is null and x.is_must
         and x.scope_id = pg_row.scope_id and x.is_personal = pg_row.is_personal
         and (not pg_row.is_personal or x.owner_member_id = pg_row.owner_member_id);
      return jsonb_build_object('ok', false, 'reason', 'full', 'limit', lim,
        'shelf_name', app.kn_shelf_name(pg_row.scope_id, pg_row.is_personal), 'pages', pages);
    end if;
  end if;
  update knowledge_pages set is_must = p_must, updated_by = app.user_id()
   where id = p_page and tenant_id = app.tenant_id() and deleted_at is null;
  return jsonb_build_object('ok', true, 'changed', true, 'must', p_must,
    'used', n + case when p_must then 1 else -1 end, 'limit', lim);
end $$;

revoke execute on function app.kn_must_limit(text), app.kn_must_set(uuid, boolean) from public;
grant execute on function app.kn_must_limit(text), app.kn_must_set(uuid, boolean) to kaname_app;
