-- =============================================================================
-- GoldPOS — Phase 1: core tenancy, roles, users, RLS
--
-- Tables : gold_roles, gold_tenants, gold_stores, gold_users, gold_user_stores
-- Helpers: gold_current_tenant_id(), gold_current_role(), gold_has_permission(),
--          gold_can_access_store()
-- RPC    : gold_register_tenant()  (service_role only)
--
-- Security model
--   * Every business row carries tenant_id; RLS compares it with the tenant of
--     auth.uid() looked up server-side in gold_users — never with a value sent
--     by the browser.
--   * Role permissions live in gold_roles.permissions (DB is the source of truth).
--   * Outlet access: OWNER/ADMIN see all stores of their tenant, other roles only
--     the stores listed in gold_user_stores.
--   * gold_users / gold_user_stores / gold_tenants have no INSERT/DELETE policy:
--     they are written only through security-definer RPCs or the service role.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------
create or replace function public.gold_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- gold_roles — system roles, global (not per tenant) in Phase 1
-- -----------------------------------------------------------------------------
create table public.gold_roles (
  code        text primary key check (code ~ '^[A-Z_]+$'),
  name        text not null,
  description text,
  permissions text[] not null default '{}',
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.gold_roles (code, name, description, sort_order, permissions) values
  ('OWNER', 'Owner', 'Pemilik toko, semua akses', 1, array[
    'dashboard.view', 'tenant.manage', 'stores.manage', 'users.manage',
    'master_data.manage', 'gold_rates.manage', 'inventory.view', 'inventory.manage',
    'stock_opname.manage', 'stock_opname.approve', 'stock_transfer.manage',
    'pos.use', 'sales.manage', 'buybacks.manage', 'trade_ins.manage',
    'purchases.manage', 'customers.manage', 'reports.view', 'settings.manage'
  ]),
  ('ADMIN', 'Admin', 'Master data, inventory, transaksi, laporan', 2, array[
    'dashboard.view', 'master_data.manage', 'inventory.view', 'inventory.manage',
    'stock_transfer.manage', 'pos.use', 'sales.manage', 'buybacks.manage',
    'trade_ins.manage', 'purchases.manage', 'customers.manage', 'reports.view'
  ]),
  ('MANAGER', 'Manager', 'Penjualan, buyback, inventory, laporan', 3, array[
    'dashboard.view', 'inventory.view', 'inventory.manage', 'stock_opname.approve',
    'pos.use', 'sales.manage', 'buybacks.manage', 'trade_ins.manage',
    'customers.manage', 'reports.view'
  ]),
  ('CASHIER', 'Kasir', 'POS, penjualan, buyback, customer, e-nota', 4, array[
    'dashboard.view', 'pos.use', 'sales.manage', 'buybacks.manage',
    'trade_ins.manage', 'customers.manage'
  ]),
  ('WAREHOUSE', 'Gudang', 'Inventory, stock opname, mutasi & transfer stok', 5, array[
    'dashboard.view', 'inventory.view', 'inventory.manage',
    'stock_opname.manage', 'stock_transfer.manage'
  ]);

-- -----------------------------------------------------------------------------
-- gold_tenants
-- -----------------------------------------------------------------------------
create table public.gold_tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 120),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status     text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  plan       text not null default 'FREE' check (plan in ('FREE', 'STARTER', 'PRO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gold_tenants_status_idx on public.gold_tenants (status);
create index gold_tenants_created_at_idx on public.gold_tenants (created_at);

create trigger gold_tenants_updated_at
  before update on public.gold_tenants
  for each row execute function public.gold_set_updated_at();

-- -----------------------------------------------------------------------------
-- gold_stores — outlets of a tenant
-- -----------------------------------------------------------------------------
create table public.gold_stores (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.gold_tenants (id) on delete restrict,
  code       text not null check (code ~ '^[A-Z0-9-]{2,20}$'),
  name       text not null check (length(trim(name)) between 2 and 120),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  address    text,
  phone      text,
  whatsapp   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  -- lets child tables use a composite FK (tenant_id, store_id) so a row can
  -- never point at a store of another tenant
  unique (tenant_id, id)
);

create index gold_stores_tenant_id_idx on public.gold_stores (tenant_id);
create index gold_stores_is_active_idx on public.gold_stores (tenant_id, is_active);
create index gold_stores_created_at_idx on public.gold_stores (created_at);

create trigger gold_stores_updated_at
  before update on public.gold_stores
  for each row execute function public.gold_set_updated_at();

-- -----------------------------------------------------------------------------
-- gold_users — app profile, 1:1 with auth.users, belongs to exactly one tenant
-- -----------------------------------------------------------------------------
create table public.gold_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  tenant_id  uuid not null references public.gold_tenants (id) on delete restrict,
  role_code  text not null references public.gold_roles (code),
  full_name  text not null check (length(trim(full_name)) between 2 and 120),
  email      text not null,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create index gold_users_tenant_id_idx on public.gold_users (tenant_id);
create index gold_users_role_code_idx on public.gold_users (tenant_id, role_code);
create index gold_users_is_active_idx on public.gold_users (tenant_id, is_active);
create index gold_users_created_at_idx on public.gold_users (created_at);

create trigger gold_users_updated_at
  before update on public.gold_users
  for each row execute function public.gold_set_updated_at();

-- -----------------------------------------------------------------------------
-- gold_user_stores — which outlets a (non owner/admin) user may access
-- -----------------------------------------------------------------------------
create table public.gold_user_stores (
  tenant_id  uuid not null,
  user_id    uuid not null,
  store_id   uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id),
  foreign key (tenant_id, user_id) references public.gold_users (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id) references public.gold_stores (tenant_id, id) on delete cascade
);

create index gold_user_stores_tenant_id_idx on public.gold_user_stores (tenant_id);
create index gold_user_stores_store_id_idx on public.gold_user_stores (store_id);

-- -----------------------------------------------------------------------------
-- RLS helper functions
-- security definer so they can read gold_users without recursing into its RLS.
-- Inactive users and suspended tenants resolve to NULL => no access anywhere.
-- -----------------------------------------------------------------------------
create or replace function public.gold_current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.tenant_id
  from public.gold_users u
  join public.gold_tenants t on t.id = u.tenant_id
  where u.id = auth.uid()
    and u.is_active
    and t.status = 'ACTIVE'
$$;

create or replace function public.gold_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role_code
  from public.gold_users u
  join public.gold_tenants t on t.id = u.tenant_id
  where u.id = auth.uid()
    and u.is_active
    and t.status = 'ACTIVE'
$$;

create or replace function public.gold_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p_permission = any (r.permissions)
    from public.gold_roles r
    where r.code = public.gold_current_role()
  ), false)
$$;

create or replace function public.gold_can_access_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gold_stores s
    where s.id = p_store_id
      and s.tenant_id = public.gold_current_tenant_id()
      and (
        public.gold_current_role() in ('OWNER', 'ADMIN')
        or exists (
          select 1 from public.gold_user_stores us
          where us.user_id = auth.uid() and us.store_id = s.id
        )
      )
  )
$$;

revoke all on function public.gold_current_tenant_id() from public, anon;
revoke all on function public.gold_current_role() from public, anon;
revoke all on function public.gold_has_permission(text) from public, anon;
revoke all on function public.gold_can_access_store(uuid) from public, anon;
grant execute on function public.gold_current_tenant_id() to authenticated;
grant execute on function public.gold_current_role() to authenticated;
grant execute on function public.gold_has_permission(text) to authenticated;
grant execute on function public.gold_can_access_store(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.gold_roles       enable row level security;
alter table public.gold_tenants     enable row level security;
alter table public.gold_stores      enable row level security;
alter table public.gold_users       enable row level security;
alter table public.gold_user_stores enable row level security;

-- Base privileges: anon gets nothing; authenticated gets only what RLS allows.
revoke all on public.gold_roles, public.gold_tenants, public.gold_stores,
              public.gold_users, public.gold_user_stores from anon, authenticated;
grant select on public.gold_roles to authenticated;
grant select, update on public.gold_tenants to authenticated;
grant select, insert, update, delete on public.gold_stores to authenticated;
grant select on public.gold_users to authenticated;
grant select on public.gold_user_stores to authenticated;

-- gold_roles: readable reference data
create policy gold_roles_select on public.gold_roles
  for select to authenticated
  using (true);

-- gold_tenants: own tenant only; OWNER may edit it (only name, see column grant below)
create policy gold_tenants_select on public.gold_tenants
  for select to authenticated
  using (id = public.gold_current_tenant_id());

create policy gold_tenants_update on public.gold_tenants
  for update to authenticated
  using (id = public.gold_current_tenant_id() and public.gold_has_permission('tenant.manage'))
  with check (id = public.gold_current_tenant_id());

-- status / plan / slug are platform-controlled, not editable by the tenant
revoke update on public.gold_tenants from authenticated;
grant update (name) on public.gold_tenants to authenticated;

-- gold_stores: stores of own tenant the user may access; managed by stores.manage
create policy gold_stores_select on public.gold_stores
  for select to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_can_access_store(id));

create policy gold_stores_insert on public.gold_stores
  for insert to authenticated
  with check (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('stores.manage'));

create policy gold_stores_update on public.gold_stores
  for update to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('stores.manage'))
  with check (tenant_id = public.gold_current_tenant_id());

create policy gold_stores_delete on public.gold_stores
  for delete to authenticated
  using (tenant_id = public.gold_current_tenant_id() and public.gold_has_permission('stores.manage'));

-- gold_users: colleagues in own tenant (read-only from the client)
create policy gold_users_select on public.gold_users
  for select to authenticated
  using (tenant_id = public.gold_current_tenant_id());

-- A deactivated user must still be able to read their own row (to see why login fails)
create policy gold_users_select_self on public.gold_users
  for select to authenticated
  using (id = auth.uid());

-- gold_user_stores: own tenant only
create policy gold_user_stores_select on public.gold_user_stores
  for select to authenticated
  using (tenant_id = public.gold_current_tenant_id());

-- -----------------------------------------------------------------------------
-- RPC: gold_register_tenant
-- Atomically creates tenant + first store + OWNER profile for an existing
-- auth user. Callable by the service role only (server action), so the browser
-- can never choose its own tenant_id / role.
-- -----------------------------------------------------------------------------
create or replace function public.gold_register_tenant(
  p_user_id     uuid,
  p_email       text,
  p_full_name   text,
  p_tenant_name text,
  p_store_name  text
)
returns table (tenant_id uuid, store_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base      text;
  v_slug      text;
  v_tenant_id uuid;
  v_store_id  uuid;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'AUTH_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.gold_users where id = p_user_id) then
    raise exception 'USER_ALREADY_REGISTERED' using errcode = 'P0001';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(p_tenant_name), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'toko';
  end if;
  v_base := left(v_base, 40);
  v_slug := v_base;
  while exists (select 1 from public.gold_tenants where slug = v_slug)
     or exists (select 1 from public.gold_stores where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 6);
  end loop;

  insert into public.gold_tenants (name, slug)
  values (trim(p_tenant_name), v_slug)
  returning id into v_tenant_id;

  insert into public.gold_stores (tenant_id, code, name, slug)
  values (v_tenant_id, 'PUSAT', coalesce(nullif(trim(p_store_name), ''), trim(p_tenant_name)), v_slug)
  returning id into v_store_id;

  insert into public.gold_users (id, tenant_id, role_code, full_name, email)
  values (p_user_id, v_tenant_id, 'OWNER', trim(p_full_name), lower(trim(p_email)));

  insert into public.gold_user_stores (tenant_id, user_id, store_id)
  values (v_tenant_id, p_user_id, v_store_id);

  return query select v_tenant_id, v_store_id;
end;
$$;

revoke all on function public.gold_register_tenant(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.gold_register_tenant(uuid, text, text, text, text) to service_role;
