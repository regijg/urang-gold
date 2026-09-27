import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import PageHeader from "@/components/gold/PageHeader";
import VoidSaleForm from "@/components/gold/pos/VoidSaleForm";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { requireAppSession } from "@/server/auth/session";
import { loadPage } from "@/server/page-guard";
import { buybackService } from "@/server/services/buyback.service";
import type { BuybackDetail } from "@/server/repositories/buyback.repository";
import { voidBuybackAction } from "../actions";

type Item = BuybackDetail["items"][number];
type Payment = BuybackDetail["payments"][number];

export default async function BuybackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAppSession();
  const bb = await loadPage(() => buybackService.get(id));

  return (
    <>
      <PageHeader title={bb.buyback_number} description={`${formatDateTime(bb.bought_at)} · ${bb.store?.name ?? ""} · ${bb.customer?.name ?? ""}`} back={{ href: "/buybacks", label: "Buyback" }} />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {(["58", "80", "a4"] as const).map((f) => (
          <Link key={f} href={`/buybacks/${id}/print?format=${f}`} target="_blank" className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:text-gray-300">
            Cetak {f === "a4" ? "A4" : `${f}mm`}
          </Link>
        ))}
      </div>
      {bb.status === "VOIDED" && (
        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          Dibatalkan {formatDateTime(bb.voided_at)} — {bb.void_reason}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <DataTable<Item>
            rows={bb.items}
            rowKey={(r) => r.id}
            columns={[
              { header: "Barang", cell: (r) => <Link href={`/inventory/${r.inventory_id}`} className="text-brand-500 hover:underline">{r.name}{r.reused_piece ? " (barang toko)" : ""}</Link> },
              { header: "Kadar", cell: (r) => r.purity_code },
              { header: "Berat emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
              { header: "Harga/gram", cell: (r) => formatRupiah(r.price_per_gram), className: "text-right whitespace-nowrap" },
              { header: "Bruto", cell: (r) => formatRupiah(r.gross_amount), className: "text-right whitespace-nowrap" },
              { header: "Potongan", cell: (r) => formatRupiah(r.deduction), className: "text-right whitespace-nowrap" },
              { header: "Neto", cell: (r) => formatRupiah(r.net_amount), className: "text-right whitespace-nowrap font-medium" },
            ]}
          />
          <DataTable<Payment>
            rows={bb.payments}
            rowKey={(r) => r.id}
            columns={[
              { header: "Arah", cell: (r) => (r.direction === "OUT" ? "Keluar" : "Masuk") + (r.is_reversal ? " (pembatalan)" : "") },
              { header: "Metode", cell: (r) => PAYMENT_LABELS[r.method] ?? r.method },
              { header: "Nominal", cell: (r) => formatRupiah(r.amount), className: "text-right" },
            ]}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Bruto</dt><dd>{formatRupiah(bb.gross_total)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Potongan</dt><dd>-{formatRupiah(bb.deduction_total)}</dd></div>
              <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-white"><dt>Dibayar</dt><dd>{formatRupiah(bb.total)}</dd></div>
            </dl>
            {bb.notes && <p className="mt-3 text-gray-500">Catatan: {bb.notes}</p>}
          </div>
          {session.permissions.includes("sales.void") && bb.status === "COMPLETED" && <VoidSaleForm action={voidBuybackAction.bind(null, id)} />}
        </div>
      </div>
    </>
  );
}
