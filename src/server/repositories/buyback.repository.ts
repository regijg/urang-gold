import type { SupabaseClient } from "@supabase/supabase-js";
import { dbRupiah, sanitizeSearch } from "@/lib/validation/common";
import type { BuybackInput } from "@/lib/validation/buyback";
import type { RecordedPayment } from "@/server/payments/provider";
import { PAGE_SIZE, type ListResult } from "./crud";
import type { Receipt } from "./sales.repository";

export type BuybackListRow = {
  id: string;
  buyback_number: string;
  status: "COMPLETED" | "VOIDED";
  total: string;
  bought_at: string;
  store: { name: string } | null;
  customer: { name: string } | null;
};

export type BuybackDetail = BuybackListRow & {
  store_id: string;
  gross_total: string;
  deduction_total: string;
  notes: string | null;
  public_token: string;
  voided_at: string | null;
  void_reason: string | null;
  items: {
    id: string;
    inventory_id: string;
    reused_piece: boolean;
    name: string;
    purity_code: string;
    gross_weight: string;
    stone_weight: string;
    gold_weight: string;
    buy_rate: string;
    price_per_gram: string;
    gross_amount: string;
    deduction: string;
    net_amount: string;
  }[];
  payments: { id: string; direction: "IN" | "OUT"; method: string; amount: string; reference: string | null; is_reversal: boolean }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export const buybackRepository = {
  async create(supabase: SupabaseClient, input: BuybackInput, payments: RecordedPayment[]) {
    const { data, error } = await supabase.rpc("gold_create_buyback", {
      p_store_id: input.store_id,
      p_customer_id: input.customer_id,
      p_items: input.items,
      p_payments: payments,
      p_expected_total: input.expected_total,
      p_notes: input.notes,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { buyback_id: string; buyback_number: string; total: string; public_token: string };
    return { ...row, total: dbRupiah(row.total) };
  },

  async void(supabase: SupabaseClient, id: string, reason: string) {
    const { error } = await supabase.rpc("gold_void_buyback", { p_buyback_id: id, p_reason: reason });
    if (error) throw error;
  },

  async list(supabase: SupabaseClient, params: { q?: string; page?: number; storeId?: string; status?: string }): Promise<ListResult<BuybackListRow>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase
      .from("gold_buybacks")
      .select("id, buyback_number, status, total, bought_at, store:gold_stores(name), customer:gold_customers(name)", { count: "exact" });
    const q = sanitizeSearch(params.q);
    if (q) query = query.ilike("buyback_number", `%${q}%`);
    if (params.storeId) query = query.eq("store_id", params.storeId);
    if (params.status) query = query.eq("status", params.status);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.order("bought_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as BuybackListRow),
      store: one(r.store as BuybackListRow["store"]),
      customer: one(r.customer as BuybackListRow["customer"]),
    }));
    return { rows, total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async getById(supabase: SupabaseClient, id: string): Promise<BuybackDetail | null> {
    const { data, error } = await supabase
      .from("gold_buybacks")
      .select(
        "id, store_id, buyback_number, status, gross_total, deduction_total, total, notes, public_token, bought_at, voided_at, void_reason, " +
          "store:gold_stores(name), customer:gold_customers(name), " +
          "items:gold_buyback_items(id, inventory_id, reused_piece, name, purity_code, gross_weight, stone_weight, gold_weight, buy_rate, price_per_gram, gross_amount, deduction, net_amount), " +
          "payments:gold_payments(id, direction, method, amount, reference, is_reversal)"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as unknown as Record<string, unknown>;
    return { ...(r as unknown as BuybackDetail), store: one(r.store as BuybackDetail["store"]), customer: one(r.customer as BuybackDetail["customer"]) };
  },

  /** A piece sold by this tenant, found by barcode (for taking it back). RLS limits to accessible stores. */
  async findSoldByBarcode(supabase: SupabaseClient, barcode: string) {
    const { data, error } = await supabase
      .from("gold_inventory")
      .select("id, barcode, name, gross_weight, stone_weight, gold_weight, purity:gold_purities(id, code)")
      .eq("barcode", barcode)
      .eq("status", "SOLD")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as unknown as Record<string, unknown>;
    const purity = one(r.purity as { id: string; code: string } | { id: string; code: string }[]);
    return {
      id: r.id as string,
      barcode: r.barcode as string,
      name: r.name as string,
      gross_weight: String(r.gross_weight),
      stone_weight: String(r.stone_weight),
      purity_id: purity?.id ?? "",
      purity_code: purity?.code ?? "-",
    };
  },

  async receipt(supabase: SupabaseClient, token: string): Promise<Receipt | null> {
    const { data, error } = await supabase.rpc("gold_get_buyback_receipt", { p_token: token });
    if (error) throw error;
    return (data as Receipt | null) ?? null;
  },
};
