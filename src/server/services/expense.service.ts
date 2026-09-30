import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { todayWib } from "@/lib/date-range";
import { dbRupiah, isUuid, str } from "@/lib/validation/common";
import { EXPENSE_CATEGORIES, validateExpense, type ExpenseCategory } from "@/lib/validation/operations";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";
import { PAGE_SIZE, type ListResult } from "@/server/repositories/crud";

export type ExpenseRow = {
  id: string;
  expense_number: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  status: "ACTIVE" | "VOIDED";
  void_reason: string | null;
  store: { name: string } | null;
  payment: { method: string } | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export const expenseService = {
  async list(params: { page?: number; category?: string; from?: string; to?: string }): Promise<ListResult<ExpenseRow> & { sum: string }> {
    await requirePermission("expenses.manage");
    const supabase = await createSupabaseServerClient();
    const page = params.page && params.page > 0 ? params.page : 1;
    let query = supabase
      .from("gold_expenses")
      .select("id, expense_number, expense_date, category, description, amount, status, void_reason, store:gold_stores(name), payments:gold_payments(method, is_reversal)", { count: "exact" });
    let sumQuery = supabase.from("gold_expenses").select("amount").eq("status", "ACTIVE");
    if (params.category && (EXPENSE_CATEGORIES as readonly string[]).includes(params.category)) {
      query = query.eq("category", params.category);
      sumQuery = sumQuery.eq("category", params.category);
    }
    if (params.from) {
      query = query.gte("expense_date", params.from);
      sumQuery = sumQuery.gte("expense_date", params.from);
    }
    if (params.to) {
      query = query.lte("expense_date", params.to);
      sumQuery = sumQuery.lte("expense_date", params.to);
    }
    const from = (page - 1) * PAGE_SIZE;
    const [{ data, error, count }, sums] = await Promise.all([
      query.order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
      sumQuery.limit(5000),
    ]);
    if (error) throw mapDbError(error);
    if (sums.error) throw mapDbError(sums.error);
    const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const pays = (r.payments ?? []) as { method: string; is_reversal: boolean }[];
      return {
        ...(r as unknown as ExpenseRow),
        amount: dbRupiah(r.amount as string),
        store: one(r.store as ExpenseRow["store"]),
        payment: pays.find((p) => !p.is_reversal) ?? null,
      };
    });
    const sum = ((sums.data ?? []) as { amount: string }[]).reduce((a, r) => a + BigInt(dbRupiah(r.amount)), BigInt(0)).toString();
    return { rows, total: count ?? 0, page, pageSize: PAGE_SIZE, sum };
  },

  async create(raw: Record<string, unknown>) {
    await requirePermission("expenses.manage");
    const parsed = validateExpense(raw, todayWib());
    if (!parsed.valid) throw new AppError("VALIDATION_ERROR", "Periksa kembali isian Anda.", parsed.errors);
    const d = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_create_expense", {
      p_store_id: d.store_id,
      p_expense_date: d.expense_date,
      p_category: d.category,
      p_description: d.description,
      p_amount: d.amount,
      p_method: d.method,
      p_reference: d.reference,
    });
    if (error) throw mapDbError(error);
  },

  async void(id: string, reason: unknown) {
    await requirePermission("expenses.manage");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Biaya tidak ditemukan.");
    const r = str(reason);
    if (!r || r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan wajib diisi.", { reason: "Wajib diisi" });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_void_expense", { p_expense_id: id, p_reason: r });
    if (error) throw mapDbError(error);
  },
};
