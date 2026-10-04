import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { dbRupiah, isUuid, sanitizeSearch, str } from "@/lib/validation/common";
import { validateTradeIn } from "@/lib/validation/trade-in";
import { getAppSession, requirePermission } from "@/server/auth/session";
import { cashService } from "@/server/services/cash.service";
import { mapDbError } from "@/server/db-errors";
import { providerFor } from "@/server/payments/provider";
import { PAGE_SIZE, type ListResult } from "@/server/repositories/crud";
import type { Receipt } from "@/server/repositories/sales.repository";

export type TradeInRow = {
  id: string;
  trade_in_number: string;
  status: "COMPLETED" | "VOIDED";
  trade_in_value: string;
  sale_total: string;
  balance: string;
  created_at: string;
  sale_id: string;
  buyback_id: string;
  public_token: string;
  void_reason: string | null;
  customer: { name: string } | null;
};

export type TradeInReceipt = {
  kind: "TRADE_IN";
  trade_in_number: string;
  status: string;
  created_at: string;
  trade_in_value: string;
  sale_total: string;
  balance: string;
  sale: Receipt;
  buyback: Receipt;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const SELECT = "id, trade_in_number, status, trade_in_value, sale_total, balance, created_at, sale_id, buyback_id, public_token, void_reason, customer:gold_customers(name)";

async function db<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapDbError(e);
  }
}

async function list(supabase: SupabaseClient, params: { q?: string; page?: number }): Promise<ListResult<TradeInRow>> {
  const page = params.page && params.page > 0 ? params.page : 1;
  let query = supabase.from("gold_trade_ins").select(SELECT, { count: "exact" });
  const q = sanitizeSearch(params.q);
  if (q) query = query.ilike("trade_in_number", `%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ ...(r as unknown as TradeInRow), customer: one(r.customer as TradeInRow["customer"]) }));
  return { rows, total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export const tradeInService = {
  async create(raw: Parameters<typeof validateTradeIn>[0]) {
    await requirePermission("trade_ins.manage");
    const parsed = validateTradeIn(raw);
    if (!parsed.valid) {
      const first = parsed.errors.customerId ?? parsed.errors.items ?? parsed.errors.sellItems ?? parsed.errors.payments;
      throw new AppError("VALIDATION_ERROR", first ?? "Periksa kembali isian Anda.", parsed.errors);
    }
    await cashService.requireOpen(parsed.data.store_id);
    const payments = await Promise.all(parsed.data.payments.map((p) => providerFor(p.method).prepare(p)));
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_create_trade_in", {
      p_store_id: parsed.data.store_id,
      p_customer_id: parsed.data.customer_id,
      p_buy_items: parsed.data.buy_items,
      p_sell_items: parsed.data.sell_items,
      p_payments: payments,
      p_expected_balance: parsed.data.expected_balance,
      p_notes: parsed.data.notes,
    });
    if (error) {
      if (error.message?.startsWith("PRICE_CHANGED")) {
        throw new AppError("PRICE_CHANGED", "Harga berubah. Periksa selisih terbaru lalu simpan ulang.", {
          expectedBalance: dbRupiah(error.message.split(":")[1]?.trim()),
        });
      }
      throw mapDbError(error);
    }
    const row = (Array.isArray(data) ? data[0] : data) as {
      trade_in_id: string;
      trade_in_number: string;
      sale_id: string;
      buyback_id: string;
      balance: string;
      change_amount: string;
      public_token: string;
    };
    return { ...row, balance: dbRupiah(row.balance), change_amount: dbRupiah(row.change_amount) };
  },

  async list(params: { q?: string; page?: number }) {
    const session = await getAppSession();
    if (!session) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    if (!session.permissions.includes("trade_ins.manage") && !session.permissions.includes("reports.view")) {
      throw new AppError("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini.");
    }
    const supabase = await createSupabaseServerClient();
    return db(() => list(supabase, params));
  },

  async get(id: string) {
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Tukar tambah tidak ditemukan.");
    if (!(await getAppSession())) throw new AppError("UNAUTHENTICATED", "Sesi berakhir. Silakan login kembali.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("gold_trade_ins").select(SELECT).eq("id", id).maybeSingle();
    if (error) throw mapDbError(error);
    if (!data) throw new AppError("NOT_FOUND", "Tukar tambah tidak ditemukan.");
    const r = data as unknown as Record<string, unknown>;
    return { ...(r as unknown as TradeInRow), customer: one(r.customer as TradeInRow["customer"]) };
  },

  async void(id: string, reason: unknown) {
    await requirePermission("sales.void");
    if (!isUuid(id)) throw new AppError("NOT_FOUND", "Tukar tambah tidak ditemukan.");
    const r = str(reason);
    if (!r || r.length > 500) throw new AppError("VALIDATION_ERROR", "Alasan wajib diisi (maks. 500 karakter).", { reason: "Wajib diisi" });
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("gold_void_trade_in", { p_trade_in_id: id, p_reason: r });
    if (error) throw mapDbError(error);
  },

  async receipt(token: string): Promise<TradeInReceipt | null> {
    if (!isUuid(token)) return null;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("gold_get_trade_in_receipt", { p_token: token });
    if (error) throw mapDbError(error);
    return (data as TradeInReceipt | null) ?? null;
  },
};
