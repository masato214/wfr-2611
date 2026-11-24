-- 20261128005100 自分の問い合わせを開いたときの読んだ印（K-951・契約の口 getMyInquiry・D-156.25・D-156.27・関門 C2）
--   K-949 は inquiries に書く行の守りを置かない（書くのは関数だけ）ので、読んだ印（inquiries.asker_read_at）もこの関数だけが書く。
--   見ている人は app.user_id() で引く（引数で人を受けない）。本人の・消していない問い合わせでなければ false（口は先に 404 にしている）。
--   知らせ・証跡は書かない（本人の画面の都合の値）。
-- 中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形（create or replace）

create or replace function app.inquiry_mark_read(p_inquiry uuid) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if app.tenant_id() is null or app.user_id() is null or p_inquiry is null then return false; end if;
  if not app.member_ok() then return false; end if;
  update inquiries set asker_read_at = now()
   where id = p_inquiry and tenant_id = app.tenant_id() and opened_by_member_id = app.user_id() and deleted_at is null;
  return found;
end $$;
revoke all on function app.inquiry_mark_read(uuid) from public;
grant execute on function app.inquiry_mark_read(uuid) to kaname_app;
