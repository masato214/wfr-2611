-- 20261122100400 チケットの「会社の項目の値」を書く（K-564・関門 C2・C6・D-128.45・D-130.1・D-150.1・D-150.32・D-150.36・D-150.37・D-150.40・D-150.50・D-150.51）
--   列と表は足さない（custom_fields・custom_field_kinds・ticket_field_values は K-563 の 20261122090300）。足す関数は 3 つ：
--     ① app.custom_field_normalize：1 項目の値を型ごとに確かめて正規化する（種別・必須は見ない）。K-437 も項目ごとに確かめたいときに使う
--     ② app.custom_field_show：やり取りの 1 行に出す値の見せ方（中だけで使う・誰にも execute を渡さない）
--     ③ app.ticket_fields_set：値を書く。直すとき（p_create = false）は口 updateTicket の組 ticketFields が、作るとき（p_create = true）は作る口 K-437 が同じ取引で呼ぶ
--   どの関数も呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し、口が呼ぶ関数だけを kaname_app に渡す。
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形にする

-- ---------------------------------------------------------------- ① 1 項目の値の確かめと正規化
--   答え：{ok:true, value:<正規化した値・空は null>} か {error: field_not_found | bad_type | bad_option}。
--   空（null・空の文字・空白だけ・空の並び）は型に関わらず「空」。必須・種別はここでは見ない
create or replace function app.custom_field_normalize(p_field uuid, p_value jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare f custom_fields%rowtype; v_t text; v_s text; v_d date; v_arr jsonb := '[]'::jsonb; v_seen text[] := '{}'; e jsonb;
        c_space constant text := E' \t\n\x0B\f\r                 　﻿';   -- 空かどうかを見るときに前後から落とす空白（入口の JavaScript の \s と同じ字・契約の pattern と合わせる）
begin
  select * into f from custom_fields where id = p_field and tenant_id = app.tenant_id() and deleted_at is null;
  if f.id is null then return jsonb_build_object('error', 'field_not_found'); end if;
  v_t := jsonb_typeof(p_value);
  if p_value is null or v_t = 'null'
     or (v_t = 'string' and btrim(p_value #>> '{}', c_space) = '')
     or (v_t = 'array' and jsonb_array_length(p_value) = 0) then
    return jsonb_build_object('ok', true, 'value', null::jsonb);
  end if;
  if f.field_type in ('short_text', 'long_text') then
    if v_t <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', to_jsonb(btrim(p_value #>> '{}', c_space)));
  elsif f.field_type = 'number' then
    if v_t <> 'number' then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'date' then
    if v_t <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
    v_s := p_value #>> '{}';
    if v_s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('error', 'bad_type'); end if;
    begin
      v_d := v_s::date;
    exception when others then
      return jsonb_build_object('error', 'bad_type');
    end;
    if to_char(v_d, 'YYYY-MM-DD') <> v_s then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'select' then
    if v_t <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
    v_s := p_value #>> '{}';
    if not exists (select 1 from jsonb_array_elements(f.options) o where o ->> 'id' = v_s) then
      return jsonb_build_object('error', 'bad_option');
    end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'multi_select' then
    if v_t <> 'array' then return jsonb_build_object('error', 'bad_type'); end if;
    for e in select x.value from jsonb_array_elements(p_value) with ordinality as x(value, n) order by x.n loop
      if jsonb_typeof(e) <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
      v_s := e #>> '{}';
      if not exists (select 1 from jsonb_array_elements(f.options) o where o ->> 'id' = v_s) then
        return jsonb_build_object('error', 'bad_option');
      end if;
      if not (v_s = any (v_seen)) then
        v_seen := array_append(v_seen, v_s);
        v_arr := v_arr || to_jsonb(v_s);
      end if;
    end loop;
    return jsonb_build_object('ok', true, 'value', v_arr);
  elsif f.field_type = 'check' then
    if v_t <> 'boolean' then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  end if;
  return jsonb_build_object('error', 'bad_type');
end $$;
revoke all on function app.custom_field_normalize(uuid, jsonb) from public;
grant execute on function app.custom_field_normalize(uuid, jsonb) to kaname_app;

-- ---------------------------------------------------------------- ② やり取りの 1 行に出す値の見せ方（空は null）
--   文字・数・日付はそのまま／選ぶ型は選択肢の名前（複数は「、」でつなぐ・名前が無ければ id）／チェックは「チェックあり」「チェックなし」
create or replace function app.custom_field_show(p_type text, p_options jsonb, v jsonb) returns text
language sql stable set search_path = public, app, pg_temp as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then null
    when p_type = 'check' then case when v = 'true'::jsonb then 'チェックあり' else 'チェックなし' end
    when p_type = 'select' then coalesce((select o ->> 'name' from jsonb_array_elements(p_options) o where o ->> 'id' = v #>> '{}' limit 1), v #>> '{}')
    when p_type = 'multi_select' then
      (select string_agg(coalesce((select o ->> 'name' from jsonb_array_elements(p_options) o where o ->> 'id' = x.id limit 1), x.id), '、' order by x.n)
         from jsonb_array_elements_text(v) with ordinality as x(id, n))
    else v #>> '{}'
  end
$$;
revoke all on function app.custom_field_show(text, jsonb, jsonb) from public;

-- ---------------------------------------------------------------- ③ 会社の項目の値を書く（1 つの処理）
--   p は fields の中身 { "<項目の id>": 値 }。送った項目だけ確かめる。
--   見る順：今のメンバーか → チケット（無い・消した・見えない）→ 書けるか（ここまでの判定の例外は guard_failed）
--           → 鍵を昇順に 1 つずつ：項目（field_not_found）→ 種別（not_in_kind）→ 型と選択肢（bad_type・bad_option）→ 必須（required_empty）
--   直すとき（p_create = false）：チケットの行を for no key update で錠 → 同じチケットへの同時の書き込みは 1 本ずつ通り、値の行が 2 つにならない。
--     同じ値は何も書かず changed false。変えたら：値の行 → チケットの更新者と更新時刻 → やり取りの変更の 1 行（1 つ）→ 担当者の受け箱の行（担当者でない人が変えたときだけ）→ 証跡
--   作るとき（p_create = true・K-437 がチケットの行を入れた同じ取引で呼ぶ）：錠と「書けるか」は呼ぶ側に任せ、今のメンバーかとチケットが同じ会社かだけ見る。
--     そのチケットの種別に出る必須の項目が全部、空でない値で入っていなければ required_empty。値の行だけを書き、やり取り・知らせ・証跡・チケットの更新時刻は書かない
create or replace function app.ticket_fields_set(p_ticket uuid, p jsonb, p_create boolean default false) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; f custom_fields%rowtype;
        v_p jsonb := coalesce(p, '{}'::jsonb); v_err text; k text; n jsonb; nv jsonb; cur jsonb; v_empty boolean;
        v_plan jsonb := '[]'::jsonb; v_out jsonb := '{}'::jsonb; x jsonb; v_changed boolean := false;
        v_changes jsonb := '[]'::jsonb; v_parts text[] := '{}'; v_ids text[] := '{}';
        v_from text; v_to text; v_body text; v_msg uuid; v_notify uuid;
        c_space constant text := E' \t\n\x0B\f\r                 　﻿';   -- 空かどうかを見るときに前後から落とす空白（入口の JavaScript の \s と同じ字・契約の pattern と合わせる）
        c_uuid constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  if jsonb_typeof(v_p) <> 'object' then return jsonb_build_object('error', 'field_not_found'); end if;
  -- 守りの判定（今のメンバーか）の所で例外になったら、外に投げずに guard_failed を返して何も書かない（fail-closed・D-136.1）
  begin
    if not app.approval_member_now() then v_err := 'not_member'; end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if p_create then
    select * into t from tickets where id = p_ticket and tenant_id = v_tenant;
    if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  else
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
  end if;

  -- 送った項目を鍵の昇順に 1 つずつ確かめる（書くのは全部通ってから）
  for k in select kk from jsonb_object_keys(v_p) kk order by lower(kk), kk loop
    if lower(k) !~ c_uuid then return jsonb_build_object('error', 'field_not_found'); end if;
    select * into f from custom_fields where id = lower(k)::uuid and tenant_id = v_tenant and deleted_at is null;
    if f.id is null then return jsonb_build_object('error', 'field_not_found'); end if;
    -- 種別の行が 1 つでもある項目（消した行も数える）は、そのチケットの種別の生きた行が要る。行が 1 つも無い項目は全部の種別に出る
    if exists (select 1 from custom_field_kinds where field_id = f.id and tenant_id = v_tenant)
       and not exists (select 1 from custom_field_kinds where field_id = f.id and tenant_id = v_tenant and kind_id = t.kind_id and deleted_at is null) then
      return jsonb_build_object('error', 'not_in_kind');
    end if;
    n := app.custom_field_normalize(f.id, v_p -> k);
    if n ? 'error' then return jsonb_build_object('error', n ->> 'error'); end if;
    nv := nullif(n -> 'value', 'null'::jsonb);
    -- 必須の項目は空にできない（必須のチェックは、チェックが付いていない＝false・null も空と同じ）
    v_empty := nv is null or (f.field_type = 'check' and nv = 'false'::jsonb);
    if f.required and v_empty then return jsonb_build_object('error', 'required_empty'); end if;
    select value into cur from ticket_field_values where ticket_id = t.id and field_id = f.id and deleted_at is null;
    v_plan := v_plan || jsonb_build_object('id', f.id, 'nv', nv, 'cur', cur, 'changed', cur is distinct from nv);
    v_out := v_out || jsonb_build_object(f.id::text, nv);
  end loop;

  -- 作るとき：そのチケットの種別に出る必須の項目が、全部入っているか（送らなかった必須も断る）
  if p_create then
    for f in
      select cf.* from custom_fields cf
       where cf.tenant_id = v_tenant and cf.deleted_at is null and cf.required
         and (not exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.tenant_id = v_tenant)
              or exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.tenant_id = v_tenant and ck.kind_id = t.kind_id and ck.deleted_at is null))
    loop
      if not (v_out ? f.id::text) then return jsonb_build_object('error', 'required_empty'); end if;
    end loop;
  end if;

  -- 変わる物（鍵の昇順）
  for x in select e.value from jsonb_array_elements(v_plan) with ordinality as e(value, n) order by e.n loop
    if (x ->> 'changed')::boolean then v_changed := true; end if;
  end loop;

  if not v_changed then
    return jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at),
                              'changed', false, 'message_id', null, 'fields', v_out, 'changes', '[]'::jsonb);
  end if;

  -- 書く（1 つの処理）：値の行 → （直すときだけ）チケットの更新者と更新時刻・やり取りの 1 行・知らせ・証跡
  for x in select e.value from jsonb_array_elements(v_plan) with ordinality as e(value, n) order by e.n loop
    continue when not (x ->> 'changed')::boolean;
    select * into f from custom_fields where id = (x ->> 'id')::uuid;
    nv := nullif(x -> 'nv', 'null'::jsonb);
    cur := nullif(x -> 'cur', 'null'::jsonb);
    if nv is null then
      update ticket_field_values set deleted_at = now(), updated_by = v_me
       where ticket_id = t.id and field_id = f.id and deleted_at is null;
    elsif cur is not null then
      update ticket_field_values set value = nv, updated_by = v_me
       where ticket_id = t.id and field_id = f.id and deleted_at is null;
    else
      insert into ticket_field_values (tenant_id, ticket_id, field_id, value, created_by, updated_by)
        values (t.tenant_id, t.id, f.id, nv, v_me, v_me);
    end if;
    v_ids := array_append(v_ids, f.id::text);
    v_from := app.custom_field_show(f.field_type, f.options, cur);
    v_to := app.custom_field_show(f.field_type, f.options, nv);
    v_changes := v_changes || jsonb_build_object('field', 'field:' || f.id::text, 'from', v_from, 'to', v_to, 'raw_from', cur, 'raw_to', nv);
    -- 本文の値は 40 字で切る（超えたら「…」）。changes は全文
    v_parts := array_append(v_parts, f.name || 'を'
      || coalesce(case when char_length(v_from) > 40 then left(v_from, 40) || '…' else v_from end, '（空）')
      || ' → '
      || coalesce(case when char_length(v_to) > 40 then left(v_to, 40) || '…' else v_to end, '（空）')
      || 'に');
  end loop;

  if p_create then
    return jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at),
                              'changed', true, 'message_id', null, 'fields', v_out, 'changes', v_changes);
  end if;

  update tickets set updated_by = v_me where id = t.id returning * into t;
  v_body := app.member_name(v_me) || 'が' || array_to_string(v_parts, '、') || '変えました';
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (t.tenant_id, t.id, v_me, 'change', v_body, v_changes, v_me)
  returning id into v_msg;
  -- 担当者でない人が変えたときだけ、担当者（今のメンバー：抜けた・止められた人は除く）の受け箱に知らせる（画面の中だけ・メールは出さない・D-150.32）。
  --   本文はチケットの id・番号・リンク・変更の 1 行の id・変えた項目の印だけ（題名・値の字は入れない）。1 回の要求が何を変えても行は 1 つ
  if t.assignee_member_id is not null and t.assignee_member_id <> v_me and app.ticket_member_ok(t.tenant_id, t.assignee_member_id) then
    v_notify := t.assignee_member_id;
    -- 1 回の要求は 1 人に 1 通（代表の答え ⑮7・PM の決め 2026-11-23）：同じ取引で、この人・このチケットの受け箱の行が既に在れば
    --   （段・優先度・親の組が先に書いた行）、新しく書かず、その行の fields に変えた項目の印を足す。無ければ新しく書く
    update notifications n
       set payload = n.payload || jsonb_build_object('fields', coalesce(n.payload -> 'fields', '[]'::jsonb)
                       || (select to_jsonb(array_agg('field:' || i order by i)) from unnest(v_ids) i))
     where n.id = (select n2.id from notifications n2
                    where n2.tenant_id = t.tenant_id and n2.member_id = v_notify and n2.channel_id = 'inapp'
                      and n2.event_kind_id in ('ticket.stage_changed', 'ticket.sort_changed')
                      and n2.payload ->> 'ticket_id' = t.id::text
                      and n2.xmin = pg_current_xact_id()::xid
                    order by n2.created_at desc, n2.id desc limit 1);   -- 1 行だけに足す（先の組の insert は exception ブロックの外なので xmin は取引の id と一致する・段 20261120130400 の 192 行・優先度 20261122094000 の insert）
    if not found then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
        values (t.tenant_id, v_notify, 'inapp', 'ticket.sort_changed',
                jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text, 'message_id', v_msg,
                                   'fields', (select to_jsonb(array_agg('field:' || i order by i)) from unnest(v_ids) i)),
                'ticket.sort_changed:' || v_msg::text, now(), v_me);
    end if;
  end if;
  -- 証跡（関門 C2）。中身は変えた項目の id だけ（値の字を残さない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.field_values', 'tickets', t.id::text, 'C2',
            jsonb_build_object('fields', (select to_jsonb(array_agg(i order by i)) from unnest(v_ids) i)), v_me);
  return jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at),
                            'changed', true, 'message_id', v_msg, 'fields', v_out);
end $$;
revoke all on function app.ticket_fields_set(uuid, jsonb, boolean) from public;
grant execute on function app.ticket_fields_set(uuid, jsonb, boolean) to kaname_app;
