import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationInput } from "@/lib/validation/inventory";

export type LocationRow = LocationInput & {
  id: string;
  store: { id: string; name: string } | null;
  parent: { id: string; code: string; name: string } | null;
};

const SELECT =
  "id, store_id, parent_id, code, name, type, sort_order, is_active, " +
  "store:gold_stores(id, name), parent:gold_locations!gold_locations_tenant_id_store_id_parent_id_fkey(id, code, name)";

type Raw = Omit<LocationRow, "store" | "parent"> & {
  store: LocationRow["store"] | LocationRow["store"][];
  parent: LocationRow["parent"] | LocationRow["parent"][];
};
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const normalize = (r: Raw): LocationRow => ({ ...r, store: one(r.store), parent: one(r.parent) });

export const locationRepository = {
  async list(supabase: SupabaseClient, params: { storeId?: string; activeOnly?: boolean } = {}): Promise<LocationRow[]> {
    let query = supabase.from("gold_locations").select(SELECT);
    if (params.storeId) query = query.eq("store_id", params.storeId);
    if (params.activeOnly) query = query.eq("is_active", true);
    const { data, error } = await query.order("sort_order").order("code");
    if (error) throw error;
    return ((data ?? []) as unknown as Raw[]).map(normalize);
  },

  async getById(supabase: SupabaseClient, id: string): Promise<LocationRow | null> {
    const { data, error } = await supabase.from("gold_locations").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as unknown as Raw) : null;
  },

  async insert(supabase: SupabaseClient, values: LocationInput): Promise<{ id: string }> {
    const { data, error } = await supabase.from("gold_locations").insert(values).select("id").single();
    if (error) throw error;
    return data as { id: string };
  },

  async update(supabase: SupabaseClient, id: string, values: LocationInput): Promise<boolean> {
    const { data, error } = await supabase.from("gold_locations").update(values).eq("id", id).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<boolean> {
    const { data, error } = await supabase.from("gold_locations").delete().eq("id", id).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  },
};
