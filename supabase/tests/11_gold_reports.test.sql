-- =============================================================================
-- Phase 10: report aggregates are correct, exclude voided docs and respect RLS.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'warehouse-a@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select '00000000-0000-0000-0000-0000000000e1', id, 'WAREHOUSE', 'Gudang', 'warehouse-a@test.local' from public.gold_tenants where name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select tenant_id, '00000000-0000-0000-0000-0000000000e1', id from public.gold_stores where name = 'Pusat A';
select set_config('test.store_a', (select id::text from public.gold_stores where name = 'Pusat A'), true);

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
end $$;
create or replace function pg_temp.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'ASSERTION FAILED: %', p_msg; end if;
end $$;

-- tenant A: 3 pieces 24K (sell 2.000.000/g, buy 1.800.000/g), cost 1.500.000 each; sell 2 (one voided), 1 buyback
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1800000, 2000000 from public.gold_purities where code = '24K';
insert into public.gold_products (category_id, purity_id, name, gross_weight, cost_price) select c.id, p.id, 'LM 1g', 1, 1500000 from public.gold_categories c, public.gold_purities p where c.code = 'LM' and p.code = '24K';
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null, (select id from public.gold_products limit 1),
  '[{"gross_weight":1},{"gross_weight":1},{"gross_weight":1}]'::jsonb);
select * from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
  jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = 'GOLD-000001'), 'discount', 100000)),
  '[{"method":"CASH","amount":2000000}]'::jsonb, 1900000);
select set_config('test.s2', (select sale_id::text from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
  jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = 'GOLD-000002'))),
  '[{"method":"QRIS","amount":2000000}]'::jsonb, 2000000)), true);
select public.gold_void_sale(current_setting('test.s2')::uuid, 'batal');
insert into public.gold_customers (name, phone) values ('Budi', '081111111111');
select * from public.gold_create_buyback(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
  jsonb_build_array(jsonb_build_object('name', 'Cincin lama', 'category_id', (select id from public.gold_categories where code = 'RNG'),
    'purity_id', (select id from public.gold_purities where code = '24K'), 'gross_weight', 2)),
  '[{"method":"CASH","amount":3600000}]'::jsonb, 3600000);

select set_config('test.from', (now() - interval '1 day')::text, true);
select set_config('test.to', (now() + interval '1 day')::text, true);

select pg_temp.assert((select sales_count from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 1, 'voided sale excluded');
select pg_temp.assert((select sales_total from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 1900000, 'sales total net of discount');
select pg_temp.assert((select sales_discount from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 100000, 'discount');
select pg_temp.assert((select gross_profit from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 400000, 'gross profit = 1.900.000 - 1.500.000');
select pg_temp.assert((select buyback_total from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 3600000, 'buyback total');
select pg_temp.assert((select buyback_gold_weight from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 2, 'gold bought');
-- on hand: GOLD-000002 (back after void), GOLD-000003, buyback piece => 3 pieces, 4 g
select pg_temp.assert((select inventory_count from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 3, 'inventory count');
select pg_temp.assert((select inventory_gold_weight from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 4, 'inventory weight');
-- cash: +2.000.000 in −100.000 change ; QRIS +2.000.000 then −2.000.000 void ; −3.600.000 buyback
select pg_temp.assert((select cash_in - cash_out from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = -1700000, 'net cash flow');
select pg_temp.assert((select net from public.gold_report_payments(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz) where method = 'QRIS') = 0, 'QRIS net zero after void');
select pg_temp.assert((select sum(sales_total) from public.gold_report_daily(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 1900000, 'daily series sums');
select pg_temp.assert((select count(*) from public.gold_report_daily(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) >= 2, 'daily series zero-filled');
select pg_temp.assert((select sum(item_count) from public.gold_report_inventory()) = 3, 'inventory report');
select pg_temp.assert((select buyback_total from public.gold_report_customers(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz) where name = 'Budi') = 3600000, 'customer report');
reset role;

-- warehouse (no reports.view / sales.manage) sees no sales money in reports
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.assert((select sales_total from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 0, 'warehouse sees no sales totals');
reset role;

-- owner B sees nothing of tenant A
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select sales_count + buyback_count + inventory_count from public.gold_report_summary(current_setting('test.from')::timestamptz, current_setting('test.to')::timestamptz)) = 0, 'tenant isolation in reports');
reset role;

select 'ALL GOLD REPORT TESTS PASSED' as result;
rollback;
