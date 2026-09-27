-- =============================================================================
-- GoldPOS — Phase 2: master data
--
-- Tables : gold_sequences, gold_audit_logs, gold_categories, gold_purities,
--          gold_products, gold_customers, gold_suppliers
-- Storage: bucket gold-products (public read, tenant-scoped write)
--
-- Conventions (same as Phase 1)
--   * tenant_id defaults to gold_current_tenant_id() and RLS re-checks it, so
--     a tenant_id sent by the browser is never trusted.
--   * Child rows reference parents with composite FKs (tenant_id, id) so they
--     can never point at another tenant's data.
--   * Weights: numeric(10,3) gram. Money: numeric(15,2) IDR. No floats.
--   * gold_products is the catalogue/master item. Physical pieces (barcode,
--     location, actual weight, status) live in gold_inventory (Phase 4).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- gold_sequences — per-tenant counters (SKU now; barcode/invoice later)
-- -----------------------------------------------------------------------------
create table public.gold_sequences (
  tenant_id  uuid not null references public.gold_tenants (id) on delete cascade,
  key        text not null,
  last_value bigint not null default 0 check (last_value >= 0),
  primary key (tenant_id, key)
);

alter table public.gold_sequences enable row level security;
revoke all on public.gold_sequences from anon, authenticated;
-- no policies: only reachable through security-definer functions

create or replace function public.gold_next_sequence(p_tenant_id uuid, p_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value bigint;
begin
  insert into public.gold_sequences as s (tenant_id, key, last_value)
  values (p_tenant_id, p_key, 1)
  on conflict (tenant_id, key) do update set last_value = s.last_value + 1
  returning last_value into v_value;
  return v_value;
end;
$$;

revoke all on function public.gold_next_sequence(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- gold_audit_logs — append-only, written by triggers / security-definer code
-- -----------------------------------------------------------------------------
create table public.gold_audit_logs (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.gold_tenants (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index gold_audit_logs_tenant_created_idx on public.gold_audit_logs (tenant_id, created_at desc);
create index gold_audit_logs_entity_idx on public.gold_audit_logs (tenant_id, entity_type, entity_id);

alter table public.gold_audit_logs enable row level security;
revoke all on public.gold_audit_logs from anon, authenticated;
grant select on public.gold_audit_logs to authenticated;

create policy gold_audit_logs_select on public.gold_audit_logs
  for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('tenant.manage'));

-- Generic audit trigger. TG_ARGV[0] = entity name used in the action,
-- e.g. 'PRODUCT' -> CREATE_PRODUCT / UPDATE_PRODUCT / DELETE_PRODUCT.
create or replace function public.gold_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_row    jsonb;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_row := to_jsonb(new); v_action := 'CREATE_' || v_entity;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then
      return new; -- no real change
    end if;
    v_row := to_jsonb(new); v_action := 'UPDATE_' || v_entity;
  else
    v_row := to_jsonb(old); v_action := 'DELETE_' || v_entity;
  end if;

  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    (v_row ->> 'tenant_id')::uuid,
    auth.uid(),
    v_action,
    lower(v_entity),
    v_row ->> 'id',
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- gold_categories
-- -----------------------------------------------------------------------------
create table public.gold_categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.gold_current_tenant_id()
              references public.gold_tenants (id) on delete cascade,
  code        text not null check (code ~ '^[A-Z0-9]{2,6}$'),
  name        text not null check (length(trim(name)) between 2 and 80),
  description text check (length(description) <= 500),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id)
);

create unique index gold_categories_tenant_name_uidx on public.gold_categories (tenant_id, lower(name));
create index gold_categories_tenant_active_idx on public.gold_categories (tenant_id, is_active, sort_order);
create index gold_categories_created_at_idx on public.gold_categories (created_at);

create trigger gold_categories_updated_at before update on public.gold_categories
  for each row execute function public.gold_set_updated_at();
create trigger gold_categories_audit after insert or update or delete on public.gold_categories
  for each row execute function public.gold_audit_row('CATEGORY');

-- -----------------------------------------------------------------------------
-- gold_purities — kadar emas, configurable per tenant
-- -----------------------------------------------------------------------------
create table public.gold_purities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.gold_current_tenant_id()
              references public.gold_tenants (id) on delete cascade,
  code        text not null check (code ~ '^[A-Za-z0-9.% -]{1,20}$'),
  name        text not null check (length(trim(name)) between 1 and 80),
  percentage  numeric(6,3) not null check (percentage > 0 and percentage <= 100),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id)
);

create index gold_purities_tenant_active_idx on public.gold_purities (tenant_id, is_active, sort_order);
create index gold_purities_created_at_idx on public.gold_purities (created_at);

create trigger gold_purities_updated_at before update on public.gold_purities
  for each row execute function public.gold_set_updated_at();
create trigger gold_purities_audit after insert or update or delete on public.gold_purities
  for each row execute function public.gold_audit_row('PURITY');

-- -----------------------------------------------------------------------------
-- gold_products — master item / catalogue entry
-- -----------------------------------------------------------------------------
create table public.gold_products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default public.gold_current_tenant_id()
                references public.gold_tenants (id) on delete cascade,
  category_id   uuid not null,
  purity_id     uuid not null,
  sku           text not null check (sku ~ '^[A-Z0-9-]{2,40}$'),
  name          text not null check (length(trim(name)) between 2 and 150),
  description   text check (length(description) <= 2000),
  gross_weight  numeric(10,3) not null check (gross_weight > 0),
  stone_weight  numeric(10,3) not null default 0 check (stone_weight >= 0),
  gold_weight   numeric(10,3) generated always as (gross_weight - stone_weight) stored,
  stone_type    text check (length(stone_type) <= 80),
  cost_price    numeric(15,2) not null default 0 check (cost_price >= 0),
  labor_cost    numeric(15,2) not null default 0 check (labor_cost >= 0),
  stone_price   numeric(15,2) not null default 0 check (stone_price >= 0),
  margin_amount numeric(15,2) not null default 0 check (margin_amount >= 0),
  photo_path    text check (length(photo_path) <= 500),
  is_active     boolean not null default true,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (stone_weight < gross_weight),
  unique (tenant_id, sku),
  unique (tenant_id, id),
  foreign key (tenant_id, category_id) references public.gold_categories (tenant_id, id) on delete restrict,
  foreign key (tenant_id, purity_id) references public.gold_purities (tenant_id, id) on delete restrict
);

create index gold_products_tenant_id_idx on public.gold_products (tenant_id);
create index gold_products_category_idx on public.gold_products (tenant_id, category_id);
create index gold_products_purity_idx on public.gold_products (tenant_id, purity_id);
create index gold_products_active_idx on public.gold_products (tenant_id, is_active);
create index gold_products_created_at_idx on public.gold_products (tenant_id, created_at desc);
create index gold_products_name_idx on public.gold_products (tenant_id, lower(name));

create trigger gold_products_updated_at before update on public.gold_products
  for each row execute function public.gold_set_updated_at();
create trigger gold_products_audit after insert or update or delete on public.gold_products
  for each row execute function public.gold_audit_row('PRODUCT');

-- SKU: generated as <CATEGORY_CODE>-<00001> when not supplied; always upper-case.
create or replace function public.gold_products_assign_sku()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if new.sku is null or trim(new.sku) = '' then
    select code into v_code from public.gold_categories
    where id = new.category_id and tenant_id = new.tenant_id;
    if v_code is null then
      raise exception 'CATEGORY_NOT_FOUND' using errcode = '23503';
    end if;
    new.sku := v_code || '-' || lpad(public.gold_next_sequence(new.tenant_id, 'sku:' || v_code)::text, 5, '0');
  else
    new.sku := upper(trim(new.sku));
  end if;
  return new;
end;
$$;

create trigger gold_products_sku before insert or update of sku on public.gold_products
  for each row execute function public.gold_products_assign_sku();

-- -----------------------------------------------------------------------------
-- gold_customers
-- -----------------------------------------------------------------------------
create table public.gold_customers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.gold_current_tenant_id()
             references public.gold_tenants (id) on delete cascade,
  name       text not null check (length(trim(name)) between 2 and 120),
  phone      text check (phone ~ '^\+?[0-9]{8,15}$'),
  email      text check (length(email) <= 150),
  address    text check (length(address) <= 500),
  notes      text check (length(notes) <= 1000),
  is_active  boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index gold_customers_tenant_phone_uidx on public.gold_customers (tenant_id, phone) where phone is not null;
create index gold_customers_tenant_name_idx on public.gold_customers (tenant_id, lower(name));
create index gold_customers_created_at_idx on public.gold_customers (tenant_id, created_at desc);

create trigger gold_customers_updated_at before update on public.gold_customers
  for each row execute function public.gold_set_updated_at();
create trigger gold_customers_audit after insert or update or delete on public.gold_customers
  for each row execute function public.gold_audit_row('CUSTOMER');

-- -----------------------------------------------------------------------------
-- gold_suppliers
-- -----------------------------------------------------------------------------
create table public.gold_suppliers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null default public.gold_current_tenant_id()
                 references public.gold_tenants (id) on delete cascade,
  name           text not null check (length(trim(name)) between 2 and 120),
  contact_person text check (length(contact_person) <= 120),
  phone          text check (phone ~ '^\+?[0-9]{8,15}$'),
  email          text check (length(email) <= 150),
  address        text check (length(address) <= 500),
  notes          text check (length(notes) <= 1000),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index gold_suppliers_tenant_name_uidx on public.gold_suppliers (tenant_id, lower(name));
create index gold_suppliers_active_idx on public.gold_suppliers (tenant_id, is_active);
create index gold_suppliers_created_at_idx on public.gold_suppliers (created_at);

create trigger gold_suppliers_updated_at before update on public.gold_suppliers
  for each row execute function public.gold_set_updated_at();
create trigger gold_suppliers_audit after insert or update or delete on public.gold_suppliers
  for each row execute function public.gold_audit_row('SUPPLIER');

-- -----------------------------------------------------------------------------
-- Privileges + RLS
--   read : any active member of the tenant (cashier needs products for POS)
--          customers: only roles with customers.manage (PII)
--   write: master_data.manage (customers: customers.manage)
-- -----------------------------------------------------------------------------
alter table public.gold_categories enable row level security;
alter table public.gold_purities   enable row level security;
alter table public.gold_products   enable row level security;
alter table public.gold_customers  enable row level security;
alter table public.gold_suppliers  enable row level security;

revoke all on public.gold_categories, public.gold_purities, public.gold_products,
              public.gold_customers, public.gold_suppliers from anon, authenticated;
grant select, insert, update, delete on public.gold_categories, public.gold_purities, public.gold_products,
              public.gold_customers, public.gold_suppliers to authenticated;

-- categories / purities / products / suppliers share the same rule set
do $$
declare
  t text;
begin
  foreach t in array array['gold_categories', 'gold_purities', 'gold_products', 'gold_suppliers'] loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select to authenticated
        using (tenant_id = public.gold_current_tenant_id());
      create policy %1$s_insert on public.%1$s for insert to authenticated
        with check (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('master_data.manage'));
      create policy %1$s_update on public.%1$s for update to authenticated
        using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('master_data.manage'))
        with check (tenant_id = public.gold_current_tenant_id());
      create policy %1$s_delete on public.%1$s for delete to authenticated
        using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('master_data.manage'));
    $f$, t);
  end loop;
end $$;

create policy gold_customers_select on public.gold_customers for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('customers.manage'));
create policy gold_customers_insert on public.gold_customers for insert to authenticated
  with check (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('customers.manage'));
create policy gold_customers_update on public.gold_customers for update to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('customers.manage'))
  with check (tenant_id = public.gold_current_tenant_id());
create policy gold_customers_delete on public.gold_customers for delete to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('customers.manage'));

-- tenant_id cannot be moved to another tenant: every UPDATE policy re-checks it
-- in WITH CHECK. created_by is forced by the database, never taken from the client.
create or replace function public.gold_force_created_by()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by); -- service role keeps explicit value
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

create trigger gold_products_created_by before insert or update on public.gold_products
  for each row execute function public.gold_force_created_by();
create trigger gold_customers_created_by before insert or update on public.gold_customers
  for each row execute function public.gold_force_created_by();

-- -----------------------------------------------------------------------------
-- Default master data per tenant (§8 purities; common jewellery categories)
-- -----------------------------------------------------------------------------
create or replace function public.gold_seed_tenant_master_data(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.gold_purities (tenant_id, code, name, percentage, sort_order) values
    (p_tenant_id, '24K', 'Emas 24 Karat', 99.990, 1),
    (p_tenant_id, '23K', 'Emas 23 Karat', 95.830, 2),
    (p_tenant_id, '22K', 'Emas 22 Karat', 91.670, 3),
    (p_tenant_id, '21K', 'Emas 21 Karat', 87.500, 4),
    (p_tenant_id, '20K', 'Emas 20 Karat', 83.330, 5),
    (p_tenant_id, '18K', 'Emas 18 Karat', 75.000, 6),
    (p_tenant_id, '17K', 'Emas 17 Karat', 70.830, 7),
    (p_tenant_id, '16K', 'Emas 16 Karat', 66.670, 8),
    (p_tenant_id, '15K', 'Emas 15 Karat', 62.500, 9),
    (p_tenant_id, '14K', 'Emas 14 Karat', 58.330, 10),
    (p_tenant_id, '13K', 'Emas 13 Karat', 54.170, 11),
    (p_tenant_id, '12K', 'Emas 12 Karat', 50.000, 12)
  on conflict (tenant_id, code) do nothing;

  insert into public.gold_categories (tenant_id, code, name, sort_order) values
    (p_tenant_id, 'RNG', 'Cincin', 1),
    (p_tenant_id, 'KLG', 'Kalung', 2),
    (p_tenant_id, 'GLG', 'Gelang', 3),
    (p_tenant_id, 'ATG', 'Anting', 4),
    (p_tenant_id, 'LTN', 'Liontin', 5),
    (p_tenant_id, 'LM', 'Logam Mulia', 6)
  on conflict (tenant_id, code) do nothing;
end;
$$;

revoke all on function public.gold_seed_tenant_master_data(uuid) from public, anon, authenticated;

create or replace function public.gold_tenants_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.gold_seed_tenant_master_data(new.id);
  return new;
end;
$$;

create trigger gold_tenants_seed_master_data after insert on public.gold_tenants
  for each row execute function public.gold_tenants_after_insert();

-- backfill tenants created before this migration
select public.gold_seed_tenant_master_data(id) from public.gold_tenants;

-- -----------------------------------------------------------------------------
-- Storage: product photos. Path convention: <tenant_id>/<product_id>/<file>
-- Public read (photos are shown in the online catalogue), tenant-scoped write.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gold-products', 'gold-products', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy gold_products_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gold-products'
    and (storage.foldername(name))[1] = public.gold_current_tenant_id()::text
    and public.gold_has_permission('master_data.manage')
  );

create policy gold_products_storage_update on storage.objects for update to authenticated
  using (
    bucket_id = 'gold-products'
    and (storage.foldername(name))[1] = public.gold_current_tenant_id()::text
    and public.gold_has_permission('master_data.manage')
  );

create policy gold_products_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'gold-products'
    and (storage.foldername(name))[1] = public.gold_current_tenant_id()::text
    and public.gold_has_permission('master_data.manage')
  );
