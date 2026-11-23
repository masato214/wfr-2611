-- 20261122093500 確認項目にチェックを付ける・外す・文を直す・行を外す（K-435・契約の口 updateTestSpec・deleteTestSpec・D-150.39・D-150.40・D-150.55・D-150.56・D-128.45・D-130.1・関門 C2・C3）
--   列は足さない。app.test_spec_log（K-434・5 引数の最終の形）は、AI の名前の書き方（「AI が…」・AI の後に空白）だけを直して同じ形で作り直す。呼んだ人は app.user_id() で引き、引数で人を受けない。
--   security definer・search_path に pg_temp・public から外し kaname_app だけに渡す。チケットの行は for share・確認項目の行は for update の順
--   （完了の確定 app.ticket_complete の for update と順番になる。K-434 の足すと同じ）。
-- ① app.test_spec_update(p_id, p)：付ける・外す（checked）か文を直す（title）のどちらか 1 つと版（version）。何かが変わったときだけ版 +1
-- ② app.test_spec_delete(p_id)：論理削除（deleted_at）。版は見ない・変えない。外す前の姿を返す
-- ③ app.test_spec_check_by_ai(p_spec, p_checked)：機械・AI がチェックを付ける・外す。口は作らない（呼ぶのは検査を流す段・段 6）。会社の文脈だけで動く

-- ① 付ける・外す・直す。答えは { ok: true, row, unchanged? } か { error: invalid（field・message）| not_found | forbidden | done | version | checked_title | locked_source }
create or replace function app.test_spec_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_ws constant text := E' \t\r\n\f\v　';
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_bad text;
  v_stage text;
  v_keys int;
  v_ticket uuid;
  v_ver jsonb;
  v_new_checked boolean;
  v_new_title text;
  v_change text;
  t tickets%rowtype;
  s test_specs%rowtype;
begin
  -- 入力の外れを最初に断る（何も読まない・何も書かない。チケットの状態に関わらず）
  if jsonb_typeof(p) is distinct from 'object' then
    return jsonb_build_object('error', 'invalid', 'field', 'version', 'message', '版を入れてください');
  end if;
  v_ver := p -> 'version';
  -- 版は 1 以上の整数（数でない・小数・0・負は断る。文字の形を先に見てから数にする）
  if jsonb_typeof(v_ver) is distinct from 'number' then
    return jsonb_build_object('error', 'invalid', 'field', 'version', 'message', '版は 1 以上の整数を入れてください');
  end if;
  if (p ->> 'version') !~ '^[0-9]+$' then
    return jsonb_build_object('error', 'invalid', 'field', 'version', 'message', '版は 1 以上の整数を入れてください');
  end if;
  if (p ->> 'version')::numeric < 1 then
    return jsonb_build_object('error', 'invalid', 'field', 'version', 'message', '版は 1 以上の整数を入れてください');
  end if;
  v_keys := (case when p ? 'checked' then 1 else 0 end) + (case when p ? 'title' then 1 else 0 end);
  if v_keys <> 1 then
    return jsonb_build_object('error', 'invalid', 'field', case when p ? 'checked' then 'checked' else 'title' end,
                              'message', 'チェックか題名のどちらか 1 つを入れてください');
  end if;
  if p ? 'checked' then
    if jsonb_typeof(p -> 'checked') is distinct from 'boolean' then
      return jsonb_build_object('error', 'invalid', 'field', 'checked', 'message', 'チェックは真偽で入れてください');
    end if;
    v_new_checked := (p -> 'checked')::boolean;
    v_change := 'checked';
  else
    v_bad := app.test_spec_title_check(p -> 'title');
    if v_bad is not null then
      return jsonb_build_object('error', 'invalid', 'field', 'title', 'message', v_bad);
    end if;
    v_new_title := btrim(p ->> 'title', v_ws);
    v_change := 'title';
  end if;
  if v_me is null or v_tenant is null or not app.member_ok() then return jsonb_build_object('error', 'not_found'); end if;
  -- チケットを共有で・行を排他で持つ（行が無いときはチケットを引けないので、まず行の持ち主のチケットを引く）
  select ts.ticket_id into v_ticket from test_specs ts where ts.id = p_id and ts.tenant_id = v_tenant;
  if v_ticket is null then return jsonb_build_object('error', 'not_found'); end if;
  select * into t from tickets where id = v_ticket and tenant_id = v_tenant for share;
  if t.id is null or t.deleted_at is not null or not app.ticket_visible(t.id) then return jsonb_build_object('error', 'not_found'); end if;
  select * into s from test_specs where id = p_id and tenant_id = v_tenant for update;
  if s.id is null or s.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  if not app.ticket_writable(t.id) then return jsonb_build_object('error', 'forbidden'); end if;
  select st.key into v_stage from ticket_stages st where st.id = t.stage_id;
  if t.completed_at is not null or v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  if (p ->> 'version')::numeric <> s.version then return jsonb_build_object('error', 'version'); end if;

  if v_change = 'checked' then
    if (s.checked_at is not null) = v_new_checked then
      return jsonb_build_object('ok', true, 'row', app.test_spec_item(s.id), 'unchanged', true);
    end if;
    if v_new_checked then
      update test_specs set checked_at = now(), checked_by_member_id = v_me, checked_by_ai = false,
             version = version + 1, updated_by = v_me where id = s.id;
    else
      update test_specs set checked_at = null, checked_by_member_id = null, checked_by_ai = false,
             version = version + 1, updated_by = v_me where id = s.id;
    end if;
    perform app.test_spec_log(t.id, case when v_new_checked then 'checked' else 'unchecked' end, s.title);
  else
    -- ナレッジから入った行は人が文を直せない（版の確かめの後・同じ文かの確かめの前）
    if s.source = 'knowledge' then return jsonb_build_object('error', 'locked_source'); end if;
    if v_new_title = s.title then
      return jsonb_build_object('ok', true, 'row', app.test_spec_item(s.id), 'unchanged', true);
    end if;
    if s.checked_at is not null then return jsonb_build_object('error', 'checked_title'); end if;
    update test_specs set title = v_new_title, version = version + 1, updated_by = v_me where id = s.id;
    perform app.test_spec_log(t.id, 'edited', v_new_title, false, s.title);
  end if;
  perform app.record_audit('test_spec.update', 'test_specs', s.id::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'changed', jsonb_build_array(v_change)));
  return jsonb_build_object('ok', true, 'row', app.test_spec_item(s.id));
end $$;
revoke all on function app.test_spec_update(uuid, jsonb) from public;
grant execute on function app.test_spec_update(uuid, jsonb) to kaname_app;

-- ② 行を外す（論理削除）。版は見ない・変えない。答えの row は外す前の姿（position は外す前の番号）
create or replace function app.test_spec_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_stage text;
  v_ticket uuid;
  v_before jsonb;
  t tickets%rowtype;
  s test_specs%rowtype;
begin
  if v_me is null or v_tenant is null or not app.member_ok() then return jsonb_build_object('error', 'not_found'); end if;
  select ts.ticket_id into v_ticket from test_specs ts where ts.id = p_id and ts.tenant_id = v_tenant;
  if v_ticket is null then return jsonb_build_object('error', 'not_found'); end if;
  select * into t from tickets where id = v_ticket and tenant_id = v_tenant for share;
  if t.id is null or t.deleted_at is not null or not app.ticket_visible(t.id) then return jsonb_build_object('error', 'not_found'); end if;
  select * into s from test_specs where id = p_id and tenant_id = v_tenant for update;
  if s.id is null or s.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  if not app.ticket_writable(t.id) then return jsonb_build_object('error', 'forbidden'); end if;
  select st.key into v_stage from ticket_stages st where st.id = t.stage_id;
  if t.completed_at is not null or v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  -- ナレッジから入った行は人が外せない（機械・AI が外す道はこの関数ではない）
  if s.source = 'knowledge' then return jsonb_build_object('error', 'locked_source'); end if;
  v_before := app.test_spec_item(s.id);
  update test_specs set deleted_at = now(), updated_by = v_me where id = s.id;
  perform app.test_spec_log(t.id, 'removed', s.title);
  perform app.record_audit('test_spec.delete', 'test_specs', s.id::text, 'C2', jsonb_build_object('ticket_id', t.id));
  return jsonb_build_object('ok', true, 'row', v_before);
end $$;
revoke all on function app.test_spec_delete(uuid) from public;
grant execute on function app.test_spec_delete(uuid) to kaname_app;

-- ②b やり取りの 1 行の名前：AI のときは「AI が…」（AI の後に空白を 1 つ。K-434 の関数に同じ形で作り直す・人の名前の書き方は変えない）
create or replace function app.test_spec_log(p_ticket uuid, p_action text, p_title text, p_by_ai boolean default false, p_from text default null) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_name text;
  v_body text;
  v_from jsonb;
  v_to jsonb;
  v_tenant uuid;
  v_id uuid;
begin
  if p_action is null or p_action not in ('added', 'checked', 'unchecked', 'edited', 'removed') then
    raise exception 'test_spec_log: 知らない動き' using errcode = '22023';
  end if;
  select t.tenant_id into v_tenant from tickets t where t.id = p_ticket and t.tenant_id = app.tenant_id();
  if v_tenant is null then raise exception 'test_spec_log: チケットが無い' using errcode = '22023'; end if;
  v_name := case when coalesce(p_by_ai, false) then 'AI ' else app.member_name(v_me) end;   -- AI は「AI が…」（AI の後に空白・K435-DB-001・002）
  if p_action = 'added' then
    v_body := v_name || 'が確認項目を足しました：' || p_title; v_from := 'null'::jsonb; v_to := to_jsonb(p_title);
  elsif p_action = 'checked' then
    v_body := v_name || 'が確認項目『' || p_title || '』にチェックを付けました'; v_from := 'false'::jsonb; v_to := 'true'::jsonb;
  elsif p_action = 'unchecked' then
    v_body := v_name || 'が確認項目『' || p_title || '』のチェックを外しました'; v_from := 'true'::jsonb; v_to := 'false'::jsonb;
  elsif p_action = 'edited' then
    v_body := v_name || 'が確認項目『' || p_title || '』を直しました'; v_from := to_jsonb(p_from); v_to := to_jsonb(p_title);
  else
    v_body := v_name || 'が確認項目『' || p_title || '』を外しました'; v_from := to_jsonb(p_title); v_to := 'null'::jsonb;
  end if;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by, updated_by)
  values (v_tenant, p_ticket, case when coalesce(p_by_ai, false) then null else v_me end, 'change', v_body,
          jsonb_build_array(jsonb_build_object('field', 'test_spec', 'from', coalesce(v_from, 'null'::jsonb), 'to', coalesce(v_to, 'null'::jsonb), 'note', p_title)),
          case when coalesce(p_by_ai, false) then null else v_me end,
          case when coalesce(p_by_ai, false) then null else v_me end)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function app.test_spec_log(uuid, text, text, boolean, text) from public;
grant execute on function app.test_spec_log(uuid, text, text, boolean, text) to kaname_app;

-- ③ 機械・AI がチェックを付ける・外す。人の文脈（app.user_id）を要らず、会社の文脈だけで動く。付けた人は空・checked_by_ai を true に。
--    やり取りは author が空で名前は「AI」。updated_by は変えない（機械なので空のまま）
create or replace function app.test_spec_check_by_ai(p_spec uuid, p_checked boolean default true) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_want boolean := coalesce(p_checked, true);
  v_stage text;
  v_ticket uuid;
  t tickets%rowtype;
  s test_specs%rowtype;
begin
  if v_tenant is null then return jsonb_build_object('error', 'not_found'); end if;
  select ts.ticket_id into v_ticket from test_specs ts where ts.id = p_spec and ts.tenant_id = v_tenant;
  if v_ticket is null then return jsonb_build_object('error', 'not_found'); end if;
  select * into t from tickets where id = v_ticket and tenant_id = v_tenant for share;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  select * into s from test_specs where id = p_spec and tenant_id = v_tenant for update;
  if s.id is null or s.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  select st.key into v_stage from ticket_stages st where st.id = t.stage_id;
  if t.completed_at is not null or v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  if (s.checked_at is not null) = v_want then
    return jsonb_build_object('ok', true, 'row', app.test_spec_item(s.id), 'unchanged', true);
  end if;
  if v_want then
    update test_specs set checked_at = now(), checked_by_member_id = null, checked_by_ai = true, version = version + 1 where id = s.id;
  else
    update test_specs set checked_at = null, checked_by_member_id = null, checked_by_ai = false, version = version + 1 where id = s.id;
  end if;
  perform app.test_spec_log(t.id, case when v_want then 'checked' else 'unchecked' end, s.title, true);
  perform app.record_audit('test_spec.check_ai', 'test_specs', s.id::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'checked', v_want));
  return jsonb_build_object('ok', true, 'row', app.test_spec_item(s.id));
end $$;
revoke all on function app.test_spec_check_by_ai(uuid, boolean) from public;
grant execute on function app.test_spec_check_by_ai(uuid, boolean) to kaname_app;
