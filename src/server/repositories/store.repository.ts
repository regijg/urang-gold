import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreInput } from "@/lib/validation/inventory";

export type StoreRow = {
  id: string;
  code: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_active: boolean;
  catalog_enabled: boolean;
};

const SELECT = "id, code, name, slug, address, phone, whatsapp, is_active, catalog_enabled";

/** Stores the current user may access — filtering is done by RLS (gold_can_access_store). */
export async function listAccessibleStores(supabase: SupabaseClient, opts: { activeOnly?: boolean } = {}): Promise<StoreRow[]> {
  let query = supabase.from("gold_stores").select(SELECT);
  if (opts.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoreRow[];
}

export const storeRepository = {
  list: listAccessibleStores,

  async getById(supabase: SupabaseClient, id: string): Promise<StoreRow | null> {
    const { data, error } = await supabase.from("gold_stores").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as StoreRow | null) ?? null;
  },

  async insert(supabase: SupabaseClient, values: StoreInput & { tenant_id: string; slug: string }): Promise<{ id: string }> {
    const { data, error } = await supabase.from("gold_stores").insert(values).select("id").single();
    if (error) throw error;
    return data as { id: string };
  },

  async update(supabase: SupabaseClient, id: string, values: StoreInput): Promise<boolean> {
    const { data, error } = await supabase.from("gold_stores").update(values).eq("id", id).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  },
};
