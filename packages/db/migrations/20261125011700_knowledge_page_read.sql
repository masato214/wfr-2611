-- 20261125011700 ページを読む（K-677・契約の口 getKnowledgePage の足元・D-152.14・D-152.33）
--   新しい表・列は作らない。関数を 1 つ足す（数えるだけ・書かない）。同じ migration をもう 1 度当てても壊れない（create or replace）。
--
-- app.kn_page_ai_opened_30d(p)：AI がこの 30 日にそのページを開いた数。
--   reference_logs の行の守りは「チケットが見える人だけ」なので、口からは数えられない。ここで同じ会社の記録を数える（チケットが見えるかは見ない）。
--   ページが今の人に見えない（app.kpage_visible が偽）なら 0（在るかを漏らさない）。数えるのは ref_type = 'page'・ref_id = p・消していない・seen_at が 30 日以内
create or replace function app.kn_page_ai_opened_30d(p uuid) returns int
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when not app.kpage_visible(p) then 0
              else (select count(*)::int from reference_logs r
                     where r.tenant_id = app.tenant_id() and r.ref_type = 'page' and r.ref_id = p
                       and r.deleted_at is null and r.seen_at >= now() - interval '30 days') end
$$;

revoke execute on function app.kn_page_ai_opened_30d(uuid) from public;
grant execute on function app.kn_page_ai_opened_30d(uuid) to kaname_app;
