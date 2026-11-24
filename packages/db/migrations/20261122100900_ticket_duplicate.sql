-- 20261122100900 複製する（K-438・A129・関門 C2・C6・D-150.6・D-150.27・D-150.28・D-150.39・D-125.95・D-128.115・D-128.25・D-125.50）
--   複製は作る口 createTicket に duplicate_of・copy[] を足した物。口は同じ取引で 3 つを順に呼ぶ：
--     ① app.ticket_duplicate_read：元を止めて、写す材料を返す（断るなら何も書かない）
--     ② app.ticket_create（K-437・K-581 の版）：口が材料から組んだ体で作る（ここでは作り直さない）
--     ③ app.ticket_duplicate_apply：確認項目・つながり・子・派生元の線・子の担当者への受け箱・証跡を書く
--   本文のチェックの箱を外す・text を作るのは口だけ（DB は渡された {doc, text} を書くだけ・L-002）。
--   列・表は足さない。呼び先の K-441 の関数（20261122094100）・K-564 の関数（20261122100400）は呼ぶ時に引く（plpgsql）。
--   どの関数も呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し kaname_app だけに渡す。
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形

-- ① 元を止めて、写す材料を返す。答え：{error: not_member|gone|depth} か
--   {ok, src:{assignee_member_id, priority, priority_reason, estimate_minutes}, body:{doc}|null, fields:{<項目の id>: 値}, children:[{id, body:{doc}|null}]}
--   元と写す子の行は for update で止める（複製の途中で消されない。K-441 の app.ticket_link_put が同じ行を for update で取るので、
--   ここで弱い鍵を取ると同じ元の同時の複製どうしが互いを待って止まる。強い鍵で 2 本目をここで待たせる）
create or replace function app.ticket_duplicate_read(p_src uuid, p_copy text[], p_kind uuid, p_parent uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); v_copy text[] := coalesce(p_copy, '{}');
  s tickets%rowtype; v_kids uuid[] := '{}'; v_depth integer := 1; v_cur uuid := p_parent; v_next uuid;
  v_body jsonb := null; v_fields jsonb := '{}'::jsonb; v_children jsonb := '[]'::jsonb; fv record; v_norm jsonb; k record;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('error', 'not_member');
  end if;
  if p_src is null or not app.ticket_visible(p_src) then
    return jsonb_build_object('error', 'gone');
  end if;
  perform 1 from tickets t
    where t.tenant_id = v_tenant
      and (t.id = p_src or ('children' = any (v_copy) and t.parent_ticket_id = p_src and t.deleted_at is null))
    order by t.id for update;
  -- 止めた後に読み直す（待っている間に消された元は見えない）
  select * into s from tickets t where t.id = p_src and t.tenant_id = v_tenant and t.deleted_at is null;
  if s.id is null or not app.ticket_visible(p_src) then
    return jsonb_build_object('error', 'gone');
  end if;
  -- 写す子：直接の子のうち、消していない・呼んだ人に見える・種別が消えていない物（孫は写さない）
  if 'children' = any (v_copy) then
    select coalesce(array_agg(t.id order by t.created_at, t.id), '{}') into v_kids
      from tickets t
      join ticket_kinds tk on tk.id = t.kind_id and tk.tenant_id = v_tenant and tk.deleted_at is null
     where t.parent_ticket_id = p_src and t.tenant_id = v_tenant and t.deleted_at is null and app.ticket_visible(t.id);
    if array_length(v_kids, 1) > 0 then
      -- 新しいチケットの段（親の鎖を数えて +1）に子 1 段を足して 3 を超えるなら断る（D-125.51）。無い親は数えない（② が 404 にする）
      while v_cur is not null and v_depth < 10 loop
        select t.parent_ticket_id into v_next from tickets t where t.id = v_cur and t.tenant_id = v_tenant;
        exit when not found;
        v_depth := v_depth + 1;
        v_cur := v_next;
      end loop;
      if v_depth + 1 > 3 then
        return jsonb_build_object('error', 'depth');
      end if;
    end if;
  end if;
  -- 本文：元に本文の行（鍵 body・消していない）があり text が空でないときだけ（前の形の区画は読まない）
  if 'body' = any (v_copy) then
    select jsonb_build_object('doc', ts.body->'doc') into v_body
      from ticket_sections ts
     where ts.ticket_id = p_src and ts.tenant_id = v_tenant and ts.section_key = 'body' and ts.deleted_at is null
       and coalesce(btrim(ts.body->>'text'), '') <> ''
     limit 1;
  end if;
  -- 会社の項目の値：項目が消えていない・新しい種別に出る・今の決まり（型・選択肢）に合う物だけ（合わない物は黙って写さない）
  if 'fields' = any (v_copy) then
    for fv in select v.field_id, v.value
                from ticket_field_values v
                join custom_fields cf on cf.id = v.field_id and cf.tenant_id = v_tenant and cf.deleted_at is null
               where v.ticket_id = p_src and v.tenant_id = v_tenant and v.deleted_at is null
                 and (not exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.tenant_id = v_tenant)
                      or exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.tenant_id = v_tenant
                                    and ck.kind_id = p_kind and ck.deleted_at is null))
               order by v.field_id loop
      v_norm := app.custom_field_normalize(fv.field_id, fv.value);
      if (v_norm->>'ok') = 'true' and jsonb_typeof(v_norm->'value') is distinct from 'null' and v_norm->'value' is not null then
        v_fields := v_fields || jsonb_build_object(fv.field_id::text, v_norm->'value');
      end if;
    end loop;
  end if;
  for k in select t.id from tickets t where t.id = any (v_kids) order by t.created_at, t.id loop
    v_children := v_children || jsonb_build_array(jsonb_build_object(
      'id', k.id,
      'body', (select jsonb_build_object('doc', ts.body->'doc') from ticket_sections ts
                where ts.ticket_id = k.id and ts.tenant_id = v_tenant and ts.section_key = 'body' and ts.deleted_at is null limit 1)));
  end loop;
  return jsonb_build_object(
    'ok', true,
    'src', jsonb_build_object('assignee_member_id', s.assignee_member_id, 'priority', s.priority,
                              'priority_reason', s.priority_reason, 'estimate_minutes', s.estimate_minutes),
    'body', v_body,
    'fields', v_fields,
    'children', v_children);
end $$;
revoke all on function app.ticket_duplicate_read(uuid, text[], uuid, uuid) from public;
grant execute on function app.ticket_duplicate_read(uuid, text[], uuid, uuid) to kaname_app;

-- ③ 写しを書く。p は {source, copy, children:[{id, body:{doc, text}|null}]}。答え {children: 写した子の数}。
--   起きないはずの断り（線が張れない・子の元が無い・本文の形が違う）は例外にして取引ごと戻す（口は 503・E-PAGE-003）
create or replace function app.ticket_duplicate_apply(p_new uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_src uuid := nullif(p->>'source', '')::uuid; v_copy jsonb := coalesce(p->'copy', '[]'::jsonb);
  n tickets%rowtype; k tickets%rowtype; v_stage uuid; v_res jsonb; v_other uuid; c record;
  v_cid uuid; v_cnum text; v_assignee uuid; v_due date; v_start date; v_b jsonb; v_sid uuid; v_count integer := 0;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    raise exception 'app.ticket_duplicate_apply: 会社の人でない';
  end if;
  select * into n from tickets t where t.id = p_new and t.tenant_id = v_tenant and t.deleted_at is null;
  if n.id is null or v_src is null or jsonb_typeof(v_copy) <> 'array' then
    raise exception 'app.ticket_duplicate_apply: 写す先か元が無い';
  end if;
  -- 確認項目：元の消していない行を作った順に。文・種類・出どころは元のまま、チェックは外し、版 1・作った人は呼んだ人
  if v_copy ? 'specs' then
    insert into test_specs (tenant_id, ticket_id, check_kind, title, judge_type, params, source, source_ref_id, version,
                            created_by, updated_by, created_at)
      select v_tenant, p_new, s.check_kind, s.title, s.judge_type, s.params, s.source, s.source_ref_id, 1, v_me, v_me,
             now() + (row_number() over (order by s.created_at, s.id) * interval '1 microsecond')
        from test_specs s
       where s.ticket_id = v_src and s.tenant_id = v_tenant and s.deleted_at is null;
  end if;
  -- つながり：元の関連（向きは問わない）のうち、相手が消えていなくて呼んだ人に見える物だけ。派生元の線は写さない
  if v_copy ? 'links' then
    for c in select case when l.from_ticket_id = v_src then l.to_ticket_id else l.from_ticket_id end as other
               from ticket_links l
              where l.tenant_id = v_tenant and l.deleted_at is null and l.kind = 'related'
                and (l.from_ticket_id = v_src or l.to_ticket_id = v_src)
              order by l.created_at, l.id loop
      v_other := c.other;
      continue when not app.ticket_visible(v_other);
      v_res := app.ticket_link_put(p_new, v_other, 'related');
      continue when v_res->>'error' = 'gone';   -- 読んだ後に相手が消えた（写さない）
      if v_res ? 'error' then
        raise exception 'app.ticket_duplicate_apply: 関連を張れない（%）', v_res->>'error';
      end if;
    end loop;
  end if;
  -- 元へのつながり（派生元）は copy に関わらず 1 本（D-150.27。tickets.derived_from_ticket_id は使わない）
  v_res := app.ticket_link_derive(p_new, v_src);
  if v_res ? 'error' then
    raise exception 'app.ticket_duplicate_apply: 派生元を張れない（%）', v_res->>'error';
  end if;
  -- 子：口が ① の材料から本文を組んで渡した子ごとに、新しい子の行を直に書く（確認項目・項目の値・つながり・孫・業務の型は付けない）
  select id into v_stage from ticket_stages where tenant_id = v_tenant and key = 'todo' and deleted_at is null;
  for c in select x.value as v from jsonb_array_elements(coalesce(p->'children', '[]'::jsonb)) with ordinality as x(value, i) order by x.i loop
    select * into k from tickets t where t.id = nullif(c.v->>'id', '')::uuid and t.tenant_id = v_tenant and t.deleted_at is null;
    if k.id is null then
      raise exception 'app.ticket_duplicate_apply: 写す子が無い';
    end if;
    v_assignee := case when k.assignee_member_id is not null and app.ticket_member_ok(v_tenant, k.assignee_member_id)
                       then k.assignee_member_id else v_me end;
    v_due := case when k.due_on is null then n.due_on when n.due_on is null then k.due_on else least(k.due_on, n.due_on) end;
    v_start := case when k.start_on is not null and v_due is not null and k.start_on > v_due then null else k.start_on end;
    insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, parent_ticket_id,
                         start_on, due_on, priority, priority_reason, estimate_minutes, created_by, updated_by)
      values (v_tenant, n.scope_id, 'pending', k.kind_id, v_stage, k.title, v_assignee, p_new,
              v_start, v_due, k.priority, k.priority_reason, k.estimate_minutes, v_me, v_me)
      returning id, number into v_cid, v_cnum;
    v_b := c.v->'body';
    if v_b is not null and jsonb_typeof(v_b) <> 'null' then
      v_b := jsonb_build_object('doc', v_b->'doc', 'text', v_b->'text');
      if not app.ticket_body_valid(v_b) then
        raise exception 'app.ticket_duplicate_apply: 子の本文の形が違う';
      end if;
      insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
        values (v_tenant, v_cid, 'body', 0, v_b, 1, v_me, v_me) returning id into v_sid;
      insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by)
        values (v_tenant, v_cid, v_sid, 1, v_b, v_me, v_me);
    end if;
    v_res := app.ticket_link_derive(v_cid, k.id);
    if v_res ? 'error' then
      raise exception 'app.ticket_duplicate_apply: 子の派生元を張れない（%）', v_res->>'error';
    end if;
    -- 子の担当者への知らせ（画面の中の受け箱だけ・メールは出さない・D-125.130）。本文は番号と題名だけ
    if v_assignee <> v_me then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
        values (v_tenant, v_assignee, 'inapp', 'ticket.assigned',
                jsonb_build_object('ticket_id', v_cid, 'number', v_cnum, 'title', k.title),
                'ticket.assigned:' || v_cid, v_me);
    end if;
    v_count := v_count + 1;
  end loop;
  -- 証跡（題名・本文・項目の値は書かない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'ticket.duplicate', 'tickets', p_new::text, 'C2',
            jsonb_build_object('source_ticket_id', v_src, 'copy', v_copy, 'children', v_count), v_me);
  return jsonb_build_object('children', v_count);
end $$;
revoke all on function app.ticket_duplicate_apply(uuid, jsonb) from public;
grant execute on function app.ticket_duplicate_apply(uuid, jsonb) to kaname_app;
