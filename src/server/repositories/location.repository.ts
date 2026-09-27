import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationInput } from "@/lib/validation/inventory";

export type LocationRow = LocationInput & {
  id: string;
  store: { id: string; name: string } | null;
  parent: { id: string; code: string; name: string } | null;
};

// The parent (self-reference) is resolved in code, not via a PostgREST embed:
// PostgREST does not expose the composite self-FK as a named relationship.
const SELECT = "id, store_id, parent_id, code, name, type, sort_order, is_active, store:gold_stores(id, name)";

type Raw = Omit<LocationRow, "store" | "parent"> & { store: LocationRow["store"] | LocationRow["store"][] };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function withParents(rows: Raw[], parents: Pick<LocationRow, "id" | "code" | "name">[]): LocationRow[] {
  const byId = new Map(parents.map((p) => [p.id, { id: p.id, code: p.code, name: p.name }]));
  return rows.map((r) => ({ ...r, store: one(r.store), parent: r.parent_id ? (byId.get(r.parent_id) ?? null) : null }));
}

async function fetchParents(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("gold_locations").select("id, code, name").in("id", ids);
  if (error) throw error;
  return (data ?? []) as Pick<LocationRow, "id" | "code" | "name">[];
}

export const locationRepository = {
  async list(supabase: SupabaseClient, params: { storeId?: string; activeOnly?: boolean } = {}): Promise<LocationRow[]> {
    let query = supabase.from("gold_locations").select(SELECT);
    if (params.storeId) query = query.eq("store_id", params.storeId);
    if (params.activeOnly) query = query.eq("is_active", true);
    const { data, error } = await query.order("sort_order").order("code");
    if (error) throw error;
    const rows = (data ?? []) as unknown as Raw[];
    // parents are usually in the same list; fetch any missing ones (e.g. inactive parent with activeOnly)
    const known = new Set(rows.map((r) => r.id));
    const missing = [...new Set(rows.map((r) => r.parent_id).filter((p): p is string => !!p && !known.has(p)))];
    const extra = await fetchParents(supabase, missing);
    return withParents(rows, [...rows, ...extra]);
  },

  async getById(supabase: SupabaseClient, id: string): Promise<LocationRow | null> {
    const { data, error } = await supabase.from("gold_locations").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as Raw;
    return withParents([row], await fetchParents(supabase, row.parent_id ? [row.parent_id] : []))[0];
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
