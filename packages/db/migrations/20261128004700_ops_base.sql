-- 20261128004700_ops_base 運営が会社を触る DB の道の土台（K-947・関門 C2・D-156.3・D-156.12・D-125.128・D-128.108）
--   運営が別の会社を触る道は security definer の関数だけ（BYPASS は使わない）。その関数が頭で呼ぶ型を 2 つ置く。
--   ① app.ops_require(cap)：関数の中の 2 層目。運営の文脈（app.role() = 'ops'）で、app.user_id() が生きている ops_members の人で、
--      そのできること（'any' は誰でも）を持てば、その ops_members.id。ほかは 42501（insufficient_privilege）。呼ぶたびに引く（覚えない）
--   ② app.ops_target(tenant)：指す会社を、在る顧客のワークスペース（消していない・作りかけでない・運営の会社でない）に絞る。
--      ほかは P0002（no_data_found）。中で ops_require は呼ばない（呼ぶ側が先に呼ぶ）
--   運営の関数（app.ops_<名前> の security definer）は頭で ops_require を呼び、書くなら app.record_ops_audit を呼ぶ
--   （検査 scripts/ci/ops_definer_gate.py が migration を読んで見る）。
--   どちらも search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）。

create or replace function app.ops_require(p_cap text) returns uuid
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_id uuid;
begin
  if coalesce(app.role(), '') <> 'ops' or app.user_id() is null or p_cap is null then
    raise exception '運営の人の文脈でない' using errcode = 'insufficient_privilege';
  end if;
  select o.id into v_id
    from ops_members o
   where o.member_id = app.user_id() and o.tenant_id = app.ops_tenant_id()
     and o.revoked_at is null and o.deleted_at is null
     and (p_cap = 'any' or p_cap = any(o.caps))
   limit 1;
  if v_id is null then
    raise exception 'そのできることを持たない' using errcode = 'insufficient_privilege';
  end if;
  return v_id;
end $$;
revoke all on function app.ops_require(text) from public;
grant execute on function app.ops_require(text) to kaname_app;

create or replace function app.ops_target(p_tenant uuid) returns uuid
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if p_tenant is null or p_tenant = app.ops_tenant_id() or not exists (
       select 1 from tenants t where t.id = p_tenant and t.deleted_at is null and t.half_made_at is null) then
    raise exception '指した会社が無い' using errcode = 'no_data_found';
  end if;
  return p_tenant;
end $$;
revoke all on function app.ops_target(uuid) from public;
grant execute on function app.ops_target(uuid) to kaname_app;
