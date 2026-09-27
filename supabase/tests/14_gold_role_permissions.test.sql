-- =============================================================================
-- Configurable role permissions: effective set drives RLS/RPCs; guard rails hold.
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier-a@test.local'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin-a@test.local'),
  ('00000000-0000-0000-0000-0000000000f1', 'new-a@test.local');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000a', 'owner-a@test.local', 'Owner A', 'Toko A', 'Pusat A');
select public.gold_register_tenant('00000000-0000-0000-0000-00000000000b', 'owner-b@test.local', 'Owner B', 'Toko B', 'Pusat B');
insert into public.gold_users (id, tenant_id, role_code, full_name, email)
select u.id, t.id, u.role, u.n, u.e from public.gold_tenants t,
  (values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'CASHIER', 'Kasir', 'cashier-a@test.local'),
          ('00000000-0000-0000-0000-0000000000d1'::uuid, 'ADMIN', 'Admin', 'admin-a@test.local')) u (id, role, n, e)
where t.name = 'Toko A';
insert into public.gold_user_stores (tenant_id, user_id, store_id)
select tenant_id, '00000000-0000-0000-0000-0000000000c1', id from public.gold_stores where name = 'Pusat A';

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

-- defaults
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert('buybacks.manage' = any (public.gold_current_permissions()), 'cashier default has buybacks.manage');
select pg_temp.assert(not ('inventory.view' = any (public.gold_current_permissions())), 'cashier default lacks inventory.view');
select pg_temp.assert((select count(*) from public.gold_inventory_movements) = 0, 'cashier cannot read movements by default');
reset role;

-- owner customises CASHIER: remove buybacks.manage, add inventory.view
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.gold_set_role_permissions('CASHIER', array['pos.use', 'sales.manage', 'customers.manage', 'inventory.view']);
select pg_temp.assert((select count(*) from public.gold_audit_logs where action = 'UPDATE_ROLE_PERMISSIONS') = 1, 'change audited');

-- guard rails
do $$ begin
  perform public.gold_set_role_permissions('OWNER', array['pos.use']);
  raise exception 'ASSERTION FAILED: owner role edited';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_set_role_permissions('ADMIN', array['users.manage']);
  raise exception 'ASSERTION FAILED: owner-only permission granted';
exception when invalid_parameter_value then null; end $$;
do $$ begin
  perform public.gold_set_role_permissions('ADMIN', array['hack.everything']);
  raise exception 'ASSERTION FAILED: unknown permission accepted';
exception when invalid_parameter_value then null; end $$;
insert into public.gold_products (category_id, purity_id, name, gross_weight)
select c.id, p.id, 'Cincin', 2 from public.gold_categories c, public.gold_purities p where c.code = 'RNG' and p.code = '18K';
select * from public.gold_inventory_receive((select id from public.gold_stores where name = 'Pusat A'), null, (select id from public.gold_products limit 1), '[{"gross_weight":2}]'::jsonb);
reset role;

-- effective set applies to cashier
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert('dashboard.view' = any (public.gold_current_permissions()), 'dashboard.view always on');
select pg_temp.assert(not public.gold_has_permission('buybacks.manage'), 'buybacks.manage removed');
select pg_temp.assert((select count(*) from public.gold_inventory_movements) = 1, 'cashier now reads movements (RLS follows)');
do $$ begin
  perform public.gold_create_buyback((select id from public.gold_stores limit 1), gen_random_uuid(), '[]'::jsonb, '[]'::jsonb, 0);
  raise exception 'ASSERTION FAILED: cashier did buyback after removal';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.gold_set_role_permissions('CASHIER', null);
  raise exception 'ASSERTION FAILED: cashier changed role permissions';
exception when insufficient_privilege then null; end $$;
reset role;

-- admin (non-owner) cannot change permissions either
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  perform public.gold_set_role_permissions('CASHIER', null);
  raise exception 'ASSERTION FAILED: admin changed role permissions';
exception when insufficient_privilege then null; end $$;
reset role;

-- tenant B unaffected by tenant A's override
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.gold_tenant_role_permissions) = 0, 'owner B sees no tenant A overrides');
reset role;

-- reset to default
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.gold_set_role_permissions('CASHIER', null);
select pg_temp.assert((select count(*) from public.gold_tenant_role_permissions) = 0, 'override removed');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select pg_temp.assert(public.gold_has_permission('buybacks.manage'), 'default restored');
reset role;

-- staff RPC: only an OWNER actor may create an OWNER (defense in depth)
select public.gold_add_staff('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'new-a@test.local', 'Owner Dua', null, 'OWNER', '{}');
select pg_temp.assert((select role_code from public.gold_users where id = '00000000-0000-0000-0000-0000000000f1') = 'OWNER', 'owner can create owner');

select 'ALL GOLD ROLE PERMISSION TESTS PASSED' as result;
rollback;
