-- 20261128005200 問い合わせに返事を書く・済みにする（K-952・契約の口 postInquiryMessage・resolveMyInquiry・D-156.5・D-156.12・D-156.17・D-156.25・D-156.26・D-125.130・関門 C2）
--   ① 添付の確かめと付けを 1 つの関数 app.inquiry_attach にまとめ、作る（app.inquiry_create）と書く（app.inquiry_post）の両方から呼ぶ（同じ確かめを 2 つ書かない）
--   ② app.inquiry_create を作り直す（添付の所だけを ① にする。答えと振る舞いは K-949 のまま）
--   ③ 返事を書く app.inquiry_post：どの状態からも open に戻す（済み・後での後でも開き直る・後での期限も消す・D-156.25）
--   ④ 済みにする app.inquiry_resolve：done にする。もう done なら何も書かない（証跡も足さない）
--   運営へのメール・鈴は出さない（D-125.130：運営は受信箱の数で知る）。証跡に題・内容・ファイルの名前を入れない。
--   添付を断ったときは、書いた行を取引の中の区切り（例外の受け）で戻してから断りの言葉を返す（何も残さない）。
--   書く所の失敗（例外）はそのまま上げる（1 つの取引なので何も残らない・口が 503）。
-- 中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形（create or replace）

-- ① 添付の確かめと付け。答えは [{id,name,size}]（並びは最初に出た順・重なりは 1 つ）か { error }（not_found／attachment_unusable）。
--   付けられるのは attachments の行（owner_type 'inquiry'・上げたのが本人・本人の会社・消していない）だけ。
--   無い・別の人・別の会社・消した → not_found／検査が済んでいない（scanned_at か storage_ref が空）・もう付けた（owner_id がある）→ attachment_unusable。
--   添付は id の順に for update で取る（同時に同じ添付を付けたら、後の 1 つは前の 1 つが済んだ後の行を見て attachment_unusable）。
--   付けたら attachments.owner_id と書き込みの attachments を書く。断ったときは何も書かない（呼んだ側が書いた行を戻す）。
--   内部用：kaname_app に execute を出さない（ほかの security definer の関数の中だけで呼ぶ）
create or replace function app.inquiry_attach(p_message uuid, p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_ids uuid[]; v_found int; v_bad int; v_files jsonb := '[]'::jsonb;
begin
  select coalesce(array_agg(x.id order by x.ord), '{}') into v_ids
    from (select id, min(ord) as ord from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality as u(id, ord)
           where id is not null group by id) x;
  if cardinality(v_ids) = 0 then return v_files; end if;
  perform 1 from attachments where id = any(v_ids) order by id for update;
  select count(*) into v_found from attachments a
   where a.id = any(v_ids) and a.tenant_id = v_tenant and a.owner_type = 'inquiry'
     and a.uploaded_by = v_me and a.deleted_at is null;
  if v_found <> cardinality(v_ids) then return jsonb_build_object('error', 'not_found'); end if;
  select count(*) into v_bad from attachments a
   where a.id = any(v_ids) and (a.scanned_at is null or a.storage_ref is null or a.owner_id is not null);
  if v_bad > 0 then return jsonb_build_object('error', 'attachment_unusable'); end if;
  select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'size', a.size) order by u.ord) into v_files
    from unnest(v_ids) with ordinality as u(id, ord) join attachments a on a.id = u.id;
  update attachments set owner_id = p_message, updated_by = v_me where id = any(v_ids);
  update messages set attachments = v_files where id = p_message and tenant_id = v_tenant;
  return v_files;
end $$;
revoke all on function app.inquiry_attach(uuid, uuid[]) from public;

-- ② 問い合わせを作る（K-949 の答えと振る舞いのまま・添付の所を ① に）。
--   見る順：会社の今のメンバー（role member）でない → forbidden／題・内容が空 → empty／添付（①）。断ったら何も残さない
create or replace function app.inquiry_create(p_topic text, p_title text, p_body text, p_attachment_ids uuid[], p_context jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  c_blank constant text := E' \t\r\n\f\v　';
  v_title text; v_body text; v_scope uuid; v_conv uuid; v_inq uuid; v_msg uuid;
  v_files jsonb; q inquiries%rowtype;
begin
  if v_tenant is null or v_me is null or app.role() is distinct from 'member' or not app.member_ok() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select scope_id into v_scope from members where id = v_me and tenant_id = v_tenant;
  if v_scope is null then return jsonb_build_object('error', 'forbidden'); end if;

  v_title := btrim(coalesce(p_title, ''), c_blank);
  v_body := btrim(coalesce(p_body, ''), c_blank);
  if v_title = '' or v_body = '' then return jsonb_build_object('error', 'empty'); end if;

  begin
    insert into conversations (tenant_id, scope_id, owner_member_id, area, title, title_auto, created_by)
      values (v_tenant, v_scope, v_me, 'inquiry', v_title, false, v_me) returning id into v_conv;
    insert into inquiries (tenant_id, opened_by_member_id, conversation_id, title, topic_key, state, context, last_message_at, created_by)
      values (v_tenant, v_me, v_conv, v_title, p_topic, 'open', coalesce(p_context, '{}'::jsonb), now(), v_me)
      returning * into q;
    v_inq := q.id;
    insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, visibility, attachments, created_by)
      values (v_tenant, v_conv, v_me, v_body, 'inquiry', 'all', '[]'::jsonb, v_me) returning id into v_msg;
    v_files := app.inquiry_attach(v_msg, p_attachment_ids);
    if jsonb_typeof(v_files) = 'object' then
      raise exception using errcode = 'P0952', message = v_files->>'error';
    end if;
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (v_tenant, v_me, 'member', 'inquiry.create', 'inquiries', v_inq::text, 'C2',
              jsonb_build_object('topic', p_topic, 'attachments', jsonb_array_length(v_files)), v_me);
  exception when sqlstate 'P0952' then
    -- 添付を断った：この区切りで書いた行は戻っている
    return jsonb_build_object('error', SQLERRM);
  end;
  return jsonb_build_object('data', jsonb_build_object(
    'id', q.id, 'title', q.title, 'topic', q.topic_key, 'state', q.state, 'created_at', q.created_at,
    'asker_read_at', q.asker_read_at, 'last_reply_at', null));
end $$;
revoke all on function app.inquiry_create(text, text, text, uuid[], jsonb) from public;
grant execute on function app.inquiry_create(text, text, text, uuid[], jsonb) to kaname_app;

-- ③ 返事を書く。答えは { data: <書き込みの 6 欄> } か { error }（forbidden／not_found／empty／添付の言葉）。
--   本人の・消していない問い合わせを for update で取る（同時に 2 つ書けば順に 2 つとも残る）。
--   どの状態からも state 'open'・later_until null・last_message_at now()（D-156.25）
create or replace function app.inquiry_post(p_id uuid, p_body text, p_attachment_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  c_blank constant text := E' \t\r\n\f\v　';
  v_body text; v_msg uuid; v_at timestamptz; v_files jsonb; v_name text; q inquiries%rowtype;
begin
  if v_tenant is null or v_me is null or app.role() is distinct from 'member' or not app.member_ok() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select * into q from inquiries
   where id = p_id and tenant_id = v_tenant and opened_by_member_id = v_me and deleted_at is null
   for update;
  if not found or q.conversation_id is null then return jsonb_build_object('error', 'not_found'); end if;

  v_body := btrim(coalesce(p_body, ''), c_blank);
  if v_body = '' then return jsonb_build_object('error', 'empty'); end if;

  begin
    insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, visibility, attachments, created_by)
      values (v_tenant, q.conversation_id, v_me, v_body, 'inquiry', 'all', '[]'::jsonb, v_me)
      returning id, created_at into v_msg, v_at;
    v_files := app.inquiry_attach(v_msg, p_attachment_ids);
    if jsonb_typeof(v_files) = 'object' then
      raise exception using errcode = 'P0952', message = v_files->>'error';
    end if;
    update inquiries set state = 'open', later_until = null, last_message_at = now(), updated_by = v_me
     where id = q.id;
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (v_tenant, v_me, 'member', 'inquiry.message', 'inquiries', q.id::text, 'C2',
              jsonb_build_object('attachments', jsonb_array_length(v_files)), v_me);
  exception when sqlstate 'P0952' then
    return jsonb_build_object('error', SQLERRM);
  end;
  select display_name into v_name from members where id = v_me and tenant_id = v_tenant;
  return jsonb_build_object('data', jsonb_build_object(
    'id', v_msg, 'from', 'me', 'author_name', v_name, 'body', v_body, 'attachments', v_files, 'created_at', v_at));
end $$;
revoke all on function app.inquiry_post(uuid, text, uuid[]) from public;
grant execute on function app.inquiry_post(uuid, text, uuid[]) to kaname_app;

-- ④ 済みにする。答えは { data: <問い合わせの 7 欄の元> } か { error }（forbidden／not_found）。もう done なら何も書かない
create or replace function app.inquiry_resolve(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_last_reply timestamptz; q inquiries%rowtype;
begin
  if v_tenant is null or v_me is null or app.role() is distinct from 'member' or not app.member_ok() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select * into q from inquiries
   where id = p_id and tenant_id = v_tenant and opened_by_member_id = v_me and deleted_at is null
   for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if q.state <> 'done' then
    update inquiries set state = 'done', updated_by = v_me where id = q.id returning * into q;
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (v_tenant, v_me, 'member', 'inquiry.resolve', 'inquiries', q.id::text, 'C2', '{}'::jsonb, v_me);
  end if;
  -- 運営の返事（見え方 all・送った人なし・inquiry_reply）の最新（K-951 の読む口と同じ決まり）
  select max(m.created_at) into v_last_reply from messages m
   where m.conversation_id = q.conversation_id and m.tenant_id = q.tenant_id and m.deleted_at is null
     and m.visibility = 'all' and m.sender_member_id is null and m.kind = 'inquiry_reply';
  return jsonb_build_object('data', jsonb_build_object(
    'id', q.id, 'title', q.title, 'topic', q.topic_key, 'state', q.state, 'created_at', q.created_at,
    'asker_read_at', q.asker_read_at, 'last_reply_at', v_last_reply));
end $$;
revoke all on function app.inquiry_resolve(uuid) from public;
grant execute on function app.inquiry_resolve(uuid) to kaname_app;
