import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { dbRupiah, isUuid, sanitizeSearch, str } from "@/lib/validation/common";
import { validatePaymentRows } from "@/lib/validation/buyback";
import { validatePurchase } from "@/lib/validation/purchase";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { providerFor } from "@/server/payments/provider";
import { PAGE_SIZE, type ListResult } from "@/server/repositories/crud";

export type PurchaseRow = {
  id: string;
  purchase_number: string;
  supplier_invoice: string | null;
  purchase_date: string;
  status: "RECEIVED" | "VOIDED";
  total: string;
  paid_total: string;
  payment_status: "UNPAID" | "PARTIAL" | "PAID";
  supplier: { name: string } | null;
  store: { name: string } | null;
};

export type PurchaseDetail = PurchaseRow & {
  store_id: string;
  subtotal_cost: string;
  labor_total: string;
  notes: string | null;
  void_reason: string | null;
  items: { id: string; inventory_id: string; purity_code: string; gross_weight: string; gold_weight: string; cost_price: string; labor_cost: string; line_total: string; inventory: { barcode: string; name: string } | null }[];
  payments: { id: string; direction: "IN" | "OUT"; method: string; amount: string; reference: string | null; is_reversal: boolean; paid_at: string }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const LIST_SELECT =
  "id, purchase_number, supplier_invoice, purchase_date, status, total, paid_total, payment_status, supplier:gold_suppliers(name), store:gold_stores(name)";

export const purchaseService = {
  async create(raw: Parameters<typeof validatePurchase>[0]) {
    await requirePermission("purchases.manage");
    const parsed = validatePurchase(raw);
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", parsed.errors.items ?? "Periksa kembali isian Anda.", parsed.errors);
    const payments = await Promise.all(parsed.data.payments.map((p) => providerFor(p.method).prepare(p)));
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_create_purchase", {
      p_store_id: parsed.data.store_id,
      p_location_id: parsed.data.location_id,
      p_supplier_id: parsed.data.supplier_id,
      p_supplier_invoice: parsed.data.supplier_invoice,
      p_purchase_date: parsed.data.purchase_date,
      p_items: parsed.data.items,
      p_payments: payments,
      p_notes: parsed.data.notes,
    });
    if (error) throw mapDbError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { purchase_id: string; purchase_number: string; total: string };
    return { ...row, total: dbRupiah(row.total) };
  },

  async pay(id: string, rawPayments: unknown) {
    await requirePermission("purchases.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pembelian tidak ditemukan.");
    const errors: Record<string, string> = {};
    const payments = validatePaymentRows(rawPayments, errors, "Isi nominal pembayaran");
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", Object.values(errors)[0], errors);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_pay_purchase", { p_purchase_id: id, p_payments: payments });
    if (error) throw mapDbError(error);
  },

  async void(id: string, reason: unknown) {
    await requirePermission("purchases.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pembelian tidak ditemukan.");
    const r = str(reason);
    if (!r || r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan wajib diisi (maks. 500 karakter).", { reason: "Wajib diisi" });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_void_purchase", { p_purchase_id: id, p_reason: r });
    if (error) throw mapDbError(error);
  },

  async list(params: { q?: string; page?: number; status?: string }): Promise<ListResult<PurchaseRow>> {
    await requirePermission("purchases.manage");
    const supabase = await createSupabaseServerClient();
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase.from("gold_purchase_orders").select(LIST_SELECT, { count: "exact" });
    const q = sanitizeSearch(params.q);
    if (q) query = query.or(`purchase_number.ilike.%${q}%,supplier_invoice.ilike.%${q}%`);
    if (params.status && ["UNPAID", "PARTIAL", "PAID"].includes(params.status)) query = query.eq("payment_status", params.status).eq("status", "RECEIVED");
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.order("purchase_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw mapDbError(error);
    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as PurchaseRow),
      supplier: one(r.supplier as PurchaseRow["supplier"]),
      store: one(r.store as PurchaseRow["store"]),
    }));
    return { rows, total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async get(id: string): Promise<PurchaseDetail> {
    await requirePermission("purchases.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pembelian tidak ditemukan.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("gold_purchase_orders")
      .select(
        `${LIST_SELECT}, store_id, subtotal_cost, labor_total, notes, void_reason, ` +
          "items:gold_purchase_order_items(id, inventory_id, purity_code, gross_weight, gold_weight, cost_price, labor_cost, line_total, inventory:gold_inventory(barcode, name)), " +
          "payments:gold_payments(id, direction, method, amount, reference, is_reversal, paid_at)"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new AppError("NOT_FOUND", "Pembelian tidak ditemukan.");
    const r = data as unknown as Record<string, unknown>;
    return {
      ...(r as unknown as PurchaseDetail),
      supplier: one(r.supplier as PurchaseRow["supplier"]),
      store: one(r.store as PurchaseRow["store"]),
      items: ((r.items ?? []) as (PurchaseDetail["items"][number] & { inventory: unknown })[]).map((i) => ({
        ...i,
        inventory: one(i.inventory as { barcode: string; name: string } | { barcode: string; name: string }[]),
      })),
    };
  },
};
