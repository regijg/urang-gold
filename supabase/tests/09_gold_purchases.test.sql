-- =============================================================================
-- Phase 8: purchases from supplier -> inventory, payable, void.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select '00000000-0000-0000-0000-0000000000c1', id, 'CASHIER', 'Kasir', 'cashier-a@test.local' from public.gold_tenants where name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select tenant_id, '00000000-0000-0000-0000-0000000000c1', id from public.gold_stores where name = 'Pusat A';
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

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_suppliers (name) values ('PT Emas Jaya');
insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, labor_cost, margin_amount)
select c.id, p.id, 'Cincin Model A', 3, 0.1, 150000, 250000 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';

-- 2 pieces: cost 5.000.000 + labor 100.000 ; cost 4.800.000 + labor 100.000 -> total 10.000.000 ; pay 4.000.000 now
select set_config('test.po', (
  select purchase_id::text from public.gold_create_purchase(current_setting('test.store_a')::uuid, null,
    (select id from public.gold_suppliers limit 1), 'INV-SUP-001', current_date,
    jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.gold_products limit 1), 'gross_weight', 3.05, 'serial_number', 'S1', 'cost_price', 5000000, 'labor_cost', 100000),
      jsonb_build_object('product_id', (select id from public.gold_products limit 1), 'gross_weight', 2.95, 'cost_price', 4800000, 'labor_cost', 100000)),
    '[{"method":"BANK_TRANSFER","amount":4000000,"reference":"TRF-9"}]'::jsonb, 'stok baru')), true);

select pg_temp.assert((select total from public.gold_purchase_orders where id = current_setting('test.po')::uuid) = 10000000, 'purchase total');
select pg_temp.assert((select payment_status from public.gold_purchase_orders where id = current_setting('test.po')::uuid) = 'PARTIAL', 'partially paid');
select pg_temp.assert((select count(*) from public.gold_inventory where source = 'PURCHASE' and status = 'AVAILABLE') = 2, 'pieces created');
select pg_temp.assert((select cost_price from public.gold_inventory where serial_number = 'S1') = 5100000, 'piece cost = cost + supplier labor');
select pg_temp.assert((select labor_cost from public.gold_inventory where serial_number = 'S1') = 150000, 'selling labor from product');
select pg_temp.assert((select stone_weight from public.gold_inventory where serial_number = 'S1') = 0.1, 'stone weight from product');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'PURCHASE' and reference_id = current_setting('test.po')::uuid) = 2, 'PURCHASE movements');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'PURCHASE') = 1, 'PURCHASE audited');

-- pay the rest; overpayment rejected
do $$ begin
  perform public.gold_pay_purchase(current_setting('test.po')::uuid, '[{"method":"CASH","amount":7000000}]'::jsonb);
  raise exception 'ASSERTION FAILED: overpayment accepted';
exception when invalid_parameter_value then null; end $$;
select public.gold_pay_purchase(current_setting('test.po')::uuid, '[{"method":"CASH","amount":6000000}]'::jsonb);
select pg_temp.assert((select payment_status from public.gold_purchase_orders where id = current_setting('test.po')::uuid) = 'PAID', 'fully paid');

-- invalid inputs
do $$ begin
  perform public.gold_create_purchase(current_setting('test.store_a')::uuid, null, (select id from public.gold_suppliers limit 1), null,
    current_date + 1, jsonb_build_array(jsonb_build_object('product_id', (select id from public.gold_products limit 1), 'gross_weight', 1, 'cost_price', 1)), null);
  raise exception 'ASSERTION FAILED: future date accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_create_purchase(current_setting('test.store_a')::uuid, null, gen_random_uuid(), null,
    current_date, jsonb_build_array(jsonb_build_object('product_id', (select id from public.gold_products limit 1), 'gross_weight', 1, 'cost_price', 1)), null);
  raise exception 'ASSERTION FAILED: unknown supplier accepted';
exception when invalid_parameter_value then null; end $$;
reset role;

-- cashier cannot purchase
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  perform public.gold_create_purchase(current_setting('test.store_a')::uuid, null, (select id from public.gold_suppliers limit 1), null,
    current_date, jsonb_build_array(jsonb_build_object('product_id', (select id from public.gold_products limit 1), 'gross_weight', 1, 'cost_price', 1)), null);
  raise exception 'ASSERTION FAILED: cashier purchased';
exception when insufficient_privilege then null; end $$;
select pg_temp.assert((select count(*) from public.gold_purchase_orders) = 0, 'cashier cannot read purchases');
reset role;

-- void: blocked once a piece is sold; allowed otherwise
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('test.po2', (
  select purchase_id::text from public.gold_create_purchase(current_setting('test.store_a')::uuid, null,
    (select id from public.gold_suppliers limit 1), null, current_date,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.gold_products limit 1), 'gross_weight', 3, 'cost_price', 4000000)),
    '[{"method":"CASH","amount":4000000}]'::jsonb)), true);
select public.gold_void_purchase(current_setting('test.po2')::uuid, 'barang retur ke supplier');
select pg_temp.assert((select status from public.gold_purchase_orders where id = current_setting('test.po2')::uuid) = 'VOIDED', 'purchase voided');
select pg_temp.assert(
  (select i.status from public.gold_inventory i join public.gold_purchase_order_items pi on pi.inventory_id = i.id where pi.purchase_id = current_setting('test.po2')::uuid) = 'VOIDED',
  'piece voided');
select pg_temp.assert(
  (select sum(case direction when 'OUT' then amount else -amount end) from public.gold_payments where purchase_id = current_setting('test.po2')::uuid) = 0,
  'payment reversed');

insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1650000, 1762500 from public.gold_purities where code = '18K';
select * from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
  jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where serial_number = 'S1'))),
  jsonb_build_array(jsonb_build_object('method', 'CASH', 'amount', (select total from public.gold_quote_inventory((select id from public.gold_inventory where serial_number = 'S1'))))),
  (select total from public.gold_quote_inventory((select id from public.gold_inventory where serial_number = 'S1'))));
do $$ begin
  perform public.gold_void_purchase(current_setting('test.po')::uuid, 'x');
  raise exception 'ASSERTION FAILED: voided purchase with sold piece';
exception when invalid_parameter_value then null; end $$;
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_purchase_orders) = 0, 'owner B sees no tenant A purchases');
do $$ begin
  perform public.gold_pay_purchase(current_setting('test.po')::uuid, '[{"method":"CASH","amount":1}]'::jsonb);
  raise exception 'ASSERTION FAILED: owner B paid tenant A purchase';
exception when invalid_parameter_value then null; end $$;
reset role;

select 'ALL GOLD PURCHASE TESTS PASSED' as result;
rollback;
