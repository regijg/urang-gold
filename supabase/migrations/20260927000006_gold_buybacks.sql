-- =============================================================================
-- GoldPOS — Phase 6: buyback (customer sells gold/jewellery to the store).
--
-- gold_create_buyback runs atomically: validate customer -> price each piece
-- (gold weight × buy price per gram, minus deduction) -> create/reuse pieces in
-- status BUYBACK -> BUYBACK movements -> payout (OUT) payments == total -> audit.
-- Default price per gram = current buy price of the purity. A higher price needs
-- gold_rates.manage (owner) — protects against over-paying.
-- =============================================================================

-- technical status for pieces of a voided buyback (movements can't be deleted)
alter table public.gold_inventory drop constraint gold_inventory_status_check;
alter table public.gold_inventory add constraint gold_inventory_status_check
  check (status in ('AVAILABLE', 'SOLD', 'BUYBACK', 'RESERVED', 'REPAIR', 'MELTED', 'DAMAGED', 'LOST', 'VOIDED'));

create table public.gold_buybacks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.gold_tenants (id) on delete cascade,
  store_id        uuid not null,
  buyback_number  text not null,
  customer_id     uuid not null,
  cashier_id      uuid references auth.users (id) on delete set null,
  status          text not null default 'COMPLETED' check (status in ('COMPLETED', 'VOIDED')),
  gross_total     numeric(15,2) not null check (gross_total >= 0),
  deduction_total numeric(15,2) not null default 0 check (deduction_total >= 0),
  total           numeric(15,2) not null check (total >= 0),
  notes           text check (length(notes) <= 1000),
  public_token    uuid not null default gen_random_uuid() unique,
  bought_at       timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references auth.users (id) on delete set null,
  void_reason     text check (length(void_reason) <= 500),
  created_at      timestamptz not null default now(),
  unique (tenant_id, buyback_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.gold_customers (tenant_id, id) on delete restrict,
  check (total = gross_total - deduction_total)
);

create index gold_buybacks_tenant_bought_idx on public.gold_buybacks (tenant_id, bought_at desc);
create index gold_buybacks_store_idx on public.gold_buybacks (tenant_id, store_id, bought_at desc);
create index gold_buybacks_customer_idx on public.gold_buybacks (tenant_id, customer_id);
create index gold_buybacks_status_idx on public.gold_buybacks (tenant_id, status);

create table public.gold_buyback_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.gold_tenants (id) on delete cascade,
  buyback_id    uuid not null,
  inventory_id  uuid not null,
  reused_piece  boolean not null default false,   -- true: piece sold earlier by this store
  name          text not null,
  category_id   uuid not null,
  purity_id     uuid not null,
  purity_code   text not null,
  gross_weight  numeric(10,3) not null,
  stone_weight  numeric(10,3) not null default 0,
  gold_weight   numeric(10,3) not null,
  rate_id       uuid,
  buy_rate      numeric(15,2) not null,            -- current official buy price per gram
  price_per_gram numeric(15,2) not null,           -- price actually used
  gross_amount  numeric(15,2) not null,
  deduction     numeric(15,2) not null default 0 check (deduction >= 0),
  net_amount    numeric(15,2) not null check (net_amount >= 0),
  created_at    timestamptz not null default now(),
  foreign key (tenant_id, buyback_id) references public.gold_buybacks (tenant_id, id) on delete cascade,
  foreign key (tenant_id, inventory_id) references public.gold_inventory (tenant_id, id) on delete restrict,
  check (net_amount = gross_amount - deduction)
);

create index gold_buyback_items_buyback_idx on public.gold_buyback_items (buyback_id);
create index gold_buyback_items_inventory_idx on public.gold_buyback_items (inventory_id);
create index gold_buyback_items_tenant_created_idx on public.gold_buyback_items (tenant_id, created_at desc);

alter table public.gold_payments add column buyback_id uuid;
alter table public.gold_payments add constraint gold_payments_buyback_fk
  foreign key (tenant_id, buyback_id) references public.gold_buybacks (tenant_id, id) on delete restrict;
create index gold_payments_buyback_idx on public.gold_payments (buyback_id);

alter table public.gold_buybacks enable row level security;
alter table public.gold_buyback_items enable row level security;
revoke all on public.gold_buybacks, public.gold_buyback_items from anon, authenticated;
grant select on public.gold_buybacks, public.gold_buyback_items to authenticated;

create policy gold_buybacks_select on public.gold_buybacks for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('buybacks.manage') or public.gold_has_permission('reports.view')));
create policy gold_buyback_items_select on public.gold_buyback_items for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and exists (select 1 from public.gold_buybacks b where b.id = buyback_id));

-- payments can now belong to a buyback: replace the helper (same body + p_buyback_id)
drop function public.gold_insert_payments(uuid, uuid, uuid, text, jsonb);
create function public.gold_insert_payments(
  p_tenant_id uuid, p_store_id uuid, p_sale_id uuid, p_direction text, p_payments jsonb, p_buyback_id uuid default null
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
    insert into public.gold_payments (tenant_id, store_id, sale_id, buyback_id, direction, method, amount, reference, provider, provider_ref, created_by)
    values (p_tenant_id, p_store_id, p_sale_id, p_buyback_id, p_direction, v_method, v_amount,
            nullif(trim(v_p ->> 'reference'), ''), coalesce(nullif(v_p ->> 'provider', ''), 'MANUAL'),
            nullif(trim(v_p ->> 'provider_ref'), ''), auth.uid());
    v_sum := v_sum + v_amount;
  end loop;
  return v_sum;
end;
$$;

revoke all on function public.gold_insert_payments(uuid, uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Pure calculation (single place): gross = round(gold_weight × price/gram), net = gross − deduction
-- -----------------------------------------------------------------------------
create or replace function public.gold_buyback_line(p_gold_weight numeric, p_price_per_gram numeric, p_deduction numeric)
returns table (gross_amount numeric, net_amount numeric)
language plpgsql
immutable
as $$
declare
  v_gross numeric;
begin
  if p_gold_weight is null or p_gold_weight <= 0 then
    raise exception 'INVALID_WEIGHT' using errcode = '22023';
  end if;
  if p_price_per_gram is null or p_price_per_gram <= 0 or p_price_per_gram <> round(p_price_per_gram, 0)
     or coalesce(p_deduction, 0) < 0 or coalesce(p_deduction, 0) <> round(coalesce(p_deduction, 0), 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  v_gross := round(p_gold_weight * p_price_per_gram, 0);
  if coalesce(p_deduction, 0) > v_gross then
    raise exception 'DISCOUNT_EXCEEDS_SUBTOTAL' using errcode = '22023';
  end if;
  return query select v_gross, v_gross - coalesce(p_deduction, 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal: buy pieces into stock for a buyback header (used by buyback & trade-in).
-- p_items: [{ name, category_id, purity_id, gross_weight, stone_weight?, price_per_gram?,
--             deduction?, inventory_id? (a SOLD piece of this tenant to take back),
--             location_id? }]
-- Returns (gross_total, deduction_total, total).
-- -----------------------------------------------------------------------------
create or replace function public.gold_buy_pieces(
  p_tenant_id uuid, p_store_id uuid, p_buyback_id uuid, p_items jsonb, p_source text
)
returns table (gross_total numeric, deduction_total numeric, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_rate record;
  v_purity record;
  v_piece record;
  v_calc record;
  v_inv uuid;
  v_gross_w numeric;
  v_stone_w numeric;
  v_price numeric;
  v_deduction numeric;
  v_category uuid;
  v_name text;
  v_reused boolean;
  v_gross_total numeric := 0;
  v_ded_total numeric := 0;
  v_location uuid;
  v_before_weight numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS' using errcode = '22023';
  end if;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_reused := false;
    v_before_weight := null;
    v_inv := nullif(v_line ->> 'inventory_id', '')::uuid;
    v_location := nullif(v_line ->> 'location_id', '')::uuid;
    perform public.gold_check_location(p_tenant_id, p_store_id, v_location);

    if v_inv is not null then
      -- taking back a piece this store sold earlier
      select * into v_piece from public.gold_inventory where id = v_inv and tenant_id = p_tenant_id for update;
      if not found or v_piece.status <> 'SOLD' then
        raise exception 'INVALID_STATUS:%', coalesce(v_piece.barcode, v_inv::text) using errcode = '22023';
      end if;
      v_reused := true;
      v_before_weight := v_piece.gross_weight;
      v_category := v_piece.category_id;
      select id, code into v_purity from public.gold_purities where id = v_piece.purity_id;
      v_name := coalesce(nullif(trim(v_line ->> 'name'), ''), v_piece.name);
      v_gross_w := coalesce((v_line ->> 'gross_weight')::numeric, v_piece.gross_weight);
      v_stone_w := coalesce((v_line ->> 'stone_weight')::numeric, v_piece.stone_weight);
    else
      v_category := (v_line ->> 'category_id')::uuid;
      if not exists (select 1 from public.gold_categories where id = v_category and tenant_id = p_tenant_id) then
        raise exception 'INVALID_CATEGORY' using errcode = '22023';
      end if;
      select id, code into v_purity from public.gold_purities where id = (v_line ->> 'purity_id')::uuid and tenant_id = p_tenant_id;
      if not found then
        raise exception 'INVALID_PURITY' using errcode = '22023';
      end if;
      v_name := nullif(trim(v_line ->> 'name'), '');
      if v_name is null or length(v_name) < 2 then
        raise exception 'NAME_REQUIRED' using errcode = '22023';
      end if;
      v_gross_w := (v_line ->> 'gross_weight')::numeric;
      v_stone_w := coalesce((v_line ->> 'stone_weight')::numeric, 0);
    end if;

    if v_gross_w is null or v_gross_w <= 0 or v_stone_w < 0 or v_stone_w >= v_gross_w then
      raise exception 'INVALID_WEIGHT' using errcode = '22023';
    end if;

    select r.id, r.buy_price into v_rate
    from public.gold_gold_rates r
    where r.tenant_id = p_tenant_id and r.purity_id = v_purity.id and r.effective_at <= now()
    order by r.effective_at desc, r.seq desc limit 1;
    if not found then
      raise exception 'RATE_NOT_SET:%', v_purity.code using errcode = '22023';
    end if;

    v_price := coalesce(nullif(v_line ->> 'price_per_gram', '')::numeric, v_rate.buy_price);
    if v_price > v_rate.buy_price and not public.gold_has_permission('gold_rates.manage') then
      raise exception 'PRICE_ABOVE_BUY_RATE:%', v_purity.code using errcode = '42501';
    end if;
    v_deduction := coalesce(nullif(v_line ->> 'deduction', '')::numeric, 0);

    select * into v_calc from public.gold_buyback_line(v_gross_w - v_stone_w, v_price, v_deduction);

    if v_reused then
      update public.gold_inventory
         set status = 'BUYBACK', store_id = p_store_id, location_id = v_location,
             gross_weight = v_gross_w, stone_weight = v_stone_w, cost_price = v_calc.net_amount,
             name = v_name, source = p_source
       where id = v_inv;
    else
      insert into public.gold_inventory (tenant_id, store_id, location_id, product_id, category_id, purity_id, barcode,
        name, gross_weight, stone_weight, cost_price, status, source, notes, created_by)
      values (p_tenant_id, p_store_id, v_location, null, v_category, v_purity.id, public.gold_next_barcode(p_tenant_id),
        v_name, v_gross_w, v_stone_w, v_calc.net_amount, 'BUYBACK', p_source, nullif(trim(v_line ->> 'notes'), ''), auth.uid())
      returning id into v_inv;
    end if;

    insert into public.gold_buyback_items (tenant_id, buyback_id, inventory_id, reused_piece, name, category_id, purity_id, purity_code,
      gross_weight, stone_weight, gold_weight, rate_id, buy_rate, price_per_gram, gross_amount, deduction, net_amount)
    values (p_tenant_id, p_buyback_id, v_inv, v_reused, v_name, v_category, v_purity.id, v_purity.code,
      v_gross_w, v_stone_w, v_gross_w - v_stone_w, v_rate.id, v_rate.buy_price, v_price, v_calc.gross_amount, v_deduction, v_calc.net_amount);

    perform public.gold_log_movement(p_tenant_id, v_inv, case when p_source = 'TRADE_IN' then 'TRADE_IN' else 'BUYBACK' end, 1,
      v_gross_w - v_stone_w, v_before_weight, v_gross_w,
      null, p_store_id, null, v_location, case when v_reused then 'SOLD' end, 'BUYBACK',
      case when p_source = 'TRADE_IN' then 'TRADE_IN' else 'BUYBACK' end, p_buyback_id, null);

    v_gross_total := v_gross_total + v_calc.gross_amount;
    v_ded_total := v_ded_total + v_deduction;
  end loop;

  return query select v_gross_total, v_ded_total, v_gross_total - v_ded_total;
end;
$$;

revoke all on function public.gold_buy_pieces(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC: create a buyback (atomic)
-- p_payments: payout [{ method, amount, reference? }] — must equal the total exactly
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_buyback(
  p_store_id uuid, p_customer_id uuid, p_items jsonb, p_payments jsonb, p_expected_total numeric, p_notes text default null
)
returns table (buyback_id uuid, buyback_number text, total numeric, public_token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('buybacks.manage', p_store_id);
  v_id uuid := gen_random_uuid();
  v_number text;
  v_totals record;
  v_paid numeric;
  v_token uuid;
begin
  if not exists (select 1 from public.gold_stores where id = p_store_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_STORE' using errcode = '22023';
  end if;
  if p_customer_id is null
     or not exists (select 1 from public.gold_customers where id = p_customer_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;

  v_number := public.gold_next_document_number(v_tenant, 'BB');
  insert into public.gold_buybacks (id, tenant_id, store_id, buyback_number, customer_id, cashier_id, gross_total, deduction_total, total, notes)
  values (v_id, v_tenant, p_store_id, v_number, p_customer_id, auth.uid(), 0, 0, 0, nullif(trim(p_notes), ''));

  select * into v_totals from public.gold_buy_pieces(v_tenant, p_store_id, v_id, p_items, 'BUYBACK');

  if p_expected_total is null or p_expected_total <> v_totals.total then
    raise exception 'PRICE_CHANGED:%', v_totals.total using errcode = '22023';
  end if;

  v_paid := public.gold_insert_payments(v_tenant, p_store_id, null, 'OUT', p_payments, v_id);
  if v_paid <> v_totals.total then
    raise exception 'PAYMENT_MISMATCH' using errcode = '22023';
  end if;

  update public.gold_buybacks set gross_total = v_totals.gross_total, deduction_total = v_totals.deduction_total, total = v_totals.total
  where id = v_id returning gold_buybacks.public_token into v_token;

  perform public.gold_log_audit(v_tenant, 'BUYBACK', 'buyback', v_id::text, null,
    jsonb_build_object('buyback_number', v_number, 'total', v_totals.total, 'items', jsonb_array_length(p_items), 'customer_id', p_customer_id));

  return query select v_id, v_number, v_totals.total, v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: void a buyback while its pieces are still untouched (status BUYBACK).
-- New pieces -> VOIDED, reused pieces -> back to SOLD. Payout reversed. sales.void.
-- -----------------------------------------------------------------------------
create or replace function public.gold_void_buyback(p_buyback_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('sales.void');
  v_bb record;
  v_item record;
  v_to text;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'NOTES_REQUIRED' using errcode = '22023';
  end if;
  select * into v_bb from public.gold_buybacks where id = p_buyback_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_bb.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_bb.status = 'VOIDED' then
    raise exception 'ALREADY_VOIDED' using errcode = '22023';
  end if;

  for v_item in
    select i.*, bi.reused_piece from public.gold_inventory i
    join public.gold_buyback_items bi on bi.inventory_id = i.id
    where bi.buyback_id = p_buyback_id order by i.id for update of i
  loop
    if v_item.status <> 'BUYBACK' then
      raise exception 'INVALID_STATUS:%', v_item.barcode using errcode = '22023';
    end if;
    v_to := case when v_item.reused_piece then 'SOLD' else 'VOIDED' end;
    update public.gold_inventory set status = v_to where id = v_item.id;
    perform public.gold_log_movement(v_tenant, v_item.id, 'RETURN', -1, v_item.gold_weight, v_item.gross_weight, v_item.gross_weight,
      v_item.store_id, null, v_item.location_id, null, 'BUYBACK', v_to, 'BUYBACK_VOID', p_buyback_id, p_reason);
  end loop;

  insert into public.gold_payments (tenant_id, store_id, buyback_id, direction, method, amount, reference, provider, is_reversal, created_by)
  select tenant_id, store_id, buyback_id, case direction when 'IN' then 'OUT' else 'IN' end, method, amount,
         'VOID ' || v_bb.buyback_number, provider, true, auth.uid()
  from public.gold_payments where buyback_id = p_buyback_id and not is_reversal;
  update public.gold_payments set status = 'REFUNDED' where buyback_id = p_buyback_id and not is_reversal;

  update public.gold_buybacks set status = 'VOIDED', voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_buyback_id;

  perform public.gold_log_audit(v_tenant, 'REFUND', 'buyback', p_buyback_id::text,
    jsonb_build_object('status', 'COMPLETED', 'total', v_bb.total), jsonb_build_object('status', 'VOIDED', 'reason', p_reason));
end;
$$;

-- Public e-nota for a buyback (random token)
create or replace function public.gold_get_buyback_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'kind', 'BUYBACK',
    'invoice_number', b.buyback_number,
    'status', b.status,
    'sold_at', b.bought_at,
    'subtotal', b.gross_total, 'discount_total', b.deduction_total, 'total', b.total,
    'paid_total', b.total, 'change_amount', 0,
    'store', jsonb_build_object('name', st.name, 'address', st.address, 'phone', st.phone),
    'tenant', jsonb_build_object('name', t.name),
    'cashier', (select u.full_name from public.gold_users u where u.id = b.cashier_id),
    'customer', (select c.name from public.gold_customers c where c.id = b.customer_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', bi.name, 'barcode', i.barcode, 'purity_code', bi.purity_code,
        'gross_weight', bi.gross_weight, 'gold_weight', bi.gold_weight, 'price_per_gram', bi.price_per_gram,
        'subtotal', bi.gross_amount, 'discount', bi.deduction, 'price', bi.net_amount) order by bi.created_at, i.barcode)
      from public.gold_buyback_items bi join public.gold_inventory i on i.id = bi.inventory_id where bi.buyback_id = b.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount) order by p.created_at)
      from public.gold_payments p where p.buyback_id = b.id and p.direction = 'OUT' and not p.is_reversal), '[]'::jsonb)
  )
  from public.gold_buybacks b
  join public.gold_stores st on st.id = b.store_id
  join public.gold_tenants t on t.id = b.tenant_id
  where b.public_token = p_token
$$;

revoke all on function public.gold_create_buyback(uuid, uuid, jsonb, jsonb, numeric, text) from public, anon;
revoke all on function public.gold_void_buyback(uuid, text) from public, anon;
revoke all on function public.gold_get_buyback_receipt(uuid) from public;
grant execute on function public.gold_create_buyback(uuid, uuid, jsonb, jsonb, numeric, text) to authenticated;
grant execute on function public.gold_void_buyback(uuid, text) to authenticated;
grant execute on function public.gold_get_buyback_receipt(uuid) to anon, authenticated;
