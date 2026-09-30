-- =============================================================================
-- Operations: cash sessions, expenses, orders (DP), repairs, buyback resale,
-- labor per gram, operations report, tenant isolation.
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
create or replace function pg_temp.piece(p_barcode text) returns uuid language sql as $$
  select id from public.gold_inventory where barcode = p_barcode
$$;

-- default permissions
select pg_temp.assert((select 'cash.manage' = any (permissions) and 'orders.manage' = any (permissions) and 'repairs.manage' = any (permissions)
                         and not ('expenses.manage' = any (permissions)) from public.gold_roles where code = 'CASHIER'), 'cashier defaults');
select pg_temp.assert((select permissions @> array['cash.manage', 'expenses.manage', 'orders.manage', 'repairs.manage'] from public.gold_roles where code = 'OWNER'), 'owner has all new permissions');

-- ---------- OWNER A: stock, rates, customer ------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, cost_price, labor_cost, stone_price, margin_amount)
select c.id, p.id, 'Cincin Berlian', 3.310, 0.100, 5000000, 150000, 500000, 250000
from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1650000, 1762500 from public.gold_purities where code = '18K';
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null,
  (select id from public.gold_products where name = 'Cincin Berlian'),
  '[{"gross_weight":3.31},{"gross_weight":3.31},{"gross_weight":3.31},{"gross_weight":3.31}]'::jsonb);
insert into public.gold_customers (name, phone) values ('Siti', '081234567890');
select set_config('test.cust', (select id::text from public.gold_customers where name = 'Siti'), true);
-- each piece: 3.21 g × 1.762.500 = 5.657.625 + 150.000 + 500.000 + 250.000 = 6.557.625

-- ---------- labor per gram ------------------------------------------------------
insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, labor_cost, labor_per_gram)
select c.id, p.id, 'Kalung Per Gram', 5, 0, 0, 50000 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
select pg_temp.assert((select labor_cost from public.gold_products where name = 'Kalung Per Gram') = 250000, 'product labor = 50.000 × 5 g');
select * from public.gold_inventory_receive(current_setting('test.store_a')::uuid, null,
  (select id from public.gold_products where name = 'Kalung Per Gram'), '[{"gross_weight":4}]'::jsonb);
select pg_temp.assert((select labor_cost from public.gold_inventory where barcode = 'GOLD-000005') = 200000, 'piece labor = 50.000 × 4 g');
select pg_temp.assert((select labor_per_gram from public.gold_inventory where barcode = 'GOLD-000005') = 50000, 'piece inherits per-gram labor');
update public.gold_products set labor_per_gram = 60000 where name = 'Kalung Per Gram';
select pg_temp.assert((select labor_cost from public.gold_products where name = 'Kalung Per Gram') = 300000, 'product labor recomputed on update');
reset role;
update public.gold_inventory set gross_weight = 4.5 where barcode = 'GOLD-000005';
select pg_temp.assert((select labor_cost from public.gold_inventory where barcode = 'GOLD-000005') = 225000, 'piece labor follows weight change');

-- ---------- cash session --------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('test.kas', public.gold_open_cash_session(current_setting('test.store_a')::uuid, 1000000, 'modal pagi')::text, true);
do $$ begin
  perform public.gold_open_cash_session(current_setting('test.store_a')::uuid, 0);
  raise exception 'ASSERTION FAILED: second open drawer accepted';
exception when invalid_parameter_value then null; end $$;

-- cash sale 6.557.625 paid with 7.000.000 -> change 442.375
select * from public.gold_create_sale(current_setting('test.store_a')::uuid, null,
  jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000001'))),
  '[{"method":"CASH","amount":7000000}]'::jsonb, 6557625);
select public.gold_add_cash_movement(current_setting('test.kas')::uuid, 'OUT', 500000, 'Setor ke bank');
do $$ begin
  perform public.gold_add_cash_movement(current_setting('test.kas')::uuid, 'OUT', 1, ' ');
  raise exception 'ASSERTION FAILED: movement without reason accepted';
exception when invalid_parameter_value then null; end $$;

-- cashier cannot record expenses (no expenses.manage)
do $$ begin
  perform public.gold_create_expense(current_setting('test.store_a')::uuid, current_date, 'GAJI', 'x', 1000, 'CASH');
  raise exception 'ASSERTION FAILED: cashier created an expense';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- expenses (owner) ----------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('test.exp1', public.gold_create_expense(current_setting('test.store_a')::uuid, current_date, 'LISTRIK_AIR', 'Token listrik', 100000, 'CASH')::text, true);
select set_config('test.exp2', public.gold_create_expense(current_setting('test.store_a')::uuid, current_date, 'KONSUMSI', 'Air minum', 50000, 'CASH')::text, true);
do $$ begin
  perform public.gold_create_expense(current_setting('test.store_a')::uuid, current_date + 1, 'GAJI', 'x', 1000, 'CASH');
  raise exception 'ASSERTION FAILED: future expense accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_create_expense(current_setting('test.store_a')::uuid, current_date, 'JUDI', 'x', 1000, 'CASH');
  raise exception 'ASSERTION FAILED: unknown category accepted';
exception when check_violation then null; end $$;
select public.gold_void_expense(current_setting('test.exp2')::uuid, 'salah input');
select pg_temp.assert((select status from public.gold_expenses where id = current_setting('test.exp2')::uuid) = 'VOIDED', 'expense voided');
select pg_temp.assert((select count(*) from public.gold_payments where expense_id = current_setting('test.exp2')::uuid and is_reversal and direction = 'IN') = 1, 'void reverses the payment');
do $$ begin
  perform public.gold_void_expense(current_setting('test.exp2')::uuid, 'lagi');
  raise exception 'ASSERTION FAILED: double void';
exception when invalid_parameter_value then null; end $$;
reset role;

-- drawer: 1.000.000 + 7.000.000 − 442.375 − 100.000 − 50.000 + 50.000 (void) − 500.000 = 6.957.625
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert((public.gold_cash_session_summary(current_setting('test.kas')::uuid) ->> 'expected')::numeric = 6957625, 'expected drawer');
select pg_temp.assert((public.gold_cash_session_summary(current_setting('test.kas')::uuid) -> 'sources' -> 'SALE' ->> 'out')::numeric = 442375, 'change counted as cash out');
do $$ begin
  perform public.gold_close_cash_session(current_setting('test.kas')::uuid, 6950000, null);
  raise exception 'ASSERTION FAILED: difference without notes accepted';
exception when invalid_parameter_value then null; end $$;
select public.gold_close_cash_session(current_setting('test.kas')::uuid, 6950000, 'kurang 7.625, dicek besok');
select pg_temp.assert((select difference from public.gold_cash_sessions where id = current_setting('test.kas')::uuid) = -7625, 'difference stored');
do $$ begin
  perform public.gold_add_cash_movement(current_setting('test.kas')::uuid, 'IN', 1000, 'telat');
  raise exception 'ASSERTION FAILED: movement on closed drawer';
exception when invalid_parameter_value then null; end $$;

-- ---------- orders (cashier) ----------------------------------------------------
-- GOLD-000002: 6.557.625 − 57.625 discount = 6.500.000 ; DP 1.000.000
do $$ begin
  perform public.gold_create_order(current_setting('test.store_a')::uuid, current_setting('test.cust')::uuid,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000002'), 'discount', 57625)),
    '[{"method":"CASH","amount":1000000}]'::jsonb, 6400000);
  raise exception 'ASSERTION FAILED: wrong expected total accepted';
exception when invalid_parameter_value then null; end $$;
select set_config('test.ord', (select order_id::text from public.gold_create_order(current_setting('test.store_a')::uuid, current_setting('test.cust')::uuid,
  jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000002'), 'discount', 57625)),
  '[{"method":"CASH","amount":1000000}]'::jsonb, 6500000, current_date + 7, 'ambil minggu depan')), true);
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000002') = 'RESERVED', 'ordered piece reserved');
select pg_temp.assert((select total from public.gold_orders where id = current_setting('test.ord')::uuid) = 6500000, 'order total locked');
do $$ begin
  perform public.gold_create_sale(current_setting('test.store_a')::uuid, null,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000002'))), '[{"method":"CASH","amount":7000000}]'::jsonb, 6557625);
  raise exception 'ASSERTION FAILED: reserved piece sold at the till';
exception when invalid_parameter_value then null; end $$;
select public.gold_pay_order(current_setting('test.ord')::uuid, '[{"method":"BANK_TRANSFER","amount":2000000}]'::jsonb);
do $$ begin
  perform public.gold_pay_order(current_setting('test.ord')::uuid, '[{"method":"CASH","amount":4000000}]'::jsonb);
  raise exception 'ASSERTION FAILED: order overpayment accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_complete_order(current_setting('test.ord')::uuid, null);
  raise exception 'ASSERTION FAILED: completed without full payment';
exception when invalid_parameter_value then null; end $$;
reset role;

-- gold price goes up: the order keeps its locked price
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1700000, 1800000 from public.gold_purities where code = '18K';
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('test.ord_sale', (select sale_id::text from public.gold_complete_order(current_setting('test.ord')::uuid, '[{"method":"CASH","amount":3500000}]'::jsonb)), true);
select pg_temp.assert((select total from public.gold_sales where id = current_setting('test.ord_sale')::uuid) = 6500000, 'sale at locked price');
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000002') = 'SOLD', 'piece sold on pick-up');
select pg_temp.assert((select count(*) from public.gold_payments where sale_id = current_setting('test.ord_sale')::uuid) = 3, 'order payments attached to the sale');
select pg_temp.assert((select status from public.gold_orders where id = current_setting('test.ord')::uuid) = 'COMPLETED', 'order completed');
select pg_temp.assert((select count(*) from public.gold_sale_items where sale_id = current_setting('test.ord_sale')::uuid and price = 6500000) = 1, 'sale item snapshot');

-- cancelled order: DP 1.000.000, refund 400.000, forfeit 600.000
select set_config('test.ord2', (select order_id::text from public.gold_create_order(current_setting('test.store_a')::uuid, current_setting('test.cust')::uuid,
  jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))),
  '[{"method":"CASH","amount":1000000}]'::jsonb,
  (select round(3.21 * 1800000, 0) + 150000 + 500000 + 250000))), true);
do $$ begin
  perform public.gold_cancel_order(current_setting('test.ord2')::uuid, 'batal', '[{"method":"CASH","amount":1500000}]'::jsonb);
  raise exception 'ASSERTION FAILED: refund above DP accepted';
exception when invalid_parameter_value then null; end $$;
select public.gold_cancel_order(current_setting('test.ord2')::uuid, 'customer batal', '[{"method":"CASH","amount":400000}]'::jsonb);
select pg_temp.assert((select status from public.gold_inventory where barcode = 'GOLD-000003') = 'AVAILABLE', 'cancelled order releases piece');

-- ---------- repairs -------------------------------------------------------------
select set_config('test.srv', (select repair_id::text from public.gold_create_repair(current_setting('test.store_a')::uuid, current_setting('test.cust')::uuid,
  'Cincin emas putih', 'Patri + cuci', 2.5, 100000, current_date + 3, '[{"method":"CASH","amount":50000}]'::jsonb)), true);
select public.gold_update_repair_status(current_setting('test.srv')::uuid, 'READY', 120000);
do $$ begin
  perform public.gold_update_repair_status(current_setting('test.srv')::uuid, 'PICKED_UP');
  raise exception 'ASSERTION FAILED: pick-up via status change';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_pickup_repair(current_setting('test.srv')::uuid, 120000, '[{"method":"CASH","amount":60000}]'::jsonb);
  raise exception 'ASSERTION FAILED: underpaid pick-up accepted';
exception when invalid_parameter_value then null; end $$;
select public.gold_pickup_repair(current_setting('test.srv')::uuid, 120000, '[{"method":"CASH","amount":70000}]'::jsonb);
select pg_temp.assert((select status from public.gold_repairs where id = current_setting('test.srv')::uuid) = 'PICKED_UP', 'repair picked up');
reset role;

-- ---------- buyback resale ------------------------------------------------------
update public.gold_inventory set status = 'BUYBACK', labor_cost = 0, stone_price = 0, margin_amount = 0 where barcode = 'GOLD-000004';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.gold_buyback_resell(pg_temp.piece('GOLD-000004'), null, 100000, 0, 300000, null);
select pg_temp.assert((select status = 'AVAILABLE' and margin_amount = 300000 and labor_cost = 100000 from public.gold_inventory where barcode = 'GOLD-000004'), 'buyback piece back on display');
do $$ begin
  perform public.gold_buyback_resell(pg_temp.piece('GOLD-000004'), null, 0, 0, 0, null);
  raise exception 'ASSERTION FAILED: resell of an available piece';
exception when invalid_parameter_value then null; end $$;

-- ---------- report --------------------------------------------------------------
select pg_temp.assert((select expense_total from public.gold_report_operations(now() - interval '1 day', now() + interval '1 day')) = 100000, 'voided expense excluded');
select pg_temp.assert((select repair_income from public.gold_report_operations(now() - interval '1 day', now() + interval '1 day')) = 120000, 'repair income');
select pg_temp.assert((select order_forfeit from public.gold_report_operations(now() - interval '1 day', now() + interval '1 day')) = 600000, 'forfeited DP');
select pg_temp.assert((select total from public.gold_report_expenses(now() - interval '1 day', now() + interval '1 day') where category = 'LISTRIK_AIR') = 100000, 'expense by category');
reset role;

-- ---------- tenant isolation ----------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_cash_sessions) = 0, 'B cannot read A drawers');
select pg_temp.assert((select count(*) from public.gold_expenses) = 0, 'B cannot read A expenses');
select pg_temp.assert((select count(*) from public.gold_orders) = 0, 'B cannot read A orders');
select pg_temp.assert((select count(*) from public.gold_order_items) = 0, 'B cannot read A order items');
select pg_temp.assert((select count(*) from public.gold_repairs) = 0, 'B cannot read A repairs');
select pg_temp.assert((select count(*) from public.gold_cash_movements) = 0, 'B cannot read A cash movements');
do $$ begin
  perform public.gold_cash_session_summary(current_setting('test.kas')::uuid);
  raise exception 'ASSERTION FAILED: B read A drawer summary';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_void_expense(current_setting('test.exp1')::uuid, 'hack');
  raise exception 'ASSERTION FAILED: B voided A expense';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_create_order(current_setting('test.store_a')::uuid, current_setting('test.cust')::uuid,
    jsonb_build_array(jsonb_build_object('inventory_id', pg_temp.piece('GOLD-000003'))), null, 1);
  raise exception 'ASSERTION FAILED: B ordered in A store';
exception when insufficient_privilege then null; end $$;
reset role;

select 'ALL GOLD OPERATIONS TESTS PASSED' as result;
rollback;
