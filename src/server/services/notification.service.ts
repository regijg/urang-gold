import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppSession } from "@/server/auth/session";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  href: string;
  tone: "info" | "warning";
};

const todayWib = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
const dateWib = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso));

/**
 * Actionable reminders computed from live data (RLS applies), shown only to
 * people who can act on them. Failures of one check never break the header.
 */
export async function listNotifications(): Promise<AppNotification[]> {
  const session = await getAppSession();
  if (!session) return [];
  const can = (p: (typeof session.permissions)[number]) => session.permissions.includes(p);
  const supabase = await createSupabaseServerClient();
  const out: AppNotification[] = [];

  const checks: Promise<void>[] = [];

  if (can("gold_rates.manage")) {
    checks.push(
      (async () => {
        const [{ data: purities }, { data: rates }] = await Promise.all([
          supabase.from("gold_purities").select("id").eq("is_active", true),
          supabase.from("gold_v_current_gold_rates").select("purity_id, effective_at"),
        ]);
        const rated = new Map((rates ?? []).map((r) => [r.purity_id as string, r.effective_at as string]));
        const missing = (purities ?? []).filter((p) => !rated.has(p.id as string)).length;
        const latest = [...rated.values()].sort().at(-1);
        if (!latest) {
          out.push({ id: "rates-none", title: "Harga emas belum diatur", message: "Kasir belum bisa menghitung harga barang.", href: "/gold-rates", tone: "warning" });
        } else if (dateWib(latest) !== todayWib()) {
          out.push({ id: "rates-stale", title: "Harga emas belum diperbarui hari ini", message: `Terakhir diubah ${dateWib(latest)}.`, href: "/gold-rates", tone: "warning" });
        }
        if (latest && missing > 0) {
          out.push({ id: "rates-missing", title: `${missing} kadar belum punya harga`, message: "Barang dengan kadar ini tidak bisa dijual.", href: "/gold-rates", tone: "info" });
        }
      })()
    );
  }

  if (can("stock_opname.approve")) {
    checks.push(
      (async () => {
        const { count } = await supabase.from("gold_stock_opnames").select("id", { count: "exact", head: true }).eq("status", "SUBMITTED");
        if (count) {
          out.push({ id: "opname", title: `${count} stock opname menunggu persetujuan`, message: "Periksa selisih lalu setujui atau hitung ulang.", href: "/inventory/stock-opname", tone: "warning" });
        }
      })()
    );
  }

  if (can("purchases.manage")) {
    checks.push(
      (async () => {
        const { count } = await supabase
          .from("gold_purchase_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "RECEIVED")
          .in("payment_status", ["UNPAID", "PARTIAL"]);
        if (count) {
          out.push({ id: "payables", title: `${count} pembelian belum lunas`, message: "Ada hutang ke supplier yang belum dibayar.", href: "/purchases?status=UNPAID", tone: "info" });
        }
      })()
    );
  }

  await Promise.allSettled(checks);
  // warnings first
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "warning" ? -1 : 1));
}
