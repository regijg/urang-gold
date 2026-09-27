import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import PayPurchaseForm from "@/components/gold/PayPurchaseForm";
import VoidSaleForm from "@/components/gold/pos/VoidSaleForm";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { dbRupiah } from "@/lib/validation/common";
import { subRupiah } from "@/lib/validation/sales";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { purchaseService, type PurchaseDetail } from "@/server/services/purchase.service";
import { payPurchaseAction, voidPurchaseAction } from "../actions";

type Item = PurchaseDetail["items"][number];
type Payment = PurchaseDetail["payments"][number];

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("purchases.manage");
  const po = await loadPage(() => purchaseService.get(id));
  const remaining = subRupiah(dbRupiah(po.total), dbRupiah(po.paid_total));

  return (
    <>
      <PageHeader title={po.purchase_number} description={`${po.purchase_date} · ${po.supplier?.name ?? ""} · ${po.store?.name ?? ""}`} back={{ href: "/purchases", label: "Pembelian" }} />
      <div className="mb-4 flex gap-3 text-sm">
        <Link href={`/inventory/labels?ids=${po.items.map((i) => i.inventory_id).join(",")}`} className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">
          Cetak label barcode
        </Link>
      </div>
      {po.status === "VOIDED" && <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">Dibatalkan — {po.void_reason}</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <DataTable<Item>
            rows={po.items}
            rowKey={(r) => r.id}
            columns={[
              { header: "Barang", cell: (r) => <Link href={`/inventory/${r.inventory_id}`} className="text-brand-500 hover:underline"><span className="font-mono">{r.inventory?.barcode}</span> · {r.inventory?.name}</Link> },
              { header: "Kadar", cell: (r) => r.purity_code },
              { header: "Berat emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
              { header: "Modal", cell: (r) => formatRupiah(r.cost_price), className: "text-right whitespace-nowrap" },
              { header: "Ongkos", cell: (r) => formatRupiah(r.labor_cost), className: "text-right whitespace-nowrap" },
              { header: "Total", cell: (r) => formatRupiah(r.line_total), className: "text-right whitespace-nowrap font-medium" },
            ]}
          />
          <DataTable<Payment>
            rows={po.payments}
            rowKey={(r) => r.id}
            empty="Belum ada pembayaran."
            columns={[
              { header: "Waktu", cell: (r) => formatDateTime(r.paid_at) },
              { header: "Metode", cell: (r) => PAYMENT_LABELS[r.method] ?? r.method },
              { header: "Referensi", cell: (r) => r.reference ?? "-" },
              { header: "Nominal", cell: (r) => `${r.is_reversal ? "+" : "-"}${formatRupiah(r.amount)}`, className: "text-right" },
            ]}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Modal</dt><dd>{formatRupiah(po.subtotal_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Ongkos</dt><dd>{formatRupiah(po.labor_total)}</dd></div>
              <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white"><dt>Total</dt><dd>{formatRupiah(po.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Dibayar</dt><dd>{formatRupiah(po.paid_total)}</dd></div>
              <div className="flex justify-between font-medium"><dt>Sisa hutang</dt><dd>{formatRupiah(remaining)}</dd></div>
            </dl>
          </div>
          {po.status === "RECEIVED" && remaining !== "0" && <PayPurchaseForm action={payPurchaseAction.bind(null, id)} remaining={remaining} />}
          {po.status === "RECEIVED" && <VoidSaleForm action={voidPurchaseAction.bind(null, id)} />}
        </div>
      </div>
    </>
  );
}
