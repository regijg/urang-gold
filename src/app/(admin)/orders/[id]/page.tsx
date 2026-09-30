import Link from "next/link";
import DataTable from "@/components/gold/DataTable";
import DocPaymentForm from "@/components/gold/DocPaymentForm";
import PageHeader from "@/components/gold/PageHeader";
import { formatDateOnly, formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import { ORDER_STATUS_LABELS } from "@/lib/validation/operations";
import { subRupiah } from "@/lib/validation/sales";
import { waLink } from "@/lib/whatsapp";
import { requireAppSession } from "@/server/auth/session";
import { loadPage, requirePagePermission } from "@/server/page-guard";
import { orderService, type OrderDetail } from "@/server/services/order.service";
import { cancelOrderAction, completeOrderAction, payOrderAction } from "../actions";

type Item = OrderDetail["items"][number];
type Payment = OrderDetail["payments"][number];

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission("orders.manage");
  const session = await requireAppSession();
  const o = await loadPage(() => orderService.get(id));
  const remaining = subRupiah(o.total, o.paid_total);
  const open = o.status === "OPEN";

  const waText = [
    `*${session.tenant.name}*`,
    `Pesanan: ${o.order_number}`,
    "",
    ...o.items.map((i) => `• ${i.name} (${i.purity_code}, ${formatGram(i.gold_weight)}) ${formatRupiah(i.price)}`),
    "",
    `Total: ${formatRupiah(o.total)}`,
    `Sudah dibayar: ${formatRupiah(o.paid_total)}`,
    `*Sisa: ${formatRupiah(remaining)}*`,
    o.due_date ? `Rencana diambil: ${formatDateOnly(o.due_date)}` : "",
    "",
    "Harga sudah dikunci. Terima kasih 🙏",
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return (
    <>
      <PageHeader
        title={o.order_number}
        description={`${formatDateTime(o.created_at)} · ${o.customer?.name ?? ""} · ${ORDER_STATUS_LABELS[o.status]}`}
        back={{ href: "/orders", label: "Pesanan & DP" }}
      />
      {o.status === "CANCELLED" && (
        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          Dibatalkan — {o.cancel_reason}. DP dikembalikan {formatRupiah(o.refund_total)}, hangus {formatRupiah(subRupiah(o.paid_total, o.refund_total))}.
        </div>
      )}
      {o.status === "COMPLETED" && o.sale_id && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">
          Sudah diambil dan menjadi penjualan.
          <Link href={`/sales/${o.sale_id}`} className="font-semibold underline">Lihat nota penjualan</Link>
          <Link href={`/sales/${o.sale_id}/print?format=80`} target="_blank" className="font-semibold underline">Cetak nota</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <DataTable<Item>
            rows={o.items}
            rowKey={(r) => r.id}
            columns={[
              { header: "Barang", cell: (r) => <Link href={`/inventory/${r.inventory_id}`} className="text-brand-500 hover:underline"><span className="font-mono">{r.barcode}</span> · {r.name}</Link> },
              { header: "Kadar", cell: (r) => r.purity_code },
              { header: "Berat emas", cell: (r) => formatGram(r.gold_weight), className: "text-right whitespace-nowrap" },
              { header: "Harga/gram", cell: (r) => formatRupiah(r.sell_rate), className: "text-right whitespace-nowrap" },
              { header: "Diskon", cell: (r) => (r.discount === "0" ? "-" : formatRupiah(r.discount)), className: "text-right whitespace-nowrap" },
              { header: "Harga", cell: (r) => formatRupiah(r.price), className: "text-right whitespace-nowrap font-medium" },
            ]}
          />
          <DataTable<Payment>
            rows={o.payments}
            rowKey={(r) => r.id}
            empty="Belum ada pembayaran."
            columns={[
              { header: "Waktu", cell: (r) => formatDateTime(r.paid_at) },
              { header: "Metode", cell: (r) => PAYMENT_LABELS[r.method] ?? r.method },
              { header: "Referensi", cell: (r) => r.reference ?? "-" },
              { header: "Nominal", cell: (r) => (r.direction === "OUT" ? <span className="text-error-600">refund -{formatRupiah(r.amount)}</span> : formatRupiah(r.amount)), className: "text-right whitespace-nowrap" },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm dark:border-gray-800 dark:bg-gray-900">
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Customer</dt><dd className="font-medium text-gray-800 dark:text-white/90">{o.customer?.name}</dd></div>
              {o.due_date && <div className="flex justify-between"><dt className="text-gray-500">Rencana diambil</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatDateOnly(o.due_date)}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-500">Total (harga dikunci)</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(o.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Sudah dibayar</dt><dd className="font-medium text-gray-800 dark:text-white/90">{formatRupiah(o.paid_total)}</dd></div>
              {open && <div className="flex justify-between pt-1 text-base font-semibold text-gray-900 dark:text-white"><dt>Sisa</dt><dd>{formatRupiah(remaining)}</dd></div>}
            </dl>
            {o.notes && <p className="mt-3 text-gray-600 dark:text-gray-300">Catatan: {o.notes}</p>}
            {o.customer?.phone && open && (
              <a href={waLink(o.customer.phone, waText)} target="_blank" rel="noreferrer" className="mt-3 block rounded-lg border border-success-300 py-2 text-center text-success-700 dark:text-success-400">
                Kirim info pesanan via WhatsApp
              </a>
            )}
          </div>

          {open && (
            <>
              <DocPaymentForm<{ sale_id: string }>
                action={completeOrderAction.bind(null, id)}
                title="Barang diambil"
                hint={remaining === "0" ? "Sudah lunas. Simpan untuk membuat nota penjualan." : "Terima pelunasan lalu buat nota penjualan."}
                submitLabel="Selesaikan & Buat Nota"
                amountLabel="Pelunasan"
                defaultAmount={remaining === "0" ? "" : remaining}
                successLink={(d) => ({ href: `/sales/${d.sale_id}/print?format=80`, label: "Cetak nota penjualan" })}
              />
              {remaining !== "0" && (
                <DocPaymentForm action={payOrderAction.bind(null, id)} title="Cicilan / tambah DP" submitLabel="Catat Pembayaran" />
              )}
              <DocPaymentForm
                action={cancelOrderAction.bind(null, id)}
                title="Batalkan pesanan"
                hint={`Barang kembali tersedia. Isi nominal DP yang dikembalikan (maks. ${formatRupiah(o.paid_total)}); sisanya dianggap hangus.`}
                submitLabel="Batalkan Pesanan"
                amountLabel="DP dikembalikan"
                withReason
                danger
                confirmText="Batalkan pesanan ini?"
                methods={["CASH", "BANK_TRANSFER"]}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
