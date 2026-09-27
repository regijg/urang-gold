-- =============================================================================
-- GoldPOS — Phase 12: performance & security hardening.
--
-- 1. RLS performance: wrap row-independent function calls in policies with
--    (select ...) so Postgres evaluates them once per statement (initPlan)
--    instead of once per row. Semantics are unchanged; the SQL test suite
--    re-verifies every policy.
-- 2. LOGIN audit event (master prompt §27).
-- =============================================================================

do $$
declare
  p record;
  v_qual text;
  v_check text;
  wrap constant text[] := array[
    '(public\.)?gold_current_tenant_id\(\)',
    '(public\.)?gold_current_role\(\)',
    '(public\.)?gold_has_permission\(''[a-z_.]+''::text\)',
    'auth\.uid\(\)'
  ];
  w text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where (schemaname = 'public' and tablename like 'gold\_%')
       or (schemaname = 'storage' and policyname like 'gold\_%')
  loop
    v_qual := p.qual;
    v_check := p.with_check;
    foreach w in array wrap loop
      -- \& = whole match; skip calls that are already wrapped
      if v_qual is not null and v_qual !~ ('\(\s*SELECT\s+' || w) then
        v_qual := regexp_replace(v_qual, w, '(SELECT \&)', 'g');
      end if;
      if v_check is not null and v_check !~ ('\(\s*SELECT\s+' || w) then
        v_check := regexp_replace(v_check, w, '(SELECT \&)', 'g');
      end if;
    end loop;

    if v_qual is distinct from p.qual then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, v_qual);
    end if;
    if v_check is distinct from p.with_check then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, v_check);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- LOGIN audit (called by the server right after a successful sign-in)
-- -----------------------------------------------------------------------------
create or replace function public.gold_log_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.gold_current_tenant_id();
begin
  if v_tenant is null then
    return;
  end if;
  -- at most one LOGIN row per user per minute (avoids log spam from repeated calls)
  if exists (select 1 from public.gold_audit_logs
             where tenant_id = v_tenant and user_id = auth.uid() and action = 'LOGIN' and created_at > now() - interval '1 minute') then
    return;
  end if;
  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  values (v_tenant, auth.uid(), 'LOGIN', 'user', auth.uid()::text);
end;
$$;

revoke all on function public.gold_log_login() from public, anon;
grant execute on function public.gold_log_login() to authenticated;

-- audit lookups by action (e.g. LOGIN history)
create index if not exists gold_audit_logs_action_idx on public.gold_audit_logs (tenant_id, action, created_at desc);
