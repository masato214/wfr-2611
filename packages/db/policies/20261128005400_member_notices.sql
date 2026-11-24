-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table notice_updates enable row level security;
alter table notice_updates force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'notice_updates' and policyname <> all (array['notice_updates_ops_all']::name[]) loop execute format('drop policy %I on notice_updates', r.policyname); end loop; end $$;
drop policy if exists notice_updates_ops_all on notice_updates;
create policy notice_updates_ops_all on notice_updates for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
