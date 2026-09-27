import type { SupabaseClient } from "@supabase/supabase-js";
import { dbRupiah, sanitizeSearch } from "@/lib/validation/common";
import type { CheckoutInput } from "@/lib/validation/sales";
import type { RecordedPayment } from "@/server/payments/provider";
import { PAGE_SIZE, type ListResult } from "./crud";

export type PosItem = {
  id: string;
  barcode: string;
  name: string;
  purity_code: string;
  gross_weight: string;
  gold_weight: string;
  price: string | null; // current sell price (null = rate not set)
};

export type SaleListRow = {
  id: string;
  invoice_number: string;
  status: "COMPLETED" | "VOIDED";
  total: string;
  sold_at: string;
  store: { name: string } | null;
  customer: { name: string } | null;
};

export type SaleDetail = SaleListRow & {
  store_id: string;
  subtotal: string;
  discount_total: string;
  paid_total: string;
  change_amount: string;
  notes: string | null;
  public_token: string;
  cashier_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  items: {
    id: string;
    inventory_id: string;
    barcode: string;
    name: string;
    purity_code: string;
    gross_weight: string;
    gold_weight: string;
    sell_rate: string;
    gold_value: string;
    labor_cost: string;
    stone_price: string;
    margin_amount: string;
    subtotal: string;
    discount: string;
    price: string;
  }[];
  payments: { id: string; direction: "IN" | "OUT"; method: string; amount: string; reference: string | null; is_reversal: boolean }[];
};

export type Receipt = {
  kind?: "SALE" | "BUYBACK" | "TRADE_IN";
  invoice_number: string;
  status: string;
  sold_at: string;
  subtotal: string;
  discount_total: string;
  total: string;
  paid_total: string;
  change_amount: string;
  store: { name: string; address: string | null; phone: string | null };
  tenant: { name: string };
  cashier: string | null;
  customer: string | null;
  items: { name: string; barcode: string; purity_code: string; gross_weight: string; gold_weight: string; subtotal: string; discount: string; price: string }[];
  payments: { method: string; amount: string }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function withPrices(supabase: SupabaseClient, rows: Record<string, unknown>[]): Promise<PosItem[]> {
  const ids = rows.map((r) => r.id as string);
  const prices = new Map<string, string | null>();
  if (ids.length) {
    const { data, error } = await supabase.from("gold_v_inventory_prices").select("inventory_id, sell_price").in("inventory_id", ids);
    if (error) throw error;
    (data ?? []).forEach((p) => prices.set(p.inventory_id as string, p.sell_price === null ? null : dbRupiah(p.sell_price)));
  }
  return rows.map((r) => ({
    id: r.id as string,
    barcode: r.barcode as string,
    name: r.name as string,
    purity_code: (one(r.purity as { code: string } | { code: string }[]) ?? { code: "-" }).code,
    gross_weight: String(r.gross_weight),
    gold_weight: String(r.gold_weight),
    price: prices.get(r.id as string) ?? null,
  }));
}

const POS_SELECT = "id, barcode, name, gross_weight, gold_weight, purity:gold_purities(code)";

export const salesRepository = {
  async findAvailableByBarcode(supabase: SupabaseClient, storeId: string, barcode: string): Promise<PosItem | null> {
    const { data, error } = await supabase
      .from("gold_inventory")
      .select(POS_SELECT)
      .eq("store_id", storeId)
      .eq("status", "AVAILABLE")
      .eq("barcode", barcode)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return (await withPrices(supabase, [data as unknown as Record<string, unknown>]))[0];
  },

  async searchAvailable(supabase: SupabaseClient, storeId: string, q: string): Promise<PosItem[]> {
    const term = sanitizeSearch(q);
    if (term.length < 2) return [];
    const { data, error } = await supabase
      .from("gold_inventory")
      .select(POS_SELECT)
      .eq("store_id", storeId)
      .eq("status", "AVAILABLE")
      .or(`barcode.ilike.%${term}%,name.ilike.%${term}%,serial_number.ilike.%${term}%`)
      .order("barcode")
      .limit(20);
    if (error) throw error;
    return withPrices(supabase, (data ?? []) as unknown as Record<string, unknown>[]);
  },

  async searchCustomers(supabase: SupabaseClient, q: string) {
    const term = sanitizeSearch(q);
    if (term.length < 2) return [];
    const { data, error } = await supabase
      .from("gold_customers")
      .select("id, name, phone")
      .eq("is_active", true)
      .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      .order("name")
      .limit(10);
    if (error) throw error;
    return (data ?? []) as { id: string; name: string; phone: string | null }[];
  },

  async create(supabase: SupabaseClient, input: CheckoutInput, payments: RecordedPayment[]) {
    const { data, error } = await supabase.rpc("gold_create_sale", {
      p_store_id: input.store_id,
      p_customer_id: input.customer_id,
      p_items: input.items,
      p_payments: payments,
      p_expected_total: input.expected_total,
      p_notes: input.notes,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { sale_id: string; invoice_number: string; total: string; change_amount: string; public_token: string };
    return { ...row, total: dbRupiah(row.total), change_amount: dbRupiah(row.change_amount) };
  },

  async void(supabase: SupabaseClient, saleId: string, reason: string) {
    const { error } = await supabase.rpc("gold_void_sale", { p_sale_id: saleId, p_reason: reason });
    if (error) throw error;
  },

  async list(
    supabase: SupabaseClient,
    params: { q?: string; page?: number; storeId?: string; status?: string; from?: string; to?: string }
  ): Promise<ListResult<SaleListRow>> {
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase
      .from("gold_sales")
      .select("id, invoice_number, status, total, sold_at, store:gold_stores(name), customer:gold_customers(name)", { count: "exact" });
    const q = sanitizeSearch(params.q);
    if (q) query = query.ilike("invoice_number", `%${q}%`);
    if (params.storeId) query = query.eq("store_id", params.storeId);
    if (params.status) query = query.eq("status", params.status);
    if (params.from) query = query.gte("sold_at", params.from);
    if (params.to) query = query.lt("sold_at", params.to);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.order("sold_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as SaleListRow),
      store: one(r.store as SaleListRow["store"]),
      customer: one(r.customer as SaleListRow["customer"]),
    }));
    return { rows, total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async getById(supabase: SupabaseClient, id: string): Promise<SaleDetail | null> {
    const { data, error } = await supabase
      .from("gold_sales")
      .select(
        "id, store_id, invoice_number, status, subtotal, discount_total, total, paid_total, change_amount, notes, public_token, " +
          "cashier_id, sold_at, voided_at, void_reason, store:gold_stores(name), customer:gold_customers(name), " +
          "items:gold_sale_items(id, inventory_id, barcode, name, purity_code, gross_weight, gold_weight, sell_rate, gold_value, " +
          "labor_cost, stone_price, margin_amount, subtotal, discount, price), " +
          "payments:gold_payments(id, direction, method, amount, reference, is_reversal)"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as unknown as Record<string, unknown>;
    return {
      ...(r as unknown as SaleDetail),
      store: one(r.store as SaleDetail["store"]),
      customer: one(r.customer as SaleDetail["customer"]),
    };
  },

  async receipt(supabase: SupabaseClient, token: string): Promise<Receipt | null> {
    const { data, error } = await supabase.rpc("gold_get_receipt", { p_token: token });
    if (error) throw error;
    return (data as Receipt | null) ?? null;
  },
};
