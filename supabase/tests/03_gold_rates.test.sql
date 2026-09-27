-- =============================================================================
-- Phase 3: price calculation (unit), gold rate history, RLS.
-- Rolled back at the end.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local');

select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', '');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', '');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select '00000000-0000-0000-0000-0000000000c1', id, 'CASHIER', 'Kasir A', 'cashier-a@test.local' from public.gold_tenants where name = 'Toko A';

select set_config('test.tenant_a', (select id::text from public.gold_tenants where name = 'Toko A'), true);
select set_config('test.p18_b', (select p.id::text from public.gold_purities p join public.gold_tenants t on t.id = p.tenant_id where t.name = 'Toko B' and p.code = '18K'), true);

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

-- ---------- OWNER A sets rates ------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

-- back-dated effective_at / forged created_by from client are overridden
insert into public.gold_gold_rates (purity_id, buy_price, sell_price, effective_at, created_by)
select id, 1650000, 1762500, now() - interval '30 days', '00000000-0000-0000-0000-00000000000b'
from public.gold_purities where code = '18K';
select pg_temp.assert((select created_by from public.gold_gold_rates) = auth.uid(), 'created_by forced');
select pg_temp.assert((select effective_at from public.gold_gold_rates) > now() - interval '1 minute', 'effective_at forced to now');

insert into public.gold_gold_rates (purity_id, buy_price, sell_price)
select id, 2200000, 2350000 from public.gold_purities where code = '24K';

do $$ begin
  insert into public.gold_gold_rates (purity_id, buy_price, sell_price)
  select id, 2400000, 2350000 from public.gold_purities where code = '22K';
  raise exception 'ASSERTION FAILED: buy > sell accepted';
exception when check_violation then null; end $$;

-- cannot set a rate for another tenant's purity (composite FK / RLS)
do $$ begin
  insert into public.gold_gold_rates (purity_id, buy_price, sell_price) values (current_setting('test.p18_b')::uuid, 1, 2);
  raise exception 'ASSERTION FAILED: cross-tenant purity rate accepted';
exception when foreign_key_violation or insufficient_privilege then null; end $$;

-- history is append-only
do $$ begin
  update public.gold_gold_rates set sell_price = 1;
  raise exception 'ASSERTION FAILED: rate updated';
exception when insufficient_privilege then null; end $$;
do $$ begin
  delete from public.gold_gold_rates;
  raise exception 'ASSERTION FAILED: rate deleted';
exception when insufficient_privilege then null; end $$;

select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'CHANGE_GOLD_PRICE') = 2, 'CHANGE_GOLD_PRICE audited');

-- ---------- Price calculation (§10 example) ----------------------------------
-- product: gross 3.31, stone 0.10 -> gold 3.21 g, 18K, labor 150.000, stone 500.000, margin 250.000
insert into public.gold_products (category_id, purity_id, name, gross_weight, stone_weight, labor_cost, stone_price, margin_amount)
select c.id, p.id, 'Cincin Berlian', 3.310, 0.100, 150000, 500000, 250000
from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';

-- 3.21 × 1.762.500 (= 3.21 × 75% × 2.350.000) = 5.657.625
select pg_temp.assert(
  (select gold_value from public.gold_quote_product((select id from public.gold_products where name = 'Cincin Berlian'))) = 5657625,
  'gold value = 3.21 × 1.762.500');
select pg_temp.assert(
  (select total from public.gold_quote_product((select id from public.gold_products where name = 'Cincin Berlian'))) = 6557625,
  'total = gold value + labor + stone + margin');
select pg_temp.assert(
  (select total from public.gold_quote_product((select id from public.gold_products where name = 'Cincin Berlian'), 250000)) = 6307625,
  'discount subtracted');
do $$ begin
  perform * from public.gold_quote_product((select id from public.gold_products where name = 'Cincin Berlian'), 99999999);
  raise exception 'ASSERTION FAILED: discount > subtotal accepted';
exception when invalid_parameter_value then null; end $$;

-- rounding to whole rupiah: 0.333 g × 1.762.500 = 586912.5 -> 586913
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Anting Kecil', 0.333 from public.gold_categories c, public.gold_purities p where c.code = 'ATG' and p.code = '18K';
select pg_temp.assert(
  (select gold_value from public.gold_quote_product((select id from public.gold_products where name = 'Anting Kecil'))) = 586913,
  'gold value rounded half-up');

-- view uses the same formula as the quote function
select pg_temp.assert(
  (select bool_and(v.sell_price = q.total)
   from public.gold_v_product_prices v
   cross join lateral public.gold_quote_product(v.product_id) q),
  'gold_v_product_prices = gold_quote_product');

-- product with a purity that has no rate -> no quote, null in view
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Kalung 22K', 5 from public.gold_categories c, public.gold_purities p where c.code = 'KLG' and p.code = '22K';
select pg_temp.assert(not exists (select 1 from public.gold_quote_product((select id from public.gold_products where name = 'Kalung 22K'))), 'no rate -> no quote');
select pg_temp.assert((select sell_price from public.gold_v_product_prices v join public.gold_products p on p.id = v.product_id where p.name = 'Kalung 22K') is null, 'no rate -> null price');

-- new rate supersedes, history kept
insert into public.gold_gold_rates (purity_id, buy_price, sell_price)
select id, 1700000, 1800000 from public.gold_purities where code = '18K';
select pg_temp.assert((select count(*) from public.gold_gold_rates r join public.gold_purities p on p.id = r.purity_id where p.code = '18K') = 2, 'history kept');
select pg_temp.assert((select sell_price from public.gold_v_current_gold_rates c join public.gold_purities p on p.id = c.purity_id where p.code = '18K') = 1800000, 'latest rate is current');
select pg_temp.assert(
  (select gold_value from public.gold_quote_product((select id from public.gold_products where name = 'Cincin Berlian'))) = 5778000,
  'quote uses latest rate (3.21 × 1.800.000)');

-- internal quote function is not callable by clients
do $$ begin
  perform * from public.gold_price_quote(current_setting('test.tenant_a')::uuid, gen_random_uuid(), 1);
  raise exception 'ASSERTION FAILED: client called gold_price_quote';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- CASHIER: can read & quote, cannot change rates --------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert((select count(*) from public.gold_v_current_gold_rates) = 2, 'cashier reads current rates');
select pg_temp.assert(exists (select 1 from public.gold_quote_product((select id from public.gold_products where name = 'Cincin Berlian'))), 'cashier can quote');
do $$ begin
  insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1, 2 from public.gold_purities where code = '24K';
  raise exception 'ASSERTION FAILED: cashier changed gold price';
exception when insufficient_privilege then null; end $$;
reset role;

-- ---------- OWNER B: isolation ------------------------------------------------
select set_config('test.prod_a', (select id::text from public.gold_products where name = 'Cincin Berlian'), true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_gold_rates) = 0, 'owner B sees no tenant A rates');
select pg_temp.assert((select count(*) from public.gold_v_product_prices) = 0, 'owner B sees no tenant A prices');
select pg_temp.assert(
  not exists (select 1 from public.gold_quote_product(current_setting('test.prod_a')::uuid)),
  'owner B cannot quote tenant A product');
reset role;

select 'ALL GOLD RATE TESTS PASSED' as result;
rollback;
