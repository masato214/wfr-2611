-- 20261121090400 受けたときに一緒に切り替える（K-404・段 9・D-125.60・D-125.70・D-125.71・D-128.95・D-148.11・関門 C2）
--   K-401 が空の形で置いた app.handover_apply_switch を本物にする（同じ名前・同じ引数・同じ答えの型）。
--   移す物の一覧は K-401 の app.handover_switch_targets だけを使う（下見の数と移す数を 1 か所で決める）。
--   呼ぶのは担当者を書き換えた後の関数（受ける・申し出に渡す・配る）。呼んだ側の取引の中で動き、例外なら取引ごと戻る。
--   kaname_app には渡さない（K-401 の決めのまま。public からの revoke は K-401 で済み、create or replace は権限を変えない）

create or replace function app.handover_apply_switch(p_handover uuid, p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  h ticket_handovers%rowtype; t tickets%rowtype;
  v_n_children integer := 0; v_n_links integer := 0;
  v_scope_to uuid; v_group jsonb := null;
begin
  select * into h from ticket_handovers x where x.id = p_handover and x.tenant_id = app.tenant_id();
  if not found then raise exception 'handover_not_found' using errcode = '22023'; end if;
  select * into t from tickets x where x.id = h.ticket_id and x.tenant_id = app.tenant_id();
  if not found then raise exception 'handover_not_found' using errcode = '22023'; end if;

  if coalesce((h.switch ->> 'children')::boolean, false) then
    update tickets c set assignee_member_id = p_to, updated_by = app.user_id()
     where c.tenant_id = app.tenant_id()
       and c.id in (select s.ticket_id from app.handover_switch_targets(t.id, p_from) s where s.target = 'children' and s.mine);
    get diagnostics v_n_children = row_count;
  end if;

  if coalesce((h.switch ->> 'links')::boolean, false) then
    update tickets c set assignee_member_id = p_to, updated_by = app.user_id()
     where c.tenant_id = app.tenant_id()
       and c.id in (select s.ticket_id from app.handover_switch_targets(t.id, p_from) s where s.target = 'links' and s.mine);
    get diagnostics v_n_links = row_count;
  end if;

  -- グループ：呼ばれた時点で相手がチケットのグループにいないときだけ（番号・子のグループは変えない・D-125.60）
  if coalesce((h.switch ->> 'group')::boolean, false) and t.scope_id is not null
     and p_to is not null and not app.handover_in_group(p_to, t.scope_id) then
    select m.scope_id into v_scope_to from members m
     where m.id = p_to and m.tenant_id = app.tenant_id()
       and exists (select 1 from scopes sc where sc.id = m.scope_id and sc.tenant_id = app.tenant_id() and sc.deleted_at is null);
    if v_scope_to is not null and v_scope_to <> t.scope_id then
      update tickets x set scope_id = v_scope_to, updated_by = app.user_id() where x.id = t.id and x.tenant_id = app.tenant_id();
      v_group := jsonb_build_object('from', t.scope_id, 'to', v_scope_to);
    end if;
  end if;

  return jsonb_build_object('children', v_n_children, 'links', v_n_links, 'group', v_group, 'axes', 0);
end $$;
