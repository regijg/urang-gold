-- =============================================================================
-- Settings: tenant rename (owner only, name column only, audited), roles readable.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', '');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', '');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select '00000000-0000-0000-0000-0000000000d1', id, 'ADMIN', 'Admin A', 'admin-a@test.local' from public.gold_tenants where name = 'Toko A';

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

-- owner renames own tenant -> audited
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.gold_tenants set name = 'Toko Emas A Jaya';
select pg_temp.assert((select name from public.gold_tenants) = 'Toko Emas A Jaya', 'owner renamed tenant');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'UPDATE_TENANT') = 1, 'UPDATE_TENANT audited');
select pg_temp.assert(
  (select old_data ->> 'name' from public.gold_audit_logs where action = 'UPDATE_TENANT') = 'Toko A', 'old name kept in audit');
do $$ begin
  update public.gold_tenants set slug = 'hack';
  raise exception 'ASSERTION FAILED: owner changed slug';
exception when insufficient_privilege then null; end $$;
select pg_temp.assert((select count(*) from public.gold_roles) = 5, 'roles readable');
reset role;

-- admin (no tenant.manage) cannot rename
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
with u as (update public.gold_tenants set name = 'x' returning 1)
select pg_temp.assert((select count(*) from u) = 0, 'admin cannot rename tenant');
reset role;

-- owner B cannot rename tenant A
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
with u as (update public.gold_tenants set name = 'x' where name = 'Toko Emas A Jaya' returning 1)
select pg_temp.assert((select count(*) from u) = 0, 'owner B cannot rename tenant A');
reset role;

select 'ALL GOLD SETTINGS TESTS PASSED' as result;
rollback;
