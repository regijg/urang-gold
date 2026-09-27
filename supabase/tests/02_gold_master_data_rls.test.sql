-- =============================================================================
-- Security/integrity test for Phase 2 master data. Same usage as
-- 01_gold_core_rls.test.sql; runs in a transaction that is rolled back.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'warehouse-a@test.local');

select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', '');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', '');

insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select u.id, t.id, u.role, u.full_name, u.email
from public.gold_tenants t,
     (values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'CASHIER', 'Kasir A', 'cashier-a@test.local'),
             ('00000000-0000-0000-0000-0000000000e1'::uuid, 'WAREHOUSE', 'Gudang A', 'warehouse-a@test.local'))
       as u (id, role, full_name, email)
where t.name = 'Toko A';

select set_config('test.tenant_b', (select id::text from public.gold_tenants where name = 'Toko B'), true);
select set_config('test.cat_b', (select c.id::text from public.gold_categories c join public.gold_tenants t on t.id = c.tenant_id where t.name = 'Toko B' and c.code = 'RNG'), true);

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

-- ---------- seeding ----------------------------------------------------------
select pg_temp.assert((select count(*) from public.gold_purities) = 24, '12 default purities per tenant');
select pg_temp.assert((select count(*) from public.gold_categories) = 12, '6 default categories per tenant');
select pg_temp.assert(
  (select percentage from public.gold_purities p join public.gold_tenants t on t.id = p.tenant_id where t.name = 'Toko A' and p.code = '18K') = 75.000,
  '18K = 75%');

-- ---------- OWNER A ----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select pg_temp.assert((select count(*) from public.gold_purities) = 12, 'owner A sees only own purities');
select pg_temp.assert((select count(*) from public.gold_categories) = 6, 'owner A sees only own categories');

-- tenant_id omitted -> defaulted from the session
insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, cost_price, labor_cost)
select c.id, p.id, 'Cincin Berlian', 3.210, 0.100, 7000000, 150000
from public.gold_categories c, public.gold_purities p
where c.code = 'RNG' and p.code = '18K';

select pg_temp.assert((select sku from public.gold_products where name = 'Cincin Berlian') = 'RNG-00001', 'SKU auto-generated');
select pg_temp.assert((select gold_weight from public.gold_products where name = 'Cincin Berlian') = 3.110, 'gold_weight = gross - stone');
select pg_temp.assert((select created_by from public.gold_products where name = 'Cincin Berlian') = auth.uid(), 'created_by forced to caller');
select pg_temp.assert((select tenant_id from public.gold_products where name = 'Cincin Berlian') = public.gold_current_tenant_id(), 'tenant_id defaulted');

insert into public.gold_products (category_id, purity_id, name, gross_weight, sku)
select c.id, p.id, 'Cincin Polos', 2.000, ' rng-custom ' from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '22K';
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Cincin Kedua', 2.500 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '22K';
select pg_temp.assert((select sku from public.gold_products where name = 'Cincin Polos') = 'RNG-CUSTOM', 'manual SKU upper-cased/trimmed');
select pg_temp.assert((select sku from public.gold_products where name = 'Cincin Kedua') = 'RNG-00002', 'SKU sequence increments');

-- forged created_by is ignored
insert into public.gold_customers (name, phone, created_by)
values ('Siti', '081234567890', '00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select created_by from public.gold_customers where name = 'Siti') = auth.uid(), 'forged created_by ignored');

-- duplicate SKU / phone within tenant
do $$ begin
  insert into public.gold_products (category_id, purity_id, name, gross_weight, sku)
  select c.id, p.id, 'Dup', 1, 'RNG-00001' from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
  raise exception 'ASSERTION FAILED: duplicate SKU accepted';
exception when unique_violation then null; end $$;

do $$ begin
  insert into public.gold_customers (name, phone) values ('Siti 2', '081234567890');
  raise exception 'ASSERTION FAILED: duplicate customer phone accepted';
exception when unique_violation then null; end $$;

-- stone weight must be below gross weight
do $$ begin
  insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight)
  select c.id, p.id, 'Batu', 1, 1 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
  raise exception 'ASSERTION FAILED: stone >= gross accepted';
exception when check_violation then null; end $$;

-- cannot reference another tenant's category (composite FK)
do $$ begin
  insert into public.gold_products (category_id, purity_id, name, gross_weight)
  select current_setting('test.cat_b')::uuid, p.id, 'Cross', 1 from public.gold_purities p where p.code = '18K';
  raise exception 'ASSERTION FAILED: cross-tenant category accepted';
exception when foreign_key_violation then null; end $$;

-- cannot insert into tenant B explicitly
do $$ begin
  insert into public.gold_suppliers (tenant_id, name) values (current_setting('test.tenant_b')::uuid, 'Supplier Hack');
  raise exception 'ASSERTION FAILED: insert into tenant B accepted';
exception when insufficient_privilege then null; end $$;

-- cannot move a product to tenant B
do $$ begin
  update public.gold_products set tenant_id = current_setting('test.tenant_b')::uuid where name = 'Cincin Polos';
  raise exception 'ASSERTION FAILED: moved product to tenant B';
exception when insufficient_privilege or foreign_key_violation then null; end $$;

-- category in use cannot be deleted
do $$ begin
  delete from public.gold_categories where code = 'RNG';
  raise exception 'ASSERTION FAILED: deleted category in use';
exception when foreign_key_violation then null; end $$;

-- audit trail
update public.gold_products set name = 'Cincin Berlian Baru' where sku = 'RNG-00001';
delete from public.gold_products where sku = 'RNG-00002';
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'CREATE_PRODUCT') = 3, 'CREATE_PRODUCT logged');
select pg_temp.assert(
  (select new_data ->> 'name' from public.gold_audit_logs where action = 'UPDATE_PRODUCT' order by id desc limit 1) = 'Cincin Berlian Baru',
  'UPDATE_PRODUCT logged with new data');
select pg_temp.assert(
  (select user_id from public.gold_audit_logs where action = 'DELETE_PRODUCT') = auth.uid(), 'DELETE_PRODUCT logged with user');
select pg_temp.assert(not exists (select 1 from public.gold_audit_logs where tenant_id <> public.gold_current_tenant_id()), 'owner sees only own audit');

do $$ begin
  insert into public.gold_audit_logs (tenant_id, action, entity_type) values (public.gold_current_tenant_id(), 'FAKE', 'x');
  raise exception 'ASSERTION FAILED: client wrote audit log';
exception when insufficient_privilege then null; end $$;

do $$ begin
  perform public.gold_next_sequence(public.gold_current_tenant_id(), 'sku:RNG');
  raise exception 'ASSERTION FAILED: client called gold_next_sequence';
exception when insufficient_privilege then null; end $$;

-- storage: own tenant folder only
insert into storage.objects (bucket_id, name)
values ('gold-products', public.gold_current_tenant_id()::text || '/p1/photo.jpg');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('gold-products', current_setting('test.tenant_b') || '/p1/x.jpg');
  raise exception 'ASSERTION FAILED: uploaded into tenant B folder';
exception when insufficient_privilege then null; end $$;

reset role;

-- ---------- CASHIER A: reads master data, manages customers only -------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert((select count(*) from public.gold_products) = 2, 'cashier can read products');
select pg_temp.assert((select count(*) from public.gold_customers) = 1, 'cashier can read customers');
insert into public.gold_customers (name) values ('Pelanggan Kasir');

do $$ begin
  insert into public.gold_categories (code, name) values ('XX', 'Hack');
  raise exception 'ASSERTION FAILED: cashier created category';
exception when insufficient_privilege then null; end $$;

with u as (update public.gold_products set cost_price = 1 returning 1)
select pg_temp.assert((select count(*) from u) = 0, 'cashier cannot update products');
with d as (delete from public.gold_purities returning 1)
select pg_temp.assert((select count(*) from d) = 0, 'cashier cannot delete purities');
select pg_temp.assert((select count(*) from public.gold_audit_logs) = 0, 'cashier cannot read audit log');

do $$ begin
  insert into storage.objects (bucket_id, name) values ('gold-products', public.gold_current_tenant_id()::text || '/p1/c.jpg');
  raise exception 'ASSERTION FAILED: cashier uploaded product photo';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- WAREHOUSE A: no customer access (PII) ----------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.assert((select count(*) from public.gold_products) = 2, 'warehouse can read products');
select pg_temp.assert((select count(*) from public.gold_customers) = 0, 'warehouse cannot read customers');
do $$ begin
  insert into public.gold_customers (name) values ('x');
  raise exception 'ASSERTION FAILED: warehouse created customer';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER B: sees none of tenant A -----------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_products) = 0, 'owner B sees no tenant A products');
select pg_temp.assert((select count(*) from public.gold_customers) = 0, 'owner B sees no tenant A customers');
select pg_temp.assert(not exists (select 1 from public.gold_categories where tenant_id <> public.gold_current_tenant_id()), 'owner B sees own categories only');
-- own sequence is independent of tenant A
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Cincin B', 1.5 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '24K';
select pg_temp.assert((select sku from public.gold_products where name = 'Cincin B') = 'RNG-00001', 'per-tenant SKU sequence');
reset role;

-- ---------- anon -------------------------------------------------------------
set local role anon;
do $$ begin
  perform 1 from public.gold_products;
  raise exception 'ASSERTION FAILED: anon read products';
exception when insufficient_privilege then null; end $$;
reset role;

select 'ALL GOLD MASTER DATA TESTS PASSED' as result;
rollback;
