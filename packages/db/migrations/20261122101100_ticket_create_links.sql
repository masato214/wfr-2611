-- 20261122101100 作る口 createTicket に links（作るときにつなぐ相手）を足す（K-581・関門 C2・D-150.16・D-150.22・D-125.50・D-128.115・D-128.45）
--   app.ticket_create を作り直す（K-437 の 20261122100800 の版を写し、変えた所は 1 つ・同じ名前と引数・create or replace）：
--   確認項目を書いた後・受け箱の前に、p.links を並びの順に 1 件ずつ K-441 の app.ticket_link_add(新しい id, {other_ticket_id, kind}) で呼ぶ。
--     見えるか → 書けるか → つなぐ → 証跡 ticket_link.create はその関数の 1 か所が持つ（作る関数に確かめと証跡を別に持たない・L-002）。
--     答えの振り分け：ok → 次へ／not_found・gone → LINK_GONE（404）／not_writable・not_member → LINK_FORBIDDEN（403）。
--     断ったら入れたチケット・本文・項目の値・確認項目・つながり・証跡を全部戻す（入れ子の塊を戻す・sqlstate KL581）。
--     same・duplicate・cycle・bad_kind と知らない言葉は新しいチケットでは起きないので例外にして取引ごと戻す（口は 503・E-PAGE-003）。知らせ・やり取りの行は作らない（D-128.45）
--   K-438（複製）はこの版を呼ぶだけ・K-578 は区画の道を消すときにこの版を写して作り直す
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形

create or replace function app.ticket_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_scope uuid; v_kind uuid; v_assignee uuid; v_parent uuid; v_stage uuid; v_id uuid; v_number text;
  v_missing text[]; sec record; v_sid uuid; v_body jsonb; v_body_in jsonb; nm uuid; v_notify uuid[];
  v_specs jsonb := coalesce(p->'specs', '[]'::jsonb); v_spec record; v_spec_err text; v_fields jsonb;
  v_links jsonb := coalesce(p->'links', '[]'::jsonb); v_link record; v_link_res jsonb; v_link_err text;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  v_scope := nullif(p->>'scope_id', '')::uuid; v_kind := nullif(p->>'kind_id', '')::uuid;
  v_assignee := nullif(p->>'assignee_member_id', '')::uuid; v_parent := nullif(p->>'parent_ticket_id', '')::uuid;
  if not exists (select 1 from scopes s where s.id = v_scope and s.tenant_id = v_tenant and s.deleted_at is null)
     or not has_permission(v_me, 'tickets', v_scope, 'edit') then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN', 'field', 'scope_id');
  end if;
  if not exists (select 1 from ticket_kinds k where k.id = v_kind and k.tenant_id = v_tenant and k.deleted_at is null) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'KIND_GONE', 'field', 'kind_id');
  end if;
  if not app.ticket_member_ok(v_tenant, v_assignee) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'ASSIGNEE_GONE', 'field', 'assignee_member_id');
  end if;
  if v_parent is not null and not exists (
       select 1 from tickets t where t.id = v_parent and t.tenant_id = v_tenant and t.deleted_at is null and app.ticket_visible(t.id)) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'PARENT_NOT_FOUND', 'field', 'parent_ticket_id');
  end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_notify from jsonb_array_elements_text(coalesce(p->'notify_member_ids', '[]'::jsonb)) x;
  foreach nm in array v_notify loop
    if not app.ticket_member_ok(v_tenant, nm) then
      return jsonb_build_object('ok', false, 'status', 404, 'code', 'NOTIFY_GONE', 'field', 'notify_member_ids');
    end if;
  end loop;
  -- 本文 1 枚（body）：doc と text の 2 つだけを取り、形と上限を確かめる（口が先に確かめるので、ここは最後の砦）
  if p->'body' is not null and jsonb_typeof(p->'body') <> 'null' then
    v_body_in := jsonb_build_object('doc', p->'body'->'doc', 'text', p->'body'->'text');
    if not app.ticket_body_valid(v_body_in) then
      return jsonb_build_object('ok', false, 'status', 422, 'code', 'BODY_INVALID', 'field', 'body');
    end if;
  else
    -- 前の道（sections）：種別の必須の区画（kind_sections.mode = required・D-125.53）。K-575 でこの道ごと無くなる
    select coalesce(array_agg(ks.section_key order by ks.position), '{}') into v_missing from kind_sections ks
      where ks.kind_id = v_kind and ks.tenant_id = v_tenant and ks.deleted_at is null and ks.mode = 'required'
        and coalesce(btrim(p->'sections'->>ks.section_key), '') = '';
    if array_length(v_missing, 1) > 0 then
      return jsonb_build_object('ok', false, 'status', 422, 'code', 'SECTION_REQUIRED', 'field', 'sections', 'detail', to_jsonb(v_missing));
    end if;
  end if;
  -- 確認項目の文（K-437）：1 件ずつ K-434 の app.test_spec_title_check で確かめる（前後の空白を落として 1〜200 字・長さは生の字）。外れは 422・欄 specs.<番号>
  if jsonb_typeof(v_specs) <> 'array' then
    return jsonb_build_object('ok', false, 'status', 422, 'code', 'SPEC_INVALID', 'field', 'specs');
  end if;
  for v_spec in select e.value, e.n from jsonb_array_elements(v_specs) with ordinality as e(value, n) loop
    v_spec_err := app.test_spec_title_check(v_spec.value);
    if v_spec_err is not null then
      return jsonb_build_object('ok', false, 'status', 422, 'code', 'SPEC_INVALID', 'field', 'specs.' || (v_spec.n - 1));
    end if;
  end loop;
  select id into v_stage from ticket_stages where tenant_id = v_tenant and key = 'todo' and deleted_at is null;
  begin   -- 断り（会社の項目）でこの塊を丸ごと戻すための入れ子（下の exception when sqlstate 'KF437'）
  begin
    insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, parent_ticket_id,
                         start_on, due_on, priority, priority_reason, estimate_minutes, created_by, updated_by)
    values (v_tenant, v_scope, 'pending', v_kind, v_stage, p->>'title', v_assignee, v_parent,
            nullif(p->>'start_on', '')::date, (p->>'due_on')::date, coalesce(nullif(p->>'priority', ''), 'mid'),
            nullif(p->>'priority_reason', ''), nullif(p->>'estimate_minutes', '')::int, v_me, v_me)
    returning id, number into v_id, v_number;
  exception when sqlstate '22023' then
    if sqlerrm like '%3 段%' then return jsonb_build_object('ok', false, 'status', 409, 'code', 'PARENT_DEPTH', 'field', 'parent_ticket_id'); end if;
    raise;
  end;
  if v_body_in is not null then
    insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
      values (v_tenant, v_id, 'body', 0, v_body_in, 1, v_me, v_me) returning id into v_sid;
    insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by)
      values (v_tenant, v_id, v_sid, 1, v_body_in, v_me, v_me);
  else
    for sec in select ks.section_key, ks.position from kind_sections ks
               where ks.kind_id = v_kind and ks.tenant_id = v_tenant and ks.deleted_at is null and ks.mode <> 'hidden'
                 and coalesce(btrim(p->'sections'->>ks.section_key), '') <> '' loop
      v_body := jsonb_build_object('text', p->'sections'->>sec.section_key);
      insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
        values (v_tenant, v_id, sec.section_key, sec.position, v_body, 1, v_me, v_me) returning id into v_sid;
      insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by)
        values (v_tenant, v_id, v_sid, 1, v_body, v_me, v_me);
    end loop;
  end if;
  -- 会社の項目の値（K-437・K-564）：確かめと書き込みは app.ticket_fields_set 1 つだけ（作るとき＝p_create true：値の行だけを書く・必須の項目は送らなくても見る）。
  --   断り（field_not_found＝404・not_in_kind・bad_option・bad_type・required_empty＝409）はこの塊ごと戻して言葉を返す
  v_fields := app.ticket_fields_set(v_id, coalesce(p->'fields', '{}'::jsonb), true);
  if v_fields ? 'error' then
    raise exception using errcode = 'KF437', message = v_fields->>'error';
  end if;
  -- 確認項目（K-437）：文だけの行（チェック無し・出どころ manual・版 1）を渡した順に 1 文で入れる。やり取りの行は足さない（作った時は更新でない）
  insert into test_specs (tenant_id, ticket_id, check_kind, title, params, created_by, updated_by, created_at)
    select v_tenant, v_id, null, btrim(e.value #>> '{}', E' \t\r\n\f\v　'), '{}'::jsonb, v_me, v_me,
           now() + (e.n * interval '1 microsecond')
      from jsonb_array_elements(v_specs) with ordinality as e(value, n);
  -- つながり（K-581）：links を並びの順に 1 件ずつ K-441 の app.ticket_link_add で張る（確かめと証跡はその関数の 1 か所）。
  --   断り（相手が無い・消した・見えない・別の会社＝404／相手に書けない＝403）はこの塊ごと戻して言葉を返す。起きないはずの言葉は例外（取引ごと戻す）
  if jsonb_typeof(v_links) <> 'array' then
    raise exception 'app.ticket_create: links は並びで渡す';
  end if;
  for v_link in select e.value from jsonb_array_elements(v_links) with ordinality as e(value, n) order by e.n loop
    v_link_res := app.ticket_link_add(v_id, jsonb_build_object('other_ticket_id', v_link.value->>'other_ticket_id',
                                                               'kind', v_link.value->>'kind'));
    if (v_link_res->>'ok') = 'true' then
      continue;
    end if;
    v_link_err := v_link_res->>'error';
    if v_link_err in ('not_found', 'gone') then
      raise exception using errcode = 'KL581', message = 'LINK_GONE';
    elsif v_link_err in ('not_writable', 'not_member') then
      raise exception using errcode = 'KL581', message = 'LINK_FORBIDDEN';
    end if;
    raise exception 'app.ticket_create: つなぐ所の知らない答え（%）', coalesce(v_link_err, 'null');
  end loop;
  if v_assignee <> v_me then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      values (v_tenant, v_assignee, 'inapp', 'ticket.assigned', jsonb_build_object('ticket_id', v_id, 'number', v_number, 'title', p->>'title'),
              'ticket_assigned:' || v_id || ':' || v_assignee, v_me);
  end if;
  foreach nm in array v_notify loop
    if nm <> v_me and nm <> v_assignee then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
        values (v_tenant, nm, 'inapp', 'ticket.created', jsonb_build_object('ticket_id', v_id, 'number', v_number, 'title', p->>'title'),
                'ticket_created:' || v_id || ':' || nm, v_me);
    end if;
  end loop;
  for nm in select (x)::uuid from unnest(array[nullif(p->>'draft_id', ''), nullif(p->>'source_draft_id', '')]) as x where x is not null loop
    delete from app.ticket_drafts where tenant_id = v_tenant and member_id = v_me and draft_id = nm;
    insert into app.ticket_drafts_used (tenant_id, member_id, draft_id) values (v_tenant, v_me, nm)
      on conflict (tenant_id, member_id, draft_id) do update set used_at = now();
  end loop;
  delete from app.ticket_drafts_used where tenant_id = v_tenant and member_id = v_me and used_at < now() - interval '30 days';
  exception when sqlstate 'KF437' then
    return jsonb_build_object('ok', false, 'status', case when sqlerrm = 'field_not_found' then 404 else 409 end,
                              'code', 'FIELD', 'field', 'fields', 'detail', sqlerrm);
    when sqlstate 'KL581' then
      return jsonb_build_object('ok', false, 'status', case when sqlerrm = 'LINK_GONE' then 404 else 403 end, 'code', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'number', v_number);
end $$;
revoke all on function app.ticket_create(jsonb) from public;
grant execute on function app.ticket_create(jsonb) to kaname_app;
