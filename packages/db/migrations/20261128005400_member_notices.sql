-- 20261128005400 顧客がお知らせを読む・読んだ印（K-954・D-156.10・D-156.27・D-156.28・D-156.33・D-156.57・関門 C2）
--   ① notices に列 3 つ：target_tenant_ids（誰にの「ワークスペースを選ぶ」）・impact（メンテの影響）・admins_only（管理者だけ）
--   ② 続報の履歴の表 notice_updates（書くのは運営の葉 K-977・K-979。会社の人は表を読めず、一覧の関数だけが返す）
--   ③ notice_deliveries は同じ会社・同じ人・同じお知らせに消していない 1 行（前の重なりは消した印を付けてから一意の索引）
--   ④ 届け先の決めは 1 か所（app.notice_for_tenant）。管理者だけは app.notice_for_member が足す。一覧 app.member_notices・読んだ印 app.member_notice_read
--   運営のお知らせは鈴に出さない（notifications を書かない・D-156.28）。時刻の比べは DB の now()

-- ① 列
alter table notices add column if not exists target_tenant_ids uuid[];
alter table notices add column if not exists impact text;
alter table notices add column if not exists admins_only boolean not null default false;

-- ② 続報の表
create table if not exists notice_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  notice_id uuid not null references notices(id),
  state text not null check (state in ('investigating', 'identified', 'monitoring', 'resolved')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists notice_updates_tenant_idx on notice_updates (tenant_id);
create index if not exists notice_updates_notice_idx on notice_updates (notice_id, created_at);
drop trigger if exists notice_updates_updated_at on notice_updates;
create trigger notice_updates_updated_at before update on notice_updates for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('notice_updates', 'notice_updates') on conflict do nothing;
grant select, insert, update, delete on notice_updates to kaname_app;

-- ③ 既読は人ごとに 1 行（前の重なりは最初の 1 行を残して消した印）
update notice_deliveries d set deleted_at = now()
 where d.deleted_at is null
   and exists (
     select 1 from notice_deliveries e
      where e.deleted_at is null
        and e.tenant_id = d.tenant_id and e.notice_id = d.notice_id and e.member_id = d.member_id
        and (e.created_at, e.id) < (d.created_at, d.id));
create unique index if not exists notice_deliveries_member_uq
  on notice_deliveries (tenant_id, notice_id, member_id) where deleted_at is null;

-- ④ 関数
-- その会社の今のプラン：消していない・終わっていない契約の始まりの新しい 1 つ。無ければ運営の会社の free（無ければ null）
create or replace function app.tenant_plan_id(p_tenant uuid) returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(
    (select s.plan_id from subscriptions s
      where s.tenant_id = p_tenant and s.deleted_at is null and s.ended_at is null and s.plan_id is not null
      order by s.started_at desc nulls last, s.created_at desc, s.id desc
      limit 1),
    (select p.id from plans p where p.tenant_id = app.ops_tenant_id() and p.key = 'free' and p.deleted_at is null limit 1))
$$;

-- 届け先の決め（1 か所）：運営の会社の行・消していない・題がある／出した（予定の日時を過ぎたら出る）／誰に（全部・プラン・ワークスペース）
create or replace function app.notice_for_tenant(p_notice uuid, p_tenant uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  n notices%rowtype;
begin
  if p_notice is null or p_tenant is null then return false; end if;
  select * into n from notices
   where id = p_notice and tenant_id = app.ops_tenant_id() and deleted_at is null and title is not null;
  if not found then return false; end if;
  if not (n.state = 'published' or (n.state = 'scheduled' and n.publish_at is not null and n.publish_at <= now())) then
    return false;
  end if;
  if coalesce(cardinality(n.target_plan_ids), 0) = 0
     and coalesce(cardinality(n.target_tenant_ids), 0) = 0
     and n.target_tenant_id is null then
    return true;
  end if;
  return coalesce(app.tenant_plan_id(p_tenant) = any(n.target_plan_ids), false)
      or coalesce(p_tenant = any(n.target_tenant_ids), false)
      or coalesce(p_tenant = n.target_tenant_id, false);
end $$;

-- その人に見えるか：会社に届いて、管理者だけの物はその会社の管理者（active・消していない）だけ（D-156.57）
create or replace function app.notice_for_member(p_notice uuid, p_tenant uuid, p_member uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if not app.notice_for_tenant(p_notice, p_tenant) then return false; end if;
  if not coalesce((select n.admins_only from notices n where n.id = p_notice), false) then return true; end if;
  return exists (
    select 1 from tenant_memberships m
     where m.tenant_id = p_tenant and m.member_id = p_member
       and m.role = 'admin' and m.status = 'active' and m.deleted_at is null);
end $$;

-- 一覧：会社の人だけ（2 層目）。一覧の場所がある物・種類・読んでいない物で絞り、出した時刻の新しい順に p_limit 件
create or replace function app.member_notices(p_kind text, p_unread boolean, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_member uuid := app.user_id();
  r jsonb;
begin
  if app.role() is distinct from 'member' or v_tenant is null or v_member is null then
    raise exception 'お知らせを読めるのはワークスペースの人だけ' using errcode = 'insufficient_privilege';
  end if;
  with seen as (
    select n.*,
           coalesce(n.publish_at, n.created_at) as shown_at,
           not exists (
             select 1 from notice_deliveries d
              where d.tenant_id = v_tenant and d.notice_id = n.id and d.member_id = v_member
                and d.read_at is not null and d.deleted_at is null) as is_unread
      from notices n
     where n.tenant_id = app.ops_tenant_id() and n.deleted_at is null
       and 'list' = any(n.placements)
       and (p_kind is null or n.kind_id = p_kind)
       and app.notice_for_member(n.id, v_tenant, v_member)
  ), picked as (
    select * from seen
     where not coalesce(p_unread, false) or is_unread
     order by shown_at desc, id desc
     limit greatest(coalesce(p_limit, 0), 0)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'kind', p.kind_id,
           'title', p.title,
           'body', p.body,
           'state', case when p.kind_id = 'incident' then (
                      select i.state from status_incidents i
                       where i.notice_id = p.id and i.deleted_at is null
                       order by i.created_at desc, i.id desc limit 1) end,
           'published_at', p.shown_at,
           'unread', p.is_unread,
           'maintenance', case when p.maintenance_from is not null and p.maintenance_to is not null
                            then jsonb_build_object('from', p.maintenance_from, 'to', p.maintenance_to, 'impact', p.impact) end,
           'updates', coalesce((
                        select jsonb_agg(jsonb_build_object('state', u.state, 'body', u.body, 'at', u.created_at)
                                         order by u.created_at, u.id)
                          from notice_updates u
                         where u.notice_id = p.id and u.deleted_at is null), '[]'::jsonb)
         ) order by p.shown_at desc, p.id desc), '[]'::jsonb)
    into r
    from picked p;
  return r;
end $$;

-- 読んだ印：会社の人だけ（2 層目）。見えなければ not_found（何も書かない）。行は人ごとに 1 つ・2 回目は最初の read_at のまま
create or replace function app.member_notice_read(p_notice uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_member uuid := app.user_id();
  v_read timestamptz;
begin
  if app.role() is distinct from 'member' or v_tenant is null or v_member is null then
    raise exception 'お知らせを読めるのはワークスペースの人だけ' using errcode = 'insufficient_privilege';
  end if;
  if not app.notice_for_member(p_notice, v_tenant, v_member) then
    return jsonb_build_object('error', 'not_found');
  end if;
  insert into notice_deliveries (tenant_id, notice_id, member_id, delivered_at, read_at, created_by)
  values (v_tenant, p_notice, v_member, now(), now(), v_member)
  on conflict (tenant_id, notice_id, member_id) where deleted_at is null do nothing;
  select read_at into v_read from notice_deliveries
   where tenant_id = v_tenant and notice_id = p_notice and member_id = v_member and deleted_at is null
   limit 1;
  if v_read is null then
    update notice_deliveries set read_at = now(), updated_by = v_member
     where tenant_id = v_tenant and notice_id = p_notice and member_id = v_member and deleted_at is null
     returning read_at into v_read;
  end if;
  return jsonb_build_object('data', jsonb_build_object('id', p_notice, 'read_at', v_read));
end $$;

revoke all on function app.tenant_plan_id(uuid), app.notice_for_tenant(uuid, uuid), app.notice_for_member(uuid, uuid, uuid),
  app.member_notices(text, boolean, int), app.member_notice_read(uuid) from public;
grant execute on function app.tenant_plan_id(uuid), app.notice_for_tenant(uuid, uuid), app.notice_for_member(uuid, uuid, uuid),
  app.member_notices(text, boolean, int), app.member_notice_read(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('20261128005400_member_notices.sql') on conflict do nothing;
