-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table inquiries enable row level security;
alter table inquiries force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'inquiries' and policyname <> all (array['inquiries_ops_read_with_grant', 'inquiries_self_read']::name[]) loop execute format('drop policy %I on inquiries', r.policyname); end loop; end $$;
drop policy if exists inquiries_self_read on inquiries;
create policy inquiries_self_read on inquiries for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND opened_by_member_id = app.user_id()));
drop policy if exists inquiries_ops_read_with_grant on inquiries;
create policy inquiries_ops_read_with_grant on inquiries for select using (app.ops_grant_ok(inquiries.tenant_id));

alter table messages enable row level security;
alter table messages force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname <> all (array['messages_conversation_read', 'messages_conversation_write_insert', 'messages_conversation_write_update', 'messages_ops_read_with_grant']::name[]) loop execute format('drop policy %I on messages', r.policyname); end loop; end $$;
drop policy if exists messages_conversation_read on messages;
create policy messages_conversation_read on messages for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id) AND visibility <> 'ops_only'));
drop policy if exists messages_conversation_write_insert on messages;
create policy messages_conversation_write_insert on messages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id)));
drop policy if exists messages_conversation_write_update on messages;
create policy messages_conversation_write_update on messages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id)));
drop policy if exists messages_ops_read_with_grant on messages;
create policy messages_ops_read_with_grant on messages for select using (app.ops_grant_ok(messages.tenant_id));
