-- 20261128010300_ops_workspaces 運営の外枠の数（getOpsShell）と全社の一覧（listOpsWorkspaces）を作る（K-963・関門 C2・D-156.3・D-156.4・D-156.23・D-156.24・D-156.35・D-156.49・D-156.51・D-156.72）
--   ① tenants に止める印の 4 列（D-156.23）を足す。書くのは K-970 の関数だけ。この葉は読むだけ
--   ② app.workspace_facts(会社)：一覧の 1 行の 11 欄（数と種類だけ・中身を返さない・D-156.3）。内部用（kaname_app に渡さない）
--      プランは app.tenant_plan_id（K-954・K-961）、人数は app.tenant_seat_count（K-961）の 1 か所を呼ぶ（顧客の側と同じ決め）
--   ③ app.ops_shell()：運営の外枠の 6 欄（D-156.4）。④ app.ops_workspaces(q, view, plan, sort, limit)：絞り込み・探す・並び
--   ③④ は頭で app.ops_require('any')（K-947 の型・2 層目）。読むだけなので運営の記録は書かない（D-128.108 は書く操作だけ）
--   数える会社：消していない・作りかけでない・運営の会社でない。日付は日本の暦（Asia/Tokyo）

alter table tenants
  add column if not exists stopped_at timestamptz,
  add column if not exists stop_on date,
  add column if not exists stop_reason_key text
    check (stop_reason_key is null or stop_reason_key in ('unpaid', 'violation', 'danger', 'request')),
  add column if not exists stop_noticed_at timestamptz;

-- 1 社の 11 欄。状態は 止めている（止めた時刻か、止める日が日本の今日以前・D-156.49）→ stopped が先・やめる手続き中 → closing・ほか active
create or replace function app.workspace_facts(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_month timestamptz := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  t record;
  v_plan record;
  v_state text;
  v_since timestamptz;
  v_seats integer;
  v_pc integer;
  v_runs integer;
  v_overdue_days integer;
  v_stuck integer;
  v_has_pc boolean;
  v_attention jsonb := '[]'::jsonb;
  v_billing text;
  v_admin text;
begin
  select x.id, x.name, x.created_at, x.stopped_at, x.stop_on, x.deletion_requested_at
    into t from tenants x where x.id = p_tenant;
  if not found then
    return null;
  end if;

  if t.stopped_at is not null or t.stop_on <= v_today then
    v_state := 'stopped';
    v_since := coalesce(t.stopped_at, t.stop_on::timestamp at time zone 'Asia/Tokyo');
  elsif t.deletion_requested_at is not null then
    v_state := 'closing';
    v_since := t.deletion_requested_at;
  else
    v_state := 'active';
    v_since := t.created_at;
  end if;

  select p.name, nullif(p.limits->>'members', '')::integer as member_limit
    into v_plan from plans p where p.id = app.tenant_plan_id(p_tenant);

  v_seats := app.tenant_seat_count(p_tenant);

  -- PC がつながる人：人数に数える社内の人（human・ゲスト〔requester〕でない）のうち、生きている知らせが 90 秒の内の PC を持つ人
  select count(distinct m.id)::integer into v_pc
    from members m
    join sessions s on s.member_id = m.id and s.tenant_id = p_tenant
   where m.tenant_id = p_tenant and m.kind_id = 'human' and m.deleted_at is null
     and not exists (select 1 from tenant_memberships tm
                      where tm.tenant_id = p_tenant and tm.member_id = m.id
                        and tm.deleted_at is null and tm.role = 'requester')
     and s.kind_id = 'bridge' and s.revoked_at is null and s.alive_at is not null
     and s.last_seen_at > now() - interval '90 seconds';

  select count(*)::integer into v_runs
    from action_runs r
   where r.tenant_id = p_tenant and r.phase is not null and r.status_id is not null
     and r.deleted_at is null and r.created_at >= v_month;

  -- 気にかける 3 つ（D-156.24 を D-156.72 で改めた・上限に近い会社は出さない）。並びは overdue → stuck → pc
  select v_today - min(i.due_on) into v_overdue_days
    from invoices i
   where i.tenant_id = p_tenant and i.issued_at is not null and i.deleted_at is null
     and i.status_id <> 'paid' and i.due_on < v_today;
  if v_overdue_days is not null then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object('kind', 'overdue', 'label_value', v_overdue_days));
  end if;

  select count(*)::integer into v_stuck
    from action_runs r
   where r.tenant_id = p_tenant and r.status_id = 'stopped' and r.deleted_at is null
     and r.created_at > now() - interval '7 days';
  if v_stuck >= 3 then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object('kind', 'stuck', 'label_value', v_stuck));
  end if;

  select exists (select 1 from sessions s
                  where s.tenant_id = p_tenant and s.kind_id = 'bridge' and s.alive_at is not null)
    into v_has_pc;
  if t.created_at < now() - interval '7 days' and not v_has_pc then
    v_attention := v_attention || jsonb_build_array(jsonb_build_object(
      'kind', 'pc', 'label_value', floor(extract(epoch from now() - t.created_at) / 86400)::integer));
  end if;

  -- 請求の状態：出した・消していない請求書のうちいちばん新しい 1 枚
  select case when i.status_id = 'paid' then 'paid'
              when i.due_on < v_today then 'overdue'
              else 'unpaid' end
    into v_billing
    from invoices i
   where i.tenant_id = p_tenant and i.issued_at is not null and i.deleted_at is null
   order by i.issued_at desc, i.id desc
   limit 1;

  select m.display_name into v_admin
    from tenant_memberships tm
    join members m on m.id = tm.member_id and m.tenant_id = p_tenant and m.deleted_at is null
   where tm.tenant_id = p_tenant and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null
   order by tm.joined_at nulls last, tm.created_at, m.id
   limit 1;

  return jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'admin_name', v_admin,
    'plan_name', v_plan.name,
    'members', jsonb_build_object('count', v_seats, 'limit', v_plan.member_limit),
    'pc', jsonb_build_object('connected', v_pc, 'total', v_seats),
    'runs_month', v_runs,
    'attention', v_attention,
    'billing_state', v_billing,
    'state', v_state,
    'state_since', v_since);
end $$;
revoke all on function app.workspace_facts(uuid) from public;

-- 運営の外枠の 6 欄（D-156.4・D-156.35）。お金の数はお金（money）を持つ人にだけ出す
create or replace function app.ops_shell() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_month timestamptz := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  v_prev timestamptz := (date_trunc('month', now() at time zone 'Asia/Tokyo') - interval '1 month') at time zone 'Asia/Tokyo';
  v_caps text[];
  v_inbox jsonb;
  v_invoices jsonb;
  v_ws jsonb;
  v_runs integer;
  v_runs_prev integer;
  v_pwned integer;
  v_counted uuid[];
begin
  v_ops := app.ops_require('any');
  select o.caps into v_caps from ops_members o where o.id = v_ops;

  select coalesce(array_agg(x.id), '{}'::uuid[]) into v_counted
    from tenants x
   where x.deleted_at is null and x.half_made_at is null and x.id <> app.ops_tenant_id();

  select jsonb_build_object(
           'unassigned', count(*) filter (where q.assignee_ops_member_id is null and q.state <> 'done'),
           'mine', count(*) filter (where q.assignee_ops_member_id = app.user_id() and q.state <> 'done'),
           'waiting', count(*) filter (where q.state = 'waiting'),
           'later', count(*) filter (where q.state = 'later'))
    into v_inbox
    from inquiries q
   where q.deleted_at is null and q.tenant_id = any(v_counted);

  if 'money' = any(coalesce(v_caps, '{}'::text[])) then
    select jsonb_build_object('overdue_count', count(*), 'overdue_amount', coalesce(sum(i.amount), 0)::bigint)
      into v_invoices
      from invoices i
     where i.issued_at is not null and i.deleted_at is null and i.status_id <> 'paid' and i.due_on < v_today
       and i.tenant_id = any(v_counted);
  end if;

  with f as (
    select app.workspace_facts(c.id) as j,
           (select p.key from plans p where p.id = app.tenant_plan_id(c.id)) as plan_key
      from unnest(v_counted) as c(id)
  )
  select jsonb_build_object(
           'total', count(*),
           'active', count(*) filter (where j->>'state' = 'active'),
           'stopped', count(*) filter (where j->>'state' = 'stopped'),
           'closing', count(*) filter (where j->>'state' = 'closing'),
           'attention', count(*) filter (where jsonb_array_length(j->'attention') > 0),
           'by_plan', jsonb_build_object(
             'free', count(*) filter (where plan_key = 'free'),
             'team', count(*) filter (where plan_key = 'team'),
             'business', count(*) filter (where plan_key = 'business')))
    into v_ws
    from f;

  select count(*) filter (where r.created_at >= v_month)::integer,
         count(*) filter (where r.created_at >= v_prev and r.created_at < v_month)::integer
    into v_runs, v_runs_prev
    from action_runs r
   where r.phase is not null and r.status_id is not null and r.deleted_at is null
     and r.created_at >= v_prev and r.tenant_id = any(v_counted);

  -- 照合が使えなかった登録：最後の「確かめた」より後に出来事がある会社の数（0086 と同じ見方）
  select count(*)::integer into v_pwned
    from unnest(v_counted) as c(id)
   where exists (
     select 1 from security_events e
      where e.tenant_id = c.id and e.kind_id = 'pwned_check_unavailable'
        and e.occurred_at > coalesce(
          (select max(a.occurred_at) from security_events a
            where a.tenant_id = c.id and a.kind_id = 'pwned_check_acknowledged'), '-infinity'::timestamptz));

  return jsonb_build_object(
    'operator', jsonb_build_object('member_id', app.user_id(), 'caps', to_jsonb(coalesce(v_caps, '{}'::text[]))),
    'inbox', v_inbox,
    'invoices', v_invoices,
    'workspaces', v_ws,
    'runs_month', jsonb_build_object(
      'count', v_runs,
      'prev_ratio', case when v_runs_prev = 0 then null else round(v_runs::numeric / v_runs_prev, 2) end),
    'pwned', jsonb_build_object('unchecked', v_pwned));
end $$;
revoke all on function app.ops_shell() from public;
grant execute on function app.ops_shell() to kaname_app;

-- 全社の一覧。q は名前か管理者のメールの一部（NFKC・小文字・前後の空白を落として比べる・メールは返さない）。
--   並び：attention＝気にかけるのある会社を上に、その中は最初の種類の順（overdue・stuck・pc）・同じなら名前／members／runs は多い順・同じなら名前
create or replace function app.ops_workspaces(p_q text, p_view text, p_plan text, p_sort text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_q text;
  v_view text := coalesce(p_view, 'all');
  v_sort text := coalesce(p_sort, 'attention');
  v_rows jsonb;
begin
  v_ops := app.ops_require('any');
  v_q := nullif(lower(btrim(normalize(coalesce(p_q, ''), NFKC))), '');

  with c as (
    select x.id, x.name from tenants x
     where x.deleted_at is null and x.half_made_at is null and x.id <> app.ops_tenant_id()
       and (v_q is null
            or strpos(lower(normalize(x.name, NFKC)), v_q) > 0
            or exists (select 1 from tenant_memberships tm
                         join kaname_auth."user" u on u.id = tm.auth_user_id
                        where tm.tenant_id = x.id and tm.role = 'admin' and tm.deleted_at is null
                          and strpos(lower(normalize(u.email, NFKC)), v_q) > 0))
  ), f as (
    select c.name, app.workspace_facts(c.id) as j,
           (select p.key from plans p where p.id = app.tenant_plan_id(c.id)) as plan_key
      from c
  ), g as (
    select f.*,
           case f.j->'attention'->0->>'kind' when 'overdue' then 0 when 'stuck' then 1 when 'pc' then 2 else 9 end as att_rank
      from f
     where (v_view = 'all'
            or (v_view = 'attention' and jsonb_array_length(f.j->'attention') > 0)
            or (v_view in ('stopped', 'closing') and f.j->>'state' = v_view))
       and (p_plan is null or f.plan_key = p_plan)
  ), o as (
    select g.j,
           row_number() over (order by
             case when v_sort = 'attention' then g.att_rank end,
             case when v_sort = 'members' then (g.j->'members'->>'count')::integer end desc nulls last,
             case when v_sort = 'runs' then (g.j->>'runs_month')::integer end desc nulls last,
             g.name, g.j->>'id') as n
      from g
  )
  select coalesce(jsonb_agg(o.j order by o.n), '[]'::jsonb) into v_rows
    from o
   where p_limit is null or o.n <= p_limit;

  return jsonb_build_object('data', v_rows);
end $$;
revoke all on function app.ops_workspaces(text, text, text, text, integer) from public;
grant execute on function app.ops_workspaces(text, text, text, text, integer) to kaname_app;

insert into app.schema_migrations (name) values ('20261128010300_ops_workspaces.sql') on conflict do nothing;
