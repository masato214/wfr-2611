-- 20261128005000 問い合わせの添付を上げる（K-950・D-156.11・D-156.26・関門 C2・C4）
--   ブラウザは関門 C4 が署名した置き場の上げ先へ直に送り（口の体の上限 4.5MB を通さない）、上げ終わりの受け口が置いた物の頭と大きさを照らしてから受ける。
--   ① attachments に印（1 回だけ・hash だけ）・印の期限（10 分）・置く参照（求めるときに決める）の 3 列
--   ② 求める口の app.inquiry_attachment_start（会社の人の文脈）
--   ③ 上げ終わりの受け口の app.inquiry_attachment_peek（鍵を取らない読み）・take（for update skip locked）・done（検査の印・証跡）
--   断りは例外にせず { "error": "<言葉>" }（何も書かない）。証跡に名前を入れない

-- ---------------------------------------------------------------- ① 列
alter table attachments add column if not exists upload_token_hash text;
alter table attachments add column if not exists upload_expires_at timestamptz;
alter table attachments add column if not exists upload_ref text;
-- 新しい列で、まだどの行も値を持たない（部分の索引で印のある行だけ）
-- squawk-ignore require-concurrent-index-creation
create unique index if not exists attachments_upload_token_uq on attachments (upload_token_hash) where upload_token_hash is not null;

-- ---------------------------------------------------------------- ② 求める
--   本人（会社の人）の問い合わせ用の添付の行を作る。持ち主（owner_id）は付けるときに K-949 が入れる。置く参照は名前を使わない
create or replace function app.inquiry_attachment_start(p_name text, p_mime text, p_size bigint, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_member uuid := app.user_id();
  v_scope uuid;
  v_id uuid := gen_random_uuid();
  v_ref text;
  -- 秒に切る（答えの expires_at と行の期限を同じ値で持つ）
  v_exp timestamptz := date_trunc('second', now() + interval '10 minutes');
begin
  if app.role() is distinct from 'member' or not app.member_ok() or v_tenant is null or v_member is null then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception '印はハッシュで渡す' using errcode = '22023';
  end if;
  select scope_id into v_scope from members where id = v_member and tenant_id = v_tenant;
  if v_scope is null then return jsonb_build_object('error', 'forbidden'); end if;
  v_ref := 'tenants/' || v_tenant::text || '/' || v_id::text;
  insert into attachments (id, tenant_id, scope_id, owner_type, owner_id, storage_ref, mime, size, name, uploaded_by,
                           upload_token_hash, upload_expires_at, upload_ref, created_by, updated_by)
    values (v_id, v_tenant, v_scope, 'inquiry', null, null, p_mime, p_size, p_name, v_member,
            p_token_hash, v_exp, v_ref, v_member, v_member);
  return jsonb_build_object('data', jsonb_build_object('id', v_id, 'upload_ref', v_ref, 'expires_at', v_exp));
end $$;

-- ---------------------------------------------------------------- ③ 上げ終わり
--   印だけで判定する（セッションを見ない）。期限内・消していない・まだ受けていない行だけ。鍵を取らない（置き場から読む間は DB を占めない）
create or replace function app.inquiry_attachment_peek(p_token_hash text) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object('id', a.id, 'tenant_id', a.tenant_id, 'member_id', a.uploaded_by, 'mime', a.mime,
                            'size', a.size, 'upload_ref', a.upload_ref)
  from attachments a
  where a.upload_token_hash = p_token_hash and a.upload_expires_at > now() and a.deleted_at is null
    and a.storage_ref is null and a.owner_type = 'inquiry'
$$;

-- 同じ条件の行の鍵を取る。同時の 2 回目は null（待たない）
create or replace function app.inquiry_attachment_take(p_token_hash text) returns uuid
language sql security definer set search_path = public, app, pg_temp as $$
  select a.id from attachments a
  where a.upload_token_hash = p_token_hash and a.upload_expires_at > now() and a.deleted_at is null
    and a.storage_ref is null and a.owner_type = 'inquiry'
  for update skip locked
$$;

-- 検査の済んだ印・置き場の参照・大きさを入れ、印と期限を消す。証跡（C4・大きさと種類だけ）も同じ取引で書く（会社の人の文脈が要る）
create or replace function app.inquiry_attachment_done(p_id uuid, p_ref text, p_size bigint) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_mime text;
begin
  update attachments set storage_ref = p_ref, size = p_size, scanned_at = now(),
         upload_token_hash = null, upload_expires_at = null, updated_by = app.user_id()
   where id = p_id and tenant_id = app.tenant_id() and storage_ref is null and deleted_at is null
   returning mime into v_mime;
  if not found then return false; end if;
  perform app.record_audit('inquiry_attachment.put', 'attachments', p_id::text, 'C4',
                           jsonb_build_object('size', p_size, 'mime', v_mime));
  return true;
end $$;

revoke all on function app.inquiry_attachment_start(text, text, bigint, text), app.inquiry_attachment_peek(text),
  app.inquiry_attachment_take(text), app.inquiry_attachment_done(uuid, text, bigint)
  from public;
grant execute on function app.inquiry_attachment_start(text, text, bigint, text), app.inquiry_attachment_peek(text),
  app.inquiry_attachment_take(text), app.inquiry_attachment_done(uuid, text, bigint)
  to kaname_app;

insert into app.schema_migrations (name) values ('20261128005000_inquiry_attachments.sql') on conflict do nothing;
