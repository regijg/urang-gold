-- =============================================================================
-- Phase 7: trade-in = buyback + sale + settlement, atomic.
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
  (values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'CASHIER', 'Kasir', 'cashier-a@test.local'),
          ('00000000-0000-0000-0000-0000000000e1'::uuid, 'WAREHOUSE', 'Gudang', 'warehouse-a@test.local')) u (id, role, n, e)
where t.name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select s.tenant_id, u.id, s.id from public.gold_stores s, (values ('00000000-0000-0000-0000-0000000000c1'::uuid), ('00000000-0000-0000-0000-0000000000e1'::uuid)) u (id)
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

-- setup: 24K rate buy 2.000.000 / sell 2.400.000 ; new item 5 g 24K, labor 0 -> 12.000.000
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 2000000, 2400000 from public.gold_purities where code = '24K';
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Gelang 5g', 5 from public.gold_categories c, public.gold_purities p where c.code = 'GLG' and p.code = '24K';
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null, (select id from public.gold_products limit 1),
  '[{"gross_weight": 5}, {"gross_weight": 1}]'::jsonb);
insert into public.gold_customers (name, phone) values ('Rina', '082222222222');
reset role;

create or replace function pg_temp.old_items(p_weight numeric) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('name', 'Kalung lama', 'category_id', (select id from public.gold_categories where code = 'KLG'),
    'purity_id', (select id from public.gold_purities where code = '24K'), 'gross_weight', p_weight))
$$;
create or replace function pg_temp.new_items(p_barcode text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('inventory_id', (select id from public.gold_inventory where barcode = p_barcode)))
$$;

-- ---------- CASHIER: §18 example — old 2.6 g × 2.000.000 = 5.200.000, new 12.000.000 -> pays 6.800.000
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('test.ti1', (
  select trade_in_id::text from public.gold_create_trade_in(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    pg_temp.old_items(2.6), pg_temp.new_items('GOLD-000001'),
    '[{"method":"CASH","amount":7000000}]'::jsonb, 6800000)), true);

select pg_temp.assert((select trade_in_value from public.gold_trade_ins where id = current_setting('test.ti1')::uuid) = 5200000, 'trade-in value');
select pg_temp.assert((select sale_total from public.gold_trade_ins where id = current_setting('test.ti1')::uuid) = 12000000, 'sale total');
select pg_temp.assert((select balance from public.gold_trade_ins where id = current_setting('test.ti1')::uuid) = 6800000, 'customer pays 6.800.000');
select pg_temp.assert((select change_amount from public.gold_sales s join public.gold_trade_ins t on t.sale_id = s.id where t.id = current_setting('test.ti1')::uuid) = 200000, 'change 200.000');
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000001') = 'SOLD', 'new item sold');
select pg_temp.assert((select count(*) from public.gold_inventory where status = 'BUYBACK' and source = 'TRADE_IN') = 1, 'old item in stock as TRADE_IN');
-- sale payments: TRADE_IN 5.2M + CASH 7M in, 0.2M change out => net 12M
select pg_temp.assert(
  (select sum(case direction when 'IN' then amount else -amount end) from public.gold_payments p join public.gold_trade_ins t on t.sale_id = p.sale_id where t.id = current_setting('test.ti1')::uuid) = 12000000,
  'sale payments net = sale total');
-- buyback payments: TRADE_IN credit out = buyback total
select pg_temp.assert(
  (select sum(amount) from public.gold_payments p join public.gold_trade_ins t on t.buyback_id = p.buyback_id where t.id = current_setting('test.ti1')::uuid and p.method = 'TRADE_IN') = 5200000,
  'buyback settled by trade-in credit');
-- cash drawer effect = +6.800.000
select pg_temp.assert(
  (select sum(case direction when 'IN' then amount else -amount end) from public.gold_payments where method = 'CASH') = 6800000,
  'cash drawer +6.800.000');

-- store pays difference: old 1 g × 2.000.000 = 2.000.000 vs new 1 g × 2.400.000 = 2.400.000 -> customer pays 400.000
-- and reverse case: old 1.5 g (3.000.000) vs new 1 g (2.400.000) -> store pays 600.000 exactly
do $$ begin
  perform public.gold_create_trade_in(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    pg_temp.old_items(1.5), pg_temp.new_items('GOLD-000002'), '[{"method":"CASH","amount":500000}]'::jsonb, -600000);
  raise exception 'ASSERTION FAILED: wrong payout accepted';
exception when invalid_parameter_value then null; end $$;
select set_config('test.ti2', (
  select trade_in_id::text from public.gold_create_trade_in(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    pg_temp.old_items(1.5), pg_temp.new_items('GOLD-000002'), '[{"method":"CASH","amount":600000}]'::jsonb, -600000)), true);
select pg_temp.assert((select balance from public.gold_trade_ins where id = current_setting('test.ti2')::uuid) = -600000, 'store pays 600.000');
select pg_temp.assert(
  (select sum(case direction when 'IN' then amount else -amount end) from public.gold_payments where method = 'CASH') = 6200000,
  'cash drawer after payout');

-- atomicity: invalid new item -> nothing from the buyback side remains
select set_config('test.bb_before', (select count(*)::text from public.gold_buybacks), true);
do $$ begin
  perform public.gold_create_trade_in(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1),
    pg_temp.old_items(1), pg_temp.new_items('GOLD-000001'), '[]'::jsonb, 0);
  raise exception 'ASSERTION FAILED: sold item accepted';
exception when invalid_parameter_value then null; end $$;
select pg_temp.assert((select count(*)::text from public.gold_buybacks) = current_setting('test.bb_before'), 'buyback rolled back');

-- cashier cannot void
do $$ begin
  perform public.gold_void_trade_in(current_setting('test.ti1')::uuid, 'x');
  raise exception 'ASSERTION FAILED: cashier voided trade-in';
exception when insufficient_privilege then null; end $$;
reset role;

-- warehouse has no trade_ins.manage
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
do $$ begin
  perform public.gold_create_trade_in(current_setting('test.store_a')::uuid, (select id from public.gold_customers limit 1), '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 0);
  raise exception 'ASSERTION FAILED: warehouse did a trade-in';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER: void trade-in #1 ------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'TRADE_IN') = 2, 'TRADE_IN audited');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'TRADE_IN') = 2, 'TRADE_IN movements');
select public.gold_void_trade_in(current_setting('test.ti1')::uuid, 'batal');
select pg_temp.assert((select status from public.gold_trade_ins where id = current_setting('test.ti1')::uuid) = 'VOIDED', 'trade-in voided');
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000001') = 'AVAILABLE', 'new item back');
select pg_temp.assert((select s.status from public.gold_sales s join public.gold_trade_ins t on t.sale_id = s.id where t.id = current_setting('test.ti1')::uuid) = 'VOIDED', 'sale voided');
select pg_temp.assert((select b.status from public.gold_buybacks b join public.gold_trade_ins t on t.buyback_id = b.id where t.id = current_setting('test.ti1')::uuid) = 'VOIDED', 'buyback voided');
select pg_temp.assert(
  (select sum(case direction when 'IN' then amount else -amount end) from public.gold_payments where method = 'CASH') = -600000,
  'cash drawer after void = only the store payout of trade-in #2');
reset role;

-- receipt + isolation
select set_config('test.ti_token', (select public_token::text from public.gold_trade_ins where id = current_setting('test.ti2')::uuid), true);
set local role anon;
select pg_temp.assert((public.gold_get_trade_in_receipt(current_setting('test.ti_token')::uuid) ->> 'balance')::numeric = -600000, 'trade-in receipt');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_trade_ins) = 0, 'owner B sees no tenant A trade-ins');
reset role;

select 'ALL GOLD TRADE-IN TESTS PASSED' as result;
rollback;
