-- K-565 AI に任せる口の直し（D-150.1・D-150.35・D-150.45・D-130.3）
--   ① app.ticket_brief_items：AI に渡す「項目」の行を組む（中だけで使う）
--   ② app.ticket_job_context：本文の行が在れば 本文 → 項目 → 確認項目 から組む（無ければ 0101 の区画の道のまま）
--   ③ app.ticket_delegate(uuid) を消し、app.ticket_delegate(uuid, text) を作る（確認項目が 0 件なら NO_SPEC・使わない理由を残す）

create or replace function app.ticket_brief_items(p_ticket uuid) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_kind text; v_lines text[]; f record; v_val text;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return ''; end if;
  select k.name into v_kind from ticket_kinds k where k.id = t.kind_id;
  v_lines := array[
    '- 題名: ' || t.title,
    '- 種別: ' || coalesce(v_kind, ''),
    '- 期限: ' || coalesce(to_char(t.due_on, 'YYYY-MM-DD'), 'なし'),
    '- 優先度: ' || case when t.priority = 'high' then '高（理由：' || coalesce(t.priority_reason, '') || '）' else '中' end];
  for f in
    select cf.id, cf.name, cf.field_type, cf.options, v.value
      from custom_fields cf join ticket_field_values v on v.field_id = cf.id and v.ticket_id = t.id and v.deleted_at is null
     where cf.tenant_id = t.tenant_id and cf.deleted_at is null
       and (not exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.deleted_at is null)
            or exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.kind_id = t.kind_id and ck.deleted_at is null))
     order by cf.position, cf.created_at, cf.id
  loop
    v_val := case f.field_type
      when 'check' then case when f.value = 'true'::jsonb then 'はい' when f.value = 'false'::jsonb then 'いいえ' end
      when 'select' then (select o->>'name' from jsonb_array_elements(f.options) o where o->>'id' = f.value #>> '{}' limit 1)
      when 'multi_select' then (select string_agg(o->>'name', '、' order by (o->>'position')::numeric, o->>'id')
                                  from jsonb_array_elements(f.options) o
                                 where jsonb_typeof(f.value) = 'array' and f.value @> to_jsonb(o->>'id'))
      else case when jsonb_typeof(f.value) in ('string', 'number') then f.value #>> '{}' end
    end;
    if coalesce(btrim(v_val), '') = '' then continue; end if;
    v_lines := v_lines || ('- ' || f.name || ': ' || v_val);
  end loop;
  return array_to_string(v_lines, E'\n');
end $$;
revoke all on function app.ticket_brief_items(uuid) from public;

-- ---------------------------------------------------------------- 仕事の中身を組む（0101 の本体を写し、本文の道を足した）
create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_has_body boolean; v_text text; v_items text; v_specs text; v_prompt text; v_sess text; v_sess_member uuid; sec record; rec record;
        v_lines text[] := '{}'; v_total int := 0; v_head text; v_summary text;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return null; end if;
  v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
              || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
              || 'チケットの区画は Kaname の道具 ticket_read で読めます。';
  -- 本文の行（鍵 body・消していない）が在れば 本文 → 項目 → 確認項目 の道。無ければ前の区画の道（K-565）
  select s.body->>'text' into v_text from ticket_sections s where s.ticket_id = t.id and s.section_key = 'body' and s.deleted_at is null
   order by s.position, s.created_at, s.id limit 1;
  v_has_body := found;
  if v_has_body then
    v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
                || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
                || 'チケットの本文と項目は Kaname の道具 ticket_read で読めます。';
    if coalesce(btrim(v_text), '') <> '' then v_prompt := v_prompt || E'\n\n## 本文\n' || v_text; end if;
    v_prompt := v_prompt || E'\n\n## 項目\n' || app.ticket_brief_items(t.id);
    select string_agg('- ' || x.title, E'\n' order by x.created_at, x.id) into v_specs
      from test_specs x where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null;
    if v_specs is null then
      v_specs := case when coalesce(t.no_spec_reason, '') = '' then '- なし' else '- なし（使わない理由：' || t.no_spec_reason || '）' end;
    end if;
    v_prompt := v_prompt || E'\n\n## 確認項目\n' || v_specs;
  end if;
  -- 区画は切らずに全文（D-130.3・PM の判断 2026-11-08）
  if not v_has_body then
  for sec in select coalesce(ks.label, s.section_key) as label, s.body->>'text' as body
               from ticket_sections s
               left join kind_sections ks on ks.kind_id = t.kind_id and ks.section_key = s.section_key and ks.deleted_at is null
              where s.ticket_id = t.id and s.deleted_at is null
                and s.section_key in ('purpose', 'done', 'constraints', 'counterpart', 'todo')
                and coalesce(btrim(s.body->>'text'), '') <> ''
              order by array_position(array['purpose', 'done', 'constraints', 'counterpart', 'todo'], s.section_key) loop
    v_prompt := v_prompt || E'\n\n## ' || sec.label || E'\n' || sec.body;
  end loop;
  end if;
  -- チケットの記録の要約（D-129.46・G-16）：やり取りの書き込み 新しい 10 件・1 件 400 字／決定 新しい 20 件・1 件 200 字／前の実行の記録 新しい 10 件・1 件 200 字。
  --   古い順に並べ、合わせて 8000 字を越えたら古いものから落とす。区画は切らない。前の会話の番号（agent_session_id）は入れない
  for rec in
    select x.line from (
      (select m.created_at as ts,
              '[やり取り] ' || to_char(m.created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' ' || coalesce(app.member_name(m.author_member_id), '') || ': '
              || left(regexp_replace(coalesce(m.body, ''), E'[\\r\\n]+', ' ', 'g'), 400) as line
         from ticket_messages m where m.ticket_id = t.id and m.kind <> 'system' and m.deleted_at is null
        order by m.created_at desc limit 10)
      union all
      (select d.decided_at,
              '[決定] ' || to_char(d.decided_at at time zone 'Asia/Tokyo', 'MM/DD') || ' ' || left(regexp_replace(coalesce(d.text, ''), E'[\\r\\n]+', ' ', 'g'), 200)
         from ticket_decisions d where d.ticket_id = t.id and d.deleted_at is null
        order by d.decided_at desc limit 20)
      union all
      (select coalesce(r.finished_at, r.created_at),
              '[前の実行] ' || to_char(coalesce(r.finished_at, r.created_at) at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' ' || coalesce(app.member_name(r.created_by), '') || 'のAI: '
              || case r.status_id when 'done' then '作り終えた' when 'cancelled' then 'やめた' else '止まった' end
              || case when coalesce(r.error_summary, '') = '' then '' else '（' || left(regexp_replace(r.error_summary, E'[\\r\\n]+', ' ', 'g'), 200) || '）' end
         from action_runs r where r.ticket_id = t.id and r.status_id in ('done', 'stopped', 'cancelled') and r.deleted_at is null
        order by coalesce(r.finished_at, r.created_at) desc limit 10)
    ) x order by x.ts
  loop
    v_lines := v_lines || rec.line;
    v_total := v_total + length(rec.line) + 3;   -- 「- 」と改行
  end loop;
  v_head := E'\n\n## チケットの記録（新しいものだけ・古い順）\n';
  while coalesce(array_length(v_lines, 1), 0) > 0 and v_total + length(v_head) > 8000 loop
    v_total := v_total - (length(v_lines[1]) + 3);
    v_lines := v_lines[2:];
  end loop;
  if coalesce(array_length(v_lines, 1), 0) > 0 then
    select string_agg('- ' || u.l, E'\n' order by u.i) into v_summary from unnest(v_lines) with ordinality as u(l, i);
    v_prompt := v_prompt || v_head || v_summary;
  end if;
  -- 前の作る実行の会話の番号と、その実行を任せた人。続きにするかは任せる関数（同じ人）と取る関数（同じ PC）が決める（D-129.46）
  select j.agent_session_id, r.created_by into v_sess, v_sess_member
    from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
   where r.ticket_id = t.id and r.phase = 'make' and j.agent_session_id is not null
     and (t.completed_at is null or r.created_at > t.completed_at)   -- ★ K-166 が足した所：完了の前の作る実行の続きは使わない（D-125.155・K63-API-054・055）
   order by r.created_at desc limit 1;
  return jsonb_build_object('prompt', v_prompt, 'agent_session_id', v_sess, 'agent_member_id', v_sess_member);
end $$;
-- 中だけで使う（任せる関数と K-63 の承認の関数が呼ぶ）。kaname_app にも渡さない（D-128.171・K62-API-046）
revoke all on function app.ticket_job_context(uuid) from public;

-- ---------------------------------------------------------------- 任せる（0092 の本体を写し、確認項目の数と使わない理由を足した）
-- squawk-ignore ban-drop-function
drop function if exists app.ticket_delegate(uuid);
create or replace function app.ticket_delegate(p_ticket uuid, p_no_spec_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text; v_run uuid; v_job uuid; v_ctx jsonb;
        v_reason text; v_has_body boolean; v_specs int;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 理由の形（最後の砦）：送られたなら前後の空白（全角・タブ・改行も）を落として 1〜500 字
  if p_no_spec_reason is not null then
    v_reason := btrim(p_no_spec_reason, E' \t\r\n　');
    if length(v_reason) < 1 or length(v_reason) > 500 then return jsonb_build_object('ok', false, 'code', 'REASON_INVALID'); end if;
  end if;
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(p_ticket) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if not app.ticket_writable(p_ticket) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select r.id into v_run from action_runs r
   where r.ticket_id = p_ticket and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null
   order by r.created_at desc limit 1;
  if v_run is not null then return jsonb_build_object('ok', false, 'code', 'RUNNING', 'run_id', v_run); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if coalesce(v_stage, '') not in ('todo', 'doing', 'hold') then return jsonb_build_object('ok', false, 'code', 'NOT_DELEGABLE'); end if;
  if not exists (select 1 from sessions s where s.member_id in (select app.account_members(v_me)) and s.kind_id = 'bridge'
                    and s.revoked_at is null and s.deleted_at is null) then
    return jsonb_build_object('ok', false, 'code', 'NO_PC');
  end if;
  -- 確認項目の数（本文の行が在るチケットだけ。前の形は K-575 が本文に移すまで止めない）
  select exists (select 1 from ticket_sections s where s.ticket_id = t.id and s.section_key = 'body' and s.deleted_at is null) into v_has_body;
  if v_has_body then
    select count(*) into v_specs from test_specs x where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null;
    if v_specs = 0 then
      if v_reason is null then return jsonb_build_object('ok', false, 'code', 'NO_SPEC'); end if;
      update tickets set no_spec_reason = v_reason where id = t.id;
    end if;
  end if;
  v_ctx := app.ticket_job_context(p_ticket);
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode, created_by)
    values (t.tenant_id, t.scope_id, v_me, 'queued', v_ctx->>'prompt',
            case when (v_ctx->>'agent_member_id')::uuid = v_me then v_ctx->>'agent_session_id' end,
            'ticket', 'manual', v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, 'make', 'queued', v_job, v_me, v_me) returning id into v_run;
  perform app.ticket_stage_to(t.id, 'running', v_me);
  update tickets set delegated_to_clone = true where id = t.id;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'のAI に任せました');
  return jsonb_build_object('ok', true, 'run_id', v_run, 'job_id', v_job,
                            'pc', case when app.account_pc_live(v_me) then 'live' else 'asleep' end);
end $$;
revoke all on function app.ticket_delegate(uuid, text) from public;
grant execute on function app.ticket_delegate(uuid, text) to kaname_app;

