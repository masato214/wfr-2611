-- 20261125015700 項目を直す・消す・並べる（K-717・D-150.36・D-150.37・D-152.18・関門 C2）。表・列・守りは変えない（K-563 の custom_fields・custom_field_kinds・ticket_field_values）
--   どれも 権限（custom_fields の edit）→ 形・状態の確かめ → 書く → 証跡 を 1 つの取引でする。断りは例外にせず { "error": "<言葉>" }（何も書かない）
--   ① app.ticket_field_update：送った欄だけ直す。選ぶ物は K-706 の app.ticket_field_options_build・種別の行は app.ticket_field_kinds_set。値が入っている間は型を変えない
--   ② app.ticket_field_delete：消した印を付ける（項目・種別・値の行は残す＝見えなくなるだけ）
--   ③ app.ticket_field_reorder：今の生きている項目の全部をちょうど 1 回ずつ渡したときだけ、渡した順に 10 刻みで並べる

create or replace function app.ticket_field_update(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  cur custom_fields%rowtype;
  v_name text;
  v_type text;
  v_select boolean;
  v_opts jsonb;
  v_required boolean;
  v_desc text;
  v_kinds uuid[];
  r jsonb;
begin
  if not app.ticket_field_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then return jsonb_build_object('error', 'invalid', 'field', 'body'); end if;
  perform pg_advisory_xact_lock(hashtext('custom_fields:' || v_tenant::text));
  select * into cur from custom_fields where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  -- 名前（前後の空白を落として 1〜40 字・ほかの生きている項目と重ならない）
  v_name := cur.name;
  if p_patch ? 'name' then
    if jsonb_typeof(p_patch->'name') <> 'string' then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
    v_name := app.ticket_field_clean_name(p_patch->>'name');
    if v_name is null then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
  end if;

  -- 型（値が 1 つでも入っていれば同じ型だけ）
  v_type := cur.field_type;
  if p_patch ? 'field_type' then
    v_type := p_patch->>'field_type';
    if v_type is null or v_type not in ('short_text', 'long_text', 'number', 'date', 'select', 'multi_select', 'check') then
      return jsonb_build_object('error', 'invalid', 'field', 'field_type');
    end if;
  end if;
  v_select := v_type in ('select', 'multi_select');

  -- 選ぶ物
  if p_patch ? 'options' and p_patch->'options' <> 'null'::jsonb then
    if jsonb_typeof(p_patch->'options') <> 'array' then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
    if not v_select then
      if jsonb_array_length(p_patch->'options') = 0 then v_opts := '[]'::jsonb;
      elsif p_patch ? 'field_type' then return jsonb_build_object('error', 'invalid', 'field', 'options');
      else return jsonb_build_object('error', 'options_not_allowed');
      end if;
    else
      if jsonb_array_length(p_patch->'options') = 0 then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
      r := app.ticket_field_options_build(
             case when cur.field_type in ('select', 'multi_select') then coalesce(cur.options, '[]'::jsonb) else '[]'::jsonb end,
             p_patch->'options');
      if r ? 'error' then return r; end if;
      v_opts := r->'data';
    end if;
  elsif v_select then
    if cur.field_type not in ('select', 'multi_select') then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
    v_opts := coalesce(cur.options, '[]'::jsonb);
  else
    v_opts := '[]'::jsonb;
  end if;

  -- 必須・説明
  v_required := cur.required;
  if p_patch ? 'required' then
    if jsonb_typeof(p_patch->'required') <> 'boolean' then return jsonb_build_object('error', 'invalid', 'field', 'required'); end if;
    v_required := (p_patch->>'required')::boolean;
  end if;
  v_desc := cur.description;
  if p_patch ? 'description' then
    if p_patch->'description' = 'null'::jsonb then v_desc := null;
    elsif jsonb_typeof(p_patch->'description') <> 'string' then return jsonb_build_object('error', 'invalid', 'field', 'description');
    else v_desc := nullif(btrim(p_patch->>'description', E' \t\r\n\f\v　'), '');
    end if;
  end if;

  -- 種別（無い・消した・別の会社の種別は書く前に断る）
  if p_patch ? 'kind_ids' then
    if jsonb_typeof(p_patch->'kind_ids') <> 'array' or jsonb_array_length(p_patch->'kind_ids') = 0 then
      return jsonb_build_object('error', 'invalid', 'field', 'kind_ids');
    end if;
    v_kinds := array(select (x)::uuid from jsonb_array_elements_text(p_patch->'kind_ids') x);
    if exists (select 1 from unnest(v_kinds) k
               where not exists (select 1 from ticket_kinds t where t.id = k and t.tenant_id = v_tenant and t.deleted_at is null)) then
      return jsonb_build_object('error', 'kind_not_found');
    end if;
  end if;

  -- 状態の確かめ（同じ名前・値が入っているのに型を変える）
  if v_name <> cur.name and exists (select 1 from custom_fields
                                    where tenant_id = v_tenant and deleted_at is null and name = v_name and id <> p_id) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  if v_type <> cur.field_type and exists (select 1 from ticket_field_values v where v.field_id = p_id and v.deleted_at is null) then
    return jsonb_build_object('error', 'type_locked');
  end if;

  -- 書く（種別の行 → 項目の行 → 証跡。どれかが落ちれば取引ごと戻る）
  if v_kinds is not null then
    r := app.ticket_field_kinds_set(p_id, v_kinds);
    if r ? 'error' then return r; end if;
  end if;
  update custom_fields set name = v_name, field_type = v_type, options = v_opts, required = v_required, description = v_desc,
                           updated_at = now(), updated_by = app.user_id()
    where id = p_id;
  perform app.record_audit('custom_field.update', 'custom_fields', p_id::text, 'C2',
                           jsonb_build_object('field_id', p_id, 'fields', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
  return jsonb_build_object('data', app.ticket_field_settings(p_id)->0);
end $$;

create or replace function app.ticket_field_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id();
begin
  if not app.ticket_field_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  perform pg_advisory_xact_lock(hashtext('custom_fields:' || v_tenant::text));
  update custom_fields set deleted_at = now(), updated_at = now(), updated_by = app.user_id()
    where id = p_id and tenant_id = v_tenant and deleted_at is null;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  perform app.record_audit('custom_field.delete', 'custom_fields', p_id::text, 'C2', jsonb_build_object('field_id', p_id));
  return jsonb_build_object('data', jsonb_build_object('id', p_id));
end $$;

create or replace function app.ticket_field_reorder(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_live uuid[];
begin
  if not app.ticket_field_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then return jsonb_build_object('error', 'invalid', 'field', 'field_ids'); end if;
  perform pg_advisory_xact_lock(hashtext('custom_fields:' || v_tenant::text));
  v_live := array(select id from custom_fields where tenant_id = v_tenant and deleted_at is null order by id);
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or array(select x from unnest(p_ids) x order by x) <> v_live then
    return jsonb_build_object('error', 'order_mismatch');
  end if;
  update custom_fields cf set position = o.n * 10, updated_at = now(), updated_by = app.user_id()
    from unnest(p_ids) with ordinality as o(id, n)
    where cf.id = o.id and cf.tenant_id = v_tenant;
  perform app.record_audit('custom_field.reorder', 'custom_fields', v_tenant::text, 'C2', jsonb_build_object('field_ids', to_jsonb(p_ids)));
  return jsonb_build_object('data', app.ticket_field_settings());
end $$;

revoke all on function app.ticket_field_update(uuid, jsonb), app.ticket_field_delete(uuid), app.ticket_field_reorder(uuid[]) from public;
grant execute on function app.ticket_field_update(uuid, jsonb), app.ticket_field_delete(uuid), app.ticket_field_reorder(uuid[]) to kaname_app;

insert into app.schema_migrations (name) values ('20261125015700_ticket_field_edit.sql') on conflict do nothing;
