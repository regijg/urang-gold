import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { OpenCashForm } from "@/components/gold/cash/CashForms";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { cashService, type CashSessionRow } from "@/server/services/cash.service";
import { storeService } from "@/server/services/inventory.service";
import { openCashAction } from "./actions";

export const metadata: Metadata = { title: "Kas Harian | UrangGold" };

export default async function CashPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  await requirePagePermission("cash.manage");
  const [stores, open, history] = await loadPage(() =>
    Promise.all([storeService.list({ activeOnly: true }), cashService.openSessions(), cashService.list(parsePage(sp.page))])
  );
  const openDetails = await loadPage(() => Promise.all(open.map((s) => cashService.get(s.id))));
  const closedStores = stores.filter((s) => !open.some((o) => o.store_id === s.id));

  return (
    <>
      <PageHeader title="Kas Harian" description="Buka kas saat toko buka, tutup dan hitung uang di laci saat toko tutup." />

      {openDetails.length > 0 && (
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {openDetails.map(({ session, totals }) => (
            <Link
              key={session.id}
              href={`/cash/${session.id}`}
              className="rounded-2xl border border-success-200 bg-white p-5 text-gray-800 transition hover:border-success-400 dark:border-success-500/30 dark:bg-gray-900 dark:text-white/90"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-success-600">Kas terbuka · {session.store?.name}</p>
                  <p className="font-mono text-sm text-gray-500">{session.session_number}</p>
                </div>
                <span className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white">Kelola / Tutup</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">Seharusnya ada di laci</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatRupiah(totals.expected)}</p>
              <p className="mt-1 text-xs text-gray-500">Dibuka {formatDateTime(session.opened_at)} · modal {formatRupiah(session.opening_amount)}</p>
            </Link>
          ))}
        </div>
      )}

      {closedStores.length > 0 && (
        <div className="mb-6">
          <OpenCashForm action={openCashAction} stores={closedStores.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
      )}

      <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">Riwayat kas</h2>
      <DataTable<CashSessionRow>
        rows={history.rows}
        rowKey={(r) => r.id}
        empty="Belum ada riwayat kas."
        columns={[
          { header: "Nomor", cell: (r) => <Link href={`/cash/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.session_number}</Link> },
          { header: "Outlet", cell: (r) => r.store?.name ?? "-" },
          { header: "Buka", cell: (r) => formatDateTime(r.opened_at) },
          { header: "Tutup", cell: (r) => (r.closed_at ? formatDateTime(r.closed_at) : <span className="text-success-600">Masih terbuka</span>) },
          { header: "Seharusnya", cell: (r) => (r.expected_amount ? formatRupiah(r.expected_amount) : "-"), className: "text-right whitespace-nowrap" },
          { header: "Dihitung", cell: (r) => (r.counted_amount ? formatRupiah(r.counted_amount) : "-"), className: "text-right whitespace-nowrap" },
          {
            header: "Selisih",
            cell: (r) =>
              r.difference === null ? "-" : r.difference === "0" ? <span className="text-success-600">Cocok</span> : <span className="font-medium text-warning-600">{r.difference.startsWith("-") ? `-${formatRupiah(r.difference.slice(1))}` : `+${formatRupiah(r.difference)}`}</span>,
            className: "text-right whitespace-nowrap",
          },
        ]}
      />
      <Pagination page={history.page} pageSize={history.pageSize} total={history.total} basePath="/cash" params={{}} />
    </>
  );
}
