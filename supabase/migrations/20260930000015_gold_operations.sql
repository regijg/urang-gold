-- =============================================================================
-- UrangGold — daily operations: cash sessions, expenses, orders (DP), repairs,
-- buyback resale, labor per gram, extra report figures.
--
-- Money rule (unchanged): every rupiah in/out of the store is a row in
-- gold_payments (IN / OUT). New documents (expense, order, repair) reference
-- their payment rows, so cash-flow reports and the cash drawer stay correct:
--   drawer balance = opening + Σ CASH IN − Σ CASH OUT (+ manual cash movements)
--
-- New permissions: cash.manage, expenses.manage, orders.manage, repairs.manage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Permissions (defaults; tenant overrides get them when their role default has them)
-- -----------------------------------------------------------------------------
update public.gold_roles r
   set permissions = (select array_agg(distinct p order by p) from unnest(r.permissions || x.add) p)
  from (values
    ('OWNER',   array['cash.manage', 'expenses.manage', 'orders.manage', 'repairs.manage']),
    ('ADMIN',   array['cash.manage', 'expenses.manage', 'orders.manage', 'repairs.manage']),
    ('MANAGER', array['cash.manage', 'expenses.manage', 'orders.manage', 'repairs.manage']),
    ('CASHIER', array['cash.manage', 'orders.manage', 'repairs.manage'])
  ) as x(code, add)
 where r.code = x.code;

update public.gold_tenant_role_permissions o
   set permissions = (select array_agg(distinct p order by p)
                      from unnest(o.permissions || array(
                        select unnest(array['cash.manage', 'expenses.manage', 'orders.manage', 'repairs.manage'])
                        intersect select unnest(r.permissions))) p)
  from public.gold_roles r
 where r.code = o.role_code;

-- -----------------------------------------------------------------------------
-- 2. Labor per gram: labor_cost is derived from labor_per_gram × gold weight, so
--    every existing price formula (quote, views, catalog, sale) keeps working.
-- -----------------------------------------------------------------------------
alter table public.gold_products  add column labor_per_gram numeric(15,2) check (labor_per_gram >= 0);
alter table public.gold_inventory add column labor_per_gram numeric(15,2) check (labor_per_gram >= 0);

create or replace function public.gold_labor_from_per_gram()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- gold_weight is a generated column (not yet computed in a BEFORE trigger)
  if new.labor_per_gram is not null then
    new.labor_cost := round(new.labor_per_gram * (new.gross_weight - coalesce(new.stone_weight, 0)), 0);
  end if;
  return new;
end;
$$;

create trigger gold_products_labor_per_gram before insert or update on public.gold_products
  for each row execute function public.gold_labor_from_per_gram();

-- pieces inherit the product's per-gram labor when created (weights differ per piece)
create or replace function public.gold_inventory_labor_per_gram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.labor_per_gram is null and new.product_id is not null then
    select p.labor_per_gram into new.labor_per_gram from public.gold_products p where p.id = new.product_id;
  end if;
  if new.labor_per_gram is not null then
    new.labor_cost := round(new.labor_per_gram * (new.gross_weight - coalesce(new.stone_weight, 0)), 0);
  end if;
  return new;
end;
$$;

create trigger gold_inventory_labor_per_gram before insert or update on public.gold_inventory
  for each row execute function public.gold_inventory_labor_per_gram();

-- -----------------------------------------------------------------------------
-- 3. Tables
-- -----------------------------------------------------------------------------
create table public.gold_cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.gold_tenants (id) on delete cascade,
  store_id        uuid not null,
  session_number  text not null,
  status          text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  opening_amount  numeric(15,2) not null check (opening_amount >= 0),
  opened_by       uuid references auth.users (id) on delete set null,
  opened_at       timestamptz not null default now(),
  expected_amount numeric(15,2),
  counted_amount  numeric(15,2) check (counted_amount >= 0),
  difference      numeric(15,2),
  closed_by       uuid references auth.users (id) on delete set null,
  closed_at       timestamptz,
  notes           text check (length(notes) <= 1000),
  close_notes     text check (length(close_notes) <= 1000),
  unique (tenant_id, session_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict
);
-- one open drawer per outlet
create unique index gold_cash_sessions_one_open on public.gold_cash_sessions (store_id) where status = 'OPEN';
create index gold_cash_sessions_tenant_idx on public.gold_cash_sessions (tenant_id, opened_at desc);

create table public.gold_cash_movements (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.gold_tenants (id) on delete cascade,
  session_id  uuid not null,
  store_id    uuid not null,
  direction   text not null check (direction in ('IN', 'OUT')),
  amount      numeric(15,2) not null check (amount > 0),
  reason      text not null check (length(trim(reason)) between 1 and 300),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, session_id) references public.gold_cash_sessions (tenant_id, id) on delete cascade
);
create index gold_cash_movements_session_idx on public.gold_cash_movements (session_id);

create table public.gold_expenses (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.gold_tenants (id) on delete cascade,
  store_id       uuid not null,
  expense_number text not null,
  expense_date   date not null,
  category       text not null check (category in ('GAJI', 'SEWA', 'LISTRIK_AIR', 'INTERNET_PULSA', 'TRANSPORT', 'PERLENGKAPAN', 'PERAWATAN', 'PAJAK', 'KONSUMSI', 'LAINNYA')),
  description    text not null check (length(trim(description)) between 1 and 300),
  amount         numeric(15,2) not null check (amount > 0),
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'VOIDED')),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  voided_at      timestamptz,
  void_reason    text check (length(void_reason) <= 500),
  unique (tenant_id, expense_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict
);
create index gold_expenses_tenant_date_idx on public.gold_expenses (tenant_id, expense_date desc, created_at desc);

create table public.gold_orders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.gold_tenants (id) on delete cascade,
  store_id      uuid not null,
  order_number  text not null,
  customer_id   uuid not null,
  status        text not null default 'OPEN' check (status in ('OPEN', 'COMPLETED', 'CANCELLED')),
  subtotal      numeric(15,2) not null check (subtotal >= 0),
  discount_total numeric(15,2) not null default 0 check (discount_total >= 0),
  total         numeric(15,2) not null check (total >= 0),
  paid_total    numeric(15,2) not null default 0 check (paid_total >= 0),
  refund_total  numeric(15,2) not null default 0 check (refund_total >= 0),
  due_date      date,
  notes         text check (length(notes) <= 1000),
  sale_id       uuid,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text check (length(cancel_reason) <= 500),
  unique (tenant_id, order_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.gold_customers (tenant_id, id) on delete restrict,
  foreign key (tenant_id, sale_id) references public.gold_sales (tenant_id, id) on delete restrict,
  check (total = subtotal - discount_total),
  check (paid_total <= total),
  check (refund_total <= paid_total)
);
create index gold_orders_tenant_idx on public.gold_orders (tenant_id, status, created_at desc);

-- price is LOCKED when the order is made (snapshot like gold_sale_items)
create table public.gold_order_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.gold_tenants (id) on delete cascade,
  order_id      uuid not null,
  inventory_id  uuid not null,
  product_id    uuid,
  barcode       text not null,
  name          text not null,
  purity_code   text not null,
  purity_pct    numeric(6,3) not null,
  gross_weight  numeric(10,3) not null,
  gold_weight   numeric(10,3) not null,
  rate_id       uuid,
  sell_rate     numeric(15,2) not null,
  gold_value    numeric(15,2) not null,
  labor_cost    numeric(15,2) not null,
  stone_price   numeric(15,2) not null,
  margin_amount numeric(15,2) not null,
  subtotal      numeric(15,2) not null,
  discount      numeric(15,2) not null default 0 check (discount >= 0),
  price         numeric(15,2) not null check (price >= 0),
  cost_price    numeric(15,2) not null default 0,
  created_at    timestamptz not null default now(),
  foreign key (tenant_id, order_id) references public.gold_orders (tenant_id, id) on delete cascade,
  foreign key (tenant_id, inventory_id) references public.gold_inventory (tenant_id, id) on delete restrict,
  check (price = subtotal - discount)
);
create index gold_order_items_order_idx on public.gold_order_items (order_id);

create table public.gold_repairs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.gold_tenants (id) on delete cascade,
  store_id       uuid not null,
  repair_number  text not null,
  customer_id    uuid not null,
  item_description text not null check (length(trim(item_description)) between 1 and 300),
  service_type   text not null check (length(trim(service_type)) between 1 and 200),
  weight_in      numeric(10,3) check (weight_in > 0),
  estimated_cost numeric(15,2) not null default 0 check (estimated_cost >= 0),
  final_cost     numeric(15,2) check (final_cost >= 0),
  paid_total     numeric(15,2) not null default 0 check (paid_total >= 0),
  refund_total   numeric(15,2) not null default 0 check (refund_total >= 0),
  status         text not null default 'RECEIVED' check (status in ('RECEIVED', 'IN_PROGRESS', 'READY', 'PICKED_UP', 'CANCELLED')),
  due_date       date,
  notes          text check (length(notes) <= 1000),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  ready_at       timestamptz,
  picked_up_at   timestamptz,
  cancelled_at   timestamptz,
  cancel_reason  text check (length(cancel_reason) <= 500),
  unique (tenant_id, repair_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.gold_customers (tenant_id, id) on delete restrict,
  check (refund_total <= paid_total)
);
create index gold_repairs_tenant_idx on public.gold_repairs (tenant_id, status, created_at desc);

-- payments of the new documents
alter table public.gold_payments add column expense_id uuid;
alter table public.gold_payments add column order_id uuid;
alter table public.gold_payments add column repair_id uuid;
alter table public.gold_payments add constraint gold_payments_expense_fk foreign key (tenant_id, expense_id) references public.gold_expenses (tenant_id, id) on delete restrict;
alter table public.gold_payments add constraint gold_payments_order_fk foreign key (tenant_id, order_id) references public.gold_orders (tenant_id, id) on delete restrict;
alter table public.gold_payments add constraint gold_payments_repair_fk foreign key (tenant_id, repair_id) references public.gold_repairs (tenant_id, id) on delete restrict;
create index gold_payments_expense_idx on public.gold_payments (expense_id);
create index gold_payments_order_idx on public.gold_payments (order_id);
create index gold_payments_repair_idx on public.gold_payments (repair_id);

-- -----------------------------------------------------------------------------
-- 4. RLS (read-only; writes only through the RPCs below)
-- -----------------------------------------------------------------------------
alter table public.gold_cash_sessions enable row level security;
alter table public.gold_cash_movements enable row level security;
alter table public.gold_expenses enable row level security;
alter table public.gold_orders enable row level security;
alter table public.gold_order_items enable row level security;
alter table public.gold_repairs enable row level security;
revoke all on public.gold_cash_sessions, public.gold_cash_movements, public.gold_expenses,
              public.gold_orders, public.gold_order_items, public.gold_repairs from anon, authenticated;
grant select on public.gold_cash_sessions, public.gold_cash_movements, public.gold_expenses,
                public.gold_orders, public.gold_order_items, public.gold_repairs to authenticated;

create policy gold_cash_sessions_select on public.gold_cash_sessions for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and public.gold_can_access_store(store_id)
         and ((select public.gold_has_permission('cash.manage')) or (select public.gold_has_permission('reports.view'))));
create policy gold_cash_movements_select on public.gold_cash_movements for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and exists (select 1 from public.gold_cash_sessions s where s.id = session_id));
create policy gold_expenses_select on public.gold_expenses for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and public.gold_can_access_store(store_id)
         and ((select public.gold_has_permission('expenses.manage')) or (select public.gold_has_permission('reports.view'))));
create policy gold_orders_select on public.gold_orders for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and public.gold_can_access_store(store_id)
         and ((select public.gold_has_permission('orders.manage')) or (select public.gold_has_permission('reports.view'))));
create policy gold_order_items_select on public.gold_order_items for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and exists (select 1 from public.gold_orders o where o.id = order_id));
create policy gold_repairs_select on public.gold_repairs for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and public.gold_can_access_store(store_id)
         and ((select public.gold_has_permission('repairs.manage')) or (select public.gold_has_permission('reports.view'))));

drop policy gold_payments_select on public.gold_payments;
create policy gold_payments_select on public.gold_payments for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()) and public.gold_can_access_store(store_id)
         and ((select public.gold_has_permission('sales.manage')) or (select public.gold_has_permission('buybacks.manage'))
              or (select public.gold_has_permission('purchases.manage')) or (select public.gold_has_permission('reports.view'))
              or (select public.gold_has_permission('expenses.manage')) or (select public.gold_has_permission('orders.manage'))
              or (select public.gold_has_permission('repairs.manage'))));

-- -----------------------------------------------------------------------------
-- 5. Internal: payments for expense / order / repair documents
-- -----------------------------------------------------------------------------
create or replace function public.gold_insert_doc_payments(
  p_tenant_id uuid, p_store_id uuid, p_direction text, p_payments jsonb,
  p_expense_id uuid default null, p_order_id uuid default null, p_repair_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p jsonb;
  v_amount numeric;
  v_method text;
  v_sum numeric := 0;
begin
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    return 0;
  end if;
  if jsonb_array_length(p_payments) > 10 then
    raise exception 'TOO_MANY_PAYMENTS' using errcode = '22023';
  end if;
  for v_p in select * from jsonb_array_elements(p_payments) loop
    v_method := v_p ->> 'method';
    v_amount := (v_p ->> 'amount')::numeric;
    if v_method not in ('CASH', 'BANK_TRANSFER', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD') then
      raise exception 'INVALID_PAYMENT_METHOD' using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 0) then
      raise exception 'INVALID_AMOUNT' using errcode = '22023';
    end if;
    insert into public.gold_payments (tenant_id, store_id, expense_id, order_id, repair_id, direction, method, amount, reference, created_by)
    values (p_tenant_id, p_store_id, p_expense_id, p_order_id, p_repair_id, p_direction, v_method, v_amount,
            nullif(trim(v_p ->> 'reference'), ''), auth.uid());
    v_sum := v_sum + v_amount;
  end loop;
  return v_sum;
end;
$$;

revoke all on function public.gold_insert_doc_payments(uuid, uuid, text, jsonb, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.gold_check_customer(p_tenant_id uuid, p_customer_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_customer_id is null
     or not exists (select 1 from public.gold_customers where id = p_customer_id and tenant_id = p_tenant_id and is_active) then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.gold_check_customer(uuid, uuid) from public, anon, authenticated;

create or replace function public.gold_check_active_store(p_tenant_id uuid, p_store_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.gold_stores where id = p_store_id and tenant_id = p_tenant_id and is_active) then
    raise exception 'INVALID_STORE' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.gold_check_active_store(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Cash sessions (kas harian)
-- -----------------------------------------------------------------------------
-- Breakdown of the drawer for a session (internal; up to now while open)
create or replace function public.gold_cash_session_totals(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s record;
  v_to timestamptz;
  v_src jsonb;
  v_mov_in numeric;
  v_mov_out numeric;
  v_pay_net numeric;
begin
  select * into v_s from public.gold_cash_sessions where id = p_session_id;
  v_to := coalesce(v_s.closed_at, now());

  select coalesce(jsonb_object_agg(src, jsonb_build_object('in', cin, 'out', cout)), '{}'::jsonb),
         coalesce(sum(cin - cout), 0)
    into v_src, v_pay_net
  from (
    select case
             when sale_id is not null then 'SALE'
             when buyback_id is not null then 'BUYBACK'
             when purchase_id is not null then 'PURCHASE'
             when expense_id is not null then 'EXPENSE'
             when order_id is not null then 'ORDER'
             when repair_id is not null then 'REPAIR'
             else 'OTHER'
           end as src,
           coalesce(sum(amount) filter (where direction = 'IN'), 0) as cin,
           coalesce(sum(amount) filter (where direction = 'OUT'), 0) as cout
    from public.gold_payments
    where tenant_id = v_s.tenant_id and store_id = v_s.store_id and method = 'CASH'
      and paid_at >= v_s.opened_at and paid_at <= v_to
    group by 1
  ) t;

  select coalesce(sum(amount) filter (where direction = 'IN'), 0), coalesce(sum(amount) filter (where direction = 'OUT'), 0)
    into v_mov_in, v_mov_out
  from public.gold_cash_movements where session_id = p_session_id;

  return jsonb_build_object(
    'opening', v_s.opening_amount,
    'sources', v_src,
    'payments_net', v_pay_net,
    'movements_in', v_mov_in,
    'movements_out', v_mov_out,
    'expected', v_s.opening_amount + v_pay_net + v_mov_in - v_mov_out
  );
end;
$$;

revoke all on function public.gold_cash_session_totals(uuid) from public, anon, authenticated;

create or replace function public.gold_cash_session_summary(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('cash.manage');
  v_s record;
begin
  select * into v_s from public.gold_cash_sessions where id = p_session_id and tenant_id = v_tenant;
  if not found or not public.gold_can_access_store(v_s.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  return public.gold_cash_session_totals(p_session_id);
end;
$$;

create or replace function public.gold_open_cash_session(p_store_id uuid, p_opening_amount numeric, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('cash.manage', p_store_id);
  v_id uuid := gen_random_uuid();
  v_number text;
begin
  perform public.gold_check_active_store(v_tenant, p_store_id);
  if p_opening_amount is null or p_opening_amount < 0 or p_opening_amount <> round(p_opening_amount, 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if exists (select 1 from public.gold_cash_sessions where store_id = p_store_id and status = 'OPEN') then
    raise exception 'SESSION_ALREADY_OPEN' using errcode = '22023';
  end if;
  v_number := public.gold_next_document_number(v_tenant, 'KAS');
  insert into public.gold_cash_sessions (id, tenant_id, store_id, session_number, opening_amount, opened_by, notes)
  values (v_id, v_tenant, p_store_id, v_number, p_opening_amount, auth.uid(), nullif(trim(p_notes), ''));
  perform public.gold_log_audit(v_tenant, 'CASH_OPEN', 'cash_session', v_id::text, null,
    jsonb_build_object('session_number', v_number, 'opening_amount', p_opening_amount));
  return v_id;
end;
$$;

create or replace function public.gold_add_cash_movement(p_session_id uuid, p_direction text, p_amount numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('cash.manage');
  v_s record;
  v_id uuid;
begin
  select * into v_s from public.gold_cash_sessions where id = p_session_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_s.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_s.status <> 'OPEN' then
    raise exception 'SESSION_CLOSED' using errcode = '22023';
  end if;
  if p_direction not in ('IN', 'OUT') then
    raise exception 'INVALID_DIRECTION' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;
  insert into public.gold_cash_movements (tenant_id, session_id, store_id, direction, amount, reason, created_by)
  values (v_tenant, p_session_id, v_s.store_id, p_direction, p_amount, trim(p_reason), auth.uid())
  returning id into v_id;
  perform public.gold_log_audit(v_tenant, 'CASH_MOVEMENT', 'cash_session', p_session_id::text, null,
    jsonb_build_object('direction', p_direction, 'amount', p_amount, 'reason', trim(p_reason)));
  return v_id;
end;
$$;

create or replace function public.gold_close_cash_session(p_session_id uuid, p_counted_amount numeric, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('cash.manage');
  v_s record;
  v_totals jsonb;
  v_expected numeric;
begin
  select * into v_s from public.gold_cash_sessions where id = p_session_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_s.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_s.status <> 'OPEN' then
    raise exception 'SESSION_CLOSED' using errcode = '22023';
  end if;
  if p_counted_amount is null or p_counted_amount < 0 or p_counted_amount <> round(p_counted_amount, 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  update public.gold_cash_sessions set closed_at = now() where id = p_session_id;
  v_totals := public.gold_cash_session_totals(p_session_id);
  v_expected := (v_totals ->> 'expected')::numeric;
  if p_counted_amount <> v_expected and coalesce(trim(p_notes), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;

  update public.gold_cash_sessions
     set status = 'CLOSED', closed_by = auth.uid(), expected_amount = v_expected, counted_amount = p_counted_amount,
         difference = p_counted_amount - v_expected, close_notes = nullif(trim(p_notes), '')
   where id = p_session_id;
  perform public.gold_log_audit(v_tenant, 'CASH_CLOSE', 'cash_session', p_session_id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted_amount, 'difference', p_counted_amount - v_expected));
  return v_totals || jsonb_build_object('counted', p_counted_amount, 'difference', p_counted_amount - v_expected);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Expenses (biaya operasional)
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_expense(
  p_store_id uuid, p_expense_date date, p_category text, p_description text, p_amount numeric,
  p_method text, p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('expenses.manage', p_store_id);
  v_id uuid := gen_random_uuid();
  v_number text;
begin
  perform public.gold_check_active_store(v_tenant, p_store_id);
  if p_expense_date is null or p_expense_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  v_number := public.gold_next_document_number(v_tenant, 'EXP');
  insert into public.gold_expenses (id, tenant_id, store_id, expense_number, expense_date, category, description, amount, created_by)
  values (v_id, v_tenant, p_store_id, v_number, p_expense_date, p_category, trim(p_description), p_amount, auth.uid());
  perform public.gold_insert_doc_payments(v_tenant, p_store_id, 'OUT',
    jsonb_build_array(jsonb_build_object('method', p_method, 'amount', p_amount, 'reference', p_reference)), v_id, null, null);
  perform public.gold_log_audit(v_tenant, 'EXPENSE', 'expense', v_id::text, null,
    jsonb_build_object('expense_number', v_number, 'category', p_category, 'amount', p_amount));
  return v_id;
end;
$$;

create or replace function public.gold_void_expense(p_expense_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('expenses.manage');
  v_e record;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into v_e from public.gold_expenses where id = p_expense_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_e.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_e.status = 'VOIDED' then
    raise exception 'ALREADY_VOIDED' using errcode = '22023';
  end if;
  insert into public.gold_payments (tenant_id, store_id, expense_id, direction, method, amount, reference, is_reversal, created_by)
  select tenant_id, store_id, expense_id, 'IN', method, amount, 'VOID ' || v_e.expense_number, true, auth.uid()
  from public.gold_payments where expense_id = p_expense_id and not is_reversal;
  update public.gold_payments set status = 'REFUNDED' where expense_id = p_expense_id and not is_reversal;
  update public.gold_expenses set status = 'VOIDED', voided_at = now(), void_reason = trim(p_reason) where id = p_expense_id;
  perform public.gold_log_audit(v_tenant, 'VOID_EXPENSE', 'expense', p_expense_id::text,
    jsonb_build_object('status', 'ACTIVE', 'amount', v_e.amount), jsonb_build_object('status', 'VOIDED', 'reason', trim(p_reason)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Orders / DP (pesanan): pieces RESERVED, price locked, paid in instalments,
--    completed into a normal sale (payments are re-attached to the sale).
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_order(
  p_store_id uuid, p_customer_id uuid, p_items jsonb, p_payments jsonb, p_expected_total numeric,
  p_due_date date default null, p_notes text default null
)
returns table (order_id uuid, order_number text, total numeric, paid_total numeric)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('orders.manage', p_store_id);
  v_id uuid := gen_random_uuid();
  v_number text;
  v_line jsonb;
  v_item record;
  v_q record;
  v_discount numeric;
  v_ids uuid[];
  v_sub numeric := 0;
  v_disc numeric := 0;
  v_paid numeric;
begin
  perform public.gold_check_active_store(v_tenant, p_store_id);
  perform public.gold_check_customer(v_tenant, p_customer_id);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;
  if p_due_date is not null and p_due_date < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  select array_agg((x ->> 'inventory_id')::uuid) into v_ids from jsonb_array_elements(p_items) x;
  if cardinality(v_ids) <> (select count(distinct u) from unnest(v_ids) u) then
    raise exception 'DUPLICATE_ITEM' using errcode = '22023';
  end if;
  perform 1 from public.gold_inventory where tenant_id = v_tenant and id = any (v_ids) order by id for update;

  v_number := public.gold_next_document_number(v_tenant, 'PSN');
  insert into public.gold_orders (id, tenant_id, store_id, order_number, customer_id, subtotal, discount_total, total, due_date, notes, created_by)
  values (v_id, v_tenant, p_store_id, v_number, p_customer_id, 0, 0, 0, p_due_date, nullif(trim(p_notes), ''), auth.uid());

  for v_line in select * from jsonb_array_elements(p_items) loop
    select i.*, p.code as purity_code, p.percentage as purity_pct into v_item
    from public.gold_inventory i join public.gold_purities p on p.id = i.purity_id
    where i.id = (v_line ->> 'inventory_id')::uuid and i.tenant_id = v_tenant;
    if not found or v_item.status <> 'AVAILABLE' or v_item.store_id <> p_store_id then
      raise exception 'ITEM_NOT_AVAILABLE:%', coalesce(v_item.barcode, v_line ->> 'inventory_id') using errcode = '22023';
    end if;
    v_discount := coalesce((v_line ->> 'discount')::numeric, 0);
    if v_discount < 0 or v_discount <> round(v_discount, 0) then
      raise exception 'INVALID_AMOUNT' using errcode = '22023';
    end if;
    select * into v_q from public.gold_price_quote(v_tenant, v_item.purity_id, v_item.gold_weight,
      v_item.labor_cost, v_item.stone_price, v_item.margin_amount, v_discount);
    if not found then
      raise exception 'RATE_NOT_SET:%', v_item.purity_code using errcode = '22023';
    end if;

    insert into public.gold_order_items (tenant_id, order_id, inventory_id, product_id, barcode, name, purity_code, purity_pct,
      gross_weight, gold_weight, rate_id, sell_rate, gold_value, labor_cost, stone_price, margin_amount, subtotal, discount, price, cost_price)
    values (v_tenant, v_id, v_item.id, v_item.product_id, v_item.barcode, v_item.name, v_item.purity_code, v_item.purity_pct,
      v_item.gross_weight, v_item.gold_weight, v_q.rate_id, v_q.sell_rate, v_q.gold_value, v_item.labor_cost, v_item.stone_price,
      v_item.margin_amount, v_q.subtotal, v_q.discount, v_q.total, v_item.cost_price);

    update public.gold_inventory set status = 'RESERVED' where id = v_item.id;
    perform public.gold_log_movement(v_tenant, v_item.id, 'ADJUSTMENT', 0, v_item.gold_weight, v_item.gross_weight, v_item.gross_weight,
      v_item.store_id, null, v_item.location_id, null, 'AVAILABLE', 'RESERVED', 'ORDER', v_id, 'Dipesan ' || v_number);

    v_sub := v_sub + v_q.subtotal;
    v_disc := v_disc + v_q.discount;
  end loop;

  if p_expected_total is null or p_expected_total <> v_sub - v_disc then
    raise exception 'PRICE_CHANGED:%', v_sub - v_disc using errcode = '22023';
  end if;
  update public.gold_orders set subtotal = v_sub, discount_total = v_disc, total = v_sub - v_disc where id = v_id;

  v_paid := public.gold_insert_doc_payments(v_tenant, p_store_id, 'IN', p_payments, null, v_id, null);
  if v_paid > v_sub - v_disc then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;
  update public.gold_orders set paid_total = v_paid where id = v_id;

  perform public.gold_log_audit(v_tenant, 'ORDER', 'order', v_id::text, null,
    jsonb_build_object('order_number', v_number, 'total', v_sub - v_disc, 'paid', v_paid, 'items', jsonb_array_length(p_items)));
  return query select v_id, v_number, v_sub - v_disc, v_paid;
end;
$$;

create or replace function public.gold_pay_order(p_order_id uuid, p_payments jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('orders.manage');
  v_o record;
  v_paid numeric;
begin
  select * into v_o from public.gold_orders where id = p_order_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_o.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_o.status <> 'OPEN' then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  v_paid := public.gold_insert_doc_payments(v_tenant, v_o.store_id, 'IN', p_payments, null, p_order_id, null);
  if v_paid <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if v_o.paid_total + v_paid > v_o.total then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;
  update public.gold_orders set paid_total = paid_total + v_paid where id = p_order_id;
  perform public.gold_log_audit(v_tenant, 'ORDER_PAYMENT', 'order', p_order_id::text, null, jsonb_build_object('amount', v_paid));
  return v_o.paid_total + v_paid;
end;
$$;

-- Pick-up: pay the rest (optional) and turn the order into a completed sale at the locked prices
create or replace function public.gold_complete_order(p_order_id uuid, p_payments jsonb default null)
returns table (sale_id uuid, invoice_number text, public_token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('orders.manage');
  v_o record;
  v_paid numeric;
  v_sale uuid := gen_random_uuid();
  v_invoice text;
  v_token uuid;
  v_item record;
begin
  if not public.gold_has_permission('sales.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_o from public.gold_orders where id = p_order_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_o.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_o.status <> 'OPEN' then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  v_paid := public.gold_insert_doc_payments(v_tenant, v_o.store_id, 'IN', p_payments, null, p_order_id, null);
  if v_o.paid_total + v_paid > v_o.total then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;
  if v_o.paid_total + v_paid < v_o.total then
    raise exception 'INSUFFICIENT_PAYMENT' using errcode = '22023';
  end if;

  v_invoice := public.gold_next_document_number(v_tenant, 'INV');
  insert into public.gold_sales (id, tenant_id, store_id, invoice_number, customer_id, cashier_id,
                                 subtotal, discount_total, total, paid_total, change_amount, notes)
  values (v_sale, v_tenant, v_o.store_id, v_invoice, v_o.customer_id, auth.uid(),
          v_o.subtotal, v_o.discount_total, v_o.total, v_o.total, 0, 'Pesanan ' || v_o.order_number)
  returning gold_sales.public_token into v_token;

  for v_item in
    select oi.*, i.status as cur_status, i.store_id as cur_store, i.location_id as cur_location
    from public.gold_order_items oi join public.gold_inventory i on i.id = oi.inventory_id
    where oi.order_id = p_order_id order by oi.inventory_id for update of i
  loop
    if v_item.cur_status <> 'RESERVED' then
      raise exception 'ITEM_NOT_AVAILABLE:%', v_item.barcode using errcode = '22023';
    end if;
    insert into public.gold_sale_items (tenant_id, sale_id, inventory_id, product_id, barcode, name, purity_code, purity_pct,
      gross_weight, gold_weight, rate_id, sell_rate, gold_value, labor_cost, stone_price, margin_amount, subtotal, discount, price, cost_price)
    values (v_tenant, v_sale, v_item.inventory_id, v_item.product_id, v_item.barcode, v_item.name, v_item.purity_code, v_item.purity_pct,
      v_item.gross_weight, v_item.gold_weight, v_item.rate_id, v_item.sell_rate, v_item.gold_value, v_item.labor_cost, v_item.stone_price,
      v_item.margin_amount, v_item.subtotal, v_item.discount, v_item.price, v_item.cost_price);
    update public.gold_inventory set status = 'SOLD' where id = v_item.inventory_id;
    perform public.gold_log_movement(v_tenant, v_item.inventory_id, 'SALE', -1, v_item.gold_weight, v_item.gross_weight, v_item.gross_weight,
      v_item.cur_store, null, v_item.cur_location, null, 'RESERVED', 'SOLD', 'SALE', v_sale, 'Pesanan ' || v_o.order_number);
  end loop;

  -- the money was received on the order: the same payment rows now also belong to the sale
  update public.gold_payments set sale_id = v_sale where order_id = p_order_id;
  update public.gold_orders set status = 'COMPLETED', paid_total = total, sale_id = v_sale, completed_at = now() where id = p_order_id;

  perform public.gold_log_audit(v_tenant, 'SALE', 'sale', v_sale::text, null,
    jsonb_build_object('invoice_number', v_invoice, 'total', v_o.total, 'order_number', v_o.order_number, 'customer_id', v_o.customer_id));
  return query select v_sale, v_invoice, v_token;
end;
$$;

-- Cancel: pieces back on display; p_refunds (OUT) ≤ paid, the rest of the DP is forfeited
create or replace function public.gold_cancel_order(p_order_id uuid, p_reason text, p_refunds jsonb default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('orders.manage');
  v_o record;
  v_refund numeric;
  v_item record;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into v_o from public.gold_orders where id = p_order_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_o.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_o.status <> 'OPEN' then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  v_refund := public.gold_insert_doc_payments(v_tenant, v_o.store_id, 'OUT', p_refunds, null, p_order_id, null);
  if v_refund > v_o.paid_total then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;

  for v_item in
    select i.* from public.gold_inventory i join public.gold_order_items oi on oi.inventory_id = i.id
    where oi.order_id = p_order_id and i.status = 'RESERVED' order by i.id for update of i
  loop
    update public.gold_inventory set status = 'AVAILABLE' where id = v_item.id;
    perform public.gold_log_movement(v_tenant, v_item.id, 'ADJUSTMENT', 0, v_item.gold_weight, v_item.gross_weight, v_item.gross_weight,
      v_item.store_id, null, v_item.location_id, null, 'RESERVED', 'AVAILABLE', 'ORDER', p_order_id, 'Pesanan batal ' || v_o.order_number);
  end loop;

  update public.gold_orders set status = 'CANCELLED', refund_total = v_refund, cancelled_at = now(), cancel_reason = trim(p_reason)
   where id = p_order_id;
  perform public.gold_log_audit(v_tenant, 'CANCEL_ORDER', 'order', p_order_id::text,
    jsonb_build_object('status', 'OPEN', 'paid', v_o.paid_total), jsonb_build_object('status', 'CANCELLED', 'refund', v_refund, 'reason', trim(p_reason)));
  return v_refund;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Repairs (servis perhiasan milik customer — not store stock)
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_repair(
  p_store_id uuid, p_customer_id uuid, p_item_description text, p_service_type text, p_weight_in numeric,
  p_estimated_cost numeric, p_due_date date, p_payments jsonb, p_notes text default null
)
returns table (repair_id uuid, repair_number text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('repairs.manage', p_store_id);
  v_id uuid := gen_random_uuid();
  v_number text;
  v_paid numeric;
begin
  perform public.gold_check_active_store(v_tenant, p_store_id);
  perform public.gold_check_customer(v_tenant, p_customer_id);
  if coalesce(p_estimated_cost, 0) < 0 or coalesce(p_estimated_cost, 0) <> round(coalesce(p_estimated_cost, 0), 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if p_due_date is not null and p_due_date < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  v_number := public.gold_next_document_number(v_tenant, 'SRV');
  insert into public.gold_repairs (id, tenant_id, store_id, repair_number, customer_id, item_description, service_type, weight_in,
                                   estimated_cost, due_date, notes, created_by)
  values (v_id, v_tenant, p_store_id, v_number, p_customer_id, trim(p_item_description), trim(p_service_type), p_weight_in,
          coalesce(p_estimated_cost, 0), p_due_date, nullif(trim(p_notes), ''), auth.uid());
  v_paid := public.gold_insert_doc_payments(v_tenant, p_store_id, 'IN', p_payments, null, null, v_id);
  update public.gold_repairs set paid_total = v_paid where id = v_id;
  perform public.gold_log_audit(v_tenant, 'REPAIR', 'repair', v_id::text, null,
    jsonb_build_object('repair_number', v_number, 'estimated_cost', coalesce(p_estimated_cost, 0), 'paid', v_paid));
  return query select v_id, v_number;
end;
$$;

create or replace function public.gold_update_repair_status(p_repair_id uuid, p_status text, p_final_cost numeric default null, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('repairs.manage');
  v_r record;
begin
  select * into v_r from public.gold_repairs where id = p_repair_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_r.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if not ((v_r.status = 'RECEIVED' and p_status in ('IN_PROGRESS', 'READY'))
       or (v_r.status = 'IN_PROGRESS' and p_status in ('RECEIVED', 'READY'))
       or (v_r.status = 'READY' and p_status = 'IN_PROGRESS')) then
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;
  if p_final_cost is not null and (p_final_cost < 0 or p_final_cost <> round(p_final_cost, 0)) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  update public.gold_repairs
     set status = p_status,
         final_cost = coalesce(p_final_cost, final_cost),
         ready_at = case when p_status = 'READY' then now() else ready_at end,
         notes = coalesce(nullif(trim(p_notes), ''), notes)
   where id = p_repair_id;
  perform public.gold_log_audit(v_tenant, 'REPAIR_STATUS', 'repair', p_repair_id::text,
    jsonb_build_object('status', v_r.status), jsonb_build_object('status', p_status, 'final_cost', p_final_cost));
end;
$$;

create or replace function public.gold_pay_repair(p_repair_id uuid, p_payments jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('repairs.manage');
  v_r record;
  v_paid numeric;
begin
  select * into v_r from public.gold_repairs where id = p_repair_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_r.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_r.status in ('PICKED_UP', 'CANCELLED') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  v_paid := public.gold_insert_doc_payments(v_tenant, v_r.store_id, 'IN', p_payments, null, null, p_repair_id);
  if v_paid <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  update public.gold_repairs set paid_total = paid_total + v_paid where id = p_repair_id;
  perform public.gold_log_audit(v_tenant, 'REPAIR_PAYMENT', 'repair', p_repair_id::text, null, jsonb_build_object('amount', v_paid));
  return v_r.paid_total + v_paid;
end;
$$;

-- Hand the item back: final cost fixed, must be fully paid (extra DP is refunded in p_refunds)
create or replace function public.gold_pickup_repair(p_repair_id uuid, p_final_cost numeric, p_payments jsonb default null, p_refunds jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('repairs.manage');
  v_r record;
  v_paid numeric;
  v_refund numeric;
begin
  select * into v_r from public.gold_repairs where id = p_repair_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_r.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_r.status in ('PICKED_UP', 'CANCELLED') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  if p_final_cost is null or p_final_cost < 0 or p_final_cost <> round(p_final_cost, 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  v_paid := public.gold_insert_doc_payments(v_tenant, v_r.store_id, 'IN', p_payments, null, null, p_repair_id);
  v_refund := public.gold_insert_doc_payments(v_tenant, v_r.store_id, 'OUT', p_refunds, null, null, p_repair_id);
  if v_r.paid_total + v_paid - v_refund <> p_final_cost then
    raise exception 'PAYMENT_MISMATCH' using errcode = '22023';
  end if;
  update public.gold_repairs
     set status = 'PICKED_UP', final_cost = p_final_cost, paid_total = paid_total + v_paid, refund_total = refund_total + v_refund,
         picked_up_at = now()
   where id = p_repair_id;
  perform public.gold_log_audit(v_tenant, 'REPAIR_PICKUP', 'repair', p_repair_id::text, null,
    jsonb_build_object('final_cost', p_final_cost, 'paid', v_r.paid_total + v_paid, 'refund', v_refund));
end;
$$;

create or replace function public.gold_cancel_repair(p_repair_id uuid, p_reason text, p_refunds jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('repairs.manage');
  v_r record;
  v_refund numeric;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into v_r from public.gold_repairs where id = p_repair_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_r.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_r.status in ('PICKED_UP', 'CANCELLED') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  v_refund := public.gold_insert_doc_payments(v_tenant, v_r.store_id, 'OUT', p_refunds, null, null, p_repair_id);
  if v_refund > v_r.paid_total then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;
  update public.gold_repairs
     set status = 'CANCELLED', refund_total = refund_total + v_refund, cancelled_at = now(), cancel_reason = trim(p_reason)
   where id = p_repair_id;
  perform public.gold_log_audit(v_tenant, 'CANCEL_REPAIR', 'repair', p_repair_id::text,
    jsonb_build_object('status', v_r.status), jsonb_build_object('status', 'CANCELLED', 'refund', v_refund, 'reason', trim(p_reason)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Buyback resale: a bought-back piece goes back on display with selling components
-- -----------------------------------------------------------------------------
create or replace function public.gold_buyback_resell(
  p_inventory_id uuid, p_location_id uuid, p_labor_cost numeric, p_stone_price numeric, p_margin_amount numeric, p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('inventory.manage');
  v_i record;
begin
  select * into v_i from public.gold_inventory where id = p_inventory_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_i.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_i.status <> 'BUYBACK' then
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;
  if coalesce(p_labor_cost, 0) < 0 or coalesce(p_stone_price, 0) < 0 or coalesce(p_margin_amount, 0) < 0
     or coalesce(p_labor_cost, 0) <> round(coalesce(p_labor_cost, 0), 0)
     or coalesce(p_stone_price, 0) <> round(coalesce(p_stone_price, 0), 0)
     or coalesce(p_margin_amount, 0) <> round(coalesce(p_margin_amount, 0), 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  perform public.gold_check_location(v_tenant, v_i.store_id, p_location_id);

  update public.gold_inventory
     set status = 'AVAILABLE', location_id = p_location_id, labor_per_gram = null,
         labor_cost = coalesce(p_labor_cost, 0), stone_price = coalesce(p_stone_price, 0), margin_amount = coalesce(p_margin_amount, 0)
   where id = p_inventory_id;
  perform public.gold_log_movement(v_tenant, p_inventory_id, 'ADJUSTMENT', 0, v_i.gold_weight, v_i.gross_weight, v_i.gross_weight,
    v_i.store_id, v_i.store_id, v_i.location_id, p_location_id, 'BUYBACK', 'AVAILABLE', null, null,
    coalesce(nullif(trim(p_notes), ''), 'Buyback dipajang untuk dijual'));
  perform public.gold_log_audit(v_tenant, 'BUYBACK_RESELL', 'inventory', p_inventory_id::text,
    jsonb_build_object('status', 'BUYBACK', 'labor_cost', v_i.labor_cost, 'margin_amount', v_i.margin_amount),
    jsonb_build_object('status', 'AVAILABLE', 'labor_cost', coalesce(p_labor_cost, 0), 'stone_price', coalesce(p_stone_price, 0),
                       'margin_amount', coalesce(p_margin_amount, 0)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Reports: operating expenses, repair income, forfeited order deposits
--     (SECURITY INVOKER -> caller's RLS). Day boundaries Asia/Jakarta.
-- -----------------------------------------------------------------------------
create or replace function public.gold_report_operations(p_from timestamptz, p_to timestamptz, p_store_id uuid default null)
returns table (expense_total numeric, expense_count bigint, repair_income numeric, repair_count bigint, order_forfeit numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with e as (
    select coalesce(sum(amount), 0) as total, count(*) as cnt
    from public.gold_expenses
    where status = 'ACTIVE'
      and expense_date >= (p_from at time zone 'Asia/Jakarta')::date
      and expense_date <= ((p_to - interval '1 second') at time zone 'Asia/Jakarta')::date
      and (p_store_id is null or store_id = p_store_id)
  ), r as (
    select coalesce(sum(final_cost), 0) as total, count(*) as cnt
    from public.gold_repairs
    where status = 'PICKED_UP' and picked_up_at >= p_from and picked_up_at < p_to
      and (p_store_id is null or store_id = p_store_id)
  ), o as (
    select coalesce(sum(paid_total - refund_total), 0) as total
    from public.gold_orders
    where status = 'CANCELLED' and cancelled_at >= p_from and cancelled_at < p_to
      and (p_store_id is null or store_id = p_store_id)
  )
  select e.total, e.cnt, r.total, r.cnt, o.total from e, r, o
$$;

create or replace function public.gold_report_expenses(p_from timestamptz, p_to timestamptz, p_store_id uuid default null)
returns table (category text, total numeric, expense_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select category, sum(amount), count(*)
  from public.gold_expenses
  where status = 'ACTIVE'
    and expense_date >= (p_from at time zone 'Asia/Jakarta')::date
    and expense_date <= ((p_to - interval '1 second') at time zone 'Asia/Jakarta')::date
    and (p_store_id is null or store_id = p_store_id)
  group by category
  order by sum(amount) desc
$$;

-- -----------------------------------------------------------------------------
-- 12. Grants
-- -----------------------------------------------------------------------------
revoke all on function public.gold_cash_session_summary(uuid) from public, anon;
revoke all on function public.gold_open_cash_session(uuid, numeric, text) from public, anon;
revoke all on function public.gold_add_cash_movement(uuid, text, numeric, text) from public, anon;
revoke all on function public.gold_close_cash_session(uuid, numeric, text) from public, anon;
revoke all on function public.gold_create_expense(uuid, date, text, text, numeric, text, text) from public, anon;
revoke all on function public.gold_void_expense(uuid, text) from public, anon;
revoke all on function public.gold_create_order(uuid, uuid, jsonb, jsonb, numeric, date, text) from public, anon;
revoke all on function public.gold_pay_order(uuid, jsonb) from public, anon;
revoke all on function public.gold_complete_order(uuid, jsonb) from public, anon;
revoke all on function public.gold_cancel_order(uuid, text, jsonb) from public, anon;
revoke all on function public.gold_create_repair(uuid, uuid, text, text, numeric, numeric, date, jsonb, text) from public, anon;
revoke all on function public.gold_update_repair_status(uuid, text, numeric, text) from public, anon;
revoke all on function public.gold_pay_repair(uuid, jsonb) from public, anon;
revoke all on function public.gold_pickup_repair(uuid, numeric, jsonb, jsonb) from public, anon;
revoke all on function public.gold_cancel_repair(uuid, text, jsonb) from public, anon;
revoke all on function public.gold_buyback_resell(uuid, uuid, numeric, numeric, numeric, text) from public, anon;
revoke all on function public.gold_report_operations(timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.gold_report_expenses(timestamptz, timestamptz, uuid) from public, anon;

grant execute on function public.gold_cash_session_summary(uuid) to authenticated;
grant execute on function public.gold_open_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.gold_add_cash_movement(uuid, text, numeric, text) to authenticated;
grant execute on function public.gold_close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.gold_create_expense(uuid, date, text, text, numeric, text, text) to authenticated;
grant execute on function public.gold_void_expense(uuid, text) to authenticated;
grant execute on function public.gold_create_order(uuid, uuid, jsonb, jsonb, numeric, date, text) to authenticated;
grant execute on function public.gold_pay_order(uuid, jsonb) to authenticated;
grant execute on function public.gold_complete_order(uuid, jsonb) to authenticated;
grant execute on function public.gold_cancel_order(uuid, text, jsonb) to authenticated;
grant execute on function public.gold_create_repair(uuid, uuid, text, text, numeric, numeric, date, jsonb, text) to authenticated;
grant execute on function public.gold_update_repair_status(uuid, text, numeric, text) to authenticated;
grant execute on function public.gold_pay_repair(uuid, jsonb) to authenticated;
grant execute on function public.gold_pickup_repair(uuid, numeric, jsonb, jsonb) to authenticated;
grant execute on function public.gold_cancel_repair(uuid, text, jsonb) to authenticated;
grant execute on function public.gold_buyback_resell(uuid, uuid, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.gold_report_operations(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.gold_report_expenses(timestamptz, timestamptz, uuid) to authenticated;
