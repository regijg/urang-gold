import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { todayWib } from "@/lib/date-range";
import { validatePaymentRows } from "@/lib/validation/buyback";
import { dbRupiah, isUuid, sanitizeSearch, str, type FieldErrors } from "@/lib/validation/common";
import { validateOrder } from "@/lib/validation/operations";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { PAGE_SIZE, type ListResult } from "@/server/repositories/crud";

export type OrderRow = {
  id: string;
  order_number: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  total: string;
  paid_total: string;
  refund_total: string;
  due_date: string | null;
  created_at: string;
  sale_id: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  store: { name: string } | null;
};

export type OrderDetail = OrderRow & {
  store_id: string;
  subtotal: string;
  discount_total: string;
  notes: string | null;
  cancel_reason: string | null;
  items: { id: string; inventory_id: string; barcode: string; name: string; purity_code: string; gold_weight: string; sell_rate: string; price: string; discount: string }[];
  payments: { id: string; direction: "IN" | "OUT"; method: string; amount: string; reference: string | null; paid_at: string }[];
};

const LIST_SELECT =
  "id, order_number, status, total, paid_total, refund_total, due_date, created_at, sale_id, customer:gold_customers(id, name, phone), store:gold_stores(name)";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const money = ["total", "paid_total", "refund_total", "subtotal", "discount_total"] as const;

function normalize<T extends OrderRow>(r: Record<string, unknown>): T {
  const row = { ...(r as unknown as T), customer: one(r.customer as OrderRow["customer"]), store: one(r.store as OrderRow["store"]) };
  for (const k of money) if (k in row) (row as Record<string, unknown>)[k] = dbRupiah((row as Record<string, unknown>)[k] as string);
  return row;
}

function payments(raw: unknown, required: string | null) {
  const errors: FieldErrors = {};
  const rows = validatePaymentRows(raw, errors, required);
  if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", Object.values(errors)[0], errors);
  return rows;
}

export const orderService = {
  async list(params: { q?: string; page?: number; status?: string }): Promise<ListResult<OrderRow>> {
    await requirePermission("orders.manage");
    const supabase = await createSupabaseServerClient();
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase.from("gold_orders").select(LIST_SELECT, { count: "exact" });
    const q = sanitizeSearch(params.q);
    if (q) query = query.ilike("order_number", `%${q}%`);
    if (params.status && ["OPEN", "COMPLETED", "CANCELLED"].includes(params.status)) query = query.eq("status", params.status);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw mapDbError(error);
    return { rows: ((data ?? []) as Record<string, unknown>[]).map((r) => normalize<OrderRow>(r)), total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async get(id: string): Promise<OrderDetail> {
    await requirePermission("orders.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pesanan tidak ditemukan.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("gold_orders")
      .select(
        `${LIST_SELECT}, store_id, subtotal, discount_total, notes, cancel_reason, ` +
          "items:gold_order_items(id, inventory_id, barcode, name, purity_code, gold_weight, sell_rate, price, discount), " +
          "payments:gold_payments(id, direction, method, amount, reference, paid_at)"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new AppError("NOT_FOUND", "Pesanan tidak ditemukan.");
    const o = normalize<OrderDetail>(data as unknown as Record<string, unknown>);
    return {
      ...o,
      items: (o.items ?? []).map((i) => ({ ...i, gold_weight: String(i.gold_weight), sell_rate: dbRupiah(i.sell_rate), price: dbRupiah(i.price), discount: dbRupiah(i.discount) })),
      payments: (o.payments ?? []).map((p) => ({ ...p, amount: dbRupiah(p.amount) })).sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
    };
  },

  async create(raw: Record<string, unknown>) {
    await requirePermission("orders.manage");
    const parsed = validateOrder(raw, todayWib());
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", parsed.errors.items ?? parsed.errors.customerId ?? "Periksa kembali isian Anda.", parsed.errors);
    const d = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_create_order", {
      p_store_id: d.store_id,
      p_customer_id: d.customer_id,
      p_items: d.items,
      p_payments: d.payments,
      p_expected_total: d.expected_total,
      p_due_date: d.due_date,
      p_notes: d.notes,
    });
    if (error) throw mapDbError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: string };
    return row;
  },

  async pay(id: string, raw: unknown) {
    await requirePermission("orders.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pesanan tidak ditemukan.");
    const rows = payments(raw, "Isi nominal pembayaran");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_pay_order", { p_order_id: id, p_payments: rows });
    if (error) throw mapDbError(error);
  },

  async complete(id: string, raw: unknown) {
    await requirePermission("orders.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pesanan tidak ditemukan.");
    const rows = payments(raw, null);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_complete_order", { p_order_id: id, p_payments: rows });
    if (error) throw mapDbError(error);
    return (Array.isArray(data) ? data[0] : data) as { sale_id: string; invoice_number: string; public_token: string };
  },

  async cancel(id: string, reason: unknown, refundRaw: unknown) {
    await requirePermission("orders.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Pesanan tidak ditemukan.");
    const r = str(reason);
    if (!r || r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan wajib diisi.", { reason: "Wajib diisi" });
    const refunds = payments(refundRaw, null);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_cancel_order", { p_order_id: id, p_reason: r, p_refunds: refunds });
    if (error) throw mapDbError(error);
  },
};
