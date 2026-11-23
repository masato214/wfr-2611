-- 20261123085900_run_takeover 止まった AI の仕事から「自分で直す」（K-485・契約の口 takeoverActionRun・関門 C2・D-090・D-125.143・D-128.26・D-128.39・D-129.3・D-129.11・D-129.47・D-130.4・D-131.13・D-151.17・D-151.18）
--   足すのは 列 1 つ（action_runs.taken_over_at）と関数 2 本（app.action_run_json の作り直し・app.run_takeover）。新しい表は作らない。
--   止まった実行は止める所（0092・0098・20261119120200 など約 10 の関数）がもう旗を下ろし・段を作業中にし・やり取りに 1 行を書いている。
--   だから止まった実行の「自分で直す」で新しく変わるのは taken_over_at・やり取りの 1 行・証跡の 3 つだけ。
--   旗と段が変わるのは、動いている・待っている実行を引き取るときだけ（仕事と実行をその場で止める）。止まった理由の文は書き換えない（履歴に残す）。
--   どの関数も security definer・search_path に pg_temp・public から外す（D-128.171）。

-- ① 実行の記録に「自分で進めることにした時刻」（止まった帯を引っ込める判断の印・画面は K-486）
alter table action_runs add column if not exists taken_over_at timestamptz;

-- ② 実行の 1 件の形（ActionRunView）に taken_over_at の 1 欄だけを足す。0092 の本体の写し（reason_kind は DB の関数に持たず、口の側で足す・P7）
create or replace function app.action_run_json(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; j bridge_jobs%rowtype; v_last timestamptz; v_progress text; v_pc text; v_return text; v_silent boolean;
begin
  select * into r from action_runs where id = p_run;
  if r.id is null then return null; end if;
  select * into j from bridge_jobs where id = r.bridge_job_id;
  select max(e.created_at) into v_last from bridge_job_events e where e.job_id = j.id;
  v_last := coalesce(greatest(v_last, j.started_at), j.created_at, r.created_at);
  select e.payload->>'text' into v_progress from bridge_job_events e
   where e.job_id = j.id and e.kind in ('status', 'progress') order by e.created_at desc, e.seq desc limit 1;
  -- 受け取った PC があればその PC、まだならその人のアカウントの PC のどれか（D-128.163）
  if j.taken_session_id is not null and r.status_id in ('running', 'asking') then
    select case when s.alive_at is not null and s.last_seen_at > now() - interval '75 seconds' then 'live' else 'asleep' end
      into v_pc from sessions s where s.id = j.taken_session_id and s.revoked_at is null;
  end if;
  v_pc := coalesce(v_pc, case when app.account_pc_live(r.created_by) then 'live' else 'asleep' end);
  -- 10 分（確認待ちは 30 分）知らせが無い（D-128.138・E-TO-005）。行は書き換えない
  v_silent := r.status_id in ('running', 'asking')
              and v_last < now() - case when r.status_id = 'asking' then interval '30 minutes' else interval '10 minutes' end;
  if r.phase = 'make' and r.approval_id is not null then
    select a.return_reason into v_return from approvals a where a.id = r.approval_id;
  end if;
  return jsonb_build_object(
    'id', r.id, 'ticket_id', r.ticket_id, 'phase', r.phase, 'status', r.status_id,
    'by', jsonb_build_object('member_id', r.created_by, 'display_name', app.member_name(r.created_by)),
    'pc', v_pc, 'silent', v_silent, 'last_event_at', v_last, 'progress', v_progress,
    'stopped_reason', case when r.status_id in ('stopped', 'cancelled') then coalesce(r.error_summary, j.stopped_reason) end,
    'return_reason', v_return,
    'started_at', r.started_at, 'finished_at', r.finished_at,
    'taken_over_at', r.taken_over_at,
    'checks', jsonb_build_object('state', 'none'));
end $$;
revoke all on function app.action_run_json(uuid) from public;

-- ③ 自分で直す（1 つの取引）。呼ぶのは要求の文脈の中（withTenant が app.tenant_id／app.user_id を入れた後）。
--   答えは {ok:true, run: 実行の 1 件} か {ok:false, code: FORBIDDEN|NOT_FOUND|ALREADY|DECIDED|STALE}。
--   錠の順は PC の口（終わる口）と同じ：仕事 → 実行 → チケット。同時に 2 つ来ても 1 つだけ通る（後の 1 つは ALREADY）
create or replace function app.run_takeover(p_run uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r action_runs%rowtype; t tickets%rowtype; j bridge_jobs%rowtype;
        v_stage text; v_job uuid; v_was text;
        v_why constant text := 'あなたが自分で進めることにしたので止めました';
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 錠を取る前に、仕事の id だけを読む（id は変わらない）
  select x.bridge_job_id into v_job from action_runs x where x.id = p_run and x.tenant_id = v_tenant;
  if v_job is not null then
    select * into j from bridge_jobs where id = v_job for update;
  end if;
  select * into r from action_runs
   where id = p_run and tenant_id = v_tenant and ticket_id is not null and deleted_at is null for update;
  if r.id is null then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into t from tickets where id = r.ticket_id and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(t.id) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  -- 担当者だけ（実行を始めた人ではない）。担当者がいないチケットは誰も切り替えられない
  if t.assignee_member_id is distinct from v_me then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if r.taken_over_at is not null then return jsonb_build_object('ok', false, 'code', 'ALREADY'); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  -- 引き取れるのは作る段の実行だけ。承認待ち・完了のチケット・承認の後の実行・作り終えた実行は今はできない
  if r.phase is distinct from 'make' or coalesce(v_stage, '') in ('awaiting_approval', 'done') or r.status_id = 'done' then
    return jsonb_build_object('ok', false, 'code', 'DECIDED');
  end if;
  -- そのチケットの一番新しい実行だけ（新しい実行を黙って止めない）
  if exists (select 1 from action_runs n where n.ticket_id = r.ticket_id and n.deleted_at is null
                and (n.created_at, n.id) > (r.created_at, r.id)) then
    return jsonb_build_object('ok', false, 'code', 'STALE');
  end if;
  v_was := r.status_id;
  -- 動いている・待っている実行は、その場で止める（PC には止める合図が届く。後から結果が返っても結果の口が拒む）
  if r.status_id in ('queued', 'running', 'asking') then
    update bridge_jobs set state_id = 'stopped', finished_at = now(), partial = null, stopped_reason = v_why
     where id = r.bridge_job_id and state_id in ('queued', 'running', 'asking');
    update action_runs set status_id = 'stopped', error_summary = v_why, finished_at = now() where id = r.id;
    if v_stage = 'running' then perform app.ticket_stage_to(t.id, 'doing', v_me); end if;
    update tickets set delegated_to_clone = false where id = t.id;
  end if;
  update action_runs set taken_over_at = now(), updated_by = v_me where id = r.id;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が自分で進めることにしました');
  perform app.record_audit('action_runs.takeover', 'action_runs', r.id::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'was', v_was));
  return jsonb_build_object('ok', true, 'run', app.action_run_json(r.id));
end $$;
revoke all on function app.run_takeover(uuid) from public;
grant execute on function app.run_takeover(uuid) to kaname_app;
