-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table knowledge_pages enable row level security;
alter table knowledge_pages force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'knowledge_pages' and policyname <> all (array['knowledge_pages_create', 'knowledge_pages_ops_read_with_grant', 'knowledge_pages_read', 'knowledge_pages_update']::name[]) loop execute format('drop policy %I on knowledge_pages', r.policyname); end loop; end $$;
drop policy if exists knowledge_pages_read on knowledge_pages;
create policy knowledge_pages_read on knowledge_pages for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND deleted_at IS NULL AND (CASE WHEN state = 'draft' THEN owner_member_id = app.user_id() ELSE (app.kn_shelf_readable(scope_id, is_personal, owner_member_id) OR app.kn_shared_visible(id)) END)));
drop policy if exists knowledge_pages_create on knowledge_pages;
create policy knowledge_pages_create on knowledge_pages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id() AND state = 'draft' AND app.kn_shelf_writable(scope_id, is_personal, owner_member_id)));
drop policy if exists knowledge_pages_update on knowledge_pages;
create policy knowledge_pages_update on knowledge_pages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND (CASE WHEN state = 'draft' THEN owner_member_id = app.user_id() ELSE app.kn_shelf_writable(scope_id, is_personal, owner_member_id) END))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND (CASE WHEN state = 'draft' THEN owner_member_id = app.user_id() ELSE app.kn_shelf_writable(scope_id, is_personal, owner_member_id) END)));
drop policy if exists knowledge_pages_ops_read_with_grant on knowledge_pages;
create policy knowledge_pages_ops_read_with_grant on knowledge_pages for select using (app.ops_grant_ok(knowledge_pages.tenant_id));
