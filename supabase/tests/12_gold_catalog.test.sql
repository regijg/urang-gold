-- =============================================================================
-- Phase 11: public catalogue exposes only enabled stores and safe columns.
-- =============================================================================
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko Emas A', 'Pusat A');

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
insert into public.gold_gold_rates (purity_id, buy_price, sell_price) select id, 1650000, 1762500 from public.gold_purities where code = '18K';
insert into public.gold_products (category_id, purity_id, name, gross_weight, cost_price, labor_cost, margin_amount)
select c.id, p.id, 'Cincin Mawar', 3, 9999999, 100000, 200000 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Kalung Habis', 5 from public.gold_categories c, public.gold_purities p where c.code = 'KLG' and p.code = '18K';
select * from public.gold_inventory_receive((select id from public.gold_stores limit 1), null, (select id from public.gold_products where name = 'Cincin Mawar'),
  '[{"gross_weight":3.00},{"gross_weight":3.20}]'::jsonb);
reset role;

select set_config('test.slug', (select slug from public.gold_stores limit 1), true);

-- disabled by default -> nothing public
set local role anon;
select pg_temp.assert(public.gold_catalog_store(current_setting('test.slug')) is null, 'catalog hidden until enabled');
select pg_temp.assert((select count(*) from public.gold_catalog_products(current_setting('test.slug'))) = 0, 'no products while disabled');
do $$ begin
  perform 1 from public.gold_products;
  raise exception 'ASSERTION FAILED: anon read products table';
exception when insufficient_privilege then null; end $$;
reset role;

update public.gold_stores set catalog_enabled = true, whatsapp = '6281234567890';

set local role anon;
select pg_temp.assert((public.gold_catalog_store(current_setting('test.slug')) ->> 'whatsapp') = '6281234567890', 'store info');
select pg_temp.assert(jsonb_array_length(public.gold_catalog_store(current_setting('test.slug')) -> 'rates') = 1, 'rates shown');
select pg_temp.assert(jsonb_array_length(public.gold_catalog_store(current_setting('test.slug')) -> 'categories') = 1, 'only categories with stock');
select pg_temp.assert((select count(*) from public.gold_catalog_products(current_setting('test.slug'))) = 1, 'only products with available stock');
select pg_temp.assert((select stock_count from public.gold_catalog_products(current_setting('test.slug'))) = 2, 'stock count');
-- 3.00 × 1.762.500 + 300.000 = 5.587.500 ; 3.20 × 1.762.500 + 300.000 = 5.940.000
select pg_temp.assert((select min_price from public.gold_catalog_products(current_setting('test.slug'))) = 5587500, 'min price');
select pg_temp.assert((select max_price from public.gold_catalog_products(current_setting('test.slug'))) = 5940000, 'max price');
select pg_temp.assert((select count(*) from public.gold_catalog_products(current_setting('test.slug'), null, 'mawar')) = 1, 'search');
select pg_temp.assert((select count(*) from public.gold_catalog_products(current_setting('test.slug'), null, 'zzz')) = 0, 'search miss');
select pg_temp.assert(public.gold_catalog_store('tidak-ada') is null, 'unknown slug');
-- the returned json never contains cost fields
select pg_temp.assert(position('cost' in public.gold_catalog_store(current_setting('test.slug'))::text) = 0, 'no cost data exposed');
reset role;

select 'ALL GOLD CATALOG TESTS PASSED' as result;
rollback;
