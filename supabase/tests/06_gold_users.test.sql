-- =============================================================================
-- Staff management RPCs (service_role only, actor re-checked in DB).
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'kasir@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'kasir2@test.local');

select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
select set_config('test.store_a', (select id::text from public.gold_stores where name = 'Pusat A'), true);
select set_config('test.store_b', (select id::text from public.gold_stores where name = 'Pusat B'), true);

create or replace function pg_temp.assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'ASSERTION FAILED: %', p_msg; end if;
end $$;

-- clients cannot call the staff RPCs
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$ begin
  perform public.gold_add_staff('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'k@x', 'K', null, 'OWNER', '{}');
  raise exception 'ASSERTION FAILED: authenticated called gold_add_staff';
exception when insufficient_privilege then null; end $$;
reset role;

-- owner A adds a cashier to Pusat A
select public.gold_add_staff('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
  'Kasir@Test.local', 'Kasir Satu', '0812', 'CASHIER', array[current_setting('test.store_a')::uuid]);
select pg_temp.assert((select tenant_id from public.gold_users where id = '00000000-0000-0000-0000-0000000000c1')
  = (select tenant_id from public.gold_users where id = '00000000-0000-0000-0000-00000000000a'), 'staff joins actor tenant');
select pg_temp.assert((select email from public.gold_users where id = '00000000-0000-0000-0000-0000000000c1') = 'kasir@test.local', 'email normalized');
select pg_temp.assert((select count(*) from public.gold_user_stores where user_id = '00000000-0000-0000-0000-0000000000c1') = 1, 'store access set');
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'CREATE_USER') = 1, 'CREATE_USER audited');

-- a cashier cannot manage users
do $$ begin
  perform public.gold_add_staff('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2', 'k2@x', 'K2', null, 'OWNER', '{}');
  raise exception 'ASSERTION FAILED: cashier added staff';
exception when insufficient_privilege then null; end $$;

-- cannot assign another tenant's store
do $$ begin
  perform public.gold_add_staff('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c2', 'k2@x', 'K2', null, 'CASHIER',
    array[current_setting('test.store_b')::uuid]);
  raise exception 'ASSERTION FAILED: foreign store assigned';
exception when invalid_parameter_value then null; end $$;

-- owner B cannot edit tenant A staff
do $$ begin
  perform public.gold_update_staff('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1', 'x', null, 'OWNER', true, '{}');
  raise exception 'ASSERTION FAILED: owner B edited tenant A staff';
exception when invalid_parameter_value then null; end $$;
select pg_temp.assert(not public.gold_can_manage_user('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000c1'), 'owner B cannot reset tenant A password');
select pg_temp.assert(public.gold_can_manage_user('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1'), 'owner A can manage own staff');

-- self-demotion / self-deactivation blocked; last owner protected
do $$ begin
  perform public.gold_update_staff('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Owner A', null, 'OWNER', false, '{}');
  raise exception 'ASSERTION FAILED: owner deactivated self';
exception when invalid_parameter_value then null; end $$;

-- promote cashier to owner, then the original owner can be changed by the new owner
select public.gold_update_staff('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'Kasir Satu', null, 'OWNER', true, '{}');
select public.gold_update_staff('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Owner A', null, 'MANAGER', true, array[current_setting('test.store_a')::uuid]);
select pg_temp.assert((select role_code from public.gold_users where id = '00000000-0000-0000-0000-00000000000a') = 'MANAGER', 'owner demoted by another owner');
do $$ begin
  -- now only c1 is owner; demoting c1 via another actor is impossible (A lost users.manage), and c1 cannot demote self
  perform public.gold_update_staff('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', 'Kasir Satu', null, 'CASHIER', true, '{}');
  raise exception 'ASSERTION FAILED: last owner demoted';
exception when invalid_parameter_value then null; end $$;

select 'ALL GOLD USERS TESTS PASSED' as result;
rollback;
