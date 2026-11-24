-- 20261122101000 読む口の足し（K-560・D-150.1・D-150.16・D-150.35〜37・D-150.41・D-128.115）。読むだけ（stable・書かない）・列と表は足さない
--   ① app.ticket_field_master(p_kind)：その種別で出す会社の項目のマスタ（TicketField の鍵 7・値なし）。項目のマスタの規則はこの 1 か所
--      （種別の行が 1 つも無い＝消した行も無い項目は全部の種別・その種別の消していない行がある項目はその種別。消した行しか無い項目はどの種別にも出ない・K-563 と同じ）。
--      listTicketKinds の各種別の fields と、詳細の fields（値つき）の両方がこれを呼ぶ（規則を 2 つ持たない・L-002）
--   ② app.ticket_read_adds(p_ticket)：詳細 getTicket に足す { body, fields, spec_count, spec_unchecked, no_spec_reason, parent, child_count, link_count, results }。
--      見えない・無い・消した・別の会社は null（口の後ろの 2 層目）。見えない親は番号だけ（D-128.115）・見えない子は数えない
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形

create or replace function app.ticket_field_master(p_kind uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id();
begin
  if v_tenant is null or not app.member_ok() then return '[]'::jsonb; end if;
  if not exists (select 1 from ticket_kinds k where k.id = p_kind and k.tenant_id = v_tenant and k.deleted_at is null) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', cf.id, 'name', cf.name, 'field_type', cf.field_type, 'required', cf.required,
             'description', cf.description, 'options', app.ticket_field_options(cf.field_type, cf.options),
             'position', cf.position)
           order by cf.position, cf.created_at, cf.id)
      from custom_fields cf
     where cf.tenant_id = v_tenant and cf.deleted_at is null
       and (not exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.tenant_id = v_tenant)
            or exists (select 1 from custom_field_kinds ck
                        where ck.field_id = cf.id and ck.tenant_id = v_tenant and ck.kind_id = p_kind and ck.deleted_at is null))
  ), '[]'::jsonb);
end $$;

-- 選択肢の整え方（K-563 の toOptions と同じ）：選ぶ型だけ、id と name が字の物を position の順（同じなら今の並び）に { id, name, position }。ほかの型は []
create or replace function app.ticket_field_options(p_type text, p_options jsonb) returns jsonb
language sql immutable set search_path = public, app, pg_temp as $$
  select case when p_type in ('select', 'multi_select') and jsonb_typeof(p_options) = 'array' then coalesce((
    select jsonb_agg(jsonb_build_object('id', o.v->>'id', 'name', o.v->>'name', 'position', o.pos) order by o.pos, o.n)
      from (select e.v, e.n,
                   case when jsonb_typeof(e.v->'position') = 'number' then e.v->'position' else '0'::jsonb end as pos
              from jsonb_array_elements(p_options) with ordinality as e(v, n)
             where jsonb_typeof(e.v) = 'object' and jsonb_typeof(e.v->'id') = 'string' and jsonb_typeof(e.v->'name') = 'string') o
  ), '[]'::jsonb) else '[]'::jsonb end
$$;

create or replace function app.ticket_read_adds(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  t record;
  v_body jsonb;
  v_fields jsonb;
  v_parent jsonb := null;
  v_results jsonb := '{}'::jsonb;
  v_art jsonb;
  v_dec jsonb;
  v_hand jsonb;
  v_spec_count int;
  v_spec_unchecked int;
  v_child_count int;
  v_link_count int;
begin
  if v_tenant is null or not app.member_ok() then return null; end if;
  select x.id, x.kind_id, x.parent_ticket_id, x.no_spec_reason into t
    from tickets x where x.id = p_ticket and x.tenant_id = v_tenant and x.deleted_at is null;
  if not found or not app.ticket_visible(p_ticket) then return null; end if;

  -- 本文：鍵 body の消していない行。無ければ空の本文（版 0）
  select jsonb_build_object('doc', s.body->'doc', 'text', coalesce(s.body->>'text', ''), 'version', s.version) into v_body
    from ticket_sections s
   where s.ticket_id = p_ticket and s.tenant_id = v_tenant and s.section_key = 'body' and s.deleted_at is null;
  v_body := coalesce(v_body, jsonb_build_object('doc', jsonb_build_object('type', 'doc', 'content', '[]'::jsonb), 'text', '', 'version', 0));

  -- 会社の項目：マスタ（並びと鍵 7）に消していない値を付ける（無ければ null）
  select coalesce(jsonb_agg(m.f || jsonb_build_object('value', v.value) order by m.n), '[]'::jsonb) into v_fields
    from jsonb_array_elements(app.ticket_field_master(t.kind_id)) with ordinality as m(f, n)
    left join ticket_field_values v
      on v.ticket_id = p_ticket and v.tenant_id = v_tenant and v.field_id = (m.f->>'id')::uuid and v.deleted_at is null;

  -- 確認項目の数（消した物を数えない・件数だけ）
  select count(*)::int, count(*) filter (where ts.checked_at is null)::int into v_spec_count, v_spec_unchecked
    from test_specs ts where ts.ticket_id = p_ticket and ts.tenant_id = v_tenant and ts.deleted_at is null;

  -- 親：見えれば鍵 6・同じ会社で見えなければ番号だけ・無い／消したは null（祖父母は入れ子にしない）
  if t.parent_ticket_id is not null then
    select case when app.ticket_visible(pt.id) then
             jsonb_build_object('id', pt.id, 'number', pt.number, 'title', pt.title, 'due_on', pt.due_on,
                                'stage', case when st.id is null then null
                                              else jsonb_build_object('id', st.id, 'key', st.key, 'name', st.name) end,
                                'visible', true)
           else jsonb_build_object('id', null, 'number', pt.number, 'title', null, 'due_on', null, 'stage', null, 'visible', false) end
      into v_parent
      from tickets pt left join ticket_stages st on st.id = pt.stage_id
     where pt.id = t.parent_ticket_id and pt.tenant_id = v_tenant and pt.deleted_at is null;
  end if;

  -- 直接の子で、消していなくて見える物（見えない物の数を推し量らせない）
  select count(*)::int into v_child_count
    from tickets c
   where c.parent_ticket_id = p_ticket and c.tenant_id = v_tenant and c.deleted_at is null and app.ticket_visible(c.id);

  -- つながり：外していなくて相手を消していない物（向きは問わない・見えない相手も数だけ）
  select count(*)::int into v_link_count
    from ticket_links l
    join tickets o on o.id = case when l.from_ticket_id = p_ticket then l.to_ticket_id else l.from_ticket_id end
   where l.tenant_id = v_tenant and l.deleted_at is null and o.deleted_at is null
     and (l.from_ticket_id = p_ticket or l.to_ticket_id = p_ticket);

  -- 結果の場所（在るものだけ鍵を出す・D-150.41）
  select jsonb_build_object('text', s.body->>'text', 'version', s.version, 'updated_at', s.updated_at) into v_art
    from ticket_sections s
   where s.ticket_id = p_ticket and s.tenant_id = v_tenant and s.section_key = 'artifacts' and s.deleted_at is null
     and coalesce(btrim(s.body->>'text'), '') <> '';
  if v_art is not null then v_results := v_results || jsonb_build_object('artifacts', v_art); end if;

  select jsonb_agg(jsonb_build_object('id', d.id, 'text', d.text, 'reason', d.reason, 'decided_at', d.decided_at,
                                      'decided_by_name', m.display_name) order by d.decided_at, d.id) into v_dec
    from ticket_decisions d left join members m on m.id = d.decided_by
   where d.ticket_id = p_ticket and d.tenant_id = v_tenant and d.deleted_at is null and d.superseded_by_id is null;
  if v_dec is not null then v_results := v_results || jsonb_build_object('decisions', v_dec); end if;

  select jsonb_build_object('text', coalesce(nullif(btrim(h.reason), ''), h.ask), 'by_name', m.display_name, 'at', h.created_at) into v_hand
    from ticket_handovers h left join members m on m.id = h.from_member_id
   where h.ticket_id = p_ticket and h.tenant_id = v_tenant and h.deleted_at is null
     and (coalesce(btrim(h.reason), '') <> '' or coalesce(btrim(h.ask), '') <> '')
   order by h.created_at desc, h.id desc limit 1;
  if v_hand is not null then v_results := v_results || jsonb_build_object('handoff', v_hand); end if;

  return jsonb_build_object(
    'body', v_body, 'fields', v_fields, 'spec_count', v_spec_count, 'spec_unchecked', v_spec_unchecked,
    'no_spec_reason', t.no_spec_reason, 'parent', v_parent, 'child_count', v_child_count,
    'link_count', v_link_count, 'results', v_results);
end $$;

revoke all on function app.ticket_field_options(text, jsonb) from public;
revoke all on function app.ticket_field_master(uuid) from public;
revoke all on function app.ticket_read_adds(uuid) from public;
grant execute on function app.ticket_field_options(text, jsonb) to kaname_app;
grant execute on function app.ticket_field_master(uuid) to kaname_app;
grant execute on function app.ticket_read_adds(uuid) to kaname_app;
