-- 20261120130600 書き込みと一緒に段を変える（K-389・契約の口 createTicketMessage の段の欄・D-128.45・D-125.33・D-125.68・D-128.81・D-136.1・答え合わせ ①⑦⑧⑭⑮4⑮7）
--   K-385 の app.ticket_message_post を作り直し（引数と答えの形 { item } は変えない）、段の欄（stage_key か stage_id・hold_reason・resume_condition）を足す。
--   段・保留の列・書き込み（changes 付き）・K-385 の受け箱の行・段の受け箱の行・証跡を、この関数の 1 回（1 つの取引）で書く。途中で断れば何も残らない。
--   段は K-387 の app.ticket_progress_set（p_line false：変更の 1 行は書かず changes と notify_assignee を返す）を呼ぶ。
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない（create or replace）

create or replace function app.ticket_message_post(p_ticket uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype;
  v_body text := p->>'body'; v_mention uuid[]; v_notify_ids uuid[]; v_quote uuid := nullif(p->>'quote_of_id', '')::uuid;
  v_qtext text; v_bad uuid; v_id uuid; v_seen timestamptz;
  r jsonb; v_changes jsonb; v_extra text[] := '{}'; v_notify uuid;   -- K-389
begin
  if v_tenant is null or v_me is null or p_ticket is null
     or not app.ticket_member_ok(v_tenant, v_me) or not app.ticket_visible(p_ticket) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null;
  if t.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_body is null or btrim(v_body, E' \t\r\n\f\v　') = '' then
    return jsonb_build_object('error', 'empty', 'field', 'body');
  end if;
  -- 重なりは 1 つにし、並びは最初に出た順。知らせる人の並びから自分を外す（@ は本文の札なので自分も残す）
  select coalesce(array_agg(y.id order by y.n), '{}'::uuid[]) into v_mention
    from (select distinct on (x.id::uuid) x.id::uuid as id, x.n from jsonb_array_elements_text(coalesce(p->'mention_member_ids', '[]'::jsonb))
            with ordinality as x(id, n) order by x.id::uuid, x.n) y;
  select coalesce(array_agg(y.id order by y.n), '{}'::uuid[]) into v_notify_ids
    from (select distinct on (x.id::uuid) x.id::uuid as id, x.n from jsonb_array_elements_text(coalesce(p->'notify_member_ids', '[]'::jsonb))
            with ordinality as x(id, n) where x.id::uuid <> v_me order by x.id::uuid, x.n) y;
  v_bad := app.ticket_message_people(p_ticket, v_mention);
  if v_bad is not null then return jsonb_build_object('error', 'not_selectable', 'field', 'mention_member_ids'); end if;
  v_bad := app.ticket_message_people(p_ticket, v_notify_ids);
  if v_bad is not null then return jsonb_build_object('error', 'not_selectable', 'field', 'notify_member_ids'); end if;
  if v_quote is not null then
    -- 同じチケットの、消していない書き込み（kind post）だけ。元の頭の 2 行（改行で分けた最初の 2 行・行の中は切らない）を写す
    select array_to_string((string_to_array(m.body, E'\n'))[1:2], E'\n') into v_qtext
      from ticket_messages m
     where m.id = v_quote and m.tenant_id = v_tenant and m.ticket_id = p_ticket and m.kind = 'post' and m.deleted_at is null;
    if not found then return jsonb_build_object('error', 'not_selectable', 'field', 'quote_of_id'); end if;
  end if;
  -- ★ K-389：段の欄。無ければ今までの書き込みと同じ（段の欄が無いのに保留の欄があれば断る・何も書かない。見えない人には上の not_found を先に返す）
  if p ? 'stage_key' or p ? 'stage_id' then
    r := app.ticket_progress_set(p_ticket, p - 'body' - 'mention_member_ids' - 'notify_member_ids' - 'quote_of_id', false);
    if r ? 'error' then return r; end if;   -- 段の所の断り（言葉と欄はそのまま。口が K-387 の振り分けで答えにする）
    v_changes := case when (r->>'changed')::boolean then r->'changes' end;
    v_notify := nullif(r->>'notify_assignee', '')::uuid;
  else
    if coalesce(jsonb_typeof(p -> 'hold_reason'), 'null') <> 'null' then v_extra := array_append(v_extra, 'hold_reason'); end if;
    if coalesce(jsonb_typeof(p -> 'resume_condition'), 'null') <> 'null' then v_extra := array_append(v_extra, 'resume_condition'); end if;
    if cardinality(v_extra) > 0 then return jsonb_build_object('error', 'hold_not_allowed', 'fields', to_jsonb(v_extra)); end if;
  end if;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, mentions, notify_member_ids, quote_of_id, quote_text, changes, created_by, updated_by)
    values (v_tenant, p_ticket, v_me, 'post', v_body, v_mention, v_notify_ids, v_quote, v_qtext, v_changes, v_me, v_me)
    returning id into v_id;
  perform app.ticket_message_notify(v_id, v_notify_ids, v_mention);
  -- 段の知らせ（担当者でない人が段を変えたときだけ・K-387 の形）。同じ人にこの書き込みの受け箱の行がもう在れば書かない（1 人 1 通・⑮7）
  if v_notify is not null and not exists (select 1 from notifications o where o.member_id = v_notify and o.payload->>'message_id' = v_id::text) then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
      values (v_tenant, v_notify, 'inapp', 'ticket.stage_changed',
              jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text, 'message_id', v_id,
                                 'stage', (r->'stage') - 'id'),
              'ticket.stage_changed:' || v_id::text, now(), v_me);
  end if;
  select s.seen_at into v_seen from app.ticket_thread_seen s where s.tenant_id = v_tenant and s.ticket_id = p_ticket and s.member_id = v_me;
  return jsonb_build_object('item', app.ticket_timeline_item(v_id, v_seen));
end $$;
revoke all on function app.ticket_message_post(uuid, jsonb) from public;
grant execute on function app.ticket_message_post(uuid, jsonb) to kaname_app;
