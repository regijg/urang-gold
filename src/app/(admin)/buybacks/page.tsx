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
import { buybackService } from "@/server/services/buyback.service";
import { storeService } from "@/server/services/inventory.service";
import type { BuybackListRow } from "@/server/repositories/buyback.repository";

export const metadata: Metadata = { title: "Buyback | UrangGold" };

type Search = { q?: string; page?: string; store?: string; status?: string };

export default async function BuybacksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const session = await requireAppSession();
  const [data, stores] = await loadPage(() =>
    Promise.all([buybackService.list({ q: sp.q, page: parsePage(sp.page), storeId: sp.store, status: sp.status }), storeService.list()])
  );
  return (
    <>
      <PageHeader
        title="Buyback"
        description="Pembelian emas dari customer."
        action={session.permissions.includes("buybacks.manage") ? { href: "/buybacks/new", label: "Buyback Baru" } : null}
      />
      <ListToolbar
        q={sp.q}
        placeholder="Cari nomor buyback"
        filters={[
          { name: "store", value: sp.store, allLabel: "Semua outlet", options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { name: "status", value: sp.status, allLabel: "Semua status", options: [{ value: "COMPLETED", label: "Selesai" }, { value: "VOIDED", label: "Dibatalkan" }] },
        ]}
      />
      <DataTable<BuybackListRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Belum ada buyback."
        columns={[
          { header: "Nomor", cell: (r) => <Link href={`/buybacks/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.buyback_number}</Link> },
          { header: "Waktu", cell: (r) => formatDateTime(r.bought_at) },
          { header: "Outlet", cell: (r) => r.store?.name ?? "-" },
          { header: "Customer", cell: (r) => r.customer?.name ?? "-" },
          { header: "Total", cell: (r) => formatRupiah(r.total), className: "text-right whitespace-nowrap" },
          { header: "Status", cell: (r) => (r.status === "VOIDED" ? "Dibatalkan" : "Selesai") },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/buybacks" params={{ q: sp.q, store: sp.store, status: sp.status }} />
    </>
  );
}
