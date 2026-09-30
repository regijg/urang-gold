import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { todayWib } from "@/lib/date-range";
import { validatePaymentRows } from "@/lib/validation/buyback";
import { dbRupiah, isUuid, sanitizeSearch, str, type FieldErrors } from "@/lib/validation/common";
import { rupiahField, validateRepair } from "@/lib/validation/operations";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { PAGE_SIZE, type ListResult } from "@/server/repositories/crud";

export type RepairStatus = "RECEIVED" | "IN_PROGRESS" | "READY" | "PICKED_UP" | "CANCELLED";

export type RepairRow = {
  id: string;
  repair_number: string;
  item_description: string;
  service_type: string;
  status: RepairStatus;
  estimated_cost: string;
  final_cost: string | null;
  paid_total: string;
  refund_total: string;
  due_date: string | null;
  created_at: string;
  customer: { id: string; name: string; phone: string | null } | null;
  store: { name: string } | null;
};

export type RepairDetail = RepairRow & {
  weight_in: string | null;
  notes: string | null;
  cancel_reason: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  payments: { id: string; direction: "IN" | "OUT"; method: string; amount: string; reference: string | null; paid_at: string }[];
};

const LIST_SELECT =
  "id, repair_number, item_description, service_type, status, estimated_cost, final_cost, paid_total, refund_total, due_date, created_at, customer:gold_customers(id, name, phone), store:gold_stores(name)";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function normalize<T extends RepairRow>(r: Record<string, unknown>): T {
  const row = r as unknown as T;
  return {
    ...row,
    estimated_cost: dbRupiah(row.estimated_cost),
    final_cost: row.final_cost === null ? null : dbRupiah(row.final_cost),
    paid_total: dbRupiah(row.paid_total),
    refund_total: dbRupiah(row.refund_total),
    customer: one(r.customer as RepairRow["customer"]),
    store: one(r.store as RepairRow["store"]),
  };
}

function payments(raw: unknown, required: string | null) {
  const errors: FieldErrors = {};
  const rows = validatePaymentRows(raw, errors, required);
  if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", Object.values(errors)[0], errors);
  return rows;
}

export const repairService = {
  async list(params: { q?: string; page?: number; status?: string }): Promise<ListResult<RepairRow>> {
    await requirePermission("repairs.manage");
    const supabase = await createSupabaseServerClient();
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase.from("gold_repairs").select(LIST_SELECT, { count: "exact" });
    const q = sanitizeSearch(params.q);
    if (q) query = query.or(`repair_number.ilike.%${q}%,item_description.ilike.%${q}%`);
    if (params.status === "ACTIVE") query = query.in("status", ["RECEIVED", "IN_PROGRESS", "READY"]);
    else if (params.status && ["RECEIVED", "IN_PROGRESS", "READY", "PICKED_UP", "CANCELLED"].includes(params.status)) query = query.eq("status", params.status);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) throw mapDbError(error);
    return { rows: ((data ?? []) as Record<string, unknown>[]).map((r) => normalize<RepairRow>(r)), total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async get(id: string): Promise<RepairDetail> {
    await requirePermission("repairs.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Servis tidak ditemukan.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("gold_repairs")
      .select(`${LIST_SELECT}, weight_in, notes, cancel_reason, ready_at, picked_up_at, payments:gold_payments(id, direction, method, amount, reference, paid_at)`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new AppError("NOT_FOUND", "Servis tidak ditemukan.");
    const r = normalize<RepairDetail>(data as unknown as Record<string, unknown>);
    return {
      ...r,
      weight_in: r.weight_in === null ? null : String(r.weight_in),
      payments: (r.payments ?? []).map((p) => ({ ...p, amount: dbRupiah(p.amount) })).sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
    };
  },

  async create(raw: Record<string, unknown>) {
    await requirePermission("repairs.manage");
    const parsed = validateRepair(raw, todayWib());
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", parsed.errors.customerId ?? "Periksa kembali isian Anda.", parsed.errors);
    const d = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_create_repair", {
      p_store_id: d.store_id,
      p_customer_id: d.customer_id,
      p_item_description: d.item_description,
      p_service_type: d.service_type,
      p_weight_in: d.weight_in,
      p_estimated_cost: d.estimated_cost,
      p_due_date: d.due_date,
      p_payments: d.payments,
      p_notes: d.notes,
    });
    if (error) throw mapDbError(error);
    return (Array.isArray(data) ? data[0] : data) as { repair_id: string; repair_number: string };
  },

  async setStatus(id: string, status: unknown, finalCost: unknown) {
    await requirePermission("repairs.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Servis tidak ditemukan.");
    const s = str(status);
    if (!["RECEIVED", "IN_PROGRESS", "READY"].includes(s)) throw new AppError("VALIDATION_ERROR", "Status tidak valid.");
    const errors: FieldErrors = {};
    const cost = str(finalCost) ? rupiahField(finalCost, errors, "finalCost", "Biaya akhir", true) : null;
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_update_repair_status", { p_repair_id: id, p_status: s, p_final_cost: cost, p_notes: null });
    if (error) throw mapDbError(error);
  },

  async pay(id: string, raw: unknown) {
    await requirePermission("repairs.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Servis tidak ditemukan.");
    const rows = payments(raw, "Isi nominal pembayaran");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_pay_repair", { p_repair_id: id, p_payments: rows });
    if (error) throw mapDbError(error);
  },

  async pickup(id: string, raw: { finalCost: unknown; payments: unknown; refunds: unknown }) {
    await requirePermission("repairs.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Servis tidak ditemukan.");
    const errors: FieldErrors = {};
    const cost = rupiahField(raw.finalCost, errors, "finalCost", "Biaya akhir", true);
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_pickup_repair", {
      p_repair_id: id,
      p_final_cost: cost,
      p_payments: payments(raw.payments, null),
      p_refunds: payments(raw.refunds, null),
    });
    if (error) {
      const e = mapDbError(error);
      if (e.code === "PAYMENT_MISMATCH") throw new AppError("VALIDATION_ERROR", "Total yang dibayar harus sama dengan biaya akhir servis.");
      throw e;
    }
  },

  async cancel(id: string, reason: unknown, refundRaw: unknown) {
    await requirePermission("repairs.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Servis tidak ditemukan.");
    const r = str(reason);
    if (!r || r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan wajib diisi.", { reason: "Wajib diisi" });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_cancel_repair", { p_repair_id: id, p_reason: r, p_refunds: payments(refundRaw, null) });
    if (error) throw mapDbError(error);
  },
};
