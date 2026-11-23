-- 20261122093200_ticket_body_set 本文 1 枚を書き終える（K-432・D-150.1・D-150.13・D-150.29・D-150.30・D-150.35・D-150.40・D-150.47・D-150.48・D-150.49・D-150.50・D-150.61・関門 C2）
--   本文の行（ticket_sections の鍵 body）と版の行（ticket_section_versions・追記だけ）は同じ量の二重書きなので、1 つの関数 app.ticket_body_set が 1 つの取引で書く（lessons L-002）。
--   本文の版＝版の行の最新の番号・本文の中身＝その版の中身が、いつでも成り立つ。やり取りの「本文を直した」1 行と証跡も同じ取引。
--   ① 版の表に列 restored_from（版を戻して作った版の元の番号・K-433 の戻す口だけが入れる）。版の行は追記だけの表（アプリの役の update・delete は外してある）なので、列の足しは migration の役で行う
--   ② app.ticket_body_set(p_ticket, p) → jsonb。p の鍵：version（今見ている版・本文の行がまだ無いチケットは 0）・doc・text（口が docToText で作った物）・restored_from（口の入力には無い）。
--      答え：{ok, changed, version, edited_at}／{error: forbidden | not_found | not_writable | done | invalid | conflict}（口が HTTP の番号に直す）。
--      誰が直したかは答えに入れない。本文の中身は、やり取りにも証跡にも入れない。

alter table ticket_section_versions add column if not exists restored_from int check (restored_from is null or restored_from >= 1);

create or replace function app.ticket_body_set(p_ticket uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  t tickets%rowtype;
  s ticket_sections%rowtype;
  v_has boolean;
  v_cur int := 0;
  v_new int;
  v_body jsonb;
  v_sid uuid;
  v_at timestamptz;
  v_restored int := nullif(p->>'restored_from', '')::int;
  v_changes jsonb;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- 同じチケットの書き終えるを 1 本ずつにする（版の合わせを取引の中で決める）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null for update;
  if not found or not app.ticket_visible(t.id) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if not app.ticket_writable(t.id) then
    return jsonb_build_object('error', 'not_writable');
  end if;
  -- 完了したチケットは直せない（D-150.30）：完了の時刻が入っているか、段が done
  if t.completed_at is not null or exists (select 1 from ticket_stages st where st.id = t.stage_id and st.key = 'done') then
    return jsonb_build_object('error', 'done');
  end if;
  -- 口をすり抜けた物の最後の砦（形と上限だけ。節の数は持たない）
  if not app.ticket_body_valid(jsonb_build_object('doc', p->'doc', 'text', p->>'text')) then
    return jsonb_build_object('error', 'invalid');
  end if;
  select * into s from ticket_sections where ticket_id = t.id and section_key = 'body' for update;
  v_has := found;
  if v_has then v_cur := s.version; end if;
  if coalesce((p->>'version')::int, -1) <> v_cur then
    return jsonb_build_object('error', 'conflict');
  end if;
  -- 同じ中身なら何も書かない（版は増えない）。版を戻すときは同じ中身でも新しい版を作る
  if v_has and v_restored is null and s.body->'doc' = p->'doc' then
    return jsonb_build_object('ok', true, 'changed', false, 'version', v_cur, 'edited_at', s.updated_at);
  end if;
  v_new := v_cur + 1;
  v_body := jsonb_build_object('doc', p->'doc', 'text', p->>'text');
  if v_has then
    update ticket_sections set body = v_body, version = v_new, updated_at = now(), updated_by = v_me where id = s.id;
    v_sid := s.id;
  else
    insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
      values (v_tenant, t.id, 'body', 0, v_body, v_new, v_me, v_me) returning id into v_sid;
  end if;
  insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, restored_from, created_by)
    values (v_tenant, t.id, v_sid, v_new, v_body, v_me, false, v_restored, v_me) returning edited_at into v_at;
  -- やり取りの 1 行（本文の中身は入れない・D-150.40）
  v_changes := jsonb_build_object('field', 'body',
                                  'from', case when v_cur = 0 then null else '版 ' || v_cur end,
                                  'to', '版 ' || v_new)
               || case when v_restored is null then '{}'::jsonb else jsonb_build_object('note', '版 ' || v_restored || ' に戻した') end;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by, updated_by)
    values (v_tenant, t.id, v_me, 'change',
            app.member_name(v_me) || case when v_restored is null then 'が本文を直しました' else 'が本文を版 ' || v_restored || ' に戻しました' end,
            jsonb_build_array(v_changes), v_me, v_me);
  -- 証跡（題名・本文は入れない）
  perform app.record_audit(case when v_restored is null then 'ticket.body.update' else 'ticket.body.restore' end,
                           'tickets', t.id::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'from_version', v_cur, 'to_version', v_new)
                           || case when v_restored is null then '{}'::jsonb else jsonb_build_object('restored_from', v_restored) end);
  return jsonb_build_object('ok', true, 'changed', true, 'version', v_new, 'edited_at', v_at);
end $$;
revoke all on function app.ticket_body_set(uuid, jsonb) from public;
grant execute on function app.ticket_body_set(uuid, jsonb) to kaname_app;
