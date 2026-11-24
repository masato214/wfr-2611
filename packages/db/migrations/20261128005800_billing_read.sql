-- 20261128005800 請求書を読む（K-958・契約の口 getBilling・downloadInvoicePdf・D-156.29・D-156.31・D-156.32・D-125.125）
--   ① 列 tenants.billing_contact（請求先は会社に 1 つ。{ company, attn, email }・空なら null。書くのは K-959）。
--      前の列 subscriptions.billing_contact は読まない・書かない（凍結）
--   ② 運営の会社にプラン 3 つ（free・team・business）。price_monthly は税別の円。運営が直した値を上書きしない（on conflict do nothing）
--   ③ 関数 app.billing_get()：請求書の画面の中身（請求先・請求書の表・期限を過ぎた数・無料か）。支払い条件と振込先は口が設定から足す
--   ④ 関数 app.billing_invoice_pdf(p_id)：出した請求書の PDF の置き場の参照
--   どちらも頭で「会社の中の人で、tenants の billing の能力を持つ」かを確かめる（入口の 2 層目・G-02）。読むだけ（書かない）

-- ① 請求先
alter table tenants add column if not exists billing_contact jsonb;

-- ② プラン 3 つ（運営の会社）
insert into plans (tenant_id, key, name, price_monthly, limits)
values (app.ops_tenant_id(), 'free', '無料', 0, '{"members": 3}'::jsonb),
       (app.ops_tenant_id(), 'team', 'チーム', 15000, '{"members": 10}'::jsonb),
       (app.ops_tenant_id(), 'business', 'ビジネス', 40000, '{"members": 30}'::jsonb)
on conflict (tenant_id, key) do nothing;

-- ③ 請求書の画面の中身
--   状態：入金の合計（消していない入金・打ち消しの負の行も足す）が請求の額と同じなら paid（paid_on は最後の入金の日）／
--         期限（due_on）が日本の今日より前なら overdue／ほかは unpaid（足りない・多いは unpaid のまま・D-156.32）
create or replace function app.billing_get() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_rows jsonb;
  v_overdue jsonb;
  v_contact jsonb;
  v_free boolean;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(app.user_id(), 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;

  with inv as (
    select i.id, i.period_start, i.issued_at, i.due_on, round(coalesce(i.amount, 0))::bigint as amount,
           p.paid_total, p.last_paid_on
      from invoices i
      left join lateral (
        select round(coalesce(sum(x.amount), 0))::bigint as paid_total, max(x.paid_on) as last_paid_on
          from payments x
         where x.invoice_id = i.id and x.tenant_id = v_tenant and x.deleted_at is null
      ) p on true
     where i.tenant_id = v_tenant and i.deleted_at is null and i.issued_at is not null
  ), st as (
    select inv.*,
           case when paid_total = amount then 'paid'
                when due_on < v_today then 'overdue'
                else 'unpaid' end as state
      from inv
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id,
             'month', to_char(period_start, 'YYYY-MM'),
             'issued_on', to_char((issued_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
             'amount_total', amount,
             'due_on', to_char(due_on, 'YYYY-MM-DD'),
             'state', state)
           || case when state = 'paid' then jsonb_build_object('paid_on', to_char(last_paid_on, 'YYYY-MM-DD')) else '{}'::jsonb end
           order by period_start desc, id), '[]'::jsonb),
         case when count(*) filter (where state = 'overdue') = 0 then null
              else jsonb_build_object('count', count(*) filter (where state = 'overdue'),
                                      'amount_total', coalesce(sum(amount) filter (where state = 'overdue'), 0)) end
    into v_rows, v_overdue
    from st;

  select coalesce(t.billing_contact, jsonb_build_object('company', t.name, 'attn', '', 'email', ''))
    into v_contact
    from tenants t where t.id = v_tenant;

  -- 今のプランの決めは K-954 の app.tenant_plan_id（契約が無ければ無料）。同じ決めを別に書かない
  select coalesce((select pl.key = 'free' from plans pl where pl.id = app.tenant_plan_id(v_tenant)), true) into v_free;

  return jsonb_build_object('data', jsonb_build_object(
    'contact', v_contact,
    'invoices', v_rows,
    'overdue', v_overdue,
    'free', v_free,
    'can_edit_contact', true));
end $$;
revoke all on function app.billing_get() from public;
grant execute on function app.billing_get() to kaname_app;

-- ④ 出した請求書の PDF の置き場の参照
create or replace function app.billing_invoice_pdf(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_ref text;
  v_found boolean := false;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(app.user_id(), 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select true, i.pdf_ref into v_found, v_ref
    from invoices i
   where i.id = p_id and i.tenant_id = v_tenant and i.deleted_at is null and i.issued_at is not null;
  if not coalesce(v_found, false) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_ref is null or v_ref = '' then
    return jsonb_build_object('error', 'pdf_missing');
  end if;
  return jsonb_build_object('pdf_ref', v_ref);
end $$;
revoke all on function app.billing_invoice_pdf(uuid) from public;
grant execute on function app.billing_invoice_pdf(uuid) to kaname_app;
