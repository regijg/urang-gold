-- =============================================================================
-- Security test: tenant isolation + role permissions + RLS for Phase 1 tables.
--
-- Run against a Supabase database that has the migrations applied
-- (local `supabase db reset`, or the SQL editor of a NON-production project):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_gold_core_rls.test.sql
--
-- Everything runs inside a transaction that is rolled back — no data is left behind.
-- Any failed assertion raises an exception and aborts the script.
-- =============================================================================
begin;

-- ---------- fixtures (as superuser / service role) ---------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'outsider@test.local');

select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Outlet A1');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Outlet B1');

-- second outlet for tenant A that the cashier is NOT assigned to
insert into public.gold_stores (tenant_id, code, name, slug)
select id, 'CAB2', 'Outlet A2', 'toko-a-cab2' from public.gold_tenants where name = 'Toko A';

-- cashier in tenant A, assigned only to Outlet A1
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select '00000000-0000-0000-0000-0000000000c1', id, 'CASHIER', 'Kasir A', 'cashier-a@test.local'
from public.gold_tenants where name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select s.tenant_id, '00000000-0000-0000-0000-0000000000c1', s.id
from public.gold_stores s where s.name = 'Outlet A1';

select set_config('test.tenant_b', (select id::text from public.gold_tenants where name = 'Toko B'), true);

-- helper: act as a given auth user (mimics Supabase's JWT claims)
create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
end $$;

create or replace function pg_temp.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'ASSERTION FAILED: %', p_msg; end if;
end $$;

-- ---------- OWNER A ----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select pg_temp.assert((select count(*) from public.gold_tenants) = 1, 'owner A sees exactly 1 tenant');
select pg_temp.assert((select name from public.gold_tenants) = 'Toko A', 'owner A sees own tenant');
select pg_temp.assert((select count(*) from public.gold_stores) = 2, 'owner A sees both own outlets');
select pg_temp.assert(not exists (select 1 from public.gold_stores where name = 'Outlet B1'), 'owner A cannot see tenant B outlet');
select pg_temp.assert((select count(*) from public.gold_users) = 2, 'owner A sees own tenant users only');

-- cannot create a store in another tenant (browser-supplied tenant_id is not trusted)
do $$
begin
  insert into public.gold_stores (tenant_id, code, name, slug)
  values (current_setting('test.tenant_b')::uuid, 'HACK', 'Hack', 'hack-store');
  raise exception 'ASSERTION FAILED: insert into tenant B must be rejected';
exception when insufficient_privilege then null;
end $$;

-- cannot update tenant B (0 rows affected, invisible)
with upd as (
  update public.gold_stores set name = 'pwned' where name = 'Outlet B1' returning 1
) select pg_temp.assert((select count(*) from upd) = 0, 'owner A cannot update tenant B store');

-- cannot move own store to tenant B
do $$
begin
  update public.gold_stores set tenant_id = current_setting('test.tenant_b')::uuid where name = 'Outlet A2';
  raise exception 'ASSERTION FAILED: moving a store to tenant B must be rejected';
exception when insufficient_privilege then null;
end $$;

-- owner of the tenant CAN create a store in own tenant
insert into public.gold_stores (tenant_id, code, name, slug)
values (public.gold_current_tenant_id(), 'CAB3', 'Outlet A3', 'toko-a-cab3');
select pg_temp.assert((select count(*) from public.gold_stores) = 3, 'owner A can create own outlet');

-- owner may rename own tenant, but not change plan/status
update public.gold_tenants set name = 'Toko A Baru';
select pg_temp.assert((select name from public.gold_tenants) = 'Toko A Baru', 'owner A can rename tenant');
do $$
begin
  update public.gold_tenants set plan = 'PRO';
  raise exception 'ASSERTION FAILED: owner must not change plan';
exception when insufficient_privilege then null;
end $$;

-- users table is read-only from the client (no self role escalation)
do $$
begin
  update public.gold_users set role_code = 'OWNER' where id = auth.uid();
  raise exception 'ASSERTION FAILED: gold_users must not be updatable by clients';
exception when insufficient_privilege then null;
end $$;

-- onboarding RPC is not callable by end users
do $$
begin
  perform public.gold_register_tenant(auth.uid(), 'x@x.x', 'X', 'X', 'X');
  raise exception 'ASSERTION FAILED: gold_register_tenant must be service_role only';
exception when insufficient_privilege then null;
end $$;

reset role;

-- ---------- CASHIER A --------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');

select pg_temp.assert(public.gold_current_role() = 'CASHIER', 'cashier role resolved');
select pg_temp.assert((select count(*) from public.gold_stores) = 1, 'cashier sees only assigned outlet');
select pg_temp.assert((select name from public.gold_stores) = 'Outlet A1', 'cashier sees Outlet A1');
select pg_temp.assert(not public.gold_has_permission('stores.manage'), 'cashier lacks stores.manage');
select pg_temp.assert(public.gold_has_permission('pos.use'), 'cashier has pos.use');

do $$
begin
  insert into public.gold_stores (tenant_id, code, name, slug)
  values (public.gold_current_tenant_id(), 'NEW', 'Outlet Baru', 'outlet-baru-kasir');
  raise exception 'ASSERTION FAILED: cashier must not create stores';
exception when insufficient_privilege then null;  -- RLS violation => 42501
end $$;

with upd as (update public.gold_tenants set name = 'x' returning 1)
select pg_temp.assert((select count(*) from upd) = 0, 'cashier cannot rename tenant');

reset role;

-- ---------- OWNER B ----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_stores) = 1, 'owner B sees only own outlet');
select pg_temp.assert(not exists (select 1 from public.gold_users where tenant_id <> public.gold_current_tenant_id()), 'owner B sees no foreign users');
reset role;

-- ---------- Deactivated user / suspended tenant ------------------------------
update public.gold_users set is_active = false where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert(public.gold_current_tenant_id() is null, 'inactive user has no tenant');
select pg_temp.assert((select count(*) from public.gold_stores) = 0, 'inactive user sees no stores');
select pg_temp.assert((select count(*) from public.gold_users) = 1, 'inactive user still sees own profile row');
reset role;

update public.gold_tenants set status = 'SUSPENDED' where name = 'Toko B';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_stores) = 0, 'suspended tenant sees no stores');
reset role;

-- ---------- Outsider (auth user without profile) & anon ----------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) from public.gold_tenants) = 0, 'outsider sees no tenants');
select pg_temp.assert((select count(*) from public.gold_stores) = 0, 'outsider sees no stores');
select pg_temp.assert((select count(*) from public.gold_users) = 0, 'outsider sees no users');
reset role;

set local role anon;
do $$
begin
  perform 1 from public.gold_stores;
  raise exception 'ASSERTION FAILED: anon must not read gold_stores';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------- Composite FK: user_store cannot cross tenants --------------------
do $$
begin
  insert into public.gold_user_stores (tenant_id, user_id, store_id)
  select a.tenant_id, a.id, s.id
  from public.gold_users a, public.gold_stores s
  where a.id = '00000000-0000-0000-0000-00000000000a' and s.name = 'Outlet B1';
  raise exception 'ASSERTION FAILED: cross-tenant user_store must violate FK';
exception when foreign_key_violation then null;
end $$;

select 'ALL GOLD CORE RLS TESTS PASSED' as result;
rollback;
