-- 20261125011800 フォルダを書く（K-678・契約の口 deleteKnowledgeFolder の中が空かの確かめ・D-152.14）
--   新しい表・列は作らない。関数を 1 つ足す（数えるだけ・書かない）。同じ migration をもう 1 度当てても壊れない（create or replace）。
--
-- app.kn_folder_in_use(p_folder)：そのフォルダの中に、消していないフォルダかページ（state を問わない）が 1 つでもあれば true。
--   消す人に見えない他人の下書きのページも数える（口が行の守りの上で数えると、見えない下書きを孤児にする）。同じ会社だけを見る
--   呼んだ人がそのフォルダに書けない（app.kfolder_writable が偽）なら中を数えず false（id が分かっても中の有り無しを漏らさない）
create or replace function app.kn_folder_in_use(p_folder uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.kfolder_writable(p_folder)
     and (exists (select 1 from knowledge_folders f
                   where f.tenant_id = app.tenant_id() and f.parent_folder_id = p_folder and f.deleted_at is null)
       or exists (select 1 from knowledge_pages p
                   where p.tenant_id = app.tenant_id() and p.folder_id = p_folder and p.deleted_at is null))
$$;

revoke execute on function app.kn_folder_in_use(uuid) from public;
grant execute on function app.kn_folder_in_use(uuid) to kaname_app;
