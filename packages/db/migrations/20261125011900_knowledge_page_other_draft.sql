-- 20261125011900 別の人が下書き中かを見分ける（K-679・契約の口 saveKnowledgeDraft・E-KNW-012）
--   新しい表・列は作らない。関数を 1 つ足す。同じ migration をもう 1 度当てても壊れない（create or replace）。
--
-- app.kn_page_other_draft(p)：そのページに、今の人以外が作った生きている下書きの版（kind = 'draft'・deleted_at is null）があるかを返す。
--   行の守り（knowledge_page_versions）は他人の下書きの版を見せないので、口からは見分けられない。ここで見る。
--   呼んだ人がそのページに書けない（app.kpage_writable が偽・消した後）なら偽を返す（在るかを漏らさない）。題名・本文は返さない
create or replace function app.kn_page_other_draft(p uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if not app.kpage_writable(p) then
    return false;
  end if;
  return exists (
    select 1 from knowledge_page_versions
     where page_id = p and tenant_id = app.tenant_id() and kind = 'draft' and deleted_at is null
       and author_member_id is distinct from app.user_id()
  );
end $$;

revoke execute on function app.kn_page_other_draft(uuid) from public;
grant execute on function app.kn_page_other_draft(uuid) to kaname_app;
