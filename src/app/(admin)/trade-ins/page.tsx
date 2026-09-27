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
import { tradeInService, type TradeInRow } from "@/server/services/trade-in.service";

export const metadata: Metadata = { title: "Tukar Tambah | GoldPOS" };

export default async function TradeInsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const session = await requireAppSession();
  const data = await loadPage(() => tradeInService.list({ q, page: parsePage(page) }));
  return (
    <>
      <PageHeader
        title="Tukar Tambah"
        description="Riwayat transaksi tukar tambah."
        action={session.permissions.includes("trade_ins.manage") ? { href: "/trade-ins/new", label: "Tukar Tambah Baru" } : null}
      />
      <ListToolbar q={q} placeholder="Cari nomor tukar tambah" />
      <DataTable<TradeInRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Belum ada tukar tambah."
        columns={[
          { header: "Nomor", cell: (r) => <Link href={`/trade-ins/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.trade_in_number}</Link> },
          { header: "Waktu", cell: (r) => formatDateTime(r.created_at) },
          { header: "Customer", cell: (r) => r.customer?.name ?? "-" },
          { header: "Barang lama", cell: (r) => formatRupiah(r.trade_in_value), className: "text-right whitespace-nowrap" },
          { header: "Barang baru", cell: (r) => formatRupiah(r.sale_total), className: "text-right whitespace-nowrap" },
          { header: "Selisih", cell: (r) => formatRupiah(r.balance), className: "text-right whitespace-nowrap" },
          { header: "Status", cell: (r) => (r.status === "VOIDED" ? "Dibatalkan" : "Selesai") },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/trade-ins" params={{ q }} />
    </>
  );
}
