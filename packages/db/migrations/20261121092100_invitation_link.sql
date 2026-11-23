-- 20261121092100 招待のリンク（K-421・契約の口 createInvitationLink・D-148.22・D-148.51・関門 C2）
--   宛てのメールを持たない招待（＝招待のリンク）を作り、F2 の下見と今のアカウントで参加を、その招待に合わせる。
--   ① invitations.email の not null を外す（宛てのメールが空＝招待のリンク。種類の列は足さない。メールで招いた物は今までどおり必ず宛てを持つ）
--   ② app.create_invitation_link(p_scope, p_role, p_token_hash)：招く権限（members の invite・会社全体）の判定は app.create_invitations と同じ式。
--      権限が無ければ 42501（hint なし）・役割が 4 つの外なら 22023・グループがこの会社に無い／消した → 42501・hint E-INV-011（口が 404 で返す）。
--      招待を 1 行（email 空・期限 now()+7 日・created_by 呼んだ人）と証跡 invitation.link_created（payload に招待 id・グループ・役割だけ。トークンは書かない）を 1 つの取引で
--   ③ app.invitation_preview2 を作り直す（形は 0114 のまま）：宛てが空なら account_exists は false・ログイン中の email_matches は true
--   ④ app.join_invitation を作り直す（形は 20261119070749 のまま）：宛ての照らし合わせ（wrong_email）は宛てのメールが在る招待だけ

-- squawk-ignore ban-drop-not-null
alter table invitations alter column email drop not null;
comment on column invitations.email is '宛てのメール。空＝招待のリンク（K-421）';

create or replace function app.create_invitation_link(p_scope uuid, p_role text, p_token_hash text)
returns table (invitation_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  v_id uuid;
  v_exp timestamptz := now() + interval '7 days';
begin
  if v_tenant is null or v_user is null
     or not has_permission(v_user, 'members', null, 'invite') then
    raise exception '招く権限が無い' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('admin', 'manager', 'member', 'viewer') or coalesce(p_token_hash, '') = '' then
    raise exception '招く入力が正しくない' using errcode = '22023';
  end if;
  if not exists (select 1 from scopes s where s.id = p_scope and s.tenant_id = v_tenant and s.deleted_at is null) then
    raise exception 'このグループには招けない' using errcode = 'insufficient_privilege', hint = 'E-INV-011';
  end if;
  insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by)
  values (v_tenant, null, p_scope, p_role, p_token_hash, v_exp, v_user)
  returning id into v_id;
  perform app.record_audit('invitation.link_created', 'invitation', v_id::text, 'C6',
    jsonb_build_object('invitation_id', v_id, 'scope_id', p_scope, 'role_id', p_role));
  invitation_id := v_id; expires_at := v_exp;
  return next;
end $$;
revoke all on function app.create_invitation_link(uuid, text, text) from public;
grant execute on function app.create_invitation_link(uuid, text, text) to kaname_app;

create or replace function app.invitation_preview2(p_token_hash text, p_auth_user_id text default null)
returns table (state text, workspace_name text, inviter_name text, group_name text, role text, message text, email text,
               expires_at timestamptz, account_exists boolean, signed_email text, email_matches boolean, already_member boolean)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_has_auth boolean := to_regclass('kaname_auth."user"') is not null;
  v_exists boolean := false;
  v_signed text;
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash;
  if not found then return; end if;
  if v_has_auth then
    if v_inv.email is not null then
      execute 'select exists (select 1 from kaname_auth."user" u where lower(u.email) = lower($1))' into v_exists using v_inv.email;
    end if;
    if p_auth_user_id is not null then
      execute 'select u.email from kaname_auth."user" u where u.id = $1' into v_signed using p_auth_user_id;
    end if;
  end if;
  return query
  select case
           when v_inv.accepted_member_id is not null then 'used'
           when v_inv.revoked_at is not null or v_inv.deleted_at is not null then 'revoked'
           when v_inv.expires_at < now() then 'expired'
           else 'ok'
         end,
         t.name,
         (select m.display_name from members m where m.id = v_inv.created_by),
         (select s.name from scopes s where s.id = v_inv.scope_id and s.deleted_at is null),
         case when v_inv.role_id in ('admin', 'manager', 'member', 'viewer', 'requester') then v_inv.role_id else 'member' end,
         v_inv.message,
         v_inv.email,
         v_inv.expires_at,
         coalesce(v_exists, false),
         case when p_auth_user_id is null then null else v_signed end,
         case when p_auth_user_id is null then null
              when v_inv.email is null then true
              else coalesce(lower(v_signed) = lower(v_inv.email), false) end,
         case when p_auth_user_id is null then null
              else exists (select 1 from app.current_members_of_auth_user(p_auth_user_id) c where c.tenant_id = v_inv.tenant_id) end
    from tenants t
   where t.id = v_inv.tenant_id;
end $$;
revoke all on function app.invitation_preview2(text, text) from public;
grant execute on function app.invitation_preview2(text, text) to kaname_app;

create or replace function app.join_invitation(p_token_hash text, p_auth_user_id text, p_auth_session_id text)
returns table (tenant_id uuid, member_id uuid)
language plpgsql security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare
  inv invitations%rowtype;
  v_email text;
  v_name text;
  v_scope uuid;
  v_member uuid;
  v_role text;
  v_scope_role text;
  v_target uuid;
  n int;
begin
  select * into inv from invitations where token_hash = p_token_hash for update;
  if inv.id is null then
    raise exception '招待が無効（見つからない）' using errcode = 'insufficient_privilege', hint = 'not_found';
  end if;
  if inv.accepted_member_id is not null then
    raise exception '招待が無効（受諾済み）' using errcode = 'insufficient_privilege', hint = 'used';
  end if;
  if inv.revoked_at is not null or inv.deleted_at is not null then
    raise exception '招待が無効（取り消し）' using errcode = 'insufficient_privilege', hint = 'revoked';
  end if;
  if inv.expires_at < now() then
    raise exception '招待が無効（期限切れ）' using errcode = 'insufficient_privilege', hint = 'expired';
  end if;

  select u.email, u.name into v_email, v_name from kaname_auth."user" u where u.id = p_auth_user_id;
  if v_email is null or (inv.email is not null and lower(v_email) <> lower(inv.email)) then
    raise exception 'この招待は別のメールの宛て' using errcode = 'insufficient_privilege', hint = 'wrong_email';
  end if;

  -- 同じ人が同じ会社へ同時に入る（別の招待を 2 つ）ときに所属を 2 つ作らない
  perform pg_advisory_xact_lock(hashtextextended(inv.tenant_id::text || ':' || p_auth_user_id, 0));

  if exists (select 1 from app.current_members_of_auth_user(p_auth_user_id) c where c.tenant_id = inv.tenant_id) then
    raise exception 'このワークスペースには既に入っている' using errcode = 'insufficient_privilege', hint = 'already_member';
  end if;

  select s.id into v_scope from scopes s
   where s.id = inv.scope_id and s.tenant_id = inv.tenant_id and s.deleted_at is null;
  if v_scope is null then
    select s.id into v_scope from scopes s
     where s.tenant_id = inv.tenant_id and s.parent_id is null and s.deleted_at is null
     order by s.created_at limit 1;
  end if;
  v_role := case when inv.role_id in ('admin', 'manager', 'member', 'viewer', 'requester') then inv.role_id else 'member' end;
  v_scope_role := case when inv.role_id in ('manager', 'viewer') then inv.role_id else 'member' end;

  -- 前に抜けた・招待中・消した所属（D-128.96：所属の行が残っていれば戻す）
  select tm.member_id into v_member
    from tenant_memberships tm join members m on m.id = tm.member_id
   where tm.tenant_id = inv.tenant_id
     and (tm.auth_user_id = p_auth_user_id or m.auth_user_id = p_auth_user_id)
     and (tm.status in ('left', 'invited') or tm.deleted_at is not null or m.deleted_at is not null)
   order by tm.updated_at desc limit 1;

  if v_member is not null then
    update tenant_memberships tm
       set status = 'active', role = v_role, joined_at = now(), deleted_at = null, updated_by = inv.created_by
     where tm.tenant_id = inv.tenant_id and tm.member_id = v_member;
    update members m
       set deleted_at = null, role_id = inv.role_id, scope_id = coalesce(v_scope, m.scope_id), updated_by = inv.created_by
     where m.id = v_member;
    if v_scope is not null then
      select sm.id into v_target from scope_memberships sm where sm.member_id = v_member and sm.scope_id = v_scope;
      if v_target is not null then
        -- 招待のグループの行がもうある：前の主の行の印を外してから、その行を主にする（主の所属は 1 人 1 つ）
        update scope_memberships sm set is_primary = false, changed_by = inv.created_by, updated_by = inv.created_by
         where sm.member_id = v_member and sm.is_primary and sm.deleted_at is null and sm.id <> v_target;
        update scope_memberships sm
           set is_primary = true, deleted_at = null, role = v_scope_role, changed_by = inv.created_by, updated_by = inv.created_by
         where sm.id = v_target;
      else
        update scope_memberships sm
           set scope_id = v_scope, role = v_scope_role, changed_by = inv.created_by, updated_by = inv.created_by
         where sm.member_id = v_member and sm.is_primary and sm.deleted_at is null;
        get diagnostics n = row_count;
        if n = 0 then
          insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by)
          values (inv.tenant_id, v_member, v_scope, true, v_scope_role, inv.created_by, inv.created_by);
        end if;
      end if;
    end if;
  else
    insert into members (tenant_id, scope_id, kind_id, display_name, role_id, auth_user_id, created_by)
    values (inv.tenant_id, v_scope, 'human', coalesce(nullif(v_name, ''), v_email), inv.role_id, null, inv.created_by)
    returning id into v_member;
    insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at, created_by)
    values (inv.tenant_id, v_member, p_auth_user_id, v_role, 'active', now(), inv.created_by);
    if v_scope is not null then
      insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by)
      values (inv.tenant_id, v_member, v_scope, true, v_scope_role, inv.created_by, inv.created_by);
    end if;
  end if;

  update invitations set accepted_member_id = v_member where id = inv.id;
  perform app.record_security_event(inv.tenant_id, 'invitation_accepted', v_member, null, jsonb_build_object('invitation_id', inv.id));

  -- そのログインの印だけを切り替える（ほかのセッションと PC は元のまま）
  update sessions x set tenant_id = inv.tenant_id, member_id = v_member
   where x.auth_session_id = p_auth_session_id and x.revoked_at is null and x.kind_id <> 'bridge'
     and exists (select 1 from kaname_auth.session a where a.id = p_auth_session_id and a."userId" = p_auth_user_id);
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '切り替えるセッションが無い' using errcode = 'no_data_found';
  end if;

  tenant_id := inv.tenant_id;
  member_id := v_member;
  return next;
end $$;
revoke all on function app.join_invitation(text, text, text) from public;
grant execute on function app.join_invitation(text, text, text) to kaname_app;
