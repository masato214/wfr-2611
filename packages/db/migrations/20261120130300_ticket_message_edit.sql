-- 20261120130300 やり取りの書き込みを直す・消す・☆（K-386・契約の口 updateTicketMessage・deleteTicketMessage・starTicketMessage・答え合わせ ⑩⑪⑫⑭・D-125.131・D-130.1・D-136.1・D-136.2・関門 C2 と C6 の受け箱の行）
--   どれも security definer・呼ぶのは kaname_app だけ。見ている人は app.user_id()。1 回の呼び出しが 1 つの取引（途中で落ちたら何も残らない）。
--   共通の始め：会社の人でない・書き込みが無い（別の会社・書き込みでない・消した）・チケットが見えない なら { error: "not_found" }（中身を返さない・D-136.2）
--   本文の列は消しても DB に残す（見せない・戻す口は無い）。証跡 audit_events の payload に本文は入れない
--
-- ① app.ticket_message_edit(p_message, p)：直す。本人だけ。p の鍵：body・mention_member_ids（新しく @ した人にだけ知らせる）
-- ② app.ticket_message_delete(p_message)：消す。本人かそのチケットのグループのマネージャー。跡 1 行と証跡 1 行
-- ③ app.ticket_message_star(p_message)：☆ の付け外し。reactions の star の並びに自分の id を足す／外す

-- ① 直す。答え { item }（app.ticket_timeline_item の形）か { error, field? }（何も変えていない）。
--   error：not_found／forbidden（書いた本人でない）／empty（本文が空）／not_selectable（@ が選べない・field が欄の名前）
create or replace function app.ticket_message_edit(p_message uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r ticket_messages%rowtype;
  v_body text := p->>'body'; v_mention uuid[]; v_new uuid[]; v_bad uuid; v_seen timestamptz;
begin
  if v_tenant is null or v_me is null or p_message is null or not app.ticket_member_ok(v_tenant, v_me) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into r from ticket_messages where id = p_message and tenant_id = v_tenant for update;
  if r.id is null or r.kind <> 'post' or r.deleted_at is not null or not app.ticket_visible(r.ticket_id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if r.author_member_id is distinct from v_me then return jsonb_build_object('error', 'forbidden'); end if;
  if v_body is null or btrim(v_body, E' \t\r\n\f\v　') = '' then
    return jsonb_build_object('error', 'empty', 'field', 'body');
  end if;
  -- 重なりは 1 つにし、並びは最初に出た順（@ は本文の札なので自分も残す）
  select coalesce(array_agg(y.id order by y.n), '{}'::uuid[]) into v_mention
    from (select distinct on (x.id::uuid) x.id::uuid as id, x.n from jsonb_array_elements_text(coalesce(p->'mention_member_ids', '[]'::jsonb))
            with ordinality as x(id, n) order by x.id::uuid, x.n) y;
  v_bad := app.ticket_message_people(r.ticket_id, v_mention);
  if v_bad is not null then return jsonb_build_object('error', 'not_selectable', 'field', 'mention_member_ids'); end if;
  -- 新しく @ した人 = 新しい @ − 前の @ − 自分
  select coalesce(array_agg(u.id order by u.n), '{}'::uuid[]) into v_new
    from unnest(v_mention) with ordinality as u(id, n)
   where u.id <> v_me and not (u.id = any(coalesce(r.mentions, '{}'::uuid[])));
  update ticket_messages set body = v_body, mentions = v_mention, edited_at = now(), updated_by = v_me where id = r.id;
  perform app.ticket_message_notify(r.id, v_new, v_new);
  select s.seen_at into v_seen from app.ticket_thread_seen s where s.tenant_id = v_tenant and s.ticket_id = r.ticket_id and s.member_id = v_me;
  return jsonb_build_object('item', app.ticket_timeline_item(r.id, v_seen));
end $$;
revoke all on function app.ticket_message_edit(uuid, jsonb) from public;
grant execute on function app.ticket_message_edit(uuid, jsonb) to kaname_app;

-- ② 消す。答え { item }（kind deleted の跡）か { error }。error：not_found／forbidden（本人でもマネージャーでもない）
create or replace function app.ticket_message_delete(p_message uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r ticket_messages%rowtype; t tickets%rowtype; v_seen timestamptz;
begin
  if v_tenant is null or v_me is null or p_message is null or not app.ticket_member_ok(v_tenant, v_me) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into r from ticket_messages where id = p_message and tenant_id = v_tenant for update;
  if r.id is null or r.kind <> 'post' or r.deleted_at is not null or not app.ticket_visible(r.ticket_id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into t from tickets where id = r.ticket_id and tenant_id = v_tenant;
  if r.author_member_id is distinct from v_me and not app.manages_scope(t.scope_id) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  update ticket_messages set deleted_at = now(), deleted_by = v_me, updated_by = v_me where id = r.id;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'ticket_message.delete', 'ticket_messages', r.id::text, 'C2',
            jsonb_build_object('ticket_id', r.ticket_id, 'author_member_id', r.author_member_id,
                               'by_manager', r.author_member_id is distinct from v_me), v_me);
  select s.seen_at into v_seen from app.ticket_thread_seen s where s.tenant_id = v_tenant and s.ticket_id = r.ticket_id and s.member_id = v_me;
  return jsonb_build_object('item', app.ticket_timeline_item(r.id, v_seen));
end $$;
revoke all on function app.ticket_message_delete(uuid) from public;
grant execute on function app.ticket_message_delete(uuid) to kaname_app;

-- ③ ☆。行を待ち合わせて（for update）自分の id を star の並びに足す／外す。直した時刻は変えない。誰にも知らせない
--   答え { id, stars, starred } か { error: "not_found" }
create or replace function app.ticket_message_star(p_message uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r ticket_messages%rowtype; v_stars jsonb; v_on boolean;
begin
  if v_tenant is null or v_me is null or p_message is null or not app.ticket_member_ok(v_tenant, v_me) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into r from ticket_messages where id = p_message and tenant_id = v_tenant for update;
  if r.id is null or r.kind <> 'post' or r.deleted_at is not null or not app.ticket_visible(r.ticket_id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  v_stars := case when jsonb_typeof(r.reactions->'star') = 'array' then r.reactions->'star' else '[]'::jsonb end;
  v_on := v_stars ? v_me::text;
  if v_on then
    select coalesce(jsonb_agg(x.v order by x.n), '[]'::jsonb) into v_stars
      from jsonb_array_elements_text(v_stars) with ordinality as x(v, n) where x.v <> v_me::text;
  else
    v_stars := v_stars || to_jsonb(v_me::text);
  end if;
  update ticket_messages set reactions = jsonb_set(coalesce(r.reactions, '{}'::jsonb), '{star}', v_stars, true), updated_by = v_me where id = r.id;
  return jsonb_build_object('id', r.id, 'stars', jsonb_array_length(v_stars), 'starred', not v_on);
end $$;
revoke all on function app.ticket_message_star(uuid) from public;
grant execute on function app.ticket_message_star(uuid) to kaname_app;
