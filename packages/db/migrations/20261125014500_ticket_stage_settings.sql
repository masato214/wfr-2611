-- 20261125014500 状態（作業の段）の設定（K-705・D-125.38・D-125.66・D-152.18・D-152.31・関門 C2）
--   ① 色の列 color_key（見分けの色 8 つの鍵）と、key から初めの色を入れる関数・引き金（新しい会社の初めの段にも入る。app.ticket_basics は作り直さない）
--   ② 名前の一意（同じ会社の消していない段）。前からの重なりは名前に（2）（3）を付けてから索引を作る（仕組みの段の名前は残す）
--   ③ 並びの振り直し app.ticket_stage_renumber と、書く関数 4 本 app.ticket_stage_create / update / delete / reorder
--      どれも 権限（ticket_stages の edit）→ 形・状態の確かめ → 書く → 証跡（同じ取引）。断りは例外にせず { "error": "<言葉>" }（何も書かない）
--   始め（key が todo）・終わり（key が done）・仕組みの段（is_fixed）は消せない。仕組みの段は名前を変えない（前からの app.ticket_stage_fixed もそのまま）

-- ---------------------------------------------------------------- ① 色
alter table ticket_stages add column if not exists color_key text;

create or replace function app.ticket_stage_first_color(p_key text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_key
    when 'todo' then 'teal-light' when 'doing' then 'indigo' when 'hold' then 'plum' when 'checking' then 'teal'
    when 'awaiting_approval' then 'amber' when 'running' then 'coral' when 'done' then 'sage'
    else 'indigo' end
$$;

update ticket_stages set color_key = app.ticket_stage_first_color(key) where color_key is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ticket_stages_color_key_check') then
    alter table ticket_stages add constraint ticket_stages_color_key_check
      check (color_key in ('indigo', 'teal', 'amber', 'coral', 'sage', 'plum', 'lavender', 'teal-light'));
  end if;
end $$;

create or replace function app.ticket_stage_color_default() returns trigger language plpgsql as $$
begin
  if new.color_key is null then new.color_key := app.ticket_stage_first_color(new.key); end if;
  return new;
end $$;
drop trigger if exists ticket_stages_color_default on ticket_stages;
create trigger ticket_stages_color_default before insert on ticket_stages for each row execute function app.ticket_stage_color_default();
-- 引き金が埋めるので not null にできる（今ある行は上の update で埋めた。ticket_stages は 1 社 8 行ほどの小さな表）
-- squawk-ignore adding-not-nullable-field
alter table ticket_stages alter column color_key set not null;

-- ---------------------------------------------------------------- ② 名前の一意
--   前からの重なり（同じ会社・消していない・同じ名前）は、2 行目以降の作業の段の名前に（2）（3）…を付ける（仕組みの段の名前を先に残す・20 字の check に収める）
with dup as (
  select id, row_number() over (partition by tenant_id, name order by is_fixed desc, position, id) as n
  from ticket_stages where deleted_at is null
)
update ticket_stages s set name = left(s.name, 16) || '（' || dup.n || '）'
from dup where dup.id = s.id and dup.n > 1 and not s.is_fixed;
create unique index if not exists ticket_stages_name_uq on ticket_stages (tenant_id, name) where deleted_at is null;

-- ---------------------------------------------------------------- ③ 振り直しと書く関数
create or replace function app.ticket_stage_renumber(p_tenant uuid) returns void
language sql security definer set search_path = public, app, pg_temp as $$
  update ticket_stages s set position = r.n * 10
  from (select id, row_number() over (order by position, id) as n from ticket_stages where tenant_id = p_tenant and deleted_at is null) r
  where r.id = s.id and s.position is distinct from r.n * 10
$$;

-- 答えの 1 行（鍵 6・口の toStageSetting と同じ）
create or replace function app.ticket_stage_row(s ticket_stages) returns jsonb
language sql immutable set search_path = public, app, pg_temp as $$
  select jsonb_build_object('id', s.id, 'key', s.key, 'name', s.name, 'color_key', s.color_key, 'position', s.position,
    'lock', case when s.key = 'todo' then 'start' when s.key = 'done' then 'end' when s.is_fixed then 'system' end)
$$;

-- 名前の確かめ：前後の空白（全角・タブ・改行）を落とし 1〜20 字（NUL は jsonb に入らず入口が 422）。外れは null
create or replace function app.ticket_stage_clean_name(p jsonb) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case when jsonb_typeof(p) = 'string'
              and char_length(btrim(p #>> '{}', E' \t\r\n\f\v　')) between 1 and 20
         then btrim(p #>> '{}', E' \t\r\n\f\v　') end
$$;

create or replace function app.ticket_stage_valid_color(p jsonb) returns boolean
language sql immutable set search_path = public, app, pg_temp as $$
  select jsonb_typeof(p) = 'string' and (p #>> '{}') in ('indigo', 'teal', 'amber', 'coral', 'sage', 'plum', 'lavender', 'teal-light')
$$;

create or replace function app.ticket_stage_can_edit() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(has_permission(app.user_id(), 'ticket_stages', null, 'edit'), false)
$$;

create or replace function app.ticket_stage_create(p_name text, p_color_key text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_name text := app.ticket_stage_clean_name(to_jsonb(p_name));
  v_end int;
  s ticket_stages%rowtype;
begin
  if not app.ticket_stage_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if v_name is null then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
  if not app.ticket_stage_valid_color(to_jsonb(p_color_key)) then return jsonb_build_object('error', 'invalid', 'field', 'color_key'); end if;
  perform 1 from ticket_stages where tenant_id = v_tenant and deleted_at is null for update;
  if exists (select 1 from ticket_stages where tenant_id = v_tenant and deleted_at is null and name = v_name) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  if (select count(*) from ticket_stages where tenant_id = v_tenant and deleted_at is null and not is_fixed) >= 8 then
    return jsonb_build_object('error', 'limit');
  end if;
  select position into v_end from ticket_stages where tenant_id = v_tenant and deleted_at is null and key = 'done';
  insert into ticket_stages (tenant_id, name, color_key, position, created_by, updated_by)
    values (v_tenant, v_name, p_color_key, coalesce(v_end, 1000) - 1, app.user_id(), app.user_id())
    returning * into s;
  perform app.ticket_stage_renumber(v_tenant);
  select * into s from ticket_stages where id = s.id;
  perform app.record_audit('ticket_stage.create', 'ticket_stages', s.id::text, 'C2', jsonb_build_object('stage_id', s.id));
  return jsonb_build_object('data', app.ticket_stage_row(s));
end $$;

create or replace function app.ticket_stage_update(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_name text;
  s ticket_stages%rowtype;
begin
  if not app.ticket_stage_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or not (p_patch ? 'name' or p_patch ? 'color_key') then
    return jsonb_build_object('error', 'invalid', 'field', 'body');
  end if;
  if p_patch ? 'name' then
    v_name := app.ticket_stage_clean_name(p_patch->'name');
    if v_name is null then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
  end if;
  if p_patch ? 'color_key' and not app.ticket_stage_valid_color(p_patch->'color_key') then
    return jsonb_build_object('error', 'invalid', 'field', 'color_key');
  end if;
  select * into s from ticket_stages where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_name is not null and v_name <> s.name then
    if s.is_fixed then return jsonb_build_object('error', 'name_locked'); end if;
    if exists (select 1 from ticket_stages where tenant_id = v_tenant and deleted_at is null and name = v_name and id <> s.id) then
      return jsonb_build_object('error', 'name_taken');
    end if;
  end if;
  update ticket_stages set
    name = coalesce(v_name, name),
    color_key = coalesce(p_patch->>'color_key', color_key),
    updated_by = app.user_id()
  where id = s.id returning * into s;
  perform app.record_audit('ticket_stage.update', 'ticket_stages', s.id::text, 'C2', jsonb_build_object('stage_id', s.id));
  return jsonb_build_object('data', app.ticket_stage_row(s));
end $$;

create or replace function app.ticket_stage_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_count int;
  s ticket_stages%rowtype;
begin
  if not app.ticket_stage_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  select * into s from ticket_stages where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if s.is_fixed or s.key in ('todo', 'done') then return jsonb_build_object('error', 'locked_delete'); end if;
  select count(*) into v_count from tickets where stage_id = s.id;   -- 消したチケットも数える（ゴミ箱から戻した物が行き場を失わない）
  if v_count > 0 then return jsonb_build_object('error', 'in_use', 'ticket_count', v_count); end if;
  update ticket_stages set deleted_at = now(), updated_by = app.user_id() where id = s.id;
  perform app.ticket_stage_renumber(v_tenant);
  perform app.record_audit('ticket_stage.delete', 'ticket_stages', s.id::text, 'C2', jsonb_build_object('stage_id', s.id));
  return jsonb_build_object('data', jsonb_build_object('id', s.id));
end $$;

create or replace function app.ticket_stage_reorder(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_live uuid[];
  v_n int := coalesce(array_length(p_ids, 1), 0);
begin
  if not app.ticket_stage_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if v_n = 0 or array_position(p_ids, null) is not null then return jsonb_build_object('error', 'invalid', 'field', 'stage_ids'); end if;
  select array_agg(id order by position, id) into v_live from (
    select id, position from ticket_stages where tenant_id = v_tenant and deleted_at is null for update) x;
  if v_n <> coalesce(array_length(v_live, 1), 0)
     or (select count(distinct x) from unnest(p_ids) x) <> v_n
     or exists (select 1 from unnest(p_ids) x where x <> all (v_live)) then
    return jsonb_build_object('error', 'order_mismatch');
  end if;
  if (select key from ticket_stages where id = p_ids[1]) is distinct from 'todo'
     or (select key from ticket_stages where id = p_ids[v_n]) is distinct from 'done' then
    return jsonb_build_object('error', 'order_ends');
  end if;
  update ticket_stages s set position = o.n * 10, updated_by = app.user_id()
  from unnest(p_ids) with ordinality as o(id, n)
  where s.id = o.id and s.position is distinct from o.n * 10;
  perform app.record_audit('ticket_stage.reorder', 'ticket_stages', v_tenant::text, 'C2', jsonb_build_object('stage_ids', to_jsonb(p_ids)));
  return jsonb_build_object('data', (
    select coalesce(jsonb_agg(app.ticket_stage_row(s) order by s.position, s.id), '[]'::jsonb)
    from ticket_stages s where s.tenant_id = v_tenant and s.deleted_at is null));
end $$;

revoke all on function app.ticket_stage_renumber(uuid), app.ticket_stage_can_edit(),
  app.ticket_stage_create(text, text), app.ticket_stage_update(uuid, jsonb), app.ticket_stage_delete(uuid), app.ticket_stage_reorder(uuid[])
  from public;
grant execute on function app.ticket_stage_first_color(text), app.ticket_stage_row(ticket_stages), app.ticket_stage_clean_name(jsonb),
  app.ticket_stage_valid_color(jsonb), app.ticket_stage_can_edit(),
  app.ticket_stage_create(text, text), app.ticket_stage_update(uuid, jsonb), app.ticket_stage_delete(uuid), app.ticket_stage_reorder(uuid[])
  to kaname_app;

insert into app.schema_migrations (name) values ('20261125014500_ticket_stage_settings.sql') on conflict do nothing;
