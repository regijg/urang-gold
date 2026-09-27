-- =============================================================================
-- GoldPOS — Phase 8: purchases from suppliers (goods received -> inventory).
--
-- A purchase is recorded when goods arrive: every item becomes a piece (movement
-- PURCHASE, source PURCHASE) whose cost price = line total (cost + supplier labor).
-- Payment to the supplier can be made at once or later (gold_pay_purchase);
-- payment_status is derived from paid_total.
-- =============================================================================

create table public.gold_purchase_orders (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.gold_tenants (id) on delete cascade,
  store_id         uuid not null,
  supplier_id      uuid not null,
  purchase_number  text not null,
  supplier_invoice text check (length(supplier_invoice) <= 60),
  purchase_date    date not null,
  status           text not null default 'RECEIVED' check (status in ('RECEIVED', 'VOIDED')),
  subtotal_cost    numeric(15,2) not null check (subtotal_cost >= 0),
  labor_total      numeric(15,2) not null default 0 check (labor_total >= 0),
  total            numeric(15,2) not null check (total >= 0),
  paid_total       numeric(15,2) not null default 0 check (paid_total >= 0),
  payment_status   text not null default 'UNPAID' check (payment_status in ('UNPAID', 'PARTIAL', 'PAID')),
  notes            text check (length(notes) <= 1000),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  void_reason      text check (length(void_reason) <= 500),
  unique (tenant_id, purchase_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, supplier_id) references public.gold_suppliers (tenant_id, id) on delete restrict,
  check (total = subtotal_cost + labor_total),
  check (paid_total <= total)
);

create index gold_purchases_tenant_date_idx on public.gold_purchase_orders (tenant_id, purchase_date desc, created_at desc);
create index gold_purchases_supplier_idx on public.gold_purchase_orders (tenant_id, supplier_id);
create index gold_purchases_status_idx on public.gold_purchase_orders (tenant_id, status, payment_status);
create index gold_purchases_created_at_idx on public.gold_purchase_orders (created_at);

create table public.gold_purchase_order_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.gold_tenants (id) on delete cascade,
  purchase_id   uuid not null,
  inventory_id  uuid not null,
  product_id    uuid not null,
  purity_code   text not null,
  gross_weight  numeric(10,3) not null,
  stone_weight  numeric(10,3) not null default 0,
  gold_weight   numeric(10,3) not null,
  cost_price    numeric(15,2) not null check (cost_price >= 0),
  labor_cost    numeric(15,2) not null default 0 check (labor_cost >= 0),
  line_total    numeric(15,2) not null,
  created_at    timestamptz not null default now(),
  foreign key (tenant_id, purchase_id) references public.gold_purchase_orders (tenant_id, id) on delete cascade,
  foreign key (tenant_id, inventory_id) references public.gold_inventory (tenant_id, id) on delete restrict,
  foreign key (tenant_id, product_id) references public.gold_products (tenant_id, id) on delete restrict,
  check (line_total = cost_price + labor_cost)
);

create index gold_purchase_items_purchase_idx on public.gold_purchase_order_items (purchase_id);
create index gold_purchase_items_inventory_idx on public.gold_purchase_order_items (inventory_id);

alter table public.gold_payments add column purchase_id uuid;
alter table public.gold_payments add constraint gold_payments_purchase_fk
  foreign key (tenant_id, purchase_id) references public.gold_purchase_orders (tenant_id, id) on delete restrict;
create index gold_payments_purchase_idx on public.gold_payments (purchase_id);

alter table public.gold_purchase_orders enable row level security;
alter table public.gold_purchase_order_items enable row level security;
revoke all on public.gold_purchase_orders, public.gold_purchase_order_items from anon, authenticated;
grant select on public.gold_purchase_orders, public.gold_purchase_order_items to authenticated;

create policy gold_purchases_select on public.gold_purchase_orders for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('purchases.manage') or public.gold_has_permission('reports.view')));
create policy gold_purchase_items_select on public.gold_purchase_order_items for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and exists (select 1 from public.gold_purchase_orders p where p.id = purchase_id));

-- payments of purchases are visible to purchase managers as well
drop policy gold_payments_select on public.gold_payments;
create policy gold_payments_select on public.gold_payments for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('sales.manage') or public.gold_has_permission('buybacks.manage')
              or public.gold_has_permission('purchases.manage') or public.gold_has_permission('reports.view')));

-- -----------------------------------------------------------------------------
-- Internal: record supplier payments for a purchase and refresh its status
-- -----------------------------------------------------------------------------
create or replace function public.gold_apply_purchase_payments(p_tenant_id uuid, p_purchase_id uuid, p_payments jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po record;
  v_p jsonb;
  v_amount numeric;
  v_method text;
  v_sum numeric := 0;
begin
  select * into v_po from public.gold_purchase_orders where id = p_purchase_id and tenant_id = p_tenant_id for update;
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
    insert into public.gold_payments (tenant_id, store_id, purchase_id, direction, method, amount, reference, created_by)
    values (p_tenant_id, v_po.store_id, p_purchase_id, 'OUT', v_method, v_amount, nullif(trim(v_p ->> 'reference'), ''), auth.uid());
    v_sum := v_sum + v_amount;
  end loop;

  if v_po.paid_total + v_sum > v_po.total then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;
  update public.gold_purchase_orders
     set paid_total = paid_total + v_sum,
         payment_status = case when paid_total + v_sum = 0 then 'UNPAID' when paid_total + v_sum < total then 'PARTIAL' else 'PAID' end
   where id = p_purchase_id;
  return v_sum;
end;
$$;

revoke all on function public.gold_apply_purchase_payments(uuid, uuid, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: record a purchase (goods received)
-- p_items: [{ product_id, gross_weight, stone_weight?, serial_number?, cost_price, labor_cost? }]
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_purchase(
  p_store_id uuid, p_location_id uuid, p_supplier_id uuid, p_supplier_invoice text, p_purchase_date date,
  p_items jsonb, p_payments jsonb, p_notes text default null
)
returns table (purchase_id uuid, purchase_number text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('purchases.manage', p_store_id);
  v_id uuid := gen_random_uuid();
  v_number text;
  v_line jsonb;
  v_product record;
  v_inv uuid;
  v_cost numeric;
  v_labor numeric;
  v_gross numeric;
  v_stone numeric;
  v_sub numeric := 0;
  v_labor_total numeric := 0;
begin
  if not exists (select 1 from public.gold_stores where id = p_store_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_STORE' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gold_suppliers where id = p_supplier_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_SUPPLIER' using errcode = '22023';
  end if;
  if p_purchase_date is null or p_purchase_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'INVALID_DATE' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'NO_ITEMS' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;
  perform public.gold_check_location(v_tenant, p_store_id, p_location_id);

  v_number := public.gold_next_document_number(v_tenant, 'PO');
  insert into public.gold_purchase_orders (id, tenant_id, store_id, supplier_id, purchase_number, supplier_invoice, purchase_date,
                                           subtotal_cost, labor_total, total, notes, created_by)
  values (v_id, v_tenant, p_store_id, p_supplier_id, v_number, nullif(trim(p_supplier_invoice), ''), p_purchase_date,
          0, 0, 0, nullif(trim(p_notes), ''), auth.uid());

  for v_line in select * from jsonb_array_elements(p_items) loop
    select p.*, pu.code as purity_code into v_product
    from public.gold_products p join public.gold_purities pu on pu.id = p.purity_id
    where p.id = (v_line ->> 'product_id')::uuid and p.tenant_id = v_tenant;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = '22023';
    end if;
    v_cost := (v_line ->> 'cost_price')::numeric;
    v_labor := coalesce((v_line ->> 'labor_cost')::numeric, 0);
    if v_cost is null or v_cost < 0 or v_cost <> round(v_cost, 0) or v_labor < 0 or v_labor <> round(v_labor, 0) then
      raise exception 'INVALID_AMOUNT' using errcode = '22023';
    end if;
    v_gross := (v_line ->> 'gross_weight')::numeric;
    v_stone := coalesce((v_line ->> 'stone_weight')::numeric, v_product.stone_weight, 0);

    select x into v_inv from public.gold_inventory_create_pieces(v_tenant, p_store_id, p_location_id, v_product.id,
      jsonb_build_array(jsonb_build_object('gross_weight', v_gross, 'stone_weight', v_stone,
                                           'serial_number', v_line ->> 'serial_number', 'cost_price', v_cost + v_labor)),
      'AVAILABLE', 'PURCHASE', 'PURCHASE', 'PURCHASE', v_id, null) x;

    insert into public.gold_purchase_order_items (tenant_id, purchase_id, inventory_id, product_id, purity_code,
      gross_weight, stone_weight, gold_weight, cost_price, labor_cost, line_total)
    values (v_tenant, v_id, v_inv, v_product.id, v_product.purity_code, v_gross, v_stone, v_gross - v_stone, v_cost, v_labor, v_cost + v_labor);

    v_sub := v_sub + v_cost;
    v_labor_total := v_labor_total + v_labor;
  end loop;

  update public.gold_purchase_orders set subtotal_cost = v_sub, labor_total = v_labor_total, total = v_sub + v_labor_total where id = v_id;
  perform public.gold_apply_purchase_payments(v_tenant, v_id, p_payments);

  perform public.gold_log_audit(v_tenant, 'PURCHASE', 'purchase', v_id::text, null,
    jsonb_build_object('purchase_number', v_number, 'supplier_id', p_supplier_id, 'total', v_sub + v_labor_total, 'items', jsonb_array_length(p_items)));

  return query select v_id, v_number, v_sub + v_labor_total;
end;
$$;

-- RPC: pay (part of) a purchase later
create or replace function public.gold_pay_purchase(p_purchase_id uuid, p_payments jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('purchases.manage');
  v_po record;
  v_paid numeric;
begin
  select * into v_po from public.gold_purchase_orders where id = p_purchase_id and tenant_id = v_tenant;
  if not found or not public.gold_can_access_store(v_po.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_po.status = 'VOIDED' then
    raise exception 'ALREADY_VOIDED' using errcode = '22023';
  end if;
  v_paid := public.gold_apply_purchase_payments(v_tenant, p_purchase_id, p_payments);
  if v_paid <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  perform public.gold_log_audit(v_tenant, 'PURCHASE_PAYMENT', 'purchase', p_purchase_id::text, null, jsonb_build_object('amount', v_paid));
  return v_paid;
end;
$$;

-- RPC: void a purchase while all its pieces are still AVAILABLE
create or replace function public.gold_void_purchase(p_purchase_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('purchases.manage');
  v_po record;
  v_item record;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into v_po from public.gold_purchase_orders where id = p_purchase_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_po.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_po.status = 'VOIDED' then
    raise exception 'ALREADY_VOIDED' using errcode = '22023';
  end if;

  for v_item in
    select i.* from public.gold_inventory i join public.gold_purchase_order_items pi on pi.inventory_id = i.id
    where pi.purchase_id = p_purchase_id order by i.id for update of i
  loop
    if v_item.status <> 'AVAILABLE' then
      raise exception 'INVALID_STATUS:%', v_item.barcode using errcode = '22023';
    end if;
    update public.gold_inventory set status = 'VOIDED' where id = v_item.id;
    perform public.gold_log_movement(v_tenant, v_item.id, 'RETURN', -1, v_item.gold_weight, v_item.gross_weight, v_item.gross_weight,
      v_item.store_id, null, v_item.location_id, null, 'AVAILABLE', 'VOIDED', 'PURCHASE_VOID', p_purchase_id, p_reason);
  end loop;

  insert into public.gold_payments (tenant_id, store_id, purchase_id, direction, method, amount, reference, is_reversal, created_by)
  select tenant_id, store_id, purchase_id, 'IN', method, amount, 'VOID ' || v_po.purchase_number, true, auth.uid()
  from public.gold_payments where purchase_id = p_purchase_id and not is_reversal;
  update public.gold_payments set status = 'REFUNDED' where purchase_id = p_purchase_id and not is_reversal;

  update public.gold_purchase_orders set status = 'VOIDED', voided_at = now(), void_reason = trim(p_reason) where id = p_purchase_id;
  perform public.gold_log_audit(v_tenant, 'REFUND', 'purchase', p_purchase_id::text,
    jsonb_build_object('status', 'RECEIVED', 'total', v_po.total), jsonb_build_object('status', 'VOIDED', 'reason', p_reason));
end;
$$;

revoke all on function public.gold_create_purchase(uuid, uuid, uuid, text, date, jsonb, jsonb, text) from public, anon;
revoke all on function public.gold_pay_purchase(uuid, jsonb) from public, anon;
revoke all on function public.gold_void_purchase(uuid, text) from public, anon;
grant execute on function public.gold_create_purchase(uuid, uuid, uuid, text, date, jsonb, jsonb, text) to authenticated;
grant execute on function public.gold_pay_purchase(uuid, jsonb) to authenticated;
grant execute on function public.gold_void_purchase(uuid, text) to authenticated;
