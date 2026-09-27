import type { SupabaseClient } from "@supabase/supabase-js";

export type RegisterTenantParams = {
  userId: string;
  email: string;
  fullName: string;
  tenantName: string;
  storeName: string;
};

/**
 * Calls the atomic onboarding RPC. Must be given a SERVICE-ROLE client:
 * gold_register_tenant is not executable by anon/authenticated.
 */
export async function registerTenant(
  adminClient: SupabaseClient,
  params: RegisterTenantParams
): Promise<{ tenantId: string; storeId: string }> {
  const { data, error } = await adminClient.rpc("gold_register_tenant", {
    p_user_id: params.userId,
    p_email: params.email,
    p_full_name: params.fullName,
    p_tenant_name: params.tenantName,
    p_store_name: params.storeName,
  });

  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { tenant_id: string; store_id: string } | null;
  if (!row) throw new Error("gold_register_tenant returned no row");
  return { tenantId: row.tenant_id, storeId: row.store_id };
}
