import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { purchaseService, type PurchaseRow } from "@/server/services/purchase.service";

export const metadata: Metadata = { title: "Pembelian | GoldPOS" };

const PAYMENT_STATUS: Record<string, string> = { UNPAID: "Belum dibayar", PARTIAL: "Sebagian", PAID: "Lunas" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string }> }) {
  const { q, page, status } = await searchParams;
  await requirePagePermission("purchases.manage");
  const data = await loadPage(() => purchaseService.list({ q, page: parsePage(page), status }));
  return (
    <>
      <PageHeader title="Pembelian" description="Pembelian barang dari supplier." action={{ href: "/purchases/new", label: "Pembelian Baru" }} />
      <ListToolbar
        q={q}
        placeholder="Cari nomor pembelian / invoice supplier"
        filters={[{ name: "status", value: status, allLabel: "Semua pembayaran", options: Object.entries(PAYMENT_STATUS).map(([value, label]) => ({ value, label })) }]}
      />
      <DataTable<PurchaseRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Belum ada pembelian."
        columns={[
          { header: "Nomor", cell: (r) => <Link href={`/purchases/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.purchase_number}</Link> },
          { header: "Tanggal", cell: (r) => r.purchase_date },
          { header: "Supplier", cell: (r) => r.supplier?.name ?? "-" },
          { header: "Invoice", cell: (r) => r.supplier_invoice ?? "-" },
          { header: "Total", cell: (r) => formatRupiah(r.total), className: "text-right whitespace-nowrap" },
          { header: "Pembayaran", cell: (r) => (r.status === "VOIDED" ? "Dibatalkan" : PAYMENT_STATUS[r.payment_status]) },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/purchases" params={{ q, status }} />
    </>
  );
}
