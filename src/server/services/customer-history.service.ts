import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/action-result";
import { dbRupiah, isUuid } from "@/lib/validation/common";
import { requirePermission } from "@/server/auth/session";
import { mapDbError } from "@/server/db-errors";

export type CustomerTx = { id: string; kind: "SALE" | "BUYBACK" | "TRADE_IN"; number: string; at: string; total: string; status: string; href: string };

/** Sales, buybacks and trade-ins of one customer (RLS limits what the caller can see). */
export async function customerHistory(customerId: string): Promise<{ rows: CustomerTx[]; salesTotal: string; buybackTotal: string }> {
  await requirePermission("customers.manage");
  if (!isUuid(customerId)) throw new AppError("NOT_FOUND", "Customer tidak ditemukan.");
  const supabase = await createSupabaseServerClient();
  const [s, b, t] = await Promise.all([
    supabase.from("gold_sales").select("id, invoice_number, sold_at, total, status").eq("customer_id", customerId).order("sold_at", { ascending: false }).limit(200),
    supabase.from("gold_buybacks").select("id, buyback_number, bought_at, total, status").eq("customer_id", customerId).order("bought_at", { ascending: false }).limit(200),
    supabase.from("gold_trade_ins").select("id, trade_in_number, created_at, balance, status").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(200),
  ]);
  for (const r of [s, b, t]) if (r.error) throw mapDbError(r.error);

  const rows: CustomerTx[] = [
    ...(s.data ?? []).map((x) => ({ id: x.id, kind: "SALE" as const, number: x.invoice_number, at: x.sold_at, total: dbRupiah(x.total), status: x.status, href: `/sales/${x.id}` })),
    ...(b.data ?? []).map((x) => ({ id: x.id, kind: "BUYBACK" as const, number: x.buyback_number, at: x.bought_at, total: dbRupiah(x.total), status: x.status, href: `/buybacks/${x.id}` })),
    ...(t.data ?? []).map((x) => ({ id: x.id, kind: "TRADE_IN" as const, number: x.trade_in_number, at: x.created_at, total: dbRupiah(x.balance), status: x.status, href: `/trade-ins/${x.id}` })),
  ].sort((a, c) => (a.at < c.at ? 1 : -1));

  const sum = (kind: CustomerTx["kind"]) =>
    rows.filter((r) => r.kind === kind && r.status === "COMPLETED").reduce((acc, r) => acc + BigInt(r.total), BigInt(0)).toString();
  return { rows, salesTotal: sum("SALE"), buybackTotal: sum("BUYBACK") };
}
