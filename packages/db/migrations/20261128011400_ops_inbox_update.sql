-- 20261128011400_ops_inbox_update 運営が受信箱の問い合わせの担当・状態・後でを変える（K-974・契約の口 updateOpsInquiry・関門 C2・D-156.25・D-125.129・D-128.108）
--   app.ops_inquiry_update(id, take, release, state, set_later, later)：
--     ⓐ app.ops_require('inquiry')（2 層目）ⓑ 問い合わせ（K-973 の条件）を for update・無い・消した物は no_data_found（口が 404）
--     ⓒ 取る（担当なし → 自分・自分 → 何もしない・ほかの人 → taken）／外す（自分 → 担当なし・担当なし → 何もしない・ほかの人 → taken）
--     ⓓ 状態と後で：担当が自分のときだけ（同じ呼びの取るで自分になったときを含む・ほかは taken）。
--        done＝済み（later_until を空に）・open＝開き直す（later_until を空に）・later_until <日時>＝later（今より後だけ・今以前は later_past）・
--        later_until null＝後でを外して open
--     ⓔ 変えた分ごとに app.record_ops_audit（inquiry.take・inquiry.release・inquiry.done・inquiry.reopen・inquiry.later）。何もしなかった分は書かない
--     ⓕ { data: K-973 の 1 行の 10 欄（app.inquiry_ops_row）}
--   断り（taken・later_past）は何も書かずに返す（取るを先に書いた後の断りは、例外で取引ごと戻す）。顧客にお知らせは出さない・last_message_at は変えない

create or replace function app.ops_inquiry_update(p_id uuid, p_take boolean, p_release boolean, p_state text,
                                                  p_set_later boolean, p_later timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  q record;
  v_owner uuid;
  v_label jsonb;
  v_status boolean := p_state is not null or coalesce(p_set_later, false);
begin
  perform app.ops_require('inquiry');
  v_me := app.user_id();  -- 担当の列は members.id（K-973 の受信箱の「自分」と同じ）
  select x.id, x.tenant_id, x.title, x.state, x.later_until, x.assignee_ops_member_id
    into q
    from inquiries x
    join tenants t on t.id = x.tenant_id
   where x.id = p_id and x.deleted_at is null
     and t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
     for update of x;
  if not found then
    raise exception '問い合わせが無い' using errcode = 'no_data_found';
  end if;
  if p_state is not null and p_state not in ('open', 'done') then
    raise exception '知らない状態' using errcode = 'invalid_parameter_value';
  end if;

  -- 先に全部を確かめてから書く（断りのときは何も書かない）
  if (coalesce(p_take, false) or coalesce(p_release, false)) and q.assignee_ops_member_id is not null
     and q.assignee_ops_member_id <> v_me then
    return jsonb_build_object('error', 'taken');
  end if;
  v_owner := case when coalesce(p_take, false) then v_me
                  when coalesce(p_release, false) then null
                  else q.assignee_ops_member_id end;
  if v_status and v_owner is distinct from v_me then
    return jsonb_build_object('error', 'taken');
  end if;
  if p_state is null and coalesce(p_set_later, false) and p_later is not null and p_later <= now() then
    return jsonb_build_object('error', 'later_past');
  end if;

  v_label := jsonb_build_object('target_label', q.title);

  -- ⓒ 取る・外す（変わったときだけ書く）
  if v_owner is distinct from q.assignee_ops_member_id then
    update inquiries set assignee_ops_member_id = v_owner, updated_at = now(), updated_by = v_me where id = q.id;
    perform app.record_ops_audit(q.tenant_id, case when v_owner is null then 'inquiry.release' else 'inquiry.take' end,
                                 'inquiries', q.id::text, null, v_label);
  end if;

  -- ⓓ 状態と後で（変わったときだけ書く）
  if p_state is not null then
    if q.state <> p_state or q.later_until is not null then
      update inquiries set state = p_state, later_until = null, updated_at = now(), updated_by = v_me where id = q.id;
    end if;
    if q.state <> p_state then
      perform app.record_ops_audit(q.tenant_id, case p_state when 'done' then 'inquiry.done' else 'inquiry.reopen' end,
                                   'inquiries', q.id::text, null, v_label);
    end if;
  elsif coalesce(p_set_later, false) and p_later is not null then
    if q.state <> 'later' or q.later_until is distinct from p_later then
      update inquiries set state = 'later', later_until = p_later, updated_at = now(), updated_by = v_me where id = q.id;
      perform app.record_ops_audit(q.tenant_id, 'inquiry.later', 'inquiries', q.id::text, null,
                                   v_label || jsonb_build_object('later_until', p_later));
    end if;
  elsif coalesce(p_set_later, false) then
    if q.state = 'later' or q.later_until is not null then
      update inquiries set state = 'open', later_until = null, updated_at = now(), updated_by = v_me where id = q.id;
      perform app.record_ops_audit(q.tenant_id, 'inquiry.reopen', 'inquiries', q.id::text, null, v_label);
    end if;
  end if;

  return jsonb_build_object('data', app.inquiry_ops_row(q.id));
end $$;
revoke all on function app.ops_inquiry_update(uuid, boolean, boolean, text, boolean, timestamptz) from public;
grant execute on function app.ops_inquiry_update(uuid, boolean, boolean, text, boolean, timestamptz) to kaname_app;

insert into app.schema_migrations (name) values ('20261128011400_ops_inbox_update.sql') on conflict do nothing;
