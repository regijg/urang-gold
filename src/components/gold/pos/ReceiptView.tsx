import React from "react";
import { formatDateTime, formatGram, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/payments";
import type { Receipt } from "@/server/repositories/sales.repository";

export type ReceiptFormat = "a4" | "80" | "58";

const GOLD = "#B8901F";
const positive = (v: string | number | null | undefined) => Number(v ?? 0) > 0;

/**
 * E-nota. "a4" is the full layout (also the public link opened on a phone);
 * "80" / "58" are narrow monospace layouts for thermal printers.
 */
export default function ReceiptView({ receipt, format }: { receipt: Receipt; format: ReceiptFormat }) {
  return format === "a4" ? <FullReceipt receipt={receipt} /> : <ThermalReceipt receipt={receipt} width={format === "58" ? "58mm" : "80mm"} />;
}

function FullReceipt({ receipt }: { receipt: Receipt }) {
  const isBuyback = receipt.kind === "BUYBACK";
  const title = isBuyback ? "Nota Pembelian Emas" : "Nota Penjualan";
  const discountLabel = isBuyback ? "Potongan" : "Diskon";

  return (
    <article className="receipt mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-gray-900 shadow-sm ring-1 ring-gray-200 print:rounded-none print:shadow-none print:ring-0">
      {/* header */}
      <header className="px-6 pb-5 pt-6 sm:px-8" style={{ borderTop: `6px solid ${GOLD}` }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xl font-bold tracking-tight">{receipt.store.name}</p>
            {receipt.tenant.name !== receipt.store.name && <p className="text-sm text-gray-500">{receipt.tenant.name}</p>}
            {receipt.store.address && <p className="mt-1 text-sm text-gray-600">{receipt.store.address}</p>}
            {receipt.store.phone && <p className="text-sm text-gray-600">Telp. {receipt.store.phone}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
              {title}
            </p>
            <p className="mt-0.5 font-mono text-base font-semibold">{receipt.invoice_number}</p>
            <p className="text-sm text-gray-600">{formatDateTime(receipt.sold_at)}</p>
          </div>
        </div>

        {(receipt.customer || receipt.cashier) && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">{isBuyback ? "Penjual" : "Customer"}</p>
              <p className="font-medium">{receipt.customer ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Kasir</p>
              <p className="font-medium">{receipt.cashier ?? "-"}</p>
            </div>
          </div>
        )}

        {receipt.status === "VOIDED" && (
          <p className="mt-4 rounded-lg border-2 border-red-500 py-2 text-center text-sm font-bold uppercase tracking-wider text-red-600">Transaksi dibatalkan</p>
        )}
      </header>

      {/* items */}
      <section className="border-t border-gray-100 px-6 py-4 sm:px-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Barang</p>
        <ul className="divide-y divide-gray-100">
          {receipt.items.map((i) => (
            <li key={i.barcode} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{i.name}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">{i.purity_code}</span>
                  <span className="ml-2">{formatGram(i.gross_weight)}</span>
                  {String(i.gold_weight) !== String(i.gross_weight) && <span className="text-gray-400"> · emas {formatGram(i.gold_weight)}</span>}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-gray-400">{i.barcode}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatRupiah(i.price)}</p>
                {positive(i.discount) && (
                  <p className="text-xs text-gray-500">
                    <span className="line-through">{formatRupiah(i.subtotal)}</span> · {discountLabel} {formatRupiah(i.discount)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* totals */}
      <section className="border-t border-gray-100 px-6 py-4 sm:px-8">
        <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{isBuyback ? "Bruto" : "Subtotal"}</dt>
            <dd>{formatRupiah(receipt.subtotal)}</dd>
          </div>
          {positive(receipt.discount_total) && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{discountLabel}</dt>
              <dd>- {formatRupiah(receipt.discount_total)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-3 flex items-center justify-between rounded-xl px-4 py-3 text-white" style={{ backgroundColor: GOLD }}>
          <span className="text-sm font-semibold uppercase tracking-wider">{isBuyback ? "Dibayar ke customer" : "Total"}</span>
          <span className="text-xl font-bold">{formatRupiah(receipt.total)}</span>
        </div>

        {receipt.payments.length > 0 && (
          <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
            {receipt.payments.map((p, idx) => (
              <div key={idx} className="flex justify-between">
                <dt className="text-gray-500">{PAYMENT_LABELS[p.method] ?? p.method}</dt>
                <dd>{formatRupiah(p.amount)}</dd>
              </div>
            ))}
            {positive(receipt.change_amount) && (
              <div className="flex justify-between font-medium">
                <dt>Kembalian</dt>
                <dd>{formatRupiah(receipt.change_amount)}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <footer className="border-t border-dashed border-gray-200 px-6 py-5 text-center sm:px-8">
        <p className="font-medium">Terima kasih {isBuyback ? "atas kepercayaan Anda" : "telah berbelanja"} 🙏</p>
        <p className="mt-1 text-xs text-gray-500">
          Simpan nota ini sebagai bukti transaksi. Harga emas mengikuti harga pada tanggal transaksi.
        </p>
      </footer>
    </article>
  );
}

function ThermalReceipt({ receipt, width }: { receipt: Receipt; width: string }) {
  const isBuyback = receipt.kind === "BUYBACK";
  const line = <p className="my-1.5 overflow-hidden whitespace-nowrap text-gray-500">{"-".repeat(48)}</p>;
  const row = (l: React.ReactNode, r: React.ReactNode, bold = false) => (
    <p className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span>{l}</span>
      <span className="text-right">{r}</span>
    </p>
  );

  return (
    <div className="receipt mx-auto bg-white p-2 font-mono text-[11px] leading-snug text-black" style={{ width, maxWidth: "100%" }}>
      <div className="text-center">
        <p className="text-[13px] font-bold">{receipt.store.name}</p>
        {receipt.store.address && <p>{receipt.store.address}</p>}
        {receipt.store.phone && <p>Telp. {receipt.store.phone}</p>}
        {isBuyback && <p className="mt-1 font-bold">NOTA PEMBELIAN EMAS</p>}
        {receipt.status === "VOIDED" && <p className="mt-1 border border-black font-bold">DIBATALKAN</p>}
      </div>
      {line}
      {row("No", receipt.invoice_number)}
      {row("Tgl", formatDateTime(receipt.sold_at))}
      {receipt.cashier && row("Kasir", receipt.cashier)}
      {receipt.customer && row(isBuyback ? "Penjual" : "Cust", receipt.customer)}
      {line}
      {receipt.items.map((i) => (
        <div key={i.barcode} className="mb-1.5">
          <p className="font-bold">{i.name}</p>
          {row(`${i.purity_code} ${formatGram(i.gross_weight)}`, formatRupiah(i.subtotal))}
          {positive(i.discount) && row(isBuyback ? "Potongan" : "Diskon", `-${formatRupiah(i.discount)}`)}
        </div>
      ))}
      {line}
      {positive(receipt.discount_total) && row(isBuyback ? "Potongan" : "Diskon", `-${formatRupiah(receipt.discount_total)}`)}
      {row(isBuyback ? "DIBAYAR" : "TOTAL", formatRupiah(receipt.total), true)}
      {receipt.payments.map((p, idx) => (
        <React.Fragment key={idx}>{row(PAYMENT_LABELS[p.method] ?? p.method, formatRupiah(p.amount))}</React.Fragment>
      ))}
      {positive(receipt.change_amount) && row("Kembali", formatRupiah(receipt.change_amount))}
      {line}
      <p className="text-center">Terima kasih atas kunjungan Anda</p>
    </div>
  );
}
