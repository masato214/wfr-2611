-- 20261125024100 PC の側：ブラウザの様子と仕事に付いたファイル（K-761・D-119・D-104.11・D-128.163・関門 C2）
--   ① 仕事の出来事の種類に browser を足す（0056 の 15 種を全部写して 1 つ足す。同じ check を作り直す葉は、後に入る方がこの 16 種を含める）
--   ② app.bridge_browser_report：その仕事を受け取った PC だけ・動いている仕事だけ。同じ（ブラウザ・様子）は 1 行だけ（二重送信・同時の 2 つでも）
--   ③ app.bridge_job_file：その仕事に付いた資料（消していない）の置き場の場所と、署名の主語（会社・仕事の持ち主）。前の道すじの app.bridge_attachment（0042）の中身を移した
-- squawk-ignore ban-drop-constraint
alter table bridge_job_events drop constraint if exists bridge_job_events_kind_check;
alter table bridge_job_events add constraint bridge_job_events_kind_check
  check (kind in ('init', 'progress', 'ask', 'answer', 'tool', 'usage', 'status', 'plan', 'steer', 'stop', 'question', 'limit', 'reply', 'blocked', 'notice', 'browser'));

create or replace function app.bridge_browser_report(p_session uuid, p_job uuid, p_browser text, p_state text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype;
begin
  if p_browser is null or p_browser not in ('chrome', 'dedicated') or p_state is null or p_state not in ('using', 'off') then
    return jsonb_build_object('error', 'bad_value');
  end if;
  select * into j from bridge_jobs
   where id = app.bridge_job_of(p_session, p_job) and state_id in ('running', 'asking')
   for update;
  if j.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if exists (select 1 from bridge_job_events e
              where e.job_id = j.id and e.kind = 'browser'
                and e.payload->>'browser' = p_browser and e.payload->>'state' = p_state) then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'browser', 0, jsonb_build_object('browser', p_browser, 'state', p_state));
  return jsonb_build_object('ok', true, 'recorded', true);
end $$;
revoke all on function app.bridge_browser_report(uuid, uuid, text, text) from public;
grant execute on function app.bridge_browser_report(uuid, uuid, text, text) to kaname_app;

create or replace function app.bridge_job_file(p_session uuid, p_job uuid, p_ref uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v jsonb;
begin
  select jsonb_build_object('storage_ref', a.storage_ref, 'name', a.name, 'mime', a.mime, 'size', a.size,
                            'tenant_id', a.tenant_id, 'member_id', j.member_id) into v
    from bridge_jobs j
    join attachments a on a.id = p_ref and a.id = any(coalesce(j.attachment_ids, '{}')) and a.deleted_at is null
   where j.id = app.bridge_job_of(p_session, p_job) and j.state_id in ('running', 'asking');
  return v;
end $$;
revoke all on function app.bridge_job_file(uuid, uuid, uuid) from public;
grant execute on function app.bridge_job_file(uuid, uuid, uuid) to kaname_app;
