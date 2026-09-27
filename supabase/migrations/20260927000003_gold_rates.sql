-- =============================================================================
-- GoldPOS — Phase 3: gold rates, price calculation, price history
--
-- Table : gold_gold_rates (append-only history of buy/sell price per gram per purity)
-- Views : gold_v_current_gold_rates, gold_v_product_prices (security_invoker)
-- Funcs : gold_price_quote()     internal, tenant passed explicitly (used by
--                                 security-definer transaction RPCs in later phases)
--         gold_quote_product()   for signed-in users (tenant from session)
--
-- Price formula (master prompt §10) — single source of truth, in the database:
--   gold_value = round(gold_weight × sell_price_per_gram_of_purity)
--   subtotal   = gold_value + labor_cost + stone_price + margin
--   total      = subtotal − discount          (discount ≤ subtotal)
-- The per-purity sell price already includes purity (18K rate = 24K × 75%),
-- which equals the §10 example 3.21 × 75% × 2.350.000.
-- =============================================================================

create table public.gold_gold_rates (
  id           uuid primary key default gen_random_uuid(),
  -- insertion order: deterministic tie-breaker when effective_at is equal
  -- (now() is constant within one transaction)
  seq          bigint generated always as identity,
  tenant_id    uuid not null default public.gold_current_tenant_id()
               references public.gold_tenants (id) on delete cascade,
  purity_id    uuid not null,
  buy_price    numeric(15,2) not null check (buy_price > 0),
  sell_price   numeric(15,2) not null check (sell_price > 0),
  effective_at timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (buy_price <= sell_price),
  foreign key (tenant_id, purity_id) references public.gold_purities (tenant_id, id) on delete restrict
);

create index gold_gold_rates_current_idx on public.gold_gold_rates (tenant_id, purity_id, effective_at desc, seq desc);
create index gold_gold_rates_created_at_idx on public.gold_gold_rates (tenant_id, created_at desc);

-- effective_at / created_by / created_at are set by the database (no back-dating from clients)
create or replace function public.gold_gold_rates_before_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.effective_at := now();
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger gold_gold_rates_before_insert before insert on public.gold_gold_rates
  for each row execute function public.gold_gold_rates_before_insert();

create or replace function public.gold_gold_rates_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_data)
  values (new.tenant_id, auth.uid(), 'CHANGE_GOLD_PRICE', 'gold_rate', new.id::text, to_jsonb(new));
  return new;
end;
$$;

create trigger gold_gold_rates_audit after insert on public.gold_gold_rates
  for each row execute function public.gold_gold_rates_audit();

alter table public.gold_gold_rates enable row level security;
revoke all on public.gold_gold_rates from anon, authenticated;
-- append-only: no UPDATE / DELETE for clients
grant select, insert on public.gold_gold_rates to authenticated;

create policy gold_gold_rates_select on public.gold_gold_rates for select to authenticated
  using (tenant_id = public.gold_current_tenant_id());
create policy gold_gold_rates_insert on public.gold_gold_rates for insert to authenticated
  with check (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('gold_rates.manage'));

-- -----------------------------------------------------------------------------
-- Current rate per purity (latest effective_at <= now)
-- -----------------------------------------------------------------------------
create view public.gold_v_current_gold_rates
with (security_invoker = true) as
select distinct on (r.tenant_id, r.purity_id)
  r.id, r.tenant_id, r.purity_id, r.buy_price, r.sell_price, r.effective_at, r.created_by
from public.gold_gold_rates r
where r.effective_at <= now()
order by r.tenant_id, r.purity_id, r.effective_at desc, r.seq desc;

revoke all on public.gold_v_current_gold_rates from anon, authenticated;
grant select on public.gold_v_current_gold_rates to authenticated;

-- -----------------------------------------------------------------------------
-- Price quote. Internal: tenant passed explicitly, not callable by clients.
-- Returns no row when the purity has no rate yet.
-- -----------------------------------------------------------------------------
create or replace function public.gold_price_quote(
  p_tenant_id   uuid,
  p_purity_id   uuid,
  p_gold_weight numeric,
  p_labor_cost  numeric default 0,
  p_stone_price numeric default 0,
  p_margin      numeric default 0,
  p_discount    numeric default 0
)
returns table (
  rate_id        uuid,
  sell_rate      numeric,
  gold_value     numeric,
  subtotal       numeric,
  discount       numeric,
  total          numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rate record;
  v_gold_value numeric;
  v_subtotal numeric;
begin
  if p_gold_weight is null or p_gold_weight <= 0 then
    raise exception 'INVALID_WEIGHT' using errcode = '22023';
  end if;
  if coalesce(p_labor_cost, 0) < 0 or coalesce(p_stone_price, 0) < 0
     or coalesce(p_margin, 0) < 0 or coalesce(p_discount, 0) < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select r.id, r.sell_price into v_rate
  from public.gold_gold_rates r
  where r.tenant_id = p_tenant_id and r.purity_id = p_purity_id and r.effective_at <= now()
  order by r.effective_at desc, r.seq desc
  limit 1;

  if not found then
    return;
  end if;

  v_gold_value := round(p_gold_weight * v_rate.sell_price, 0);
  v_subtotal := v_gold_value + coalesce(p_labor_cost, 0) + coalesce(p_stone_price, 0) + coalesce(p_margin, 0);

  if coalesce(p_discount, 0) > v_subtotal then
    raise exception 'DISCOUNT_EXCEEDS_SUBTOTAL' using errcode = '22023';
  end if;

  return query select v_rate.id, v_rate.sell_price, v_gold_value, v_subtotal,
                      coalesce(p_discount, 0)::numeric, v_subtotal - coalesce(p_discount, 0);
end;
$$;

revoke all on function public.gold_price_quote(uuid, uuid, numeric, numeric, numeric, numeric, numeric)
  from public, anon, authenticated;

-- Quote for a master product (standard weight) — for signed-in users.
create or replace function public.gold_quote_product(p_product_id uuid, p_discount numeric default 0)
returns table (
  product_id uuid,
  rate_id    uuid,
  sell_rate  numeric,
  gold_value numeric,
  subtotal   numeric,
  discount   numeric,
  total      numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_current_tenant_id();
  v_p record;
begin
  if v_tenant is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select p.id, p.purity_id, p.gold_weight, p.labor_cost, p.stone_price, p.margin_amount into v_p
  from public.gold_products p
  where p.id = p_product_id and p.tenant_id = v_tenant;

  if not found then
    return;
  end if;

  return query
  select v_p.id, q.rate_id, q.sell_rate, q.gold_value, q.subtotal, q.discount, q.total
  from public.gold_price_quote(v_tenant, v_p.purity_id, v_p.gold_weight, v_p.labor_cost,
                               v_p.stone_price, v_p.margin_amount, p_discount) q;
end;
$$;

revoke all on function public.gold_quote_product(uuid, numeric) from public, anon;
grant execute on function public.gold_quote_product(uuid, numeric) to authenticated;

-- Estimated sell price of every product at the current rate (for lists/catalogue).
-- Same formula as gold_price_quote (discount 0). security_invoker => caller's RLS.
create view public.gold_v_product_prices
with (security_invoker = true) as
select
  p.id as product_id,
  p.tenant_id,
  r.id as rate_id,
  r.sell_price as sell_rate,
  round(p.gold_weight * r.sell_price, 0) as gold_value,
  round(p.gold_weight * r.sell_price, 0) + p.labor_cost + p.stone_price + p.margin_amount as sell_price
from public.gold_products p
left join public.gold_v_current_gold_rates r
  on r.tenant_id = p.tenant_id and r.purity_id = p.purity_id;

revoke all on public.gold_v_product_prices from anon, authenticated;
grant select on public.gold_v_product_prices to authenticated;
