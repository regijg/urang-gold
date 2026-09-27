-- =============================================================================
-- GoldPOS — Phase 5: POS sales, payments, invoice numbers, e-nota.
--
-- gold_create_sale is the ONLY way to sell. It runs the whole sale atomically
-- (master prompt §35): validate -> lock pieces -> price in DB -> sale + items +
-- payments -> SOLD -> SALE movements -> audit. Any failure rolls everything back.
-- Prices/totals from the browser are never trusted; the client only sends an
-- expected total so a rate change between quote and payment is detected.
-- =============================================================================

-- New permission: voiding a completed sale (owner/admin/manager only)
update public.gold_roles set permissions = array_append(permissions, 'sales.void')
where code in ('OWNER', 'ADMIN', 'MANAGER') and not ('sales.void' = any (permissions));

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.gold_sales (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.gold_tenants (id) on delete cascade,
  store_id       uuid not null,
  invoice_number text not null,
  customer_id    uuid,
  cashier_id     uuid references auth.users (id) on delete set null,
  status         text not null default 'COMPLETED' check (status in ('COMPLETED', 'VOIDED')),
  subtotal       numeric(15,2) not null check (subtotal >= 0),
  discount_total numeric(15,2) not null default 0 check (discount_total >= 0),
  total          numeric(15,2) not null check (total >= 0),
  paid_total     numeric(15,2) not null check (paid_total >= 0),
  change_amount  numeric(15,2) not null default 0 check (change_amount >= 0),
  notes          text check (length(notes) <= 1000),
  public_token   uuid not null default gen_random_uuid() unique,
  sold_at        timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references auth.users (id) on delete set null,
  void_reason    text check (length(void_reason) <= 500),
  created_at     timestamptz not null default now(),
  unique (tenant_id, invoice_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.gold_customers (tenant_id, id) on delete restrict,
  check (total = subtotal - discount_total),
  check (paid_total = total + change_amount)
);

create index gold_sales_tenant_sold_idx on public.gold_sales (tenant_id, sold_at desc);
create index gold_sales_store_idx on public.gold_sales (tenant_id, store_id, sold_at desc);
create index gold_sales_customer_idx on public.gold_sales (tenant_id, customer_id);
create index gold_sales_status_idx on public.gold_sales (tenant_id, status);
create index gold_sales_created_at_idx on public.gold_sales (created_at);

create table public.gold_sale_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.gold_tenants (id) on delete cascade,
  sale_id       uuid not null,
  inventory_id  uuid not null,
  product_id    uuid,
  -- snapshot at the time of sale
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
  foreign key (tenant_id, sale_id) references public.gold_sales (tenant_id, id) on delete cascade,
  foreign key (tenant_id, inventory_id) references public.gold_inventory (tenant_id, id) on delete restrict,
  check (price = subtotal - discount)
);

create index gold_sale_items_sale_idx on public.gold_sale_items (sale_id);
create index gold_sale_items_inventory_idx on public.gold_sale_items (inventory_id);
create index gold_sale_items_tenant_created_idx on public.gold_sale_items (tenant_id, created_at desc);

create table public.gold_payments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.gold_tenants (id) on delete cascade,
  store_id     uuid not null,
  sale_id      uuid,
  direction    text not null check (direction in ('IN', 'OUT')),     -- IN = money received, OUT = paid out / refund
  method       text not null check (method in ('CASH', 'BANK_TRANSFER', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD', 'TRADE_IN')),
  amount       numeric(15,2) not null check (amount > 0),
  reference    text check (length(reference) <= 100),
  provider     text not null default 'MANUAL' check (provider ~ '^[A-Z0-9_]{2,30}$'),
  provider_ref text check (length(provider_ref) <= 200),
  status       text not null default 'PAID' check (status in ('PAID', 'REFUNDED')),
  is_reversal  boolean not null default false,  -- mirror entry created by a void
  paid_at      timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, sale_id) references public.gold_sales (tenant_id, id) on delete restrict
);

create index gold_payments_tenant_paid_idx on public.gold_payments (tenant_id, paid_at desc);
create index gold_payments_sale_idx on public.gold_payments (sale_id);
create index gold_payments_method_idx on public.gold_payments (tenant_id, method, paid_at desc);
create index gold_payments_store_idx on public.gold_payments (tenant_id, store_id, paid_at desc);

-- -----------------------------------------------------------------------------
-- RLS: read-only for clients (writes only via RPCs)
-- -----------------------------------------------------------------------------
alter table public.gold_sales enable row level security;
alter table public.gold_sale_items enable row level security;
alter table public.gold_payments enable row level security;
revoke all on public.gold_sales, public.gold_sale_items, public.gold_payments from anon, authenticated;
grant select on public.gold_sales, public.gold_sale_items, public.gold_payments to authenticated;

create policy gold_sales_select on public.gold_sales for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('sales.manage') or public.gold_has_permission('reports.view')));

create policy gold_sale_items_select on public.gold_sale_items for select to authenticated
  using (tenant_id = public.gold_current_tenant_id()
         and exists (select 1 from public.gold_sales s where s.id = sale_id));  -- inherits gold_sales RLS

create policy gold_payments_select on public.gold_payments for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('sales.manage') or public.gold_has_permission('buybacks.manage')
              or public.gold_has_permission('reports.view')));

-- -----------------------------------------------------------------------------
-- Document numbers: <PREFIX>-YYYYMMDD-000001, daily counter per tenant (WIB date)
-- -----------------------------------------------------------------------------
create or replace function public.gold_next_document_number(p_tenant_id uuid, p_prefix text)
returns text
language sql
security definer
set search_path = public
as $$
  select p_prefix || '-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-'
         || lpad(public.gold_next_sequence(p_tenant_id,
                   p_prefix || ':' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD'))::text, 6, '0')
$$;

revoke all on function public.gold_next_document_number(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Internal: validate + insert payments for a document.
-- p_payments: [{ method, amount, reference?, provider?, provider_ref? }]
-- Returns total amount received.
-- -----------------------------------------------------------------------------
create or replace function public.gold_insert_payments(
  p_tenant_id uuid, p_store_id uuid, p_sale_id uuid, p_direction text, p_payments jsonb
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
  for v_p in select * from jsonb_array_elements(p_payments) loop
    v_method := v_p ->> 'method';
    v_amount := (v_p ->> 'amount')::numeric;
    if v_method not in ('CASH', 'BANK_TRANSFER', 'QRIS', 'DEBIT_CARD', 'CREDIT_CARD') then
      raise exception 'INVALID_PAYMENT_METHOD' using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 or v_amount <> round(v_amount, 0) then
      raise exception 'INVALID_AMOUNT' using errcode = '22023';
    end if;
    insert into public.gold_payments (tenant_id, store_id, sale_id, direction, method, amount, reference, provider, provider_ref, created_by)
    values (p_tenant_id, p_store_id, p_sale_id, p_direction, v_method, v_amount,
            nullif(trim(v_p ->> 'reference'), ''), coalesce(nullif(v_p ->> 'provider', ''), 'MANUAL'),
            nullif(trim(v_p ->> 'provider_ref'), ''), auth.uid());
    v_sum := v_sum + v_amount;
  end loop;
  return v_sum;
end;
$$;

revoke all on function public.gold_insert_payments(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Internal: sell pieces (used by gold_create_sale and, later, trade-in).
-- p_items: [{ inventory_id, discount? }]. Returns (subtotal, discount_total, total).
-- Assumes the sale row already exists.
-- -----------------------------------------------------------------------------
create or replace function public.gold_sell_pieces(
  p_tenant_id uuid, p_store_id uuid, p_sale_id uuid, p_items jsonb
)
returns table (subtotal numeric, discount_total numeric, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_item record;
  v_q record;
  v_discount numeric;
  v_sub numeric := 0;
  v_disc numeric := 0;
  v_ids uuid[];
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;

  select array_agg((x ->> 'inventory_id')::uuid) into v_ids from jsonb_array_elements(p_items) x;
  if cardinality(v_ids) <> (select count(distinct u) from unnest(v_ids) u) then
    raise exception 'DUPLICATE_ITEM' using errcode = '22023';
  end if;

  -- lock all pieces up-front in a stable order (avoids deadlocks between two tills)
  perform 1 from public.gold_inventory where tenant_id = p_tenant_id and id = any (v_ids) order by id for update;

  for v_line in select * from jsonb_array_elements(p_items) loop
    select i.*, p.code as purity_code, p.percentage as purity_pct
      into v_item
    from public.gold_inventory i
    join public.gold_purities p on p.id = i.purity_id
    where i.id = (v_line ->> 'inventory_id')::uuid and i.tenant_id = p_tenant_id;

    if not found or v_item.status <> 'AVAILABLE' or v_item.store_id <> p_store_id then
      raise exception 'ITEM_NOT_AVAILABLE:%', coalesce(v_item.barcode, v_line ->> 'inventory_id') using errcode = '22023';
    end if;

    v_discount := coalesce((v_line ->> 'discount')::numeric, 0);
    if v_discount < 0 or v_discount <> round(v_discount, 0) then
      raise exception 'INVALID_AMOUNT' using errcode = '22023';
    end if;

    select * into v_q from public.gold_price_quote(p_tenant_id, v_item.purity_id, v_item.gold_weight,
      v_item.labor_cost, v_item.stone_price, v_item.margin_amount, v_discount);
    if not found then
      raise exception 'RATE_NOT_SET:%', v_item.purity_code using errcode = '22023';
    end if;

    insert into public.gold_sale_items (
      tenant_id, sale_id, inventory_id, product_id, barcode, name, purity_code, purity_pct,
      gross_weight, gold_weight, rate_id, sell_rate, gold_value, labor_cost, stone_price, margin_amount,
      subtotal, discount, price, cost_price)
    values (
      p_tenant_id, p_sale_id, v_item.id, v_item.product_id, v_item.barcode, v_item.name, v_item.purity_code, v_item.purity_pct,
      v_item.gross_weight, v_item.gold_weight, v_q.rate_id, v_q.sell_rate, v_q.gold_value, v_item.labor_cost,
      v_item.stone_price, v_item.margin_amount, v_q.subtotal, v_q.discount, v_q.total, v_item.cost_price);

    update public.gold_inventory set status = 'SOLD' where id = v_item.id;

    perform public.gold_log_movement(p_tenant_id, v_item.id, 'SALE', -1, v_item.gold_weight,
      v_item.gross_weight, v_item.gross_weight, v_item.store_id, null, v_item.location_id, null,
      'AVAILABLE', 'SOLD', 'SALE', p_sale_id, null);

    v_sub := v_sub + v_q.subtotal;
    v_disc := v_disc + v_q.discount;
  end loop;

  return query select v_sub, v_disc, v_sub - v_disc;
end;
$$;

revoke all on function public.gold_sell_pieces(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: create a sale (atomic)
-- p_items    : [{ inventory_id, discount? }]
-- p_payments : [{ method, amount, reference? }]
-- p_expected_total: total shown to the cashier; mismatch => PRICE_CHANGED
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_sale(
  p_store_id uuid, p_customer_id uuid, p_items jsonb, p_payments jsonb,
  p_expected_total numeric, p_notes text default null
)
returns table (sale_id uuid, invoice_number text, total numeric, change_amount numeric, public_token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('pos.use', p_store_id);
  v_sale_id uuid := gen_random_uuid();
  v_invoice text;
  v_totals record;
  v_paid numeric;
  v_cash numeric;
  v_change numeric;
  v_token uuid;
begin
  if not public.gold_has_permission('sales.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.gold_stores where id = p_store_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_STORE' using errcode = '22023';
  end if;
  if p_customer_id is not null
     and not exists (select 1 from public.gold_customers where id = p_customer_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;

  v_invoice := public.gold_next_document_number(v_tenant, 'INV');

  -- header first (items reference it); totals are filled in after pricing
  insert into public.gold_sales (id, tenant_id, store_id, invoice_number, customer_id, cashier_id,
                                 subtotal, discount_total, total, paid_total, change_amount, notes)
  values (v_sale_id, v_tenant, p_store_id, v_invoice, p_customer_id, auth.uid(), 0, 0, 0, 0, 0, nullif(trim(p_notes), ''));

  select * into v_totals from public.gold_sell_pieces(v_tenant, p_store_id, v_sale_id, p_items);

  if p_expected_total is null or p_expected_total <> v_totals.total then
    raise exception 'PRICE_CHANGED:%', v_totals.total using errcode = '22023';
  end if;

  v_paid := public.gold_insert_payments(v_tenant, p_store_id, v_sale_id, 'IN', p_payments);
  if v_paid < v_totals.total then
    raise exception 'INSUFFICIENT_PAYMENT' using errcode = '22023';
  end if;
  v_change := v_paid - v_totals.total;
  select coalesce(sum(amount), 0) into v_cash from public.gold_payments where sale_id = v_sale_id and method = 'CASH';
  if v_change > v_cash then
    -- change can only be returned in cash; non-cash payments must not exceed the total
    raise exception 'PAYMENT_MISMATCH' using errcode = '22023';
  end if;

  if v_change > 0 then
    -- change handed back is money out of the drawer: cash balance = sum(IN) - sum(OUT)
    insert into public.gold_payments (tenant_id, store_id, sale_id, direction, method, amount, reference, created_by)
    values (v_tenant, p_store_id, v_sale_id, 'OUT', 'CASH', v_change, 'KEMBALIAN', auth.uid());
  end if;

  update public.gold_sales
     set subtotal = v_totals.subtotal, discount_total = v_totals.discount_total, total = v_totals.total,
         paid_total = v_paid, change_amount = v_change
   where id = v_sale_id
  returning gold_sales.public_token into v_token;

  perform public.gold_log_audit(v_tenant, 'SALE', 'sale', v_sale_id::text, null,
    jsonb_build_object('invoice_number', v_invoice, 'total', v_totals.total, 'discount_total', v_totals.discount_total,
                       'items', jsonb_array_length(p_items), 'customer_id', p_customer_id));

  return query select v_sale_id, v_invoice, v_totals.total, v_change, v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: void a completed sale. Pieces back to AVAILABLE (RETURN movement),
-- payments refunded (OUT entries). Requires sales.void.
-- -----------------------------------------------------------------------------
create or replace function public.gold_void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('sales.void');
  v_sale record;
  v_item record;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;

  select * into v_sale from public.gold_sales where id = p_sale_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_sale.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_sale.status = 'VOIDED' then
    raise exception 'ALREADY_VOIDED' using errcode = '22023';
  end if;

  for v_item in
    select i.* from public.gold_inventory i
    join public.gold_sale_items si on si.inventory_id = i.id
    where si.sale_id = p_sale_id
    order by i.id
    for update of i
  loop
    if v_item.status <> 'SOLD' then
      raise exception 'INVALID_STATUS:%', v_item.barcode using errcode = '22023';
    end if;
    update public.gold_inventory set status = 'AVAILABLE', store_id = v_sale.store_id where id = v_item.id;
    perform public.gold_log_movement(v_tenant, v_item.id, 'RETURN', 1, v_item.gold_weight,
      v_item.gross_weight, v_item.gross_weight, null, v_sale.store_id, null, v_item.location_id,
      'SOLD', 'AVAILABLE', 'SALE_VOID', p_sale_id, p_reason);
  end loop;

  -- refund: mirror every payment of the sale with the opposite direction
  insert into public.gold_payments (tenant_id, store_id, sale_id, direction, method, amount, reference, provider, is_reversal, created_by)
  select tenant_id, store_id, sale_id, case direction when 'IN' then 'OUT' else 'IN' end, method, amount,
         'VOID ' || v_sale.invoice_number, provider, true, auth.uid()
  from public.gold_payments where sale_id = p_sale_id and not is_reversal;
  update public.gold_payments set status = 'REFUNDED' where sale_id = p_sale_id and not is_reversal;

  update public.gold_sales set status = 'VOIDED', voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_sale_id;

  perform public.gold_log_audit(v_tenant, 'REFUND', 'sale', p_sale_id::text,
    jsonb_build_object('status', 'COMPLETED', 'total', v_sale.total),
    jsonb_build_object('status', 'VOIDED', 'reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Public e-nota: read one sale by its random token (no login). Returns JSON.
-- -----------------------------------------------------------------------------
create or replace function public.gold_get_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'invoice_number', s.invoice_number,
    'status', s.status,
    'sold_at', s.sold_at,
    'subtotal', s.subtotal, 'discount_total', s.discount_total, 'total', s.total,
    'paid_total', s.paid_total, 'change_amount', s.change_amount,
    'store', jsonb_build_object('name', st.name, 'address', st.address, 'phone', st.phone),
    'tenant', jsonb_build_object('name', t.name),
    'cashier', (select u.full_name from public.gold_users u where u.id = s.cashier_id),
    'customer', (select c.name from public.gold_customers c where c.id = s.customer_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', si.name, 'barcode', si.barcode, 'purity_code', si.purity_code,
        'gross_weight', si.gross_weight, 'gold_weight', si.gold_weight,
        'subtotal', si.subtotal, 'discount', si.discount, 'price', si.price) order by si.created_at, si.barcode)
      from public.gold_sale_items si where si.sale_id = s.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount) order by p.created_at)
      from public.gold_payments p where p.sale_id = s.id and p.direction = 'IN' and not p.is_reversal), '[]'::jsonb)
  )
  from public.gold_sales s
  join public.gold_stores st on st.id = s.store_id
  join public.gold_tenants t on t.id = s.tenant_id
  where s.public_token = p_token
$$;

revoke all on function public.gold_create_sale(uuid, uuid, jsonb, jsonb, numeric, text) from public, anon;
revoke all on function public.gold_void_sale(uuid, text) from public, anon;
revoke all on function public.gold_get_receipt(uuid) from public;
grant execute on function public.gold_create_sale(uuid, uuid, jsonb, jsonb, numeric, text) to authenticated;
grant execute on function public.gold_void_sale(uuid, text) to authenticated;
grant execute on function public.gold_get_receipt(uuid) to anon, authenticated;

-- =============================================================================
-- Staff management (needed so owners can create cashier accounts).
-- The auth user is created by the server with the admin API; these RPCs write
-- the profile + outlet access atomically. service_role only, and they re-check
-- the actor (same tenant, active, users.manage) as defense in depth.
-- =============================================================================
create or replace function public.gold_check_actor(p_actor_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select u.tenant_id into v_tenant
  from public.gold_users u
  join public.gold_roles r on r.code = u.role_code
  join public.gold_tenants t on t.id = u.tenant_id
  where u.id = p_actor_id and u.is_active and t.status = 'ACTIVE' and 'users.manage' = any (r.permissions);
  if v_tenant is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;

create or replace function public.gold_set_user_stores(p_tenant_id uuid, p_user_id uuid, p_store_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from unnest(coalesce(p_store_ids, '{}')) s
             where not exists (select 1 from public.gold_stores where id = s and tenant_id = p_tenant_id)) then
    raise exception 'INVALID_STORE' using errcode = '22023';
  end if;
  delete from public.gold_user_stores where user_id = p_user_id;
  insert into public.gold_user_stores (tenant_id, user_id, store_id)
  select p_tenant_id, p_user_id, s from unnest(coalesce(p_store_ids, '{}')) s group by s;
end;
$$;

create or replace function public.gold_add_staff(
  p_actor_id uuid, p_user_id uuid, p_email text, p_full_name text, p_phone text, p_role_code text, p_store_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_check_actor(p_actor_id);
begin
  if exists (select 1 from public.gold_users where id = p_user_id) then
    raise exception 'USER_ALREADY_REGISTERED' using errcode = '22023';
  end if;
  insert into public.gold_users (id, tenant_id, role_code, full_name, email, phone)
  values (p_user_id, v_tenant, p_role_code, trim(p_full_name), lower(trim(p_email)), nullif(trim(p_phone), ''));
  perform public.gold_set_user_stores(v_tenant, p_user_id, p_store_ids);
  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_data)
  values (v_tenant, p_actor_id, 'CREATE_USER', 'user', p_user_id::text,
          jsonb_build_object('email', lower(trim(p_email)), 'role_code', p_role_code, 'store_ids', to_jsonb(p_store_ids)));
end;
$$;

create or replace function public.gold_update_staff(
  p_actor_id uuid, p_user_id uuid, p_full_name text, p_phone text, p_role_code text, p_is_active boolean, p_store_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_check_actor(p_actor_id);
  v_old record;
begin
  select * into v_old from public.gold_users where id = p_user_id and tenant_id = v_tenant for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if p_user_id = p_actor_id and (p_role_code <> v_old.role_code or not p_is_active) then
    raise exception 'CANNOT_EDIT_SELF' using errcode = '22023';
  end if;
  if v_old.role_code = 'OWNER' and v_old.is_active and (p_role_code <> 'OWNER' or not p_is_active)
     and not exists (select 1 from public.gold_users where tenant_id = v_tenant and role_code = 'OWNER' and is_active and id <> p_user_id) then
    raise exception 'LAST_OWNER' using errcode = '22023';
  end if;

  update public.gold_users
     set full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''), role_code = p_role_code, is_active = p_is_active
   where id = p_user_id;
  perform public.gold_set_user_stores(v_tenant, p_user_id, p_store_ids);

  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_tenant, p_actor_id, 'UPDATE_USER', 'user', p_user_id::text,
          jsonb_build_object('role_code', v_old.role_code, 'is_active', v_old.is_active),
          jsonb_build_object('role_code', p_role_code, 'is_active', p_is_active, 'store_ids', to_jsonb(p_store_ids)));
end;
$$;

-- Returns the target's tenant check result for password resets done by the server.
create or replace function public.gold_can_manage_user(p_actor_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gold_users where id = p_user_id and tenant_id = public.gold_check_actor(p_actor_id))
$$;

revoke all on function public.gold_check_actor(uuid) from public, anon, authenticated;
revoke all on function public.gold_set_user_stores(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.gold_add_staff(uuid, uuid, text, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.gold_update_staff(uuid, uuid, text, text, text, boolean, uuid[]) from public, anon, authenticated;
revoke all on function public.gold_can_manage_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gold_add_staff(uuid, uuid, text, text, text, text, uuid[]) to service_role;
grant execute on function public.gold_update_staff(uuid, uuid, text, text, text, boolean, uuid[]) to service_role;
grant execute on function public.gold_can_manage_user(uuid, uuid) to service_role;
