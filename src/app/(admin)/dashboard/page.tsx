import type { Metadata } from "next";
import Link from "next/link";
import React from "react";
import RangeFilter from "@/components/gold/RangeFilter";
import DailyChart from "@/components/gold/charts/DailyChart";
import { resolveRange } from "@/lib/date-range";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { goldRateService } from "@/server/services/gold-rate.service";
import { storeService } from "@/server/services/inventory.service";
import { reportService } from "@/server/services/report.service";

export const metadata: Metadata = { title: "Dashboard | GoldPOS" };

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

type Search = { range?: string; from?: string; to?: string; store?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await requireAppSession();
  const can = (p: (typeof session.permissions)[number]) => session.permissions.includes(p);
  const range = resolveRange(sp);
  const isOwnerView = can("reports.view");

  const [stores, rates] = await loadPage(() => Promise.all([storeService.list(), goldRateService.current()]));
  const [summary, daily] = isOwnerView
    ? await loadPage(() => Promise.all([reportService.summary(range, sp.store), reportService.daily(range, sp.store)]))
    : [null, null];
  const ratesSet = rates.filter((r) => r.sell_price);

  const quick = [
    { href: "/sales/new", label: "Kasir (POS)", show: can("pos.use") },
    { href: "/buybacks/new", label: "Buyback", show: can("buybacks.manage") },
    { href: "/trade-ins/new", label: "Tukar Tambah", show: can("trade_ins.manage") },
    { href: "/inventory/new", label: "Tambah Stok", show: can("inventory.manage") },
    { href: "/inventory/stock-opname", label: "Stock Opname", show: can("stock_opname.manage") },
    { href: "/gold-rates", label: "Harga Emas", show: can("gold_rates.manage") },
  ].filter((q) => q.show);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium text-brand-500">{session.tenant.name}</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Halo, {session.fullName}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Anda masuk sebagai <span className="font-medium">{session.roleName}</span>.
        </p>
        {quick.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-500/10 dark:text-brand-400">
                {q.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {summary && daily && (
        <>
          <RangeFilter range={range} stores={stores} store={sp.store} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label={`Penjualan (${range.label})`} value={formatRupiah(summary.sales_total)} hint={`${summary.sales_count} transaksi`} />
            <Metric label={`Buyback (${range.label})`} value={formatRupiah(summary.buyback_total)} hint={`${summary.buyback_count} transaksi`} />
            <Metric label={`Pembelian (${range.label})`} value={formatRupiah(summary.purchase_total)} hint={`${summary.purchase_count} pembelian`} />
            <Metric label="Estimasi Laba Kotor" value={formatRupiah(summary.gross_profit)} hint="Penjualan − HPP" />
            <Metric label="Emas Terjual" value={formatGram(summary.sales_gold_weight)} />
            <Metric label="Emas Buyback" value={formatGram(summary.buyback_gold_weight)} />
            <Metric label="Total Berat Stok" value={formatGram(summary.inventory_gold_weight)} hint={`${summary.inventory_count} keping`} />
            <Metric label="Nilai Inventory" value={formatRupiah(summary.inventory_market_value)} hint={`Modal ${formatRupiah(summary.inventory_cost_value)}`} />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Penjualan, Buyback & Pembelian</h2>
              <Link href="/reports" className="text-sm font-medium text-brand-500 hover:underline">Laporan lengkap</Link>
            </div>
            <DailyChart rows={daily} />
          </div>
        </>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Harga Emas Hari Ini</h2>
          <Link href="/gold-rates" className="text-sm font-medium text-brand-500 hover:underline">{can("gold_rates.manage") ? "Kelola" : "Lihat"}</Link>
        </div>
        {ratesSet.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Harga emas belum diatur.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ratesSet.map((r) => (
              <div key={r.purity_id} className="rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{r.code}</p>
                <p className="mt-1 text-xs text-gray-500">Jual {formatRupiah(r.sell_price)} · Beli {formatRupiah(r.buy_price)}</p>
                <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(r.effective_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Outlet</h2>
        {stores.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Anda belum memiliki akses ke outlet mana pun.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {stores.map((store) => (
              <li key={store.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{store.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{store.code}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${store.is_active ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"}`}>
                  {store.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
