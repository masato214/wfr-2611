-- 20261128012500_ops_team 運営の人を読む・足す（K-985・関門 C2・D-156.22・D-156.34・D-156.66・D-156.3）
--   ① app.ops_member_row(ops_members.id)：画面が使う 1 行の 8 欄（member_id・name・email・caps・has_passkey・setup_pending・is_self・locked_caps）。
--      locked_caps は「運営の人」「値段を決める」のそれぞれで、生きている運営の人のうちその印を持つのがこの人だけのときに並ぶ（K-1009 も同じ式を使う・1 か所）
--   ② app.ops_members_list()：ops_people を持つ運営の人だけ。生きている運営の人を作った順に { data: [...] }
--   ③ app.ops_member_add(auth_user_id, name, caps, token_hash)：ops_people を持つ運営の人だけ。1 つの取引で
--      生きている運営の人 → {"error":"already"}／顧客の会社の人 → {"error":"customer"}／外した運営の人 → 同じ行を生き返らせる（名前は前のまま）／
--      どれでもない → 運営の会社の members（名前＝渡した仮の名前）と ops_members を作る。どの道も前のリンクを使えなくして新しいリンクを 1 行、運営の記録 ops_member.add
--   ④ app.ops_setup_consume(token_hash, name)：K-945 のリンクを使う関数に名前を足した版。リンクが使えたときだけ、同じ取引で運営の会社の members.display_name を送られた名前にする（D-156.66）
--   どれも security definer・search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）。
--   kaname_auth の表（user・passkey）は関数の持ち主の権限で読む（kaname_app に読ませない）

create or replace function app.ops_member_row(p_ops_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v jsonb;
begin
  perform app.ops_require('any');
  select jsonb_build_object(
           'member_id', m.id,
           'name', m.display_name,
           'email', u.email,
           'caps', to_jsonb(array(
             select c from unnest(array['inquiry', 'peek', 'money', 'stop', 'notice', 'distribute', 'plan_propose', 'plan_decide', 'ops_people']::text[])
                    with ordinality as k(c, i)
              where c = any(o.caps) order by i)),
           'has_passkey', exists (select 1 from kaname_auth.passkey p where p."userId" = m.auth_user_id),
           'setup_pending', not exists (select 1 from kaname_auth.passkey p where p."userId" = m.auth_user_id)
                            and exists (select 1 from ops_setup_links l
                                         where l.ops_member_id = o.id and l.used_at is null and l.expires_at > now()),
           'is_self', m.id = app.user_id(),
           'locked_caps', to_jsonb(array(
             select c from unnest(array['ops_people', 'plan_decide']::text[]) with ordinality as k(c, i)
              where c = any(o.caps)
                and not exists (select 1 from ops_members o2 join members m2 on m2.id = o2.member_id
                                 where o2.id <> o.id and c = any(o2.caps)
                                   and o2.revoked_at is null and o2.deleted_at is null
                                   and m2.tenant_id = app.ops_tenant_id() and m2.deleted_at is null)
              order by i)))
    into v
    from ops_members o
    join members m on m.id = o.member_id
    left join kaname_auth."user" u on u.id = m.auth_user_id
   where o.id = p_ops_member and m.tenant_id = app.ops_tenant_id();
  return v;
end $$;
revoke all on function app.ops_member_row(uuid) from public;
grant execute on function app.ops_member_row(uuid) to kaname_app;

create or replace function app.ops_members_list() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  perform app.ops_require('ops_people');
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(app.ops_member_row(o.id) order by o.created_at, o.id)
      from ops_members o
      join members m on m.id = o.member_id
     where o.tenant_id = app.ops_tenant_id() and o.revoked_at is null and o.deleted_at is null
       and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null), '[]'::jsonb));
end $$;
revoke all on function app.ops_members_list() from public;
grant execute on function app.ops_members_list() to kaname_app;

create or replace function app.ops_member_add(p_auth_user_id text, p_name text, p_caps text[], p_token_hash text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare v_member uuid; v_ops uuid; v_revoked timestamptz; v_scope uuid; v_name text;
begin
  perform app.ops_require('ops_people');
  if p_auth_user_id is null or p_token_hash is null or coalesce(cardinality(p_caps), 0) = 0 then
    raise exception '足す人の材料が欠けている' using errcode = 'invalid_parameter_value';
  end if;
  -- 同じ人を同時に 2 回足さない（取引の間だけの錠・後の方は生きている運営の人を見て already）
  perform pg_advisory_xact_lock(hashtext('kaname.ops_member_add:' || p_auth_user_id));
  if exists (select 1 from members m join ops_members o on o.member_id = m.id
              where m.auth_user_id = p_auth_user_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
                and o.revoked_at is null and o.deleted_at is null) then
    return jsonb_build_object('error', 'already');
  end if;
  -- 運営の人は運営の会社だけに居る（顧客の会社の人は運営の人にしない・K-944）
  if exists (select 1 from members m where m.auth_user_id = p_auth_user_id and m.tenant_id <> app.ops_tenant_id()
                and m.deleted_at is null) then
    return jsonb_build_object('error', 'customer');
  end if;
  select m.id, m.display_name into v_member, v_name
    from members m
   where m.auth_user_id = p_auth_user_id and m.tenant_id = app.ops_tenant_id() and m.deleted_at is null
   order by m.created_at limit 1
   for update;
  if v_member is null then
    select s.id into v_scope from scopes s
     where s.tenant_id = app.ops_tenant_id() and s.deleted_at is null order by s.created_at limit 1;
    if v_scope is null then
      insert into scopes (tenant_id, name, ticket_prefix) values (app.ops_tenant_id(), '運営の全体', '') returning id into v_scope;
    end if;
    v_name := coalesce(nullif(btrim(p_name), ''), '運営');
    insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id)
    values (app.ops_tenant_id(), v_scope, 'human', v_name, p_auth_user_id) returning id into v_member;
  end if;
  -- 外した運営の人なら同じ行を生き返らせる（名前は前のまま・入るときに本人が付け直せる・D-156.66）
  select o.id into v_ops from ops_members o
   where o.member_id = v_member and o.deleted_at is null
   order by o.created_at limit 1
   for update;
  if v_ops is null then
    insert into ops_members (tenant_id, member_id, caps) values (app.ops_tenant_id(), v_member, p_caps) returning id into v_ops;
  else
    update ops_members set revoked_at = null, caps = p_caps where id = v_ops;
  end if;
  -- 前のリンクは使えなくする（期限を今に。used_at は付けない＝K-945 の止め ops_login_check の「使った直後の 5 分」を開かない）
  update ops_setup_links set expires_at = least(expires_at, now()) where ops_member_id = v_ops and used_at is null;
  insert into ops_setup_links (ops_member_id, token_hash, expires_at, created_by)
  values (v_ops, p_token_hash, now() + interval '24 hours', app.user_id());
  perform app.record_ops_audit(app.ops_tenant_id(), 'ops_member.add', 'ops_members', v_ops::text, null,
                               jsonb_build_object('target_label', v_name, 'caps', to_jsonb(p_caps)));
  return jsonb_build_object('data', app.ops_member_row(v_ops));
end $$;
revoke all on function app.ops_member_add(text, text, text[], text) from public;
grant execute on function app.ops_member_add(text, text, text[], text) to kaname_app;

-- K-945 の app.ops_setup_consume(token_hash) に名前を足した版（ログインの前に呼ぶ・運営の文脈はまだ無い）。
--   名前が null なら変えない。名前を書くのはリンクが使えたときだけ（使えないリンクでは何も書かない）
create or replace function app.ops_setup_consume(p_token_hash text, p_name text) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_user text;
begin
  v_user := app.ops_setup_consume(p_token_hash);
  if v_user is not null and nullif(btrim(p_name), '') is not null then
    update members set display_name = btrim(p_name)
     where auth_user_id = v_user and tenant_id = app.ops_tenant_id() and deleted_at is null;
  end if;
  return v_user;
end $$;
revoke all on function app.ops_setup_consume(text, text) from public;
grant execute on function app.ops_setup_consume(text, text) to kaname_app;
