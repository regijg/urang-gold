-- =============================================================================
-- Phase 9: stock opname — snapshot, scan, differences, approval, adjustments.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'warehouse-a@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select u.id, t.id, u.role, u.n, u.e from public.gold_tenants t,
  (values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'WAREHOUSE', 'Gudang', 'warehouse-a@test.local'),
          ('00000000-0000-0000-0000-0000000000c1'::uuid, 'CASHIER', 'Kasir', 'cashier-a@test.local')) u (id, role, n, e)
where t.name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select s.tenant_id, u.id, s.id from public.gold_stores s, (values ('00000000-0000-0000-0000-0000000000e1'::uuid), ('00000000-0000-0000-0000-0000000000c1'::uuid)) u (id)
where s.name = 'Pusat A';
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

-- setup: 5 pieces, 18K buy 1.650.000; GOLD-000005 is LOST already
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1650000, 1762500 from public.gold_purities where code = '18K';
insert into public.gold_products (category_id, purity_id, name, gross_weight) select c.id, p.id, 'Cincin', 2 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null, (select id from public.gold_products limit 1),
  '[{"gross_weight":2.000},{"gross_weight":3.000},{"gross_weight":4.000},{"gross_weight":5.000},{"gross_weight":1.000}]'::jsonb);
select public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000005'), 'LOST', null, 'hilang lama');
reset role;

-- ---------- WAREHOUSE counts --------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select set_config('test.so', public.gold_start_stock_opname(current_setting('test.store_a')::uuid, null, 'opname bulanan')::text, true);
select pg_temp.assert((select system_count from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = 4, 'snapshot 4 on-hand pieces');
select pg_temp.assert((select system_weight from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = 14.000, 'system weight 14 g');
do $$ begin
  perform public.gold_start_stock_opname(current_setting('test.store_a')::uuid);
  raise exception 'ASSERTION FAILED: second open opname';
exception when invalid_parameter_value then null; end $$;

-- 1: match ; 2: weighed 2.95 (−0.05) ; 3: not found ; 4: match ; 5 (LOST) found again
select * from public.gold_opname_scan(current_setting('test.so')::uuid, 'gold-000001');
select * from public.gold_opname_scan(current_setting('test.so')::uuid, 'GOLD-000002', 2.950);
select * from public.gold_opname_scan(current_setting('test.so')::uuid, 'GOLD-000004');
select * from public.gold_opname_scan(current_setting('test.so')::uuid, 'GOLD-000005', 1.000);
do $$ begin
  perform public.gold_opname_scan(current_setting('test.so')::uuid, 'GOLD-999999');
  raise exception 'ASSERTION FAILED: unknown barcode accepted';
exception when invalid_parameter_value then null; end $$;
-- scanning a piece of an item sold during counting is tolerated; approval skips changed pieces
select public.gold_submit_stock_opname(current_setting('test.so')::uuid);
select pg_temp.assert((select physical_count from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = 3, 'physical count 3');
select pg_temp.assert((select physical_weight from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = 9.950, 'physical weight 9.95');
select pg_temp.assert((select diff_count from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = -1, 'diff -1 item');
select pg_temp.assert((select diff_weight from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = -4.050, 'diff -4.05 g');
-- value: (−0.05 − 4.00) × 1.650.000 = −6.682.500
select pg_temp.assert((select estimated_value from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = -6682500, 'estimated value');
select pg_temp.assert((select result from public.gold_stock_opname_items oi join public.gold_inventory i on i.id = oi.inventory_id where i.barcode = 'GOLD-000005') = 'UNEXPECTED', 'lost piece flagged');

-- warehouse cannot approve; cannot scan after submit
do $$ begin
  perform public.gold_approve_stock_opname(current_setting('test.so')::uuid);
  raise exception 'ASSERTION FAILED: warehouse approved';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.gold_opname_scan(current_setting('test.so')::uuid, 'GOLD-000003');
  raise exception 'ASSERTION FAILED: scan after submit';
exception when invalid_parameter_value then null; end $$;
reset role;

-- cashier cannot start opname
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  perform public.gold_start_stock_opname(current_setting('test.store_a')::uuid);
  raise exception 'ASSERTION FAILED: cashier started opname';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER approves --------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
-- sell GOLD-000004 while the opname awaits approval -> must be skipped (it matched anyway)
select pg_temp.assert(public.gold_approve_stock_opname(current_setting('test.so')::uuid, 'ok') = 3, '3 adjustments');
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000003') = 'LOST', 'missing -> LOST');
select pg_temp.assert((select gross_weight from public.gold_inventory where barcode = 'GOLD-000002') = 2.950, 'weight corrected');
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000005') = 'AVAILABLE', 'found lost piece -> AVAILABLE');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'STOCK_OPNAME') = 3, 'STOCK_OPNAME movements');
select pg_temp.assert((select status from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = 'APPROVED', 'approved');
select pg_temp.assert((select approved_by from public.gold_stock_opnames where id = current_setting('test.so')::uuid) = auth.uid(), 'approver recorded');

-- second opname: a piece sold before approval is skipped; reject/cancel flow
select set_config('test.so2', public.gold_start_stock_opname(current_setting('test.store_a')::uuid)::text, true);
select * from public.gold_opname_scan(current_setting('test.so2')::uuid, 'GOLD-000001', 2.100);
select public.gold_submit_stock_opname(current_setting('test.so2')::uuid);
select public.gold_review_stock_opname(current_setting('test.so2')::uuid, 'REJECT', 'hitung ulang');
select pg_temp.assert((select status from public.gold_stock_opnames where id = current_setting('test.so2')::uuid) = 'OPEN', 'rejected back to OPEN');
select public.gold_submit_stock_opname(current_setting('test.so2')::uuid);
select * from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
  jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = 'GOLD-000001'))),
  jsonb_build_array(jsonb_build_object('method', 'CASH', 'amount', (select total from public.gold_quote_inventory((select id from public.gold_inventory where barcode = 'GOLD-000001'))))),
  (select total from public.gold_quote_inventory((select id from public.gold_inventory where barcode = 'GOLD-000001'))));
select public.gold_approve_stock_opname(current_setting('test.so2')::uuid);
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000001') = 'SOLD', 'sold piece not touched by opname');
select pg_temp.assert(
  (select result from public.gold_stock_opname_items oi join public.gold_inventory i on i.id = oi.inventory_id
   where oi.opname_id = current_setting('test.so2')::uuid and i.barcode = 'GOLD-000001') = 'SKIPPED', 'changed piece skipped');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_stock_opnames) = 0, 'owner B sees no tenant A opnames');
do $$ begin
  perform public.gold_approve_stock_opname(current_setting('test.so')::uuid);
  raise exception 'ASSERTION FAILED: owner B approved tenant A opname';
exception when invalid_parameter_value then null; end $$;
reset role;

select 'ALL GOLD STOCK OPNAME TESTS PASSED' as result;
rollback;
