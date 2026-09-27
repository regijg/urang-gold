-- =============================================================================
-- GoldPOS — Phase 9: stock opname (physical count by weight, difference, approval).
--
-- OPEN      : snapshot of on-hand pieces (AVAILABLE/BUYBACK/DAMAGED) in scope; staff scan
-- SUBMITTED : totals + differences frozen for review
-- APPROVED  : adjustments applied atomically (movement STOCK_OPNAME)
--             not found -> LOST (-1) ; weight differs -> gross weight updated ;
--             found LOST piece -> AVAILABLE (+1) ; found in other location -> moved.
--             Pieces whose status changed since the snapshot (e.g. sold) are skipped.
-- REJECTED goes back to OPEN; CANCELLED discards.
-- =============================================================================

create table public.gold_stock_opnames (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.gold_tenants (id) on delete cascade,
  store_id        uuid not null,
  location_id     uuid,
  opname_number   text not null,
  status          text not null default 'OPEN' check (status in ('OPEN', 'SUBMITTED', 'APPROVED', 'CANCELLED')),
  system_count    integer not null default 0,
  system_weight   numeric(12,3) not null default 0,
  physical_count  integer not null default 0,
  physical_weight numeric(12,3) not null default 0,
  diff_count      integer not null default 0,
  diff_weight     numeric(12,3) not null default 0,
  estimated_value numeric(15,2) not null default 0,   -- value of the gold difference at current buy price
  notes           text check (length(notes) <= 1000),
  review_notes    text check (length(review_notes) <= 1000),
  started_by      uuid references auth.users (id) on delete set null,
  started_at      timestamptz not null default now(),
  submitted_by    uuid references auth.users (id) on delete set null,
  submitted_at    timestamptz,
  approved_by     uuid references auth.users (id) on delete set null,
  approved_at     timestamptz,
  unique (tenant_id, opname_number),
  unique (tenant_id, id),
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, store_id, location_id) references public.gold_locations (tenant_id, store_id, id) on delete restrict
);

-- at most one running opname per store
create unique index gold_stock_opnames_one_open_uidx on public.gold_stock_opnames (store_id) where status in ('OPEN', 'SUBMITTED');
create index gold_stock_opnames_tenant_idx on public.gold_stock_opnames (tenant_id, started_at desc);

create table public.gold_stock_opname_items (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.gold_tenants (id) on delete cascade,
  opname_id             uuid not null,
  inventory_id          uuid not null,
  in_snapshot           boolean not null,          -- false = scanned but not expected (UNEXPECTED)
  system_status         text not null,
  system_location_id    uuid,
  system_gross_weight   numeric(10,3) not null,
  stone_weight          numeric(10,3) not null default 0,
  purity_id             uuid not null,
  found                 boolean not null default false,
  physical_gross_weight numeric(10,3),
  counted_by            uuid references auth.users (id) on delete set null,
  counted_at            timestamptz,
  result                text check (result in ('MATCH', 'WEIGHT_DIFF', 'MISSING', 'UNEXPECTED', 'SKIPPED')),
  unique (opname_id, inventory_id),
  foreign key (tenant_id, opname_id) references public.gold_stock_opnames (tenant_id, id) on delete cascade,
  foreign key (tenant_id, inventory_id) references public.gold_inventory (tenant_id, id) on delete restrict,
  check (physical_gross_weight is null or physical_gross_weight > 0)
);

create index gold_opname_items_opname_idx on public.gold_stock_opname_items (opname_id, found);

alter table public.gold_stock_opnames enable row level security;
alter table public.gold_stock_opname_items enable row level security;
revoke all on public.gold_stock_opnames, public.gold_stock_opname_items from anon, authenticated;
grant select on public.gold_stock_opnames, public.gold_stock_opname_items to authenticated;

create policy gold_stock_opnames_select on public.gold_stock_opnames for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(store_id)
         and (public.gold_has_permission('stock_opname.manage') or public.gold_has_permission('stock_opname.approve')
              or public.gold_has_permission('reports.view')));
create policy gold_opname_items_select on public.gold_stock_opname_items for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and exists (select 1 from public.gold_stock_opnames o where o.id = opname_id));

-- -----------------------------------------------------------------------------
-- Internal: lock an opname of the caller's tenant in an expected status
-- -----------------------------------------------------------------------------
create or replace function public.gold_lock_opname(p_tenant_id uuid, p_opname_id uuid, p_status text)
returns public.gold_stock_opnames
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o public.gold_stock_opnames;
begin
  select * into v_o from public.gold_stock_opnames where id = p_opname_id and tenant_id = p_tenant_id for update;
  if not found or not public.gold_can_access_store(v_o.store_id) then
    raise exception 'NOT_FOUND' using errcode = '22023';
  end if;
  if v_o.status <> p_status then
    raise exception 'OPNAME_NOT_OPEN' using errcode = '22023';
  end if;
  return v_o;
end;
$$;

revoke all on function public.gold_lock_opname(uuid, uuid, text) from public, anon, authenticated;

-- RPC: start an opname (snapshot)
create or replace function public.gold_start_stock_opname(p_store_id uuid, p_location_id uuid default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('stock_opname.manage', p_store_id);
  v_id uuid := gen_random_uuid();
begin
  perform public.gold_check_location(v_tenant, p_store_id, p_location_id);
  if exists (select 1 from public.gold_stock_opnames where store_id = p_store_id and status in ('OPEN', 'SUBMITTED')) then
    raise exception 'OPNAME_ALREADY_OPEN' using errcode = '22023';
  end if;

  insert into public.gold_stock_opnames (id, tenant_id, store_id, location_id, opname_number, notes, started_by)
  values (v_id, v_tenant, p_store_id, p_location_id, public.gold_next_document_number(v_tenant, 'SO'), nullif(trim(p_notes), ''), auth.uid());

  insert into public.gold_stock_opname_items (tenant_id, opname_id, inventory_id, in_snapshot, system_status, system_location_id,
                                              system_gross_weight, stone_weight, purity_id)
  select v_tenant, v_id, i.id, true, i.status, i.location_id, i.gross_weight, i.stone_weight, i.purity_id
  from public.gold_inventory i
  where i.tenant_id = v_tenant and i.store_id = p_store_id
    and i.status in ('AVAILABLE', 'BUYBACK', 'DAMAGED')
    and (p_location_id is null or i.location_id = p_location_id);

  update public.gold_stock_opnames
     set system_count = (select count(*) from public.gold_stock_opname_items where opname_id = v_id),
         system_weight = (select coalesce(sum(system_gross_weight), 0) from public.gold_stock_opname_items where opname_id = v_id)
   where id = v_id;

  perform public.gold_log_audit(v_tenant, 'STOCK_OPNAME', 'stock_opname', v_id::text, null,
    jsonb_build_object('event', 'START', 'store_id', p_store_id, 'location_id', p_location_id));
  return v_id;
end;
$$;

-- RPC: count one piece by barcode (optionally with its weighed gross weight). Re-scan updates.
create or replace function public.gold_opname_scan(p_opname_id uuid, p_barcode text, p_gross_weight numeric default null)
returns table (inventory_id uuid, barcode text, name text, in_snapshot boolean, system_gross_weight numeric, physical_gross_weight numeric)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tenant uuid := public.gold_require('stock_opname.manage');
  v_o public.gold_stock_opnames;
  v_piece record;
  v_weight numeric;
begin
  v_o := public.gold_lock_opname(v_tenant, p_opname_id, 'OPEN');
  select * into v_piece from public.gold_inventory where tenant_id = v_tenant and barcode = upper(trim(p_barcode));
  if not found then
    raise exception 'NOT_FOUND:%', upper(trim(p_barcode)) using errcode = '22023';
  end if;
  if p_gross_weight is not null and (p_gross_weight <= 0 or p_gross_weight <= v_piece.stone_weight) then
    raise exception 'INVALID_WEIGHT' using errcode = '22023';
  end if;

  if not exists (select 1 from public.gold_stock_opname_items where opname_id = p_opname_id and inventory_id = v_piece.id) then
    -- not expected in this count (other location/store/status): record for review
    insert into public.gold_stock_opname_items (tenant_id, opname_id, inventory_id, in_snapshot, system_status, system_location_id,
                                                system_gross_weight, stone_weight, purity_id)
    values (v_tenant, p_opname_id, v_piece.id, false, v_piece.status, v_piece.location_id, v_piece.gross_weight, v_piece.stone_weight, v_piece.purity_id);
  end if;

  update public.gold_stock_opname_items oi
     set found = true,
         physical_gross_weight = coalesce(p_gross_weight, oi.physical_gross_weight, oi.system_gross_weight),
         counted_by = auth.uid(), counted_at = now()
   where oi.opname_id = p_opname_id and oi.inventory_id = v_piece.id
  returning oi.physical_gross_weight into v_weight;

  return query
  select v_piece.id, v_piece.barcode, v_piece.name, oi.in_snapshot, oi.system_gross_weight, v_weight
  from public.gold_stock_opname_items oi where oi.opname_id = p_opname_id and oi.inventory_id = v_piece.id;
end;
$$;

-- RPC: undo a scan
create or replace function public.gold_opname_unscan(p_opname_id uuid, p_inventory_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('stock_opname.manage');
begin
  perform public.gold_lock_opname(v_tenant, p_opname_id, 'OPEN');
  delete from public.gold_stock_opname_items where opname_id = p_opname_id and inventory_id = p_inventory_id and not in_snapshot;
  update public.gold_stock_opname_items set found = false, physical_gross_weight = null, counted_by = null, counted_at = null
  where opname_id = p_opname_id and inventory_id = p_inventory_id;
end;
$$;

-- RPC: submit for approval — classify each line and freeze totals
create or replace function public.gold_submit_stock_opname(p_opname_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('stock_opname.manage');
  v_o public.gold_stock_opnames;
begin
  v_o := public.gold_lock_opname(v_tenant, p_opname_id, 'OPEN');

  -- note: "found" is also a PL/pgSQL variable, so the column is always qualified
  update public.gold_stock_opname_items oi set result = case
      when not oi.in_snapshot then 'UNEXPECTED'
      when not oi.found then 'MISSING'
      when oi.physical_gross_weight <> oi.system_gross_weight then 'WEIGHT_DIFF'
      else 'MATCH' end
  where oi.opname_id = p_opname_id;

  update public.gold_stock_opnames o set
    physical_count = s.physical_count,
    physical_weight = s.physical_weight,
    diff_count = s.physical_count - o.system_count,
    diff_weight = s.physical_weight - o.system_weight,
    estimated_value = s.value_diff,
    status = 'SUBMITTED', submitted_by = auth.uid(), submitted_at = now()
  from (
    select
      count(*) filter (where oi.found and oi.in_snapshot) as physical_count,
      coalesce(sum(oi.physical_gross_weight) filter (where oi.found and oi.in_snapshot), 0) as physical_weight,
      coalesce(sum(round(
        (coalesce(case when oi.found then oi.physical_gross_weight end, 0) - oi.system_gross_weight) * coalesce(r.buy_price, 0), 0))
        filter (where oi.in_snapshot), 0) as value_diff
    from public.gold_stock_opname_items oi
    left join public.gold_v_current_gold_rates r on r.tenant_id = oi.tenant_id and r.purity_id = oi.purity_id
    where oi.opname_id = p_opname_id
  ) s
  where o.id = p_opname_id;
end;
$$;

-- RPC: approve and apply adjustments (owner/manager)
create or replace function public.gold_approve_stock_opname(p_opname_id uuid, p_review_notes text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('stock_opname.approve');
  v_o public.gold_stock_opnames;
  v_line record;
  v_count integer := 0;
begin
  v_o := public.gold_lock_opname(v_tenant, p_opname_id, 'SUBMITTED');

  for v_line in
    select oi.*, i.status as cur_status, i.gross_weight as cur_gross, i.location_id as cur_location, i.store_id as cur_store,
           i.stone_weight as cur_stone
    from public.gold_stock_opname_items oi
    join public.gold_inventory i on i.id = oi.inventory_id
    where oi.opname_id = p_opname_id and oi.result <> 'MATCH'
    order by oi.inventory_id
    for update of i
  loop
    -- piece changed since the snapshot (sold, transferred, repaired...) -> leave it alone
    if v_line.cur_status <> v_line.system_status or v_line.cur_gross <> v_line.system_gross_weight then
      update public.gold_stock_opname_items set result = 'SKIPPED' where id = v_line.id;
      continue;
    end if;

    if v_line.result = 'MISSING' then
      update public.gold_inventory set status = 'LOST' where id = v_line.inventory_id;
      perform public.gold_log_movement(v_tenant, v_line.inventory_id, 'STOCK_OPNAME', -1, v_line.system_gross_weight - v_line.stone_weight,
        v_line.cur_gross, v_line.cur_gross, v_line.cur_store, v_line.cur_store, v_line.cur_location, v_line.cur_location,
        v_line.cur_status, 'LOST', 'STOCK_OPNAME', p_opname_id, 'Tidak ditemukan saat stock opname');
    elsif v_line.result = 'WEIGHT_DIFF' then
      update public.gold_inventory set gross_weight = v_line.physical_gross_weight where id = v_line.inventory_id;
      perform public.gold_log_movement(v_tenant, v_line.inventory_id, 'STOCK_OPNAME', 0, v_line.physical_gross_weight - v_line.stone_weight,
        v_line.cur_gross, v_line.physical_gross_weight, v_line.cur_store, v_line.cur_store, v_line.cur_location, v_line.cur_location,
        v_line.cur_status, v_line.cur_status, 'STOCK_OPNAME', p_opname_id, 'Selisih berat stock opname');
    elsif v_line.result = 'UNEXPECTED' then
      if v_line.cur_status = 'LOST' then
        update public.gold_inventory
           set status = 'AVAILABLE', store_id = v_o.store_id, location_id = coalesce(v_o.location_id, v_line.cur_location),
               gross_weight = v_line.physical_gross_weight
         where id = v_line.inventory_id;
        perform public.gold_log_movement(v_tenant, v_line.inventory_id, 'STOCK_OPNAME', 1, v_line.physical_gross_weight - v_line.stone_weight,
          v_line.cur_gross, v_line.physical_gross_weight, v_line.cur_store, v_o.store_id, v_line.cur_location, v_o.location_id,
          'LOST', 'AVAILABLE', 'STOCK_OPNAME', p_opname_id, 'Ditemukan saat stock opname');
      elsif v_line.cur_status in ('AVAILABLE', 'BUYBACK', 'DAMAGED')
            and (v_line.cur_store <> v_o.store_id or v_line.cur_location is distinct from coalesce(v_o.location_id, v_line.cur_location)) then
        update public.gold_inventory set store_id = v_o.store_id, location_id = coalesce(v_o.location_id, v_line.cur_location)
        where id = v_line.inventory_id;
        perform public.gold_log_movement(v_tenant, v_line.inventory_id, 'STOCK_OPNAME', 0, v_line.cur_gross - v_line.stone_weight,
          v_line.cur_gross, v_line.cur_gross, v_line.cur_store, v_o.store_id, v_line.cur_location, v_o.location_id,
          v_line.cur_status, v_line.cur_status, 'STOCK_OPNAME', p_opname_id, 'Lokasi dikoreksi saat stock opname');
      else
        update public.gold_stock_opname_items set result = 'SKIPPED' where id = v_line.id;
        continue;
      end if;
    end if;
    v_count := v_count + 1;
  end loop;

  update public.gold_stock_opnames
     set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), review_notes = nullif(trim(p_review_notes), '')
   where id = p_opname_id;

  perform public.gold_log_audit(v_tenant, 'STOCK_OPNAME', 'stock_opname', p_opname_id::text, null,
    jsonb_build_object('event', 'APPROVE', 'adjusted', v_count, 'diff_weight', v_o.diff_weight, 'diff_count', v_o.diff_count,
                       'estimated_value', v_o.estimated_value));
  return v_count;
end;
$$;

-- RPC: reject (back to counting) or cancel
create or replace function public.gold_review_stock_opname(p_opname_id uuid, p_action text, p_review_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_current_tenant_id();
  v_o public.gold_stock_opnames;
begin
  if p_action = 'REJECT' then
    v_tenant := public.gold_require('stock_opname.approve');
    v_o := public.gold_lock_opname(v_tenant, p_opname_id, 'SUBMITTED');
    update public.gold_stock_opnames set status = 'OPEN', review_notes = nullif(trim(p_review_notes), ''), submitted_at = null, submitted_by = null
    where id = p_opname_id;
    update public.gold_stock_opname_items set result = null where opname_id = p_opname_id;
  elsif p_action = 'CANCEL' then
    v_tenant := public.gold_require('stock_opname.manage');
    select * into v_o from public.gold_stock_opnames where id = p_opname_id and tenant_id = v_tenant for update;
    if not found or not public.gold_can_access_store(v_o.store_id) then
      raise exception 'NOT_FOUND' using errcode = '22023';
    end if;
    if v_o.status not in ('OPEN', 'SUBMITTED') then
      raise exception 'OPNAME_NOT_OPEN' using errcode = '22023';
    end if;
    update public.gold_stock_opnames set status = 'CANCELLED', review_notes = nullif(trim(p_review_notes), '') where id = p_opname_id;
  else
    raise exception 'INVALID_ACTION' using errcode = '22023';
  end if;
  perform public.gold_log_audit(v_tenant, 'STOCK_OPNAME', 'stock_opname', p_opname_id::text, null,
    jsonb_build_object('event', p_action, 'notes', p_review_notes));
end;
$$;

revoke all on function public.gold_start_stock_opname(uuid, uuid, text) from public, anon;
revoke all on function public.gold_opname_scan(uuid, text, numeric) from public, anon;
revoke all on function public.gold_opname_unscan(uuid, uuid) from public, anon;
revoke all on function public.gold_submit_stock_opname(uuid) from public, anon;
revoke all on function public.gold_approve_stock_opname(uuid, text) from public, anon;
revoke all on function public.gold_review_stock_opname(uuid, text, text) from public, anon;
grant execute on function public.gold_start_stock_opname(uuid, uuid, text) to authenticated;
grant execute on function public.gold_opname_scan(uuid, text, numeric) to authenticated;
grant execute on function public.gold_opname_unscan(uuid, uuid) to authenticated;
grant execute on function public.gold_submit_stock_opname(uuid) to authenticated;
grant execute on function public.gold_approve_stock_opname(uuid, text) to authenticated;
grant execute on function public.gold_review_stock_opname(uuid, text, text) to authenticated;
