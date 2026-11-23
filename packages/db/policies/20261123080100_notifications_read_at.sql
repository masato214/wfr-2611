-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table notifications enable row level security;
alter table notifications force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname <> all (array['notifications_ops_read_with_grant', 'notifications_self_only_write_delete', 'notifications_self_only_write_insert', 'notifications_self_only_write_update', 'notifications_self_read']::name[]) loop execute format('drop policy %I on notifications', r.policyname); end loop; end $$;
drop policy if exists notifications_self_read on notifications;
create policy notifications_self_read on notifications for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notifications_self_only_write_insert on notifications;
create policy notifications_self_only_write_insert on notifications for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notifications_self_only_write_update on notifications;
create policy notifications_self_only_write_update on notifications for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notifications_self_only_write_delete on notifications;
create policy notifications_self_only_write_delete on notifications for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notifications_ops_read_with_grant on notifications;
create policy notifications_ops_read_with_grant on notifications for select using (app.ops_grant_ok(notifications.tenant_id));
