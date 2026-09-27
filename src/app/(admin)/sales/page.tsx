import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { storeService } from "@/server/services/inventory.service";
import { salesService } from "@/server/services/sales.service";
import type { SaleListRow } from "@/server/repositories/sales.repository";

export const metadata: Metadata = { title: "Penjualan | GoldPOS" };

type Search = { q?: string; page?: string; store?: string; status?: string };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await requireAppSession();
  const [data, stores] = await loadPage(() =>
    Promise.all([salesService.list({ q: sp.q, page: parsePage(sp.page), storeId: sp.store, status: sp.status }), storeService.list()])
  );

  return (
    <>
      <PageHeader
        title="Penjualan"
        description="Riwayat transaksi penjualan."
        action={session.permissions.includes("pos.use") ? { href: "/sales/new", label: "Buka Kasir" } : null}
      />
      <ListToolbar
        q={sp.q}
        placeholder="Cari nomor invoice"
        filters={[
          { name: "store", value: sp.store, allLabel: "Semua outlet", options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { name: "status", value: sp.status, allLabel: "Semua status", options: [{ value: "COMPLETED", label: "Selesai" }, { value: "VOIDED", label: "Dibatalkan" }] },
        ]}
      />
      <DataTable<SaleListRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Belum ada penjualan."
        columns={[
          { header: "Invoice", cell: (r) => <Link href={`/sales/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.invoice_number}</Link> },
          { header: "Waktu", cell: (r) => formatDateTime(r.sold_at) },
          { header: "Outlet", cell: (r) => r.store?.name ?? "-" },
          { header: "Customer", cell: (r) => r.customer?.name ?? "-" },
          { header: "Total", cell: (r) => formatRupiah(r.total), className: "text-right whitespace-nowrap" },
          {
            header: "Status",
            cell: (r) =>
              r.status === "VOIDED" ? (
                <span className="rounded-full bg-error-50 px-2.5 py-0.5 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-500">Dibatalkan</span>
              ) : (
                <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-600 dark:bg-success-500/15 dark:text-success-500">Selesai</span>
              ),
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/sales" params={{ q: sp.q, store: sp.store, status: sp.status }} />
    </>
  );
}
