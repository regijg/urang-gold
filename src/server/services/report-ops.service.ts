import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date-range";
import { dbRupiah, isUuid } from "@/lib/validation/common";
import { EXPENSE_LABELS, type ExpenseCategory } from "@/lib/validation/operations";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";

/**
 * Detail reports for the operations modules (biaya, kas harian, pesanan, servis, tukar tambah).
 * Plain table reads through RLS (all of these policies allow reports.view), flattened into typed
 * rows that the report page and the CSV export both use. At most LIMIT rows per report.
 */
export const REPORT_ROW_LIMIT = 5000;

type Raw = Record<string, unknown>;
const one = (v: unknown): Raw | null => (Array.isArray(v) ? ((v[0] as Raw) ?? null) : ((v as Raw | null) ?? null));
const name = (v: unknown) => (one(v)?.name as string | undefined) ?? "";
const money = (v: unknown) => dbRupiah(v as string);
const moneyOrNull = (v: unknown) => (v === null || v === undefined ? null : dbRupiah(v as string));
const store = (id?: string) => (isUuid(id) ? id : null);

export type ExpenseReportRow = {
  number: string;
  date: string;
  category: string;
  description: string;
  amount: string;
  method: string;
  status: "ACTIVE" | "VOIDED";
  void_reason: string;
  store: string;
};

export type CashReportRow = {
  id: string;
  number: string;
  store: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  status: "OPEN" | "CLOSED";
  opening: string;
  expected: string | null;
  counted: string | null;
  difference: string | null;
  notes: string;
};

export type OrderReportRow = {
  id: string;
  number: string;
  created_at: string;
  customer: string;
  store: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  total: string;
  paid: string;
  refund: string;
  /** still to be paid while the order is open */
  outstanding: string;
  /** deposit kept by the shop when an order is cancelled (paid - refunded) */
  forfeited: string;
  due_date: string;
  cancelled_at: string | null;
  cancel_reason: string;
};

export type RepairReportRow = {
  id: string;
  number: string;
  created_at: string;
  customer: string;
  store: string;
  item: string;
  service: string;
  status: "RECEIVED" | "IN_PROGRESS" | "READY" | "PICKED_UP" | "CANCELLED";
  estimated: string;
  final: string | null;
  paid: string;
  refund: string;
  due_date: string;
  picked_up_at: string | null;
  cancel_reason: string;
};

export type TradeInReportRow = {
  id: string;
  number: string;
  created_at: string;
  customer: string;
  store: string;
  trade_in_value: string;
  sale_total: string;
  balance: string;
  status: "COMPLETED" | "VOIDED";
  void_reason: string;
};

async function run(query: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<Raw[]> {
  const { data, error } = await query;
  if (error) throw mapDbError(error);
  return (data ?? []) as Raw[];
}

export const reportOpsService = {
  /** Expenses by their own date (expense_date), including voided ones so the list matches the Biaya Operasional page. */
  async expenses(range: DateRange, storeId?: string): Promise<ExpenseReportRow[]> {
    await requirePermission("reports.view");
    const supabase = await createSupabaseServerClient();
    let q = supabase
      .from("gold_expenses")
      .select("expense_number, expense_date, category, description, amount, status, void_reason, store:gold_stores(name), payments:gold_payments(method, is_reversal)")
      .gte("expense_date", range.fromDate)
      .lte("expense_date", range.toDate)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(REPORT_ROW_LIMIT);
    const s = store(storeId);
    if (s) q = q.eq("store_id", s);
    return (await run(q)).map((r) => {
      const payments = (r.payments as { method: string; is_reversal: boolean }[] | null) ?? [];
      return {
        number: r.expense_number as string,
        date: r.expense_date as string,
        category: EXPENSE_LABELS[r.category as ExpenseCategory] ?? (r.category as string),
        description: r.description as string,
        amount: money(r.amount),
        method: payments.find((p) => !p.is_reversal)?.method ?? "",
        status: r.status as ExpenseReportRow["status"],
        void_reason: (r.void_reason as string | null) ?? "",
        store: name(r.store),
      };
    });
  },

  /** Cash drawer sessions opened in the period, with the counted difference. */
  async cash(range: DateRange, storeId?: string): Promise<CashReportRow[]> {
    await requirePermission("reports.view");
    const supabase = await createSupabaseServerClient();
    let q = supabase
      .from("gold_cash_sessions")
      .select("id, session_number, status, opening_amount, opened_by, opened_at, expected_amount, counted_amount, difference, closed_at, notes, close_notes, store:gold_stores(name)")
      .gte("opened_at", range.fromIso)
      .lt("opened_at", range.toIso)
      .order("opened_at", { ascending: false })
      .limit(REPORT_ROW_LIMIT);
    const s = store(storeId);
    if (s) q = q.eq("store_id", s);
    const rows = await run(q);

    // opened_by points at auth.users, so names are looked up separately; blank when the user list is not readable
    const ids = [...new Set(rows.map((r) => r.opened_by as string | null).filter((v): v is string => !!v))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data } = await supabase.from("gold_users").select("id, full_name").in("id", ids);
      for (const u of (data ?? []) as { id: string; full_name: string }[]) names.set(u.id, u.full_name);
    }

    return rows.map((r) => ({
      id: r.id as string,
      number: r.session_number as string,
      store: name(r.store),
      opened_at: r.opened_at as string,
      closed_at: (r.closed_at as string | null) ?? null,
      opened_by: names.get(r.opened_by as string) ?? "",
      status: r.status as CashReportRow["status"],
      opening: money(r.opening_amount),
      expected: moneyOrNull(r.expected_amount),
      counted: moneyOrNull(r.counted_amount),
      difference: moneyOrNull(r.difference),
      notes: [r.notes, r.close_notes].filter(Boolean).join(" | "),
    }));
  },

  /** Orders created in the period, plus orders cancelled in it (their forfeited deposit counts in net profit). */
  async orders(range: DateRange, storeId?: string): Promise<OrderReportRow[]> {
    await requirePermission("reports.view");
    const supabase = await createSupabaseServerClient();
    const f = range.fromIso;
    const t = range.toIso;
    let q = supabase
      .from("gold_orders")
      .select("id, order_number, status, total, paid_total, refund_total, due_date, created_at, cancelled_at, cancel_reason, customer:gold_customers(name), store:gold_stores(name)")
      .or(`and(created_at.gte.${f},created_at.lt.${t}),and(cancelled_at.gte.${f},cancelled_at.lt.${t})`)
      .order("created_at", { ascending: false })
      .limit(REPORT_ROW_LIMIT);
    const s = store(storeId);
    if (s) q = q.eq("store_id", s);
    return (await run(q)).map((r) => {
      const status = r.status as OrderReportRow["status"];
      const total = BigInt(money(r.total));
      const paid = BigInt(money(r.paid_total));
      const refund = BigInt(money(r.refund_total));
      return {
        id: r.id as string,
        number: r.order_number as string,
        created_at: r.created_at as string,
        customer: name(r.customer),
        store: name(r.store),
        status,
        total: total.toString(),
        paid: paid.toString(),
        refund: refund.toString(),
        outstanding: status === "OPEN" ? (total - paid).toString() : "0",
        forfeited: status === "CANCELLED" ? (paid - refund).toString() : "0",
        due_date: (r.due_date as string | null) ?? "",
        cancelled_at: (r.cancelled_at as string | null) ?? null,
        cancel_reason: (r.cancel_reason as string | null) ?? "",
      };
    });
  },

  /** Repairs received in the period, plus repairs picked up in it (their final cost is income in net profit). */
  async repairs(range: DateRange, storeId?: string): Promise<RepairReportRow[]> {
    await requirePermission("reports.view");
    const supabase = await createSupabaseServerClient();
    const f = range.fromIso;
    const t = range.toIso;
    let q = supabase
      .from("gold_repairs")
      .select("id, repair_number, status, item_description, service_type, estimated_cost, final_cost, paid_total, refund_total, due_date, created_at, picked_up_at, cancel_reason, customer:gold_customers(name), store:gold_stores(name)")
      .or(`and(created_at.gte.${f},created_at.lt.${t}),and(picked_up_at.gte.${f},picked_up_at.lt.${t})`)
      .order("created_at", { ascending: false })
      .limit(REPORT_ROW_LIMIT);
    const s = store(storeId);
    if (s) q = q.eq("store_id", s);
    return (await run(q)).map((r) => ({
      id: r.id as string,
      number: r.repair_number as string,
      created_at: r.created_at as string,
      customer: name(r.customer),
      store: name(r.store),
      item: r.item_description as string,
      service: r.service_type as string,
      status: r.status as RepairReportRow["status"],
      estimated: money(r.estimated_cost),
      final: moneyOrNull(r.final_cost),
      paid: money(r.paid_total),
      refund: money(r.refund_total),
      due_date: (r.due_date as string | null) ?? "",
      picked_up_at: (r.picked_up_at as string | null) ?? null,
      cancel_reason: (r.cancel_reason as string | null) ?? "",
    }));
  },

  async tradeIns(range: DateRange, storeId?: string): Promise<TradeInReportRow[]> {
    await requirePermission("reports.view");
    const supabase = await createSupabaseServerClient();
    let q = supabase
      .from("gold_trade_ins")
      .select("id, trade_in_number, created_at, trade_in_value, sale_total, balance, status, void_reason, customer:gold_customers(name), store:gold_stores(name)")
      .gte("created_at", range.fromIso)
      .lt("created_at", range.toIso)
      .order("created_at", { ascending: false })
      .limit(REPORT_ROW_LIMIT);
    const s = store(storeId);
    if (s) q = q.eq("store_id", s);
    return (await run(q)).map((r) => ({
      id: r.id as string,
      number: r.trade_in_number as string,
      created_at: r.created_at as string,
      customer: name(r.customer),
      store: name(r.store),
      trade_in_value: money(r.trade_in_value),
      sale_total: money(r.sale_total),
      // negative when the shop pays the customer
      balance: money(r.balance),
      status: r.status as TradeInReportRow["status"],
      void_reason: (r.void_reason as string | null) ?? "",
    }));
  },
};
