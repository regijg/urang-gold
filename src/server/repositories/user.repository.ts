import type { SupabaseClient } from "@supabase/supabase-js";

export type UserProfileRow = {
  id: string;
  tenant_id: string;
  role_code: string;
  full_name: string;
  email: string;
  is_active: boolean;
  tenant: { id: string; name: string; slug: string; status: string } | null;
  role: { code: string; name: string; permissions: string[] } | null;
};

type RawRow = Omit<UserProfileRow, "tenant" | "role"> & {
  tenant: UserProfileRow["tenant"] | UserProfileRow["tenant"][];
  role: UserProfileRow["role"] | UserProfileRow["role"][];
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Loads the signed-in user's profile through RLS. The tenant is only visible
 * when the user is active and the tenant is ACTIVE (see gold_current_tenant_id).
 */
export async function findProfileById(supabase: SupabaseClient, userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("gold_users")
    .select(
      "id, tenant_id, role_code, full_name, email, is_active, " +
        "tenant:gold_tenants(id, name, slug, status), " +
        "role:gold_roles(code, name, permissions)"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as RawRow;
  return { ...row, tenant: one(row.tenant), role: one(row.role) };
}
