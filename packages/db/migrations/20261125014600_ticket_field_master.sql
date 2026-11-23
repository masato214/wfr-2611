-- 20261125014600 項目のマスタを読む・足す（K-706・D-150.36・D-150.37・D-152.18・関門 C2）。表・列は作らない（K-563 の custom_fields・custom_field_kinds・ticket_field_values を使う）
--   ① app.ticket_field_settings：消していない項目を並びの順に、段 5 の鍵 7 ＋ kind_ids・all_kinds・value_count（鍵 10）で返す
--      種別の行が 1 つも無い（消した行も無い）前からの項目は all_kinds＝true・kind_ids＝今ある全部の種別（段 5 の listTicketFields と同じ規則・L-002）
--   ② app.ticket_field_options_build：選ぶ物の [{id, name, position}] を作る（K-717 も使う）
--   ③ app.ticket_field_kinds_set：種別の行を組の差で入れ替える（K-717 も使う）
--   ④ app.ticket_field_create：権限（custom_fields の edit）→ 形・状態の確かめ → 書く → 証跡（同じ取引）。断りは例外にせず { "error": "<言葉>" }（何も書かない）

-- 前後の空白（全角・タブ・改行）を落とした名前（1〜40 字）。外れは null
create or replace function app.ticket_field_clean_name(p text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case when char_length(btrim(coalesce(p, ''), E' \t\r\n\f\v　')) between 1 and 40
         then btrim(p, E' \t\r\n\f\v　') end
$$;

create or replace function app.ticket_field_can_edit() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(has_permission(app.user_id(), 'custom_fields', null, 'edit'), false)
$$;

create or replace function app.ticket_field_settings(p_only uuid default null) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  with live_kinds as (
    select id from ticket_kinds where tenant_id = app.tenant_id() and deleted_at is null
  ), f as (
    select cf.* from custom_fields cf
    where cf.tenant_id = app.tenant_id() and cf.deleted_at is null and (p_only is null or cf.id = p_only)
      and app.ticket_field_can_edit()   -- マスタ（種別の行・値の数）は custom_fields の edit を持つ人だけ
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'field_type', f.field_type, 'required', f.required, 'description', f.description,
      'options', case when f.field_type in ('select', 'multi_select') then coalesce(
                   (select jsonb_agg(jsonb_build_object('id', o->>'id', 'name', o->>'name', 'position', (o->>'position')::int)
                                     order by (o->>'position')::int, n)
                    from jsonb_array_elements(f.options) with ordinality as x(o, n)), '[]'::jsonb)
                 else '[]'::jsonb end,
      'position', f.position,
      'kind_ids', case when not exists (select 1 from custom_field_kinds k where k.field_id = f.id)
                   then coalesce((select jsonb_agg(lk.id order by lk.id) from live_kinds lk), '[]'::jsonb)
                   else coalesce((select jsonb_agg(k.kind_id order by k.kind_id) from custom_field_kinds k
                                  where k.field_id = f.id and k.deleted_at is null and k.kind_id in (select id from live_kinds)), '[]'::jsonb) end,
      'all_kinds', not exists (select 1 from custom_field_kinds k where k.field_id = f.id),
      'value_count', (select count(*) from ticket_field_values v where v.field_id = f.id and v.deleted_at is null)
    ) order by f.position, f.created_at, f.id), '[]'::jsonb)
  from f
$$;

-- 選ぶ物を組み立てる。p_new は [{id?, name}]。id が付いた物は今（p_current）に在る id だけ・付かない物は新しい id。
--   名前は前後の空白を落として 1〜40 字（外れは invalid）・同じ名前は dup_option・今に無い id は option_not_found。並びは 1 から
create or replace function app.ticket_field_options_build(p_current jsonb, p_new jsonb) returns jsonb
language plpgsql volatile set search_path = public, app, pg_temp as $$
declare
  o jsonb; i int := 0; nm text; v_id text; out jsonb := '[]'::jsonb; names text[] := '{}';
begin
  if p_new is null or jsonb_typeof(p_new) <> 'array' then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
  for o in select value from jsonb_array_elements(p_new) loop
    i := i + 1;
    if jsonb_typeof(o) <> 'object' or jsonb_typeof(o->'name') <> 'string' then
      return jsonb_build_object('error', 'invalid', 'field', 'options');
    end if;
    nm := app.ticket_field_clean_name(o->>'name');
    if nm is null then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
    if nm = any(names) then return jsonb_build_object('error', 'dup_option'); end if;
    names := names || nm;
    if o ? 'id' and o->'id' <> 'null'::jsonb then
      v_id := o->>'id';
      if not exists (select 1 from jsonb_array_elements(coalesce(p_current, '[]'::jsonb)) c where c->>'id' = v_id) then
        return jsonb_build_object('error', 'option_not_found');
      end if;
    else
      v_id := gen_random_uuid()::text;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('id', v_id, 'name', nm, 'position', i));
  end loop;
  return jsonb_build_object('data', out);
end $$;

-- 種別の行を組の差で入れ替える（外した種別の行は deleted_at・足した種別は行を入れる・同じ組は残す）。無い・消した・別の会社の種別は kind_not_found
create or replace function app.ticket_field_kinds_set(p_field uuid, p_kind_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id();
begin
  -- security definer で行の守りを通らないので、渡された項目が今の会社の生きている物かを先に確かめる（別の会社の種別の行を消させない）
  if v_tenant is null or not exists (select 1 from custom_fields f where f.id = p_field and f.tenant_id = v_tenant and f.deleted_at is null) then
    return jsonb_build_object('error', 'field_not_found');
  end if;
  if p_kind_ids is null or coalesce(array_length(p_kind_ids, 1), 0) = 0 then return jsonb_build_object('error', 'invalid', 'field', 'kind_ids'); end if;
  if exists (select 1 from unnest(p_kind_ids) k
             where not exists (select 1 from ticket_kinds t where t.id = k and t.tenant_id = v_tenant and t.deleted_at is null)) then
    return jsonb_build_object('error', 'kind_not_found');
  end if;
  update custom_field_kinds set deleted_at = now(), updated_by = app.user_id()
    where field_id = p_field and deleted_at is null and kind_id <> all (p_kind_ids);
  insert into custom_field_kinds (tenant_id, field_id, kind_id, created_by, updated_by)
    select v_tenant, p_field, k, app.user_id(), app.user_id() from (select distinct unnest(p_kind_ids) as k) x
    where not exists (select 1 from custom_field_kinds c where c.field_id = p_field and c.kind_id = x.k and c.deleted_at is null);
  return jsonb_build_object('data', to_jsonb(p_kind_ids));
end $$;

create or replace function app.ticket_field_create(p_name text, p_type text, p_options jsonb, p_required boolean, p_description text, p_kind_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_name text := app.ticket_field_clean_name(p_name);
  v_desc text := nullif(btrim(coalesce(p_description, ''), E' \t\r\n\f\v　'), '');
  v_select boolean := p_type in ('select', 'multi_select');
  v_opts jsonb := '[]'::jsonb;
  r jsonb;
  v_id uuid;
begin
  if not app.ticket_field_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if v_name is null then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
  if p_type is null or p_type not in ('short_text', 'long_text', 'number', 'date', 'select', 'multi_select', 'check') then
    return jsonb_build_object('error', 'invalid', 'field', 'field_type');
  end if;
  if p_kind_ids is null or coalesce(array_length(p_kind_ids, 1), 0) = 0 then return jsonb_build_object('error', 'invalid', 'field', 'kind_ids'); end if;
  if v_select then
    if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) = 0 then
      return jsonb_build_object('error', 'invalid', 'field', 'options');
    end if;
    r := app.ticket_field_options_build('[]'::jsonb, p_options);
    if r ? 'error' then return r; end if;
    v_opts := r->'data';
  elsif p_options is not null and p_options <> '[]'::jsonb and p_options <> 'null'::jsonb then
    return jsonb_build_object('error', 'invalid', 'field', 'options');
  end if;
  if exists (select 1 from unnest(p_kind_ids) k
             where not exists (select 1 from ticket_kinds t where t.id = k and t.tenant_id = v_tenant and t.deleted_at is null)) then
    return jsonb_build_object('error', 'kind_not_found');
  end if;
  perform pg_advisory_xact_lock(hashtext('custom_fields:' || v_tenant::text));
  if exists (select 1 from custom_fields where tenant_id = v_tenant and deleted_at is null and name = v_name) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  insert into custom_fields (tenant_id, name, field_type, required, description, options, position, created_by, updated_by)
    values (v_tenant, v_name, p_type, coalesce(p_required, false), v_desc, v_opts,
            coalesce((select max(position) from custom_fields where tenant_id = v_tenant and deleted_at is null), 0) + 10,
            app.user_id(), app.user_id())
    returning id into v_id;
  r := app.ticket_field_kinds_set(v_id, p_kind_ids);
  if r ? 'error' then raise exception '種別の行を入れられない' using errcode = 'P0001'; end if;
  perform app.record_audit('custom_field.create', 'custom_fields', v_id::text, 'C2', jsonb_build_object('field_id', v_id));
  return jsonb_build_object('data', app.ticket_field_settings(v_id)->0);
end $$;

revoke all on function app.ticket_field_settings(uuid), app.ticket_field_kinds_set(uuid, uuid[]), app.ticket_field_can_edit(),
  app.ticket_field_create(text, text, jsonb, boolean, text, uuid[]) from public;
-- app.ticket_field_kinds_set は中（ticket_field_create・K-717 の ticket_field_update）から呼ぶだけ。アプリの役には渡さない
grant execute on function app.ticket_field_clean_name(text), app.ticket_field_settings(uuid), app.ticket_field_options_build(jsonb, jsonb),
  app.ticket_field_can_edit(), app.ticket_field_create(text, text, jsonb, boolean, text, uuid[])
  to kaname_app;

insert into app.schema_migrations (name) values ('20261125014600_ticket_field_master.sql') on conflict do nothing;
