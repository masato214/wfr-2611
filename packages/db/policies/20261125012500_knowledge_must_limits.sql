-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table knowledge_limits enable row level security;
alter table knowledge_limits force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'knowledge_limits' and policyname <> all (array['knowledge_limits_all_read']::name[]) loop execute format('drop policy %I on knowledge_limits', r.policyname); end loop; end $$;
drop policy if exists knowledge_limits_all_read on knowledge_limits;
create policy knowledge_limits_all_read on knowledge_limits for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
