-- 20261128004900 問い合わせる口（K-949・契約の口 createInquiry・D-156.5・D-156.11・D-156.12・D-156.17・D-156.25・D-156.26・D-128.71・D-125.130・D-130.1・関門 C2）
--   ① 問い合わせの列：題・何について・状態（運営の受信箱の 4 つ）・本人が最後に開いた時刻・最後のやり取りの時刻。前からの status_id・kind_id は使わない（消さない）
--   ② 書き込みの列：見え方（all／ops_only＝運営の社内メモ・ER 図 508 行）・運営の返事の名前の写し（運営の会社の人の名前は顧客の会社から読めない・K-975 が書く）
--   ③ 問い合わせを作る関数 app.inquiry_create（1 つの取引：会話・問い合わせ・最初の書き込み・添付の持ち主・証跡）。
--      運営へのメール・鈴は出さない（D-125.130：運営は受信箱の数で知る）。行の守りは policies/20261128004900_inquiries.sql（作り手が作る）

-- ① 問い合わせ。state：open＝運営が返していない・waiting＝運営が返して顧客を待つ・later＝運営が後でにした・done＝済み
alter table inquiries add column title text;
alter table inquiries add column topic_key text;
alter table inquiries add column state text not null default 'open';
alter table inquiries add column asker_read_at timestamptz;
alter table inquiries add column last_message_at timestamptz;
alter table inquiries add constraint inquiries_topic_key_check
  check (topic_key is null or topic_key in ('usage', 'trouble', 'billing', 'other'));
alter table inquiries add constraint inquiries_state_check
  check (state in ('open', 'waiting', 'later', 'done'));

-- ② 書き込み。前からの行は all（今までどおり読める）
alter table messages add column visibility text not null default 'all';
alter table messages add column author_name text;
alter table messages add constraint messages_visibility_check
  check (visibility in ('all', 'ops_only'));

-- ③ 問い合わせを作る。答えは { data: <問い合わせの 7 欄の元> } か { error }。だめなときは何も書かない。
--   見る順：会社の今のメンバー（role member）でない → forbidden／添付が無い・別の人の・別の会社の・消した → not_found／
--   検査が済んでいない（scanned_at か storage_ref が空）・もう付けた（owner_id がある）→ attachment_unusable。
--   添付は id の順に for update で取る（同時に同じ添付を付けたら、後の 1 つは前の 1 つが済んだ後の行を見て attachment_unusable）。
--   題と内容は口が整えて渡す（前後の空白を落とす）。ここでも前後の空白（全角・タブ・改行）を落とし、空なら empty（口が先に 422 で断る）。
--   書く所の失敗（例外）はそのまま上げる（1 つの取引なので何も残らない・口が 503）。証跡に題・内容・画面の情報・ファイルの名前を入れない
create or replace function app.inquiry_create(p_topic text, p_title text, p_body text, p_attachment_ids uuid[], p_context jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  c_blank constant text := E' \t\r\n\f\v　';
  v_title text; v_body text; v_scope uuid; v_ids uuid[]; v_conv uuid; v_inq uuid; v_msg uuid;
  v_files jsonb := '[]'::jsonb; v_found int; v_bad int; q inquiries%rowtype;
begin
  if v_tenant is null or v_me is null or app.role() is distinct from 'member' or not app.member_ok() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select scope_id into v_scope from members where id = v_me and tenant_id = v_tenant;
  if v_scope is null then return jsonb_build_object('error', 'forbidden'); end if;

  v_title := btrim(coalesce(p_title, ''), c_blank);
  v_body := btrim(coalesce(p_body, ''), c_blank);
  if v_title = '' or v_body = '' then return jsonb_build_object('error', 'empty'); end if;

  -- 添付：重なりは 1 つにし、並びは最初に出た順のまま
  select coalesce(array_agg(x.id order by x.ord), '{}') into v_ids
    from (select id, min(ord) as ord from unnest(coalesce(p_attachment_ids, '{}'::uuid[])) with ordinality as u(id, ord)
           where id is not null group by id) x;
  if cardinality(v_ids) > 0 then
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
  end if;

  insert into conversations (tenant_id, scope_id, owner_member_id, area, title, title_auto, created_by)
    values (v_tenant, v_scope, v_me, 'inquiry', v_title, false, v_me) returning id into v_conv;
  insert into inquiries (tenant_id, opened_by_member_id, conversation_id, title, topic_key, state, context, last_message_at, created_by)
    values (v_tenant, v_me, v_conv, v_title, p_topic, 'open', coalesce(p_context, '{}'::jsonb), now(), v_me)
    returning * into q;
  v_inq := q.id;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, visibility, attachments, created_by)
    values (v_tenant, v_conv, v_me, v_body, 'inquiry', 'all', v_files, v_me) returning id into v_msg;
  if cardinality(v_ids) > 0 then
    update attachments set owner_id = v_msg, updated_by = v_me where id = any(v_ids);
  end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'inquiry.create', 'inquiries', v_inq::text, 'C2',
            jsonb_build_object('topic', p_topic, 'attachments', cardinality(v_ids)), v_me);
  return jsonb_build_object('data', jsonb_build_object(
    'id', q.id, 'title', q.title, 'topic', q.topic_key, 'state', q.state, 'created_at', q.created_at,
    'asker_read_at', q.asker_read_at, 'last_reply_at', null));
end $$;
revoke all on function app.inquiry_create(text, text, text, uuid[], jsonb) from public;
grant execute on function app.inquiry_create(text, text, text, uuid[], jsonb) to kaname_app;
