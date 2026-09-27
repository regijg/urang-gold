-- =============================================================================
-- GoldPOS — Phase 7: trade-in (customer brings old gold, takes new items).
--
-- One atomic transaction = buyback (old items, source TRADE_IN) + sale (new items)
-- + settlement:
--   credit  = min(buyback total, sale total), recorded as a non-cash TRADE_IN
--             payment IN on the sale and OUT on the buyback (no money moves)
--   balance = sale total − buyback total
--             > 0 : customer pays it (p_payments, IN on the sale; cash change allowed)
--             < 0 : store pays it to the customer (p_payments, OUT on the buyback, exact)
-- =============================================================================

create table public.gold_trade_ins (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.gold_tenants (id) on delete cascade,
  store_id        uuid not null,
  trade_in_number text not null,
  customer_id     uuid not null,
  sale_id         uuid not null,
  buyback_id      uuid not null,
  trade_in_value  numeric(15,2) not null check (trade_in_value >= 0),  -- buyback total
  sale_total      numeric(15,2) not null check (sale_total >= 0),
  balance         numeric(15,2) not null,                               -- sale_total - trade_in_value
  status          text not null default 'COMPLETED' check (status in ('COMPLETED', 'VOIDED')),
  cashier_id      uuid references auth.users (id) on delete set null,
  notes           text check (length(notes) <= 1000),
  public_token    uuid not null default gen_random_uuid() unique,
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  void_reason     text check (length(void_reason) <= 500),
  unique (tenant_id, trade_in_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.gold_customers (tenant_id, id) on delete restrict,
  foreign key (tenant_id, sale_id) references public.gold_sales (tenant_id, id) on delete restrict,
  foreign key (tenant_id, buyback_id) references public.gold_buybacks (tenant_id, id) on delete restrict,
  check (balance = sale_total - trade_in_value)
);

create index gold_trade_ins_tenant_created_idx on public.gold_trade_ins (tenant_id, created_at desc);
create index gold_trade_ins_customer_idx on public.gold_trade_ins (tenant_id, customer_id);
create index gold_trade_ins_status_idx on public.gold_trade_ins (tenant_id, status);

alter table public.gold_trade_ins enable row level security;
revoke all on public.gold_trade_ins from anon, authenticated;
grant select on public.gold_trade_ins to authenticated;
create policy gold_trade_ins_select on public.gold_trade_ins for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('trade_ins.manage') or public.gold_has_permission('reports.view')));

-- -----------------------------------------------------------------------------
-- RPC: create a trade-in (atomic)
-- -----------------------------------------------------------------------------
create or replace function public.gold_create_trade_in(
  p_store_id uuid, p_customer_id uuid, p_buy_items jsonb, p_sell_items jsonb, p_payments jsonb,
  p_expected_balance numeric, p_notes text default null
)
returns table (trade_in_id uuid, trade_in_number text, sale_id uuid, buyback_id uuid, balance numeric, change_amount numeric, public_token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('trade_ins.manage', p_store_id);
  v_sale_id uuid := gen_random_uuid();
  v_bb_id uuid := gen_random_uuid();
  v_ti_id uuid := gen_random_uuid();
  v_buy record;
  v_sell record;
  v_credit numeric;
  v_balance numeric;
  v_paid numeric := 0;
  v_cash numeric;
  v_change numeric := 0;
  v_number text;
  v_token uuid;
begin
  if not public.gold_has_permission('pos.use') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.gold_stores where id = p_store_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_STORE' using errcode = '22023';
  end if;
  if p_customer_id is null
     or not exists (select 1 from public.gold_customers where id = p_customer_id and tenant_id = v_tenant and is_active) then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;

  -- 1. buyback side (old items)
  insert into public.gold_buybacks (id, tenant_id, store_id, buyback_number, customer_id, cashier_id, gross_total, deduction_total, total, notes)
  values (v_bb_id, v_tenant, p_store_id, public.gold_next_document_number(v_tenant, 'BB'), p_customer_id, auth.uid(), 0, 0, 0, 'Tukar tambah');
  select * into v_buy from public.gold_buy_pieces(v_tenant, p_store_id, v_bb_id, p_buy_items, 'TRADE_IN');
  update public.gold_buybacks set gross_total = v_buy.gross_total, deduction_total = v_buy.deduction_total, total = v_buy.total where id = v_bb_id;

  -- 2. sale side (new items)
  insert into public.gold_sales (id, tenant_id, store_id, invoice_number, customer_id, cashier_id, subtotal, discount_total, total, paid_total, change_amount, notes)
  values (v_sale_id, v_tenant, p_store_id, public.gold_next_document_number(v_tenant, 'INV'), p_customer_id, auth.uid(), 0, 0, 0, 0, 0, 'Tukar tambah');
  select * into v_sell from public.gold_sell_pieces(v_tenant, p_store_id, v_sale_id, p_sell_items);

  v_balance := v_sell.total - v_buy.total;
  if p_expected_balance is null or p_expected_balance <> v_balance then
    raise exception 'PRICE_CHANGED:%', v_balance using errcode = '22023';
  end if;

  -- 3. trade-in credit (non-cash, both sides)
  v_credit := least(v_buy.total, v_sell.total);
  if v_credit > 0 then
    insert into public.gold_payments (tenant_id, store_id, sale_id, direction, method, amount, reference, created_by)
    values (v_tenant, p_store_id, v_sale_id, 'IN', 'TRADE_IN', v_credit, 'Kredit tukar tambah', auth.uid());
    insert into public.gold_payments (tenant_id, store_id, buyback_id, direction, method, amount, reference, created_by)
    values (v_tenant, p_store_id, v_bb_id, 'OUT', 'TRADE_IN', v_credit, 'Kredit tukar tambah', auth.uid());
  end if;

  -- 4. settle the balance
  if v_balance > 0 then
    v_paid := public.gold_insert_payments(v_tenant, p_store_id, v_sale_id, 'IN', p_payments);
    if v_paid < v_balance then
      raise exception 'INSUFFICIENT_PAYMENT' using errcode = '22023';
    end if;
    v_change := v_paid - v_balance;
    select coalesce(sum(amount), 0) into v_cash from public.gold_payments where sale_id = v_sale_id and method = 'CASH' and direction = 'IN';
    if v_change > v_cash then
      raise exception 'PAYMENT_MISMATCH' using errcode = '22023';
    end if;
    if v_change > 0 then
      insert into public.gold_payments (tenant_id, store_id, sale_id, direction, method, amount, reference, created_by)
      values (v_tenant, p_store_id, v_sale_id, 'OUT', 'CASH', v_change, 'KEMBALIAN', auth.uid());
    end if;
  elsif v_balance < 0 then
    v_paid := public.gold_insert_payments(v_tenant, p_store_id, null, 'OUT', p_payments, v_bb_id);
    if v_paid <> -v_balance then
      raise exception 'PAYMENT_MISMATCH' using errcode = '22023';
    end if;
  elsif p_payments is not null and jsonb_typeof(p_payments) = 'array' and jsonb_array_length(p_payments) > 0
        and exists (select 1 from jsonb_array_elements(p_payments) x where coalesce((x ->> 'amount')::numeric, 0) > 0) then
    raise exception 'PAYMENT_MISMATCH' using errcode = '22023';
  end if;

  update public.gold_sales
     set subtotal = v_sell.subtotal, discount_total = v_sell.discount_total, total = v_sell.total,
         paid_total = v_credit + case when v_balance > 0 then v_paid else 0 end, change_amount = v_change
   where id = v_sale_id;

  -- 5. header + audit
  v_number := public.gold_next_document_number(v_tenant, 'TI');
  insert into public.gold_trade_ins (id, tenant_id, store_id, trade_in_number, customer_id, sale_id, buyback_id,
                                     trade_in_value, sale_total, balance, cashier_id, notes)
  values (v_ti_id, v_tenant, p_store_id, v_number, p_customer_id, v_sale_id, v_bb_id, v_buy.total, v_sell.total, v_balance,
          auth.uid(), nullif(trim(p_notes), ''))
  returning gold_trade_ins.public_token into v_token;

  perform public.gold_log_audit(v_tenant, 'TRADE_IN', 'trade_in', v_ti_id::text, null,
    jsonb_build_object('trade_in_number', v_number, 'sale_id', v_sale_id, 'buyback_id', v_bb_id,
                       'trade_in_value', v_buy.total, 'sale_total', v_sell.total, 'balance', v_balance));

  return query select v_ti_id, v_number, v_sale_id, v_bb_id, v_balance, v_change, v_token;
end;
$$;

-- Void a trade-in = void its sale and its buyback (each re-checks permission & state).
create or replace function public.gold_void_trade_in(p_trade_in_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('sales.void');
  v_ti record;
begin
  select * into v_ti from public.gold_trade_ins where id = p_trade_in_id and tenant_id = v_tenant for update;
  if not found or not public.gold_can_access_store(v_ti.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_ti.status = 'VOIDED' then
    raise exception 'ALREADY_VOIDED' using errcode = '22023';
  end if;
  perform public.gold_void_sale(v_ti.sale_id, p_reason);
  perform public.gold_void_buyback(v_ti.buyback_id, p_reason);
  update public.gold_trade_ins set status = 'VOIDED', voided_at = now(), void_reason = trim(p_reason) where id = p_trade_in_id;
end;
$$;

-- Public e-nota for a trade-in: both documents + settlement
create or replace function public.gold_get_trade_in_receipt(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'kind', 'TRADE_IN',
    'trade_in_number', ti.trade_in_number,
    'status', ti.status,
    'created_at', ti.created_at,
    'trade_in_value', ti.trade_in_value,
    'sale_total', ti.sale_total,
    'balance', ti.balance,
    'sale', public.gold_get_receipt(s.public_token),
    'buyback', public.gold_get_buyback_receipt(b.public_token)
  )
  from public.gold_trade_ins ti
  join public.gold_sales s on s.id = ti.sale_id
  join public.gold_buybacks b on b.id = ti.buyback_id
  where ti.public_token = p_token
$$;

revoke all on function public.gold_create_trade_in(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) from public, anon;
revoke all on function public.gold_void_trade_in(uuid, text) from public, anon;
revoke all on function public.gold_get_trade_in_receipt(uuid) from public;
grant execute on function public.gold_create_trade_in(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) to authenticated;
grant execute on function public.gold_void_trade_in(uuid, text) to authenticated;
grant execute on function public.gold_get_trade_in_receipt(uuid) to anon, authenticated;
