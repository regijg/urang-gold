-- =============================================================================
-- GoldPOS — Phase 11: public online catalogue (/store/[slug]) -> WhatsApp.
--
-- Anonymous visitors never touch tables directly. They call SECURITY DEFINER
-- functions that return a fixed set of SAFE columns (no cost, margin, barcode,
-- customer data) for stores that explicitly enabled the catalogue.
-- =============================================================================

alter table public.gold_stores add column catalog_enabled boolean not null default false;

-- Store header + today's sell prices
create or replace function public.gold_catalog_store(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', s.name,
    'tenant_name', t.name,
    'address', s.address,
    'whatsapp', s.whatsapp,
    'phone', s.phone,
    'rates', coalesce((
      select jsonb_agg(jsonb_build_object('code', p.code, 'sell_price', r.sell_price) order by p.sort_order)
      from public.gold_v_current_gold_rates r join public.gold_purities p on p.id = r.purity_id
      where r.tenant_id = s.tenant_id and p.is_active), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name)
      from public.gold_categories c
      where c.tenant_id = s.tenant_id and c.is_active
        and exists (select 1 from public.gold_inventory i join public.gold_products pr on pr.id = i.product_id
                    where i.store_id = s.id and i.status = 'AVAILABLE' and pr.category_id = c.id and pr.is_active)), '[]'::jsonb)
  )
  from public.gold_stores s
  join public.gold_tenants t on t.id = s.tenant_id
  where s.slug = lower(p_slug) and s.is_active and s.catalog_enabled and t.status = 'ACTIVE'
$$;

-- Products with available pieces in the store, grouped per product
create or replace function public.gold_catalog_products(
  p_slug text, p_category_id uuid default null, p_q text default null, p_limit integer default 24, p_offset integer default 0
)
returns table (
  product_id uuid, sku text, name text, description text, category_name text, purity_code text,
  photo_path text, stock_count bigint, min_weight numeric, max_weight numeric, min_price numeric, max_price numeric, total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select s.id, s.tenant_id from public.gold_stores s join public.gold_tenants t on t.id = s.tenant_id
    where s.slug = lower(p_slug) and s.is_active and s.catalog_enabled and t.status = 'ACTIVE'
  ), grouped as (
    select pr.id as product_id, pr.sku, pr.name, pr.description, c.name as category_name, pu.code as purity_code, pr.photo_path,
           count(*) as stock_count, min(i.gross_weight) as min_weight, max(i.gross_weight) as max_weight,
           min(v.sell_price) as min_price, max(v.sell_price) as max_price, max(pr.created_at) as created_at
    from st
    join public.gold_inventory i on i.store_id = st.id and i.tenant_id = st.tenant_id and i.status = 'AVAILABLE'
    join public.gold_products pr on pr.id = i.product_id and pr.is_active
    join public.gold_categories c on c.id = pr.category_id
    join public.gold_purities pu on pu.id = i.purity_id
    left join lateral (
      select round(i.gold_weight * r.sell_price, 0) + i.labor_cost + i.stone_price + i.margin_amount as sell_price
      from public.gold_v_current_gold_rates r where r.tenant_id = i.tenant_id and r.purity_id = i.purity_id
    ) v on true
    where (p_category_id is null or pr.category_id = p_category_id)
      and (p_q is null or p_q = '' or pr.name ilike '%' || p_q || '%' or pr.sku ilike '%' || p_q || '%')
    group by pr.id, pr.sku, pr.name, pr.description, c.name, pu.code, pr.photo_path
  )
  select product_id, sku, name, description, category_name, purity_code, photo_path, stock_count,
         min_weight, max_weight, min_price, max_price, count(*) over () as total_count
  from grouped
  order by created_at desc, name
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.gold_catalog_store(text) from public;
revoke all on function public.gold_catalog_products(text, uuid, text, integer, integer) from public;
grant execute on function public.gold_catalog_store(text) to anon, authenticated;
grant execute on function public.gold_catalog_products(text, uuid, text, integer, integer) to anon, authenticated;
