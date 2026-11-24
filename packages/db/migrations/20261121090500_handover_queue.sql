-- 20261121090500 渡されたものを承認待ちに並べる・詳細で渡しの今と記録を読む（K-405・段 9・D-148.7・D-148.11〜D-148.14・D-148.33・D-148.35・D-148.38・D-148.40・D-148.41・D-128.34・D-128.89・D-131.9）
--   列は足さない（K-401 が足した列を読む）。読む関数だけ（DB に書かない・stable）。
--   承認待ちの口（K-161 の queue.ts）と続きの鍵は変えない。app.approval_queue・app.approval_queue_count（0095）を作り直し、承認の行と渡しの行を 1 つの並びにする。
--   渡しの行で答える人の判定は K-401 の app.handover_answerer に任せる（種類に関わらず・後ろの葉は行を入れれば勝手に並ぶ）。
--   どの関数も security definer・search_path に pg_temp。public から外し、口が直に呼ぶ物だけ kaname_app に渡す（0095 と同じ）。中だけで使う関数は誰にも渡さない。
--   会社は app.tenant_id() と行の tenant_id で見る。呼んだ人は app.user_id() で引く。

-- ---------------------------------------------------------------- 一緒に移す子の数（D-148.11）
--   switch の children が真なら、移す人が担当の子・孫で終わっていない・消していない物の数。移す人は今の担当者：
--   渡す・配るは from_member_id、申し出は to_member_id（申し出の from は申し出た人で、子を持っているのは答える担当者）。
--   決まった渡しは実際に移した物 switch_applied の子の数（配列なら長さ・数ならその値）
create or replace function app.handover_carry(p_handover uuid) returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
           when h.state <> 'waiting' and h.switch_applied is not null then
             case jsonb_typeof(h.switch_applied -> 'children')
               when 'array' then jsonb_array_length(h.switch_applied -> 'children')
               when 'number' then (h.switch_applied ->> 'children')::integer
               else 0 end
           when coalesce((h.switch ->> 'children')::boolean, false) then
             (select count(*)::integer
                from app.handover_switch_targets(h.ticket_id, case when h.kind = 'offer' then h.to_member_id else h.from_member_id end) x
               where x.target = 'children' and x.mine)
           else 0 end
    from ticket_handovers h
   where h.id = p_handover and h.tenant_id = app.tenant_id()
$$;
revoke all on function app.handover_carry(uuid) from public;

-- ---------------------------------------------------------------- 承認待ちの渡しの行（鍵はちょうど 20）
create or replace function app.handover_item_json(p_handover uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
           'kind', 'handover', 'handover_kind', h.kind, 'id', h.id, 'ticket_id', t.id, 'ticket_number', t.number, 'title', t.title,
           'from_member_id', h.from_member_id, 'from_name', app.member_name(h.from_member_id),
           'check_summary', '',
           'due_on', to_char(coalesce((h.reply_due at time zone 'Asia/Tokyo')::date, t.due_on), 'YYYY-MM-DD'),
           'reply_due', h.reply_due,
           'decide_inline', true, 'irreversible', false,
           'primary_action', case when h.kind = 'offer' then 'give'
                                  when h.kind = 'distribute' and h.to_member_id is null then 'claim'
                                  else 'accept' end,
           'secondary_action', case when h.kind = 'distribute' and h.to_member_id is null then 'assign' else 'decline' end,
           'note', h.reason,
           'carry_children', app.handover_carry(h.id),
           'to_scope_name', (select s.name from scopes s where s.id = h.to_scope_id),
           'ticket_scope_name', (select s.name from scopes s where s.id = t.scope_id),
           'created_at', h.created_at)
    from ticket_handovers h join tickets t on t.id = h.ticket_id
   where h.id = p_handover and h.tenant_id = app.tenant_id()
$$;
revoke all on function app.handover_item_json(uuid) from public;

-- ---------------------------------------------------------------- 承認の行に渡しの 5 つの鍵を null で足す（鍵の数は渡しの行と同じ 20）
create or replace function app.approval_item_json(p_approval uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
           'kind', a.kind, 'id', a.id, 'ticket_id', t.id, 'ticket_number', t.number, 'title', t.title,
           'from_member_id', a.requested_by, 'from_name', app.member_name(a.requested_by),
           'check_summary', '検査なし（まだ流していません）',
           'due_on', to_char(t.due_on, 'YYYY-MM-DD'),
           'decide_inline', not a.irreversible and coalesce(a.human_checks, '[]'::jsonb) = '[]'::jsonb,
           'irreversible', a.irreversible,
           'primary_action', case when not a.irreversible and coalesce(a.human_checks, '[]'::jsonb) = '[]'::jsonb
                                  then 'approve' else 'open' end,
           'secondary_action', 'return', 'note', a.note, 'created_at', a.created_at,
           'handover_kind', null, 'reply_due', null, 'carry_children', null, 'to_scope_name', null, 'ticket_scope_name', null)
    from approvals a join tickets t on t.id = a.ticket_id where a.id = p_approval
$$;
revoke all on function app.approval_item_json(uuid) from public;

-- ---------------------------------------------------------------- 承認待ちの一覧（承認の行と渡しの行を 1 つの並びに）
--   並びの鍵 due：承認はチケットの期限、渡しは返事の期限の日本の日付（無ければチケットの期限・D-148.40）。期限なしは最後。
--   上へ上げる（escalate）は並べない（束 C は後・D-148.1）。答えるのが呼んだ人の待っている渡しだけ（app.handover_answerer）
create or replace function app.approval_queue(p_limit integer, p_after_due date, p_after_created timestamptz, p_after_id uuid)
returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(case when x.src = 'h' then app.handover_item_json(x.id) else app.approval_item_json(x.id) end
                            order by x.due asc nulls last, x.created asc, x.id asc), '[]'::jsonb)
    from (select c.id, c.src, c.due, c.created
            from (select a.id, 'a'::text as src, t.due_on as due, a.created_at as created
                    from tickets t join approvals a on a.ticket_id = t.id
                   where app.member_ok()
                     and t.tenant_id = app.tenant_id() and a.tenant_id = app.tenant_id() and t.deleted_at is null
                     and t.assignee_member_id = app.user_id() and a.kind = 'artifact'
                     and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
                     and app.ticket_writable(t.id)
                  union all
                  select h.id, 'h'::text, coalesce((h.reply_due at time zone 'Asia/Tokyo')::date, t.due_on), h.created_at
                    from ticket_handovers h join tickets t on t.id = h.ticket_id
                   where app.member_ok()
                     and h.tenant_id = app.tenant_id() and t.tenant_id = app.tenant_id()
                     and h.state = 'waiting' and h.deleted_at is null and h.kind in ('pass', 'offer', 'distribute')
                     and t.deleted_at is null
                     and app.handover_answerer(h.id, app.user_id())) c
           where (p_after_created is null
                  or (p_after_due is not null and (c.due is null or c.due > p_after_due
                                                   or (c.due = p_after_due and (c.created, c.id) > (p_after_created, p_after_id))))
                  or (p_after_due is null and c.due is null and (c.created, c.id) > (p_after_created, p_after_id)))
           order by c.due asc nulls last, c.created asc, c.id asc
           limit greatest(1, least(coalesce(p_limit, 20), 201))) x
$$;
revoke all on function app.approval_queue(integer, date, timestamptz, uuid) from public;
grant execute on function app.approval_queue(integer, date, timestamptz, uuid) to kaname_app;

-- 承認待ちの数（一覧と同じ 2 つの条件の和）
create or replace function app.approval_queue_count() returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select (
    (select count(*) from tickets t join approvals a on a.ticket_id = t.id
      where app.member_ok()
        and t.tenant_id = app.tenant_id() and a.tenant_id = app.tenant_id() and t.deleted_at is null
        and t.assignee_member_id = app.user_id() and a.kind = 'artifact'
        and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
        and app.ticket_writable(t.id))
    +
    (select count(*) from ticket_handovers h join tickets t on t.id = h.ticket_id
      where app.member_ok()
        and h.tenant_id = app.tenant_id() and t.tenant_id = app.tenant_id()
        and h.state = 'waiting' and h.deleted_at is null and h.kind in ('pass', 'offer', 'distribute')
        and t.deleted_at is null
        and app.handover_answerer(h.id, app.user_id()))
  )::integer
$$;
revoke all on function app.approval_queue_count() from public;
grant execute on function app.approval_queue_count() to kaname_app;

-- ---------------------------------------------------------------- 詳細の渡しの記録（新しい 50 件・鍵はちょうど 17）
--   読めるのは、そのチケットを読める人か、そのチケットの渡しの渡した人・答える人（決まった渡しも含む）。
--   読めない・チケットが無い・消した・別の会社は null（有ることも漏らさない）。何も書かない
create or replace function app.ticket_handovers_read(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id(); t tickets%rowtype; v_today date := (now() at time zone 'Asia/Tokyo')::date; v jsonb;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then return null; end if;
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null;
  if not found then return null; end if;
  if not app.ticket_visible(p_ticket)
     and not exists (select 1 from ticket_handovers h
                      where h.ticket_id = t.id and h.tenant_id = t.tenant_id and h.deleted_at is null
                        and (h.from_member_id = v_me or app.handover_answerer(h.id, v_me, false))) then
    return null;
  end if;
  with ranked as (
    select h.*, row_number() over (order by h.created_at desc, h.id desc) as rn
      from ticket_handovers h
     where h.ticket_id = t.id and h.tenant_id = t.tenant_id and h.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'kind', r.kind, 'state', r.state,
           'from', jsonb_build_object('member_id', f.id, 'display_name', f.display_name),
           'to', case when m.id is null then null else jsonb_build_object('member_id', m.id, 'display_name', m.display_name) end,
           'to_scope', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'code', s.ticket_prefix) end,
           'ticket_scope', (select jsonb_build_object('id', g.id, 'name', g.name, 'code', g.ticket_prefix) from scopes g where g.id = t.scope_id),
           'reason', r.reason, 'ask', r.ask, 'reply_due', r.reply_due,
           'overdue', r.state = 'waiting' and r.reply_due is not null and r.reply_due < now(),
           'switch', jsonb_build_object('children', app.handover_carry(r.id), 'group', coalesce((r.switch ->> 'group')::boolean, false)),
           'decline_reason', r.decline_reason, 'decided_at', r.decided_at, 'reminded_at', r.reminded_at, 'created_at', r.created_at,
           'can', jsonb_build_object(
             'answer', r.state = 'waiting' and app.handover_answerer(r.id, v_me),
             'withdraw', r.state = 'waiting' and r.from_member_id = v_me,
             'remind', r.state = 'waiting' and r.from_member_id = v_me and r.kind in ('pass', 'distribute') and r.to_member_id is not null
                       and (r.reminded_at is null or (r.reminded_at at time zone 'Asia/Tokyo')::date <> v_today),
             'reassign', r.rn = 1 and r.kind = 'pass' and r.state in ('waiting', 'declined')
                         and r.from_member_id = v_me and t.assignee_member_id is not distinct from v_me))
         order by r.created_at desc, r.id desc), '[]'::jsonb)
    into v
    from ranked r
    join members f on f.id = r.from_member_id
    left join members m on m.id = r.to_member_id
    left join scopes s on s.id = r.to_scope_id
   where r.rn <= 50;
  return v;
end $$;
revoke all on function app.ticket_handovers_read(uuid) from public;
grant execute on function app.ticket_handovers_read(uuid) to kaname_app;

-- ---------------------------------------------------------------- 詳細の答え getTicket に載せる今の渡し（待っている 1 件か、無ければ一番新しく作った 1 件・無ければ null）
create or replace function app.ticket_handover_current(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v jsonb := app.ticket_handovers_read(p_ticket); w jsonb;
begin
  if v is null or jsonb_array_length(v) = 0 then return null; end if;
  select e into w from jsonb_array_elements(v) with ordinality as x(e, n) where e ->> 'state' = 'waiting' order by n limit 1;
  return coalesce(w, v -> 0);
end $$;
revoke all on function app.ticket_handover_current(uuid) from public;
grant execute on function app.ticket_handover_current(uuid) to kaname_app;

-- ---------------------------------------------------------------- 見ている人が渡せる種類（入口の出し分け・K-401 の app.handover_kinds を包む。あれは kaname_app から直に呼べない）
create or replace function app.ticket_handover_kinds(p_ticket uuid) returns text[]
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if app.user_id() is null or app.tenant_id() is null or not app.member_ok() or not app.ticket_visible(p_ticket) then
    return '{}'::text[];
  end if;
  return app.handover_kinds(p_ticket, app.user_id());
end $$;
revoke all on function app.ticket_handover_kinds(uuid) from public;
grant execute on function app.ticket_handover_kinds(uuid) to kaname_app;
