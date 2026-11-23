-- 20261128004500_ops_setup 運営の最初の 1 人とパスキーを付けるリンク（K-945・関門 C2・D-156.22・D-156.2・D-156.11・D-156.12）
--   ① 表 ops_setup_links：パスキーを付けるリンク（24 時間・1 回だけ）。印そのものは持たず sha256 の 16 進だけ。
--      行の守りを有効にし、アプリの役（kaname_app）の policy は作らない（関数だけが触る。命令は管理者の接続で書く）
--   ② app.ops_setup_consume(token_hash)：使えるリンク（使っていない・期限の内・生きている運営の人）なら使った印を付け、本人の認証の利用者の id を返す。
--      無い・使った・期限切れは null（どれかを見分けさせない）。for update で取り、同時に 2 回来ても 1 回だけ
--   ③ app.ops_login_check を置き換え（K-944 の止め）：パスキーでない道でも「その人のリンクを 5 分の内に使い、まだセッションを開いていない」ときだけ 'ok'
--      （使ったら開いた印を付ける＝1 本だけ）。ほかは今までどおり（運営の人がパスキーでない道で入る → 'passkey_only'）
--   ④ app.session_ops を置き換え（K-944 の解決）：入り方 'ops_setup' で生きている運営の人のセッションは 'setup'（パスキーを付けるだけ）
--   ⑤ sessions.login_kind の check に 'ops_setup' を足す
--   どの関数も security definer・search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）。

create table if not exists ops_setup_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  ops_member_id uuid not null references ops_members(id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  session_opened_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists ops_setup_links_member_idx on ops_setup_links (ops_member_id) where used_at is null;
alter table ops_setup_links enable row level security;
alter table ops_setup_links force row level security;
revoke all on ops_setup_links from kaname_app;

create or replace function app.ops_setup_consume(p_token_hash text) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_link uuid; v_user text;
begin
  select l.id, m.auth_user_id into v_link, v_user
    from ops_setup_links l
    join ops_members o on o.id = l.ops_member_id
    join members m on m.id = o.member_id
   where l.token_hash = p_token_hash and l.used_at is null and l.expires_at > now()
     and o.revoked_at is null and o.deleted_at is null
     and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
   for update of l;
  if v_link is null then return null; end if;
  update ops_setup_links set used_at = now() where id = v_link;
  return v_user;
end $$;
revoke all on function app.ops_setup_consume(text) from public;
grant execute on function app.ops_setup_consume(text) to kaname_app;

alter table sessions drop constraint if exists sessions_login_kind_ck;
alter table sessions add constraint sessions_login_kind_ck check (login_kind in ('passkey', 'ops_setup'));

-- 運営の人＝運営の会社の生きている members で、生きている ops_members がある人（K-944 と同じ条件）
create or replace function app.ops_login_check(p_auth_user_id text, p_via_passkey boolean) returns text
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare v_link uuid;
begin
  if coalesce(p_via_passkey, false) then return 'ok'; end if;
  if not exists (select 1 from members m join ops_members o on o.member_id = m.id
                  where m.auth_user_id = p_auth_user_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
                    and o.revoked_at is null and o.deleted_at is null) then
    return 'ok';
  end if;
  select l.id into v_link
    from ops_setup_links l
    join ops_members o on o.id = l.ops_member_id
    join members m on m.id = o.member_id
   where m.auth_user_id = p_auth_user_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
     and o.revoked_at is null and o.deleted_at is null
     and l.used_at is not null and l.used_at > now() - interval '5 minutes' and l.session_opened_at is null
   order by l.used_at desc
   limit 1
   for update of l;
  if v_link is null then return 'passkey_only'; end if;
  update ops_setup_links set session_opened_at = now() where id = v_link;
  return 'ok';
end $$;
revoke all on function app.ops_login_check(text, boolean) from public;
grant execute on function app.ops_login_check(text, boolean) to kaname_app;

create or replace function app.session_ops(p_session_id uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
    when s.tenant_id <> app.ops_tenant_id() then null
    when s.login_kind in ('passkey', 'ops_setup')
         and exists (select 1 from members m join ops_members o on o.member_id = m.id
                      where m.id = s.member_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
                        and o.revoked_at is null and o.deleted_at is null)
      then case s.login_kind when 'passkey' then 'ops' else 'setup' end
    else 'denied' end
    from sessions s where s.id = p_session_id
$$;
revoke all on function app.session_ops(uuid) from public;
grant execute on function app.session_ops(uuid) to kaname_app;
