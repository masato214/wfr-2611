-- 20261121090100 渡す・配るの置き場（K-401・段 9・D-148.1〜D-148.20・D-125.70・D-125.71・D-128.115・関門 C2）
--   ticket_handovers に後ろの葉が使う列を 1 回だけ足し、渡す口・答える口の共通の判定の DB の関数と、渡す前の下見・決まりを読む関数を置く。
--   待っている渡しは 1 つのチケットに 1 つ（D-148.20）。一意の索引は置かない（場合表の種と前からの試験が、種のチケットに待っている渡しを
--   何本も入れるため）。渡しの行を作る関数（後ろの葉）は、どれも最初に app.handover_gate(…, p_lock => true) でチケットの行を for update で
--   取ってから数える（同時の 2 本目は前の確定を待って E-HND-004 で断る）。
--   どの関数も security definer・search_path に pg_temp。public から外し、口が直に呼ぶ物だけ kaname_app に渡す。
--   会社は app.tenant_id() と行の tenant_id で見る。呼んだ人は app.user_id() で引く（判定の関数は人を引数で受ける）

-- ---------------------------------------------------------------- 列（後ろの葉が使う物をここで 1 回だけ）
alter table ticket_handovers add column if not exists notify_managers boolean not null default false;   -- 上の層にも知らせる（K-402・D-148.10）
alter table ticket_handovers add column if not exists reminded_at timestamptz;                          -- 催促した時刻（K-406・1 日 1 回）
alter table ticket_handovers add column if not exists overdue_notified_at timestamptz;                  -- 期限切れを知らせた時刻（K-407）
alter table ticket_handovers add column if not exists switch_applied jsonb;                             -- 実際に移した物（K-403・K-404）
alter table ticket_handovers add column if not exists answered_by uuid references members(id);          -- 答えた人（K-403・K-408〜K-410）

-- ---------------------------------------------------------------- 人の状態：'active'・'suspended'・'invited'・'gone'
--   gone＝無い・消した・抜けた（left）・別の会社・人でない（AI 社員・分身）
create or replace function app.handover_member_state(p_member uuid) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare m members%rowtype; v_status text;
begin
  select * into m from members x where x.id = p_member and x.tenant_id = app.tenant_id();
  if not found or m.deleted_at is not null or m.kind_id <> 'human' then return 'gone'; end if;
  select tm.status into v_status from tenant_memberships tm
   where tm.member_id = p_member and tm.tenant_id = m.tenant_id and tm.deleted_at is null;
  if v_status = 'left' then return 'gone'; end if;
  if m.suspended_at is not null or v_status = 'suspended' then return 'suspended'; end if;
  if v_status = 'invited' then return 'invited'; end if;
  return 'active';
end $$;

-- ---------------------------------------------------------------- その人がグループ（か上のグループ）を管理するか（app.manages_scope を人で見る・0082 と同じ条件）
create or replace function app.handover_manages(p_member uuid, p_scope uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select p_scope is not null and p_member is not null and (
    app.is_admin(p_member)
    or exists (
      select 1 from scope_memberships sm
      where sm.member_id = p_member and sm.tenant_id = app.tenant_id() and sm.role = 'manager' and sm.deleted_at is null
        and p_scope in (select app.scope_tree(sm.scope_id))
    )
    or exists (
      select 1 from tenant_memberships tm join members m on m.id = tm.member_id and m.tenant_id = tm.tenant_id
      where tm.member_id = p_member and tm.tenant_id = app.tenant_id() and tm.role = 'manager' and tm.status = 'active' and tm.deleted_at is null
        and m.scope_id is not null and p_scope in (select app.scope_tree(m.scope_id))
        and not exists (select 1 from scope_memberships sm2 where sm2.member_id = tm.member_id and sm2.scope_id = m.scope_id and sm2.deleted_at is null)
    )
  )
$$;

-- ---------------------------------------------------------------- その人がそのグループにいるか（主の所属か兼務）
create or replace function app.handover_in_group(p_member uuid, p_scope uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from members m where m.id = p_member and m.tenant_id = app.tenant_id() and m.scope_id = p_scope)
      or exists (select 1 from scope_memberships sm
                 where sm.member_id = p_member and sm.tenant_id = app.tenant_id() and sm.scope_id = p_scope and sm.deleted_at is null)
$$;

-- ---------------------------------------------------------------- その人ができる種類（D-148.3・D-148.12・D-148.17・D-148.18）
--   担当者本人＝{pass}（グループに配る p_to_scope で、そのグループを管理する人なら {pass,distribute}）／
--   そのチケットのグループを管理する人＝{distribute,offer}／そのグループで tickets の edit を持つ人＝{offer}／
--   閲覧のみ・取引先・止まっている人・抜けた人・取り込みの下書きのチケット＝{}
create or replace function app.handover_kinds(p_ticket uuid, p_member uuid, p_to_scope boolean default false) returns text[]
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype;
begin
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null;
  if not found or t.draft_import_id is not null then return '{}'::text[]; end if;
  if app.handover_member_state(p_member) <> 'active' then return '{}'::text[]; end if;
  if exists (select 1 from client_contacts c where c.member_id = p_member and c.tenant_id = t.tenant_id and c.deleted_at is null) then
    return '{}'::text[];
  end if;
  if t.assignee_member_id = p_member then
    if p_to_scope and app.handover_manages(p_member, t.scope_id) then return array['pass', 'distribute']; end if;
    return array['pass'];
  end if;
  if app.handover_manages(p_member, t.scope_id) then return array['distribute', 'offer']; end if;
  if has_permission(p_member, 'tickets', t.scope_id, 'edit') then return array['offer']; end if;
  return '{}'::text[];
end $$;

-- ---------------------------------------------------------------- 止まり（D-148.6・D-148.5・D-148.20）：null・'closed'・'ai_running'・'approval'・'waiting'
--   p_except の渡しは数えない（答える口の受けると、別の人にする replaces）
create or replace function app.handover_blocked(p_ticket uuid, p_except uuid default null) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_stage text;
begin
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = app.tenant_id();
  if not found then return null; end if;
  if t.completed_at is not null then return 'closed'; end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if coalesce(v_stage, '') in ('running', 'ai_running')
     or exists (select 1 from action_runs r where r.ticket_id = t.id and r.tenant_id = t.tenant_id
                  and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null) then
    return 'ai_running';
  end if;
  if coalesce(v_stage, '') in ('awaiting_approval', 'approval')
     or exists (select 1 from approvals a where a.ticket_id = t.id and a.tenant_id = t.tenant_id
                  and a.decision is null and a.withdrawn_at is null and a.deleted_at is null) then
    return 'approval';
  end if;
  if exists (select 1 from ticket_handovers h where h.ticket_id = t.id and h.tenant_id = t.tenant_id
               and h.state = 'waiting' and h.deleted_at is null and h.id is distinct from p_except) then
    return 'waiting';
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------- 答える人（D-128.115・D-148.17）
--   消していない・p_member が active・渡した人でない。相手（to_member_id）か、グループ宛て（to_member_id が空）でそのグループを管理する人。
--   p_waiting_only が true（既定・読める人）なら待っている物だけ。false（入口の行の決まり）なら状態を見ない（決まった渡しは 409 にするため）
create or replace function app.handover_answerer(p_handover uuid, p_member uuid, p_waiting_only boolean default true) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from ticket_handovers h
    where h.id = p_handover and h.tenant_id = app.tenant_id() and h.deleted_at is null
      and (not p_waiting_only or h.state = 'waiting')
      and p_member is not null and h.from_member_id <> p_member
      and (h.to_member_id = p_member
           or (h.to_member_id is null and h.to_scope_id is not null and app.handover_manages(p_member, h.to_scope_id)))
      and app.handover_member_state(p_member) = 'active'
  )
$$;

-- ---------------------------------------------------------------- 読める人の作り直し：答える人が答えるまで読める（グループ宛て・申し出も・D-128.115）。承認する人の枝（0077）はそのまま
create or replace function app.ticket_involved(tid uuid, uid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from ticket_handovers h
    where h.ticket_id = tid and h.tenant_id = app.tenant_id() and h.state = 'waiting' and h.deleted_at is null
      and app.handover_answerer(h.id, uid)
  ) or exists (
    select 1 from approvals a
    where a.ticket_id = tid and a.tenant_id = app.tenant_id() and a.approver_member_id = uid
      and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
  )
$$;

-- ---------------------------------------------------------------- 返事の期限の既定（D-148.4）：日本時間の次の平日（土日を飛ばす・祝日は数えない）の 18:00
create or replace function app.handover_default_due(p_now timestamptz) returns timestamptz
language sql stable security definer set search_path = public, app, pg_temp as $$
  with d as (select (p_now at time zone 'Asia/Tokyo')::date as day)
  select ((d.day + case extract(isodow from d.day) when 5 then 3 when 6 then 2 else 1 end) + time '18:00') at time zone 'Asia/Tokyo'
  from d
$$;

-- ---------------------------------------------------------------- 一緒に移す物（D-148.11）：子・孫（3 段まで）と関連・派生元（両向き・子に入った物は除く）。
--   消した・完了した・下書きの物は返さない（その下も辿らない）。mine＝担当者が p_from
create or replace function app.handover_switch_targets(p_ticket uuid, p_from uuid)
returns table (target text, ticket_id uuid, mine boolean)
language sql stable security definer set search_path = public, app, pg_temp as $$
  with recursive kids as (
    select c.id, c.assignee_member_id, 1 as depth from tickets c
     where c.parent_ticket_id = p_ticket and c.tenant_id = app.tenant_id()
       and c.deleted_at is null and c.completed_at is null and c.draft_import_id is null
    union all
    select c.id, c.assignee_member_id, k.depth + 1 from tickets c join kids k on c.parent_ticket_id = k.id
     where k.depth < 3 and c.tenant_id = app.tenant_id()
       and c.deleted_at is null and c.completed_at is null and c.draft_import_id is null
  ), linked as (
    select distinct o.id, o.assignee_member_id from ticket_links l
      join tickets o on o.id = case when l.from_ticket_id = p_ticket then l.to_ticket_id else l.from_ticket_id end
     where (l.from_ticket_id = p_ticket or l.to_ticket_id = p_ticket) and l.tenant_id = app.tenant_id() and l.deleted_at is null
       and o.tenant_id = app.tenant_id() and o.deleted_at is null and o.completed_at is null and o.draft_import_id is null
       and o.id <> p_ticket
  )
  select 'children'::text, k.id, k.assignee_member_id is not distinct from p_from from (select distinct id, assignee_member_id from kids) k
  union all
  select 'links'::text, l.id, l.assignee_member_id is not distinct from p_from from linked l
   where l.id not in (select id from kids)
$$;

-- ---------------------------------------------------------------- 決まりで整えた切り替え（D-125.71・D-148.39）
--   答え {"children", "links", "group", "axes": []} か {"error": "switch", "field": "switch.<鍵>"}。
--   always は選ばなくても true・never を選んだら error・ask は選んだとおり（既定 false）。
--   group は相手がチケットのグループにいるなら選べない（選んだら error）・相手が null（グループ宛て）なら false。軸は段 9 では受けない（空でなければ error）
create or replace function app.handover_switch_normalize(p_ticket uuid, p_receiver uuid, p_switch jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_scope uuid; v_in jsonb := coalesce(p_switch, '{}'::jsonb); v_out jsonb := '{}'::jsonb;
  k text; v_mode text; v_pick boolean;
begin
  if jsonb_typeof(v_in) <> 'object' then return jsonb_build_object('error', 'switch', 'field', 'switch'); end if;
  for k in select jsonb_object_keys(v_in) loop
    if k not in ('children', 'links', 'group', 'axes') then return jsonb_build_object('error', 'switch', 'field', 'switch.' || k); end if;
    if k <> 'axes' and jsonb_typeof(v_in -> k) <> 'boolean' then return jsonb_build_object('error', 'switch', 'field', 'switch.' || k); end if;
  end loop;
  if v_in ? 'axes' and (jsonb_typeof(v_in -> 'axes') <> 'array' or jsonb_array_length(v_in -> 'axes') > 0) then
    return jsonb_build_object('error', 'switch', 'field', 'switch.axes');
  end if;
  select t.scope_id into v_scope from tickets t where t.id = p_ticket and t.tenant_id = app.tenant_id();
  foreach k in array array['children', 'links', 'group'] loop
    select r.mode into v_mode from handover_rules r
     where r.tenant_id = app.tenant_id() and r.target = k and r.axis_id is null and r.deleted_at is null limit 1;
    v_mode := coalesce(v_mode, 'ask');
    v_pick := coalesce((v_in ->> k)::boolean, false);
    if v_mode = 'never' and v_pick then return jsonb_build_object('error', 'switch', 'field', 'switch.' || k); end if;
    if k = 'group' then
      if p_receiver is null then v_pick := false;
      elsif app.handover_in_group(p_receiver, v_scope) then
        if v_pick then return jsonb_build_object('error', 'switch', 'field', 'switch.group'); end if;
        v_pick := false;
      elsif v_mode = 'always' then v_pick := true;
      end if;
    elsif v_mode = 'always' then v_pick := true;
    end if;
    if v_mode = 'never' then v_pick := false; end if;
    v_out := v_out || jsonb_build_object(k, v_pick);
  end loop;
  return v_out || jsonb_build_object('axes', '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- 一緒に切り替える（空の形・K-404 が本物にする）
create or replace function app.handover_apply_switch(p_handover uuid, p_from uuid, p_to uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select '{}'::jsonb
$$;

-- ---------------------------------------------------------------- 渡す口の共通の確かめ（見える・種類・別の人にする・止まり・相手・切り替え）
--   答え {"ok": true, "kind", "ticket": {…}, "receiver", "switch"} か {"error": 言葉, …}。p_lock が true ならチケットの行を for update で取ってから数える
create or replace function app.handover_gate(p_ticket uuid, p jsonb, p_lock boolean default false) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id(); t tickets%rowtype; h ticket_handovers%rowtype;
  v_kind text := p ->> 'kind'; v_to uuid; v_scope uuid; v_except uuid; v_receiver uuid;
  v_blocked text; v_state text; v_name text; v_switch jsonb;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then return jsonb_build_object('error', 'not_found'); end if;
  if p_lock then perform 1 from tickets x where x.id = p_ticket and x.tenant_id = app.tenant_id() for update; end if;
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null;
  if not found or not app.ticket_visible(p_ticket) then return jsonb_build_object('error', 'not_found'); end if;
  if v_kind is null or not (v_kind = any (app.handover_kinds(p_ticket, v_me, p ->> 'to_scope_id' is not null))) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- 別の人にする（replaces・K-402）：待っている自分の渡し。その渡し自身は止まりに数えない
  if nullif(p ->> 'replaces', '') is not null then
    select * into h from ticket_handovers x
     where x.id = (p ->> 'replaces')::uuid and x.tenant_id = app.tenant_id() and x.ticket_id = p_ticket
       and x.from_member_id = v_me and x.deleted_at is null;
    if not found then return jsonb_build_object('error', 'replaces_forbidden'); end if;
    if h.state <> 'waiting' then return jsonb_build_object('error', 'replaces_decided', 'state', h.state); end if;
    v_except := h.id;
  end if;
  v_blocked := app.handover_blocked(p_ticket, v_except);
  if v_blocked = 'closed' then return jsonb_build_object('error', 'closed'); end if;
  if v_blocked in ('ai_running', 'approval') then return jsonb_build_object('error', 'busy', 'reason', v_blocked); end if;
  if v_blocked = 'waiting' then
    select coalesce(m.display_name, s.name) into v_name from ticket_handovers x
      left join members m on m.id = x.to_member_id left join scopes s on s.id = x.to_scope_id
     where x.ticket_id = p_ticket and x.tenant_id = app.tenant_id() and x.state = 'waiting' and x.deleted_at is null
       and x.id is distinct from v_except
     order by x.created_at desc limit 1;
    return jsonb_build_object('error', 'waiting', '名前', coalesce(v_name, ''));
  end if;
  -- 相手（引き継いでもらう・配る）。申し出の相手は今の担当者
  if v_kind = 'offer' then
    -- 答えるのは今の担当者。担当者が止まった・招待中・抜けた・いない・AI 社員のときは申し出を作らない（答える人がいないまま待ちが残るため・K-408 のレビュー）。番号は渡す（pass）の相手と同じ
    v_state := app.handover_member_state(t.assignee_member_id);
    if v_state = 'gone' then return jsonb_build_object('error', 'target', 'reason', 'gone'); end if;
    if v_state in ('suspended', 'invited') then
      select m.display_name into v_name from members m where m.id = t.assignee_member_id;
      return jsonb_build_object('error', 'target', 'reason', v_state, '名前', v_name);
    end if;
    v_receiver := t.assignee_member_id;
  else
    v_to := nullif(p ->> 'to_member_id', '')::uuid;
    v_scope := nullif(p ->> 'to_scope_id', '')::uuid;
    if v_to is null and v_scope is null then return jsonb_build_object('error', 'target', 'reason', 'missing'); end if;
    if v_scope is not null then
      if not exists (select 1 from scopes s where s.id = v_scope and s.tenant_id = app.tenant_id() and s.deleted_at is null) then
        return jsonb_build_object('error', 'target', 'reason', 'scope');
      end if;
    else
      if v_to = v_me then return jsonb_build_object('error', 'target', 'reason', 'self'); end if;
      v_state := app.handover_member_state(v_to);
      if v_state = 'gone' then return jsonb_build_object('error', 'target', 'reason', 'gone'); end if;
      if v_state in ('suspended', 'invited') then
        select m.display_name into v_name from members m where m.id = v_to;
        return jsonb_build_object('error', 'target', 'reason', v_state, '名前', v_name);
      end if;
      v_receiver := v_to;
    end if;
  end if;
  v_switch := app.handover_switch_normalize(p_ticket, v_receiver, coalesce(p -> 'switch', '{}'::jsonb));
  if v_switch ? 'error' then return v_switch; end if;
  return jsonb_build_object(
    'ok', true, 'kind', v_kind,
    'ticket', jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title, 'scope_id', t.scope_id, 'assignee_member_id', t.assignee_member_id),
    'receiver', v_receiver, 'switch', v_switch);
end $$;

-- ---------------------------------------------------------------- 答える口の共通の確かめ（無い・答える人でない・もう決まった）
create or replace function app.handover_answer_gate(p_handover uuid, p_lock boolean default false) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); h ticket_handovers%rowtype;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then return jsonb_build_object('error', 'not_found'); end if;
  if p_lock then
    perform 1 from tickets t where t.id = (select x.ticket_id from ticket_handovers x where x.id = p_handover and x.tenant_id = app.tenant_id()) for update;
    perform 1 from ticket_handovers x where x.id = p_handover and x.tenant_id = app.tenant_id() for update;
  end if;
  select * into h from ticket_handovers x where x.id = p_handover and x.tenant_id = app.tenant_id() and x.deleted_at is null;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  -- 待っている間にチケットが消された：答える側からは無いものとして 404（答えても担当者を替えず・知らせも出さない）
  if not exists (select 1 from tickets x where x.id = h.ticket_id and x.tenant_id = h.tenant_id and x.deleted_at is null) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if not app.handover_answerer(h.id, v_me, false) then
    if h.from_member_id = v_me or app.ticket_visible(h.ticket_id) then return jsonb_build_object('error', 'forbidden'); end if;
    return jsonb_build_object('error', 'not_found');
  end if;
  if h.state <> 'waiting' then return jsonb_build_object('error', 'decided', 'state', h.state); end if;
  return jsonb_build_object(
    'ok', true, 'kind', h.kind, 'target', case when h.to_member_id is null then 'scope' else 'member' end,
    'ticket_id', h.ticket_id, 'from_member_id', h.from_member_id, 'to_member_id', h.to_member_id, 'to_scope_id', h.to_scope_id);
end $$;

-- ---------------------------------------------------------------- 成功の答えの 16 の鍵を 1 か所で組む（種類の葉の DB の関数が答えに入れる）
create or replace function app.handover_json(p_handover uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', h.id, 'ticket_id', h.ticket_id, 'kind', h.kind, 'state', h.state,
    'from', jsonb_build_object('id', f.id, 'name', f.display_name),
    'to', case when t.id is null then null else jsonb_build_object('id', t.id, 'name', t.display_name) end,
    'to_scope', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'code', s.ticket_prefix) end,
    'reason', h.reason, 'ask', h.ask, 'reply_due', h.reply_due, 'switch', h.switch, 'switch_applied', h.switch_applied,
    'notify_managers', h.notify_managers, 'decline_reason', h.decline_reason, 'decided_at', h.decided_at, 'created_at', h.created_at)
  from ticket_handovers h
  join members f on f.id = h.from_member_id
  left join members t on t.id = h.to_member_id
  left join scopes s on s.id = h.to_scope_id
  where h.id = p_handover and h.tenant_id = app.tenant_id()
$$;

-- ---------------------------------------------------------------- 渡す前の下見（D-148.2・D-148.15・D-148.18）。見えない・消した・下書きのチケットは null。
--   できる種類が無い人には kinds だけを返す（口が 403 にして中身を返さない）。文は 1 つ（数は group by で 1 回）。
--   候補の人は 500 人まで（501 人目があれば candidates_over を true にする。口がログに 1 行出し、答えには載せない）
create or replace function app.handover_preview(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id(); t tickets%rowtype; v_kinds text[]; v_kinds_scope text[];
  v_monday date := date_trunc('week', now() at time zone 'Asia/Tokyo')::date;
  v_waiting jsonb; v_rules jsonb; v_children jsonb; v_links jsonb; v_group jsonb; v_cands jsonb; v_over boolean; v_groups jsonb := '[]'::jsonb;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then return null; end if;
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null;
  if not found or t.draft_import_id is not null or not app.ticket_visible(p_ticket) then return null; end if;
  v_kinds := app.handover_kinds(p_ticket, v_me, false);
  if cardinality(v_kinds) = 0 then return jsonb_build_object('kinds', '[]'::jsonb); end if;
  v_kinds_scope := app.handover_kinds(p_ticket, v_me, true);

  select jsonb_build_object(
           'id', h.id, 'kind', h.kind,
           'from', jsonb_build_object('id', f.id, 'name', f.display_name),
           'to', case when m.id is null then null else jsonb_build_object('id', m.id, 'name', m.display_name) end,
           'to_scope', case when s.id is null then null else jsonb_build_object('id', s.id, 'name', s.name, 'code', s.ticket_prefix) end,
           'reply_due', h.reply_due)
    into v_waiting
    from ticket_handovers h join members f on f.id = h.from_member_id
    left join members m on m.id = h.to_member_id left join scopes s on s.id = h.to_scope_id
   where h.ticket_id = t.id and h.tenant_id = t.tenant_id and h.state = 'waiting' and h.deleted_at is null
   order by h.created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('target', r.target, 'axis_id', r.axis_id, 'axis_name', a.name, 'mode', r.mode)
           order by array_position(array['children', 'links', 'group', 'axis'], r.target), a.name, r.id), '[]'::jsonb)
    into v_rules
    from handover_rules r left join class_axes a on a.id = r.axis_id
   where r.tenant_id = t.tenant_id and r.deleted_at is null;

  select jsonb_build_object('mine', count(*) filter (where x.target = 'children' and x.mine), 'others', count(*) filter (where x.target = 'children' and not x.mine)),
         jsonb_build_object('mine', count(*) filter (where x.target = 'links' and x.mine), 'others', count(*) filter (where x.target = 'links' and not x.mine))
    into v_children, v_links
    from app.handover_switch_targets(t.id, t.assignee_member_id) x;

  select jsonb_build_object('id', s.id, 'name', s.name, 'code', s.ticket_prefix) into v_group from scopes s where s.id = t.scope_id;

  with week as (
    select w.assignee_member_id as mid, count(*) as n from tickets w
     where w.tenant_id = t.tenant_id and w.completed_at is null and w.deleted_at is null and w.draft_import_id is null
       and w.due_on between v_monday and v_monday + 6
     group by w.assignee_member_id
  ), people as (
    select m.id, m.display_name, m.scope_id, u.email::text as email, app.handover_member_state(m.id) as state,
           coalesce(wk.n, 0) as week,
           row_number() over (order by (m.id = t.assignee_member_id) desc, (m.id = v_me) desc,
                                       (app.handover_member_state(m.id) = 'active') desc, m.display_name, m.id) as rn
      from members m
      left join tenant_memberships tm on tm.member_id = m.id and tm.tenant_id = m.tenant_id and tm.deleted_at is null
      left join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
      left join week wk on wk.mid = m.id
     where m.tenant_id = t.tenant_id and m.kind_id = 'human' and m.deleted_at is null and coalesce(tm.status, '') <> 'left'
     order by (m.id = t.assignee_member_id) desc, (m.id = v_me) desc, (app.handover_member_state(m.id) = 'active') desc, m.display_name, m.id
     limit 501
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pp.id, 'name', pp.display_name, 'email', pp.email,
           'group', case when g.id is null then null else jsonb_build_object('id', g.id, 'name', g.name, 'code', g.ticket_prefix) end,
           'manager', app.handover_manages(pp.id, pp.scope_id), 'week', pp.week, 'state', pp.state,
           'self', pp.id = v_me, 'current', pp.id = t.assignee_member_id, 'in_group', app.handover_in_group(pp.id, t.scope_id))
           order by pp.rn) filter (where pp.rn <= 500), '[]'::jsonb),
         coalesce(bool_or(pp.rn > 500), false)
    into v_cands, v_over
    from people pp left join scopes g on g.id = pp.scope_id;

  if 'distribute' = any (v_kinds) or 'distribute' = any (v_kinds_scope) then
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'code', s.ticket_prefix) order by s.name, s.id), '[]'::jsonb)
      into v_groups from scopes s where s.tenant_id = t.tenant_id and s.deleted_at is null;
  end if;

  return jsonb_build_object(
    'kinds', to_jsonb(array(select k from unnest(array['pass', 'distribute', 'offer']) k where k = any (v_kinds))),
    'blocked', app.handover_blocked(t.id, null),
    'waiting', v_waiting,
    'default_reply_due', app.handover_default_due(now()),
    'rules', v_rules, 'children', v_children, 'links', v_links, 'group', v_group,
    'candidates', v_cands, 'candidates_over', v_over, 'groups', v_groups);
end $$;

-- ---------------------------------------------------------------- 決まりを読む（会社の分・children・links・group・axis の順・軸の名前つき）
create or replace function app.handover_rules_list() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'target', r.target, 'axis_id', r.axis_id, 'axis_name', a.name, 'mode', r.mode)
           order by array_position(array['children', 'links', 'group', 'axis'], r.target), a.name, r.id), '[]'::jsonb)
    from handover_rules r left join class_axes a on a.id = r.axis_id
   where r.tenant_id = app.tenant_id() and r.deleted_at is null and app.member_ok()
$$;

-- ---------------------------------------------------------------- 送った印（渡しの知らせの行だけ・まだ印の無い行だけ）
create or replace function app.handover_mail_mark(p_sent uuid[], p_failed uuid[]) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if app.tenant_id() is null then return; end if;
  update notifications n
     set sent_at = case when n.id = any (coalesce(p_sent, '{}')) then now() else null end,
         failed_at = case when n.id = any (coalesce(p_failed, '{}')) and not n.id = any (coalesce(p_sent, '{}')) then now() else null end
   where n.tenant_id = app.tenant_id() and n.event_kind_id like 'handover.%'
     and n.id = any (coalesce(p_sent, '{}') || coalesce(p_failed, '{}'))
     and n.sent_at is null and n.failed_at is null and n.deleted_at is null;
end $$;

-- ---------------------------------------------------------------- 渡す・外す
revoke all on function app.handover_member_state(uuid) from public;
revoke all on function app.handover_manages(uuid, uuid) from public;
revoke all on function app.handover_in_group(uuid, uuid) from public;
revoke all on function app.handover_kinds(uuid, uuid, boolean) from public;
revoke all on function app.handover_blocked(uuid, uuid) from public;
revoke all on function app.handover_answerer(uuid, uuid, boolean) from public;
revoke all on function app.handover_default_due(timestamptz) from public;
revoke all on function app.handover_switch_targets(uuid, uuid) from public;
revoke all on function app.handover_switch_normalize(uuid, uuid, jsonb) from public;
revoke all on function app.handover_apply_switch(uuid, uuid, uuid) from public;
revoke all on function app.handover_gate(uuid, jsonb, boolean) from public;
revoke all on function app.handover_answer_gate(uuid, boolean) from public;
revoke all on function app.handover_json(uuid) from public;
revoke all on function app.handover_preview(uuid) from public;
revoke all on function app.handover_rules_list() from public;
revoke all on function app.handover_mail_mark(uuid[], uuid[]) from public;
grant execute on function app.handover_answerer(uuid, uuid, boolean), app.handover_gate(uuid, jsonb, boolean),
  app.handover_answer_gate(uuid, boolean), app.handover_preview(uuid), app.handover_rules_list(),
  app.handover_mail_mark(uuid[], uuid[]) to kaname_app;
