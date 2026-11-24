-- 20261128012100 運営が月の請求書をまとめて出す（K-981・契約の口 issueOpsInvoices・D-156.31・D-156.52・D-156.53・D-128.108・関門 C2）
--   ① 請求書の内訳の 4 列（プランの名前・税別の値段・消費税・日割り）。前からの行は空のまま
--   ② 会社と月で 1 枚：出した消していない請求書の一意の索引（前からの 2 枚目以降は消した印を付けてから張る）
--   ③ app.ops_invoice_lines(月)：出す会社ごとの 1 行（まだその月の請求書が無い会社・total が 0 の会社は出さない）
--   ④ app.ops_invoices_issue(月, 下書き, PDF)：下書きは何も書かない。出すは会社ごとに請求書・記録・管理者への鈴を 1 つの取引で
--   金額：その月の初日（日本の 0 時）に効いていた契約のプランの値段（税別・人数で掛けない）に消費税 10%（切り捨て）、
--         その月に上げた日割り（plan_change_requests の applied・税込・K-961 が残した額）を足す。月の途中で始めた会社はその月の値段のまま（D-156.52）
--   暦はどれも日本（Asia/Tokyo）。メールはこの葉では送らない（PDF ができた後の K-1109）

-- ① 内訳の列
alter table invoices add column if not exists plan_name text;
alter table invoices add column if not exists price_amount integer;
alter table invoices add column if not exists tax_amount integer;
alter table invoices add column if not exists prorated_amount integer;

-- ② 会社と月で 1 枚。前からの重なり（同じ会社・同じ月の出した 2 枚目以降）に消した印を付けてから張る
update invoices i set deleted_at = now()
 where i.issued_at is not null and i.deleted_at is null
   and exists (select 1 from invoices o
                where o.tenant_id = i.tenant_id and o.period_start = i.period_start
                  and o.issued_at is not null and o.deleted_at is null
                  and (o.created_at, o.id) < (i.created_at, i.id));
create unique index if not exists invoices_tenant_period_uq on invoices (tenant_id, period_start)
  where issued_at is not null and deleted_at is null;

-- ③ 出す会社ごとの 1 行：{ workspace: { id, name }, plan_name, amount, tax, prorated, total, subscription_id, contact }。ワークスペースの名前の順
--   出す会社：消していない・作りかけでない・運営の会社でない会社のうち、その月の出した請求書がまだ無い会社（止めている会社も契約があれば出す）
--   値段の契約：月の初日に効いていた契約の新しい 1 つ。無ければその月の中に始めた契約の最初の 1 つ。どれも無ければ値段 0
--   contact は会社の請求先（tenants.billing_contact・K-958）。空なら会社の名前だけ（PDF の宛名に K-1013 が使う）
create or replace function app.ops_invoice_lines(p_month text) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_start date; v_next date; v_at timestamptz; v_next_at timestamptz; v_rows jsonb;
begin
  perform app.ops_require('money');
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '月の形が違う' using errcode = 'invalid_parameter_value';
  end if;
  v_start := (p_month || '-01')::date;
  v_next := (v_start + interval '1 month')::date;
  v_at := v_start::timestamp at time zone 'Asia/Tokyo';
  v_next_at := v_next::timestamp at time zone 'Asia/Tokyo';

  with w as (
    select t.id, t.name, to_jsonb(t) -> 'billing_contact' as bc
      from tenants t
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and not exists (select 1 from invoices i
                        where i.tenant_id = t.id and i.period_start = v_start
                          and i.issued_at is not null and i.deleted_at is null)
  ), c as (
    select w.*, coalesce(
             (select s.id from subscriptions s
               where s.tenant_id = w.id and s.deleted_at is null
                 and s.started_at <= v_at and (s.ended_at is null or s.ended_at > v_at)
               order by s.started_at desc limit 1),
             (select s.id from subscriptions s
               where s.tenant_id = w.id and s.deleted_at is null
                 and s.started_at > v_at and s.started_at < v_next_at
               order by s.started_at asc limit 1)) as sub_id
      from w
  ), p as (
    select c.*, pl.name as plan, coalesce(pl.price_monthly, 0)::bigint as amount,
           (select coalesce(sum(r.prorated_amount), 0) from plan_change_requests r
             where r.tenant_id = c.id and r.deleted_at is null and r.status_id = 'applied'
               and r.effective_from >= v_start and r.effective_from < v_next)::bigint as prorated
      from c
      left join subscriptions su on su.id = c.sub_id
      left join plans pl on pl.id = su.plan_id
  ), x as (
    select p.*, (p.amount * 110 / 100 - p.amount) as tax from p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'workspace', jsonb_build_object('id', x.id, 'name', x.name),
           'plan_name', coalesce(x.plan, '無料'),
           'amount', x.amount, 'tax', x.tax, 'prorated', x.prorated,
           'total', x.amount + x.tax + x.prorated,
           'subscription_id', x.sub_id,
           'contact', coalesce(nullif(x.bc, 'null'::jsonb),
                               jsonb_build_object('company', x.name, 'attn', '', 'email', '')))
         order by x.name, x.id), '[]'::jsonb) into v_rows
    from x
   where x.amount + x.tax + x.prorated > 0;
  return v_rows;
end $$;
revoke all on function app.ops_invoice_lines(text) from public;
grant execute on function app.ops_invoice_lines(text) to kaname_app;

-- ④ まとめて出す。答えは { data: { month, count, total, lines } } か { error }。
--   見る順：運営の人とお金のできること（42501）→ 月が日本の今月より前でなければ month_open → 錠（同じ月の同時の 2 回を順に）→ 行 →
--   下書きなら行を返して何も書かない → p_pdf（会社の id → { invoice_id, pdf_ref, total }・K-1013 が渡す）の額が今の行と合わなければ changed →
--   会社ごとに請求書（一意の索引にぶつかれば飛ばす）→ 運営の記録と会社の記録 → 管理者への鈴 → 1 枚も出なければ nothing_to_issue。
--   書く所の失敗（例外）はそのまま上げる（1 つの取引なので何も残らない・口が 503）
create or replace function app.ops_invoices_issue(p_month text, p_dry boolean, p_pdf jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; v_start date; v_end date; v_due date; v_label text; v_lines jsonb; v_l jsonb;
  v_pdf jsonb := coalesce(p_pdf, '{}'::jsonb); v_out jsonb := '[]'::jsonb; v_total bigint := 0;
  v_tenant uuid; v_id uuid; v_line_total bigint;
begin
  perform app.ops_require('money');
  v_me := app.user_id();
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '月の形が違う' using errcode = 'invalid_parameter_value';
  end if;
  v_start := (p_month || '-01')::date;
  if v_start >= date_trunc('month', (now() at time zone 'Asia/Tokyo')::date)::date then
    return jsonb_build_object('error', 'month_open');
  end if;
  perform pg_advisory_xact_lock(hashtext('ops_invoices_issue:' || p_month));
  v_lines := app.ops_invoice_lines(p_month);

  if coalesce(p_dry, false) then
    return jsonb_build_object('data', jsonb_build_object(
      'month', p_month,
      'count', jsonb_array_length(v_lines),
      'total', (select coalesce(sum((e.l ->> 'total')::bigint), 0) from jsonb_array_elements(v_lines) e(l)),
      'lines', (select coalesce(jsonb_agg(e.l - 'subscription_id' - 'contact' order by e.o), '[]'::jsonb)
                  from jsonb_array_elements(v_lines) with ordinality e(l, o))));
  end if;

  if exists (select 1 from jsonb_each(v_pdf) k(tid, v)
              where not exists (select 1 from jsonb_array_elements(v_lines) e(l)
                                 where e.l -> 'workspace' ->> 'id' = k.tid
                                   and (e.l ->> 'total')::bigint = (k.v ->> 'total')::bigint)) then
    return jsonb_build_object('error', 'changed');
  end if;

  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_due := (v_start + interval '2 month' - interval '1 day')::date;
  v_label := extract(month from v_start)::int || ' 月分';
  for v_l in select e.l from jsonb_array_elements(v_lines) e(l) loop
    v_tenant := (v_l -> 'workspace' ->> 'id')::uuid;
    v_line_total := (v_l ->> 'total')::bigint;
    insert into invoices (id, tenant_id, subscription_id, period_start, period_end, amount,
                          plan_name, price_amount, tax_amount, prorated_amount,
                          issued_at, due_on, status_id, pdf_ref, created_by)
    values (coalesce(nullif(v_pdf -> v_tenant::text ->> 'invoice_id', '')::uuid, gen_random_uuid()),
            v_tenant, nullif(v_l ->> 'subscription_id', '')::uuid, v_start, v_end, v_line_total,
            v_l ->> 'plan_name', (v_l ->> 'amount')::int, (v_l ->> 'tax')::int, (v_l ->> 'prorated')::int,
            now(), v_due, 'issued', nullif(v_pdf -> v_tenant::text ->> 'pdf_ref', ''), v_me)
    on conflict (tenant_id, period_start) where issued_at is not null and deleted_at is null do nothing
    returning id into v_id;
    if not found then continue; end if;

    perform app.record_ops_audit(v_tenant, 'invoice.issue', 'invoices', v_id::text, null,
                                 jsonb_build_object('target_label', v_label, 'amount_total', v_line_total));
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, created_by)
    select v_tenant, m.id, 'inapp', 'billing.invoice_issued',
           jsonb_build_object('invoice_id', v_id, 'month', p_month, 'amount_total', v_line_total, 'due_on', v_due::text),
           v_me
      from tenant_memberships tm
      join members m on m.id = tm.member_id
     where tm.tenant_id = v_tenant and tm.role = 'admin' and tm.status = 'active'
       and tm.deleted_at is null and m.deleted_at is null;

    v_out := v_out || jsonb_build_array(v_l - 'subscription_id' - 'contact');
    v_total := v_total + v_line_total;
  end loop;

  if jsonb_array_length(v_out) = 0 then
    return jsonb_build_object('error', 'nothing_to_issue');
  end if;
  return jsonb_build_object('data', jsonb_build_object(
    'month', p_month, 'count', jsonb_array_length(v_out), 'total', v_total, 'lines', v_out));
end $$;
revoke all on function app.ops_invoices_issue(text, boolean, jsonb) from public;
grant execute on function app.ops_invoices_issue(text, boolean, jsonb) to kaname_app;
