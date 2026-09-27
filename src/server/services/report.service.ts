import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import type { DateRange } from "@/lib/date-range";
import { dbRupiah, isUuid } from "@/lib/validation/common";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";

export type ReportSummary = {
  sales_count: number;
  sales_total: string;
  sales_discount: string;
  sales_cost: string;
  gross_profit: string;
  sales_gold_weight: string;
  buyback_count: number;
  buyback_total: string;
  buyback_gold_weight: string;
  purchase_count: number;
  purchase_total: string;
  inventory_count: number;
  inventory_gold_weight: string;
  inventory_cost_value: string;
  inventory_market_value: string;
  cash_in: string;
  cash_out: string;
};
export type DailyRow = { day: string; sales_total: string; sales_count: number; buyback_total: string; purchase_total: string; gold_sold: string; gold_bought: string };
export type PaymentReportRow = { method: string; amount_in: string; amount_out: string; net: string; tx_count: number };
export type InventoryReportRow = { purity_code: string; category_name: string; item_count: number; gold_weight: string; cost_value: string; market_value: string };
export type CustomerReportRow = { customer_id: string; name: string; phone: string | null; sales_count: number; sales_total: string; buyback_count: number; buyback_total: string };

const MONEY = ["sales_total", "sales_discount", "sales_cost", "gross_profit", "buyback_total", "purchase_total", "inventory_cost_value", "inventory_market_value", "cash_in", "cash_out"];

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw mapDbError(error);
  return (data ?? []) as T[];
}

const store = (id?: string) => (isUuid(id) ? id : null);

export const reportService = {
  /** Owner dashboard metrics. Requires reports.view. */
  async summary(range: DateRange, storeId?: string): Promise<ReportSummary> {
    await requirePermission("reports.view");
    const [row] = await call<Record<string, unknown>>("gold_report_summary", { p_from: range.fromIso, p_to: range.toIso, p_store_id: store(storeId) });
    const out = { ...(row ?? {}) } as Record<string, unknown>;
    for (const k of MONEY) out[k] = dbRupiah(out[k] as string);
    return out as unknown as ReportSummary;
  },

  async daily(range: DateRange, storeId?: string): Promise<DailyRow[]> {
    await requirePermission("reports.view");
    const rows = await call<DailyRow>("gold_report_daily", { p_from: range.fromIso, p_to: range.toIso, p_store_id: store(storeId) });
    return rows.map((r) => ({ ...r, sales_total: dbRupiah(r.sales_total), buyback_total: dbRupiah(r.buyback_total), purchase_total: dbRupiah(r.purchase_total) }));
  },

  async payments(range: DateRange, storeId?: string): Promise<PaymentReportRow[]> {
    await requirePermission("reports.view");
    const rows = await call<PaymentReportRow>("gold_report_payments", { p_from: range.fromIso, p_to: range.toIso, p_store_id: store(storeId) });
    return rows.map((r) => ({ ...r, amount_in: dbRupiah(r.amount_in), amount_out: dbRupiah(r.amount_out), net: dbRupiah(r.net) }));
  },

  async inventory(storeId?: string): Promise<InventoryReportRow[]> {
    const session = await getAppSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    if (!session.permissions.includes("reports.view") && !session.permissions.includes("inventory.view")) {
      throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
    }
    const rows = await call<InventoryReportRow>("gold_report_inventory", { p_store_id: store(storeId) });
    return rows.map((r) => ({ ...r, cost_value: dbRupiah(r.cost_value), market_value: dbRupiah(r.market_value) }));
  },

  async customers(range: DateRange): Promise<CustomerReportRow[]> {
    await requirePermission("reports.view");
    const rows = await call<CustomerReportRow>("gold_report_customers", { p_from: range.fromIso, p_to: range.toIso, p_limit: 100 });
    return rows.map((r) => ({ ...r, sales_total: dbRupiah(r.sales_total), buyback_total: dbRupiah(r.buyback_total) }));
  },

  /** Detail rows for tabular reports / CSV (RLS applies). */
  async detail(kind: "sales" | "buybacks" | "purchases" | "movements" | "opname", range: DateRange, storeId?: string) {
    await requirePermission("reports.view");
    const supabase = await createSupabaseServerClient();
    const s = store(storeId);
    const limit = 5000;
    let query;
    switch (kind) {
      case "sales":
        query = supabase
          .from("gold_sale_items")
          .select("barcode, name, purity_code, gold_weight, sell_rate, subtotal, discount, price, cost_price, sale:gold_sales!inner(invoice_number, sold_at, status, store_id, customer:gold_customers(name))")
          .gte("sale.sold_at", range.fromIso)
          .lt("sale.sold_at", range.toIso)
          .eq("sale.status", "COMPLETED");
        if (s) query = query.eq("sale.store_id", s);
        break;
      case "buybacks":
        query = supabase
          .from("gold_buyback_items")
          .select("name, purity_code, gold_weight, price_per_gram, gross_amount, deduction, net_amount, buyback:gold_buybacks!inner(buyback_number, bought_at, status, store_id, customer:gold_customers(name))")
          .gte("buyback.bought_at", range.fromIso)
          .lt("buyback.bought_at", range.toIso)
          .eq("buyback.status", "COMPLETED");
        if (s) query = query.eq("buyback.store_id", s);
        break;
      case "purchases":
        query = supabase
          .from("gold_purchase_orders")
          .select("purchase_number, purchase_date, supplier_invoice, total, paid_total, payment_status, status, supplier:gold_suppliers(name)")
          .gte("created_at", range.fromIso)
          .lt("created_at", range.toIso);
        if (s) query = query.eq("store_id", s);
        break;
      case "movements":
        query = supabase
          .from("gold_inventory_movements")
          .select("created_at, movement_type, quantity, weight, before_weight, after_weight, from_status, to_status, notes, inventory:gold_inventory(barcode, name)")
          .gte("created_at", range.fromIso)
          .lt("created_at", range.toIso);
        if (s) query = query.or(`from_store_id.eq.${s},to_store_id.eq.${s}`);
        break;
      case "opname":
        query = supabase
          .from("gold_stock_opnames")
          .select("opname_number, status, started_at, approved_at, system_count, physical_count, diff_count, system_weight, physical_weight, diff_weight, estimated_value, store:gold_stores(name)")
          .gte("started_at", range.fromIso)
          .lt("started_at", range.toIso);
        if (s) query = query.eq("store_id", s);
        break;
    }
    const { data, error } = await query.limit(limit);
    if (error) throw mapDbError(error);
    return (data ?? []) as unknown as Record<string, unknown>[];
  },
};
