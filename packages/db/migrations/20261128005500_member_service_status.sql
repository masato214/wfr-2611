-- 20261128005500 ログイン後の稼働状況と上の帯（K-955・getServiceStatusForMember・D-156.10・D-156.27・D-156.45・関門 C2・読むだけ）
--   列も表も足さない。届け先（誰に・出したか）は K-954 の app.notice_for_tenant の 1 か所を使う（同じ決めを 2 つ作らない）。
--   ① app.member_status_ok()：頭の確かめの 1 か所（K-969 が「中を見ている運営の人」を足す）
--   ② app.member_service_status()：{ components, bands, maintenance_now }
--      様子 components（web・runs・pc の 3 行）：見えるお知らせに結んだ直っていない障害の notices.affects の重い方（down ＞ degraded）。出す場所は見ない（0105 と同じ）
--      帯 bands：障害 → メンテ → 止める日 → 中を見る。種類ごとに 1 つまで・同じ種類のほかの数を more
--      いま中のメンテ maintenance_now：見えるお知らせで from <= now() < to の物（出す場所は見ない・予定は入れない）。終わりの早い物の { from, to }
--   ③ app.member_stop_band()・app.member_peek_band()：この葉では null（K-970・K-969 が create or replace で中身を入れる）
--   帯の関数は本体の中で名前で呼ぶ（plpgsql）。呼べなければ例外のまま口に返し、口は 503（ふつうを返さない・G-15）
--   時刻の比べは DB の now()。運営の本文・メモ・テナントの id は返さない（帯の題とお知らせの id だけ）

create or replace function app.member_status_ok() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.role() = 'member' and app.tenant_id() is not null and app.user_id() is not null
$$;

create or replace function app.member_stop_band() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select null::jsonb
$$;

create or replace function app.member_peek_band() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select null::jsonb
$$;

create or replace function app.member_service_status() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid;
  v_ops uuid := app.ops_tenant_id();
  v_components jsonb;
  v_incident jsonb;
  v_maint jsonb;
  v_stop jsonb;
  v_peek jsonb;
  v_now jsonb;
  v_bands jsonb := '[]'::jsonb;
  v_open uuid[];
begin
  if not coalesce(app.member_status_ok(), false) then
    raise exception '稼働状況を読めるのはワークスペースの人だけ' using errcode = 'insufficient_privilege';
  end if;
  v_tenant := app.tenant_id();

  -- 見えるお知らせに結んだ、直っていない障害
  select coalesce(array_agg(i.id), '{}'::uuid[]) into v_open
    from status_incidents i
    join notices n on n.id = i.notice_id
   where i.tenant_id = v_ops and i.deleted_at is null
       and i.state <> 'resolved' and i.resolved_at is null
       and n.tenant_id = v_ops and n.deleted_at is null
       and app.notice_for_tenant(n.id, v_tenant);

  -- 様子（並びは固定）
  select jsonb_agg(jsonb_build_object('key', c.key, 'label', c.label, 'state',
           case coalesce((select max(case n.affects->>c.key when 'down' then 2 when 'degraded' then 1 else 0 end)
                            from status_incidents o join notices n on n.id = o.notice_id where o.id = any(v_open)), 0)
             when 2 then 'down' when 1 then 'degraded' else 'normal' end)
         order by c.ord)
    into v_components
    from (values (1, 'web', '画面'), (2, 'runs', '分身の実行'), (3, 'pc', 'PC とのつながり')) as c(ord, key, label);

  -- 障害の帯：帯の場所がある・始まりの新しい 1 つと、ほかの数
  select jsonb_build_object(
           'kind', 'incident',
           'notice_id', n.id,
           'title', n.title,
           'note', coalesce(
                     (select u.body from notice_updates u
                       where u.notice_id = n.id and u.deleted_at is null
                       order by u.created_at desc, u.id desc limit 1),
                     nullif(split_part(coalesce(n.body, ''), E'\n', 1), '')),
           'ref', 'INC-' || to_char(o.started_at at time zone 'Asia/Tokyo', 'YYMM') || '-' || lpad((
                    select count(*) from status_incidents s
                     where s.tenant_id = v_ops and s.deleted_at is null and s.started_at is not null
                       and to_char(s.started_at at time zone 'Asia/Tokyo', 'YYMM') = to_char(o.started_at at time zone 'Asia/Tokyo', 'YYMM')
                       and (s.started_at, s.id) <= (o.started_at, o.id))::text, 2, '0'),
           'state', o.state,
           'from', o.started_at,
           'to', null,
           'closable', true,
           'more', (select count(*) from status_incidents p join notices m on m.id = p.notice_id
                     where p.id = any(v_open) and 'banner' = any(m.placements) and p.started_at is not null) - 1)
    into v_incident
    from status_incidents o
    join notices n on n.id = o.notice_id
   where o.id = any(v_open) and 'banner' = any(n.placements) and o.started_at is not null
   order by o.started_at desc, o.id desc
   limit 1;

  -- メンテの帯：帯の場所がある・予定といま中（終わっていない）・始まりの早い 1 つと、ほかの数
  with m as (
    select n.* from notices n
     where n.tenant_id = v_ops and n.deleted_at is null
       and n.kind_id = 'maintenance' and 'banner' = any(n.placements)
       and n.maintenance_from is not null and n.maintenance_to is not null and n.maintenance_to > now()
       and app.notice_for_tenant(n.id, v_tenant)
  )
  select jsonb_build_object(
           'kind', 'maintenance',
           'notice_id', m.id,
           'title', m.title,
           'note', coalesce(m.impact, nullif(split_part(coalesce(m.body, ''), E'\n', 1), '')),
           'ref', null,
           'state', null,
           'from', m.maintenance_from,
           'to', m.maintenance_to,
           'closable', true,
           'more', (select count(*) from m) - 1)
    into v_maint
    from m
   order by m.maintenance_from, m.id
   limit 1;

  v_stop := app.member_stop_band();
  v_peek := app.member_peek_band();
  if v_incident is not null then v_bands := v_bands || jsonb_build_array(v_incident); end if;
  if v_maint is not null then v_bands := v_bands || jsonb_build_array(v_maint); end if;
  if v_stop is not null then v_bands := v_bands || jsonb_build_array(v_stop); end if;
  if v_peek is not null then v_bands := v_bands || jsonb_build_array(v_peek); end if;

  -- いま中のメンテ（出す場所・種類は見ない・予定は入れない）
  select jsonb_build_object('from', n.maintenance_from, 'to', n.maintenance_to)
    into v_now
    from notices n
   where n.tenant_id = v_ops and n.deleted_at is null
     and n.maintenance_from is not null and n.maintenance_to is not null
     and n.maintenance_from <= now() and now() < n.maintenance_to
     and app.notice_for_tenant(n.id, v_tenant)
   order by n.maintenance_to, n.maintenance_from, n.id
   limit 1;

  return jsonb_build_object('components', v_components, 'bands', v_bands, 'maintenance_now', v_now);
end $$;

revoke all on function app.member_status_ok(), app.member_stop_band(), app.member_peek_band(), app.member_service_status() from public;
grant execute on function app.member_status_ok(), app.member_stop_band(), app.member_peek_band(), app.member_service_status() to kaname_app;
