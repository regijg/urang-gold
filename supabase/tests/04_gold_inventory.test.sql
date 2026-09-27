-- =============================================================================
-- Phase 4: inventory RPCs, movements, barcode, transfer, status, RLS.
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

-- second outlet for tenant A; cashier + warehouse assigned to Pusat A only
insert into public.gold_stores (tenant_id, code, name, slug)
select id, 'CAB2', 'Cabang A2', 'toko-a-cab2' from public.gold_tenants where name = 'Toko A';
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select u.id, t.id, u.role, u.n, u.e from public.gold_tenants t,
  (values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'CASHIER', 'Kasir A', 'cashier-a@test.local'),
          ('00000000-0000-0000-0000-0000000000e1'::uuid, 'WAREHOUSE', 'Gudang A', 'warehouse-a@test.local')) u (id, role, n, e)
where t.name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select s.tenant_id, u.id, s.id from public.gold_stores s, (values ('00000000-0000-0000-0000-0000000000c1'::uuid), ('00000000-0000-0000-0000-0000000000e1'::uuid)) u (id)
where s.name = 'Pusat A';

select set_config('test.store_a1', (select id::text from public.gold_stores where name = 'Pusat A'), true);
select set_config('test.store_a2', (select id::text from public.gold_stores where name = 'Cabang A2'), true);
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

-- ---------- OWNER A: setup ----------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

insert into public.gold_locations (store_id, code, name, type) values
  (current_setting('test.store_a1')::uuid, 'BAKI-A', 'Baki A', 'BAKI'),
  (current_setting('test.store_a2')::uuid, 'G-01', 'Gudang 1', 'GUDANG');
insert into public.gold_locations (store_id, parent_id, code, name, type)
select current_setting('test.store_a1')::uuid, id, 'A-01', 'Slot A-01', 'SLOT' from public.gold_locations where code = 'BAKI-A';

insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, cost_price, labor_cost, margin_amount)
select c.id, p.id, 'Cincin Berlian', 3.310, 0.100, 7000000, 150000, 250000
from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1650000, 1762500 from public.gold_purities where code = '18K';

-- location of another store cannot be parent / cannot be used for this store
do $$ begin
  insert into public.gold_locations (store_id, parent_id, code, name)
  select current_setting('test.store_a2')::uuid, id, 'X', 'x' from public.gold_locations where code = 'BAKI-A';
  raise exception 'ASSERTION FAILED: cross-store parent accepted';
exception when foreign_key_violation then null; end $$;

-- receive 3 pieces (one with its own cost)
select * from public.gold_inventory_receive(
  current_setting('test.store_a1')::uuid,
  (select id from public.gold_locations where code = 'A-01'),
  (select id from public.gold_products where name = 'Cincin Berlian'),
  '[{"gross_weight": 3.21, "stone_weight": 0.10, "serial_number": "SN-1"},
    {"gross_weight": 3.30},
    {"gross_weight": 3.25, "cost_price": 6500000}]'::jsonb,
  'Stok awal');

select pg_temp.assert((select count(*) from public.gold_inventory) = 3, '3 pieces created');
select pg_temp.assert((select array_agg(barcode order by barcode) from public.gold_inventory) = array['GOLD-000001', 'GOLD-000002', 'GOLD-000003'], 'sequential barcodes');
select pg_temp.assert((select gold_weight from public.gold_inventory where serial_number = 'SN-1') = 3.110, 'piece gold weight');
select pg_temp.assert((select cost_price from public.gold_inventory where barcode = 'GOLD-000002') = 7000000, 'cost falls back to product');
select pg_temp.assert((select cost_price from public.gold_inventory where barcode = 'GOLD-000003') = 6500000, 'explicit cost kept');
select pg_temp.assert((select labor_cost from public.gold_inventory where barcode = 'GOLD-000001') = 150000, 'labor copied from product');
select pg_temp.assert((select count(*) from public.gold_inventory_movements where movement_type = 'ADJUSTMENT' and quantity = 1) = 3, 'one movement per piece');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'STOCK_IN') = 1, 'STOCK_IN audited');

-- summary
select pg_temp.assert((select item_count from public.gold_inventory_summary()) = 3, 'summary count');
select pg_temp.assert((select gold_weight from public.gold_inventory_summary()) = 3.110 + 3.200 + 3.150, 'summary weight');

-- price of a piece uses its own weight: 3.11 × 1.762.500 + 150.000 + 250.000
select pg_temp.assert(
  (select total from public.gold_quote_inventory((select id from public.gold_inventory where barcode = 'GOLD-000001'))) = 5481375 + 400000,
  'piece quote');
select pg_temp.assert(
  (select bool_and(v.sell_price = q.total) from public.gold_v_inventory_prices v cross join lateral public.gold_quote_inventory(v.inventory_id) q),
  'inventory price view = quote');

-- invalid receive inputs
do $$ begin
  perform public.gold_inventory_receive(current_setting('test.store_a1')::uuid, (select id from public.gold_locations where code = 'G-01'),
    (select id from public.gold_products limit 1), '[{"gross_weight": 1}]'::jsonb);
  raise exception 'ASSERTION FAILED: location of other store accepted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_inventory_receive(current_setting('test.store_b')::uuid, null, (select id from public.gold_products limit 1), '[{"gross_weight": 1}]'::jsonb);
  raise exception 'ASSERTION FAILED: receive into tenant B store accepted';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.gold_inventory_receive(current_setting('test.store_a1')::uuid, null, (select id from public.gold_products limit 1), '[{"gross_weight": 1, "stone_weight": 1}]'::jsonb);
  raise exception 'ASSERTION FAILED: stone >= gross accepted';
exception when check_violation then null; end $$;
do $$ begin
  perform public.gold_inventory_receive(current_setting('test.store_a1')::uuid, null, (select id from public.gold_products limit 1), '[]'::jsonb);
  raise exception 'ASSERTION FAILED: empty items accepted';
exception when invalid_parameter_value then null; end $$;

-- direct writes are impossible
do $$ begin
  update public.gold_inventory set status = 'SOLD';
  raise exception 'ASSERTION FAILED: client updated inventory';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.gold_inventory_movements (tenant_id, inventory_id, movement_type, quantity, weight)
  select tenant_id, id, 'SALE', -1, 1 from public.gold_inventory limit 1;
  raise exception 'ASSERTION FAILED: client wrote movement';
exception when insufficient_privilege then null; end $$;

-- transfer to cabang 2
select pg_temp.assert(
  public.gold_inventory_transfer(array[(select id from public.gold_inventory where barcode = 'GOLD-000002')],
    current_setting('test.store_a2')::uuid, (select id from public.gold_locations where code = 'G-01'), 'pindah gudang') = 1,
  'transfer moved 1');
select pg_temp.assert((select store_id from public.gold_inventory where barcode = 'GOLD-000002') = current_setting('test.store_a2')::uuid, 'store changed');
select pg_temp.assert(
  (select count(*) from public.gold_inventory_movements m join public.gold_inventory i on i.id = m.inventory_id
   where i.barcode = 'GOLD-000002' and m.movement_type = 'TRANSFER' and m.from_store_id = current_setting('test.store_a1')::uuid) = 1,
  'TRANSFER movement with from/to');
do $$ begin
  perform public.gold_inventory_transfer(array[(select id from public.gold_inventory where barcode = 'GOLD-000001')], current_setting('test.store_b')::uuid, null);
  raise exception 'ASSERTION FAILED: transfer to tenant B';
exception when insufficient_privilege or invalid_parameter_value then null; end $$;

-- status transitions
select public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000001'), 'REPAIR', null, 'patri');
select public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000001'), 'AVAILABLE', 3.180, 'selesai reparasi');
select pg_temp.assert((select gross_weight from public.gold_inventory where barcode = 'GOLD-000001') = 3.180, 'weight updated after repair');
select pg_temp.assert(
  (select string_agg(movement_type, ',' order by m.id) from public.gold_inventory_movements m join public.gold_inventory i on i.id = m.inventory_id where i.barcode = 'GOLD-000001')
  = 'ADJUSTMENT,REPAIR_OUT,REPAIR_IN', 'repair movements recorded');
select pg_temp.assert(
  (select before_weight = 3.210 and after_weight = 3.180 from public.gold_inventory_movements where movement_type = 'REPAIR_IN'),
  'before/after weight on movement');

do $$ begin
  perform public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000001'), 'SOLD');
  raise exception 'ASSERTION FAILED: set SOLD via status RPC';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000003'), 'LOST', null, '');
  raise exception 'ASSERTION FAILED: LOST without reason';
exception when invalid_parameter_value then null; end $$;
select public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000003'), 'LOST', null, 'hilang');
select pg_temp.assert((select quantity from public.gold_inventory_movements where to_status = 'LOST') = -1, 'LOST is -1 quantity');

-- update details (audited, no movement)
select public.gold_inventory_update_details((select id from public.gold_inventory where barcode = 'GOLD-000001'),
  'Cincin Berlian Premium', 'SN-1', 'Berlian', 7000000, 200000, 0, 300000, null);
select pg_temp.assert((select labor_cost from public.gold_inventory where barcode = 'GOLD-000001') = 200000, 'details updated');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'UPDATE_INVENTORY') = 1, 'UPDATE_INVENTORY audited');

-- internal helpers not callable
do $$ begin
  perform public.gold_next_barcode(public.gold_current_tenant_id());
  raise exception 'ASSERTION FAILED: client called gold_next_barcode';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.gold_inventory_create_pieces(public.gold_current_tenant_id(), current_setting('test.store_a1')::uuid, null, null,
    '[{"gross_weight":1}]'::jsonb, 'AVAILABLE', 'OPENING', 'ADJUSTMENT', null, null, null);
  raise exception 'ASSERTION FAILED: client called gold_inventory_create_pieces';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- CASHIER A (Pusat A only, pos.use) ----------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert((select count(*) from public.gold_inventory) = 2, 'cashier sees only Pusat A pieces');
select pg_temp.assert((select count(*) from public.gold_inventory_movements) = 0, 'cashier cannot read movements');
do $$ begin
  perform public.gold_inventory_receive(current_setting('test.store_a1')::uuid, null, (select id from public.gold_products limit 1), '[{"gross_weight": 1}]'::jsonb);
  raise exception 'ASSERTION FAILED: cashier received stock';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.gold_inventory_change_status((select id from public.gold_inventory where barcode = 'GOLD-000001'), 'REPAIR', null, 'x');
  raise exception 'ASSERTION FAILED: cashier changed status';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- WAREHOUSE A (Pusat A only) ------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.assert((select count(*) from public.gold_inventory) = 2, 'warehouse sees only Pusat A pieces');
select pg_temp.assert((select count(*) from public.gold_locations) = 2, 'warehouse sees only Pusat A locations');
-- cannot move a piece of a store it has no access to (GOLD-000002 is in Cabang A2)
do $$ begin
  perform public.gold_inventory_transfer(array[(select id from public.gold_inventory i where i.barcode = 'GOLD-000002')], current_setting('test.store_a1')::uuid, null);
  raise exception 'ASSERTION FAILED: warehouse moved invisible piece';
exception when insufficient_privilege or invalid_parameter_value then null; end $$;
-- cannot transfer into a store without access
do $$ begin
  perform public.gold_inventory_transfer(array[(select id from public.gold_inventory where barcode = 'GOLD-000001')], current_setting('test.store_a2')::uuid, null);
  raise exception 'ASSERTION FAILED: warehouse transferred into non-assigned store';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER B ------------------------------------------------------------
select set_config('test.piece_a', (select id::text from public.gold_inventory where barcode = 'GOLD-000001'), true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_inventory) = 0, 'owner B sees no tenant A pieces');
select pg_temp.assert(not exists (select 1 from public.gold_quote_inventory(current_setting('test.piece_a')::uuid)), 'owner B cannot quote tenant A piece');
do $$ begin
  perform public.gold_inventory_change_status(current_setting('test.piece_a')::uuid, 'REPAIR', null, 'x');
  raise exception 'ASSERTION FAILED: owner B changed tenant A piece';
exception when invalid_parameter_value then null; end $$;
-- own barcode sequence starts at 1
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Kalung B', 5 from public.gold_categories c, public.gold_purities p where c.code = 'KLG' and p.code = '24K';
select pg_temp.assert(
  (select barcode from public.gold_inventory_receive(current_setting('test.store_b')::uuid, null, (select id from public.gold_products limit 1), '[{"gross_weight": 5}]'::jsonb)) = 'GOLD-000001',
  'per-tenant barcode sequence');
reset role;

select 'ALL GOLD INVENTORY TESTS PASSED' as result;
rollback;
