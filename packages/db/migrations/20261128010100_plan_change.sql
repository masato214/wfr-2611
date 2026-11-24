-- 20261128010100 選べるプランとプランを変える（K-961・契約の口 listWorkspacePlans・changePlan・D-128.65・D-156.31・D-156.36・D-156.43・D-156.51・D-156.68・関門 C2）
--   ① 頼みの行の列：効く日・日割りの額（税込の円・下げは 0）。請求書を出す葉 K-981 が読む
--   ② 今のプランの決め app.tenant_plan_id（K-954）を「効いている契約＝始まっていて終わっていない行」に直す（下げる予定の行を今のプランと読まない）
--   ③ 人数の数え方 app.tenant_seat_count（消していない人のメンバーで、ゲスト＝役割 requester の所属が無い人だけ）。数える所はどれもこれを呼ぶ
--   ④ プランの 1 行の説明とおすすめの印（種・運営が直した値を上書きしない）
--   ⑤ 日割り app.plan_prorate・選べるプラン app.workspace_plans・プランを変える app.plan_change
--   暦はどれも日本（Asia/Tokyo）。次の請求日は来月 1 日。お知らせ・メールは送らない（D-125.130）

-- ① 頼みの行
alter table plan_change_requests add column effective_from date;
alter table plan_change_requests add column prorated_amount integer;

-- ② 今のプラン：効いている契約（消していない・始まっている・終わっていない）の新しい 1 つ。無ければ運営の会社の無料
create or replace function app.tenant_plan_id(p_tenant uuid) returns uuid
language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select s.plan_id from subscriptions s
      where s.tenant_id = p_tenant and s.deleted_at is null
        and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())
      order by s.started_at desc limit 1),
    (select p.id from plans p where p.tenant_id = app.ops_tenant_id() and p.key = 'free' and p.deleted_at is null limit 1))
$$;
revoke all on function app.tenant_plan_id(uuid) from public;

-- ③ 人数（D-156.36・D-156.51）：AI 社員・自分の AI・消した人・ゲスト（その会社の所属の行が role requester）は数えない
create or replace function app.tenant_seat_count(p_tenant uuid) returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select count(*)::int from members m
   where m.tenant_id = p_tenant and m.kind_id = 'human' and m.deleted_at is null
     and not exists (select 1 from tenant_memberships tm
                      where tm.tenant_id = p_tenant and tm.member_id = m.id
                        and tm.deleted_at is null and tm.role = 'requester')
$$;
revoke all on function app.tenant_seat_count(uuid) from public;

-- ④ プランの 1 行の説明（D-156.63）とおすすめの印（D-156.68）。運営が直した値・付けた印を上書きしない
update plans set limits = coalesce(limits, '{}'::jsonb) || jsonb_build_object('summary', v.summary)
  from (values ('free', 'チケット・承認・ナレッジ'), ('team', '＋ ゲストを招く'), ('business', '＋ ゲストのグループ')) as v(key, summary)
 where plans.tenant_id = app.ops_tenant_id() and plans.key = v.key and plans.deleted_at is null
   and not (coalesce(plans.limits, '{}'::jsonb) ? 'summary');
update plans set limits = coalesce(limits, '{}'::jsonb) || '{"recommended": true}'::jsonb
 where tenant_id = app.ops_tenant_id() and key = 'business' and deleted_at is null
   and not (coalesce(limits, '{}'::jsonb) ? 'recommended');

-- ⑤ 日割り（D-156.31）：月の値段の差（税別）× 今日を含む残りの日 ÷ その月の日数（切り捨て）に消費税 10%（切り捨て）。円の整数
create or replace function app.plan_prorate(p_diff numeric) returns integer
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_dim int := extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int;
  v_rest int := v_dim - extract(day from v_today)::int + 1;
  v_base bigint;
begin
  if p_diff is null or p_diff <= 0 then return 0; end if;
  v_base := floor(p_diff * v_rest / v_dim);
  return floor(v_base * 110 / 100)::int;
end $$;
revoke all on function app.plan_prorate(numeric) from public;

-- 選べるプラン。答えは { data: [12 欄], meta: { members, member_limit } } か { error: forbidden }
create or replace function app.workspace_plans() returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_tenant uuid := app.tenant_id();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_next date := (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month')::date;
  v_dim int := extract(day from (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month - 1 day'))::int;
  v_members int; v_cur uuid; v_cur_price numeric; v_cur_limit int; v_since date; v_rows jsonb;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(app.user_id(), 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_members := app.tenant_seat_count(v_tenant);
  v_cur := app.tenant_plan_id(v_tenant);
  select coalesce(p.price_monthly, 0), (p.limits->>'members')::int into v_cur_price, v_cur_limit from plans p where p.id = v_cur;
  v_cur_price := coalesce(v_cur_price, 0);
  -- 今のプランの効いた日：効いている契約の始まり。契約が無ければ会社を作った日
  select (s.started_at at time zone 'Asia/Tokyo')::date into v_since from subscriptions s
   where s.tenant_id = v_tenant and s.deleted_at is null and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())
   order by s.started_at desc limit 1;
  if v_since is null then
    select (t.created_at at time zone 'Asia/Tokyo')::date into v_since from tenants t where t.id = v_tenant;
  end if;

  with p as (
    select pl.id, pl.key, pl.name, coalesce(pl.price_monthly, 0) as price, (pl.limits->>'members')::int as lim,
           coalesce(pl.limits->>'summary', '') as summary,
           coalesce((pl.limits->>'recommended')::boolean, false) as mark
      from plans pl where pl.tenant_id = app.ops_tenant_id() and pl.deleted_at is null
  ), r as (
    select p.*, p.id = v_cur as cur,
           p.id <> v_cur and not (p.lim is not null and v_members > p.lim) as can,
           p.price > v_cur_price as up
      from p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'plan_key', r.key, 'name', r.name, 'price_monthly', r.price::int, 'member_limit', r.lim,
           'current', r.cur, 'can_choose', r.can,
           'reason', case when r.cur then 'いまのプランです'
                          when not r.can then format('いま %s 人なので、%s 人までのプランには下げられません', v_members, r.lim) end,
           'effective_from', case when r.cur then v_since when r.up then v_today else v_next end,
           'summary', r.summary,
           'recommended', r.mark,
           'upgrade', case when r.up and r.can then jsonb_build_object(
                        'days', v_dim - extract(day from v_today)::int + 1,
                        'amount', app.plan_prorate(r.price - v_cur_price),
                        'invoice_on', v_next) end,
           'upcoming', null)
         order by r.price, r.key), '[]'::jsonb) into v_rows
    from r;
  return jsonb_build_object('data', v_rows, 'meta', jsonb_build_object('members', v_members, 'member_limit', v_cur_limit));
end $$;
revoke all on function app.workspace_plans() from public;
grant execute on function app.workspace_plans() to kaname_app;

-- プランを変える。答えは { data: { plan_key, effective_from, prorated_amount, next_invoice_on } } か { error[, detail] }。
--   見る順：能力 → forbidden／鍵のプランが無い・消した → not_found／今のプランで予定が無い → same_plan（予定があれば取り消す）／
--   人数が上限を超える → over_limit。会社の行を for update で取るので、同時の 2 つは順に（後の方は前の結果を見る）。
--   上げる＝すぐ（効いている行を今で終え、新しい行を今から）・下げる＝来月 1 日 0 時（日本）から（無料なら新しい行を作らない）。
--   書く所の失敗（例外）はそのまま上げる（1 つの取引なので何も残らない・口が 503）
create or replace function app.plan_change(p_key text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_next date := (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month')::date;
  v_next_at timestamptz; v_to plans%rowtype; v_cur plans%rowtype; v_live subscriptions%rowtype;
  v_sched boolean; v_lim int; v_members int; v_eff date; v_amount int := 0; v_status text;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(v_me, 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_next_at := v_next::timestamp at time zone 'Asia/Tokyo';
  perform 1 from tenants where id = v_tenant for update;

  select * into v_to from plans where tenant_id = app.ops_tenant_id() and key = p_key and deleted_at is null;
  if v_to.id is null then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_live from subscriptions s
   where s.tenant_id = v_tenant and s.deleted_at is null and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())
   order by s.started_at desc limit 1;
  select * into v_cur from plans where id = app.tenant_plan_id(v_tenant);
  -- 予定の下げ：まだ始まっていない行か、効いている行に終わりの時刻がある
  v_sched := v_live.ended_at is not null
          or exists (select 1 from subscriptions where tenant_id = v_tenant and deleted_at is null and started_at > now());

  if v_to.id = v_cur.id then
    if not v_sched then return jsonb_build_object('error', 'same_plan'); end if;
    -- 予定を取り消して今のプランのまま
    update subscriptions set deleted_at = now(), updated_by = v_me
     where tenant_id = v_tenant and deleted_at is null and started_at > now();
    if v_live.id is not null then
      update subscriptions set ended_at = null, updated_by = v_me where id = v_live.id;
    end if;
    update plan_change_requests set status_id = 'cancelled', updated_by = v_me
     where tenant_id = v_tenant and deleted_at is null and status_id = 'scheduled';
    perform app.record_audit('plan.change', 'tenants', v_tenant::text, 'C2',
      jsonb_build_object('from', v_cur.key, 'to', v_to.key, 'effective_from', v_today));
    return jsonb_build_object('data', jsonb_build_object(
      'plan_key', v_to.key, 'effective_from', v_today, 'prorated_amount', 0, 'next_invoice_on', v_next));
  end if;

  v_lim := (v_to.limits->>'members')::int;
  v_members := app.tenant_seat_count(v_tenant);
  if v_lim is not null and v_members > v_lim then
    return jsonb_build_object('error', 'over_limit', 'detail', jsonb_build_object('members', v_members, 'member_limit', v_lim));
  end if;

  -- 前の予定（まだ始まっていない行・頼みの行）を取り消す
  update subscriptions set deleted_at = now(), updated_by = v_me
   where tenant_id = v_tenant and deleted_at is null and started_at > now();
  update plan_change_requests set status_id = 'cancelled', updated_by = v_me
   where tenant_id = v_tenant and deleted_at is null and status_id = 'scheduled';

  if coalesce(v_to.price_monthly, 0) > coalesce(v_cur.price_monthly, 0) then
    -- 上げる：すぐ。日割りは次の請求書に（K-981）
    if v_live.id is not null then
      update subscriptions set ended_at = now(), updated_by = v_me where id = v_live.id;
    end if;
    insert into subscriptions (tenant_id, plan_id, status_id, started_at, created_by)
      values (v_tenant, v_to.id, 'active', now(), v_me);
    v_eff := v_today;
    v_amount := app.plan_prorate(coalesce(v_to.price_monthly, 0) - coalesce(v_cur.price_monthly, 0));
    v_status := 'applied';
  else
    -- 下げる：来月 1 日 0 時から。無料は契約の行を作らない（契約なし＝無料）
    if v_live.id is not null then
      update subscriptions set ended_at = v_next_at, updated_by = v_me where id = v_live.id;
    end if;
    if v_to.key <> 'free' then
      insert into subscriptions (tenant_id, plan_id, status_id, started_at, created_by)
        values (v_tenant, v_to.id, 'active', v_next_at, v_me);
    end if;
    v_eff := v_next;
    v_status := 'scheduled';
  end if;

  insert into plan_change_requests (tenant_id, from_plan_id, to_plan_id, requested_by, status_id, effective_from, prorated_amount, created_by)
    values (v_tenant, v_cur.id, v_to.id, v_me, v_status, v_eff, v_amount, v_me);
  perform app.record_audit('plan.change', 'tenants', v_tenant::text, 'C2',
    jsonb_build_object('from', v_cur.key, 'to', v_to.key, 'effective_from', v_eff));
  return jsonb_build_object('data', jsonb_build_object(
    'plan_key', v_to.key, 'effective_from', v_eff, 'prorated_amount', v_amount, 'next_invoice_on', v_next));
end $$;
revoke all on function app.plan_change(text) from public;
grant execute on function app.plan_change(text) to kaname_app;
