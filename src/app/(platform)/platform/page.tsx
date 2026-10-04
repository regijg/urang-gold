import type { Metadata } from "next";
import PageHeader from "@/components/gold/PageHeader";
import TenantTable from "@/components/platform/TenantTable";
import { formatRupiah } from "@/lib/format";
import { loadPage } from "@/server/page-guard";
import { platformService } from "@/server/services/platform.service";

export const metadata: Metadata = { title: "Platform | UrangGold" };
export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const sp = await searchParams;
  const { tenants, statsAvailable } = await loadPage(() => platformService.list());

  const active = tenants.filter((t) => t.status === "ACTIVE");
  const monthTotal = tenants.reduce((sum, t) => sum + Number(t.sales_month), 0);
  const todayTotal = tenants.reduce((sum, t) => sum + Number(t.sales_today), 0);

  return (
    <>
      <PageHeader title="Toko Pelanggan" description="Semua toko yang memakai UrangGold. Hanya Anda yang bisa membuat toko baru." action={{ href: "/platform/tenants/new", label: "+ Toko Baru" }} />

      {sp.created && (
        <p className="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
          Toko berhasil dibuat. Berikan email dan password owner ke pelanggan.
        </p>
      )}
      {!statsAvailable && (
        <p className="mb-4 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
          Angka omzet dan jumlah pengguna belum tersedia. Jalankan migration <code>20261005000016_gold_platform_console.sql</code> di Supabase.
        </p>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total toko" value={String(tenants.length)} hint={`${active.length} aktif`} />
        <Stat label="Ditangguhkan / ditutup" value={String(tenants.length - active.length)} />
        <Stat label="Omzet hari ini (semua toko)" value={formatRupiah(todayTotal)} />
        <Stat label="Omzet bulan ini (semua toko)" value={formatRupiah(monthTotal)} />
      </div>

      <TenantTable tenants={tenants} />
    </>
  );
}
