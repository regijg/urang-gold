-- =============================================================================
-- Phase 6: buyback calculation, integrity, reuse of sold pieces, void, RLS.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select '00000000-0000-0000-0000-0000000000c1', id, 'CASHIER', 'Kasir A', 'cashier-a@test.local' from public.gold_tenants where name = 'Toko A';
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

-- unit: §17 example — 3.21 g × 1.650.000 = 5.296.500; minus 100.000 = 5.196.500
select pg_temp.assert((select gross_amount from public.gold_buyback_line(3.21, 1650000, 100000)) = 5296500, 'buyback gross');
select pg_temp.assert((select net_amount from public.gold_buyback_line(3.21, 1650000, 100000)) = 5196500, 'buyback net');
select pg_temp.assert((select gross_amount from public.gold_buyback_line(0.333, 1650000, 0)) = 549450, 'rounded to rupiah');
do $$ begin
  perform * from public.gold_buyback_line(1, 1000, 2000);
  raise exception 'ASSERTION FAILED: deduction > gross';
exception when invalid_parameter_value then null; end $$;

-- ---------- OWNER A setup: rates, one product sold earlier ---------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_gold_rates (purity_id, buy_price, sell_price)
select id, 1650000, 1762500 from public.gold_purities where code = '18K';
insert into public.gold_gold_rates (purity_id, buy_price, sell_price)
select id, 2200000, 2350000 from public.gold_purities where code = '24K';
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Cincin Polos', 2 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null, (select id from public.gold_products limit 1), '[{"gross_weight": 2}]'::jsonb);
select * from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
  jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = 'GOLD-000001'))),
  '[{"method":"CASH","amount":3525000}]'::jsonb, 3525000);
insert into public.gold_customers (name, phone) values ('Budi', '081111111111');
reset role;

-- ---------- CASHIER A: buyback ---------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');

-- customer is mandatory
do $$ begin
  perform public.gold_create_buyback(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('name', 'Kalung', 'category_id', (select id from public.gold_categories where code = 'KLG'),
      'purity_id', (select id from public.gold_purities where code = '18K'), 'gross_weight', 3.21)),
    '[{"method":"CASH","amount":5296500}]'::jsonb, 5296500);
  raise exception 'ASSERTION FAILED: buyback without customer';
exception when invalid_parameter_value then null; end $$;

-- cashier cannot pay above the official buy price
do $$ begin
  perform public.gold_create_buyback(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    jsonb_build_array(jsonb_build_object('name', 'Kalung', 'category_id', (select id from public.gold_categories where code = 'KLG'),
      'purity_id', (select id from public.gold_purities where code = '18K'), 'gross_weight', 3.21, 'price_per_gram', 1700000)),
    '[{"method":"CASH","amount":5457000}]'::jsonb, 5457000);
  raise exception 'ASSERTION FAILED: cashier paid above buy rate';
exception when insufficient_privilege then null; end $$;

-- payout must equal total exactly
do $$ begin
  perform public.gold_create_buyback(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    jsonb_build_array(jsonb_build_object('name', 'Kalung', 'category_id', (select id from public.gold_categories where code = 'KLG'),
      'purity_id', (select id from public.gold_purities where code = '18K'), 'gross_weight', 3.21, 'deduction', 100000)),
    '[{"method":"CASH","amount":6000000}]'::jsonb, 5196500);
  raise exception 'ASSERTION FAILED: payout mismatch accepted';
exception when invalid_parameter_value then null; end $$;

-- valid: new piece (18K, deduction) + own sold piece taken back (GOLD-000001)
select set_config('test.bb1', (
  select buyback_id::text from public.gold_create_buyback(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    jsonb_build_array(
      jsonb_build_object('name', 'Kalung Rantai', 'category_id', (select id from public.gold_categories where code = 'KLG'),
        'purity_id', (select id from public.gold_purities where code = '18K'), 'gross_weight', 3.21, 'deduction', 100000),
      jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = 'GOLD-000001'))),
    '[{"method":"CASH","amount":5000000},{"method":"BANK_TRANSFER","amount":3496500,"reference":"TRF-1"}]'::jsonb,
    8496500, 'uji buyback')), true);
-- second line: 2 g × 1.650.000 = 3.300.000 ; total = 5.196.500 + 3.300.000 = 8.496.500

select pg_temp.assert((select total from public.gold_buybacks where id = current_setting('test.bb1')::uuid) = 8496500, 'buyback total');
select pg_temp.assert((select buyback_number from public.gold_buybacks where id = current_setting('test.bb1')::uuid) like 'BB-%-000001', 'buyback number');
select pg_temp.assert((select count(*) from public.gold_inventory where status = 'BUYBACK') = 2, 'pieces in BUYBACK');
select pg_temp.assert((select cost_price from public.gold_inventory where name = 'Kalung Rantai') = 5196500, 'cost = net paid');
select pg_temp.assert((select source from public.gold_inventory where barcode = 'GOLD-000001') = 'BUYBACK', 'reused piece source');
select pg_temp.assert((select reused_piece from public.gold_buyback_items where inventory_id = (select id from public.gold_inventory where barcode = 'GOLD-000001')), 'reuse flagged');
select pg_temp.assert((select count(*) from public.gold_inventory) = 2, 'no duplicate piece for reused item');
select pg_temp.assert((select sum(amount) from public.gold_payments where buyback_id = current_setting('test.bb1')::uuid and direction = 'OUT') = 8496500, 'payout recorded');

-- cannot take back a piece that is not SOLD
do $$ begin
  perform public.gold_create_buyback(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = 'GOLD-000001'))),
    '[{"method":"CASH","amount":3300000}]'::jsonb, 3300000);
  raise exception 'ASSERTION FAILED: reused a non-sold piece';
exception when invalid_parameter_value then null; end $$;

-- cashier cannot void
do $$ begin
  perform public.gold_void_buyback(current_setting('test.bb1')::uuid, 'x');
  raise exception 'ASSERTION FAILED: cashier voided buyback';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER A: price above rate allowed, void ------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'BUYBACK') = 2, 'BUYBACK movements');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'BUYBACK') = 1, 'BUYBACK audited');
select * from public.gold_create_buyback(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
  jsonb_build_array(jsonb_build_object('name', 'LM 1g', 'category_id', (select id from public.gold_categories where code = 'LM'),
    'purity_id', (select id from public.gold_purities where code = '24K'), 'gross_weight', 1, 'price_per_gram', 2250000)),
  '[{"method":"CASH","amount":2250000}]'::jsonb, 2250000);

-- processed piece blocks void; untouched buyback can be voided
select public.gold_void_buyback(current_setting('test.bb1')::uuid, 'salah timbang');
select pg_temp.assert((select status from public.gold_buybacks where id = current_setting('test.bb1')::uuid) = 'VOIDED', 'buyback voided');
select pg_temp.assert((select status from public.gold_inventory where name = 'Kalung Rantai') = 'VOIDED', 'new piece -> VOIDED');
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000001') = 'SOLD', 'reused piece -> SOLD again');
select pg_temp.assert(
  (select sum(case direction when 'OUT' then amount else -amount end) from public.gold_payments where buyback_id = current_setting('test.bb1')::uuid) = 0,
  'payout reversed');

select public.gold_inventory_change_status((select id from public.gold_inventory where name = 'LM 1g'), 'AVAILABLE', null, 'siap jual');
do $$ begin
  perform public.gold_void_buyback((select buyback_id from public.gold_buyback_items where name = 'LM 1g'), 'x');
  raise exception 'ASSERTION FAILED: voided buyback with processed piece';
exception when invalid_parameter_value then null; end $$;
reset role;

-- ---------- receipt + isolation ----------------------------------------------------
select set_config('test.bb_token', (select public_token::text from public.gold_buybacks where id = current_setting('test.bb1')::uuid), true);
set local role anon;
select pg_temp.assert((public.gold_get_buyback_receipt(current_setting('test.bb_token')::uuid) ->> 'total')::numeric = 8496500, 'buyback receipt');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_buybacks) = 0, 'owner B sees no tenant A buybacks');
select pg_temp.assert((select count(*) from public.gold_buyback_items) = 0, 'owner B sees no tenant A buyback items');
reset role;

select 'ALL GOLD BUYBACK TESTS PASSED' as result;
rollback;
