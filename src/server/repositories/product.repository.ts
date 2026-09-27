import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeSearch } from "@/lib/validation/common";
import type { ProductInput } from "@/lib/validation/master-data";
import { PAGE_SIZE, type ListResult } from "./crud";

export type ProductRow = Omit<ProductInput, "sku"> & {
  id: string;
  sku: string;
  gold_weight: string;
  photo_path: string | null;
  created_at: string;
  category: { id: string; code: string; name: string } | null;
  purity: { id: string; code: string; percentage: string } | null;
};

const SELECT =
  "id, category_id, purity_id, sku, name, description, gross_weight, stone_weight, gold_weight, stone_type, " +
  "cost_price, labor_cost, stone_price, margin_amount, photo_path, is_active, created_at, " +
  "category:gold_categories(id, code, name), purity:gold_purities(id, code, percentage)";

type Raw = Omit<ProductRow, "category" | "purity"> & {
  category: ProductRow["category"] | ProductRow["category"][];
  purity: ProductRow["purity"] | ProductRow["purity"][];
};

function normalize(row: Raw): ProductRow {
  const one = <T,>(v: T | T[]) => (Array.isArray(v) ? (v[0] ?? null) : v);
  return { ...row, category: one(row.category), purity: one(row.purity) };
}

export type ProductListParams = { q?: string; page?: number; pageSize?: number; categoryId?: string; status?: "active" | "inactive" };

export const productRepository = {
  async list(supabase: SupabaseClient, params: ProductListParams = {}): Promise<ListResult<ProductRow>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase.from("gold_products").select(SELECT, { count: "exact" });

    const q = sanitizeSearch(params.q);
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    if (params.categoryId) query = query.eq("category_id", params.categoryId);
    if (params.status) query = query.eq("is_active", params.status === "active");

    const pageSize = Math.min(params.pageSize ?? PAGE_SIZE, 500);
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    return { rows: ((data ?? []) as unknown as Raw[]).map(normalize), total: count ?? 0, page, pageSize };
  },

  async getById(supabase: SupabaseClient, id: string): Promise<ProductRow | null> {
    const { data, error } = await supabase.from("gold_products").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as unknown as Raw) : null;
  },

  async insert(supabase: SupabaseClient, values: ProductInput): Promise<{ id: string }> {
    const { data, error } = await supabase.from("gold_products").insert(values).select("id").single();
    if (error) throw error;
    return data as { id: string };
  },

  async update(supabase: SupabaseClient, id: string, values: Partial<ProductInput> & { photo_path?: string | null }) {
    const { data, error } = await supabase.from("gold_products").update(values).eq("id", id).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  },

  async remove(supabase: SupabaseClient, id: string): Promise<boolean> {
    const { data, error } = await supabase.from("gold_products").delete().eq("id", id).select("id");
    if (error) throw error;
    return (data ?? []).length > 0;
  },
};

// ---------------------------------------------------------------------------
// Storage (bucket gold-products). Path: <tenant_id>/<product_id>/<uuid>.<ext>
// Writes go through the user's client, so storage RLS enforces tenant + permission.
// ---------------------------------------------------------------------------
export const PRODUCT_PHOTO_BUCKET = "gold-products";

export const productPhotoStorage = {
  async upload(supabase: SupabaseClient, path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (error) throw error;
  },

  async remove(supabase: SupabaseClient, path: string) {
    const { error } = await supabase.storage.from(PRODUCT_PHOTO_BUCKET).remove([path]);
    if (error) console.error("[storage] remove failed", path, error.message);
  },
};
