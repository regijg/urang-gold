-- =============================================================================
-- UrangGold — platform console (pemilik aplikasi)
--
-- Read-only usage figures per tenant for the /platform console. The console
-- runs with the service role after checking PLATFORM_ADMIN_EMAILS in the app,
-- so this function is executable by service_role only — never by a tenant user.
-- "Today" and "this month" follow Asia/Jakarta (UTC+7, no DST), like the reports.
-- =============================================================================
create or replace function public.gold_platform_tenant_stats()
returns table (
  tenant_id        uuid,
  store_count      bigint,
  user_count       bigint,
  sales_today      numeric,
  sales_month      numeric,
  sales_count_month bigint,
  sales_total      numeric,
  last_sale_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('day',   now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta') as day_start,
      (date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta') as month_start
  ),
  stores as (
    select s.tenant_id, count(*) filter (where s.is_active) as n from public.gold_stores s group by s.tenant_id
  ),
  users as (
    select u.tenant_id, count(*) filter (where u.is_active) as n from public.gold_users u group by u.tenant_id
  ),
  sales as (
    select
      x.tenant_id,
      coalesce(sum(x.total) filter (where x.sold_at >= b.day_start), 0)   as today,
      coalesce(sum(x.total) filter (where x.sold_at >= b.month_start), 0) as month_total,
      count(*) filter (where x.sold_at >= b.month_start)                  as month_count,
      coalesce(sum(x.total), 0)                                           as all_time,
      max(x.sold_at)                                                      as last_sale
    from public.gold_sales x, bounds b
    where x.status = 'COMPLETED'
    group by x.tenant_id
  )
  select
    t.id,
    coalesce(st.n, 0),
    coalesce(us.n, 0),
    coalesce(sa.today, 0),
    coalesce(sa.month_total, 0),
    coalesce(sa.month_count, 0),
    coalesce(sa.all_time, 0),
    sa.last_sale
  from public.gold_tenants t
  left join stores st on st.tenant_id = t.id
  left join users  us on us.tenant_id = t.id
  left join sales  sa on sa.tenant_id = t.id
  order by t.created_at desc;
$$;

revoke all on function public.gold_platform_tenant_stats() from public, anon, authenticated;
grant execute on function public.gold_platform_tenant_stats() to service_role;
