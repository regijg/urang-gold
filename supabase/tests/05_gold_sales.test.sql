-- =============================================================================
-- Phase 5: sale integrity (atomic), payments, void, e-nota, RLS.
-- Rolled back at the end.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'warehouse-a@test.local');

select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select u.id, t.id, u.role, u.n, u.e from public.gold_tenants t,
  (values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'CASHIER', 'Kasir A', 'cashier-a@test.local'),
          ('00000000-0000-0000-0000-0000000000e1'::uuid, 'WAREHOUSE', 'Gudang A', 'warehouse-a@test.local')) u (id, role, n, e)
where t.name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select s.tenant_id, u.id, s.id from public.gold_stores s, (values ('00000000-0000-0000-0000-0000000000c1'::uuid), ('00000000-0000-0000-0000-0000000000e1'::uuid)) u (id)
where s.name = 'Pusat A';
select set_config('test.store_a', (select id::text from public.gold_stores where name = 'Pusat A'), true);
select set_config('test.store_b', (select id::text from public.gold_stores where name = 'Pusat B'), true);

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
create or replace function pg_temp.piece(p_barcode text) returns uuid language sql as $$
  select id from public.gold_inventory where barcode = p_barcode
$$;

-- ---------- OWNER A: stock + rates ---------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, cost_price, labor_cost, stone_price, margin_amount)
select c.id, p.id, 'Cincin Berlian', 3.310, 0.100, 5000000, 150000, 500000, 250000
from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1650000, 1762500 from public.gold_purities where code = '18K';
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null,
  (select id from public.gold_products limit 1),
  '[{"gross_weight":3.31},{"gross_weight":3.31},{"gross_weight":3.31},{"gross_weight":3.31}]'::jsonb);
insert into public.gold_customers (name, phone) values ('Siti', '081234567890');
reset role;

-- each piece: 3.21 g × 1.762.500 = 5.657.625 + 150.000 + 500.000 + 250.000 = 6.557.625

-- ---------- CASHIER A sells -----------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');

-- wrong expected total -> PRICE_CHANGED, nothing persisted
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000001'))),
    '[{"method":"CASH","amount":7000000}]'::jsonb, 6000000);
  raise exception 'ASSERTION FAILED: stale total accepted';
exception when invalid_parameter_value then
  if sqlerrm not like 'PRICE_CHANGED:6557625%' then raise; end if;
end $$;
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000001') = 'AVAILABLE', 'rolled back: still available');
select pg_temp.assert((select count(*) from public.gold_sales) = 0, 'rolled back: no sale');

-- sale 1: two pieces, discount 250.000 on the first, split payment + cash change
select set_config('test.sale1', (
  select sale_id::text from public.gold_create_sale(current_setting('test.store_a')::uuid,
    (select id from public.gold_customers where phone = '081234567890'),
    jsonb_build_array(
      jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000001'), 'discount', 250000),
      jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000002'))),
    '[{"method":"QRIS","amount":10000000,"reference":"QR-123"},{"method":"CASH","amount":3000000}]'::jsonb,
    12865250, 'uji')), true);

select pg_temp.assert((select total from public.gold_sales where id = current_setting('test.sale1')::uuid) = 12865250, 'total = 2 × 6.557.625 − 250.000');
select pg_temp.assert((select change_amount from public.gold_sales where id = current_setting('test.sale1')::uuid) = 134750, 'change');
select pg_temp.assert((select invoice_number from public.gold_sales where id = current_setting('test.sale1')::uuid)
  = 'INV-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-000001', 'invoice number format');
select pg_temp.assert((select count(*) from public.gold_sale_items where sale_id = current_setting('test.sale1')::uuid) = 2, '2 sale items');
select pg_temp.assert((select price from public.gold_sale_items where barcode = 'GOLD-000001') = 6307625, 'line price after discount');
select pg_temp.assert((select cost_price from public.gold_sale_items where barcode = 'GOLD-000001') = 5000000, 'cost snapshot');
select pg_temp.assert((select sell_rate from public.gold_sale_items where barcode = 'GOLD-000001') = 1762500, 'rate snapshot');
select pg_temp.assert((select count(*) from public.gold_inventory where status = 'SOLD') = 2, 'pieces SOLD');
select pg_temp.assert(
  (select sum(case direction when 'IN' then amount else -amount end) from public.gold_payments where sale_id = current_setting('test.sale1')::uuid) = 12865250,
  'payments net = total (change recorded as OUT)');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'SALE') = 0, 'cashier cannot read audit log');
select pg_temp.assert((select count(*) from public.gold_inventory_movements) = 0, 'cashier cannot read movements');
select pg_temp.assert((select count(*) from public.gold_sales) = 1, 'cashier can read sales');

-- cannot sell the same piece twice
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000001'))), '[{"method":"CASH","amount":6557625}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: sold piece sold again';
exception when invalid_parameter_value then
  if sqlerrm not like 'ITEM_NOT_AVAILABLE%' then raise; end if;
end $$;

-- duplicate piece in one cart
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003')), jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))),
    '[{"method":"CASH","amount":13115250}]'::jsonb, 13115250);
  raise exception 'ASSERTION FAILED: duplicate piece accepted';
exception when invalid_parameter_value then null; end $$;

-- insufficient payment
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))), '[{"method":"CASH","amount":1000}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: underpayment accepted';
exception when invalid_parameter_value then null; end $$;

-- non-cash overpayment (change cannot come from QRIS)
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))), '[{"method":"QRIS","amount":7000000}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: non-cash overpayment accepted';
exception when invalid_parameter_value then null; end $$;

-- invalid method / fractional amount / discount > price
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))), '[{"method":"BITCOIN","amount":6557625}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: bad method accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'), 'discount', 99999999)), '[{"method":"CASH","amount":1}]'::jsonb, 0);
  raise exception 'ASSERTION FAILED: discount > price accepted';
exception when invalid_parameter_value then null; end $$;

-- sell into tenant B store / with a tenant B customer
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_b')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))), '[{"method":"CASH","amount":6557625}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: sale in tenant B store';
exception when insufficient_privilege then null; end $$;

-- cashier cannot void
do $$ begin
  perform public.gold_void_sale(current_setting('test.sale1')::uuid, 'salah input');
  raise exception 'ASSERTION FAILED: cashier voided sale';
exception when insufficient_privilege then null; end $$;

-- direct writes impossible
do $$ begin
  update public.gold_sales set total = 1;
  raise exception 'ASSERTION FAILED: client updated sale';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.gold_payments (tenant_id, store_id, direction, method, amount)
  values (public.gold_current_tenant_id(), current_setting('test.store_a')::uuid, 'IN', 'CASH', 1);
  raise exception 'ASSERTION FAILED: client inserted payment';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- WAREHOUSE cannot sell ----------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))), '[{"method":"CASH","amount":6557625}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: warehouse sold';
exception when insufficient_privilege then null; end $$;
select pg_temp.assert((select count(*) from public.gold_sales) = 0, 'warehouse cannot read sales');
reset role;

-- ---------- OWNER A voids -------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'SALE') = 1, 'SALE audited');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'SALE' and quantity = -1) = 2, 'SALE movements');

do $$ begin
  perform public.gold_void_sale(current_setting('test.sale1')::uuid, '  ');
  raise exception 'ASSERTION FAILED: void without reason';
exception when invalid_parameter_value then null; end $$;

select public.gold_void_sale(current_setting('test.sale1')::uuid, 'salah input');
select pg_temp.assert((select status from public.gold_sales where id = current_setting('test.sale1')::uuid) = 'VOIDED', 'sale voided');
select pg_temp.assert((select count(*) from public.gold_inventory where status = 'AVAILABLE') = 4, 'pieces back to AVAILABLE');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'RETURN') = 2, 'RETURN movements');
select pg_temp.assert(
  (select sum(case direction when 'IN' then amount else -amount end) from public.gold_payments where sale_id = current_setting('test.sale1')::uuid) = 0,
  'payments net zero after void');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'REFUND') = 1, 'REFUND audited');
do $$ begin
  perform public.gold_void_sale(current_setting('test.sale1')::uuid, 'lagi');
  raise exception 'ASSERTION FAILED: double void';
exception when invalid_parameter_value then null; end $$;

-- a voided piece can be sold again; invoice counter continues
select pg_temp.assert(
  (select invoice_number from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
     jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000001'))), '[{"method":"CASH","amount":6557625}]'::jsonb, 6557625))
  like '%-000002', 'second invoice number');
reset role;

-- ---------- e-nota by token (anon) ----------------------------------------------
select set_config('test.token', (select public_token::text from public.gold_sales where id = current_setting('test.sale1')::uuid), true);
set local role anon;
select pg_temp.assert((public.gold_get_receipt(current_setting('test.token')::uuid) ->> 'total')::numeric = 12865250, 'receipt by token');
select pg_temp.assert(jsonb_array_length(public.gold_get_receipt(current_setting('test.token')::uuid) -> 'items') = 2, 'receipt items');
select pg_temp.assert(jsonb_array_length(public.gold_get_receipt(current_setting('test.token')::uuid) -> 'payments') = 2, 'receipt shows only original IN payments');
select pg_temp.assert(public.gold_get_receipt(gen_random_uuid()) is null, 'unknown token -> null');
do $$ begin
  perform 1 from public.gold_sales;
  raise exception 'ASSERTION FAILED: anon read sales';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER B isolation ---------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_sales) = 0, 'owner B sees no tenant A sales');
select pg_temp.assert((select count(*) from public.gold_sale_items) = 0, 'owner B sees no tenant A sale items');
select pg_temp.assert((select count(*) from public.gold_payments) = 0, 'owner B sees no tenant A payments');
do $$ begin
  perform public.gold_void_sale(current_setting('test.sale1')::uuid, 'x');
  raise exception 'ASSERTION FAILED: owner B voided tenant A sale';
exception when invalid_parameter_value then null; end $$;
reset role;

select 'ALL GOLD SALES TESTS PASSED' as result;
rollback;
