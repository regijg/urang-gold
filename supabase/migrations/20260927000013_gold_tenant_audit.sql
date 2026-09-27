-- =============================================================================
-- GoldPOS — Settings: audit tenant profile changes.
-- (Renaming is already allowed for tenant.manage by the Phase 1 policy, and only
--  the `name` column is updatable by clients.)
-- =============================================================================

create or replace function public.gold_tenants_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then
    return new;
  end if;
  insert into public.gold_audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (new.id, auth.uid(), 'UPDATE_TENANT', 'tenant', new.id::text, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger gold_tenants_audit after update on public.gold_tenants
  for each row execute function public.gold_tenants_audit();
