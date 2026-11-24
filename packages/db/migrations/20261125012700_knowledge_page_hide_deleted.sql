-- 20261125012700 消したページを行の守りで隠す（K-681・PM の決め 案 1・守りを 2 層に：口の deleted_at is null つきの読みと行の守り）
--   新しい表・列は作らない。関数を 1 つ足す。行の守り knowledge_pages_read に deleted_at is null を足すのは同じ名前の policies のファイル（gen_rls.py が作る）。
--   同じ migration をもう 1 度当てても壊れない（create or replace）。
--
-- app.kn_page_soft_delete(p, draft_only)：ページに消した印を入れる。消せたら true。
--   行の守りが消したページを見せないので、アプリの接続の update … set deleted_at は「書いた後の行が見えない」で断られる。ここで消す。
--   呼んだ人の会社（app.tenant_id）のページだけ・呼んだ人がそのページに書ける（app.kpage_writable・消した後は偽）ときだけ消す。書けなければ何もしない（false）。
--   生きている下書きの版（だれの物でも）にも消した印を入れる。公開の版は触らない（履歴として残す）。
--   draft_only が真なら、まだ 1 度も書き終えていないページ（state draft）だけを消す（下書きをやめる口・K-679）。
create or replace function app.kn_page_soft_delete(p uuid, draft_only boolean default false) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  if p is null or app.tenant_id() is null or not app.kpage_writable(p) then
    return false;
  end if;
  update knowledge_pages set deleted_at = now(), updated_by = app.user_id()
   where id = p and tenant_id = app.tenant_id() and deleted_at is null
     and (not draft_only or state = 'draft');
  get diagnostics n = row_count;
  if n <> 1 then
    return false;
  end if;
  update knowledge_page_versions set deleted_at = now(), updated_by = app.user_id()
   where page_id = p and tenant_id = app.tenant_id() and kind = 'draft' and deleted_at is null;
  return true;
end $$;

revoke execute on function app.kn_page_soft_delete(uuid, boolean) from public;
grant execute on function app.kn_page_soft_delete(uuid, boolean) to kaname_app;
