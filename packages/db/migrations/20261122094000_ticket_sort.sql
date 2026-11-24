-- 20261122094000 人がチケットの優先度・親を変える（K-440・関門 C2・C6・D-125.32・D-125.33・D-125.51・D-125.130・D-128.45・D-128.65・D-150.16・D-150.20・D-150.32）
--   列は足さない（priority・priority_reason・parent_ticket_id は 0071 に在る）。足す関数は 2 つ：
--     ① app.ticket_sort_set：人が優先度（高は理由つき）と親を変える（1 つの処理）。口 updateTicket の組 ticketSort が呼ぶ（K-387 の表に 1 組足す）
--     ② app.ticket_sort_row：口の答えのチケットの形（中だけで使う・誰にも execute を渡さない）
--   期限の組は段 8 の K-483 が持つ（この関数は期限を書かない。親を決めるとき、今の自分の期限が親の期限より後でないかを見るだけ）。
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し、口が呼ぶ関数だけを kaname_app に渡す。
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形にする

-- ---------------------------------------------------------------- 口の答えのチケットの形（p に鍵があった欄の列だけ・id・number・updated_at は常に）
create or replace function app.ticket_sort_row(t tickets, p jsonb) returns jsonb
language sql stable set search_path = public, app, pg_temp as $$
  select jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at)
         || case when p ? 'priority' or p ? 'priority_reason'
                 then jsonb_build_object('priority', t.priority, 'priority_reason', t.priority_reason) else '{}'::jsonb end
         || case when p ? 'parent_ticket_id' then jsonb_build_object('parent_ticket_id', t.parent_ticket_id) else '{}'::jsonb end
$$;
revoke all on function app.ticket_sort_row(tickets, jsonb) from public;

-- ---------------------------------------------------------------- ① 人が優先度・親を変える（1 つの処理）
--   p の鍵：priority（mid か high）・priority_reason（高のときの理由）・parent_ticket_id（uuid か null＝外す）。無い鍵は変えない。
--   見る順：今のメンバーか → チケット（無い・消した・見えない）→ 書けるか（ここまでの判定の例外は guard_failed）
--           → 優先度（bad_priority・reason_required）→ 親（parent_not_found・parent_self・parent_below・parent_depth・parent_due）
--   同じ値（同じ優先度と理由・同じ親）は何も書かず changed false（行も更新時刻も知らせも変えない）。
--   変えたら：優先度・親の列 → やり取りの変更の 1 行（1 つ・優先度・親の順を「・」でつなぐ）→ 担当者の受け箱の行（担当者でない人が変えたときだけ）→ 証跡
create or replace function app.ticket_sort_set(p_ticket uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; par tickets%rowtype;
        v_p jsonb := coalesce(p, '{}'::jsonb); v_err text;
        v_set_prio boolean; v_set_reason boolean; v_set_parent boolean;
        v_new_prio text; v_new_reason text; v_prio_changed boolean := false; v_reason_changed boolean := false;
        v_new_parent uuid; v_parent_raw text; v_parent_changed boolean := false; v_old_num text; v_new_num text;
        v_d integer; v_cur uuid; v_steps integer; v_below integer;
        v_changes jsonb := '[]'::jsonb; v_fields text[] := '{}'; v_parts text[] := '{}';
        v_body text; v_msg uuid; v_notify uuid;
        c_ctrl constant text := E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]';   -- 制御文字（タブ・改行・復帰は残す）
        c_space constant text := E' \t\n\x0B\f\r                 　﻿';   -- 空かどうかを見るときに前後から落とす空白（入口の JavaScript の \s と同じ字・契約の pattern と合わせる）
        c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
        c_depth_max constant integer := 3;       -- 親子は 3 段まで（D-125.51）
        c_walk_max constant integer := 20;       -- 親を辿る回数の上限（輪は引き金が許さないが、念のため止める）
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 守りの判定（今のメンバーか）の所で例外になったら、外に投げずに guard_failed を返して何も書かない（fail-closed・D-136.1）
  begin
    if not app.approval_member_now() then v_err := 'not_member'; end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  v_set_prio := v_p ? 'priority';
  v_set_reason := v_p ? 'priority_reason';
  v_set_parent := v_p ? 'parent_ticket_id';
  -- 親を決める同時の要求は会社ごとに 1 本ずつにする（A の親を B・B の親を A に同時に決めても輪にならない）。
  --   行の錠より先に取る（親の行を読む・外部キーの確かめと錠を取り合って行き詰まらないため）
  if v_set_parent then
    perform pg_advisory_xact_lock(hashtextextended('ticket_sort_parent:' || v_tenant::text, 0));
  end if;
  -- 同じチケットの同時の 2 本は 1 本ずつにする（チケットの行で待ち合わせる。後の 1 本は前の 1 本が書いた後の行を見る）。
  --   外部キーの確かめ（key share）と錠を取り合わない no key update にする
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for no key update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.ticket_visible(t.id) then v_err := 'not_found';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;

  -- 優先度：mid か high。高は理由が要る（制御文字を除き、前後の空白（全角も）を落として空なら無い）。中にすると理由の列は空にする（D-125.33）。
  --   字数の上限は置かない・切らない（D-130.1）
  if v_set_prio and (jsonb_typeof(v_p -> 'priority') <> 'string' or (v_p ->> 'priority') not in ('mid', 'high')) then
    return jsonb_build_object('error', 'bad_priority', 'field', 'priority');
  end if;
  v_new_prio := case when v_set_prio then v_p ->> 'priority' else t.priority end;
  v_new_reason := t.priority_reason;
  if v_set_prio or v_set_reason then
    if v_new_prio = 'high' then
      v_new_reason := case
        when v_set_reason then nullif(btrim(regexp_replace(case when jsonb_typeof(v_p -> 'priority_reason') = 'string' then v_p ->> 'priority_reason' end, c_ctrl, '', 'g'), c_space), '')
        when t.priority = 'high' then t.priority_reason
        else null end;
      if v_new_reason is null then return jsonb_build_object('error', 'reason_required', 'field', 'priority_reason'); end if;
    else
      v_new_reason := null;
    end if;
    v_prio_changed := v_new_prio <> t.priority;
    v_reason_changed := v_new_reason is distinct from t.priority_reason;
  end if;

  -- 親：同じ会社の・消していない・自分に見えるチケット（書けなくてもよい）。外す（null）こともできる。
  --   今の親と同じなら何も確かめず変えない。変わるときだけ：自分・自分の子孫（輪）・3 段を超える・自分の期限が親の期限より後（どちらも空でないとき）を断る
  if v_set_parent then
    if jsonb_typeof(v_p -> 'parent_ticket_id') = 'null' then
      v_new_parent := null;
    else
      v_parent_raw := case when jsonb_typeof(v_p -> 'parent_ticket_id') = 'string' then v_p ->> 'parent_ticket_id' end;
      if coalesce(v_parent_raw, '') !~ c_uuid then return jsonb_build_object('error', 'parent_not_found'); end if;
      v_new_parent := v_parent_raw::uuid;
    end if;
    v_parent_changed := v_new_parent is distinct from t.parent_ticket_id;
    if v_parent_changed and v_new_parent is not null then
      if v_new_parent = t.id then return jsonb_build_object('error', 'parent_self'); end if;
      select * into par from tickets where id = v_new_parent and tenant_id = v_tenant and deleted_at is null;
      if par.id is null then return jsonb_build_object('error', 'parent_not_found'); end if;
      begin
        if not app.ticket_visible(par.id) then v_err := 'parent_not_found'; end if;
      exception when others then
        return jsonb_build_object('error', 'guard_failed');
      end;
      if v_err is not null then return jsonb_build_object('error', v_err); end if;
      -- 親から親を辿る。自分に着いたら自分の子孫（輪）。数えた段（自分を 1 として）と自分の下の段で 3 段を超えたら断る
      v_d := 1; v_cur := par.id; v_steps := 0;
      while v_cur is not null and v_steps < c_walk_max loop
        if v_cur = t.id then return jsonb_build_object('error', 'parent_below'); end if;
        v_d := v_d + 1;
        v_steps := v_steps + 1;
        select tp.parent_ticket_id into v_cur from tickets tp where tp.id = v_cur and tp.tenant_id = v_tenant;
      end loop;
      with recursive down as (
        select c.id, 1 as lv from tickets c where c.parent_ticket_id = t.id and c.tenant_id = v_tenant
        union all
        select c.id, down.lv + 1 from tickets c join down on c.parent_ticket_id = down.id where down.lv < 5
      )
      select coalesce(max(lv), 0) into v_below from down;
      if v_d + v_below > c_depth_max then return jsonb_build_object('error', 'parent_depth'); end if;
      if t.due_on is not null and par.due_on is not null and t.due_on > par.due_on then
        return jsonb_build_object('error', 'parent_due');
      end if;
    end if;
  end if;

  -- 何も変わらない（同じ値・二度押し）：1 行も知らせも証跡も書かない
  if not (v_prio_changed or v_reason_changed or v_parent_changed) then
    return jsonb_build_object('ticket', app.ticket_sort_row(t, v_p), 'changed', false, 'message_id', null);
  end if;

  -- 変えた物（並びは優先度・親）と、変更の 1 行の文
  if v_prio_changed or v_reason_changed then
    v_fields := array_append(v_fields, 'priority');
    v_changes := v_changes || case
      when v_new_prio = 'high' then jsonb_build_object('field', 'priority', 'from', case t.priority when 'high' then '高' else '中' end, 'to', '高', 'note', v_new_reason)
      else jsonb_build_object('field', 'priority', 'from', case t.priority when 'high' then '高' else '中' end, 'to', '中') end;
    v_parts := v_parts || case
      when v_prio_changed and v_new_prio = 'high' then ('優先度を 中 → 高 に変えた（理由：' || v_new_reason || '）')
      when v_prio_changed then '優先度を 高 → 中 に変えた'
      else ('優先度の理由を直した（理由：' || v_new_reason || '）') end;
  end if;
  if v_parent_changed then
    select tp.number into v_old_num from tickets tp where tp.id = t.parent_ticket_id and tp.tenant_id = v_tenant;
    v_new_num := par.number;
    v_fields := array_append(v_fields, 'parent');
    v_changes := v_changes || jsonb_build_object('field', 'parent', 'from', v_old_num, 'to', v_new_num);
    v_parts := v_parts || case
      when v_new_parent is null then ('親を外した（' || coalesce(v_old_num, '') || '）')
      when v_old_num is null then ('親を ' || v_new_num || ' に決めた')
      else ('親を ' || v_old_num || ' → ' || v_new_num || ' に変えた') end;
  end if;
  v_body := app.member_name(v_me) || ' が' || array_to_string(v_parts, '・');

  -- 書く（1 つの処理）：優先度・理由の列と親の列を別の更新にする（親の列を含めない更新で、3 段と輪の引き金を動かさない）
  if v_prio_changed or v_reason_changed then
    update tickets set priority = v_new_prio, priority_reason = v_new_reason, updated_by = v_me where id = t.id returning * into t;
  end if;
  if v_parent_changed then
    update tickets set parent_ticket_id = v_new_parent, updated_by = v_me where id = t.id returning * into t;
  end if;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (t.tenant_id, t.id, v_me, 'change', v_body, v_changes, v_me)
  returning id into v_msg;
  -- 担当者でない人が変えたときだけ、担当者（今のメンバー：抜けた・止められた人は除く）の受け箱に知らせる（画面の中だけ・メールは出さない・D-125.130・D-150.32）。
  --   本文はチケットの id・番号・リンク・変更の 1 行の id・変えた欄の名前だけ（題名・理由の字は入れない）。1 回の要求が何を変えても行は 1 つ（同じ取引で既に在る行には欄を足す）
  if t.assignee_member_id is not null and t.assignee_member_id <> v_me and app.ticket_member_ok(t.tenant_id, t.assignee_member_id) then
    v_notify := t.assignee_member_id;
    -- 1 回の要求は 1 人に 1 通（代表の答え ⑮7）：同じ取引で、この人・このチケットの受け箱の行が既に在れば（段の組が先に書いた行など）、
    --   新しく書かず、その行の fields に変えた欄の名前を足す。無ければ新しく書く
    update notifications n
       set payload = n.payload || jsonb_build_object('fields', coalesce(n.payload -> 'fields', '[]'::jsonb) || to_jsonb(v_fields))
     where n.tenant_id = t.tenant_id and n.member_id = v_notify and n.channel_id = 'inapp'
       and n.event_kind_id in ('ticket.stage_changed', 'ticket.sort_changed')
       and n.payload ->> 'ticket_id' = t.id::text
       and n.xmin = pg_current_xact_id()::xid;
    if not found then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
        values (t.tenant_id, v_notify, 'inapp', 'ticket.sort_changed',
                jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text, 'message_id', v_msg,
                                   'fields', to_jsonb(v_fields)),
                'ticket.sort_changed:' || v_msg::text, now(), v_me);
    end if;
  end if;
  -- 証跡（関門 C2）。中身は変えた欄の名前だけ（理由の字を残さない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.sort', 'tickets', t.id::text, 'C2',
            jsonb_build_object('fields', to_jsonb(v_fields)), v_me);
  return jsonb_build_object('ticket', app.ticket_sort_row(t, v_p), 'changed', true, 'message_id', v_msg);
end $$;
revoke all on function app.ticket_sort_set(uuid, jsonb) from public;
grant execute on function app.ticket_sort_set(uuid, jsonb) to kaname_app;
