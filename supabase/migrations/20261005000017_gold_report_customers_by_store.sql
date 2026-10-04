-- =============================================================================
-- UrangGold — customer report filtered by outlet
--
-- gold_report_customers (migration 10) has no outlet filter. Instead of changing its
-- signature (which would risk breaking the existing call), this adds a new function
-- with the extra parameter; the app uses it only when an outlet is selected.
-- Same rules as the original: security invoker, so RLS and outlet access still apply.
-- =============================================================================
create or replace function public.gold_report_customers_by_store(
  p_from timestamptz,
  p_to timestamptz,
  p_store_id uuid,
  p_limit integer default 100
)
returns table (customer_id uuid, name text, phone text, sales_count bigint, sales_total numeric, buyback_count bigint, buyback_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select customer_id, count(*) as cnt, sum(total) as total from public.gold_sales
    where status = 'COMPLETED' and customer_id is not null and sold_at >= p_from and sold_at < p_to
      and (p_store_id is null or store_id = p_store_id)
    group by customer_id
  ), b as (
    select customer_id, count(*) as cnt, sum(total) as total from public.gold_buybacks
    where status = 'COMPLETED' and bought_at >= p_from and bought_at < p_to
      and (p_store_id is null or store_id = p_store_id)
    group by customer_id
  )
  select c.id, c.name, c.phone, coalesce(s.cnt, 0), coalesce(s.total, 0), coalesce(b.cnt, 0), coalesce(b.total, 0)
  from public.gold_customers c
  left join s on s.customer_id = c.id
  left join b on b.customer_id = c.id
  where s.customer_id is not null or b.customer_id is not null
  order by coalesce(s.total, 0) desc, coalesce(b.total, 0) desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
$$;

revoke all on function public.gold_report_customers_by_store(timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.gold_report_customers_by_store(timestamptz, timestamptz, uuid, integer) to authenticated;
