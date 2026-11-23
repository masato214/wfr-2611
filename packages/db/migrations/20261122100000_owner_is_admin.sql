-- 20261122100000 会社を作った人（owner）を管理者にする（K-421・D-148.49 の「会社を作った人はメンバーの画面に行ける」と同じ線）
--   今までは create_company が表ごとの view/edit だけを付け、tenant_memberships の行を作らなかった。
--   役割の束（招く・書き出す・プランと支払い）は tenant_memberships の行がある人にだけ付く（0080）ので、
--   会社を作った人が has_permission('members', 'invite') で通らず、招く口が 403 だった。
--   ① create_company が管理者の所属の行も作る（引き金が束の権限の行を作る）
--   ② すでにある会社の owner にも同じ行を埋め戻す（行が無い人だけ・何度流しても増えない）
--   ③ 作りかけの会社の片付けが、足した所属の行も消す
create or replace function app.create_company(p_auth_user_id text, p_company text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_member uuid;
begin
  if exists (select 1 from members where auth_user_id = p_auth_user_id and deleted_at is null) then
    raise exception 'この利用者は既に会社に属している' using errcode = 'unique_violation';
  end if;
  insert into tenants (id, tenant_id, name) select u, u, left(trim(p_company), 120) from gen_random_uuid() u returning id into v_tenant;
  insert into scopes (tenant_id, name) values (v_tenant, '会社') returning id into v_scope;
  insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id, role_id)
    values (v_tenant, v_scope, 'human', left(trim(p_display_name), 80), p_auth_user_id, 'owner') returning id into v_member;
  update members set created_by = v_member where id = v_member;
  insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, granted_by)
    select v_tenant, v_member, tk.key, a.key, v_member from target_kinds tk cross join (values ('view'), ('edit')) as a(key);
  insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at, created_by)
    values (v_tenant, v_member, p_auth_user_id, 'admin', 'active', now(), v_member);
  insert into clones (tenant_id, owner_member_id, persona, created_by) values (v_tenant, v_member, null, v_member);
  perform app.record_security_event(v_tenant, 'company_created', v_member, null, jsonb_build_object('auth_user_id', p_auth_user_id));
  return v_tenant;
end $$;
grant execute on function app.create_company(text, text, text) to kaname_app, kaname_auth;

-- 作りかけの会社の片付け（kaname_auth.drop_half_made_company・0087）も、会社を作った人の所属の行を先に消す（消さないと members の削除が tenant_memberships の外部キーで落ちる）。
--   中身は 0087 のまま、人（members）を消す前に所属の行を消す 1 行だけを足す（引き金が束の権限の行を一緒に消す）
create or replace function kaname_auth.drop_half_made_company(p_tenant_id uuid, p_auth_user_id text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid;
begin
  if p_tenant_id is null or p_auth_user_id is null or p_auth_user_id = '' then return 0; end if;
  if p_tenant_id = app.ops_tenant_id() then return 0; end if;
  perform 1 from tenants t where t.id = p_tenant_id and t.created_at >= now() - interval '5 minutes' for update;
  if not found then return 0; end if;
  if (select count(*) from members m where m.tenant_id = p_tenant_id) <> 1 then return 0; end if;
  select m.id into v_member from members m where m.tenant_id = p_tenant_id and m.auth_user_id = p_auth_user_id;
  if v_member is null then return 0; end if;
  update tenants set half_made_at = coalesce(half_made_at, now()) where id = p_tenant_id;
  delete from sessions where tenant_id = p_tenant_id;
  delete from notifications where tenant_id = p_tenant_id;
  delete from terms_consents where tenant_id = p_tenant_id;
  delete from clones where tenant_id = p_tenant_id;
  delete from tenant_memberships where tenant_id = p_tenant_id;
  delete from permissions where tenant_id = p_tenant_id;
  delete from members where tenant_id = p_tenant_id;
  delete from scopes where tenant_id = p_tenant_id;
  return 1;
end $$;
revoke all on function kaname_auth.drop_half_made_company(uuid, text) from public;
grant execute on function kaname_auth.drop_half_made_company(uuid, text) to kaname_auth;

-- すでにある owner に、管理者の所属の行を足す（引き金が束の権限の行を作る）
insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at, created_by)
  select m.tenant_id, m.id, m.auth_user_id, 'admin', 'active', now(), m.id
  from members m
  where m.role_id = 'owner' and m.kind_id = 'human' and m.deleted_at is null
    and not exists (select 1 from tenant_memberships tm where tm.tenant_id = m.tenant_id and tm.member_id = m.id)
on conflict (tenant_id, member_id) do nothing;
