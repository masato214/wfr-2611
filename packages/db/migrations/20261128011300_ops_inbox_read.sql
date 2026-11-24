-- 20261128011300_ops_inbox_read 運営の受信箱を読む（K-973・契約の口 listOpsInquiries・getOpsInquiry・関門 C2・D-125.129・D-156.3・D-156.12・D-156.17・D-156.25・D-156.26・D-128.71）
--   ① app.inquiry_ops_row(問い合わせ)：受信箱の 1 行の 10 欄（内部用・kaname_app に渡さない）
--   ② app.ops_inquiries(box, topic, limit)：全社をまたぐ受信箱。箱の決めは K-963 の app.ops_shell の受信箱の数と同じ
--   ③ app.ops_inquiry(id)：1 件の 13 欄（10 欄・やり取り・画面の情報・右のワークスペースの様子）。無い・消した物は no_data_found（口が 404）
--   ②③ は頭で app.ops_require('inquiry')（K-947 の型・2 層目）。読むだけなので運営の記録・顧客の読んだ印は書かない
--   数える問い合わせ：問い合わせを消していない・会社を消していない・作りかけの会社でない・運営の会社でない（K-963 と同じ）

create or replace function app.inquiry_ops_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'topic', q.topic_key,
    'state', q.state,
    'workspace', jsonb_build_object('id', t.id, 'name', t.name),
    'asker', jsonb_build_object('name', a.display_name),
    'owner', case when q.assignee_ops_member_id is null then null
                  else jsonb_build_object('member_id', q.assignee_ops_member_id, 'name', o.display_name) end,
    'later_until', q.later_until,
    'created_at', q.created_at,
    'last_message_at', q.last_message_at)
    from inquiries q
    join tenants t on t.id = q.tenant_id
    left join members a on a.id = q.opened_by_member_id
    left join members o on o.id = q.assignee_ops_member_id
   where q.id = p_id
$$;
revoke all on function app.inquiry_ops_row(uuid) from public;

create or replace function app.ops_inquiries(p_box text, p_topic text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_box text := coalesce(p_box, 'unassigned');
  v_limit integer := coalesce(p_limit, 50);
  v_rows jsonb;
begin
  perform app.ops_require('inquiry');
  if v_box not in ('unassigned', 'mine', 'waiting', 'later', 'done') then
    raise exception '知らない箱' using errcode = 'invalid_parameter_value';
  end if;
  if v_limit < 1 or v_limit > 100 then
    raise exception 'limit は 1〜100' using errcode = 'invalid_parameter_value';
  end if;

  with c as (
    select q.id, q.last_message_at
      from inquiries q
      join tenants t on t.id = q.tenant_id
     where q.deleted_at is null
       and t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and (p_topic is null or q.topic_key = p_topic)
       and case v_box
             when 'unassigned' then q.assignee_ops_member_id is null and q.state <> 'done'
             when 'mine' then q.assignee_ops_member_id = app.user_id() and q.state <> 'done'
             when 'waiting' then q.state = 'waiting'
             when 'later' then q.state = 'later'
             else q.state = 'done'
           end
     order by q.last_message_at desc nulls last, q.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(app.inquiry_ops_row(c.id) order by c.last_message_at desc nulls last, c.id desc), '[]'::jsonb)
    into v_rows
    from c;
  return v_rows;
end $$;
revoke all on function app.ops_inquiries(text, text, integer) from public;
grant execute on function app.ops_inquiries(text, text, integer) to kaname_app;

create or replace function app.ops_inquiry(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  q record;
  v_facts jsonb;
  v_messages jsonb;
  v_pc text;
  v_stuck integer;
  v_overdue integer;
begin
  perform app.ops_require('inquiry');
  select x.id, x.tenant_id, x.conversation_id, x.opened_by_member_id, x.context
    into q
    from inquiries x
    join tenants t on t.id = x.tenant_id
   where x.id = p_id and x.deleted_at is null
     and t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id();
  if not found then
    raise exception '問い合わせが無い' using errcode = 'no_data_found';
  end if;

  -- やり取り：顧客の書き込み（customer）・運営の返事（reply）・社内メモ（note）を古い順に
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'kind', k.kind,
           'author_name', case when k.kind = 'customer' then s.display_name else m.author_name end,
           'body', m.body,
           'attachments', coalesce(m.attachments, '[]'::jsonb),
           'created_at', m.created_at) order by m.created_at, m.id), '[]'::jsonb)
    into v_messages
    from messages m
    left join members s on s.id = m.sender_member_id
    cross join lateral (select case
             when m.sender_member_id is not null then 'customer'
             when m.kind = 'inquiry_reply' then 'reply'
             when m.kind = 'inquiry_note' then 'note'
           end as kind) k
   where m.conversation_id = q.conversation_id and m.tenant_id = q.tenant_id
     and m.deleted_at is null and k.kind is not null;

  -- 右の様子：数と種類だけ（D-156.3）。プランと人数は K-963 の app.workspace_facts の 1 か所
  v_facts := app.workspace_facts(q.tenant_id);

  select case
           when exists (select 1 from sessions s
                         where s.tenant_id = q.tenant_id and s.member_id = q.opened_by_member_id
                           and s.kind_id = 'bridge' and s.revoked_at is null and s.alive_at is not null
                           and s.last_seen_at > now() - interval '90 seconds') then 'connected'
           when exists (select 1 from sessions s
                         where s.tenant_id = q.tenant_id and s.member_id = q.opened_by_member_id
                           and s.kind_id = 'bridge') then 'paired'
           else 'never'
         end
    into v_pc;

  select count(*)::integer into v_stuck
    from action_runs r
   where r.tenant_id = q.tenant_id and r.status_id = 'stopped' and r.deleted_at is null
     and r.created_at > now() - interval '7 days';

  select count(*)::integer into v_overdue
    from invoices i
   where i.tenant_id = q.tenant_id and i.issued_at is not null and i.deleted_at is null
     and i.status_id <> 'paid' and i.due_on < v_today;

  return app.inquiry_ops_row(q.id) || jsonb_build_object(
    'messages', v_messages,
    'context', coalesce(q.context, '{}'::jsonb),
    'workspace_status', jsonb_build_object(
      'plan_name', v_facts->'plan_name',
      'members', coalesce((v_facts->'members'->>'count')::integer, 0),
      'pc', v_pc,
      'stuck_runs', v_stuck,
      'overdue', v_overdue));
end $$;
revoke all on function app.ops_inquiry(uuid) from public;
grant execute on function app.ops_inquiry(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('20261128011300_ops_inbox_read.sql') on conflict do nothing;
