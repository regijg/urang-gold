-- =============================================================================
-- GoldPOS — Phase 10: reporting functions.
--
-- All functions are SECURITY INVOKER: they run under the caller's RLS, so a user
-- only ever aggregates rows they may read (own tenant, accessible stores, role).
-- Voided documents are excluded. Day boundaries are Asia/Jakarta.
-- p_store_id null = all accessible stores.
-- =============================================================================

create or replace function public.gold_report_summary(p_from timestamptz, p_to timestamptz, p_store_id uuid default null)
returns table (
  sales_count bigint, sales_total numeric, sales_discount numeric, sales_cost numeric, gross_profit numeric, sales_gold_weight numeric,
  buyback_count bigint, buyback_total numeric, buyback_gold_weight numeric,
  purchase_count bigint, purchase_total numeric,
  inventory_count bigint, inventory_gold_weight numeric, inventory_cost_value numeric, inventory_market_value numeric,
  cash_in numeric, cash_out numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select count(distinct sa.id) as cnt, coalesce(sum(si.price), 0) as total, coalesce(sum(si.discount), 0) as discount,
           coalesce(sum(si.cost_price), 0) as cost, coalesce(sum(si.gold_weight), 0) as gold
    from public.gold_sales sa
    join public.gold_sale_items si on si.sale_id = sa.id
    where sa.status = 'COMPLETED' and sa.sold_at >= p_from and sa.sold_at < p_to
      and (p_store_id is null or sa.store_id = p_store_id)
  ), b as (
    select count(distinct bb.id) as cnt, coalesce(sum(bi.net_amount), 0) as total, coalesce(sum(bi.gold_weight), 0) as gold
    from public.gold_buybacks bb
    join public.gold_buyback_items bi on bi.buyback_id = bb.id
    where bb.status = 'COMPLETED' and bb.bought_at >= p_from and bb.bought_at < p_to
      and (p_store_id is null or bb.store_id = p_store_id)
  ), p as (
    select count(*) as cnt, coalesce(sum(total), 0) as total
    from public.gold_purchase_orders
    where status = 'RECEIVED' and created_at >= p_from and created_at < p_to
      and (p_store_id is null or store_id = p_store_id)
  ), inv as (
    select count(*) as cnt, coalesce(sum(i.gold_weight), 0) as gold, coalesce(sum(i.cost_price), 0) as cost,
           coalesce(sum(v.sell_price), 0) as market
    from public.gold_inventory i
    left join public.gold_v_inventory_prices v on v.inventory_id = i.id
    where i.status in ('AVAILABLE', 'BUYBACK', 'REPAIR', 'DAMAGED', 'RESERVED')
      and (p_store_id is null or i.store_id = p_store_id)
  ), c as (
    select coalesce(sum(amount) filter (where direction = 'IN'), 0) as cin, coalesce(sum(amount) filter (where direction = 'OUT'), 0) as cout
    from public.gold_payments
    where method <> 'TRADE_IN' and paid_at >= p_from and paid_at < p_to
      and (p_store_id is null or store_id = p_store_id)
  )
  select s.cnt, s.total, s.discount, s.cost, s.total - s.cost, s.gold,
         b.cnt, b.total, b.gold,
         p.cnt, p.total,
         inv.cnt, inv.gold, inv.cost, inv.market,
         c.cin, c.cout
  from s, b, p, inv, c
$$;

-- Daily series for charts (every day in range, zero-filled)
create or replace function public.gold_report_daily(p_from timestamptz, p_to timestamptz, p_store_id uuid default null)
returns table (day date, sales_total numeric, sales_count bigint, buyback_total numeric, purchase_total numeric, gold_sold numeric, gold_bought numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select generate_series((p_from at time zone 'Asia/Jakarta')::date, ((p_to - interval '1 second') at time zone 'Asia/Jakarta')::date, interval '1 day')::date as day
  ), s as (
    select (sa.sold_at at time zone 'Asia/Jakarta')::date as day, sum(si.price) as total, count(distinct sa.id) as cnt, sum(si.gold_weight) as gold
    from public.gold_sales sa join public.gold_sale_items si on si.sale_id = sa.id
    where sa.status = 'COMPLETED' and sa.sold_at >= p_from and sa.sold_at < p_to and (p_store_id is null or sa.store_id = p_store_id)
    group by 1
  ), b as (
    select (bb.bought_at at time zone 'Asia/Jakarta')::date as day, sum(bi.net_amount) as total, sum(bi.gold_weight) as gold
    from public.gold_buybacks bb join public.gold_buyback_items bi on bi.buyback_id = bb.id
    where bb.status = 'COMPLETED' and bb.bought_at >= p_from and bb.bought_at < p_to and (p_store_id is null or bb.store_id = p_store_id)
    group by 1
  ), p as (
    select (created_at at time zone 'Asia/Jakarta')::date as day, sum(total) as total
    from public.gold_purchase_orders
    where status = 'RECEIVED' and created_at >= p_from and created_at < p_to and (p_store_id is null or store_id = p_store_id)
    group by 1
  )
  select d.day, coalesce(s.total, 0), coalesce(s.cnt, 0), coalesce(b.total, 0), coalesce(p.total, 0), coalesce(s.gold, 0), coalesce(b.gold, 0)
  from days d left join s on s.day = d.day left join b on b.day = d.day left join p on p.day = d.day
  order by d.day
$$;

-- Payments by method (IN / OUT / net). TRADE_IN is a non-cash credit and is reported separately.
create or replace function public.gold_report_payments(p_from timestamptz, p_to timestamptz, p_store_id uuid default null)
returns table (method text, amount_in numeric, amount_out numeric, net numeric, tx_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select method,
         coalesce(sum(amount) filter (where direction = 'IN'), 0),
         coalesce(sum(amount) filter (where direction = 'OUT'), 0),
         coalesce(sum(case direction when 'IN' then amount else -amount end), 0),
         count(*)
  from public.gold_payments
  where paid_at >= p_from and paid_at < p_to and (p_store_id is null or store_id = p_store_id)
  group by method
  order by method
$$;

-- On-hand inventory grouped by purity and category
create or replace function public.gold_report_inventory(p_store_id uuid default null)
returns table (purity_code text, category_name text, item_count bigint, gold_weight numeric, cost_value numeric, market_value numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select pu.code, c.name, count(*), sum(i.gold_weight), sum(i.cost_price), coalesce(sum(v.sell_price), 0)
  from public.gold_inventory i
  join public.gold_purities pu on pu.id = i.purity_id
  join public.gold_categories c on c.id = i.category_id
  left join public.gold_v_inventory_prices v on v.inventory_id = i.id
  where i.status in ('AVAILABLE', 'BUYBACK', 'REPAIR', 'DAMAGED', 'RESERVED')
    and (p_store_id is null or i.store_id = p_store_id)
  group by pu.code, pu.sort_order, c.name, c.sort_order
  order by pu.sort_order, c.sort_order
$$;

-- Customers ranked by spending in the period
create or replace function public.gold_report_customers(p_from timestamptz, p_to timestamptz, p_limit integer default 20)
returns table (customer_id uuid, name text, phone text, sales_count bigint, sales_total numeric, buyback_count bigint, buyback_total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select customer_id, count(*) as cnt, sum(total) as total from public.gold_sales
    where status = 'COMPLETED' and customer_id is not null and sold_at >= p_from and sold_at < p_to group by customer_id
  ), b as (
    select customer_id, count(*) as cnt, sum(total) as total from public.gold_buybacks
    where status = 'COMPLETED' and bought_at >= p_from and bought_at < p_to group by customer_id
  )
  select c.id, c.name, c.phone, coalesce(s.cnt, 0), coalesce(s.total, 0), coalesce(b.cnt, 0), coalesce(b.total, 0)
  from public.gold_customers c
  left join s on s.customer_id = c.id
  left join b on b.customer_id = c.id
  where s.customer_id is not null or b.customer_id is not null
  order by coalesce(s.total, 0) desc, coalesce(b.total, 0) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

revoke all on function public.gold_report_summary(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.gold_report_daily(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.gold_report_payments(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.gold_report_inventory(uuid) from public, anon;
revoke all on function public.gold_report_customers(timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.gold_report_summary(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.gold_report_daily(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.gold_report_payments(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.gold_report_inventory(uuid) to authenticated;
grant execute on function public.gold_report_customers(timestamptz, timestamptz, integer) to authenticated;
