import type { Metadata } from "next";
import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import ListToolbar from "@/components/gold/ListToolbar";
import PageHeader from "@/components/gold/PageHeader";
import Pagination from "@/components/gold/Pagination";
import { formatDateOnly, formatDateTime, formatRupiah } from "@/lib/format";
import { parsePage } from "@/lib/validation/common";
import { ORDER_STATUS_LABELS } from "@/lib/validation/operations";
import { subRupiah } from "@/lib/validation/sales";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { orderService, type OrderRow } from "@/server/services/order.service";

export const metadata: Metadata = { title: "Pesanan & DP | UrangGold" };

const BADGE: Record<string, string> = {
  OPEN: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
  COMPLETED: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  await requirePagePermission("orders.manage");
  const status = sp.status ?? "OPEN";
  const data = await loadPage(() => orderService.list({ q: sp.q, status, page: parsePage(sp.page) }));

  return (
    <>
      <PageHeader title="Pesanan & DP" description="Barang disisihkan untuk customer dengan uang muka. Harga dikunci saat pesan." action={{ href: "/orders/new", label: "+ Pesanan Baru" }} />
      <ListToolbar
        q={sp.q}
        placeholder="Cari nomor pesanan"
        filters={[{ name: "status", value: status, allLabel: "Semua status", options: Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })) }]}
      />
      <DataTable<OrderRow>
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="Belum ada pesanan."
        columns={[
          {
            header: "Pesanan",
            cell: (r) => (
              <div>
                <Link href={`/orders/${r.id}`} className="font-mono font-medium text-brand-500 hover:underline">{r.order_number}</Link>
                <p className="text-xs text-gray-500">{formatDateTime(r.created_at)}</p>
              </div>
            ),
          },
          { header: "Customer", cell: (r) => r.customer?.name ?? "-" },
          { header: "Diambil", cell: (r) => (r.due_date ? formatDateOnly(r.due_date) : "-"), className: "whitespace-nowrap" },
          { header: "Total", cell: (r) => formatRupiah(r.total), className: "text-right whitespace-nowrap" },
          {
            header: "Sisa",
            cell: (r) => (r.status === "OPEN" ? <span className="font-medium text-warning-600">{formatRupiah(subRupiah(r.total, r.paid_total))}</span> : "-"),
            className: "text-right whitespace-nowrap",
          },
          { header: "Status", cell: (r) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[r.status]}`}>{ORDER_STATUS_LABELS[r.status]}</span> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/orders" params={{ q: sp.q, status }} />
    </>
  );
}
