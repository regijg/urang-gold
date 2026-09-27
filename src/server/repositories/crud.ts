import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeSearch } from "@/lib/validation/common";

export const PAGE_SIZE = 20;

export type ListParams = { q?: string; page?: number; activeOnly?: boolean; pageSize?: number };
export type ListResult<T> = { rows: T[]; total: number; page: number; pageSize: number };

type Config = {
  table: string;
  select: string;
  searchColumns: string[];
  order: { column: string; ascending: boolean }[];
};

/**
 * Minimal table repository. Always used with the per-request user client, so
 * tenant isolation and permissions are enforced by RLS — no tenant filter here.
 * Throws the raw PostgREST error; services map it with mapDbError().
 */
export function createCrudRepository<Row, Insert extends object>(config: Config) {
  return {
    async list(supabase: SupabaseClient, params: ListParams = {}): Promise<ListResult<Row>> {
      const pageSize = params.pageSize ?? PAGE_SIZE;
      const page = params.page && params.page > 0 ? params.page : 1;
      let query = supabase.from(config.table).select(config.select, { count: "exact" });

      const q = sanitizeSearch(params.q);
      if (q) query = query.or(config.searchColumns.map((c) => `${c}.ilike.%${q}%`).join(","));
      if (params.activeOnly) query = query.eq("is_active", true);
      for (const o of config.order) query = query.order(o.column, { ascending: o.ascending });

      const from = (page - 1) * pageSize;
      const { data, error, count } = await query.range(from, from + pageSize - 1);
      if (error) throw error;
      return { rows: (data ?? []) as Row[], total: count ?? 0, page, pageSize };
    },

    async getById(supabase: SupabaseClient, id: string): Promise<Row | null> {
      const { data, error } = await supabase.from(config.table).select(config.select).eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Row | null) ?? null;
    },

    async insert(supabase: SupabaseClient, values: Insert): Promise<{ id: string }> {
      const { data, error } = await supabase.from(config.table).insert(values).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },

    /** Returns false when no row was visible/updatable (not found or no permission). */
    async update(supabase: SupabaseClient, id: string, values: Partial<Insert>): Promise<boolean> {
      const { data, error } = await supabase
        .from(config.table)
        .update(values as Record<string, unknown>)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },

    async remove(supabase: SupabaseClient, id: string): Promise<boolean> {
      const { data, error } = await supabase.from(config.table).delete().eq("id", id).select("id");
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  };
}
