-- 20261120130800 決定を改める・取り消す口（K-391・契約の口 updateTicketDecision・D-125.63・D-128.81・D-130.1・D-125.130・D-136.1・D-136.2・D-145.9・関門 C2・C6）
--   決定は上書きしない。改めるは「新しい決定の行を足し、古い行に改めた先の印」、取り消すは「取り消した時刻・人・理由の印を付けて残す」（消さない）。
--   列は K-390（20261120130700）が足した cancelled_at／cancelled_by／cancel_reason を使う（ここでは列を足さない）。
--
-- ① 決定の元か（K-383 の関数を作り直す）：取り消した決定の元の書き込みは数えない。改められた古い決定は数えたまま
-- ② 改める（1 つの処理：新しい行・古い行の印・やり取りの 1 行・受け箱・証跡）
-- ③ 取り消す（同じ形・previous は null）

-- ① K-383 の app.ticket_message_decided に「取り消していない」を足す
create or replace function app.ticket_message_decided(p_message uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from ticket_decisions d
                  where d.source_message_id = p_message and d.deleted_at is null and d.cancelled_at is null)
$$;
revoke all on function app.ticket_message_decided(uuid) from public;

-- ② 改める。答えは { decision, previous, message_id } か { error[, field] }。だめなときは何も書かない。
--   見る順：会社か人が無い → not_member／決定が無い・消した・チケットが消された・見られない → not_found（決定の行を for update で読む。
--   同時に 2 人が改めても後の 1 人はここで待ち、前の 1 人が済んだ後の行を見て superseded になる）／今のメンバーでない → not_member／書けない → not_writable／
--   守りの判定で例外 → guard_failed（止める側に倒す・D-136.1）／改められている → superseded／取り消している → cancelled／新しい決定が空 → text_empty
create or replace function app.ticket_decision_revise(p_decision uuid, p_text text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); d ticket_decisions%rowtype; t tickets%rowtype;
  c_blank constant text := E' \t\r\n\f\v 　';
  c_ctrl constant text := '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]';
  v_text text; v_reason text; v_id uuid; v_msg uuid;
begin
  if v_tenant is null or v_me is null or p_decision is null then return jsonb_build_object('error', 'not_member'); end if;
  begin
    select * into d from ticket_decisions where id = p_decision and tenant_id = v_tenant and deleted_at is null for update;
    if d.id is null then return jsonb_build_object('error', 'not_found'); end if;
    select * into t from tickets where id = d.ticket_id and tenant_id = v_tenant and deleted_at is null;
    if t.id is null or not app.ticket_visible(t.id) then return jsonb_build_object('error', 'not_found'); end if;
    if not app.approval_member_now() then return jsonb_build_object('error', 'not_member'); end if;
    if not app.ticket_writable(t.id) then return jsonb_build_object('error', 'not_writable'); end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;

  if d.superseded_by_id is not null then return jsonb_build_object('error', 'superseded'); end if;
  if d.cancelled_at is not null then return jsonb_build_object('error', 'cancelled'); end if;

  -- 字：制御文字（タブ・改行を除く）を取り除き、前後の空白（全角も）を落とす。上限は置かない・切らない（D-130.1）
  v_text := btrim(regexp_replace(coalesce(p_text, ''), c_ctrl, '', 'g'), c_blank);
  if v_text = '' then return jsonb_build_object('error', 'text_empty', 'field', 'text'); end if;
  v_reason := nullif(btrim(regexp_replace(coalesce(p_reason, ''), c_ctrl, '', 'g'), c_blank), '');

  insert into ticket_decisions (tenant_id, ticket_id, text, reason, decided_by, promoted_to, created_by)
    values (v_tenant, d.ticket_id, v_text, v_reason, v_me, d.promoted_to, v_me) returning id into v_id;
  update ticket_decisions set superseded_by_id = v_id, updated_by = v_me where id = d.id;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (v_tenant, d.ticket_id, v_me, 'change', app.member_name(v_me) || ' が決定を改めた',
            jsonb_build_array(jsonb_build_object('field', 'decision', 'from', d.id, 'to', v_id, 'note', 'revise')), v_me)
    returning id into v_msg;
  perform app.ticket_decision_notify(d.ticket_id, v_id, 'revise');
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'ticket_decision.revise', 'ticket_decisions', v_id::text, 'C2',
            jsonb_build_object('decision_id', v_id, 'revises_id', d.id), v_me);
  return jsonb_build_object('decision', app.ticket_decision_json(v_id),
                            'previous', app.ticket_decision_json(d.id), 'message_id', v_msg);
end $$;
revoke all on function app.ticket_decision_revise(uuid, text, text) from public;
grant execute on function app.ticket_decision_revise(uuid, text, text) to kaname_app;

-- ③ 取り消す。見る順は改めると同じ（改められている → superseded／取り消している → cancelled）。理由が空 → reason_empty。
--   取り消した行は消さず、取り消した時刻・人・理由を付ける（一覧では下に回る）
create or replace function app.ticket_decision_cancel(p_decision uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); d ticket_decisions%rowtype; t tickets%rowtype;
  c_blank constant text := E' \t\r\n\f\v 　';
  c_ctrl constant text := '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]';
  v_reason text; v_msg uuid;
begin
  if v_tenant is null or v_me is null or p_decision is null then return jsonb_build_object('error', 'not_member'); end if;
  begin
    select * into d from ticket_decisions where id = p_decision and tenant_id = v_tenant and deleted_at is null for update;
    if d.id is null then return jsonb_build_object('error', 'not_found'); end if;
    select * into t from tickets where id = d.ticket_id and tenant_id = v_tenant and deleted_at is null;
    if t.id is null or not app.ticket_visible(t.id) then return jsonb_build_object('error', 'not_found'); end if;
    if not app.approval_member_now() then return jsonb_build_object('error', 'not_member'); end if;
    if not app.ticket_writable(t.id) then return jsonb_build_object('error', 'not_writable'); end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;

  if d.superseded_by_id is not null then return jsonb_build_object('error', 'superseded'); end if;
  if d.cancelled_at is not null then return jsonb_build_object('error', 'cancelled'); end if;

  v_reason := nullif(btrim(regexp_replace(coalesce(p_reason, ''), c_ctrl, '', 'g'), c_blank), '');
  if v_reason is null then return jsonb_build_object('error', 'reason_empty', 'field', 'reason'); end if;

  update ticket_decisions set cancelled_at = now(), cancelled_by = v_me, cancel_reason = v_reason, updated_by = v_me where id = d.id;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (v_tenant, d.ticket_id, v_me, 'change', app.member_name(v_me) || ' が決定を取り消した',
            jsonb_build_array(jsonb_build_object('field', 'decision', 'from', d.id, 'to', null::text, 'note', 'cancel')), v_me)
    returning id into v_msg;
  perform app.ticket_decision_notify(d.ticket_id, d.id, 'cancel');
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'ticket_decision.cancel', 'ticket_decisions', d.id::text, 'C2',
            jsonb_build_object('decision_id', d.id), v_me);
  return jsonb_build_object('decision', app.ticket_decision_json(d.id), 'previous', null, 'message_id', v_msg);
end $$;
revoke all on function app.ticket_decision_cancel(uuid, text) from public;
grant execute on function app.ticket_decision_cancel(uuid, text) to kaname_app;
