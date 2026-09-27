-- =============================================================================
-- GoldPOS — Configurable role permissions per tenant.
--
-- gold_roles keeps the DEFAULT permissions. A tenant can override the set for a
-- role in gold_tenant_role_permissions. Every check (RLS, RPCs, app session)
-- now uses the EFFECTIVE set = override if present, else default.
--
-- Guard rails (enforced in the database):
--   * OWNER always has every permission and cannot be edited (no lock-out).
--   * tenant.manage, users.manage, settings.manage are OWNER-only (granting them
--     would let someone promote themselves to owner).
--   * dashboard.view is always on (landing page after login).
--   * Only OWNER may assign the OWNER role or edit an OWNER account.
-- =============================================================================

create table public.gold_tenant_role_permissions (
  tenant_id   uuid not null references public.gold_tenants (id) on delete cascade,
  role_code   text not null references public.gold_roles (code),
  permissions text[] not null,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, role_code),
  check (role_code <> 'OWNER')
);

alter table public.gold_tenant_role_permissions enable row level security;
revoke all on public.gold_tenant_role_permissions from anon, authenticated;
grant select on public.gold_tenant_role_permissions to authenticated;
create policy gold_trp_select on public.gold_tenant_role_permissions for select to authenticated
  using (tenant_id = (select public.gold_current_tenant_id()));

-- -----------------------------------------------------------------------------
-- Effective permissions of a role in a tenant (internal)
-- -----------------------------------------------------------------------------
create or replace function public.gold_role_permissions(p_tenant_id uuid, p_role_code text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_role_code = 'OWNER' then r.permissions
    else coalesce(o.permissions, r.permissions)
  end
  from public.gold_roles r
  left join public.gold_tenant_role_permissions o on o.tenant_id = p_tenant_id and o.role_code = r.code
  where r.code = p_role_code
$$;

revoke all on function public.gold_role_permissions(uuid, text) from public, anon, authenticated;

-- gold_has_permission now reads the effective set (signature unchanged -> all RLS/RPCs follow)
create or replace function public.gold_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_permission = any (public.gold_role_permissions(public.gold_current_tenant_id(), public.gold_current_role())), false)
$$;

-- Effective permissions of the signed-in user (used by the app session / menus)
create or replace function public.gold_current_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.gold_role_permissions(public.gold_current_tenant_id(), public.gold_current_role()), '{}'::text[])
$$;

revoke all on function public.gold_current_permissions() from public, anon;
grant execute on function public.gold_current_permissions() to authenticated;

-- staff RPC actor check uses the effective set too
create or replace function public.gold_check_actor(p_actor_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_role text;
begin
  select u.tenant_id, u.role_code into v_tenant, v_role
  from public.gold_users u
  join public.gold_tenants t on t.id = u.tenant_id
  where u.id = p_actor_id and u.is_active and t.status = 'ACTIVE';
  if v_tenant is null or not ('users.manage' = any (public.gold_role_permissions(v_tenant, v_role))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;

-- -----------------------------------------------------------------------------
-- Only an OWNER may create/promote owners or edit an owner account
-- (defense in depth; users.manage is owner-only anyway).
-- -----------------------------------------------------------------------------
create or replace function public.gold_staff_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
begin
  if current_setting('gold.staff_actor', true) is null or current_setting('gold.staff_actor', true) = '' then
    return new; -- not a staff RPC (e.g. tenant registration)
  end if;
  select role_code into v_actor_role from public.gold_users where id = current_setting('gold.staff_actor')::uuid;
  if v_actor_role is distinct from 'OWNER'
     and (new.role_code = 'OWNER' or (tg_op = 'UPDATE' and old.role_code = 'OWNER')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger gold_users_owner_guard before insert or update on public.gold_users
  for each row execute function public.gold_staff_owner_guard();

-- mark the actor for the guard inside the existing staff RPCs
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
  perform set_config('gold.staff_actor', p_actor_id::text, true);
  if exists (select 1 from public.gold_users where id = p_user_id) then
    raise exception 'USER_ALREADY_REGISTERED' using errcode = '22023';
  end if;
  insert into public.gold_users (id, tenant_id, role_code, full_name, email, phone)
  values (p_user_id, v_tenant, p_role_code, trim(p_full_name), lower(trim(p_email)), nullif(trim(p_phone), ''));
  perform public.gold_set_user_stores(v_tenant, p_user_id, p_store_ids);
  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id, new_data)
  values (v_tenant, p_actor_id, 'CREATE_USER', 'user', p_user_id::text,
          jsonb_build_object('email', lower(trim(p_email)), 'role_code', p_role_code, 'store_ids', to_jsonb(p_store_ids)));
  perform set_config('gold.staff_actor', '', true);
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
  perform set_config('gold.staff_actor', p_actor_id::text, true);
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
  perform set_config('gold.staff_actor', '', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: set / reset the permissions of a role for the caller's tenant (OWNER only)
-- p_permissions null = reset to default
-- -----------------------------------------------------------------------------
create or replace function public.gold_set_role_permissions(p_role_code text, p_permissions text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_require('tenant.manage');
  v_all text[];
  v_default text[];
  v_old text[];
  v_new text[];
  owner_only constant text[] := array['tenant.manage', 'users.manage', 'settings.manage'];
begin
  if public.gold_current_role() <> 'OWNER' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_role_code = 'OWNER' then
    raise exception 'OWNER_LOCKED' using errcode = '22023';
  end if;
  select permissions into v_default from public.gold_roles where code = p_role_code;
  if not found then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;
  select permissions into v_all from public.gold_roles where code = 'OWNER';
  v_old := public.gold_role_permissions(v_tenant, p_role_code);

  if p_permissions is null then
    delete from public.gold_tenant_role_permissions where tenant_id = v_tenant and role_code = p_role_code;
    v_new := v_default;
  else
    if exists (select 1 from unnest(p_permissions) p where not (p = any (v_all))) then
      raise exception 'INVALID_PERMISSION' using errcode = '22023';
    end if;
    if p_permissions && owner_only then
      raise exception 'OWNER_ONLY_PERMISSION' using errcode = '22023';
    end if;
    -- dashboard.view is always on; de-duplicate and keep a stable order
    select array_agg(distinct p order by p) into v_new
    from unnest(array_append(p_permissions, 'dashboard.view')) p;

    insert into public.gold_tenant_role_permissions (tenant_id, role_code, permissions, updated_by, updated_at)
    values (v_tenant, p_role_code, v_new, auth.uid(), now())
    on conflict (tenant_id, role_code) do update set permissions = excluded.permissions, updated_by = excluded.updated_by, updated_at = now();
  end if;

  perform public.gold_log_audit(v_tenant, 'UPDATE_ROLE_PERMISSIONS', 'role', p_role_code,
    jsonb_build_object('permissions', to_jsonb(v_old)), jsonb_build_object('permissions', to_jsonb(v_new), 'reset', p_permissions is null));
  return v_new;
end;
$$;

revoke all on function public.gold_set_role_permissions(text, text[]) from public, anon;
grant execute on function public.gold_set_role_permissions(text, text[]) to authenticated;
