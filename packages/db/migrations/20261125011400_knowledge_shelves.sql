-- 20261125011400 ナレッジの置き場（K-674・D-152.1・D-152.3・D-152.14〜.16・D-128.50〜.52・関門 C2）
--   棚は 3 つ：会社（いちばん上のグループ・is_personal = false）／グループ（その scopes.id・is_personal = false）／自分（持ち主の主の所属・is_personal = true）。
--   書ける人：会社＝管理者／グループ＝そのグループのマネージャー／自分＝本人。読める人：会社＝社内の全員／グループ＝そのグループの人（共有は K-689）／自分＝本人。
--   権限の束（permissions・has_permission）はナレッジでは使わない。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 1 章。
--   ① knowledge_folders を作る ② knowledge_pages に 1 行の説明・必ず守る・写しの元・フォルダ・並び ③ 本文を {doc, text} に移して守る
--   ④ 版の一意を部分一意に ⑤ 見える／書けるの関数 ⑥ 同じ会社・同じ棚の引き金 ⑦ 行の守りは同じ名前の policies（gen_rls.py が作る）
--   使わない列（parent_page_id・form・verify_*・topics・archived_*・版の proposed_*・decision・decided_*）は消さずに残す（凍結は K-711）。
--   同じ migration をもう 1 度当てても壊れない形にする（if not exists・create or replace・drop … if exists・移しは合わない行だけ）。

-- ---------------------------------------------------------------- ① フォルダの表
create table if not exists knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),             -- 棚（会社＝いちばん上のグループ・グループ・自分＝持ち主の主の所属）
  is_personal boolean not null default false,               -- 自分の棚
  owner_member_id uuid not null references members(id),     -- 作った人（自分の棚では持ち主）
  parent_folder_id uuid references knowledge_folders(id),   -- 空＝棚の直下
  name text not null check (char_length(name) between 1 and 100),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (parent_folder_id is null or parent_folder_id <> id)
);
-- 同じ棚・同じ親の中で名前は重ならない（大文字小文字を分けず・消した物は数えず・自分の棚は持ち主ごと）
create unique index if not exists knowledge_folders_name_uq on knowledge_folders (
  tenant_id, scope_id, is_personal,
  coalesce(case when is_personal then owner_member_id end, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
) where deleted_at is null;
create index if not exists knowledge_folders_parent_idx on knowledge_folders (tenant_id, parent_folder_id);
create index if not exists knowledge_folders_scope_idx on knowledge_folders (tenant_id, scope_id);

-- ---------------------------------------------------------------- ② ページの列
-- 既定つきの列の追加：knowledge_pages は 1 社で多くても数百行の小さな表（書き換えが走っても短い）
-- squawk-ignore adding-field-with-default
alter table knowledge_pages add column if not exists summary text not null default '';
-- squawk-ignore adding-field-with-default
alter table knowledge_pages add column if not exists is_must boolean not null default false;
alter table knowledge_pages add column if not exists copied_from_page_id uuid references knowledge_pages(id);
alter table knowledge_pages add column if not exists folder_id uuid references knowledge_folders(id);
-- squawk-ignore adding-field-with-default
alter table knowledge_pages add column if not exists position int not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'knowledge_pages_summary_len') then
    alter table knowledge_pages add constraint knowledge_pages_summary_len check (char_length(summary) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'knowledge_pages_must_published') then
    alter table knowledge_pages add constraint knowledge_pages_must_published check (is_must = false or state = 'published');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'knowledge_pages_copied_not_self') then
    alter table knowledge_pages add constraint knowledge_pages_copied_not_self check (copied_from_page_id is null or copied_from_page_id <> id);
  end if;
end $$;
create index if not exists knowledge_pages_folder_idx on knowledge_pages (tenant_id, folder_id);

-- ---------------------------------------------------------------- ③ 本文の形：前の形（{}・{text}）を段落に移してから守る
--   文字を行ごとの段落にした {doc, text}（中身の無い行は content の無い段落・全部空なら content が空の配列）。text は渡した文字のまま
create or replace function app.kn_body_from_text(p text) returns jsonb
language sql immutable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'doc', jsonb_build_object('type', 'doc', 'content',
      case when bool_and(x.l = '') then '[]'::jsonb
           else jsonb_agg(case when x.l = '' then jsonb_build_object('type', 'paragraph')
                               else jsonb_build_object('type', 'paragraph', 'content',
                                      jsonb_build_array(jsonb_build_object('type', 'text', 'text', x.l))) end
                          order by x.n) end),
    'text', coalesce(p, ''))
  from regexp_split_to_table(coalesce(p, ''), E'\n') with ordinality as x(l, n)
$$;
update knowledge_page_versions set body = app.kn_body_from_text(body->>'text') where not app.ticket_body_valid(body);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'knowledge_page_versions_body_ok') then
    alter table knowledge_page_versions add constraint knowledge_page_versions_body_ok check (app.ticket_body_valid(body));
  end if;
end $$;

-- 必ず守るの本文の上限（字）。口の定数 KNOWLEDGE_MUST_TEXT_MAX（K-675）と同じ数
create or replace function app.kn_must_text_max() returns int
language sql immutable security definer set search_path = public, app, pg_temp as $$ select 2000 $$;

-- ---------------------------------------------------------------- ④ 版の一意：公開の版は (page, version)・生きている下書きの版は 1 ページに 1 つ
-- 前の一意 (page_id, kind, version) は捨てた下書きと同じ番号を作り直せないので外す（部分一意に替える）
-- squawk-ignore ban-drop-constraint
alter table knowledge_page_versions drop constraint if exists knowledge_page_versions_page_id_kind_version_key;
create unique index if not exists knowledge_page_versions_published_uq on knowledge_page_versions (page_id, version)
  where kind = 'published' and deleted_at is null;
create unique index if not exists knowledge_page_versions_one_draft_uq on knowledge_page_versions (page_id)
  where kind = 'draft' and deleted_at is null;

-- ---------------------------------------------------------------- ⑤ 見える・書けるの関数（毎回その時の所属から決める・行に写さない）
create or replace function app.kn_company_scope() returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select s.id from scopes s
  where s.tenant_id = app.tenant_id() and s.parent_id is null and s.deleted_at is null
  order by s.created_at, s.id limit 1
$$;

-- その人がそのグループに入っている（所属の行か主の所属）
create or replace function app.kn_in_group(uid uuid, g uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select uid is not null and g is not null and (
    exists (select 1 from scope_memberships sm
            where sm.member_id = uid and sm.scope_id = g and sm.tenant_id = app.tenant_id() and sm.deleted_at is null)
    or exists (select 1 from members m
               where m.id = uid and m.scope_id = g and m.tenant_id = app.tenant_id() and m.deleted_at is null))
$$;

-- 今の人の入っているグループ（会社のいちばん上は含めない）
create or replace function app.kn_my_groups() returns uuid[]
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(array_agg(distinct s.id), '{}'::uuid[]) from scopes s
  where s.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null
    and app.kn_in_group(app.user_id(), s.id)
$$;

-- そのグループのマネージャー（会社の所属が有効）
create or replace function app.kn_group_manager(uid uuid, g uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from scope_memberships sm
    join tenant_memberships tm on tm.member_id = sm.member_id and tm.tenant_id = sm.tenant_id
    where sm.member_id = uid and sm.scope_id = g and sm.tenant_id = app.tenant_id()
      and sm.role = 'manager' and sm.deleted_at is null
      and tm.status = 'active' and tm.deleted_at is null)
$$;

create or replace function app.kn_shelf_kind(scope uuid, personal boolean) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when personal then 'me'
              when (select s.parent_id is null from scopes s where s.id = scope) then 'company'
              else 'group' end
$$;

create or replace function app.kn_shelf_name(scope uuid, personal boolean) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when personal then '自分'
              when (select s.parent_id is null from scopes s where s.id = scope) then '会社'
              else (select s.name from scopes s where s.id = scope and s.tenant_id = app.tenant_id()) end
$$;

-- 棚が読める（共有は含めない）。棚の決めの唯一の正本（kpage_*・kfolder_*・行の守りがここを呼ぶ）
create or replace function app.kn_shelf_readable(scope uuid, personal boolean, owner uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(
    exists (select 1 from scopes s where s.id = scope and s.tenant_id = app.tenant_id())
    and exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is null)
    and case when personal then owner = app.user_id()
             when (select s.parent_id is null from scopes s where s.id = scope) then true
             else app.kn_in_group(app.user_id(), scope) end,
    false)
$$;

-- 棚に書ける
create or replace function app.kn_shelf_writable(scope uuid, personal boolean, owner uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(
    exists (select 1 from scopes s where s.id = scope and s.tenant_id = app.tenant_id())
    and exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is null)
    and case when personal then owner = app.user_id()
             when (select s.parent_id is null from scopes s where s.id = scope) then app.is_admin(app.user_id())
             else app.kn_group_manager(app.user_id(), scope) end,
    false)
$$;

-- 共有の器（K-674 では常に false。K-689 が create or replace で差し替える）
create or replace function app.kn_shared_visible(pid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$ select false $$;
create or replace function app.kn_shared_folder_visible(fid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$ select false $$;

-- ページが読める：下書きは持ち主／公開済みは棚が読めるか共有。消した物は読めない
create or replace function app.kpage_visible(pid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_pages p
    where p.id = pid and p.tenant_id = app.tenant_id() and p.deleted_at is null
      and case when p.state = 'draft' then p.owner_member_id = app.user_id()
               else app.kn_shelf_readable(p.scope_id, p.is_personal, p.owner_member_id) or app.kn_shared_visible(p.id) end)
$$;

-- ページに書ける：下書きは持ち主／公開済みは棚に書ける。消した物は書けない
create or replace function app.kpage_writable(pid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_pages p
    where p.id = pid and p.tenant_id = app.tenant_id() and p.deleted_at is null
      and case when p.state = 'draft' then p.owner_member_id = app.user_id()
               else app.kn_shelf_writable(p.scope_id, p.is_personal, p.owner_member_id) end)
$$;

create or replace function app.kfolder_visible(fid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_folders f
    where f.id = fid and f.tenant_id = app.tenant_id() and f.deleted_at is null
      and (app.kn_shelf_readable(f.scope_id, f.is_personal, f.owner_member_id) or app.kn_shared_folder_visible(f.id)))
$$;

create or replace function app.kfolder_writable(fid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_folders f
    where f.id = fid and f.tenant_id = app.tenant_id() and f.deleted_at is null
      and app.kn_shelf_writable(f.scope_id, f.is_personal, f.owner_member_id))
$$;

-- 棚の直下から数えたフォルダの名前の並び
create or replace function app.kn_folder_names(fid uuid) returns text[]
language sql stable security definer set search_path = public, app, pg_temp as $$
  with recursive up(id, parent, name, depth) as (
    select f.id, f.parent_folder_id, f.name, 1 from knowledge_folders f
    where f.id = fid and f.tenant_id = app.tenant_id()
    union all
    select f.id, f.parent_folder_id, f.name, up.depth + 1 from knowledge_folders f join up on f.id = up.parent
    where up.depth < 64
  )
  select coalesce(array_agg(name order by depth desc), '{}'::text[]) from up
$$;

revoke execute on function
  app.kn_body_from_text(text), app.kn_must_text_max(), app.kn_company_scope(), app.kn_in_group(uuid, uuid), app.kn_my_groups(),
  app.kn_group_manager(uuid, uuid), app.kn_shelf_kind(uuid, boolean), app.kn_shelf_name(uuid, boolean),
  app.kn_shelf_readable(uuid, boolean, uuid), app.kn_shelf_writable(uuid, boolean, uuid),
  app.kn_shared_visible(uuid), app.kn_shared_folder_visible(uuid), app.kpage_visible(uuid), app.kpage_writable(uuid),
  app.kfolder_visible(uuid), app.kfolder_writable(uuid), app.kn_folder_names(uuid)
  from public;
grant execute on function
  app.kn_body_from_text(text), app.kn_must_text_max(), app.kn_company_scope(), app.kn_in_group(uuid, uuid), app.kn_my_groups(),
  app.kn_group_manager(uuid, uuid), app.kn_shelf_kind(uuid, boolean), app.kn_shelf_name(uuid, boolean),
  app.kn_shelf_readable(uuid, boolean, uuid), app.kn_shelf_writable(uuid, boolean, uuid),
  app.kn_shared_visible(uuid), app.kn_shared_folder_visible(uuid), app.kpage_visible(uuid), app.kpage_writable(uuid),
  app.kfolder_visible(uuid), app.kfolder_writable(uuid), app.kn_folder_names(uuid)
  to kaname_app;

-- ---------------------------------------------------------------- ⑥ 引き金：同じ会社・同じ棚・自分の棚の所属。失敗の言葉は先頭の印（口が 409／404 に直す）
create or replace function app.knowledge_same_tenant() returns trigger language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j jsonb := to_jsonb(new); f record;
begin
  if tg_table_name in ('knowledge_pages', 'knowledge_folders') then
    if not exists (select 1 from scopes where id = new.scope_id and tenant_id = new.tenant_id) then
      raise exception '置き場は同じ会社のグループ' using errcode = '22023';
    end if;
    if (j->>'is_personal')::boolean
       and not exists (select 1 from members m where m.id = (j->>'owner_member_id')::uuid and m.scope_id = new.scope_id) then
      raise exception 'KNW_PERSONAL_SCOPE 自分の棚は持ち主の主の所属' using errcode = '22023';
    end if;
  end if;
  if tg_table_name = 'knowledge_folders' then
    if (j->>'parent_folder_id') is not null then
      select * into f from knowledge_folders where id = (j->>'parent_folder_id')::uuid;
      if not found or f.tenant_id <> new.tenant_id then
        raise exception '親フォルダは同じ会社のフォルダ' using errcode = '22023';
      end if;
      if f.scope_id <> new.scope_id or f.is_personal <> (j->>'is_personal')::boolean
         or ((j->>'is_personal')::boolean and f.owner_member_id <> (j->>'owner_member_id')::uuid) then
        raise exception 'KNW_FOLDER_SHELF 親フォルダは同じ棚' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;
  if tg_table_name = 'knowledge_pages' then
    if (j->>'parent_page_id') is not null and not exists (select 1 from knowledge_pages where id = (j->>'parent_page_id')::uuid and tenant_id = new.tenant_id) then
      raise exception '親ページは同じ会社のページ' using errcode = '22023';
    end if;
    if (j->>'archived_to_page_id') is not null and not exists (select 1 from knowledge_pages where id = (j->>'archived_to_page_id')::uuid and tenant_id = new.tenant_id) then
      raise exception '移し先は同じ会社のページ' using errcode = '22023';
    end if;
    if (j->>'copied_from_page_id') is not null and not exists (select 1 from knowledge_pages where id = (j->>'copied_from_page_id')::uuid and tenant_id = new.tenant_id) then
      raise exception '写しの元は同じ会社のページ' using errcode = '22023';
    end if;
    if (j->>'folder_id') is not null then
      select * into f from knowledge_folders where id = (j->>'folder_id')::uuid;
      if not found or f.tenant_id <> new.tenant_id then
        raise exception 'フォルダは同じ会社のフォルダ' using errcode = '22023';
      end if;
      if f.scope_id <> new.scope_id or f.is_personal <> (j->>'is_personal')::boolean
         or ((j->>'is_personal')::boolean and f.owner_member_id <> (j->>'owner_member_id')::uuid) then
        raise exception 'KNW_FOLDER_SHELF フォルダは同じ棚' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;
  if not exists (select 1 from knowledge_pages where id = coalesce((j->>'page_id')::uuid, (j->>'from_page_id')::uuid) and tenant_id = new.tenant_id) then
    raise exception '元のページと同じ会社の行だけ' using errcode = '22023';
  end if;
  if tg_table_name = 'knowledge_page_versions' and (j->>'proposed_from_ticket_id') is not null
     and not exists (select 1 from tickets where id = (j->>'proposed_from_ticket_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '直す案の出どころは同じ会社のチケット' using errcode = '22023';
  end if;
  return new;
end $$;

-- フォルダの循環と深さ（6 まで）。同じ会社・同じ棚の引き金より前に走る（名前の順：guard < same_tenant）
create or replace function app.knowledge_folder_guard() returns trigger language plpgsql security definer set search_path = public, app, pg_temp as $$
declare cur uuid := new.parent_folder_id; up_depth int := 0; sub_height int := 1; steps int := 0;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'KNW_FOLDER_CYCLE 親を自分か自分の下のフォルダにはできない' using errcode = '22023';
    end if;
    up_depth := up_depth + 1;
    steps := steps + 1;
    exit when steps > 64;
    select parent_folder_id into cur from knowledge_folders where id = cur;
  end loop;
  if tg_op = 'UPDATE' then
    with recursive down(id, h) as (
      select f.id, 2 from knowledge_folders f where f.parent_folder_id = new.id and f.deleted_at is null
      union all
      select f.id, down.h + 1 from knowledge_folders f join down on f.parent_folder_id = down.id
      where f.deleted_at is null and down.h < 64
    )
    select coalesce(max(h), 1) into sub_height from down;
  end if;
  if up_depth + sub_height > 6 then
    raise exception 'KNW_FOLDER_DEPTH フォルダの深さは 6 まで' using errcode = '22023';
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['knowledge_pages','knowledge_page_versions','knowledge_links','knowledge_folders'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.knowledge_same_tenant()', t, t);
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
  end loop;
end $$;
drop trigger if exists knowledge_folders_guard on knowledge_folders;
create trigger knowledge_folders_guard before insert or update of parent_folder_id on knowledge_folders
  for each row execute function app.knowledge_folder_guard();

-- ⑦ 行の守りは policies/20261125011400_knowledge_shelves.sql（gen_rls.py ← 05_flow/rls_policies.py）
insert into app.schema_migrations (name) values ('20261125011400_knowledge_shelves.sql') on conflict do nothing;
