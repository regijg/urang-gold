import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { dbRupiah, isUuid, requiredText, str, type FieldErrors } from "@/lib/validation/common";
import { rupiahField } from "@/lib/validation/operations";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { PAGE_SIZE, type ListResult } from "@/server/repositories/crud";

export type CashSessionRow = {
  id: string;
  store_id: string;
  session_number: string;
  status: "OPEN" | "CLOSED";
  opening_amount: string;
  opened_at: string;
  expected_amount: string | null;
  counted_amount: string | null;
  difference: string | null;
  closed_at: string | null;
  notes: string | null;
  close_notes: string | null;
  store: { name: string } | null;
};

export type CashMovement = { id: string; direction: "IN" | "OUT"; amount: string; reason: string; created_at: string };

export type CashTotals = {
  opening: string;
  sources: Record<string, { in: string; out: string }>;
  payments_net: string;
  movements_in: string;
  movements_out: string;
  expected: string;
  counted?: string;
  difference?: string;
};

const SELECT =
  "id, store_id, session_number, status, opening_amount, opened_at, expected_amount, counted_amount, difference, closed_at, notes, close_notes, store:gold_stores(name)";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function normalize(r: Record<string, unknown>): CashSessionRow {
  const row = r as unknown as CashSessionRow;
  return {
    ...row,
    opening_amount: dbRupiah(row.opening_amount),
    expected_amount: row.expected_amount === null ? null : dbRupiah(row.expected_amount),
    counted_amount: row.counted_amount === null ? null : dbRupiah(row.counted_amount),
    difference: row.difference === null ? null : dbRupiah(row.difference),
    store: one(r.store as CashSessionRow["store"]),
  };
}

function normalizeTotals(t: Record<string, unknown>): CashTotals {
  const sources: CashTotals["sources"] = {};
  for (const [k, v] of Object.entries((t.sources ?? {}) as Record<string, { in: unknown; out: unknown }>)) {
    sources[k] = { in: dbRupiah(v.in as string), out: dbRupiah(v.out as string) };
  }
  const m = (k: string) => dbRupiah(t[k] as string);
  return {
    opening: m("opening"),
    sources,
    payments_net: m("payments_net"),
    movements_in: m("movements_in"),
    movements_out: m("movements_out"),
    expected: m("expected"),
    ...(t.counted !== undefined ? { counted: m("counted"), difference: m("difference") } : {}),
  };
}

export const cashService = {
  /** Open drawers of the stores the user can access (RLS) */
  async openSessions(): Promise<CashSessionRow[]> {
    await requirePermission("cash.manage");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("gold_cash_sessions").select(SELECT).eq("status", "OPEN").order("opened_at");
    if (error) throw mapDbError(error);
    return ((data ?? []) as Record<string, unknown>[]).map(normalize);
  },

  async list(page = 1): Promise<ListResult<CashSessionRow>> {
    await requirePermission("cash.manage");
    const supabase = await createSupabaseServerClient();
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await supabase
      .from("gold_cash_sessions")
      .select(SELECT, { count: "exact" })
      .order("opened_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw mapDbError(error);
    return { rows: ((data ?? []) as Record<string, unknown>[]).map(normalize), total: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async get(id: string): Promise<{ session: CashSessionRow; movements: CashMovement[]; totals: CashTotals }> {
    await requirePermission("cash.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Kas tidak ditemukan.");
    const supabase = await createSupabaseServerClient();
    const [s, m, t] = await Promise.all([
      supabase.from("gold_cash_sessions").select(SELECT).eq("id", id).maybeSingle(),
      supabase.from("gold_cash_movements").select("id, direction, amount, reason, created_at").eq("session_id", id).order("created_at"),
      supabase.rpc("gold_cash_session_summary", { p_session_id: id }),
    ]);
    if (s.error) throw mapDbError(s.error);
    if (!s.data) throw new AppError("NOT_FOUND", "Kas tidak ditemukan.");
    if (m.error) throw mapDbError(m.error);
    if (t.error) throw mapDbError(t.error);
    return {
      session: normalize(s.data as Record<string, unknown>),
      movements: ((m.data ?? []) as CashMovement[]).map((x) => ({ ...x, amount: dbRupiah(x.amount) })),
      totals: normalizeTotals(t.data as Record<string, unknown>),
    };
  },

  async open(raw: { storeId: unknown; openingAmount: unknown; notes: unknown }) {
    await requirePermission("cash.manage");
    const errors: FieldErrors = {};
    const storeId = str(raw.storeId);
    if (!isUuid(storeId)) errors.storeId = "Pilih outlet";
    const amount = rupiahField(raw.openingAmount, errors, "openingAmount", "Modal awal", true);
    const notes = str(raw.notes).slice(0, 1000) || null;
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_open_cash_session", { p_store_id: storeId, p_opening_amount: amount, p_notes: notes });
    if (error) throw mapDbError(error);
    return data as string;
  },

  async addMovement(id: string, raw: { direction: unknown; amount: unknown; reason: unknown }) {
    await requirePermission("cash.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Kas tidak ditemukan.");
    const errors: FieldErrors = {};
    const direction = str(raw.direction);
    if (direction !== "IN" && direction !== "OUT") errors.direction = "Pilih uang masuk atau keluar";
    const amount = rupiahField(raw.amount, errors, "amount", "Nominal");
    const reason = requiredText(raw.reason, 1, 300, "Keterangan", errors, "reason");
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_add_cash_movement", { p_session_id: id, p_direction: direction, p_amount: amount, p_reason: reason });
    if (error) throw mapDbError(error);
  },

  async close(id: string, raw: { countedAmount: unknown; notes: unknown }) {
    await requirePermission("cash.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Kas tidak ditemukan.");
    const errors: FieldErrors = {};
    const counted = rupiahField(raw.countedAmount, errors, "countedAmount", "Uang di laci", true);
    if (str(raw.countedAmount) === "") errors.countedAmount = "Hitung dan isi uang di laci";
    const notes = str(raw.notes).slice(0, 1000) || null;
    if (Object.keys(errors).length) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", errors);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_close_cash_session", { p_session_id: id, p_counted_amount: counted, p_notes: notes });
    if (error) {
      const e = mapDbError(error);
      if (e.code === "NOTES_REQUIRED") throw new AppError("VALIDATION_ERROR", "Uang di laci tidak sama dengan catatan sistem. Tulis keterangan selisihnya.", { notes: "Wajib diisi jika ada selisih" });
      throw e;
    }
    return normalizeTotals(data as Record<string, unknown>);
  },
};
