-- 20261128004400_ops_login 運営のログイン（K-944・関門 C2・D-128.70・D-156.2・D-156.17・D-156.22・D-125.140・D-128.141）
--   足すのは 列 1 つ（sessions.login_kind）と関数 3 本。新しい表は作らない。
--   ① sessions.login_kind：そのセッションの入り方。この葉が持つのはパスキーの 'passkey' だけ（パスワード・6 けたなどは null のまま）。
--      付けるだけのセッション 'ops_setup' は K-945 が足す
--   ② app.mark_session_login_kind(auth_session_id, kind)：ログインでできたセッションに入り方を残す（packages/auth の hook が app.open_session の次に呼ぶ）。
--      まだ入り方の無い（null の）行だけ埋める。書けなければ例外を上げる（hook が認証側のセッションを消してから上げる）
--   ③ app.ops_login_check(auth_user_id, via_passkey)：止め（1 層目）。運営の人（運営の会社の生きている members ＋ 生きている ops_members）が
--      パスキーでない道で入ろうとしたら 'passkey_only'、ほかは 'ok'。セッションを作る直前に packages/auth の hook が引く
--   ④ app.session_ops(session_id)：解決（2 層目）。セッションの会社が運営の会社でなければ null（顧客の人・今までどおり）。
--      運営の会社なら、生きている ops_members があり入り方が 'passkey' のとき 'ops'、ほかは 'denied'（運営として解かない）。
--      運営の人を外す（revoked_at・deleted_at）と、その時点から 'denied'（時間を待たない・G-14）
--   運営の会社の id は app.ops_tenant_id() だけが持つ（TS に直書きしない）。
--   どの関数も security definer・search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）。

alter table sessions add column if not exists login_kind text;
-- 同じ migration を流し直しても同じ形にするため（この migration が足す検査の制約だけを置き直す。前からの保証は外さない）
-- squawk-ignore ban-drop-constraint
alter table sessions drop constraint if exists sessions_login_kind_ck;
alter table sessions add constraint sessions_login_kind_ck check (login_kind in ('passkey'));

create or replace function app.mark_session_login_kind(p_auth_session_id text, p_kind text) returns void
language sql security definer set search_path = public, app, pg_temp as $$
  update sessions set login_kind = p_kind
   where auth_session_id = p_auth_session_id and login_kind is null
$$;
revoke all on function app.mark_session_login_kind(text, text) from public;
grant execute on function app.mark_session_login_kind(text, text) to kaname_app;

-- 運営の人＝運営の会社の生きている members で、生きている ops_members がある人（③ と ④ で同じ条件）
create or replace function app.ops_login_check(p_auth_user_id text, p_via_passkey boolean) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
    when coalesce(p_via_passkey, false) then 'ok'
    when exists (select 1 from members m join ops_members o on o.member_id = m.id
                  where m.auth_user_id = p_auth_user_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
                    and o.revoked_at is null and o.deleted_at is null) then 'passkey_only'
    else 'ok' end
$$;
revoke all on function app.ops_login_check(text, boolean) from public;
grant execute on function app.ops_login_check(text, boolean) to kaname_app;

create or replace function app.session_ops(p_session_id uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
    when s.tenant_id <> app.ops_tenant_id() then null
    when s.login_kind = 'passkey'
         and exists (select 1 from members m join ops_members o on o.member_id = m.id
                      where m.id = s.member_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
                        and o.revoked_at is null and o.deleted_at is null) then 'ops'
    else 'denied' end
    from sessions s where s.id = p_session_id
$$;
revoke all on function app.session_ops(uuid) from public;
grant execute on function app.session_ops(uuid) to kaname_app;
