import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoldRateEntry } from "@/lib/gold-rate";
import { PAGE_SIZE, type ListResult } from "./crud";

export type CurrentRateRow = {
  purity_id: string;
  code: string;
  name: string;
  percentage: string;
  buy_price: string | null;
  sell_price: string | null;
  effective_at: string | null;
};

export type RateHistoryRow = {
  id: string;
  buy_price: string;
  sell_price: string;
  effective_at: string;
  purity: { code: string; name: string } | null;
  creator: { full_name: string } | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export const goldRateRepository = {
  /** Active purities with their current rate (null when not set yet). */
  async listCurrent(supabase: SupabaseClient): Promise<CurrentRateRow[]> {
    const [{ data: purities, error: e1 }, { data: rates, error: e2 }] = await Promise.all([
      supabase.from("gold_purities").select("id, code, name, percentage").eq("is_active", true).order("sort_order").order("code"),
      supabase.from("gold_v_current_gold_rates").select("purity_id, buy_price, sell_price, effective_at"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const byPurity = new Map((rates ?? []).map((r) => [r.purity_id as string, r]));
    return (purities ?? []).map((p) => {
      const r = byPurity.get(p.id as string);
      return {
        purity_id: p.id as string,
        code: p.code as string,
        name: p.name as string,
        percentage: String(p.percentage),
        buy_price: r ? String(r.buy_price) : null,
        sell_price: r ? String(r.sell_price) : null,
        effective_at: r ? (r.effective_at as string) : null,
      };
    });
  },

  /** One multi-row INSERT = one statement = atomic. */
  async insertMany(supabase: SupabaseClient, entries: GoldRateEntry[]): Promise<void> {
    const { error } = await supabase.from("gold_gold_rates").insert(entries);
    if (error) throw error;
  },

  async history(supabase: SupabaseClient, params: { purityId?: string; page?: number }): Promise<ListResult<RateHistoryRow>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase
      .from("gold_gold_rates")
      .select("id, buy_price, sell_price, effective_at, created_by, purity:gold_purities(code, name)", { count: "exact" });
    if (params.purityId) query = query.eq("purity_id", params.purityId);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query
      .order("effective_at", { ascending: false })
      .order("seq", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    // created_by -> auth.users has no FK path to gold_users for embedding; resolve names separately.
    const rows = (data ?? []) as unknown as (Omit<RateHistoryRow, "purity" | "creator"> & {
      created_by: string | null;
      purity: RateHistoryRow["purity"] | RateHistoryRow["purity"][];
    })[];
    const ids = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: users, error: e } = await supabase.from("gold_users").select("id, full_name").in("id", ids);
      if (e) throw e;
      (users ?? []).forEach((u) => names.set(u.id as string, u.full_name as string));
    }

    return {
      rows: rows.map((r) => ({
        id: r.id,
        buy_price: String(r.buy_price),
        sell_price: String(r.sell_price),
        effective_at: r.effective_at,
        purity: one(r.purity),
        creator: r.created_by && names.has(r.created_by) ? { full_name: names.get(r.created_by)! } : null,
      })),
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    };
  },

  /** Estimated sell price (current rate, standard weight) for the given products. */
  async productPrices(supabase: SupabaseClient, productIds: string[]): Promise<Map<string, string | null>> {
    if (productIds.length === 0) return new Map();
    const { data, error } = await supabase.from("gold_v_product_prices").select("product_id, sell_price").in("product_id", productIds);
    if (error) throw error;
    return new Map((data ?? []).map((r) => [r.product_id as string, r.sell_price === null ? null : String(r.sell_price)]));
  },

  async quoteProduct(supabase: SupabaseClient, productId: string) {
    const { data, error } = await supabase.rpc("gold_quote_product", { p_product_id: productId, p_discount: 0 });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { sell_rate: string; gold_value: string; subtotal: string; discount: string; total: string }
      | undefined;
    return row ?? null;
  },
};
