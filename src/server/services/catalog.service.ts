import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dbRupiah, isUuid, sanitizeSearch } from "@/lib/validation/common";

export type CatalogStore = {
  name: string;
  tenant_name: string;
  address: string | null;
  whatsapp: string | null;
  phone: string | null;
  rates: { code: string; sell_price: string }[];
  categories: { id: string; name: string }[];
};

export type CatalogProduct = {
  product_id: string;
  sku: string;
  name: string;
  description: string | null;
  category_name: string;
  purity_code: string;
  photo_path: string | null;
  stock_count: number;
  min_weight: string;
  max_weight: string;
  min_price: string | null;
  max_price: string | null;
};

export const CATALOG_PAGE_SIZE = 24;

/** Public catalogue (anon). Only safe columns come back from the SECURITY DEFINER functions. */
export const catalogService = {
  async store(slug: string): Promise<CatalogStore | null> {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_catalog_store", { p_slug: slug });
    if (error) {
      console.error("[catalog]", error.message);
      return null;
    }
    const s = data as CatalogStore | null;
    return s ? { ...s, rates: s.rates.map((r) => ({ ...r, sell_price: dbRupiah(r.sell_price) })) } : null;
  },

  async products(slug: string, params: { category?: string; q?: string; page?: number }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_catalog_products", {
      p_slug: slug,
      p_category_id: isUuid(params.category) ? params.category : null,
      p_q: sanitizeSearch(params.q) || null,
      p_limit: CATALOG_PAGE_SIZE,
      p_offset: (page - 1) * CATALOG_PAGE_SIZE,
    });
    if (error) {
      console.error("[catalog]", error.message);
      return { rows: [] as CatalogProduct[], total: 0, page };
    }
    const rows = (data ?? []) as (CatalogProduct & { total_count: number })[];
    return {
      rows: rows.map((r) => ({
        ...r,
        min_price: r.min_price === null ? null : dbRupiah(r.min_price),
        max_price: r.max_price === null ? null : dbRupiah(r.max_price),
      })),
      total: Number(rows[0]?.total_count ?? 0),
      page,
    };
  },
};
