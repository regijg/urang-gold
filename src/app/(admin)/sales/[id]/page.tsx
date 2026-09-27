import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import VoidSaleForm from "@/components/gold/pos/VoidSaleForm";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { salesService } from "@/server/services/sales.service";
import type { SaleDetail } from "@/server/repositories/sales.repository";
import { voidSaleAction } from "../actions";

type Item = SaleDetail["items"][number];
type Payment = SaleDetail["payments"][number];

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAppSession();
  const sale = await loadPage(() => salesService.get(id));
  const canVoid = session.permissions.includes("sales.void") && sale.status === "COMPLETED";

  return (
    <>
      <PageHeader title={sale.invoice_number} description={`${formatDateTime(sale.sold_at)} · ${sale.store?.name ?? ""}`} back={{ href: "/sales", label: "Penjualan" }} />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {(["58", "80", "a4"] as const).map((f) => (
          <Link key={f} href={`/sales/${id}/print?format=${f}`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">
            Cetak {f === "a4" ? "A4" : `${f}mm`}
          </Link>
        ))}
        <Link href={`/nota/${sale.public_token}`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">
          E-nota publik
        </Link>
      </div>

      {sale.status === "VOIDED" && (
        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          Dibatalkan {formatDateTime(sale.voided_at)} — {sale.void_reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <DataTable<Item>
            rows={sale.items}
            rowKey={(r) => r.id}
            columns={[
              { header: "Barang", cell: (r) => <div><Link href={`/inventory/${r.inventory_id}`} className="text-brand-500 hover:underline">{r.name}</Link><p className="font-mono text-xs text-gray-500">{r.barcode}</p></div> },
              { header: "Kadar", cell: (r) => r.purity_code },
              { header: "Berat emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
              { header: "Harga/gram", cell: (r) => formatRupiah(r.sell_rate), className: "text-right whitespace-nowrap" },
              { header: "Harga", cell: (r) => formatRupiah(r.subtotal), className: "text-right whitespace-nowrap" },
              { header: "Diskon", cell: (r) => formatRupiah(r.discount), className: "text-right whitespace-nowrap" },
              { header: "Jumlah", cell: (r) => formatRupiah(r.price), className: "text-right whitespace-nowrap font-medium" },
            ]}
          />
          <DataTable<Payment>
            rows={sale.payments}
            rowKey={(r) => r.id}
            columns={[
              { header: "Arah", cell: (r) => (r.direction === "IN" ? "Masuk" : "Keluar") + (r.is_reversal ? " (refund)" : "") },
              { header: "Metode", cell: (r) => PAYMENT_LABELS[r.method] ?? r.method },
              { header: "Referensi", cell: (r) => r.reference ?? "-" },
              { header: "Nominal", cell: (r) => formatRupiah(r.amount), className: "text-right" },
            ]}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Customer</dt><dd className="font-medium text-gray-800 dark:text-white/90">{sale.customer?.name ?? "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(sale.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Diskon</dt><dd className="font-medium text-gray-800 dark:text-white/90">-{formatRupiah(sale.discount_total)}</dd></div>
              <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white"><dt>Total</dt><dd>{formatRupiah(sale.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Dibayar</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(sale.paid_total)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Kembalian</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(sale.change_amount)}</dd></div>
            </dl>
            {sale.notes && <p className="mt-3 text-gray-500">Catatan: {sale.notes}</p>}
          </div>
          {canVoid && <VoidSaleForm action={voidSaleAction.bind(null, id)} />}
        </div>
      </div>
    </>
  );
}
